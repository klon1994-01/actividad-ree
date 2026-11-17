// Kahoot Quiz Creator & Question Editor Logic

document.addEventListener("DOMContentLoaded", () => {
    let allQuizzes = [];
    let currentQuizIndex = 0;
    let activeQuestionIndex = 0;

    // DOM Elements - Header
    const quizTitleInput = document.getElementById("quizTitleInput");
    const quizSelectorDropdown = document.getElementById("quizSelectorDropdown");
    const newQuizBtn = document.getElementById("newQuizBtn");
    const saveQuizBtn = document.getElementById("saveQuizBtn");
    const playQuizBtn = document.getElementById("playQuizBtn");

    // DOM Elements - Slides Sidebar
    const slidesList = document.getElementById("slidesList");
    const addSlideBtn = document.getElementById("addSlideBtn");

    // DOM Elements - Canvas
    const questionMainInput = document.getElementById("questionMainInput");
    const canvasMediaStage = document.getElementById("canvasMediaStage");
    const stageEmojiDisplay = document.getElementById("stageEmojiDisplay");
    const editorAnswersGrid = document.getElementById("editorAnswersGrid");

    // DOM Elements - Settings
    const settingQuestionType = document.getElementById("settingQuestionType");
    const settingTimeLimit = document.getElementById("settingTimeLimit");
    const settingPoints = document.getElementById("settingPoints");
    const customPointsInput = document.getElementById("customPointsInput");
    const applyAllBtn = document.getElementById("applyAllBtn");
    const emojiPickerGrid = document.getElementById("emojiPickerGrid");

    // Toast
    const toastNotice = document.getElementById("toastNotice");

    // Default Emojis
    const emojiPalette = ["🧠", "🪐", "🌍", "🚀", "💻", "🎮", "⚡", "🔥", "🎨", "🏆", "🐱", "🐙", "🍕", "🌮", "🎸", "📚", "🔬", "⚽", "⭐", "🎉"];

    // Initialize
    initEmojiPicker();
    loadQuizzesFromServer();

    function initEmojiPicker() {
        emojiPickerGrid.innerHTML = "";
        emojiPalette.forEach(em => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "emoji-option-btn";
            btn.textContent = em;
            btn.addEventListener("click", () => {
                const currentQ = getCurrentQuestion();
                if (currentQ) {
                    currentQ.emoji = em;
                    stageEmojiDisplay.textContent = em;
                    updateEmojiSelection(em);
                    renderSlidesList();
                }
            });
            emojiPickerGrid.appendChild(btn);
        });
    }

    function updateEmojiSelection(activeEmoji) {
        document.querySelectorAll(".emoji-option-btn").forEach(b => {
            b.classList.toggle("selected", b.textContent === activeEmoji);
        });
    }

    async function loadQuizzesFromServer() {
        const httpUrl = window.GAME_CONFIG.getBackendHttpUrl();
        try {
            // Intentar cargar desde backend o fallback estático en Netlify
            let res = await fetch(`${httpUrl}/api/quizzes`);
            if (!res.ok) {
                res = await fetch("/data/quizzes.json");
            }
            allQuizzes = await res.json();
            if (!allQuizzes || allQuizzes.length === 0) {
                createNewQuiz();
            } else {
                renderQuizDropdown();
                selectQuiz(0);
            }
        } catch (err) {
            console.warn("Error cargando cuestionarios desde API, intentando respaldo local:", err);
            const backup = localStorage.getItem("dveeeyr_quizzes_backup");
            if (backup) {
                try {
                    allQuizzes = JSON.parse(backup);
                    renderQuizDropdown();
                    selectQuiz(0);
                    return;
                } catch (e) {}
            }
            createNewQuiz();
        }
    }

    function renderQuizDropdown() {
        quizSelectorDropdown.innerHTML = "";
        allQuizzes.forEach((q, idx) => {
            const opt = document.createElement("option");
            opt.value = idx;
            opt.textContent = `${q.title} (${q.questions.length} preguntas)`;
            quizSelectorDropdown.appendChild(opt);
        });
        quizSelectorDropdown.value = currentQuizIndex;
    }

    quizSelectorDropdown.addEventListener("change", (e) => {
        saveCurrentInputToState();
        selectQuiz(parseInt(e.target.value));
    });

    function selectQuiz(index) {
        currentQuizIndex = index;
        activeQuestionIndex = 0;
        const quiz = allQuizzes[currentQuizIndex];
        quizTitleInput.value = quiz.title;
        renderSlidesList();
        loadQuestionToCanvas(activeQuestionIndex);
    }

    function getCurrentQuiz() {
        return allQuizzes[currentQuizIndex];
    }

    function getCurrentQuestion() {
        const quiz = getCurrentQuiz();
        if (quiz && quiz.questions && quiz.questions[activeQuestionIndex]) {
            return quiz.questions[activeQuestionIndex];
        }
        return null;
    }

    function createNewQuiz() {
        const newQuiz = {
            id: "quiz_" + Date.now().toString(36),
            title: "🧠 Nuevo Cuestionario Dinámico",
            description: "Cuestionario creado con el editor de Kahoot Clone",
            questions: [
                {
                    question: "¿Cuál es tu primera pregunta?",
                    emoji: "🚀",
                    time: 20,
                    points: 1000,
                    type: "multiple_choice",
                    options: [
                        "Primera Opción (Rojo)",
                        "Segunda Opción (Azul)",
                        "Tercera Opción (Amarillo)",
                        "Cuarta Opción (Verde)"
                    ],
                    correct: 0
                }
            ]
        };
        allQuizzes.push(newQuiz);
        renderQuizDropdown();
        selectQuiz(allQuizzes.length - 1);
        showToast("✨ Nuevo cuestionario creado");
    }

    newQuizBtn.addEventListener("click", () => {
        saveCurrentInputToState();
        createNewQuiz();
    });

    quizTitleInput.addEventListener("input", (e) => {
        const quiz = getCurrentQuiz();
        if (quiz) {
            quiz.title = e.target.value;
            renderQuizDropdown();
        }
    });

    function renderSlidesList() {
        const quiz = getCurrentQuiz();
        slidesList.innerHTML = "";

        quiz.questions.forEach((q, idx) => {
            const item = document.createElement("div");
            item.className = `slide-item ${idx === activeQuestionIndex ? "active" : ""}`;

            item.innerHTML = `
                <div class="slide-top-meta">
                    <span>#${idx + 1} ${q.type === "true_false" ? "V/F" : "Quiz"}</span>
                    <span>⏱ ${q.time}s • 🌟 ${(q.points !== undefined ? q.points : 1000).toLocaleString()} pts</span>
                </div>
                <div class="slide-preview-text">${q.question || "(Pregunta sin título)"}</div>
                <div class="slide-thumbnail-grid">
                    <div class="mini-box red"></div>
                    <div class="mini-box blue"></div>
                    ${q.type === "multiple_choice" ? '<div class="mini-box yellow"></div><div class="mini-box green"></div>' : ''}
                </div>
                <div class="slide-actions-row">
                    <button type="button" class="btn-slide-action btn-slide-dup" title="Duplicar">📋</button>
                    <button type="button" class="btn-slide-action btn-slide-delete" title="Eliminar">🗑️</button>
                </div>
            `;

            // Click slide to switch
            item.addEventListener("click", (e) => {
                if (e.target.closest(".btn-slide-action")) return;
                saveCurrentInputToState();
                activeQuestionIndex = idx;
                renderSlidesList();
                loadQuestionToCanvas(idx);
            });

            // Duplicate button
            item.querySelector(".btn-slide-dup").addEventListener("click", (e) => {
                e.stopPropagation();
                saveCurrentInputToState();
                const copy = JSON.parse(JSON.stringify(quiz.questions[idx]));
                copy.question = `${copy.question} (Copia)`;
                quiz.questions.splice(idx + 1, 0, copy);
                activeQuestionIndex = idx + 1;
                renderSlidesList();
                loadQuestionToCanvas(activeQuestionIndex);
                showToast("📋 Pregunta duplicada");
            });

            // Delete button
            item.querySelector(".btn-slide-delete").addEventListener("click", (e) => {
                e.stopPropagation();
                if (quiz.questions.length <= 1) {
                    alert("El cuestionario debe tener al menos una pregunta.");
                    return;
                }
                if (confirm(`¿Eliminar la pregunta #${idx + 1}?`)) {
                    quiz.questions.splice(idx, 1);
                    if (activeQuestionIndex >= quiz.questions.length) {
                        activeQuestionIndex = quiz.questions.length - 1;
                    }
                    renderSlidesList();
                    loadQuestionToCanvas(activeQuestionIndex);
                    showToast("🗑️ Pregunta eliminada");
                }
            });

            slidesList.appendChild(item);
        });
    }

    // Add new slide
    addSlideBtn.addEventListener("click", () => {
        saveCurrentInputToState();
        const quiz = getCurrentQuiz();
        const newQ = {
            question: "¿Escribe tu nueva pregunta?",
            emoji: emojiPalette[Math.floor(Math.random() * emojiPalette.length)],
            time: 20,
            points: 1000,
            type: "multiple_choice",
            options: [
                "Opción 1",
                "Opción 2",
                "Opción 3",
                "Opción 4"
            ],
            correct: 0
        };
        quiz.questions.push(newQ);
        activeQuestionIndex = quiz.questions.length - 1;
        renderSlidesList();
        loadQuestionToCanvas(activeQuestionIndex);
        showToast("➕ Nueva pregunta añadida");
        questionMainInput.focus();
    });

    function loadQuestionToCanvas(idx) {
        const q = getCurrentQuestion();
        if (!q) return;

        questionMainInput.value = q.question;
        stageEmojiDisplay.textContent = q.emoji || "🎯";
        updateEmojiSelection(q.emoji);

        settingQuestionType.value = q.type || "multiple_choice";
        settingTimeLimit.value = q.time || 20;

        const standardPts = ["0", "10", "20", "50", "100", "250", "500", "1000", "2000", "5000"];
        const currentPts = (q.points !== undefined ? q.points : 10).toString();
        if (standardPts.includes(currentPts)) {
            settingPoints.value = currentPts;
            customPointsInput.style.display = "none";
        } else {
            settingPoints.value = "custom";
            customPointsInput.style.display = "block";
            customPointsInput.value = currentPts;
        }

        updateConfigPreview();
        renderAnswerCards(q);
    }

    function renderAnswerCards(q) {
        editorAnswersGrid.innerHTML = "";
        const shapes = ["▲", "◆", "●", "■"];
        const colorClasses = ["card-red", "card-blue", "card-yellow", "card-green"];

        const isTF = (q.type === "true_false");
        editorAnswersGrid.className = `editor-answers-grid ${isTF ? "two-options" : ""}`;

        const count = isTF ? 2 : 4;

        for (let i = 0; i < count; i++) {
            const card = document.createElement("div");
            const isCorrect = (q.correct === i);
            card.className = `editor-answer-card ${colorClasses[i]} ${isCorrect ? "active-correct" : ""}`;
            card.id = `editorCard_${i}`;

            let optValue = (q.options && q.options[i] !== undefined) ? q.options[i] : (isTF ? (i === 0 ? "Verdadero" : "Falso") : `Opción ${i + 1}`);

            card.innerHTML = `
                <span class="editor-shape-badge">${shapes[i]}</span>
                <input type="text" class="editor-answer-input" id="answerInput_${i}" value="${optValue}" placeholder="Escribe la respuesta ${i + 1}..." autocomplete="off">
                <button type="button" class="correct-toggle-btn ${isCorrect ? "selected" : ""}" id="toggleCorrect_${i}" title="Marcar como respuesta correcta">
                    ✓
                </button>
            `;

            // Input change updates memory
            const input = card.querySelector(`#answerInput_${i}`);
            input.addEventListener("input", (e) => {
                if (!q.options) q.options = [];
                q.options[i] = e.target.value;
            });

            // Toggle correct answer
            const toggleBtn = card.querySelector(`#toggleCorrect_${i}`);
            toggleBtn.addEventListener("click", () => {
                q.correct = i;
                renderAnswerCards(q);
                showToast(`✓ Respuesta correcta marcada: Opción ${i + 1}`);
            });

            editorAnswersGrid.appendChild(card);
        }
    }

    // Save inputs from canvas to object
    function saveCurrentInputToState() {
        const q = getCurrentQuestion();
        if (!q) return;

        q.question = questionMainInput.value.trim() || "¿Pregunta sin título?";
        q.type = settingQuestionType.value;
        q.time = parseInt(settingTimeLimit.value);
        if (settingPoints.value === "custom") {
            q.points = Math.max(0, parseInt(customPointsInput.value) || 1000);
        } else {
            q.points = parseInt(settingPoints.value);
        }

        const count = (q.type === "true_false") ? 2 : 4;
        q.options = [];
        for (let i = 0; i < count; i++) {
            const input = document.getElementById(`answerInput_${i}`);
            if (input) {
                q.options.push(input.value.trim() || `Opción ${i + 1}`);
            } else if (q.type === "true_false") {
                q.options.push(i === 0 ? "Verdadero" : "Falso");
            }
        }
        if (q.correct >= count) {
            q.correct = 0;
        }
    }

    questionMainInput.addEventListener("input", () => {
        const q = getCurrentQuestion();
        if (q) {
            q.question = questionMainInput.value;
            const activeSlideText = document.querySelector(`.slide-item.active .slide-preview-text`);
            if (activeSlideText) {
                activeSlideText.textContent = q.question || "(Pregunta sin título)";
            }
        }
    });

    // Setting changes
    settingQuestionType.addEventListener("change", (e) => {
        const q = getCurrentQuestion();
        if (!q) return;
        q.type = e.target.value;
        if (q.type === "true_false") {
            q.options = ["Verdadero", "Falso"];
            if (q.correct > 1) q.correct = 0;
        } else {
            if (!q.options || q.options.length < 4) {
                q.options = ["Opción 1", "Opción 2", "Opción 3", "Opción 4"];
            }
        }
        renderSlidesList();
        renderAnswerCards(q);
    });

    settingTimeLimit.addEventListener("change", (e) => {
        const q = getCurrentQuestion();
        if (q) {
            q.time = parseInt(e.target.value);
            renderSlidesList();
        }
    });

    settingPoints.addEventListener("change", (e) => {
        const q = getCurrentQuestion();
        if (!q) return;
        if (e.target.value === "custom") {
            customPointsInput.style.display = "block";
            customPointsInput.value = q.points || 1000;
            customPointsInput.focus();
        } else {
            customPointsInput.style.display = "none";
            q.points = parseInt(e.target.value);
        }
        renderSlidesList();
    });

    customPointsInput.addEventListener("input", (e) => {
        const q = getCurrentQuestion();
        if (q) {
            q.points = Math.max(0, parseInt(e.target.value) || 0);
            renderSlidesList();
        }
    });

    // Live preview of time and points in the Apply All card
    function updateConfigPreview() {
        const previewTime = document.getElementById("previewTime");
        const previewPoints = document.getElementById("previewPoints");
        if (previewTime && settingTimeLimit) {
            previewTime.textContent = `${settingTimeLimit.value}s`;
        }
        if (previewPoints && settingPoints) {
            let pts = (settingPoints.value === "custom") 
                ? (parseInt(customPointsInput.value) || 0) 
                : parseInt(settingPoints.value);
            previewPoints.textContent = `${pts.toLocaleString()} pts`;
        }
    }

    settingTimeLimit.addEventListener("change", updateConfigPreview);
    settingPoints.addEventListener("change", updateConfigPreview);
    customPointsInput.addEventListener("input", updateConfigPreview);

    // Apply current question's time and points to ALL questions in the quiz and save immediately
    applyAllBtn.addEventListener("click", async () => {
        saveCurrentInputToState();
        const quiz = getCurrentQuiz();
        if (!quiz || !quiz.questions || quiz.questions.length === 0) return;

        const timeToApply = parseInt(settingTimeLimit.value) || 20;
        let pointsToApply;
        if (settingPoints.value === "custom") {
            pointsToApply = Math.max(0, parseInt(customPointsInput.value) || 0);
        } else {
            pointsToApply = parseInt(settingPoints.value);
            if (isNaN(pointsToApply)) pointsToApply = 1000;
        }

        // Apply to EVERY question
        quiz.questions.forEach((q) => {
            q.time = timeToApply;
            q.points = pointsToApply;
        });

        // Update left sidebar and canvas
        renderSlidesList();
        loadQuestionToCanvas(activeQuestionIndex);
        updateConfigPreview();

        // Visual feedback on button
        applyAllBtn.disabled = true;
        const originalText = applyAllBtn.innerHTML;
        applyAllBtn.innerHTML = "⏳ Guardando en todas...";

        // AUTO-SAVE to server disk immediately so quizzes.json is updated on disk
        await saveQuizzesToServer(true);

        applyAllBtn.disabled = false;
        applyAllBtn.innerHTML = "✓ ¡Aplicado a Todo!";
        applyAllBtn.style.background = "#06d6a0";

        showToast(`⚡ ¡Configuración (${timeToApply}s, ${pointsToApply.toLocaleString()} pts) aplicada y guardada en las ${quiz.questions.length} preguntas!`);

        setTimeout(() => {
            applyAllBtn.innerHTML = originalText;
            applyAllBtn.style.background = "";
        }, 2500);
    });

    // Save All Quizzes to Server
    async function saveQuizzesToServer(silent = false) {
        saveCurrentInputToState();
        saveQuizBtn.disabled = true;
        saveQuizBtn.textContent = "Guardando...";

        const httpUrl = window.GAME_CONFIG.getBackendHttpUrl();

        try {
            const res = await fetch(`${httpUrl}/api/quizzes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(allQuizzes)
            });
            const data = await res.json();
            if (data.status === "ok") {
                localStorage.setItem("dveeeyr_quizzes_backup", JSON.stringify(allQuizzes));
                if (!silent) {
                    showToast("💾 ¡Cuestionario guardado con éxito!");
                }
            } else {
                alert("Error al guardar: " + data.message);
            }
        } catch (err) {
            console.warn("No se pudo conectar con el backend remoto. Guardando en almacenamiento local del navegador:", err);
            localStorage.setItem("dveeeyr_quizzes_backup", JSON.stringify(allQuizzes));
            if (!silent) {
                showToast("💾 Guardado localmente en tu navegador.");
            }
        } finally {
            saveQuizBtn.disabled = false;
            saveQuizBtn.innerHTML = "💾 Guardar";
        }
    }

    saveQuizBtn.addEventListener("click", () => saveQuizzesToServer(false));

    // Play quiz directly
    playQuizBtn.addEventListener("click", async () => {
        await saveQuizzesToServer(true);
        const quiz = getCurrentQuiz();
        window.location.href = `/host?quiz=${quiz.id}`;
    });

    function showToast(msg) {
        toastNotice.textContent = msg;
        toastNotice.classList.add("show");
        setTimeout(() => {
            toastNotice.classList.remove("show");
        }, 2800);
    }
});
