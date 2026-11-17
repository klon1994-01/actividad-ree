// Player Client Controller (Mobile First)
// Compatible con ejecución Localhost (Python WebSocket) y 100% Netlify (PeerJS WebRTC P2P)

document.addEventListener("DOMContentLoaded", () => {
    let ws = null;
    let playerP2p = null;
    let isP2pMode = false;
    let playerId = null;
    let currentPin = null;
    let selectedAvatar = "🩺";
    let hasAnsweredCurrentQuestion = false;

    const avatars = ["🩺", "💉", "🏥", "🧬", "🦁", "🐼", "🦊", "⚡", "🔥", "🚀", "⭐", "🏆"];

    // Screens
    const joinScreen = document.getElementById("joinScreen");
    const waitingScreen = document.getElementById("waitingScreen");
    const gameScreen = document.getElementById("gameScreen");
    const answerSentScreen = document.getElementById("answerSentScreen");
    const resultScreen = document.getElementById("resultScreen");
    const finalScreen = document.getElementById("finalScreen");

    // Join Form Elements
    const pinInput = document.getElementById("pinInput");
    const nameInput = document.getElementById("nameInput");
    const avatarPreview = document.getElementById("avatarPreview");
    const joinSubmitBtn = document.getElementById("joinSubmitBtn");
    const joinErrorMsg = document.getElementById("joinErrorMsg");

    // Waiting Elements
    const waitingPlayerName = document.getElementById("waitingPlayerName");
    const waitingPlayerAvatar = document.getElementById("waitingPlayerAvatar");
    const waitingQuizTitle = document.getElementById("waitingQuizTitle");

    // Game Elements
    const playerQuestionNumber = document.getElementById("playerQuestionNumber");
    const playerScoreDisplay = document.getElementById("playerScoreDisplay");
    const answersPad = document.getElementById("answersPad");

    // Result Elements
    const resultIcon = document.getElementById("resultIcon");
    const resultTitle = document.getElementById("resultTitle");
    const pointsAwarded = document.getElementById("pointsAwarded");
    const resultStreak = document.getElementById("resultStreak");
    const resultRank = document.getElementById("resultRank");

    // Final Elements
    const finalRankText = document.getElementById("finalRankText");
    const finalScoreText = document.getElementById("finalScoreText");

    // Check URL parameters for PIN
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("pin")) {
        pinInput.value = urlParams.get("pin");
    }

    // Cycle Avatar on Click
    avatarPreview.addEventListener("click", () => {
        const nextIdx = (avatars.indexOf(selectedAvatar) + 1) % avatars.length;
        selectedAvatar = avatars[nextIdx];
        avatarPreview.textContent = selectedAvatar;
        window.kahootAudio.playClick();
    });

    function showScreen(screen) {
        joinScreen.style.display = "none";
        waitingScreen.style.display = "none";
        gameScreen.style.display = "none";
        answerSentScreen.style.display = "none";
        resultScreen.style.display = "none";
        finalScreen.style.display = "none";
        screen.style.display = "flex";
    }

    const playerServerConfigLink = document.getElementById("playerServerConfigLink");
    if (playerServerConfigLink) {
        playerServerConfigLink.addEventListener("click", () => {
            const current = window.GAME_CONFIG.getSavedBackendUrl() || (window.GAME_CONFIG.isLocalhost ? "http://localhost:8000" : window.location.origin);
            const input = prompt("URL del servidor backend (deja vacío para modo automático):", current);
            if (input !== null) {
                window.GAME_CONFIG.setBackendUrl(input);
                alert("Servidor configurado en: " + (window.GAME_CONFIG.getBackendHttpUrl() || "Modo P2P Netlify"));
            }
        });
    }

    function showError(msg) {
        joinErrorMsg.textContent = msg;
        joinSubmitBtn.disabled = false;
        joinSubmitBtn.textContent = "¡Entrar!";
    }

    // Conexión P2P WebRTC (Netlify Directo sin servidor)
    function joinP2p(pin, name, emoji) {
        isP2pMode = true;
        console.log("Conectando Jugador en Modo P2P Netlify al PIN:", pin);

        if (playerP2p) {
            playerP2p.destroy();
        }

        playerP2p = new window.PeerEngine.PlayerClient(pin, name, emoji, {
            onJoinSuccess: (data) => {
                handlePlayerMessage(data);
            },
            onQuestionStart: (data) => {
                handlePlayerMessage(data);
            },
            onAnswerConfirmed: (data) => {
                handlePlayerMessage(data);
            },
            onQuestionResults: (data) => {
                handlePlayerMessage(data);
            },
            onPodium: (data) => {
                handlePlayerMessage(data);
            },
            onError: (msg) => {
                showError(msg);
            },
            onClose: () => {
                alert("La conexión con el anfitrión se ha cerrado.");
                window.location.href = "/";
            }
        });
    }

    // Conexión WebSocket (Localhost o backend dedicado)
    function connectWs(callback, errorCallback) {
        const wsUrl = window.GAME_CONFIG.getBackendWsUrl();
        console.log("Conectando Jugador WebSocket a:", wsUrl);

        try {
            ws = new WebSocket(wsUrl);
        } catch (err) {
            console.warn("Error al instanciar WebSocket:", err);
            if (errorCallback) errorCallback();
            else showError("No se pudo iniciar la conexión con el servidor.");
            return;
        }

        ws.onopen = () => {
            console.log("Player WebSocket conectado.");
            if (callback) callback();
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handlePlayerMessage(data);
        };

        ws.onerror = (err) => {
            console.warn("Player WebSocket error:", err);
            if (errorCallback) errorCallback();
            else showError("No se pudo conectar al servidor de juego.");
        };

        ws.onclose = () => {
            console.log("Player WebSocket cerrado.");
        };
    }

    joinSubmitBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const pin = pinInput.value.trim();
        const name = nameInput.value.trim();

        if (!pin || pin.length !== 4) {
            showError("Por favor ingresa un PIN válido de 4 dígitos.");
            return;
        }
        if (!name) {
            showError("Por favor escribe tu apodo.");
            return;
        }

        joinErrorMsg.textContent = "";
        joinSubmitBtn.disabled = true;
        joinSubmitBtn.textContent = "Conectando...";
        currentPin = pin;

        // Si estamos en Netlify sin backend explícito, conectar DIRECTO por P2P
        if (!window.GAME_CONFIG.isLocalhost && !window.GAME_CONFIG.getSavedBackendUrl()) {
            joinP2p(pin, name, selectedAvatar);
            return;
        }

        // Si estamos en localhost, probar WebSocket con fallback inteligente a P2P
        let wsSuccess = false;
        const fallbackTimer = setTimeout(() => {
            if (!wsSuccess) {
                console.log("WebSocket no respondió a tiempo. Cambiando a Modo P2P...");
                if (ws) {
                    try { ws.close(); } catch (err) {}
                }
                joinP2p(pin, name, selectedAvatar);
            }
        }, 1500);

        connectWs(() => {
            wsSuccess = true;
            clearTimeout(fallbackTimer);
            ws.send(JSON.stringify({
                type: "PLAYER_JOIN",
                pin: pin,
                name: name,
                emoji: selectedAvatar
            }));
        }, () => {
            clearTimeout(fallbackTimer);
            joinP2p(pin, name, selectedAvatar);
        });
    });

    function handlePlayerMessage(data) {
        switch (data.type) {
            case "JOIN_SUCCESS":
                playerId = data.player_id;
                waitingPlayerName.textContent = data.name;
                waitingPlayerAvatar.textContent = data.emoji;
                waitingQuizTitle.textContent = data.quiz_title || "Actividad REE";
                showScreen(waitingScreen);
                window.kahootAudio.playJoin();
                break;

            case "JOIN_ERROR":
                showError(data.message || "Error al unirse al juego.");
                break;

            case "KICKED":
                alert("Has sido expulsado de la partida por el anfitrión.");
                window.location.href = "/";
                break;

            case "ROOM_CLOSED":
                alert("El anfitrión ha finalizado la partida.");
                window.location.href = "/";
                break;

            case "QUESTION_START":
                hasAnsweredCurrentQuestion = false;
                showQuestionScreen(data);
                break;

            case "ANSWER_CONFIRMED":
                // Confirmación recibida
                break;

            case "QUESTION_RESULTS":
                showResultScreen(data);
                break;

            case "PODIUM":
                showFinalScreen(data);
                break;
        }
    }

    function showQuestionScreen(data) {
        showScreen(gameScreen);
        const pointsBadge = (data.points !== undefined && data.points > 0) ? ` • 🌟 ${data.points.toLocaleString()} pts` : "";
        playerQuestionNumber.textContent = `${data.q_index + 1}/${data.total_q}${pointsBadge}`;

        answersPad.innerHTML = "";
        const shapes = ["▲", "◆", "●", "■"];
        const colorClasses = ["pad-red", "pad-blue", "pad-yellow", "pad-green"];

        if (data.options_count === 2) {
            answersPad.classList.add("two-options");
        } else {
            answersPad.classList.remove("two-options");
        }

        const count = data.options_count || (data.options ? data.options.length : 4);
        for (let i = 0; i < count; i++) {
            const btn = document.createElement("button");
            btn.className = `pad-button ${colorClasses[i % colorClasses.length]}`;
            btn.innerHTML = `
                <span class="pad-shape">${shapes[i % shapes.length]}</span>
                ${data.options && data.options[i] ? `<span class="pad-text">${data.options[i]}</span>` : ""}
            `;

            btn.addEventListener("click", () => {
                if (hasAnsweredCurrentQuestion) return;
                hasAnsweredCurrentQuestion = true;

                // Audio click y vibración táctil
                window.kahootAudio.playClick();
                if (navigator.vibrate) {
                    try { navigator.vibrate(40); } catch (e) {}
                }

                // Enviar respuesta por P2P o WebSocket
                if (isP2pMode && playerP2p) {
                    playerP2p.sendAnswer(i);
                } else if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: "PLAYER_ANSWER",
                        choice: i
                    }));
                }

                // Cambiar a pantalla de confirmación
                showScreen(answerSentScreen);
            });

            answersPad.appendChild(btn);
        }
    }

    function showResultScreen(data) {
        showScreen(resultScreen);
        resultScreen.className = `result-screen ${data.is_correct ? "correct" : "incorrect"}`;

        const scoreDelta = data.score_delta !== undefined ? data.score_delta : (data.points_earned !== undefined ? data.points_earned : 0);

        if (data.is_correct) {
            window.kahootAudio.playCorrect();
            resultIcon.textContent = "🎉";
            resultTitle.textContent = "¡Correcto!";
            pointsAwarded.textContent = `+${scoreDelta} pts`;
            pointsAwarded.style.display = "block";
        } else {
            window.kahootAudio.playIncorrect();
            resultIcon.textContent = "😢";
            resultTitle.textContent = data.did_answer ? "¡Incorrecto!" : "¡Se acabó el tiempo!";
            pointsAwarded.style.display = "none";
        }

        const currentScore = data.total_score !== undefined ? data.total_score : 0;
        playerScoreDisplay.textContent = `${currentScore.toLocaleString()} pts`;
        resultStreak.textContent = data.streak && data.streak > 1 ? `🔥 Racha x${data.streak}` : "";
        resultRank.textContent = `Puesto #${data.rank || 1} de ${data.total_players || 1}`;
    }

    function showFinalScreen(data) {
        showScreen(finalScreen);
        window.kahootAudio.playFanfare();

        const myRank = data.my_rank !== undefined ? data.my_rank : (data.rank || 1);
        const myScore = data.my_score !== undefined ? data.my_score : (data.score || 0);
        const total = data.total_players || 1;

        // Lluvia de confeti si está en el podio (Top 3)
        if (myRank <= 3 && typeof confetti === "function") {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        }

        finalRankText.textContent = `Puesto #${myRank} de ${total}`;
        finalScoreText.textContent = `${myScore.toLocaleString()} Puntos`;
    }
});
