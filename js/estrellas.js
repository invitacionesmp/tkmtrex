/* ==========================================================
   Fondo de estrellas  –  partículas que simulan un cielo nocturno
   Dibuja en el canvas #stars (detrás del texto, sobre el fondo negro).
   Se configura en js/config.js -> stars
   ========================================================== */
(function () {
  'use strict';
  var CFG = (window.HEART_CONFIG && window.HEART_CONFIG.stars) || {};
  if (CFG.enabled === false) return;

  var cv = document.getElementById('stars');
  if (!cv) return;
  var cx = cv.getContext('2d');
  var density = CFG.density == null ? 1 : CFG.density;
  var shooting = CFG.shooting !== false;
  var rnd = Math.random, TAU = Math.PI * 2;

  var W = 1, H = 1, dpr = 1, stars = [], shots = [], nextShot = 4 + rnd() * 6, ang = 0;
  var halo = document.createElement('canvas');        // sprite del resplandor de las estrellas grandes
  halo.width = halo.height = 64;
  (function () {
    var g = halo.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  })();

  var TINTS = ['255,255,255', '255,255,255', '255,255,255', '190,215,255', '170,200,255', '255,225,200'];

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var n = Math.round(Math.max(160, Math.min(1100, (W * H) / 2200)) * density);
    stars = [];
    for (var i = 0; i < n; i++) {
      var big = rnd() < 0.05;
      stars.push({
        x: rnd(), y: rnd(),
        r: big ? 1.4 + rnd() * 1.0 : 0.55 + Math.pow(rnd(), 2.0) * 1.0,
        a: 0.45 + rnd() * 0.55,
        sp: 0.4 + rnd() * 2.2, ph: rnd() * TAU,
        tint: TINTS[(rnd() * TINTS.length) | 0],
        big: big
      });
    }
  }

  var last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
    var t = now / 1000, i, s;
    ang += dt * 0.0035;                                // el cielo gira muy despacio

    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, W, H);
    var ca = Math.cos(ang), sa = Math.sin(ang), mx = W / 2, my = H / 2, R = Math.sqrt(mx * mx + my * my);

    for (i = 0; i < stars.length; i++) {
      s = stars[i];
      var dx = (s.x - 0.5) * W * 1.45, dy = (s.y - 0.5) * H * 1.45;      // campo un poco mayor que la pantalla para que girando no queden huecos
      var X = mx + dx * ca - dy * sa, Y = my + dx * sa + dy * ca;
      if (X < -10 || X > W + 10 || Y < -10 || Y > H + 10) continue;
      var tw = 0.55 + 0.45 * Math.sin(t * s.sp + s.ph);
      var al = s.a * tw;
      if (s.big) { var hs = s.r * 9; cx.globalAlpha = al * 0.55; cx.drawImage(halo, X - hs, Y - hs, hs * 2, hs * 2); }
      cx.globalAlpha = Math.min(1, al * 1.25);
      cx.fillStyle = 'rgb(' + s.tint + ')';
      cx.beginPath(); cx.arc(X, Y, s.r, 0, TAU); cx.fill();
    }

    /* estrellas fugaces */
    if (shooting) {
      nextShot -= dt;
      if (nextShot <= 0) {
        nextShot = 7 + rnd() * 12;
        var a0 = Math.PI * (0.62 + rnd() * 0.2);
        shots.push({ x: rnd() * W * 0.8 + W * 0.1, y: rnd() * H * 0.35, vx: Math.cos(a0) * -1, vy: Math.sin(a0), sp: 520 + rnd() * 380, life: 0, max: 0.7 + rnd() * 0.5 });
      }
      for (i = shots.length - 1; i >= 0; i--) {
        var sh = shots[i]; sh.life += dt;
        if (sh.life > sh.max) { shots.splice(i, 1); continue; }
        sh.x += sh.vx * sh.sp * dt; sh.y += sh.vy * sh.sp * dt;
        var f = 1 - sh.life / sh.max, len = 90 * f + 20;
        var gx = cx.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * len, sh.y - sh.vy * len);
        gx.addColorStop(0, 'rgba(255,255,255,' + (0.9 * f) + ')'); gx.addColorStop(1, 'rgba(255,255,255,0)');
        cx.globalAlpha = 1; cx.strokeStyle = gx; cx.lineWidth = 1.6; cx.lineCap = 'round';
        cx.beginPath(); cx.moveTo(sh.x, sh.y); cx.lineTo(sh.x - sh.vx * len, sh.y - sh.vy * len); cx.stroke();
      }
    }
    cx.globalAlpha = 1;
  }

  window.addEventListener('resize', build);
  build();
  requestAnimationFrame(frame);
})();
