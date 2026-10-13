/* ==========================================================
   Corazón de partículas  –  motor del efecto
   WebGL puro (sin librerías). Funciona abriendo index.html
   con doble clic, sin servidor.

   Fases:  intro  ->  hold  ->  burst  ->  hold  ->  burst ...
     intro : las partículas suben desde el disco en espiral
             y se abren hasta formar la primera figura
     hold  : figura estable, brillando
     burst : remolino con estelas y reagrupación
             (si lo provoca un toque, al llegar al punto
              más alto del remolino las partículas cambian
              de objetivo y se reagrupan en la figura siguiente)

   Figuras (config.js -> shapes): corazon, rostro
   El rostro usa los colores reales de la foto (js/rostro-data.js).
   Letra: partículas blancas bajo el rostro forman cada frase
   en sincronía con la música (js/letra.js).
   ========================================================== */
   (function () {
    'use strict';
  
    /* ---------------------------------------------------------
       1. CONFIGURACIÓN
    --------------------------------------------------------- */
    var DEF = {
      text: 'I Love You',
      colors: { main: '#1f66ff', highlight: '#8fdcff', textCore: '#8cc4ff', textGlow: '#1a62ff' },
      particles: 14000,
      ringParticles: 2600,
      background: { color: '#000000', image: '' },
      music: 'assets/audio/musica.mp3',
      musicVolume: 0.7,
      shapes: ['corazon', 'rostro'],
      loopShapes: false,
      shapeText: {},
      tapHint: '',
      cycle: { hold: 4.5, holdRostro: 14, burst: 7.0 },
      lyrics: { particles: 2400, size: 0.23, y: -1.74, adelanto: 0, inicio: 12, cola: 8, duracion: 200, sinMusica: true, font: 'bold {px}px "Segoe UI", system-ui, Arial, sans-serif' },
      hearts: { enabled: true, count: 5, particles: 260, text: 'Te amo', color: '#ff2a44', life: 9, size: 1 },
      rotate: true,
      interactive: true,
      glow: 1.0
    };
  
    function merge(base, extra) {
      var out = {}, k;
      for (k in base) out[k] = base[k];
      for (k in (extra || {})) {
        var v = extra[k];
        if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') out[k] = merge(base[k], v);
        else out[k] = v;
      }
      return out;
    }
    var CFG = merge(DEF, window.HEART_CONFIG);
  
    function hex(c) {
      c = String(c).replace('#', '');
      if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
      var n = parseInt(c, 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
  
    /* ---------------------------------------------------------
       2. UTILIDADES
    --------------------------------------------------------- */
    var PI = Math.PI, TAU = PI * 2;
    var sin = Math.sin, cos = Math.cos, sqrt = Math.sqrt, rnd = Math.random;
    function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
    function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
    function easeIO(x) { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
    function lerp(a, b, t) { return a + (b - a) * t; }
  
    /* Matrices 4x4 (column-major) */
    function perspective(fovy, aspect, n, f) {
      var t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
      m[0] = t / aspect; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f);
      return m;
    }
    function lookAt(e, c, u) {
      var fx = c[0] - e[0], fy = c[1] - e[1], fz = c[2] - e[2], fl = sqrt(fx * fx + fy * fy + fz * fz);
      fx /= fl; fy /= fl; fz /= fl;
      var sx = fy * u[2] - fz * u[1], sy = fz * u[0] - fx * u[2], sz = fx * u[1] - fy * u[0], sl = sqrt(sx * sx + sy * sy + sz * sz);
      sx /= sl; sy /= sl; sz /= sl;
      var ux = sy * fz - sz * fy, uy = sz * fx - sx * fz, uz = sx * fy - sy * fx;
      var m = new Float32Array(16);
      m[0] = sx; m[4] = sy; m[8] = sz;
      m[1] = ux; m[5] = uy; m[9] = uz;
      m[2] = -fx; m[6] = -fy; m[10] = -fz;
      m[12] = -(sx * e[0] + sy * e[1] + sz * e[2]);
      m[13] = -(ux * e[0] + uy * e[1] + uz * e[2]);
      m[14] = (fx * e[0] + fy * e[1] + fz * e[2]);
      m[15] = 1;
      return { m: m, f: [fx, fy, fz], r: [sx, sy, sz], u: [ux, uy, uz] };
    }
    function mul(a, b) {
      var o = new Float32Array(16);
      for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
      return o;
    }
    function rotY(a) {
      var c = cos(a), s = sin(a), m = new Float32Array(16);
      m[0] = c; m[2] = -s; m[5] = 1; m[8] = s; m[10] = c; m[15] = 1;
      return m;
    }
  
    /* ---------------------------------------------------------
       3. ESCENA / DOM
    --------------------------------------------------------- */
    var canvas = document.getElementById('gl');
    var titleEl = document.getElementById('title');
    var hintEl = document.getElementById('hint');
    var bgEl = document.getElementById('bg');
    var tapEl = document.getElementById('tap');
  
    document.documentElement.style.setProperty('--neon-core', CFG.colors.textCore);
    document.documentElement.style.setProperty('--neon-glow', CFG.colors.textGlow);
    titleEl.textContent = CFG.text;
    document.getElementById('stage').style.background = CFG.background.color;
    if (CFG.background.image) bgEl.style.backgroundImage = 'url("' + CFG.background.image + '")';
  
    var gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }) ||
             canvas.getContext('experimental-webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true });
    if (!gl) { document.getElementById('nogl').hidden = false; return; }
  
    /* ---------------------------------------------------------
       4. SHADERS
    --------------------------------------------------------- */
    function shader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
      return s;
    }
    function program(vs, fs) {
      var p = gl.createProgram();
      gl.attachShader(p, shader(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(p));
      return p;
    }
  
    var VS = [
      'attribute vec3 aPos;',
      'attribute vec4 aData;',              // x=tamaño  y=alpha  z=mezcla de color  w=suave(halo)
      'attribute vec4 aCol;',               // rgb = color propio (foto)  a = cuánto usarlo (0 = paleta)
      'uniform mat4 uMVP;',
      'uniform float uPx;',                 // escala de píxeles
      'uniform float uDist;',
      'uniform float uMaxPt;',
      'varying float vA; varying float vM; varying float vS; varying vec4 vC;',
      'void main(){',
      '  vC = aCol;',
      '  vec4 p = uMVP * vec4(aPos, 1.0);',
      '  gl_Position = p;',
      '  gl_PointSize = clamp(aData.x * uPx * (uDist / p.w), 1.0, uMaxPt);',
      '  vA = aData.y; vM = aData.z; vS = aData.w;',
      '}'
    ].join('\n');
  
    var FS = [
      'precision mediump float;',
      'uniform vec3 uC1; uniform vec3 uC2; uniform float uGain;',
      'varying float vA; varying float vM; varying float vS; varying vec4 vC;',
      'void main(){',
      '  vec2 d = gl_PointCoord - 0.5;',
      '  float r2 = dot(d, d) * 4.0;',
      '  if (r2 > 1.0) discard;',
      '  float core = exp(-r2 * 7.0);',
      '  float halo = exp(-r2 * 2.6) * 0.30;',
      '  float soft = exp(-r2 * 2.4);',
      '  float shape = mix(core + halo, soft, vS);',
      '  vec3 c = mix(mix(uC1, uC2, vM), vC.rgb, vC.a);',
      '  c = mix(c, vec3(1.0), core * 0.28 * (1.0 - vS) * (1.0 - vC.a * 0.85));',
      '  gl_FragColor = vec4(c * shape * vA * uGain, 1.0);',
      '}'
    ].join('\n');
  
    var VS_Q = 'attribute vec2 aP; void main(){ gl_Position = vec4(aP, 0.0, 1.0); }';
    var FS_Q = 'precision mediump float; uniform vec4 uC; void main(){ gl_FragColor = uC; }';
  
    var progP = program(VS, FS);
    var progQ = program(VS_Q, FS_Q);
  
    var U = {
      mvp: gl.getUniformLocation(progP, 'uMVP'), px: gl.getUniformLocation(progP, 'uPx'),
      dist: gl.getUniformLocation(progP, 'uDist'), maxPt: gl.getUniformLocation(progP, 'uMaxPt'),
      c1: gl.getUniformLocation(progP, 'uC1'), c2: gl.getUniformLocation(progP, 'uC2'), gain: gl.getUniformLocation(progP, 'uGain')
    };
    var A = { pos: gl.getAttribLocation(progP, 'aPos'), data: gl.getAttribLocation(progP, 'aData'), col: gl.getAttribLocation(progP, 'aCol') };
    var UQ = { c: gl.getUniformLocation(progQ, 'uC') }, AQ = gl.getAttribLocation(progQ, 'aP');
  
    var quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  
    var maxPt = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] || 64;
  
    /* ---------------------------------------------------------
       5. PARTÍCULAS
    --------------------------------------------------------- */
    var narrow = Math.min(window.innerWidth, window.innerHeight) < 600;
    var weak = (navigator.hardwareConcurrency || 8) <= 4;
    var scaleCount = (narrow ? 0.72 : 1) * (weak ? 0.8 : 1);
  
    var N = Math.round(CFG.particles * scaleCount);          // corazón
    var NR = Math.round(CFG.ringParticles * scaleCount);     // anillo (se dibuja 2 veces por frame)
    var NH = Math.round(N * 0.14);                           // halos suaves del corazón
    var NRH = Math.round(NR * 0.22) + 16;                    // halos suaves del anillo (+16 del núcleo)
    var NL = CFG.lyrics.particles > 0 ? Math.round(CFG.lyrics.particles * (narrow ? 0.8 : 1)) : 0;   // partículas de la letra
    var HC0 = CFG.hearts.enabled && CFG.hearts.count > 0 ? Math.round(CFG.hearts.count) : 0;     // corazones flotantes simultáneos
    var HP0 = Math.round(CFG.hearts.particles * (narrow ? 0.8 : 1));                              // partículas por corazón
    var NHR = HC0 * HP0;
    var TOTAL = N + NR * 2 + NH + NRH + NL + NHR;
    var STRIDE = 11;                                         // x y z | tamaño alpha mezcla suave | r g b uso
    var buf = new Float32Array(TOTAL * STRIDE);
  
    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, buf.byteLength, gl.DYNAMIC_DRAW);
  
    /* Constantes de la escena (unidades de mundo) */
    var FLOOR_Y = -1.27;        // altura del disco luminoso
    var RING_R0 = 2.1;          // radio inicial (disco ancho del principio)
    var RING_R1 = 0.58;         // radio final del disco
    var INTRO_END = 5.4;        // segundos que dura la formación
  
    /* --- Corazón: muestreo por rechazo en la curva implícita --- */
    function heartF(x, y) { var a = x * x + y * y - 1; return a * a * a - x * x * y * y * y; }
  
    var hx = new Float32Array(N), hy = new Float32Array(N), hz = new Float32Array(N);
    var px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N);
    var vx = new Float32Array(N), vy = new Float32Array(N), vz = new Float32Array(N);
    var p0x = new Float32Array(N), p0y = new Float32Array(N), p0z = new Float32Array(N);
    var cx = new Float32Array(N), cy = new Float32Array(N), cz = new Float32Array(N);
    var spin = new Float32Array(N), orb = new Float32Array(N);
    var dl = new Float32Array(N), du = new Float32Array(N);
    var ph = new Float32Array(N), kv = new Float32Array(N), wb = new Float32Array(N);
    var sz = new Float32Array(N), al = new Float32Array(N), mx = new Float32Array(N);
  
    (function initHeart() {
      var i, x, y, f, edge, s;
      for (i = 0; i < N; i++) {
        edge = rnd() < 0.2;
        for (;;) {
          x = (rnd() * 2 - 1) * 1.3;
          y = rnd() * 2.45 - 1.05;
          f = heartF(x, y);
          if (f > 0) continue;
          if (edge && f < -0.35) continue;
          var nz = 0.5 + 0.30 * sin(x * 3.3 + 1.1) * sin(y * 2.9 - 0.4) + 0.20 * sin(x * 7.1 - y * 6.3 + 2.0) + 0.15 * sin(y * 5.2 + x * 2.1);
          if (rnd() > clamp(0.30 + 0.85 * nz, 0, 1)) continue;
          break;
        }
        var depth = clamp(0.3 + (-f) * 1.2, 0.3, 1);
        hx[i] = x * 0.93;
        hy[i] = (y - 0.17) * 0.93;
        hz[i] = (rnd() + rnd() - 1) * 0.38 * depth;
  
        /* trayecto de la intro: disco -> columna -> corazón */
        var ang = rnd() * TAU, rr = RING_R0 * (0.35 + 0.65 * sqrt(rnd()));
        p0x[i] = cos(ang) * rr; p0z[i] = sin(ang) * rr; p0y[i] = FLOOR_Y + (rnd() - 0.5) * 0.06;
        cx[i] = (rnd() - 0.5) * 0.38; cz[i] = (rnd() - 0.5) * 0.38;
        cy[i] = FLOOR_Y + (hy[i] - FLOOR_Y) * (0.4 + 0.35 * rnd());
        spin[i] = (1.2 + rnd() * 1.4) * PI;
        orb[i] = 0.35 + rnd() * 0.5;
        dl[i] = Math.pow(rnd(), 1.3) * 2.0;
        du[i] = 2.4 + rnd();
  
        ph[i] = rnd();
        kv[i] = 0.7 + rnd() * 0.6;
        wb[i] = smooth((0.6 - hy[i]) / 1.6);
  
        /* apariencia: mayoría pequeñas, algunas destellos grandes */
        var q = rnd();
        sz[i] = q < 0.80 ? 3.8 + rnd() * 2.8 : q < 0.96 ? 6.5 + rnd() * 3 : 9.5 + rnd() * 4;
        al[i] = 0.30 + 0.70 * Math.pow(rnd(), 1.5);
        mx[i] = Math.pow(rnd(), 2.6) * 0.75;
  
        px[i] = p0x[i]; py[i] = p0y[i]; pz[i] = p0z[i];
      }
    })();
  
    /* ---------------------------------------------------------
       5b. FIGURAS  (corazón, estrella, mariposa, rostro)
       Cada figura es una lista de N posiciones objetivo; las
       partículas se reparten entre ellas. Al tocar, el objetivo
       cambia a la figura siguiente.
    --------------------------------------------------------- */
    var tmx = new Float32Array(N), tal = new Float32Array(N);        // mezcla de color y brillo por partícula (según figura)
    var tcr = new Float32Array(N), tcg = new Float32Array(N), tcb = new Float32Array(N);   // color propio por partícula (rostro)
    var LOOK = { pulse: 0.018, jit: 0.018, size: 1, flat: 0, rot: 1, halo: 1, gain: 1, colw: 0 };   // valores actuales (se suavizan al cambiar)
    var SHAPES = {}, seq = [], seqIdx = 0, TGT = null, pending = null;
  
    function newShape(p) {
      return {
        x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N),
        mix: new Float32Array(N), alp: new Float32Array(N),
        pulse: p.pulse, jit: p.jit, size: p.size, flat: p.flat, rot: p.rot, halo: p.halo, gain: p.gain || 1, colw: p.colw || 0, col: null, hold: p.hold || 0
      };
    }
  
    /* textura "nubosa": zonas con más y menos partículas (igual que el corazón) */
    function cloud(x, y) {
      var nz = 0.5 + 0.30 * sin(x * 3.3 + 1.1) * sin(y * 2.9 - 0.4) + 0.20 * sin(x * 7.1 - y * 6.3 + 2.0) + 0.15 * sin(y * 5.2 + x * 2.1);
      return clamp(0.30 + 0.85 * nz, 0, 1);
    }
  
    function buildHeart() {
      var s = newShape({ pulse: 0.018, jit: 0.018, size: 1, flat: 0, rot: 1, halo: 1 });
      s.x.set(hx); s.y.set(hy); s.z.set(hz); s.mix.set(mx);
      for (var i = 0; i < N; i++) s.alp[i] = 1;
      return s;
    }
  
    function buildFace() {
      var D = window.ROSTRO_DATA;
      if (!D || !D.data) { console.warn('Falta js/rostro-data.js: la figura "rostro" se omite.'); return null; }
      var s = newShape({ pulse: 0.006, jit: 0.004, size: 0.72, flat: 0.6, rot: 0.45, halo: 0.14, gain: 1.4, colw: 1,
                         hold: CFG.cycle.holdRostro || 14 });
      var bin = atob(D.data), W = D.w, H = D.h, n = W * H, dens = new Float32Array(n), cdf = new Float32Array(n), sum = 0, i;
      for (i = 0; i < n; i++) { dens[i] = bin.charCodeAt(i * 4 + 3) / 255; sum += Math.pow(dens[i], 1.4); cdf[i] = sum; }
      s.col = new Float32Array(N * 3);
      var halfH = 1.165, cyF = -0.085, halfW = halfH * D.aspect;
      for (i = 0; i < N; i++) {
        var u = rnd() * sum, lo = 0, hi = n - 1;
        while (lo < hi) { var mid = (lo + hi) >> 1; if (cdf[mid] < u) lo = mid + 1; else hi = mid; }
        var d = dens[lo];
        var nx = ((lo % W) + rnd()) / W * 2 - 1, ny = (((lo / W) | 0) + rnd()) / H * 2 - 1;
        var dome = sqrt(Math.max(0, 1 - (nx * nx + ny * ny)));
        s.x[i] = nx * halfW;
        s.y[i] = cyF - ny * halfH;
        s.z[i] = 0.40 * dome - 0.20 + (d - 0.5) * 0.10 + (rnd() - 0.5) * 0.015;
        s.col[i * 3] = bin.charCodeAt(lo * 4) / 255;
        s.col[i * 3 + 1] = bin.charCodeAt(lo * 4 + 1) / 255;
        s.col[i * 3 + 2] = bin.charCodeAt(lo * 4 + 2) / 255;
        s.mix[i] = 0;
        s.alp[i] = 0.5 + 0.5 * d;
      }
      return s;
    }
  
    var BUILD = { corazon: buildHeart, rostro: buildFace };
    var ALIAS = { corazon: 'corazon', 'corazón': 'corazon', heart: 'corazon', rostro: 'rostro', cara: 'rostro', face: 'rostro' };
  
    (function initShapes() {
      (CFG.shapes && CFG.shapes.length ? CFG.shapes : ['corazon']).forEach(function (nm) {
        var key = ALIAS[String(nm).toLowerCase()];
        if (!key) { console.warn('Figura desconocida en config.js: ' + nm); return; }
        if (!SHAPES[key]) SHAPES[key] = BUILD[key]();
        if (SHAPES[key]) seq.push(key);
      });
      if (!seq.length) { SHAPES.corazon = SHAPES.corazon || buildHeart(); seq.push('corazon'); }
    })();
  
    var titleSwapTimer = 0;
    function shapeTitle(key) { return (CFG.shapeText && CFG.shapeText[key]) || CFG.text; }
  
    function applyShape(key, instant) {
      var sh = SHAPES[key], i;
      for (i = 0; i < N; i++) {
        hx[i] = sh.x[i]; hy[i] = sh.y[i]; hz[i] = sh.z[i];
        tmx[i] = sh.mix[i]; tal[i] = sh.alp[i];
        if (sh.col) { tcr[i] = sh.col[i * 3]; tcg[i] = sh.col[i * 3 + 1]; tcb[i] = sh.col[i * 3 + 2]; } else { tcr[i] = tcg[i] = tcb[i] = 1; }
        wb[i] = smooth((0.6 - sh.y[i]) / 1.6);
      }
      TGT = sh;
      if (instant) { LOOK.pulse = sh.pulse; LOOK.jit = sh.jit; LOOK.size = sh.size; LOOK.flat = sh.flat; LOOK.rot = sh.rot; LOOK.halo = sh.halo; LOOK.gain = sh.gain; LOOK.colw = sh.colw; }
      var txt = shapeTitle(key);
      if (instant) { titleEl.textContent = txt; }
      else if (txt !== titleEl.textContent) {
        if (titleEl.animate) titleEl.animate([{ opacity: 1 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], { duration: 1400 });
        clearTimeout(titleSwapTimer);
        titleSwapTimer = setTimeout(function () { titleEl.textContent = txt; layoutTitle(); }, 700);
      }
    }
    applyShape(seq[0], true);
  
    /* --- Anillo luminoso de la base --- */
    var rr_ = new Float32Array(NR), th = new Float32Array(NR), om = new Float32Array(NR), rph = new Float32Array(NR);
    var rsz = new Float32Array(NR), ral = new Float32Array(NR), rmx = new Float32Array(NR);
    (function initRing() {
      for (var j = 0; j < NR; j++) {
        rr_[j] = rnd() < 0.3 ? 0.82 + 0.18 * rnd() : sqrt(rnd());
        th[j] = rnd() * TAU;
        om[j] = 0.9 + rnd() * 2.6;
        rph[j] = rnd();
        rsz[j] = 3.5 + rnd() * 3.5;
        ral[j] = (0.26 + 0.30 * rnd()) * (1.15 - 0.55 * rr_[j]);
        rmx[j] = 0.15 + rnd() * 0.55;
      }
    })();
  
    /* ---------------------------------------------------------
       5c. LETRA SINCRONIZADA
       Partículas blancas bajo el rostro. Cuando empieza una línea de
       js/letra.js, se juntan de izquierda a derecha formando la frase;
       al terminar, se deshacen en polvo de estrellas.
    --------------------------------------------------------- */
    var LYCFG = CFG.lyrics, LY = [];
    var lyIdx = -1, lyVis = 0, recOn = false, clockT0 = -1;
  
    /* Lee la letra de js/letra.js: window.LETRA (con segundos) o window.LETRA_TXT (solo texto) */
    function lyricSource() {
      var out = [], raw = window.LETRA || [];
      raw.forEach(function (e) {
        if (typeof e === 'string') { if (e.trim()) out.push({ text: e.trim() }); }
        else if (e && typeof e.text === 'string') out.push({ t: e.t, end: e.end, text: e.text });
      });
      if (!out.length && typeof window.LETRA_TXT === 'string') {
        var pause = false;
        window.LETRA_TXT.split(/\r?\n/).forEach(function (l) {
          l = l.trim();
          if (!l) { pause = true; return; }
          out.push({ text: l, pause: pause }); pause = false;
        });
      }
      return out;
    }
  
    /* Arma la lista de frases con sus segundos. Si no hay segundos (solo texto),
       los ESTIMA repartiendo las frases por su largo entre "inicio" y el final de la canción. */
    function buildLY() {
      var src = lyricSource(), k;
      LY = [];
      var timed = src.filter(function (e) { return typeof e.t === 'number'; });
      if (timed.length) {
        timed.forEach(function (e) { LY.push({ t: e.t, end: typeof e.end === 'number' ? e.end : 0, text: e.text }); });
      } else if (src.length) {
        var dur = (audio && isFinite(audio.duration) && audio.duration > 0) ? audio.duration : LYCFG.duracion;
        var t0 = LYCFG.inicio, t1 = Math.max(t0 + src.length, dur - LYCFG.cola), tot = 0, cum = 0, w = [];
        for (k = 0; k < src.length; k++) { w[k] = Math.max(10, src[k].text.length) + (src[k].pause ? 14 : 0); tot += w[k]; }
        for (k = 0; k < src.length; k++) {
          cum += src[k].pause ? 14 : 0;
          LY.push({ t: t0 + (t1 - t0) * cum / tot, end: 0, text: src[k].text });
          cum += Math.max(10, src[k].text.length);
        }
      }
      LY.sort(function (a, b) { return a.t - b.t; });
      for (k = 0; k < LY.length; k++) {
        if (!LY[k].end) {
          var nxt = k + 1 < LY.length ? LY[k + 1].t : 1e9;
          LY[k].end = Math.min(nxt, LY[k].t + clamp(LY[k].text.length * 0.12 + 1.4, 2.2, 9));   // si hay pausa, la frase no se queda pegada
        }
      }
      lyIdx = -2;                                              // fuerza a refrescar la frase actual
    }
    buildLY();
  
    var lx = new Float32Array(NL), ly = new Float32Array(NL), lz = new Float32Array(NL);
    var lvx = new Float32Array(NL), lvy = new Float32Array(NL), lvz = new Float32Array(NL);
    var ltx = new Float32Array(NL), lty = new Float32Array(NL), lkey = new Float32Array(NL), lass = new Uint8Array(NL);
    var ldx = new Float32Array(NL), ldy = new Float32Array(NL), ldz = new Float32Array(NL);
    var lph = new Float32Array(NL), lsz = new Float32Array(NL), lal = new Float32Array(NL);
    (function initLy() {
      for (var j = 0; j < NL; j++) {
        ldx[j] = (rnd() * 2 - 1) * 1.55; ldy[j] = LYCFG.y + (rnd() - 0.5) * 0.6; ldz[j] = (rnd() - 0.5) * 0.5;
        lx[j] = ldx[j]; ly[j] = ldy[j]; lz[j] = ldz[j];
        lph[j] = rnd(); lsz[j] = 1.6 + rnd() * 2.2; lal[j] = 0.25 + 0.75 * Math.pow(rnd(), 1.6);
      }
    })();
  
    var lyCv = document.createElement('canvas'), lyCx = lyCv.getContext('2d');
    function textTargets(text) {
      var words = text.split(' '), lines = [text], q, kk;
      if (text.length > 34 && words.length > 3) {              // frase larga: dos renglones
        var best = 0, bd = 1e9, acc = 0;
        for (kk = 0; kk < words.length - 1; kk++) { acc += words[kk].length + 1; var dd = Math.abs(acc - text.length / 2); if (dd < bd) { bd = dd; best = kk; } }
        lines = [words.slice(0, best + 1).join(' '), words.slice(best + 1).join(' ')];
      }
      var F = 96, W = 2200, LH = F * 1.25, H = Math.ceil(LH * lines.length + 20), maxw = 0;
      lyCv.width = W; lyCv.height = H;
      lyCx.font = LYCFG.font.replace('{px}', F);
      for (q = 0; q < lines.length; q++) maxw = Math.max(maxw, lyCx.measureText(lines[q]).width);
      var Fe = maxw > W - 60 ? F * (W - 60) / maxw : F;          // si no cabe en el lienzo, achicar la letra
      lyCx.font = LYCFG.font.replace('{px}', Fe);
      lyCx.textAlign = 'center'; lyCx.textBaseline = 'middle'; lyCx.fillStyle = '#fff';
      maxw = 0;
      for (q = 0; q < lines.length; q++) maxw = Math.max(maxw, lyCx.measureText(lines[q]).width);
      for (q = 0; q < lines.length; q++) lyCx.fillText(lines[q], W / 2, 10 + LH * (q + 0.5));
      var data = lyCx.getImageData(0, 0, W, H).data, pts = [], x, y;
      for (y = 0; y < H; y += 2) for (x = 0; x < W; x += 2) if (data[(y * W + x) * 4 + 3] > 140) pts.push(x, y);
      var scale = LYCFG.size / F; if (maxw * scale > 2.5) scale = 2.5 / maxw;
      var count = pts.length / 2, take = Math.min(NL, count), step = count / Math.max(1, take);
      var out = { x: new Float32Array(take), y: new Float32Array(take), key: new Float32Array(take), n: take };
      for (var j = 0; j < take; j++) {
        var idx = Math.min(count - 1, Math.floor((j + rnd()) * step));
        var px_ = pts[idx * 2] + rnd() * 2, py_ = pts[idx * 2 + 1] + rnd() * 2;
        out.x[j] = (px_ - W / 2) * scale;
        out.y[j] = LYCFG.y - (py_ - H / 2) * scale;
        out.key[j] = clamp((px_ - W / 2 + maxw / 2) / Math.max(1, maxw), 0, 1);
      }
      return out;
    }
  
    function lyricTime() {                                      // segundo actual de la canción (-1 = no suena)
      if (audio && audioStarted && !audio.paused && audio.readyState >= 2) return audio.currentTime;
      if (!audio && LYCFG.sinMusica && clockT0 >= 0) return T - clockT0;   // sin archivo de música: reloj interno para probar
      return -1;
    }
  
    function lyKick(sv) {
      for (var j = 0; j < NL; j++) { lvx[j] += (rnd() - 0.5) * sv * 1.8; lvy[j] += (0.1 + rnd() * 0.9) * sv * 1.1; lvz[j] += (rnd() - 0.5) * sv; }
    }
  
    function lySet(k) {
      lyIdx = k;
      var j;
      if (k >= 0) {
        var tg = textTargets(LY[k].text), perm = [], q, r, tmp;
        for (q = 0; q < tg.n; q++) perm.push(q);
        for (q = tg.n - 1; q > 0; q--) { r = Math.floor(rnd() * (q + 1)); tmp = perm[q]; perm[q] = perm[r]; perm[r] = tmp; }
        for (j = 0; j < NL; j++) {
          if (j < tg.n) { q = perm[j]; ltx[j] = tg.x[q]; lty[j] = tg.y[q]; lkey[j] = tg.key[q]; lass[j] = 1; } else lass[j] = 0;
        }
      } else for (j = 0; j < NL; j++) lass[j] = 0;
      lyKick(k >= 0 ? 1 : 0.6);
    }
  
    function lyStep(dt, o, fadeIn) {
      var tm = recOn ? -1 : lyricTime(), want = -1, k, j;
      if (tm >= 0 && LY.length) {
        tm += LYCFG.adelanto;
        for (k = 0; k < LY.length; k++) if (tm >= LY[k].t && tm < LY[k].end) { want = k; break; }
      }
      if (want !== lyIdx) lySet(want);
      var showFor = SHAPES.rostro ? (seq[seqIdx] === 'rostro' ? 1 : 0) : 1;
      lyVis += (showFor - lyVis) * Math.min(1, dt * 1.5);
  
      var p = 0;
      if (want >= 0) { var rd = Math.min(1.3, (LY[want].end - LY[want].t) * 0.6); p = clamp((tm - LY[want].t) / rd, 0, 1.05); }
  
      for (j = 0; j < NL; j++) {
        var formed = lass[j] === 1 && lkey[j] <= p, tx, ty, tz, kS, cD;
        if (formed) { tx = ltx[j]; ty = lty[j]; tz = sin(T * 2 + lph[j] * 30) * 0.004; kS = 18; cD = 6.5; }
        else {
          tx = ldx[j] + sin(T * (0.3 + lph[j] * 0.5) + lph[j] * 40) * 0.06;
          ty = ldy[j] + sin(T * (0.4 + lph[j] * 0.4) + lph[j] * 70) * 0.05;
          tz = ldz[j]; kS = 1.6; cD = 1.5;
        }
        lvx[j] += (kS * (tx - lx[j]) - cD * lvx[j]) * dt;
        lvy[j] += (kS * (ty - ly[j]) - cD * lvy[j]) * dt;
        lvz[j] += (kS * (tz - lz[j]) - cD * lvz[j]) * dt;
        var spd = sqrt(lvx[j] * lvx[j] + lvy[j] * lvy[j] + lvz[j] * lvz[j]);
        if (spd > 5) { var sc = 5 / spd; lvx[j] *= sc; lvy[j] *= sc; lvz[j] *= sc; spd = 5; }
        lx[j] += lvx[j] * dt; ly[j] += lvy[j] * dt; lz[j] += lvz[j] * dt;
  
        var a = formed ? 1.0 * (1 + Math.min(2.5, spd * 0.8))
                       : lal[j] * (0.6 + 0.4 * sin(T * (2 + lph[j] * 4) + lph[j] * 20)) * 0.55;
        buf[o] = lx[j]; buf[o + 1] = ly[j]; buf[o + 2] = lz[j];
        buf[o + 3] = formed ? 3.8 : lsz[j];
        buf[o + 4] = a * lyVis * fadeIn;
        buf[o + 5] = 0; buf[o + 6] = 0;
        buf[o + 7] = 1; buf[o + 8] = 1; buf[o + 9] = 1; buf[o + 10] = 1;   // blanco puro
        o += STRIDE;
      }
      return o;
    }
  
    /* ---------------------------------------------------------
       5d. CORAZONES FLOTANTES
       Corazones de partículas rojas que nacen abajo, suben y se esfuman.
       Justo antes de desaparecer, sus partículas se reordenan y forman
       la frase (config.js -> hearts.text, por defecto "Te amo").
    --------------------------------------------------------- */
    var HCFG = CFG.hearts, hcol = hex(HCFG.color), hVis = 0, hInit = false;
    var HC = NHR ? HC0 : 0, HP = NHR ? HP0 : 0;
    var hhx = new Float32Array(NHR), hhy = new Float32Array(NHR);      // posición de cada partícula dentro del corazón (unidad ~1)
    var htx = new Float32Array(NHR), hty = new Float32Array(NHR);      // posición dentro de la frase (ancho total = 1)
    var hpx = new Float32Array(NHR), hpy = new Float32Array(NHR), hpz = new Float32Array(NHR);
    var hvx = new Float32Array(NHR), hvy = new Float32Array(NHR), hvz = new Float32Array(NHR);
    var hsh = new Float32Array(NHR), hrn = new Float32Array(NHR);
    var HEARTS = [], hTextAspect = 0.3;
  
    function heartTextPoints() {                                        // puntos de la frase, sacados de un lienzo
      var cvs = document.createElement('canvas'), W = 900, H = 300, g = cvs.getContext('2d');
      cvs.width = W; cvs.height = H;
      g.font = LYCFG.font.replace('{px}', 170);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
      var txt = String(HCFG.text || ''), mw = Math.max(1, g.measureText(txt).width);
      g.fillText(txt, W / 2, H / 2);
      var d = g.getImageData(0, 0, W, H).data, xs = [], ys = [], x, y;
      for (y = 0; y < H; y += 2) for (x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 140) { xs.push((x - W / 2) / mw); ys.push(-(y - H / 2) / mw); }
      return { x: xs, y: ys, n: xs.length };
    }
  
    function heartRespawn(h, stagger, slot) {
      var side = slot % 2 ? 1 : -1, lane = slot >> 1, nS = Math.ceil(HC / 2);          // cada corazón tiene su carril (izq/der) y su altura
      var visW = camDist * tanH * aspect, hw = Math.min(2.6, visW - 0.42);          // hasta dónde se ve a los lados
      h.life = HCFG.life * (0.85 + rnd() * 0.3);
      h.age = stagger;
      h.x0 = side * (0.86 + Math.max(0.04, hw - 0.86) * clamp((lane + 0.15 + rnd() * 0.7) / nS, 0, 1));
      h.y0 = -1.98;
      h.y1 = 0.40 + 0.62 * clamp((((lane * 2 + 1) % nS + 0.15 + rnd() * 0.7) / nS), 0, 1);   // altura donde se forma la frase (distinta por carril)
      h.sc = (0.17 + rnd() * 0.09) * HCFG.size;                          // radio del corazón
      h.ts = 0.78 * HCFG.size;                                           // ancho de la frase
      h.ph = rnd() * TAU; h.sw = 0.05 + rnd() * 0.07;
      h.fresh = true;
    }
  
    function heartCenter(h, u, out) {                                    // trayectoria: sube frenando al final
      var e = 1 - Math.pow(1 - clamp(u, 0, 1), 1.7);
      out[0] = h.x0 + sin(h.age * 0.9 + h.ph) * h.sw * (0.4 + 0.6 * u);
      out[1] = h.y0 + (h.y1 - h.y0) * e;
    }
  
    (function initHearts() {
      if (!NHR) return;
      var tp = heartTextPoints(), perm = [], j, k;
      for (j = 0; j < HP; j++) perm.push(j);
      for (j = HP - 1; j > 0; j--) { k = Math.floor(rnd() * (j + 1)); var t = perm[j]; perm[j] = perm[k]; perm[k] = t; }
      for (var h = 0; h < HC; h++) {
        HEARTS.push({});
        for (j = 0; j < HP; j++) {
          var i = h * HP + j, a = rnd() * TAU;
          var bx = Math.pow(sin(a), 3), by = (13 * cos(a) - 5 * cos(2 * a) - 2 * cos(3 * a) - cos(4 * a) + 2.5) / 15;
          var f = rnd() < 0.5 ? 1 : sqrt(rnd());                          // mitad en el borde, mitad relleno
          hhx[i] = bx * f + (rnd() - 0.5) * 0.07; hhy[i] = by * f + (rnd() - 0.5) * 0.07;
          if (tp.n) {
            var idx = Math.min(tp.n - 1, Math.floor((perm[j] + rnd()) * tp.n / HP));
            htx[i] = tp.x[idx] + (rnd() - 0.5) * 0.004; hty[i] = tp.y[idx] + (rnd() - 0.5) * 0.004;
          } else { htx[i] = hhx[i] * 0.2; hty[i] = hhy[i] * 0.2; }
          hsh[i] = rnd(); hrn[i] = rnd();
        }
      }
    })();
  
    function heartsStep(dt, o, fadeIn) {
      var c = [0, 0], h, j, i, u, m, fo, fi;
      if (!hInit) { for (h = 0; h < HC; h++) heartRespawn(HEARTS[h], -h * HCFG.life / HC, h); hInit = true; }
      hVis += ((state === 'intro' ? 0 : 1) - hVis) * Math.min(1, dt * 1.2);
  
      for (h = 0; h < HC; h++) {
        var H_ = HEARTS[h];
        H_.age += dt;
        if (H_.age >= H_.life) heartRespawn(H_, 0, h);
        u = H_.age / H_.life;
        var born = H_.age < 0;                                            // aún no nace (escalonado al inicio)
        heartCenter(H_, Math.max(0, u), c);
        var cvx = H_.fresh ? 0 : (c[0] - H_.px) / Math.max(dt, 1e-3), cvy = H_.fresh ? 0 : (c[1] - H_.py) / Math.max(dt, 1e-3);
        H_.px = c[0]; H_.py = c[1];
        m = smooth((u - 0.60) / 0.14);                                    // 0 = corazón, 1 = frase
        fo = smooth((u - 0.93) / 0.07);                                   // se esfuma
        fi = smooth(u / 0.10);                                            // aparece
        var beat = 1 + 0.08 * sin(T * 6 + H_.ph);
  
        for (j = 0; j < HP; j++) {
          i = h * HP + j;
          var tx = c[0] + lerp(hhx[i] * H_.sc * beat, htx[i] * H_.ts, m);
          var ty = c[1] + lerp(hhy[i] * H_.sc * beat, hty[i] * H_.ts, m);
          var tz = (hrn[i] - 0.5) * 0.05 * (1 - m);
          var sh = (1 - m) * (0.6 + 0.6 * sin(T * 3 + hsh[i] * 30)) * 0.012;      // brillo de partícula flotando
          tx += sin(T * 2.3 + hsh[i] * 50) * sh; ty += sin(T * 2.9 + hrn[i] * 50) * sh;
          if (fo > 0) { tx += (hrn[i] - 0.5) * fo * 0.25; ty += (hsh[i] * 0.6) * fo * 0.18; }   // al esfumarse se dispersa un poco hacia arriba
  
          if (H_.fresh) { hpx[i] = tx; hpy[i] = ty; hpz[i] = tz; hvx[i] = hvy[i] = hvz[i] = 0; }
          var k = 16, cd = 6.2;
          hvx[i] += (k * (tx - hpx[i]) - cd * (hvx[i] - cvx)) * dt;       // amortigua respecto al corazón que sube (sin cola)
          hvy[i] += (k * (ty - hpy[i]) - cd * (hvy[i] - cvy)) * dt;
          hvz[i] += (k * (tz - hpz[i]) - cd * hvz[i]) * dt;
          hpx[i] += hvx[i] * dt; hpy[i] += hvy[i] * dt; hpz[i] += hvz[i] * dt;
          var spd = sqrt(hvx[i] * hvx[i] + hvy[i] * hvy[i]);
  
          var al = born ? 0 : (1.05 - 0.2 * m) * fi * (1 - fo) * hVis * fadeIn * (1 + Math.min(1.5, spd * 0.5));
          var lt = 0.25 * m * hsh[i];                                       // la frase se aclara un poco hacia rosa para leerse mejor
          buf[o] = hpx[i]; buf[o + 1] = hpy[i]; buf[o + 2] = hpz[i];
          buf[o + 3] = 3.0 + 1.0 * hrn[i] + 0.9 * m;
          buf[o + 4] = al;
          buf[o + 5] = 0; buf[o + 6] = 0;
          buf[o + 7] = Math.min(1, hcol[0] + lt); buf[o + 8] = Math.min(1, hcol[1] + lt * 1.6); buf[o + 9] = Math.min(1, hcol[2] + lt * 1.3); buf[o + 10] = 1;
          o += STRIDE;
        }
        H_.fresh = false;
      }
      return o;
    }
  
    /* ---------------------------------------------------------
       6. CÁMARA Y LAYOUT
    --------------------------------------------------------- */
    var FOV = 38 * PI / 180, TILT = 11 * PI / 180;
    var cssW = 1, cssH = 1, dpr = 1, aspect = 1, camDist = 5, tanH = Math.tan(FOV / 2);
    var P_, VIEW, VP, camEye = [0, 0, 5];
  
    function projectPt(x, y, z) {
      var m = VP;
      var cxp = m[0] * x + m[4] * y + m[8] * z + m[12];
      var cyp = m[1] * x + m[5] * y + m[9] * z + m[13];
      var cwp = m[3] * x + m[7] * y + m[11] * z + m[15];
      return [(cxp / cwp * 0.5 + 0.5) * cssW, (1 - (cyp / cwp * 0.5 + 0.5)) * cssH];
    }
  
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssW = window.innerWidth; cssH = window.innerHeight;
      canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      aspect = cssW / cssH;
  
      /* Encuadre: que quepan siempre el corazón, el disco y el texto */
      var HV = 2.0, HH = 1.34, lookY = 0.0;
      camDist = Math.max(HV / tanH, HH / (tanH * aspect));
      camEye = [0, lookY + camDist * sin(TILT), camDist * cos(TILT)];
      P_ = perspective(FOV, aspect, 0.1, 60);
      var v = lookAt(camEye, [0, lookY, 0], [0, 1, 0]);
      VIEW = v; VP = mul(P_, v.m);
  
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      layoutTitle();
    }
  
    function layoutTitle() {
      var top = projectPt(0, 1.06, 0)[1];
      var wL = projectPt(-1.08, 0, 0)[0], wR = projectPt(1.08, 0, 0)[0];
      var heartW = Math.abs(wR - wL), st = titleEl.style;
  
      /* 1) tamaño ideal en UNA línea */
      st.whiteSpace = 'nowrap'; st.width = 'auto'; st.fontSize = '100px';
      var w100 = titleEl.offsetWidth || 400;
      var fs1 = 100 * Math.min(heartW * 0.86, cssW * 0.9) / w100;
      var fs;
      if (fs1 >= 36) {
        fs = clamp(fs1, 18, 160);                            // texto corto: una sola línea, como antes
        st.fontSize = fs + 'px';
      } else {
        /* 2) texto largo: se parte en varias líneas dentro del ancho de la pantalla */
        var boxW = Math.min(cssW * 0.92, Math.max(heartW * 1.2, 260));
        st.whiteSpace = 'normal'; st.width = boxW + 'px'; st.textAlign = 'center';
        fs = Math.min(54, Math.max(26, cssW * 0.075));
        st.fontSize = fs + 'px';
        while (fs > 17 && (titleEl.offsetHeight > fs * 1.15 * 3 + 6 || titleEl.scrollWidth > boxW + 2)) {   // máximo 3 líneas
          fs *= 0.94; st.fontSize = fs + 'px';
        }
      }
      var h = titleEl.offsetHeight;
      var y = top - h - fs * 0.12;
      st.top = Math.max(8, y) + 'px';
    }
  
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 150); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutTitle);
  
    /* ---------------------------------------------------------
       7. ENTRADA (mouse / dedo / música)
    --------------------------------------------------------- */
    var ptr = { on: false, nx: 0, ny: 0, lx: 0, ly: 0, lz: 0 };
  
    function setPtr(e) {
      ptr.on = true;
      ptr.nx = (e.clientX / cssW) * 2 - 1;
      ptr.ny = 1 - (e.clientY / cssH) * 2;
    }
    /* --- Música: pon tu archivo en assets/audio/ con el nombre "musica.mp3"
           (también se aceptan musica.m4a, musica.ogg, musica.wav) --- */
    var audio = null, audioStarted = false, wantAudio = false;
    function startAudio() {
      wantAudio = true;
      if (!audio || audioStarted) return;
      audioStarted = true;
      var a = audio, p = a.play();
      if (p && p.then) p.then(function () { hintEl.hidden = true; }, function () { if (audio === a) audioStarted = false; });   // si el navegador lo rechaza, se reintenta en el siguiente toque
      else hintEl.hidden = true;
    }
    (function initMusic() {
      if (!CFG.music) return;
      var main = String(Array.isArray(CFG.music) ? CFG.music[0] : CFG.music);
      var base = main.replace(/\.[^.\/\\]+$/, '');
      var list = Array.isArray(CFG.music) ? CFG.music.slice() : [main];
      ['mp3', 'Mp3', 'MP3', 'm4a', 'M4A', 'ogg', 'OGG', 'wav', 'WAV'].forEach(function (e) { if (list.indexOf(base + '.' + e) < 0) list.push(base + '.' + e); });   // acepta también mayúsculas (GitHub/Linux las distinguen)
      var idx = 0;
      (function next() {
        if (idx >= list.length) { audio = null; hintEl.hidden = true; return; }
        var a = new Audio(), t;
        a.loop = true; a.preload = 'auto'; a.volume = clamp(CFG.musicVolume, 0, 1);
        audio = a;
        function show() { clearTimeout(t); if (audio === a && !audioStarted) hintEl.hidden = false; }
        t = setTimeout(show, 1500);                       // iOS no carga hasta el primer toque
        a.addEventListener('canplay', show);
        a.addEventListener('loadedmetadata', function () { if (audio === a) buildLY(); });   // ya se sabe cuánto dura -> reestimar tiempos
        a.addEventListener('error', function () {         // no existe ese archivo -> probar el siguiente
          clearTimeout(t);
          if (audio === a) { audio = null; hintEl.hidden = true; audioStarted = false; }
          idx++; next();
          if (wantAudio) startAudio();
        });
        a.src = list[idx];
      })();
    })();
  
  
    /* --- Modo "grabar tiempos" (tecla G) ---
       Sirve para marcar en qué segundo empieza cada línea de js/letra.js.
       Se usa escuchando la canción y pulsando ESPACIO cuando empieza cada línea. --- */
    (function initRecorder() {
      var box = document.createElement('div');
      box.style.cssText = 'position:fixed;left:12px;bottom:12px;max-width:min(560px,92vw);padding:12px 14px;border-radius:10px;' +
        'background:rgba(8,16,36,.92);border:1px solid rgba(90,160,255,.4);color:#cfe3ff;font:14px/1.45 system-ui,sans-serif;z-index:30;display:none;touch-action:auto;user-select:text;-webkit-user-select:text';
      document.body.appendChild(box);
      var on = false, k = 0, out = [], L = [];
      function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
      function show(h) { box.innerHTML = h; box.style.display = 'block'; }
      function names() { return lyricSource().map(function (e) { return e.text; }).filter(Boolean); }
      function draw() {
        show('<b>GRABANDO ' + (k + 1) + ' / ' + L.length + '</b> &nbsp; (' + audio.currentTime.toFixed(1) + ' s)<br>' +
             'Pulsa <b>ESPACIO</b> justo cuando empiece a cantarse:<br><span style="font-size:19px;color:#fff">' + esc(L[k]) +
             '</span><br><small>Backspace = volver a marcar la anterior · Esc = terminar</small>');
      }
      function finish() {
        on = false; recOn = false;
        var rest = L.slice(out.length).map(function (t) { return '  ' + JSON.stringify(t); });
        var code = 'window.LETRA = [\n' + out.map(function (e) { return '  { t: ' + e.t + ', text: ' + JSON.stringify(e.text) + ' }'; }).concat(rest).join(',\n') + '\n];\n';
        show('<b>Listo.</b> Copia todo esto y pégalo en <b>js/letra.js</b> (reemplazando lo que haya):<br>' +
             '<textarea readonly style="width:100%;height:150px;margin-top:6px;background:#050a18;color:#bcd8ff;border:1px solid #345;border-radius:6px;font:12px/1.4 monospace"></textarea>' +
             '<br><small>Ya se copió al portapapeles si el navegador lo permitió. Recarga la página para ver el resultado.</small>');
        box.querySelector('textarea').value = code;
        console.log(code);
        try { navigator.clipboard.writeText(code); } catch (e) {}
      }
      function start() {
        L = names();
        if (!L.length) { show('Primero escribe las líneas de la canción en <b>js/letra.js</b> y vuelve a pulsar <b>G</b>.'); return; }
        if (!audio) { show('No encuentro la música en <b>assets/audio/</b> (musica.mp3). Ponla y recarga.'); return; }
        on = true; recOn = true; k = 0; out = [];
        audio.currentTime = 0; audioStarted = true; hintEl.hidden = true;
        var pr = audio.play(); if (pr && pr.catch) pr.catch(function () {});
        draw();
      }
      setInterval(function () { if (on) draw(); }, 200);
      window.addEventListener('keydown', function (e) {
        if (e.target && e.target.tagName === 'TEXTAREA') return;
        if (!on) { if (e.key === 'g' || e.key === 'G') start(); return; }
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); out.push({ t: +audio.currentTime.toFixed(2), text: L[k] }); k++; if (k >= L.length) finish(); else draw(); }
        else if (e.key === 'Backspace') { e.preventDefault(); if (k > 0) { k--; out.pop(); draw(); } }
        else if (e.key === 'Escape') finish();
      });
    })();
  
    window.addEventListener('pointermove', function (e) { if (CFG.interactive) setPtr(e); });
    window.addEventListener('pointerdown', function (e) {
      if (CFG.interactive) setPtr(e);
      startAudio();
      if (clockT0 < 0) clockT0 = T;
      if (CFG.interactive) {
        if (state === 'hold' && T - stateT0 > 1.0) { state = 'burst'; stateT0 = T; requestMorph(); }
        else if (state === 'burst' && T - stateT0 < 0.8) requestMorph();      // toque justo al empezar un remolino
      }
    });
    window.addEventListener('pointerup', function (e) { if (e.pointerType === 'touch') ptr.on = false; });
    window.addEventListener('pointerleave', function () { ptr.on = false; });
    document.addEventListener('mouseleave', function () { ptr.on = false; });
    window.addEventListener('keydown', startAudio);
    window.addEventListener('pointerup', startAudio);      // en el celular el permiso de audio llega al levantar el dedo
    window.addEventListener('touchend', startAudio, { passive: true });
    window.addEventListener('click', startAudio);
  
    /* ---------------------------------------------------------
       8. ESTADO Y SIMULACIÓN
    --------------------------------------------------------- */
    var T = 0, state = 'intro', stateT0 = 0, bGlobal = 0;
    function requestMorph() {
      if (seq.length < 2 || pending !== null) return;
      if (seqIdx >= seq.length - 1 && !CFG.loopShapes) return;       // el rostro es la última figura
      pending = (seqIdx + 1) % seq.length;
      if (tapEl) tapEl.hidden = true;
      tapShown = false; tapDone = true;
    }
    var tapShown = false, tapDone = false;
    var col1 = hex(CFG.colors.main), col2 = hex(CFG.colors.highlight);
  
    /* Parámetros físicos */
    var K_BASE = 10.0, K_BURST = 3.0;
    var C_BASE = 5.6, C_BURST = 2.0;
    var SWIRL = 2.3, LIFT = 1.2, TURB = 1.6, OUT = 0.22;
  
    function updateState() {
      if (state === 'intro' && T >= INTRO_END) { state = 'hold'; stateT0 = T; }
      else if (state === 'hold' && T - stateT0 >= ((TGT && TGT.hold) || CFG.cycle.hold)) { state = 'burst'; stateT0 = T; }
      else if (state === 'burst' && T - stateT0 >= CFG.cycle.burst) { state = 'hold'; stateT0 = T; }
  
      if (!tapShown && !tapDone && state === 'hold' && tapEl && CFG.tapHint && seq.length > 1) { tapEl.textContent = CFG.tapHint; tapEl.hidden = false; tapShown = true; }
      bGlobal = 0;
      if (state === 'burst') {
        var tau = T - stateT0, B = CFG.cycle.burst;
        var up = Math.min(1.5, B * 0.24), down = Math.min(2.9, B * 0.42);
        if (pending !== null && tau >= up * 0.85) { seqIdx = pending; pending = null; applyShape(seq[seqIdx], false); }
        if (tau < up) bGlobal = smooth(tau / up);
        else if (tau < B - down) bGlobal = 1;
        else bGlobal = 1 - smooth((tau - (B - down)) / down);
      }
    }
  
    var rotAngle = 0;
  
    function tick(dt) {
      T += dt;
      updateState();
      var b = bGlobal;
  
      /* el "look" de la figura actual (tamaño, brillo, vibración...) se suaviza al cambiar de figura */
      var kL = Math.min(1, dt * 1.6);
      LOOK.pulse += (TGT.pulse - LOOK.pulse) * kL; LOOK.jit += (TGT.jit - LOOK.jit) * kL;
      LOOK.size += (TGT.size - LOOK.size) * kL;   LOOK.flat += (TGT.flat - LOOK.flat) * kL;
      LOOK.rot += (TGT.rot - LOOK.rot) * kL;      LOOK.halo += (TGT.halo - LOOK.halo) * kL;
      LOOK.gain += (TGT.gain - LOOK.gain) * kL;    LOOK.colw += (TGT.colw - LOOK.colw) * kL;
  
      /* rotación del conjunto */
      rotAngle = CFG.rotate ? (sin(T * 0.32) * 0.42 + b * sin(T * 0.9) * 0.25) * LOOK.rot : 0;
  
      /* puntero -> espacio local del corazón */
      var pOn = false, plx = 0, ply = 0, plz = 0;
      if (CFG.interactive && ptr.on && T > INTRO_END * 0.7) {
        var rx = VIEW.f[0] + VIEW.r[0] * ptr.nx * tanH * aspect + VIEW.u[0] * ptr.ny * tanH;
        var ry = VIEW.f[1] + VIEW.r[1] * ptr.nx * tanH * aspect + VIEW.u[1] * ptr.ny * tanH;
        var rz = VIEW.f[2] + VIEW.r[2] * ptr.nx * tanH * aspect + VIEW.u[2] * ptr.ny * tanH;
        if (Math.abs(rz) > 1e-4) {
          var tt0 = -camEye[2] / rz;
          var wx = camEye[0] + rx * tt0, wy = camEye[1] + ry * tt0;
          var ca = cos(-rotAngle), sa = sin(-rotAngle);
          plx = wx * ca; plz = -wx * sa; ply = wy; pOn = true;
        }
      }
  
      var S = 1 + LOOK.pulse * sin(T * 2.4);                  // latido
      var fadeIn = smooth(T / 0.9);
      var o = 0, i;
      var jit = LOOK.jit;
  
      /* ------- corazón ------- */
      for (i = 0; i < N; i++) {
        var p_ = ph[i], aFac, mixAdd = 0, spd = 0;
        var tt = (T - dl[i]) / du[i];
  
        if (tt < 1) {
          /* INTRO: bezier disco -> columna -> corazón con giro en espiral */
          var e = tt <= 0 ? 0 : easeIO(tt), ie = 1 - e;
          var a0 = ie * ie, b0 = 2 * ie * e, c0 = e * e;
          var x = a0 * p0x[i] + b0 * cx[i] + c0 * hx[i] * S;
          var y = a0 * p0y[i] + b0 * cy[i] + c0 * hy[i] * S;
          var z = a0 * p0z[i] + b0 * cz[i] + c0 * hz[i] * S;
          var an = spin[i] * ie * ie + T * orb[i] * ie;
          var ca2 = cos(an), sa2 = sin(an);
          var xr = x * ca2 - z * sa2, zr = x * sa2 + z * ca2;
          var wob = b0 * 0.06;
          px[i] = xr + sin(T * 3 + p_ * 40) * wob;
          py[i] = y;
          pz[i] = zr + cos(T * 2.6 + p_ * 55) * wob;
          vx[i] = 0; vy[i] = 0; vz[i] = 0;
          aFac = (tt <= 0 ? 0.5 : 0.35 + 0.5 * e) * (1 + 0.5 * ie * ie);
          mixAdd = 0.35 * ie;
          spd = 0;
        } else {
          /* FÍSICA: resorte hacia el corazón + fuerzas del remolino */
          var bi = clamp(b * (0.30 + 0.85 * wb[i]), 0, 1);
          var k = lerp(K_BASE, K_BURST, bi) * kv[i];
          var c = lerp(C_BASE, C_BURST, bi);
  
          var tx = hx[i] * S + sin(T * (0.8 + p_ * 1.4) + p_ * 37) * jit;
          var ty = hy[i] * S + sin(T * (0.9 + p_ * 1.1) + p_ * 91) * jit;
          var tz = hz[i] * S + cos(T * (1.0 + p_ * 1.2) + p_ * 53) * jit;
  
          var X = px[i], Y = py[i], Z = pz[i];
          var ax = k * (tx - X) - c * vx[i];
          var ay = k * (ty - Y) - c * vy[i];
          var az = k * (tz - Z) - c * vz[i];
  
          if (bi > 0.001) {
            var rxz = sqrt(X * X + Z * Z) + 0.22;
            var sw = SWIRL * bi * (0.6 + 0.8 * wb[i]);
            ax += -Z / rxz * sw; az += X / rxz * sw;
            ay += LIFT * bi * (0.35 + sin(T * 1.7 + p_ * 50) * 0.65) * (0.3 + wb[i]);
            ax += sin(Y * 2.3 + T * 2.1 + p_ * 6.28) * TURB * bi;
            ay += sin(Z * 2.1 + T * 1.7 + p_ * 17) * TURB * bi * 0.6;
            az += cos(X * 2.5 - T * 1.9 + p_ * 11) * TURB * bi;
            ax += X / rxz * OUT * bi; az += Z / rxz * OUT * bi;
          }
  
          if (pOn) {
            var dx = X - plx, dy = Y - ply, dz = Z - plz;
            var d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < 0.2) {
              var d = sqrt(d2) + 0.001, f = (1 - d / 0.447); f = f * f * 55;
              ax += dx / d * f; ay += dy / d * f; az += dz / d * f;
            }
          }
  
          vx[i] += ax * dt; vy[i] += ay * dt; vz[i] += az * dt;
          spd = sqrt(vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i]);
          if (spd > 4) { var sc = 4 / spd; vx[i] *= sc; vy[i] *= sc; vz[i] *= sc; spd = 4; }
          X += vx[i] * dt; Y += vy[i] * dt; Z += vz[i] * dt;
          if (Y < FLOOR_Y) { Y = FLOOR_Y; vy[i] = Math.abs(vy[i]) * 0.3; }
          px[i] = X; py[i] = Y; pz[i] = Z;
  
          aFac = 0.62 + 0.38 * sin(T * (1.6 + p_ * 3.2) + p_ * 20);        // centelleo
        }
  
        var boost = 1 + Math.min(4.6, spd * 2.3);
        buf[o] = px[i]; buf[o + 1] = py[i]; buf[o + 2] = pz[i];
        buf[o + 3] = sz[i] * LOOK.size * (1 + 0.25 * Math.min(1, spd));
        buf[o + 4] = (al[i] + (0.62 - al[i]) * LOOK.flat) * tal[i] * LOOK.gain * aFac * boost * fadeIn;
        buf[o + 5] = Math.min(1, tmx[i] + mixAdd + spd * 0.35);
        buf[o + 6] = 0;
        buf[o + 7] = tcr[i]; buf[o + 8] = tcg[i]; buf[o + 9] = tcb[i]; buf[o + 10] = LOOK.colw;
        o += STRIDE;
      }
  
      /* halos suaves del corazón (reusan las primeras NH partículas) */
      for (i = 0; i < NH; i++) {
        var sp2 = sqrt(vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i]);
        buf[o] = px[i]; buf[o + 1] = py[i]; buf[o + 2] = pz[i];
        buf[o + 3] = 22 + sz[i] * 1.5;
        buf[o + 4] = 0.045 * LOOK.halo * fadeIn * (1 + Math.min(2, sp2));
        buf[o + 5] = 0.25;
        buf[o + 6] = 1;
        buf[o + 7] = tcr[i]; buf[o + 8] = tcg[i]; buf[o + 9] = tcb[i]; buf[o + 10] = LOOK.colw;
        o += STRIDE;
      }
  
      /* ------- anillo ------- */
      var Rr = lerp(RING_R0, RING_R1, easeIO(T / 4.6)) * (1 + 0.10 * b);
      var ringGain = (0.35 + 0.65 * smooth(T / 3.6)) * (1 + 0.45 * b) * fadeIn;
      var j, thv, ox, oz, oy, rad, lin, bst;
      for (j = 0; j < NR; j++) {
        rad = Rr * rr_[j];
        lin = om[j] * (1 + b * 1.3) * rad;
        bst = 1 + Math.min(2.2, lin * 0.9);
        oy = FLOOR_Y + (rph[j] - 0.5) * 0.02 + 0.012 * sin(T * 3 + rph[j] * 30);
        var al_ = ral[j] * ringGain * bst;
        var mm = Math.min(1, rmx[j] + b * 0.25);
        var step = om[j] * (1 + b * 1.3) * dt;
        th[j] += step;
        thv = th[j];
        ox = rad * cos(thv); oz = rad * sin(thv);
        buf[o] = ox; buf[o + 1] = oy; buf[o + 2] = oz; buf[o + 3] = rsz[j]; buf[o + 4] = al_; buf[o + 5] = mm; buf[o + 6] = 0; o += STRIDE;
        thv = th[j] - step * 0.5;
        ox = rad * cos(thv); oz = rad * sin(thv);
        buf[o] = ox; buf[o + 1] = oy; buf[o + 2] = oz; buf[o + 3] = rsz[j]; buf[o + 4] = al_; buf[o + 5] = mm; buf[o + 6] = 0; o += STRIDE;
      }
      var nHaze = NRH - 16;
      for (j = 0; j < nHaze; j++) {
        rad = Rr * rr_[j];
        thv = th[j];
        buf[o] = rad * cos(thv); buf[o + 1] = FLOOR_Y; buf[o + 2] = rad * sin(thv);
        buf[o + 3] = 30 + rsz[j] * 4;
        buf[o + 4] = 0.12 * ringGain;
        buf[o + 5] = 0.2; buf[o + 6] = 1; o += STRIDE;
      }
      /* núcleo brillante del disco */
      for (j = 0; j < 16; j++) {
        var ga = j * 2.4 + T * 0.5, gr = Rr * 0.38 * ((j % 4) / 4);
        buf[o] = gr * cos(ga); buf[o + 1] = FLOOR_Y; buf[o + 2] = gr * sin(ga);
        buf[o + 3] = 95 * Rr + 20;
        buf[o + 4] = 0.11 * ringGain * (1 + 0.5 * b);
        buf[o + 5] = 0.22; buf[o + 6] = 1; o += STRIDE;
      }
  
      /* letra (partículas blancas bajo el rostro) */
      if (NL) o = lyStep(dt, o, fadeIn);
  
      /* corazones rojos que suben y forman "Te amo" */
      if (NHR) o = heartsStep(dt, o, fadeIn);
    }
  
    /* ---------------------------------------------------------
       9. DIBUJO
    --------------------------------------------------------- */
  
    function render(dt) {
      /* persistencia: cuanto menor el 'fade', más largas las estelas */
      var introAmt = state === 'intro' ? 1 - smooth((T - 3.6) / 1.8) : 0;
      var fade60 = lerp(lerp(0.24, 0.085, bGlobal), 0.5, introAmt);
      var fade = 1 - Math.pow(1 - fade60, clamp(dt, 0.004, 0.1) * 60);
  
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
  
      /* 1) desvanecer lo anterior (multiplica por 1-fade) */
      gl.useProgram(progQ);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.enableVertexAttribArray(AQ);
      gl.vertexAttribPointer(AQ, 2, gl.FLOAT, false, 0, 0);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform4f(UQ.c, 0, 0, 0, fade);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      /* 2) restar un mínimo para que no queden "fantasmas" por redondeo de 8 bits */
      gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniform4f(UQ.c, 2 / 255, 2 / 255, 2 / 255, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.blendEquation(gl.FUNC_ADD);
      gl.disableVertexAttribArray(AQ);
  
      /* 3) partículas (suma de luz) */
      gl.useProgram(progP);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, buf);
      gl.enableVertexAttribArray(A.pos);
      gl.vertexAttribPointer(A.pos, 3, gl.FLOAT, false, STRIDE * 4, 0);
      gl.enableVertexAttribArray(A.data);
      gl.vertexAttribPointer(A.data, 4, gl.FLOAT, false, STRIDE * 4, 12);
      gl.enableVertexAttribArray(A.col);
      gl.vertexAttribPointer(A.col, 4, gl.FLOAT, false, STRIDE * 4, 28);
  
      var MVP = mul(VP, rotY(rotAngle));
      gl.uniformMatrix4fv(U.mvp, false, MVP);
      /* escala de partículas según los píxeles reales por unidad de mundo (211 = referencia de diseño) */
      gl.uniform1f(U.px, (canvas.height / (2 * tanH * camDist)) / 211);
      gl.uniform1f(U.dist, camDist);
      gl.uniform1f(U.maxPt, maxPt);
      gl.uniform3f(U.c1, col1[0], col1[1], col1[2]);
      gl.uniform3f(U.c2, col2[0], col2[1], col2[2]);
      gl.uniform1f(U.gain, fade * 1.0 * CFG.glow * 1.25);
  
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, TOTAL - NL - NHR);           // figura + disco (giran con la escena)
      if (NL + NHR) {                                          // letra y corazones no giran: se dibujan con la cámara fija
        gl.uniformMatrix4fv(U.mvp, false, VP);
        gl.drawArrays(gl.POINTS, TOTAL - NL - NHR, NL + NHR);
      }
      gl.disableVertexAttribArray(A.pos);
      gl.disableVertexAttribArray(A.data);
      gl.disableVertexAttribArray(A.col);
    }
  
    /* ---------------------------------------------------------
       10. BUCLE
    --------------------------------------------------------- */
    var last = 0, running = true;
    function frame(now) {
      if (!running) return;
      requestAnimationFrame(frame);
      var dt = last ? (now - last) / 1000 : 1 / 60;
      last = now;
      if (!(dt > 0)) dt = 1 / 60;
      dt = Math.min(dt, 1 / 30);
      tick(dt);
      render(dt);
    }
  
    document.addEventListener('visibilitychange', function () { last = 0; });
  
    resize();
  
    /* Para pruebas: ?debug en la URL expone control manual del tiempo */
    window.HeartScene = {
      step: function (seconds, fps) {
        fps = fps || 30; var n = Math.round(seconds * fps), d = 1 / fps;
        for (var q = 0; q < n; q++) { tick(d); render(d); }
      },
      stop: function () { running = false; },
      get time() { return T; },
      get state() { return state; },
      burst: function () { state = 'burst'; stateT0 = T; },
      next: function () { if (clockT0 < 0) clockT0 = T; if (state === 'hold') { state = 'burst'; stateT0 = T; } requestMorph(); },
      get lyric() { return lyIdx; },
      get letra() { return LY; },
      get shape() { return seq[seqIdx]; }
    };
  
    requestAnimationFrame(frame);
  })();
  
