# Corazón de partículas

Corazón de partículas con disco luminoso, remolino con estelas, texto neón y cielo de estrellas.
**Al tocar la pantalla el corazón se transforma en un rostro** hecho solo de partículas, con los colores reales de la foto.
Debajo del rostro, partículas blancas forman la letra de la canción al ritmo de la música.

Hecho con WebGL puro: **no necesita instalar nada ni servidor**. Abre `index.html` con doble clic.

## Estructura
```
index.html              página principal
LEEME.md                este archivo
css/style.css           estilos y texto neón
js/config.js            AQUÍ CAMBIAS TODO (texto, colores, figuras, música...)
js/script.js            motor del efecto (no hace falta tocarlo)
js/estrellas.js         fondo de estrellas
js/letra.js             AQUÍ PEGAS LA LETRA y los segundos de cada frase
js/rostro-data.js       datos del rostro a color (generado, no hace falta tocarlo)
assets/img/             tus imágenes (fondo.jpg, rostro-original.png...)
assets/audio/           TU MÚSICA va aquí
assets/fonts/           fuentes (Kalam, licencia OFL)
herramientas/           crear-rostro.html: cambia el rostro por otra foto
```

## Música (ya está lista)
Copia tu canción a `assets/audio/` y llámala **`musica.mp3`**
(también sirve `musica.m4a`, `musica.ogg` o `musica.wav`). No hay que tocar nada más.
Suena tras el primer toque/clic (los navegadores lo exigen). Si no hay archivo, no pasa nada.
Si prefieres otro nombre: `music: "assets/audio/mi-cancion.mp3"` en `js/config.js`.

## Letra sincronizada
1. Escribe las frases en `js/letra.js` (una por línea, solo el texto).
2. Con la música en `assets/audio/musica.mp3`, abre `index.html` y pulsa la tecla **G**.
3. Pulsa **ESPACIO** justo cuando empiece a cantarse cada frase. Al final te da el código con los segundos: pégalo en `js/letra.js`.
4. Si queda adelantada/atrasada, ajusta `lyrics.adelanto` en `js/config.js`.

## Estrellas (js/config.js -> stars)
`enabled`, `density` (cantidad) y `shooting` (estrellas fugaces).

## Figuras (js/config.js)
- `shapes: ["corazon", "rostro"]` – corazón y luego rostro. `loopShapes: true` para que vuelva al corazón.
- `shapeText: { rostro: "Feliz cumpleaños" }` – texto distinto por figura (opcional).
- `tapHint: "Toca el corazón ♥"` – mensajito que invita a tocar (vacío = no se muestra).

## Cambiar el rostro por otra foto
1. Abre `herramientas/crear-rostro.html` (doble clic).
2. Elige una foto de frente, fondo liso y claro, cabeza y hombros.
3. Ajusta el contraste y pulsa **Descargar rostro-data.js**.
4. Reemplaza `js/rostro-data.js` por el archivo descargado.

## Otros ajustes (js/config.js)
- Texto: `text: "I Love You"`
- Colores: `main`, `highlight`, `textCore`, `textGlow` (hay ejemplos rosa/rojo/verde)
- Fondo con imagen: `background: { image: "assets/img/fondo.jpg" }`
- Tiempos: `cycle: { hold: 4.5, burst: 7.0 }` (segundos; el rostro se queda 9 s)
- Si va lento en celulares: baja `particles` (p. ej. 9000) y `ringParticles`.
  (El rostro se ve mejor con 14000 o más.)
- Altura de la letra: `lyrics.y`; tamaño: `lyrics.size`.

## Publicar
Sube la carpeta completa a cualquier hosting estático (Netlify, GitHub Pages, tu servidor).
Interacción: el mouse/dedo repele partículas; tocar lanza el remolino y cambia de figura.
