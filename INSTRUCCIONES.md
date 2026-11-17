# 🏥 Secretaría de Salud de Guanajuato - Evaluación Interactiva REE (Multijugador +200)

Plataforma oficial de capacitación y evaluación interactiva con la identidad institucional de la **Secretaría de Salud de Guanajuato (SSG)** y el **Gobierno del Estado de Guanajuato**, diseñada para sesiones masivas de la Red Estatal de Epidemiología (**Actividad REE**) con soporte en tiempo real para **más de 200 participantes simultáneos**.

---

## 🎮 Características Principales

1. **Capacidad Masiva (+200 jugadores en vivo)**:
   - Motor asíncrono basado en WebSockets con latencia inferior a 10 milisegundos.
   - Maneja cientos de conexiones y respuestas concurrentes sin saturar el navegador ni el servidor.

2. **Diseño Idéntico a Kahoot**:
   - Las 4 opciones clásicas con sus figuras geométricas y colores icónicos:
     - 🟥 **Rojo (Triángulo ▲)**
     - 🟦 **Azul (Rombo / Diamante ◆)**
     - 🟨 **Amarillo (Círculo ●)**
     - 🟩 **Verde (Cuadrado ■)**
   - Soporte para preguntas de opción múltiple (4 opciones) y preguntas de **Verdadero / Falso** (2 opciones).

3. **Música y Efectos de Sonido Integrados**:
   - Música funk de lobby (estilo Kahoot).
   - Sonido de tensión acelerada durante la cuenta regresiva.
   - Efectos sonoros de respuesta correcta, error, clic táctil y fanfarria triunfal de podio.
   - Control de volumen y botón para silenciar.

4. **Acceso Rápido por Código QR y PIN**:
   - En la pantalla del presentador se genera automáticamente un **código QR gigante** y un **PIN numérico de 4 dígitos**.
   - Los participantes solo escanean con la cámara de su celular y entran directo a la partida con el PIN prellenado.

5. **Gráficos de Resultados en Vivo**:
   - Al terminar cada pregunta, se revelan barras animadas con la cantidad exacta y el porcentaje de personas que eligieron cada opción.

6. **Marcador Dinámico y Podio 3D**:
   - Top de líderes con puntos calculados por velocidad de respuesta (fórmula oficial de Kahoot).
   - Contador de rachas ganadoras con llamas de fuego (🔥).
   - Podio 3D animado para los puestos 1º (Oro), 2º (Plata) y 3º (Bronce) con explosión de confeti.

7. **Simulador de +200 Bots para Pruebas**:
   - En la pantalla del presentador hay un botón **"⚡ +200 Bots"**.
   - Con un solo clic, se conectan 200 jugadores virtuales que compiten y responden con tiempos realistas, permitiéndote comprobar el rendimiento en vivo antes de tu evento real.

---

## ⚡ Cómo Iniciar el Proyecto

### Opción 1: Con 1 Clic (Recomendada)
Haz doble clic sobre el archivo:
```
run.bat
```
Esto iniciará el servidor y abrirá tu navegador automáticamente en `http://localhost:8000`.

---

### Opción 2: Desde la Terminal
Ejecuta:
```powershell
python server.py
```
O si tu comando de Python está en AppData:
```powershell
& "C:\Users\Manuel\AppData\Local\Python\bin\python.exe" server.py
```

---

## 📱 Cómo se Conectan los Jugadores

1. **Presentador / Proyector**:
   - Entra en tu computadora a:  
     `http://localhost:8000/host`

2. **Participantes (Celulares, Tablets o Laptops)**:
   - Asegúrate de que estén en la misma red Wi-Fi o red local.
   - Escanean el **Código QR** proyectado en pantalla o escriben la dirección que aparece en la parte izquierda del lobby (por ejemplo: `http://192.168.1.XX:8000/play`).
   - Eligen su apodo y su avatar emoji y ¡listo!

---

## ✏️ Creador y Editor Visual de Preguntas

Ya no necesitas editar archivos a mano. La plataforma cuenta con un **Creador de Cuestionarios interactivo**:
- Accede desde: `http://localhost:8000/editor` o haciendo clic en el botón azul **"Crear / Editar"** en la pantalla principal.
- **Funcionalidades del Editor**:
  1. **Tira de Diapositivas (Izquierda)**: Mira todas las preguntas, añade nuevas con el botón **"➕ Añadir Pregunta"**, duplica diapositivas (**📋**) o elimínalas (**🗑️**).
  2. **Área de Pregunta (Centro)**: Escribe el título de tu pregunta y escribe el texto en cada una de las 4 tarjetas (Rojo ▲, Azul ◆, Amarillo ●, Verde ■).
  3. **Marcar la Respuesta Correcta**: Simplemente haz clic en el círculo **(✓)** dentro de la tarjeta que sea la respuesta correcta (se iluminará en verde neón).
  4. **Panel de Ajustes (Derecha)**:
     - Cambia el tipo: **Quiz (4 Opciones)** o **Verdadero o Falso (2 Opciones)**.
     - Ajusta el tiempo límite: desde 5 hasta 120 segundos.
     - Puntos: estándar (1,000 pts), dobles (2,000 pts) o sin puntos.
     - Paleta de emojis temáticos.
  5. **Guardar y Jugar**: Con el botón verde **"💾 Guardar"** tus cambios quedan guardados en el servidor, y con **"🎮 Jugar Partida"** inicias directamente la sala de juego.
