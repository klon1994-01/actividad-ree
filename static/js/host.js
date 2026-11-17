// Host Controller & Projector Management

document.addEventListener("DOMContentLoaded", () => {
    let ws = null;
    let currentPin = null;
    let localIp = window.location.hostname;
    let port = window.location.port || 8000;
    let timerInterval = null;
    let timeRemaining = 0;
    let currentQuiz = null;
    let quizzesList = [];

    // DOM Elements
    const audioToggleBtn = document.getElementById("audioToggleBtn");
    const volumeSlider = document.getElementById("volumeSlider");
    const addBotsBtn = document.getElementById("addBotsBtn");
    const quizSelector = document.getElementById("quizSelector");
    const openEditorBtn = document.getElementById("openEditorBtn");

    // Views
    const lobbyView = document.getElementById("lobbyView");
    const questionView = document.getElementById("questionView");
    const leaderboardView = document.getElementById("leaderboardView");
    const podiumView = document.getElementById("podiumView");

    // Header elements
    const pinDisplay = document.getElementById("pinDisplay");
    const hostHeader = document.getElementById("hostHeader");

    // Lobby Elements
    const qrCodeContainer = document.getElementById("qrCode");
    const joinUrlText = document.getElementById("joinUrlText");
    const playersCountText = document.getElementById("playersCountText");
    const playersGrid = document.getElementById("playersGrid");
    const startGameBtn = document.getElementById("startGameBtn");

    // Question Elements
    const questionStepBadge = document.getElementById("questionStepBadge");
    const questionTitle = document.getElementById("questionTitle");
    const timerCircle = document.getElementById("timerCircle");
    const mediaContainer = document.getElementById("mediaContainer");
    const answersCounterNumber = document.getElementById("answersCounterNumber");
    const answersCounterTotal = document.getElementById("answersCounterTotal");
    const optionsGrid = document.getElementById("optionsGrid");
    const nextQuestionBtn = document.getElementById("nextQuestionBtn");
    const showLeaderboardBtn = document.getElementById("showLeaderboardBtn");

    // Audio setup
    let isMuted = false;
    audioToggleBtn.addEventListener("click", () => {
        isMuted = !isMuted;
        window.kahootAudio.setMuted(isMuted);
        audioToggleBtn.textContent = isMuted ? "🔇" : "🔊";
    });

    volumeSlider.addEventListener("input", (e) => {
        window.kahootAudio.setVolume(parseFloat(e.target.value));
    });

    // Helper: switch views
    function showView(view) {
        lobbyView.style.display = "none";
        questionView.style.display = "none";
        leaderboardView.style.display = "none";
        podiumView.style.display = "none";
        view.style.display = "flex";
    }

    let p2pRoom = null;
    let isP2pMode = false;
    let lastLeaderboard = [];

    // UI de conexión y servidor
    const serverConfigBtn = document.getElementById("serverConfigBtn");
    const connectionAlertBanner = document.getElementById("connectionAlertBanner");
    const bannerConfigServerBtn = document.getElementById("bannerConfigServerBtn");
    const serverConfigInlinePanel = document.getElementById("serverConfigInlinePanel");
    const inlineServerInput = document.getElementById("inlineServerInput");
    const inlineSaveServerBtn = document.getElementById("inlineSaveServerBtn");
    const inlineLocalhostBtn = document.getElementById("inlineLocalhostBtn");

    function updateInlineInputValue() {
        if (inlineServerInput) {
            inlineServerInput.value = window.GAME_CONFIG.getSavedBackendUrl() || (window.GAME_CONFIG.isLocalhost ? "http://localhost:8000" : "");
        }
    }

    if (inlineSaveServerBtn) {
        inlineSaveServerBtn.addEventListener("click", () => {
            const val = inlineServerInput.value.trim();
            if (!val) {
                alert("Por favor ingresa una URL válida.");
                return;
            }
            window.GAME_CONFIG.setBackendUrl(val);
            if (ws) {
                try { ws.close(); } catch (e) {}
            }
            connectHostWs();
        });
    }

    if (inlineLocalhostBtn) {
        inlineLocalhostBtn.addEventListener("click", () => {
            inlineServerInput.value = "http://localhost:8000";
            window.GAME_CONFIG.setBackendUrl("http://localhost:8000");
            if (ws) {
                try { ws.close(); } catch (e) {}
            }
            connectHostWs();
        });
    }

    function toggleInlinePanel() {
        if (serverConfigInlinePanel) {
            const isHidden = serverConfigInlinePanel.style.display === "none";
            serverConfigInlinePanel.style.display = isHidden ? "flex" : "none";
            updateInlineInputValue();
            if (isHidden && inlineServerInput) inlineServerInput.focus();
        }
    }

    if (bannerConfigServerBtn) bannerConfigServerBtn.addEventListener("click", toggleInlinePanel);
    if (serverConfigBtn) serverConfigBtn.addEventListener("click", toggleInlinePanel);

    function showConnectionBanner() {
        if (connectionAlertBanner && !isP2pMode) connectionAlertBanner.style.display = "flex";
        updateInlineInputValue();
    }

    function hideConnectionBanner() {
        if (connectionAlertBanner) connectionAlertBanner.style.display = "none";
    }

    // ========================================================
    // MODO 100% NETLIFY: PEER-TO-PEER WEBRTC DIRECTO
    // ========================================================
    async function startP2pHostRoom() {
        isP2pMode = true;
        console.log("Iniciando Modo P2P 100% Netlify (Sin Git ni servidores externos)");
        hideConnectionBanner();

        if (serverConfigBtn) {
            serverConfigBtn.textContent = "🟢 Netlify P2P Activo";
            serverConfigBtn.title = "La sala está corriendo 100% en Netlify mediante WebSockets en la nube";
        }

        try {
            // Cargar cuestionarios locales
            let res = await fetch("/data/quizzes.json");
            if (!res.ok) {
                res = await fetch("/static/data/quizzes.json");
            }
            quizzesList = await res.json();
        } catch (e) {
            console.warn("Cargando cuestionarios por defecto:", e);
            quizzesList = [
                {
                    id: "ssg_epidemiologia_ree",
                    title: "🏥 Vigilancia Epidemiológica y Salud Pública (SSG - REE)",
                    questions: []
                }
            ];
        }

        renderQuizSelector();

        const urlParams = new URLSearchParams(window.location.search);
        const queryQuizId = urlParams.get("quiz");
        if (queryQuizId && quizzesList.some(q => q.id === queryQuizId)) {
            quizSelector.value = queryQuizId;
        }

        const selectedQuizId = quizSelector.value || (quizzesList[0] ? quizzesList[0].id : null);
        const selectedQuiz = quizzesList.find(q => q.id === selectedQuizId) || quizzesList[0];

        // PIN aleatorio de 4 dígitos
        const pin = Math.floor(1000 + Math.random() * 9000).toString();

        if (p2pRoom) {
            p2pRoom.destroy();
        }

        p2pRoom = new window.PeerEngine.HostRoom(pin, selectedQuiz, {
            onRoomCreated: (data) => {
                handleHostMessage({
                    type: "ROOM_CREATED",
                    pin: data.pin,
                    quiz: data.quiz
                });
            },
            onPlayerJoined: (data) => {
                handleHostMessage({
                    type: "PLAYER_JOINED",
                    total: data.total,
                    players: data.players
                });
            },
            onPlayerLeft: (data) => {
                handleHostMessage({
                    type: "PLAYER_LEFT",
                    total: data.total,
                    players: data.players
                });
            },
            onBotsAdded: (data) => {
                handleHostMessage({
                    type: "BOTS_ADDED",
                    total: data.total,
                    players: data.players
                });
            },
            onAnswerCountUpdate: (data) => {
                handleHostMessage({
                    type: "ANSWER_COUNT_UPDATE",
                    answered: data.answered,
                    total: data.total
                });
            },
            onQuestionStart: (data) => {
                handleHostMessage(data);
            },
            onTimerTick: (seconds) => {
                timeRemaining = seconds;
                timerCircle.textContent = seconds;
                if (seconds <= 5 && seconds > 0) {
                    timerCircle.classList.add("danger");
                    window.kahootAudio.playTick();
                }
                if (seconds <= 0) {
                    timerCircle.textContent = "0";
                    window.kahootAudio.playTimesUp();
                }
            },
            onQuestionResults: (data) => {
                lastLeaderboard = data.leaderboard || [];
                renderResults({
                    correct: data.correct_choice,
                    distribution: data.stats,
                    total_answers: data.total_answered
                });
            },
            onPodium: (data) => {
                handleHostMessage({
                    type: "PODIUM",
                    podium: data.top3,
                    total_players: data.total_players
                });
            }
        });
    }

    // Connect WebSocket o cambiar automáticamente a P2P si estamos en Netlify
    function connectHostWs() {
        // Si estamos en Netlify (no localhost) y no hay backend explícito configurado, ir DIRECTO a P2P sin mostrar alertas
        if (!window.GAME_CONFIG.isLocalhost && !window.GAME_CONFIG.getSavedBackendUrl()) {
            startP2pHostRoom();
            return;
        }

        const wsUrl = window.GAME_CONFIG.getBackendWsUrl();
        console.log("Conectando Host WebSocket a:", wsUrl);

        try {
            ws = new WebSocket(wsUrl);
        } catch (e) {
            console.warn("Fallo al instanciar WebSocket. Cambiando a Modo P2P Netlify...");
            startP2pHostRoom();
            return;
        }

        const wsTimeout = setTimeout(() => {
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                console.log("WebSocket no respondió a tiempo. Activando Modo P2P Netlify automático...");
                try { ws.close(); } catch (e) {}
                startP2pHostRoom();
            }
        }, 1800);

        ws.onopen = () => {
            clearTimeout(wsTimeout);
            console.log("Host WebSocket conectado con éxito.");
            hideConnectionBanner();
            fetchQuizzesAndCreateRoom();
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleHostMessage(data);
        };

        ws.onerror = (err) => {
            clearTimeout(wsTimeout);
            console.warn("Host WebSocket error. Activando modo P2P Netlify...");
            startP2pHostRoom();
        };

        ws.onclose = () => {
            console.log("Host WebSocket desconectado.");
            if (!isP2pMode) {
                startP2pHostRoom();
            }
        };
    }

    async function fetchQuizzesAndCreateRoom() {
        try {
            const httpUrl = window.GAME_CONFIG.getBackendHttpUrl();
            const res = await fetch(`${httpUrl}/api/quizzes`);
            quizzesList = await res.json();
            renderQuizSelector();

            const urlParams = new URLSearchParams(window.location.search);
            const queryQuizId = urlParams.get("quiz");
            if (queryQuizId && quizzesList.some(q => q.id === queryQuizId)) {
                quizSelector.value = queryQuizId;
            }

            const selectedQuizId = quizSelector.value || (quizzesList[0] ? quizzesList[0].id : null);
            createRoom(selectedQuizId);
        } catch (err) {
            console.error("Error fetching quizzes:", err);
            createRoom(null);
        }
    }

    function renderQuizSelector() {
        quizSelector.innerHTML = "";
        quizzesList.forEach(q => {
            const opt = document.createElement("option");
            opt.value = q.id;
            opt.textContent = `${q.title} (${q.questions.length} preguntas)`;
            quizSelector.appendChild(opt);
        });
    }

    quizSelector.addEventListener("change", () => {
        if (confirm("¿Deseas reiniciar la sala con este cuestionario?")) {
            if (isP2pMode) {
                startP2pHostRoom();
            } else {
                createRoom(quizSelector.value);
            }
        }
    });

    function createRoom(quizId) {
        if (isP2pMode) {
            startP2pHostRoom();
            return;
        }
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: "HOST_CREATE_ROOM",
                quiz_id: quizId
            }));
        }
    }

    function handleHostMessage(data) {
        switch (data.type) {
            case "ROOM_CREATED":
                currentPin = data.pin;
                currentQuiz = data.quiz;
                localIp = data.local_ip || window.location.hostname;
                port = data.port || window.location.port || 8000;
                pinDisplay.textContent = currentPin;

                // QR Code link adaptable a Netlify o IP local
                const joinUrl = window.GAME_CONFIG.getJoinUrl(currentPin);
                joinUrlText.textContent = `${window.location.origin}/play`;
                qrCodeContainer.innerHTML = "";
                new QRCode(qrCodeContainer, {
                    text: joinUrl,
                    width: 190,
                    height: 190,
                    colorDark: "#003865",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });

                showView(lobbyView);
                window.kahootAudio.startLobbyMusic();
                break;

            case "PLAYER_JOINED":
                window.kahootAudio.playJoin();
                updateLobbyPlayers(data.total, data.players);
                break;

            case "PLAYER_LEFT":
                updateLobbyPlayers(data.total, data.players);
                break;

            case "BOTS_ADDED":
                updateLobbyPlayers(data.total, data.players);
                break;

            case "ANSWER_COUNT_UPDATE":
                answersCounterNumber.textContent = data.answered;
                answersCounterTotal.textContent = data.total;
                break;

            case "QUESTION_START":
                renderQuestion(data);
                break;

            case "QUESTION_RESULTS":
                renderResults(data);
                break;

            case "SHOW_LEADERBOARD":
                renderLeaderboard(data.leaderboard);
                break;

            case "PODIUM":
                renderPodium(data);
                break;
        }
    }

    function updateLobbyPlayers(total, players) {
        playersCountText.textContent = `${total} Jugadores`;
        startGameBtn.disabled = (total === 0);
        startGameBtn.style.opacity = total === 0 ? "0.5" : "1";

        playersGrid.innerHTML = "";
        players.forEach(p => {
            const chip = document.createElement("div");
            chip.className = "player-chip animate-pop";
            chip.innerHTML = `<span>${p.emoji || "👤"}</span> <span>${p.name}</span>`;
            chip.title = "Haz clic para expulsar";
            chip.addEventListener("click", () => {
                if (confirm(`¿Expulsar a "${p.name}"?`)) {
                    if (isP2pMode && p2pRoom) {
                        p2pRoom.kickPlayer(p.id);
                    } else if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: "HOST_KICK_PLAYER",
                            player_id: p.id
                        }));
                    }
                }
            });
            playersGrid.appendChild(chip);
        });
    }

    // Add Bots for high-load demonstration
    addBotsBtn.addEventListener("click", () => {
        if (isP2pMode && p2pRoom) {
            p2pRoom.addVirtualBots(200);
            return;
        }
        const count = prompt("¿Cuántos jugadores virtuales deseas añadir para la prueba de carga?", "200");
        if (count && parseInt(count) > 0) {
            ws.send(JSON.stringify({
                type: "HOST_ADD_BOTS",
                count: parseInt(count)
            }));
        }
    });

    startGameBtn.addEventListener("click", () => {
        window.kahootAudio.stopMusic();
        if (isP2pMode && p2pRoom) {
            p2pRoom.startNextQuestion();
        } else if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "HOST_START_GAME" }));
        }
    });

    function renderQuestion(data) {
        showView(questionView);
        const pointsLabel = (data.points !== undefined && data.points > 0) ? ` • 🌟 ${data.points.toLocaleString()} pts` : (data.points === 0 ? " • ⚪ Sin puntos" : "");
        questionStepBadge.textContent = `Pregunta ${data.q_index + 1} de ${data.total_q}${pointsLabel}`;
        questionTitle.textContent = data.question;

        // Emoji / Media
        mediaContainer.innerHTML = "";
        if (data.image) {
            const img = document.createElement("img");
            img.src = data.image;
            mediaContainer.appendChild(img);
        } else {
            mediaContainer.textContent = data.emoji || "🎯";
        }

        // Answer counters
        answersCounterNumber.textContent = "0";
        answersCounterTotal.textContent = data.total_players;

        // Hide post-question action buttons
        nextQuestionBtn.style.display = "none";
        showLeaderboardBtn.style.display = "none";

        // Render 4 Kahoot Shape Cards
        const shapes = ["▲", "◆", "●", "■"];
        const shapeClasses = ["card-red", "card-blue", "card-yellow", "card-green"];
        optionsGrid.innerHTML = "";

        data.options.forEach((optText, idx) => {
            const card = document.createElement("div");
            card.className = `option-card ${shapeClasses[idx % shapeClasses.length]} animate-pop`;
            card.id = `hostOpt_${idx}`;
            card.innerHTML = `
                <span class="option-icon">${shapes[idx % shapes.length]}</span>
                <span class="option-text">${optText}</span>
                <div class="distribution-overlay" id="distOverlay_${idx}"></div>
                <div class="distribution-badge" id="distBadge_${idx}">0</div>
            `;
            optionsGrid.appendChild(card);
        });

        // Timer
        timeRemaining = data.time;
        timerCircle.textContent = timeRemaining;
        timerCircle.classList.remove("danger");

        window.kahootAudio.startQuestionMusic(data.time);

        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timeRemaining--;
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                timerCircle.textContent = "0";
                window.kahootAudio.playTimesUp();
            } else {
                timerCircle.textContent = timeRemaining;
                if (timeRemaining <= 5) {
                    timerCircle.classList.add("danger");
                    window.kahootAudio.playTick();
                }
            }
        }, 1000);
    }

    function renderResults(data) {
        if (timerInterval) clearInterval(timerInterval);
        window.kahootAudio.stopMusic();
        window.kahootAudio.playTimesUp();

        // Reveal correct answer and animate distribution bars
        const totalAnswers = data.total_answers || 1;
        data.distribution.forEach((count, idx) => {
            const card = document.getElementById(`hostOpt_${idx}`);
            const overlay = document.getElementById(`distOverlay_${idx}`);
            const badge = document.getElementById(`distBadge_${idx}`);

            if (card) {
                if (idx === data.correct) {
                    card.classList.add("correct");
                } else {
                    card.classList.add("wrong-dimmed");
                }
            }

            if (overlay && badge) {
                const percent = Math.round((count / totalAnswers) * 100);
                overlay.style.width = `${percent}%`;
                badge.style.display = "block";
                badge.textContent = `${count} (${percent}%)`;
            }
        });

        // Show Next button
        showLeaderboardBtn.style.display = "inline-flex";
    }

    showLeaderboardBtn.addEventListener("click", () => {
        if (isP2pMode) {
            renderLeaderboard(lastLeaderboard);
        } else if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "HOST_SHOW_LEADERBOARD" }));
        }
    });

    nextQuestionBtn.addEventListener("click", () => {
        if (isP2pMode && p2pRoom) {
            p2pRoom.startNextQuestion();
        } else if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "HOST_NEXT_QUESTION" }));
        }
    });

    function renderLeaderboard(leaderboard) {
        showView(leaderboardView);
        const listContainer = document.getElementById("leaderboardList");
        listContainer.innerHTML = "";

        leaderboard.forEach((p, idx) => {
            const item = document.createElement("div");
            item.className = `leaderboard-item rank-${idx + 1} animate-pop`;
            item.innerHTML = `
                <div class="leaderboard-player-info">
                    <div class="leaderboard-rank">#${p.rank || (idx + 1)}</div>
                    <span style="font-size: 1.6rem;">${p.emoji || "👤"}</span>
                    <span>${p.name}</span>
                </div>
                <div class="leaderboard-score-group">
                    <span style="color: #ffd166;">+${p.last_delta || 0}</span>
                    <span>${p.score.toLocaleString()} pts</span>
                </div>
            `;
            listContainer.appendChild(item);
        });
    }

    document.getElementById("leaderboardNextBtn").addEventListener("click", () => {
        if (isP2pMode && p2pRoom) {
            p2pRoom.startNextQuestion();
        } else if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "HOST_NEXT_QUESTION" }));
        }
    });

    function renderPodium(data) {
        showView(podiumView);
        window.kahootAudio.playFanfare();

        // Confetti explosion!
        if (typeof confetti === "function") {
            const duration = 4.5 * 1000;
            const end = Date.now() + duration;
            (function frame() {
                confetti({
                    particleCount: 5,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 }
                });
                confetti({
                    particleCount: 5,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 }
                });
                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            }());
        }

        const p1 = data.podium.find(p => p.rank === 1) || { name: "-", emoji: "🏆", score: 0 };
        const p2 = data.podium.find(p => p.rank === 2) || { name: "-", emoji: "🥈", score: 0 };
        const p3 = data.podium.find(p => p.rank === 3) || { name: "-", emoji: "🥉", score: 0 };

        document.getElementById("p1Name").textContent = p1.name;
        document.getElementById("p1Avatar").textContent = p1.emoji;
        document.getElementById("p1Score").textContent = `${p1.score.toLocaleString()} pts`;

        document.getElementById("p2Name").textContent = p2.name;
        document.getElementById("p2Avatar").textContent = p2.emoji;
        document.getElementById("p2Score").textContent = `${p2.score.toLocaleString()} pts`;

        document.getElementById("p3Name").textContent = p3.name;
        document.getElementById("p3Avatar").textContent = p3.emoji;
        document.getElementById("p3Score").textContent = `${p3.score.toLocaleString()} pts`;
    }

    document.getElementById("playAgainBtn").addEventListener("click", () => {
        window.location.reload();
    });

    // Start WebSocket
    connectHostWs();
});
