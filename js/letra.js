/* ==========================================================
   LETRA SINCRONIZADA  –  aquí pegas la letra de tu canción
   ----------------------------------------------------------
   Debajo del rostro, partículas blancas forman cada frase
   en el momento en que suena.

   OPCIÓN FÁCIL (tiempos estimados automáticamente)
     Pega tu letra dentro de las comillas invertidas ` ` de abajo
     (una frase por línea; una línea en blanco = pausa).
     El código reparte las frases a lo largo de la canción según su largo.
     Para ajustar el arranque: lyrics.inicio y lyrics.cola en js/config.js.

   OPCIÓN PRECISA (tiempos reales)
     1) Con la letra pegada abajo y la música en assets/audio/musica.mp3,
        abre index.html y pulsa la tecla  G.
     2) Pulsa ESPACIO justo cuando empiece a cantarse cada frase
        (Backspace = repetir la anterior, Esc = terminar).
     3) Te da un código listo; pégalo AQUÍ reemplazando todo el archivo.
        Tendrá este formato:
          window.LETRA = [
            { t: 12.5, text: "Frase" },
            { t: 17.0, text: "Otra frase" },
          ];
     (si LETRA tiene frases con segundos, se usa en lugar de LETRA_TXT)

   Si queda adelantada o atrasada en general: lyrics.adelanto en config.js.
   ========================================================== */
   window.LETRA = [
    { t: 13.11, text: "Dos ojos se van, se van de viaje" },
    { t: 18.91, text: "No tienen conciencia de lo que vendrá" },
    { t: 24.85, text: "No saben de amor, ni de libertad" },
    { t: 30.94, text: "No tuvieron tiempo y el tiempo se vá" },
    { t: 41.51, text: "No te digo adiós, acompáñame" },
    { t: 47.44, text: "No perdemos nada con solo probar" },
    { t: 53.14, text: "Luego una canción, nos describirá" },
    { t: 59.04, text: "Yo te doy mis sueños aprendí a soñar" },
    { t: 64.27, text: "Vayamos lejos mi amor, lejos de acá" },
    { t: 70.49, text: "Mis ojos pueden llevarnos hacía otra realidad" },
    { t: 76.32, text: "Que sea un mundo mejor y la verdad" },
    { t: 81.18, text: "No sea triste, te juro que existe" },
    { t: 86.29, text: "Que existe ese lugar" },
    { t: 103.11, text: "Dos ojos están, están tan cerca" },
    { t: 109.27, text: "Basta solamente con saber mirar" },
    { t: 114.89, text: "Te voy a enseñar como caminar" },
    { t: 121.05, text: "Te daré la mano y me acompañarás" },
    { t: 125.93, text: "Vayamos lejor mi amor, lejos de acá" },
    { t: 132.07, text: "Mis ojos pueden llevarnos hacia otra realidad" },
    { t: 137.91, text: "Que sea un mundo mejor y la verdad" },
    { t: 144.69, text: "No sea triste, te juro que existe" },
    { t: 150.91, text: "Existe ese lugar" },
    { t: 165.14, text: "Vayamos lejor mi amor, lejos de acá" },
    { t: 173.13, text: "Mis ojos pueden llevarnos hacia otra realidad" },
    { t: 176.89, text: "Que sea un mundo mejor y la verdad" },
    { t: 184.07, text: "No será triste, te juro que existe" },
    { t: 189.93, text: "Que existe ese lugar" }
  ];
  
   