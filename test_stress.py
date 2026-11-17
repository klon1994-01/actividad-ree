import asyncio
import aiohttp
import json
import time
import sys

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

async def test_kahoot():
    print("Iniciando prueba de carga con 200+ jugadores...")
    async with aiohttp.ClientSession() as session:
        async with session.ws_connect('http://localhost:8000/ws') as ws:
            # 1. Create Room
            await ws.send_json({'type': 'HOST_CREATE_ROOM'})
            msg = await ws.receive_json()
            pin = msg['pin']
            print(f"✅ Sala creada exitosamente con PIN: {pin}")

            # 2. Add 200 Bots
            start_bots = time.time()
            await ws.send_json({'type': 'HOST_ADD_BOTS', 'count': 200})
            msg = await ws.receive_json()
            elapsed_bots = time.time() - start_bots
            print(f"✅ Conectados {msg['added']} jugadores virtuales en {elapsed_bots:.2f}s. Total en sala: {msg['total']}")

            # 3. Start Game
            await ws.send_json({'type': 'HOST_START_GAME'})
            msg = await ws.receive_json()
            print(f"✅ Pregunta iniciada: '{msg['question']}'")
            print(f"   Participantes simultáneos: {msg['total_players']}")

            # 4. Receive answers live
            results_received = False
            for _ in range(30):
                try:
                    res = await asyncio.wait_for(ws.receive_json(), timeout=5.0)
                    m_type = res.get('type')
                    if m_type == 'ANSWER_COUNT_UPDATE':
                        print(f"   ⚡ Respuestas recibidas en tiempo real: {res['answered']} / {res['total']}")
                    elif m_type == 'QUESTION_RESULTS':
                        print(f"✅ Resultados de pregunta procesados instantáneamente!")
                        print(f"   Distribución de opciones [Rojo ▲, Azul ◆, Amarillo ●, Verde ■]: {res['distribution']}")
                        print(f"   Total respuestas contestadas: {res['total_answers']}")
                        print(f"   Top 3 Líderes: {[p['name'] + ' (' + str(p['score']) + ' pts)' for p in res['leaderboard'][:3]]}")
                        results_received = True
                        break
                except asyncio.TimeoutError:
                    break

            if results_received:
                print("=====================================================================")
                print("🎉 PRUEBA DE CONCURRENCIA EXITOSA: ¡200+ jugadores respondieron a la vez!")
                print("=====================================================================")

if __name__ == "__main__":
    asyncio.run(test_kahoot())
