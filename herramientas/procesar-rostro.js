/* ==========================================================
   procesar-rostro.js
   Convierte una foto (píxeles RGBA) en un mapa de densidad
   para que las partículas dibujen el rostro.

   Entrada : rgba (Uint8ClampedArray/Uint8Array), w, h, opciones
   Salida  : { w, h, aspect, data (RGBA: color real + densidad en alfa), base64 }

   - Quita el fondo (supone fondo liso y claro/uniforme)
   - Recorta cabeza + cuello en forma de busto
   - Realza el contraste local (ojos, cejas, labios)
   ========================================================== */
(function (root) {
  'use strict';

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

  /* Reduce la imagen promediando bloques (rápido y suficiente) */
  function downscale(rgba, w, h, tw) {
    var f = w / tw, th = Math.round(h / f), out = new Float32Array(tw * th * 3), x, y, i, j;
    for (y = 0; y < th; y++) {
      var y0 = Math.floor(y * f), y1 = Math.max(y0 + 1, Math.floor((y + 1) * f));
      for (x = 0; x < tw; x++) {
        var x0 = Math.floor(x * f), x1 = Math.max(x0 + 1, Math.floor((x + 1) * f));
        var r = 0, g = 0, b = 0, n = 0;
        for (j = y0; j < y1 && j < h; j++) for (i = x0; i < x1 && i < w; i++) {
          var p = (j * w + i) * 4; r += rgba[p]; g += rgba[p + 1]; b += rgba[p + 2]; n++;
        }
        var o = (y * tw + x) * 3; out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
      }
    }
    return { px: out, w: tw, h: th };
  }

  function boxBlur(src, w, h, r) {
    var tmp = new Float32Array(w * h), out = new Float32Array(w * h), x, y, k, s, n;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      s = 0; n = 0;
      for (k = -r; k <= r; k++) { var xx = x + k; if (xx >= 0 && xx < w) { s += src[y * w + xx]; n++; } }
      tmp[y * w + x] = s / n;
    }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      s = 0; n = 0;
      for (k = -r; k <= r; k++) { var yy = y + k; if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; n++; } }
      out[y * w + x] = s / n;
    }
    return out;
  }

  /* Máscara del sujeto: distancia de color al fondo estimado en los bordes */
  function subjectMask(img, thrMul) {
    var w = img.w, h = img.h, px = img.px, x, y, o;
    var samples = [];
    var mx = Math.round(w * 0.08), my = Math.round(h * 0.30);
    for (y = 0; y < my; y++) for (x = 0; x < mx; x++) {
      samples.push((y * w + x) * 3); samples.push((y * w + (w - 1 - x)) * 3);
    }
    var mr = 0, mg = 0, mb = 0;
    samples.forEach(function (s) { mr += px[s]; mg += px[s + 1]; mb += px[s + 2]; });
    mr /= samples.length; mg /= samples.length; mb /= samples.length;
    var sd = 0;
    samples.forEach(function (s) {
      sd += Math.pow(px[s] - mr, 2) + Math.pow(px[s + 1] - mg, 2) + Math.pow(px[s + 2] - mb, 2);
    });
    sd = Math.sqrt(sd / samples.length);
    var thr = Math.max(34, sd * 3) * (thrMul || 1);

    var m = new Float32Array(w * h);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      o = (y * w + x) * 3;
      var d = Math.sqrt(Math.pow(px[o] - mr, 2) + Math.pow(px[o + 1] - mg, 2) + Math.pow(px[o + 2] - mb, 2));
      m[y * w + x] = d > thr ? 1 : 0;
    }
    /* limpiar: cierre + componente mayor + rellenar huecos */
    m = boxBlur(m, w, h, 2); for (var i = 0; i < m.length; i++) m[i] = m[i] > 0.5 ? 1 : 0;

    var lab = new Int32Array(w * h), best = 0, bestN = 0, cur = 0, stack = [];
    for (i = 0; i < m.length; i++) {
      if (!m[i] || lab[i]) continue;
      cur++; var n = 0; stack.push(i); lab[i] = cur;
      while (stack.length) {
        var q = stack.pop(); n++;
        var qx = q % w, qy = (q / w) | 0;
        if (qx > 0 && m[q - 1] && !lab[q - 1]) { lab[q - 1] = cur; stack.push(q - 1); }
        if (qx < w - 1 && m[q + 1] && !lab[q + 1]) { lab[q + 1] = cur; stack.push(q + 1); }
        if (qy > 0 && m[q - w] && !lab[q - w]) { lab[q - w] = cur; stack.push(q - w); }
        if (qy < h - 1 && m[q + w] && !lab[q + w]) { lab[q + w] = cur; stack.push(q + w); }
      }
      if (n > bestN) { bestN = n; best = cur; }
    }
    for (i = 0; i < m.length; i++) m[i] = lab[i] === best ? 1 : 0;

    /* rellenar huecos: lo que no se alcanza desde el borde del fondo es sujeto */
    var bg = new Uint8Array(w * h); stack = [];
    for (x = 0; x < w; x++) { stack.push(x); stack.push((h - 1) * w + x); }
    for (y = 0; y < h; y++) { stack.push(y * w); stack.push(y * w + w - 1); }
    while (stack.length) {
      var s = stack.pop();
      if (bg[s] || m[s]) continue;
      bg[s] = 1;
      var sx = s % w, sy = (s / w) | 0;
      if (sx > 0) stack.push(s - 1); if (sx < w - 1) stack.push(s + 1);
      if (sy > 0) stack.push(s - w); if (sy < h - 1) stack.push(s + w);
    }
    for (i = 0; i < m.length; i++) m[i] = bg[i] ? 0 : 1;
    return m;
  }

  function procesarRostro(rgba, w, h, opt) {
    opt = opt || {};
    var OW = opt.ancho || 170;
    var contraste = opt.contraste == null ? 1 : opt.contraste;

    var img = downscale(rgba, w, h, Math.min(w, 320));
    var W = img.w, H = img.h, px = img.px, x, y, i;
    var mask = subjectMask(img, opt.umbral);

    /* geometría de la cabeza a partir de la máscara */
    var y0 = 0; while (y0 < H && !rowHas(y0)) y0++;
    function rowHas(r) { for (var k = 0; k < W; k++) if (mask[r * W + k]) return true; return false; }
    var rowY = Math.min(H - 1, Math.round(y0 + 0.25 * (H - y0)));
    var xa = -1, xb = -1;
    for (x = 0; x < W; x++) if (mask[rowY * W + x]) { if (xa < 0) xa = x; xb = x; }
    var headW = (xb - xa + 1), cxh = (xa + xb) / 2;
    var A = 0.635 * headW, B = 0.904 * headW, cyh = y0 + 0.70 * headW;

    var OH = Math.round(OW * B / A);
    var lum = new Float32Array(OW * OH), m = new Float32Array(OW * OH), cols = new Float32Array(OW * OH * 3);

    function sample(arr, ch, fx, fy) {
      fx = clamp(fx, 0, W - 1.001); fy = clamp(fy, 0, H - 1.001);
      var ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy;
      function g(a, b) { return ch < 0 ? arr[b * W + a] : arr[(b * W + a) * 3 + ch]; }
      return (g(ix, iy) * (1 - tx) + g(ix + 1, iy) * tx) * (1 - ty) + (g(ix, iy + 1) * (1 - tx) + g(ix + 1, iy + 1) * tx) * ty;
    }
    /* erosionar 1 px la máscara para que no entre el fondo claro del borde */
    var er = new Float32Array(W * H);
    for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) {
      var q = y * W + x;
      er[q] = Math.min(mask[q], mask[q - 1], mask[q + 1], mask[q - W], mask[q + W]);
    }
    var maskS = boxBlur(er, W, H, 1);

    for (y = 0; y < OH; y++) for (x = 0; x < OW; x++) {
      var nx = (x + 0.5) / OW * 2 - 1, ny = (y + 0.5) / OH * 2 - 1;
      var fx = cxh + nx * A, fy = cyh + ny * B;
      var r = Math.sqrt(nx * nx + ny * ny);
      var e = 1 - smooth((r - 0.80) / 0.20);              // borde suave del busto
      var mm = clamp((sample(maskS, -1, fx, fy) - 0.35) * 2.2, 0, 1) * e;
      var R = sample(px, 0, fx, fy), G = sample(px, 1, fx, fy), Bc = sample(px, 2, fx, fy);
      lum[y * OW + x] = (0.299 * R + 0.587 * G + 0.114 * Bc) / 255;
      cols[(y * OW + x) * 3] = R / 255; cols[(y * OW + x) * 3 + 1] = G / 255; cols[(y * OW + x) * 3 + 2] = Bc / 255;
      m[y * OW + x] = mm;
    }

    /* estiramiento de contraste usando solo los píxeles del sujeto */
    var vals = [];
    for (i = 0; i < lum.length; i++) if (m[i] > 0.5) vals.push(lum[i]);
    vals.sort(function (a, b) { return a - b; });
    var lo = vals[Math.floor(vals.length * 0.03)] || 0, hi = vals[Math.floor(vals.length * 0.97)] || 1;
    var st = new Float32Array(lum.length);
    for (i = 0; i < lum.length; i++) st[i] = m[i] > 0.02 ? clamp((lum[i] - lo) / Math.max(0.05, hi - lo), 0, 1) : 0.25;

    /* realce local (unsharp) para ojos, cejas, labios, nariz */
    var bl = boxBlur(st, OW, OH, 5), data = new Uint8Array(OW * OH);
    for (i = 0; i < st.length; i++) {
      var s2 = clamp(st[i] + 1.4 * contraste * (st[i] - bl[i]), 0, 1);
      s2 = Math.pow(s2, 0.85);
      data[i] = Math.round(clamp(m[i] * (0.14 + 0.86 * s2), 0, 1) * 255);
    }

    /* Color real de la foto: se expone y se levantan las sombras para que el
       pelo oscuro no desaparezca sobre el fondo negro (el matiz se conserva). */
    var expo = 0.95 / Math.max(0.25, hi), rgba = new Uint8Array(OW * OH * 4);
    for (i = 0; i < OW * OH; i++) {
      var r = Math.pow(clamp(cols[i * 3] * expo, 0, 1), 0.8), g = Math.pow(clamp(cols[i * 3 + 1] * expo, 0, 1), 0.8), bl2 = Math.pow(clamp(cols[i * 3 + 2] * expo, 0, 1), 0.8);
      var L = 0.299 * r + 0.587 * g + 0.114 * bl2;
      r = L + (r - L) * 1.15; g = L + (g - L) * 1.15; bl2 = L + (bl2 - L) * 1.15;      // un poco más de color
      var Lm = 0.299 * r + 0.587 * g + 0.114 * bl2;
      if (Lm < 0.42) { var f = Math.min(0.42 / Math.max(Lm, 0.03), 7); r *= f; g *= f; bl2 *= f; }
      rgba[i * 4] = Math.round(clamp(r, 0, 1) * 255);
      rgba[i * 4 + 1] = Math.round(clamp(g, 0, 1) * 255);
      rgba[i * 4 + 2] = Math.round(clamp(bl2, 0, 1) * 255);
      rgba[i * 4 + 3] = data[i];                       // la densidad va en el canal alfa
    }

    var b64 = typeof Buffer !== 'undefined' ? Buffer.from(rgba).toString('base64')
      : (function () { var s2 = '', k; for (k = 0; k < rgba.length; k += 8192) s2 += String.fromCharCode.apply(null, rgba.subarray(k, k + 8192)); return btoa(s2); })();
    return { w: OW, h: OH, aspect: A / B, data: rgba, base64: b64 };
  }

  var api = { procesarRostro: procesarRostro };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RostroTools = api;
})(typeof window !== 'undefined' ? window : this);
