# Guía Oficial de Uso 100% en Netlify (Sin Git ni Servidores Externos)
## DVEEEyR - Secretaría de Salud de Guanajuato (Actividad REE)

Esta plataforma ha sido adaptada para funcionar **100% en Netlify** sin necesidad de cuentas de GitHub, sin comandos de Git, sin Render y sin instalar nada en la nube.

---

### ¿Cómo funciona ahora? (Modo P2P Serverless)

1. **Tu navegador hace el trabajo:** Al abrir la pantalla del anfitrión en tu computadora (`/host`), tu navegador se convierte automáticamente en el servidor de la sala mediante WebRTC en la nube.
2. **Cero servidores de Python en la nube:** Los celulares de los participantes se conectan directamente con tu pantalla a través de canales seguros de datos por internet.
3. **Todo en Netlify:** Solo necesitas arrastrar tu carpeta a Netlify una sola vez.

---

### Paso a Paso: Cómo Subirlo a Netlify (Solo 1 Minuto)

1. Abre tu navegador web e inicia sesión en [app.netlify.com](https://app.netlify.com/).
2. Entra directo a la herramienta de arrastrar y soltar:  
   👉 **[app.netlify.com/drop](https://app.netlify.com/drop)**
3. En tu computadora con Windows, abre la carpeta de este proyecto:  
   `C:\Users\Manuel\Documents\ACTIVIDAD PARA EL REE`
4. Toma la carpeta **`static`** con el ratón, arrástrala y **suéltala** dentro del recuadro punteado de Netlify Drop.
5. Espera unos 10 a 20 segundos mientras Netlify sube los archivos.  
   ¡Listo! Netlify te dará un enlace público verde, por ejemplo:  
   `https://nombre-aleatorio.netlify.app`

> [!TIP]
> **Nombre personalizado fácil:** En Netlify, entra a **Site configuration** > **Change site name** y cámbialo por algo fácil de recordar, por ejemplo: `actividad-ree-ssg.netlify.app`.

---

### Cómo Usar el Juego el Día de la Actividad

#### 1. En la Pantalla del Presentador / Proyector (Tu Laptop):
1. Abre tu navegador (Chrome, Edge, Firefox, etc.) e ingresa a:  
   **`https://tu-sitio.netlify.app/host`**
2. Verás arriba el indicador en verde: **`🟢 Netlify P2P Activo`**.  
   *(Ya NO aparece ningún banner amarillo de error)*.
3. En pantalla se mostrará un **PIN de 4 dígitos** y un **Código QR gigante**.
4. *(Opcional)* Si quieres hacer una prueba con 200 participantes simulados, haz clic en el botón amarillo **`⚡ +200 Bots`**. Verás cómo se llena la sala con 200 médicos y epidemiólogos virtuales.
5. Cuando todos los participantes reales y virtuales estén listos, haz clic en **`¡Iniciar Actividad!`**.

#### 2. En el Celular de los Participantes:
1. Cada participante apunta la cámara de su celular al **Código QR** del proyector (o entra manualmente a `https://tu-sitio.netlify.app/play`).
2. El PIN se auto-completa solo.
3. Escriben su apodo o nombre, eligen su avatar y tocan **¡Entrar!**.
4. En su pantalla aparecerá **"¡Estás dentro!"** y su nombre se verá inmediatamente en la pantalla gigante.
5. Al comenzar la pregunta, en su celular aparecen los 4 botones gigantes con formas geométricas y texto adaptable que no se corta ni se deforma.

---

### Adaptaciones Realizadas para el Celular (Relación de Aspecto y Diseño)

- **Banner Oficial DVEEEyR:** Proporción bloqueada en `807:334` con `object-fit: contain` para que los textos y logos nunca se aplasten ni se pixelen en ningún tamaño de pantalla.
- **Escudo Oficial SSG Guanajuato 2024-2030:** Marca de agua circular con proporción `1:1` escalada mediante `min(520px, 80vw, 68vh)` para que no rebase verticalmente ni interfiera con el teclado del celular.
- **Formulario Anti-Cortes:** Uso de unidades `100dvh` y desplazamiento táctil suave para que al abrirse el teclado virtual en Android o iPhone, el botón "¡Entrar!" nunca quede fuera de la vista.
- **Botones de Respuesta Táctiles:** Cuadrícula con `min-height: 0` y tipografía fluida con límite de 3 líneas para preguntas y respuestas largas.

---

### ¿Y si no tengo internet en la sede y quiero jugar en red local?
El archivo [run.bat](file:///c:/Users/Manuel/Documents/ACTIVIDAD%20PARA%20EL%20REE/run.bat) sigue estando disponible en tu computadora:
- Haces doble clic en `run.bat` y se abrirá el servidor Python tradicional en `http://localhost:8000/`. Funciona sin internet mediante la red Wi-Fi local.
