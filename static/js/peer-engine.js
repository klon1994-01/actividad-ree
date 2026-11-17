/**
 * DVEEEyR - Motor de Juego Peer-to-Peer (WebRTC) para Netlify
 * Permite partidas multijugador en tiempo real SIN servidor Python ni Git.
 * Funciona directamente en el navegador del anfitrión y los celulares de los participantes.
 */

window.PeerEngine = (function() {
    const PEER_PREFIX = "ssg-dveeeyr-room-";

    // ==========================================
    // 1. HOST ENGINE (El navegador del anfitrión es el servidor)
    // ==========================================
    class HostRoom {
        constructor(pin, quiz, callbacks) {
            this.pin = pin;
            this.quiz = quiz;
            this.callbacks = callbacks || {};
            this.peer = null;
            this.players = new Map(); // id -> { id, name, emoji, score, streak, conn }
            this.state = "LOBBY";
            this.currentQIndex = -1;
            this.qStartTime = 0;
            this.qDuration = 20;
            this.currentAnswers = new Map(); // id -> { choice, timeTaken, scoreDelta, isCorrect }
            this.botIntervals = [];
            this.timerInterval = null;

            this.initPeer();
        }

        initPeer() {
            const peerId = PEER_PREFIX + this.pin;
            console.log("Iniciando Peer Anfitrión:", peerId);

            try {
                this.peer = new Peer(peerId, {
                    debug: 1,
                    config: {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' },
                            { urls: 'stun:stun2.l.google.com:19302' }
                        ]
                    }
                });
            } catch (err) {
                console.error("Error al crear Peer anfitrión:", err);
                if (this.callbacks.onError) this.callbacks.onError("No se pudo iniciar el canal PeerJS.");
                return;
            }

            this.peer.on("open", (id) => {
                console.log("Sala P2P abierta con éxito. ID:", id);
                if (this.callbacks.onRoomCreated) {
                    this.callbacks.onRoomCreated({
                        pin: this.pin,
                        quiz: this.quiz,
                        total_players: 0
                    });
                }
            });

            this.peer.on("connection", (conn) => {
                this.handleIncomingConnection(conn);
            });

            this.peer.on("error", (err) => {
                console.warn("Aviso PeerJS Anfitrión:", err);
                // Si el ID ya está en uso, reintentar con otro pin
                if (err.type === "unavailable-id") {
                    this.pin = Math.floor(1000 + Math.random() * 9000).toString();
                    this.initPeer();
                }
            });
        }

        handleIncomingConnection(conn) {
            conn.on("open", () => {
                console.log("Jugador conectado a la conexión Peer:", conn.peer);
            });

            conn.on("data", (data) => {
                this.handlePlayerAction(conn, data);
            });

            conn.on("close", () => {
                this.removePlayerByConn(conn);
            });
        }

        handlePlayerAction(conn, data) {
            if (!data || !data.type) return;

            switch (data.type) {
                case "PLAYER_JOIN": {
                    const playerId = data.player_id || "p_" + Math.random().toString(36).substring(2, 9);
                    const player = {
                        id: playerId,
                        name: (data.name || "Jugador").substring(0, 18),
                        emoji: data.emoji || "🩺",
                        score: 0,
                        streak: 0,
                        conn: conn
                    };

                    this.players.set(playerId, player);

                    // Confirmar unión al jugador
                    conn.send({
                        type: "JOIN_SUCCESS",
                        player_id: playerId,
                        name: player.name,
                        emoji: player.emoji,
                        quiz_title: this.quiz ? this.quiz.title : "Actividad REE"
                    });

                    // Notificar a la pantalla principal
                    if (this.callbacks.onPlayerJoined) {
                        this.callbacks.onPlayerJoined({
                            name: player.name,
                            emoji: player.emoji,
                            total: this.players.size,
                            players: this.getPublicPlayerList()
                        });
                    }
                    break;
                }

                case "PLAYER_ANSWER": {
                    if (this.state !== "QUESTION") return;
                    let playerId = data.player_id;
                    if (!playerId && conn) {
                        for (let [pid, p] of this.players.entries()) {
                            if (p.conn === conn) {
                                playerId = pid;
                                break;
                            }
                        }
                    }
                    const choice = parseInt(data.choice);
                    if (!this.players.has(playerId)) return;
                    if (this.currentAnswers.has(playerId)) return; // Ya respondió

                    const timeTaken = (Date.now() - this.qStartTime) / 1000;
                    const currentQ = this.getCurrentQuestion();
                    const isCorrect = (currentQ && currentQ.correct === choice);
                    const qPoints = (currentQ && currentQ.points !== undefined) ? currentQ.points : 1000;

                    let scoreDelta = 0;
                    const player = this.players.get(playerId);

                    if (isCorrect) {
                        player.streak = (player.streak || 0) + 1;
                        // Fórmula Kahoot: tiempo restante + racha
                        const timeFraction = Math.max(0, Math.min(1, timeTaken / this.qDuration));
                        const baseScore = Math.round(qPoints * (1 - (timeFraction / 2)));
                        const streakBonus = Math.min(500, (player.streak - 1) * 80);
                        scoreDelta = baseScore + streakBonus;
                    } else {
                        player.streak = 0;
                    }

                    player.score = (player.score || 0) + scoreDelta;

                    this.currentAnswers.set(playerId, {
                        choice: choice,
                        timeTaken: timeTaken,
                        scoreDelta: scoreDelta,
                        isCorrect: isCorrect
                    });

                    // Notificar al jugador que se recibió
                    if (conn && conn.open) {
                        try {
                            conn.send({ type: "ANSWER_CONFIRMED" });
                        } catch (e) {}
                    }

                    // Actualizar contador en pantalla del presentador
                    if (this.callbacks.onAnswerCountUpdate) {
                        this.callbacks.onAnswerCountUpdate({
                            answered: this.currentAnswers.size,
                            total: this.players.size
                        });
                    }

                    // Si todos los jugadores ya respondieron, terminar la pregunta anticipadamente
                    if (this.currentAnswers.size >= this.players.size && this.players.size > 0) {
                        this.endQuestion();
                    }
                    break;
                }
            }
        }

        removePlayerByConn(conn) {
            for (let [id, p] of this.players.entries()) {
                if (p.conn === conn) {
                    this.players.delete(id);
                    if (this.callbacks.onPlayerLeft) {
                        this.callbacks.onPlayerLeft({
                            player_id: id,
                            total: this.players.size,
                            players: this.getPublicPlayerList()
                        });
                    }
                    break;
                }
            }
        }

        getPublicPlayerList() {
            return Array.from(this.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                emoji: p.emoji,
                score: p.score
            }));
        }

        getCurrentQuestion() {
            if (!this.quiz || !this.quiz.questions) return null;
            return this.quiz.questions[this.currentQIndex];
        }

        // ==================== FLUJO DEL JUEGO ====================
        startNextQuestion() {
            this.currentQIndex++;
            const totalQ = this.quiz.questions.length;

            if (this.currentQIndex >= totalQ) {
                this.showPodium();
                return;
            }

            const q = this.quiz.questions[this.currentQIndex];
            this.state = "QUESTION";
            this.currentAnswers.clear();
            this.qDuration = q.time || 20;
            this.qStartTime = Date.now();

            const questionPayload = {
                type: "QUESTION_START",
                q_index: this.currentQIndex,
                total_q: totalQ,
                question: q.question,
                emoji: q.emoji || "🎯",
                time: this.qDuration,
                points: q.points || 1000,
                options_count: q.options ? q.options.length : 4,
                options: q.options || []
            };

            // Notificar a todos los jugadores por P2P
            this.broadcast(questionPayload);

            // Notificar a la pantalla del anfitrión
            if (this.callbacks.onQuestionStart) {
                this.callbacks.onQuestionStart(questionPayload);
            }

            // Simulación de bots si hay
            this.simulateBotsAnswering();

            // Temporizador automático
            if (this.timerInterval) clearInterval(this.timerInterval);
            let secondsLeft = this.qDuration;

            this.timerInterval = setInterval(() => {
                secondsLeft--;
                if (this.callbacks.onTimerTick) {
                    this.callbacks.onTimerTick(secondsLeft);
                }
                if (secondsLeft <= 0) {
                    clearInterval(this.timerInterval);
                    this.endQuestion();
                }
            }, 1000);
        }

        endQuestion() {
            if (this.state !== "QUESTION") return;
            this.state = "RESULTS";
            if (this.timerInterval) clearInterval(this.timerInterval);

            const q = this.getCurrentQuestion();
            const correctChoice = q ? q.correct : 0;

            // Contar estadísticas por opción
            const stats = [0, 0, 0, 0];
            for (let ans of this.currentAnswers.values()) {
                if (ans.choice >= 0 && ans.choice < 4) {
                    stats[ans.choice]++;
                }
            }

            // Generar ranking ordenado
            const sortedPlayers = Array.from(this.players.values()).sort((a, b) => b.score - a.score);
            const top5 = sortedPlayers.slice(0, 5).map(p => ({
                name: p.name,
                emoji: p.emoji,
                score: p.score
            }));

            // Enviar resultados personalizados a cada jugador
            sortedPlayers.forEach((p, idx) => {
                const ans = this.currentAnswers.get(p.id);
                const isCorrect = ans ? ans.isCorrect : false;
                const pointsEarned = ans ? ans.scoreDelta : 0;

                try {
                    if (p.conn && p.conn.open) {
                        p.conn.send({
                            type: "QUESTION_RESULTS",
                            is_correct: isCorrect,
                            points_earned: pointsEarned,
                            score_delta: pointsEarned,
                            did_answer: !!ans,
                            total_score: p.score,
                            rank: idx + 1,
                            total_players: sortedPlayers.length,
                            streak: p.streak || 0,
                            correct_choice: correctChoice
                        });
                    }
                } catch (e) {}
            });

            // Notificar al host
            if (this.callbacks.onQuestionResults) {
                this.callbacks.onQuestionResults({
                    correct_choice: correctChoice,
                    stats: stats,
                    total_answered: this.currentAnswers.size,
                    total_players: this.players.size,
                    leaderboard: top5
                });
            }
        }

        showPodium() {
            this.state = "PODIUM";
            if (this.timerInterval) clearInterval(this.timerInterval);

            const sorted = Array.from(this.players.values()).sort((a, b) => b.score - a.score);
            const top3 = sorted.slice(0, 3).map((p, idx) => ({
                rank: idx + 1,
                name: p.name,
                emoji: p.emoji,
                score: p.score
            }));

            // Notificar a cada jugador su podio
            sorted.forEach((p, idx) => {
                try {
                    if (p.conn && p.conn.open) {
                        p.conn.send({
                            type: "PODIUM",
                            rank: idx + 1,
                            my_rank: idx + 1,
                            score: p.score,
                            my_score: p.score,
                            total_players: sorted.length
                        });
                    }
                } catch (e) {}
            });

            // Notificar al host
            if (this.callbacks.onPodium) {
                this.callbacks.onPodium({
                    top3: top3,
                    total_players: sorted.length
                });
            }
        }

        kickPlayer(playerId) {
            const p = this.players.get(playerId);
            if (!p) return;
            if (p.conn && p.conn.open) {
                try {
                    p.conn.send({ type: "KICKED" });
                    p.conn.close();
                } catch (e) {}
            }
            this.players.delete(playerId);
            if (this.callbacks.onPlayerLeft) {
                this.callbacks.onPlayerLeft({
                    total: this.players.size,
                    players: this.getPublicPlayerList()
                });
            }
        }

        addVirtualBots(count = 200) {
            const botAvatars = ["🩺", "💉", "🏥", "🧬", "🦁", "🐼", "🦊", "⚡", "🔥", "🚀", "⭐", "🏆"];
            const names = [
                "Dr. Roberto", "Dra. Carmen", "Enf. Laura", "Epidem. Miguel", "Dr. Alejandro",
                "Dra. Sofía", "Dra. Patricia", "Enf. Carlos", "Dr. Fernando", "Dra. Mariana",
                "Epidem. Daniel", "Enf. Elena", "Dra. Valeria", "Dr. Javier", "Dra. Gabriela"
            ];

            for (let i = 1; i <= count; i++) {
                const bId = "bot_" + i;
                const baseName = names[(i - 1) % names.length];
                this.players.set(bId, {
                    id: bId,
                    name: `${baseName} #${i}`,
                    emoji: botAvatars[i % botAvatars.length],
                    score: 0,
                    streak: 0,
                    conn: null // Virtual
                });
            }

            if (this.callbacks.onBotsAdded) {
                this.callbacks.onBotsAdded({
                    count: count,
                    total: this.players.size,
                    players: this.getPublicPlayerList()
                });
            }
        }

        simulateBotsAnswering() {
            // Limpiar anteriores
            this.botIntervals.forEach(t => clearTimeout(t));
            this.botIntervals = [];

            const q = this.getCurrentQuestion();
            if (!q) return;

            const correct = q.correct || 0;
            const count = q.options ? q.options.length : 4;

            for (let [id, p] of this.players.entries()) {
                if (!p.conn) { // Es un bot
                    const delay = 600 + Math.random() * ((this.qDuration - 1.5) * 1000);
                    const timer = setTimeout(() => {
                        if (this.state !== "QUESTION") return;
                        // 75% probabilidad de acertar
                        const choice = (Math.random() < 0.75) ? correct : Math.floor(Math.random() * count);
                        this.handlePlayerAction(null, {
                            type: "PLAYER_ANSWER",
                            player_id: id,
                            choice: choice
                        });
                    }, delay);
                    this.botIntervals.push(timer);
                }
            }
        }

        broadcast(data) {
            for (let p of this.players.values()) {
                if (p.conn && p.conn.open) {
                    try {
                        p.conn.send(data);
                    } catch (e) {}
                }
            }
        }

        destroy() {
            if (this.timerInterval) clearInterval(this.timerInterval);
            this.botIntervals.forEach(t => clearTimeout(t));
            if (this.peer) {
                try { this.peer.destroy(); } catch (e) {}
            }
        }
    }

    // ==========================================
    // 2. PLAYER CLIENT (El celular se conecta al Peer del anfitrión)
    // ==========================================
    class PlayerClient {
        constructor(pin, name, emoji, callbacks) {
            this.pin = pin;
            this.name = name;
            this.emoji = emoji;
            this.callbacks = callbacks || {};
            this.peer = null;
            this.conn = null;
            this.playerId = "p_" + Math.random().toString(36).substring(2, 9);
            this.startTime = 0;

            this.initPeer();
        }

        initPeer() {
            console.log("Iniciando Peer Participante...");
            try {
                this.peer = new Peer({
                    debug: 1,
                    config: {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' },
                            { urls: 'stun:stun2.l.google.com:19302' }
                        ]
                    }
                });
            } catch (err) {
                console.error("Error al crear Peer participante:", err);
                if (this.callbacks.onError) this.callbacks.onError("No se pudo iniciar la conexión WebRTC.");
                return;
            }

            this.peer.on("open", () => {
                const targetHostId = PEER_PREFIX + this.pin;
                console.log("Conectando al anfitrión:", targetHostId);

                this.conn = this.peer.connect(targetHostId, {
                    reliable: true
                });

                this.conn.on("open", () => {
                    console.log("Conexión directa P2P establecida con el anfitrión.");
                    // Enviar datos de unión
                    this.conn.send({
                        type: "PLAYER_JOIN",
                        player_id: this.playerId,
                        pin: this.pin,
                        name: this.name,
                        emoji: this.emoji
                    });
                });

                this.conn.on("data", (data) => {
                    this.handleMessage(data);
                });

                this.conn.on("close", () => {
                    console.log("Conexión con el anfitrión cerrada.");
                    if (this.callbacks.onClose) this.callbacks.onClose();
                });

                this.conn.on("error", (err) => {
                    console.warn("Error en conexión con anfitrión:", err);
                    if (this.callbacks.onError) this.callbacks.onError("Error al conectar con la sala. Verifica el PIN.");
                });
            });

            this.peer.on("error", (err) => {
                console.warn("PeerJS error participante:", err);
                if (this.callbacks.onError) {
                    this.callbacks.onError("No se pudo encontrar la sala con el PIN: " + this.pin);
                }
            });
        }

        handleMessage(data) {
            if (!data || !data.type) return;

            switch (data.type) {
                case "JOIN_SUCCESS":
                    if (this.callbacks.onJoinSuccess) this.callbacks.onJoinSuccess(data);
                    break;
                case "QUESTION_START":
                    this.startTime = Date.now();
                    if (this.callbacks.onQuestionStart) this.callbacks.onQuestionStart(data);
                    break;
                case "ANSWER_CONFIRMED":
                    if (this.callbacks.onAnswerConfirmed) this.callbacks.onAnswerConfirmed(data);
                    break;
                case "QUESTION_RESULTS":
                    if (this.callbacks.onQuestionResults) this.callbacks.onQuestionResults(data);
                    break;
                case "PODIUM":
                    if (this.callbacks.onPodium) this.callbacks.onPodium(data);
                    break;
            }
        }

        sendAnswer(choice) {
            if (!this.conn || !this.conn.open) return;
            const timeTaken = (Date.now() - this.startTime) / 1000;
            this.conn.send({
                type: "PLAYER_ANSWER",
                player_id: this.playerId,
                choice: choice,
                time_taken: timeTaken
            });
        }

        destroy() {
            if (this.conn) {
                try { this.conn.close(); } catch (e) {}
            }
            if (this.peer) {
                try { this.peer.destroy(); } catch (e) {}
            }
        }
    }

    return {
        HostRoom,
        PlayerClient
    };
})();
