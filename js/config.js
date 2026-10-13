/* ==========================================================
   CONFIGURACIÓN  –  edita aquí sin tocar nada más
   ========================================================== */
   window.HEART_CONFIG = {

      /* Texto neón que aparece arriba de la figura */
      text: "Mientras tú estés a mi lado, mi mundo no se apagará",
    
      /* Figuras por las que pasa al TOCAR la pantalla.
         "corazon" -> "rostro" (el rostro usa los colores reales de la foto).
         El rostro es la última: al tocar de nuevo solo hace el remolino y se reforma. */
      shapes: ["corazon", "rostro"],
      loopShapes: false,      // true = después del rostro vuelve al corazón
    
      /* Texto distinto para alguna figura (opcional). Si no pones una, usa "text".
         Ejemplo:  shapeText: { rostro: "Feliz cumpleaños" } */
      shapeText: {},
    
      /* Mensajito opcional que invita a tocar (déjalo "" para no mostrarlo).
         Ejemplo: tapHint: "Toca el corazón ♥"                                   */
      tapHint: "",
    
      /* Colores de las partículas del corazón y del texto (formato #RRGGBB)
         Ejemplos:  rosa  -> main "#ff2f8e"  highlight "#ffc2dd"
                    rojo  -> main "#ff2a3a"  highlight "#ffb3b8"
                    verde -> main "#19d67a"  highlight "#b8ffd9"
         (el rostro ignora estos colores: usa los de la foto)                     */
      colors: {
        main:      "#1f66ff",   // color base de las partículas
        highlight: "#8fdcff",   // destellos y partículas rápidas
        textCore:  "#8cc4ff",   // centro de las letras
        textGlow:  "#1a62ff"    // resplandor de las letras
      },
    
      /* Cantidad de partículas. Más = más denso (y más exigente).
         El rostro se ve mejor con 14000 o más.
         En celulares el programa las reduce solo si hace falta.          */
      particles:     14000,   // figura
      ringParticles: 2600,    // disco luminoso de la base
    
      /* Fondo de estrellas (partículas que simulan un cielo nocturno) */
      stars: {
        enabled:  true,
        density:  1,      // 0.5 = pocas estrellas, 1.5 = muchas
        shooting: true    // estrellas fugaces de vez en cuando
      },
    
      /* Fondo: color sólido, o ruta a una imagen (opcional).
         Ejemplo: image: "assets/img/fondo.jpg"                           */
      background: {
        color: "#000000",
        image: ""
      },
    
      /* MÚSICA: copia tu archivo a assets/audio/ y llámalo "musica.mp3"
         (también funciona musica.m4a, musica.ogg o musica.wav).
         Si quieres otro nombre: music: "assets/audio/mi-cancion.mp3"
         Para desactivar la música: music: ""
         Los navegadores exigen un toque/clic para empezar a reproducir.   */
      music: "assets/audio/musica.mp3",
      musicVolume: 0.7,
    
      /* LETRA: partículas blancas debajo del rostro que forman cada frase
         al ritmo de la música. La letra y los tiempos van en js/letra.js  */
      lyrics: {
        particles: 2400,   // partículas de la letra (0 = sin letra). Más = texto más nítido
        size:      0.23,   // tamaño de las letras
        y:        -1.74,   // altura (más negativo = más abajo)
        adelanto:  0,      // segundos. Positivo = la frase aparece un poco antes; negativo = después
        inicio:    12,     // ESTIMACIÓN (si en letra.js no pones segundos): segundo en que empieza a cantarse la 1ª frase
        cola:      8,      // ESTIMACIÓN: segundos de música al final sin letra
        duracion:  200,    // ESTIMACIÓN: duración de la canción si el navegador no la detecta
        sinMusica: true    // si no hay archivo de música, usa un reloj interno para poder probar
      },
    
      /* CORAZONES FLOTANTES: corazones de partículas rojas que nacen abajo, suben y se
         esfuman; justo antes de desaparecer forman una frase.                        */
      hearts: {
        enabled:   true,
        count:     5,          // cuántos hay a la vez (0 = ninguno)
        particles: 260,        // partículas por corazón (más = frase más nítida)
        text:      "Te amo",   // frase que forman al final
        color:     "#ff2a44",  // color de las partículas
        life:      9,          // segundos que tarda cada corazón en subir y esfumarse
        size:      1           // tamaño (0.7 = más pequeños, 1.4 = más grandes)
      },
    
      /* Ciclo de animación, en segundos */
      cycle: {
        hold:       4.5,   // el corazón se queda quieto y brillando
        holdRostro: 14,    // el rostro se queda quieto este tiempo antes del siguiente remolino
        burst:      7.0    // dura el remolino de estelas (sube, pico, se recompone)
      },
    
      rotate:      true,   // la figura se balancea suavemente en 3D
      interactive: true,   // el dedo/mouse repele partículas; tocar lanza el remolino y cambia de figura
      glow:        1.0     // intensidad del resplandor (0.5 = suave, 1.5 = fuerte)
    };
    