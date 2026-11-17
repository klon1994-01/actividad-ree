import asyncio
import json
import logging
import os
import random
import socket
import time
import uuid
from aiohttp import web, WSMsgType

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("KahootClone")

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
DATA_DIR = os.path.join(BASE_DIR, "data")
QUIZZES_FILE = os.path.join(DATA_DIR, "quizzes.json")

# Emoji list for player avatars (incluyendo temática de salud y diversión)
AVATARS = ["🦁", "🐯", "🐼", "🦊", "🐸", "🩺", "💉", "🏥", "🧬", "💊", "🚀", "🔥", "⚡", "⭐", "🏆", "🐱", "🐶", "🐵", "🐧", "🦉"]

def get_local_ip():
    """Detect local LAN IP for seamless phone connection over Wi-Fi."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def load_quizzes():
    if not os.path.exists(QUIZZES_FILE):
        return []
    with open(QUIZZES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_quizzes(quizzes):
    with open(QUIZZES_FILE, "w", encoding="utf-8") as f:
        json.dump(quizzes, f, indent=2, ensure_ascii=False)
    static_data_file = os.path.join(STATIC_DIR, "data", "quizzes.json")
    try:
        os.makedirs(os.path.dirname(static_data_file), exist_ok=True)
        with open(static_data_file, "w", encoding="utf-8") as f:
            json.dump(quizzes, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.warning(f"No se pudo sincronizar static/data/quizzes.json: {e}")


class Room:
    def __init__(self, pin: str, host_ws, quiz: dict):
        self.pin = pin
        self.host_ws = host_ws
        self.quiz = quiz
        self.state = "LOBBY"  # LOBBY, QUESTION, RESULTS, LEADERBOARD, PODIUM, FINISHED
        self.current_q_index = -1
        self.question_start_time = 0.0
        self.question_duration = 20
        self.players = {}  # player_id: dict
        self.answers = {}  # player_id: dict(choice, time_taken, score_delta, is_correct)
        self.bot_tasks = []
        self._host_update_scheduled = False
        self._question_timer_task = None

    @property
    def total_players(self):
        return len(self.players)

    @property
    def answered_count(self):
        return len(self.answers)

    def get_public_player_list(self):
        return [
            {"id": p["id"], "name": p["name"], "emoji": p["emoji"]}
            for p in self.players.values()
        ]

    def get_leaderboard(self, top_n=5):
        # Sort by score descending
        sorted_players = sorted(self.players.values(), key=lambda p: p["score"], reverse=True)
        return [
            {
                "id": p["id"],
                "name": p["name"],
                "emoji": p["emoji"],
                "score": p["score"],
                "streak": p["streak"],
                "rank": idx + 1,
                "last_delta": self.answers.get(p["id"], {}).get("score_delta", 0)
            }
            for idx, p in enumerate(sorted_players[:top_n])
        ]

    def get_player_rank(self, player_id):
        sorted_players = sorted(self.players.values(), key=lambda p: p["score"], reverse=True)
        for idx, p in enumerate(sorted_players):
            if p["id"] == player_id:
                return idx + 1
        return len(sorted_players)

    async def broadcast_to_players(self, message: dict):
        """Send message to all human connected players concurrently."""
        payload = json.dumps(message)
        tasks = []
        for p in list(self.players.values()):
            if not p["is_bot"] and p["ws"] is not None and not p["ws"].closed:
                tasks.append(p["ws"].send_str(payload))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def send_to_host(self, message: dict):
        if self.host_ws and not self.host_ws.closed:
            await self.host_ws.send_json(message)

    def schedule_host_answer_update(self):
        """Throttle answer notifications to host so 200+ answers don't choke the socket."""
        if not self._host_update_scheduled:
            self._host_update_scheduled = True
            asyncio.create_task(self._delayed_host_answer_update())

    async def _delayed_host_answer_update(self):
        await asyncio.sleep(0.08)  # ~12 updates per second max
        self._host_update_scheduled = False
        await self.send_to_host({
            "type": "ANSWER_COUNT_UPDATE",
            "answered": self.answered_count,
            "total": self.total_players
        })

    def calculate_score(self, is_correct: bool, time_taken: float, total_time: float, max_points: int, current_streak: int):
        if not is_correct:
            return 0, 0
        # Exact points without multipliers or reductions
        return max_points, current_streak + 1

    async def record_answer(self, player_id: str, choice_index: int):
        if self.state != "QUESTION":
            return False
        if player_id in self.answers:
            return False  # Already answered
        player = self.players.get(player_id)
        if not player:
            return False

        q = self.quiz["questions"][self.current_q_index]
        now = time.time()
        time_taken = max(0.05, now - self.question_start_time)
        is_correct = (choice_index == q["correct"])
        score_delta, new_streak = self.calculate_score(
            is_correct=is_correct,
            time_taken=time_taken,
            total_time=self.question_duration,
            max_points=q.get("points", 1000),
            current_streak=player["streak"]
        )

        player["score"] += score_delta
        player["streak"] = new_streak if is_correct else 0
        self.answers[player_id] = {
            "choice": choice_index,
            "time_taken": time_taken,
            "score_delta": score_delta,
            "is_correct": is_correct
        }

        # Send individual feedback to player immediately
        if not player["is_bot"] and player["ws"] and not player["ws"].closed:
            await player["ws"].send_json({
                "type": "ANSWER_CONFIRMED",
                "is_correct": is_correct,
                "score_delta": score_delta,
                "total_score": player["score"],
                "streak": player["streak"]
            })

        # Throttle update to host
        self.schedule_host_answer_update()

        # If everyone has answered, trigger results early!
        if self.answered_count >= self.total_players and self.total_players > 0:
            if self._question_timer_task and not self._question_timer_task.done():
                self._question_timer_task.cancel()
            asyncio.create_task(self.finish_question())

        return True

    async def start_question(self, index: int):
        if index < 0 or index >= len(self.quiz["questions"]):
            await self.show_podium()
            return

        self.state = "QUESTION"
        self.current_q_index = index
        self.answers.clear()
        q = self.quiz["questions"][index]
        self.question_duration = q.get("time", 20)
        self.question_start_time = time.time()

        # Cancel any previous question timer
        if self._question_timer_task and not self._question_timer_task.done():
            self._question_timer_task.cancel()

        # Host receives full question + options + correct answer (for host internal logic)
        await self.send_to_host({
            "type": "QUESTION_START",
            "q_index": index,
            "total_q": len(self.quiz["questions"]),
            "question": q["question"],
            "emoji": q.get("emoji", "🎯"),
            "image": q.get("image", ""),
            "type_q": q.get("type", "multiple_choice"),
            "options": q["options"],
            "correct": q["correct"],
            "time": self.question_duration,
            "points": q.get("points", 1000),
            "total_players": self.total_players
        })

        # Players receive question payload (options colors/shapes/text)
        await self.broadcast_to_players({
            "type": "QUESTION_START",
            "q_index": index,
            "total_q": len(self.quiz["questions"]),
            "question": q["question"],
            "emoji": q.get("emoji", "🎯"),
            "type_q": q.get("type", "multiple_choice"),
            "options_count": len(q["options"]),
            "options": q["options"],
            "time": self.question_duration,
            "points": q.get("points", 1000)
        })

        # Launch simulated bot answers if there are bots
        self.trigger_bots_for_question(q)

        # Set timer for duration
        self._question_timer_task = asyncio.create_task(self._run_question_timer())

    async def _run_question_timer(self):
        try:
            await asyncio.sleep(self.question_duration)
            await self.finish_question()
        except asyncio.CancelledError:
            pass

    def trigger_bots_for_question(self, q: dict):
        bot_players = [p for p in self.players.values() if p["is_bot"]]
        if not bot_players:
            return

        correct_idx = q["correct"]
        num_options = len(q["options"])

        for bot in bot_players:
            # Staggered human-like delay between 1.0s and 85% of question duration
            delay = random.uniform(1.0, max(2.0, self.question_duration * 0.85))
            # 70% probability of choosing the correct answer
            if random.random() < 0.72:
                choice = correct_idx
            else:
                choice = random.randint(0, num_options - 1)

            async def _bot_answer(b_id=bot["id"], ch=choice, dl=delay):
                await asyncio.sleep(dl)
                if self.state == "QUESTION":
                    await self.record_answer(b_id, ch)

            task = asyncio.create_task(_bot_answer())
            self.bot_tasks.append(task)

    async def finish_question(self):
        if self.state != "QUESTION":
            return
        self.state = "RESULTS"

        q = self.quiz["questions"][self.current_q_index]
        correct_idx = q["correct"]

        # Aggregate answer distribution [opt0, opt1, opt2, opt3]
        distribution = [0] * len(q["options"])
        for ans in self.answers.values():
            c = ans["choice"]
            if 0 <= c < len(distribution):
                distribution[c] += 1

        leaderboard = self.get_leaderboard(top_n=5)

        # Send results to Host with distribution and top 5
        await self.send_to_host({
            "type": "QUESTION_RESULTS",
            "q_index": self.current_q_index,
            "correct": correct_idx,
            "distribution": distribution,
            "total_answers": self.answered_count,
            "total_players": self.total_players,
            "leaderboard": leaderboard
        })

        # Send personalized result feedback to every player
        for p in self.players.values():
            if not p["is_bot"] and p["ws"] and not p["ws"].closed:
                p_ans = self.answers.get(p["id"])
                p_rank = self.get_player_rank(p["id"])
                await p["ws"].send_json({
                    "type": "QUESTION_RESULTS",
                    "correct_index": correct_idx,
                    "did_answer": (p_ans is not None),
                    "is_correct": p_ans["is_correct"] if p_ans else False,
                    "score_delta": p_ans["score_delta"] if p_ans else 0,
                    "total_score": p["score"],
                    "streak": p["streak"],
                    "rank": p_rank,
                    "total_players": self.total_players
                })

    async def show_leaderboard(self):
        self.state = "LEADERBOARD"
        top10 = self.get_leaderboard(top_n=10)
        await self.send_to_host({
            "type": "SHOW_LEADERBOARD",
            "leaderboard": top10
        })
        await self.broadcast_to_players({
            "type": "SHOW_LEADERBOARD",
            "leaderboard": top10
        })

    async def show_podium(self):
        self.state = "PODIUM"
        sorted_players = sorted(self.players.values(), key=lambda p: p["score"], reverse=True)
        podium = [
            {
                "rank": idx + 1,
                "name": p["name"],
                "emoji": p["emoji"],
                "score": p["score"]
            }
            for idx, p in enumerate(sorted_players[:3])
        ]
        all_ranking = [
            {
                "rank": idx + 1,
                "name": p["name"],
                "emoji": p["emoji"],
                "score": p["score"]
            }
            for idx, p in enumerate(sorted_players)
        ]

        await self.send_to_host({
            "type": "PODIUM",
            "podium": podium,
            "total_players": self.total_players,
            "ranking": all_ranking
        })

        for p in self.players.values():
            if not p["is_bot"] and p["ws"] and not p["ws"].closed:
                rank = self.get_player_rank(p["id"])
                await p["ws"].send_json({
                    "type": "PODIUM",
                    "podium": podium,
                    "my_rank": rank,
                    "my_score": p["score"],
                    "total_players": self.total_players
                })

    def add_bots(self, count=200):
        """Instantly spawn simulated bots for massive stress-testing and live demo."""
        bot_names = [
            "Alex", "Sofia", "Mateo", "Valentina", "Lucas", "Isabella", "Benjamin", "Camila",
            "Diego", "Mia", "Sebastian", "Emma", "Daniel", "Martina", "Leo", "Lucia",
            "Julian", "Elena", "Gabriel", "Victoria", "Samuel", "Catalina", "Nicolas", "Paula",
            "David", "Clara", "Adrian", "Sara", "Angel", "Renata", "Thiago", "Julieta",
            "Alonso", "Antonella", "Max", "Alma", "Emiliano", "Abril", "Gael", "Zoe"
        ]
        created = 0
        for i in range(count):
            bot_id = f"bot_{uuid.uuid4().hex[:6]}"
            base_name = random.choice(bot_names)
            bot_name = f"{base_name} #{random.randint(10, 999)}"
            self.players[bot_id] = {
                "id": bot_id,
                "name": bot_name,
                "emoji": random.choice(AVATARS),
                "is_bot": True,
                "ws": None,
                "score": 0,
                "streak": 0
            }
            created += 1
        return created


# Global Active Rooms (PIN -> Room)
rooms = {}

async def generate_unique_pin():
    for _ in range(100):
        pin = str(random.randint(1000, 9999))
        if pin not in rooms:
            return pin
    return str(int(time.time()))[-4:]


# REST & Page Handlers
async def index_handler(request):
    return web.FileResponse(os.path.join(STATIC_DIR, "index.html"))

async def host_handler(request):
    return web.FileResponse(os.path.join(STATIC_DIR, "host.html"))

async def player_handler(request):
    return web.FileResponse(os.path.join(STATIC_DIR, "player.html"))

async def editor_handler(request):
    return web.FileResponse(os.path.join(STATIC_DIR, "editor.html"))

async def api_info(request):
    return web.json_response({
        "local_ip": get_local_ip(),
        "port": 8000,
        "active_rooms": len(rooms)
    })

async def api_get_quizzes(request):
    quizzes = load_quizzes()
    return web.json_response(quizzes)

async def api_save_quizzes(request):
    try:
        data = await request.json()
        save_quizzes(data)
        return web.json_response({"status": "ok", "count": len(data)})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=400)


# WebSocket Handler
async def websocket_handler(request):
    ws = web.WebSocketResponse(heartbeat=15.0, max_msg_size=4*1024*1024)
    await ws.prepare(request)

    current_role = None  # 'host' or 'player'
    current_pin = None
    current_player_id = None

    try:
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                try:
                    data = json.loads(msg.data)
                except Exception:
                    continue

                msg_type = data.get("type")

                # ==================== HOST ACTIONS ====================
                if msg_type == "HOST_CREATE_ROOM":
                    quiz_id = data.get("quiz_id")
                    quizzes = load_quizzes()
                    selected_quiz = next((q for q in quizzes if q["id"] == quiz_id), None)
                    if not selected_quiz and quizzes:
                        selected_quiz = quizzes[0]
                    if not selected_quiz:
                        selected_quiz = {
                            "id": "sample",
                            "title": "Quiz Rápido",
                            "questions": [
                                {
                                    "question": "¿Preparado para competir?",
                                    "emoji": "🚀",
                                    "time": 20,
                                    "type": "multiple_choice",
                                    "options": ["¡Sí!", "¡Claro que sí!", "¡Nací listo!", "¡Vamos!"],
                                    "correct": 0
                                }
                            ]
                        }

                    pin = await generate_unique_pin()
                    room = Room(pin=pin, host_ws=ws, quiz=selected_quiz)
                    rooms[pin] = room
                    current_role = "host"
                    current_pin = pin

                    await ws.send_json({
                        "type": "ROOM_CREATED",
                        "pin": pin,
                        "quiz": selected_quiz,
                        "local_ip": get_local_ip(),
                        "port": 8000
                    })
                    logger.info(f"Host created room PIN {pin} with quiz '{selected_quiz['title']}'")

                elif msg_type == "HOST_START_GAME":
                    if current_pin in rooms:
                        room = rooms[current_pin]
                        await room.start_question(0)

                elif msg_type == "HOST_NEXT_QUESTION":
                    if current_pin in rooms:
                        room = rooms[current_pin]
                        next_idx = room.current_q_index + 1
                        if next_idx < len(room.quiz["questions"]):
                            await room.start_question(next_idx)
                        else:
                            await room.show_podium()

                elif msg_type == "HOST_SHOW_LEADERBOARD":
                    if current_pin in rooms:
                        room = rooms[current_pin]
                        await room.show_leaderboard()

                elif msg_type == "HOST_SHOW_PODIUM":
                    if current_pin in rooms:
                        room = rooms[current_pin]
                        await room.show_podium()

                elif msg_type == "HOST_ADD_BOTS":
                    count = int(data.get("count", 200))
                    if current_pin in rooms:
                        room = rooms[current_pin]
                        added = room.add_bots(count)
                        await ws.send_json({
                            "type": "BOTS_ADDED",
                            "added": added,
                            "total": room.total_players,
                            "players": room.get_public_player_list()
                        })
                        logger.info(f"Added {added} simulated bots to room {current_pin}. Total: {room.total_players}")

                elif msg_type == "HOST_KICK_PLAYER":
                    p_id = data.get("player_id")
                    if current_pin in rooms:
                        room = rooms[current_pin]
                        if p_id in room.players:
                            p = room.players.pop(p_id)
                            if p["ws"] and not p["ws"].closed:
                                await p["ws"].send_json({"type": "KICKED"})
                                await p["ws"].close()
                            await room.send_to_host({
                                "type": "PLAYER_LEFT",
                                "player_id": p_id,
                                "total": room.total_players,
                                "players": room.get_public_player_list()
                            })

                # ==================== PLAYER ACTIONS ====================
                elif msg_type == "PLAYER_JOIN":
                    pin = str(data.get("pin", "")).strip()
                    name = str(data.get("name", "")).strip()[:20]
                    emoji = data.get("emoji") or random.choice(AVATARS)

                    if not pin or pin not in rooms:
                        await ws.send_json({"type": "JOIN_ERROR", "message": "PIN de juego inválido o no existe."})
                        continue

                    room = rooms[pin]
                    if room.state != "LOBBY":
                        await ws.send_json({"type": "JOIN_ERROR", "message": "El juego ya ha comenzado."})
                        continue

                    # Check duplicate name
                    existing_names = [p["name"].lower() for p in room.players.values()]
                    if name.lower() in existing_names:
                        name = f"{name} ({random.randint(1, 99)})"

                    player_id = f"p_{uuid.uuid4().hex[:8]}"
                    room.players[player_id] = {
                        "id": player_id,
                        "name": name,
                        "emoji": emoji,
                        "is_bot": False,
                        "ws": ws,
                        "score": 0,
                        "streak": 0
                    }

                    current_role = "player"
                    current_pin = pin
                    current_player_id = player_id

                    await ws.send_json({
                        "type": "JOIN_SUCCESS",
                        "player_id": player_id,
                        "name": name,
                        "emoji": emoji,
                        "quiz_title": room.quiz["title"]
                    })

                    # Notify host
                    await room.send_to_host({
                        "type": "PLAYER_JOINED",
                        "player": {"id": player_id, "name": name, "emoji": emoji},
                        "total": room.total_players,
                        "players": room.get_public_player_list()
                    })

                elif msg_type == "PLAYER_ANSWER":
                    choice_idx = int(data.get("choice", -1))
                    if current_pin in rooms and current_player_id:
                        room = rooms[current_pin]
                        await room.record_answer(current_player_id, choice_idx)

            elif msg.type == WSMsgType.ERROR:
                logger.error(f"WebSocket error: {ws.exception()}")

    finally:
        # Handle disconnects
        if current_role == "host" and current_pin in rooms:
            logger.info(f"Host disconnected for room {current_pin}")
            room = rooms.pop(current_pin, None)
            if room:
                for p in room.players.values():
                    if not p["is_bot"] and p["ws"] and not p["ws"].closed:
                        await p["ws"].send_json({"type": "ROOM_CLOSED", "message": "El anfitrión ha cerrado la sala."})
        elif current_role == "player" and current_pin in rooms and current_player_id:
            room = rooms[current_pin]
            if current_player_id in room.players:
                p = room.players[current_player_id]
                # If during lobby, remove player; if during game, keep score but set ws to None
                if room.state == "LOBBY":
                    del room.players[current_player_id]
                    await room.send_to_host({
                        "type": "PLAYER_LEFT",
                        "player_id": current_player_id,
                        "total": room.total_players,
                        "players": room.get_public_player_list()
                    })
                else:
                    p["ws"] = None

    return ws


@web.middleware
async def cors_and_cache_middleware(request, handler):
    if request.method == "OPTIONS":
        resp = web.Response(status=200)
    else:
        resp = await handler(request)
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS, PUT, DELETE"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp


def create_app():
    app = web.Application(middlewares=[cors_and_cache_middleware])
    # Routes
    app.router.add_route("OPTIONS", "/{tail:.*}", lambda r: web.Response(status=200))
    app.router.add_get("/", index_handler)
    app.router.add_get("/host", host_handler)
    app.router.add_get("/play", player_handler)
    app.router.add_get("/editor", editor_handler)
    app.router.add_get("/create", editor_handler)
    app.router.add_get("/ws", websocket_handler)
    app.router.add_get("/api/info", api_info)
    app.router.add_get("/api/quizzes", api_get_quizzes)
    app.router.add_post("/api/quizzes", api_save_quizzes)
    # Serve static assets
    app.router.add_static("/static/", STATIC_DIR, name="static")
    return app


if __name__ == "__main__":
    import sys
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    ip = get_local_ip()
    port = int(os.environ.get("PORT", 8000))
    print("=" * 65)
    print("  [+] SERVIDOR KAHOOT CLONE (SOPORTE 200+ CONCURRENTES)")
    print("=" * 65)
    print(f"  * En esta PC / Servidor: http://localhost:{port}")
    print(f"  * Desde Celulares / LAN:  http://{ip}:{port}")
    print("=" * 65)
    
    app = create_app()

    # Abrir navegador automaticamente solo si se ejecuta localmente en Windows
    if "PORT" not in os.environ and "RENDER" not in os.environ:
        async def on_startup(app):
            import webbrowser
            import threading
            def _open():
                time.sleep(0.6)
                webbrowser.open(f"http://localhost:{port}")
            threading.Thread(target=_open, daemon=True).start()

        app.on_startup.append(on_startup)

    web.run_app(app, host="0.0.0.0", port=port, reuse_address=True)
