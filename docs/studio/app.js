/* String Art Studio – laeuft komplett im Browser. Das Foto verlaesst das Geraet erst beim Bestellen. */
(() => {
  "use strict";
  const CFG = window.STUDIO_CONFIG || {};
  const I18N = window.I18N;
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* privat/blockiert */ } },
  };

  // ------------------------------------------------------------------ Sprache
  let lang = I18N[store.get("lang")] ? store.get("lang") : "en";
  const t = (key, vars = {}) => {
    let s = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
  };
  function applyLang() {
    document.documentElement.lang = lang;
    $("lang").value = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    const link = `<a href="privacy.html" target="_blank" rel="noopener">${t("privacy")}</a>`;
    $("consent-text").innerHTML = t("consent", { privacy: link });
    if (lastCheck) showCheck(lastCheck);
    if (orderCode) $("done-text").textContent = t("order_done", { code: orderCode });
  }
  $("lang").addEventListener("change", (e) => { lang = e.target.value; store.set("lang", lang); applyLang(); });

  // ------------------------------------------------------------------ Intro: Faden spannt ein Muster
  function intro() {
    const box = $("intro");
    let seen = false;
    try { seen = sessionStorage.getItem("introSeen") === "1"; } catch { /* egal */ }
    if (seen || matchMedia("(prefers-reduced-motion: reduce)").matches) { box.remove(); return; }
    const c = $("intro-canvas");
    const size = Math.round(Math.min(innerWidth, innerHeight) * 0.86 * devicePixelRatio);
    c.width = c.height = size;
    const g = c.getContext("2d");
    const R = size * 0.42, cx = size / 2, cy = size / 2, N = 180;
    const panel = new Image();
    panel.src = "img/panel_white.jpg";
    const pts = Array.from({ length: N }, (_, i) => {
      const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
      return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
    });
    let k = 0, done = false;
    const finish = () => {
      if (done) return;
      done = true;
      box.classList.add("gone");
      try { sessionStorage.setItem("introSeen", "1"); } catch { /* egal */ }
      setTimeout(() => box.remove(), 900);
    };
    $("skip").addEventListener("click", finish);
    function base() {
      g.clearRect(0, 0, size, size);
      g.save();
      g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = size * 0.03; g.shadowOffsetX = size * 0.01; g.shadowOffsetY = size * 0.015;
      g.beginPath(); g.arc(cx, cy, R * 1.1, 0, Math.PI * 2); g.fillStyle = "#f2eee8"; g.fill();
      g.restore();
      if (panel.complete && panel.naturalWidth) {
        g.save(); g.beginPath(); g.arc(cx, cy, R * 1.1, 0, Math.PI * 2); g.clip();
        g.drawImage(panel, cx - R * 1.1, cy - R * 1.1, R * 2.2, R * 2.2); g.restore();
      }
      g.fillStyle = "#77736d";
      for (const [x, y] of pts) { g.beginPath(); g.arc(x, y, size * 0.0035, 0, Math.PI * 2); g.fill(); }
    }
    base();
    g.lineWidth = Math.max(1, size * 0.0012);
    const layers = [[2, "rgba(29,26,24,.55)"], [3, "rgba(158,43,37,.45)"]];
    function frame() {
      if (done) return;
      for (let s = 0; s < 4 && k < N * layers.length; s++, k++) {
        const [mul, col] = layers[Math.floor(k / N)];
        const i = k % N;
        const a = pts[i], b = pts[(i * mul) % N];
        g.strokeStyle = col; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      }
      if (k < N * layers.length) requestAnimationFrame(frame);
      else setTimeout(finish, 700);
    }
    panel.onload = () => { base(); };
    setTimeout(() => requestAnimationFrame(frame), 350);
  }

  // ------------------------------------------------------------------ Foto laden + pruefen
  let photo = null;      // ImageBitmap (richtig gedreht)
  let face = null;       // {x,y,w,h} oder null
  let lastCheck = null;
  let orderCode = null;

  function unlock(n) {
    for (let i = 2; i <= 5; i++) $(`step${i}`).classList.toggle("locked", i > n);
  }

  async function loadFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    photo = await createImageBitmap(file, { imageOrientation: "from-image" });
    $("thumb").src = URL.createObjectURL(file);
    face = await detectFace(photo);
    lastCheck = checkPhoto(photo, face);
    showCheck(lastCheck);
    unlock(5);
    clearPreview();
    $("step2").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("file").addEventListener("change", (e) => loadFile(e.target.files[0]));
  $("again").addEventListener("click", () => $("file").click());
  const drop = $("drop");
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => loadFile(e.dataTransfer.files[0]));

  async function detectFace(bmp) {
    try {
      if ("FaceDetector" in window) {
        const fd = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        const r = await fd.detect(bmp);
        if (r.length) { const b = r[0].boundingBox; return { x: b.x, y: b.y, w: b.width, h: b.height }; }
        return null;
      }
      const v = "0.10.14";
      const { FaceDetector, FilesetResolver } = await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${v}/vision_bundle.mjs`);
      const files = await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${v}/wasm`);
      const det = await FaceDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite" },
        runningMode: "IMAGE",
      });
      const res = det.detect(bmp);
      if (!res.detections.length) return null;
      const b = res.detections[0].boundingBox;
      return { x: b.originX, y: b.originY, w: b.width, h: b.height };
    } catch (e) {
      console.warn("Gesichtserkennung nicht verfuegbar", e);
      return undefined; // unbekannt
    }
  }

  function grayOf(bmp, sx, sy, sw, sh, w, h) {
    const c = new OffscreenCanvas(w, h);
    const g = c.getContext("2d");
    g.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    const out = new Float32Array(w * h);
    for (let i = 0; i < out.length; i++) out[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    return out;
  }
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const std = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };

  // dieselben Kriterien wie scripts/selfie_art.py (check_photo)
  function checkPhoto(bmp, f) {
    const tips = [];
    const W = bmp.width, H = bmp.height, m = Math.min(W, H);
    if (m < 600) tips.push("c_res");
    if (f === null) { tips.push("c_noface"); return tips; }
    const box = f || { x: W * 0.25, y: H * 0.2, w: W * 0.5, h: W * 0.5 };
    const faceGray = grayOf(bmp, box.x, box.y, box.w, box.h, 256, 256);
    const all = grayOf(bmp, 0, 0, W, H, 128, Math.round(128 * H / W));
    const bright = mean(faceGray), contrast = std(faceGray);
    let lap = 0; const L = [];
    for (let y = 1; y < 255; y++) for (let x = 1; x < 255; x++) {
      const i = y * 256 + x;
      L.push(faceGray[i - 1] + faceGray[i + 1] + faceGray[i - 256] + faceGray[i + 256] - 4 * faceGray[i]);
    }
    lap = std(L) ** 2;
    if (f && box.h / m < 0.25) tips.push("c_small");
    if (bright < 70) tips.push("c_dark"); else if (bright > 205) tips.push("c_bright");
    if (f && mean(all) - bright > 30) tips.push("c_back");
    if (contrast < 45) tips.push("c_flat");
    if (lap < 150) tips.push("c_blur");
    return tips;
  }

  function showCheck(tips) {
    const head = $("check-head"), list = $("check-list");
    list.innerHTML = "";
    head.className = tips.length ? "warn" : "ok";
    head.textContent = tips.length ? t("check_warn") : "✅ " + t("check_ok");
    for (const k of tips) { const li = document.createElement("li"); li.textContent = t(k); list.appendChild(li); }
  }

  // ------------------------------------------------------------------ Vorschau: Greedy-Fadenalgorithmus
  const opt = (name) => document.querySelector(`input[name="${name}"]:checked`).value;
  document.querySelectorAll('input[name="shape"],input[name="panel"]').forEach((el) => el.addEventListener("change", clearPreview));
  const panelImg = { white: new Image(), natural: new Image() };
  panelImg.white.src = "img/panel_white.jpg"; panelImg.natural.src = "img/panel_natural.jpg";
  let running = 0;

  function cropBox(bmp, f) {
    const W = bmp.width, H = bmp.height;
    let side, cx, cy;
    if (f) { side = Math.min(Math.max(W, H), f.h * 2.25); cx = f.x + f.w / 2; cy = f.y + f.h * 0.58; }
    else { side = Math.min(W, H) * 0.85; cx = W / 2; cy = H * 0.4; }  // ohne Erkennung: typischer Selfie-Ausschnitt
    side = Math.min(side, W, H);
    return { x: Math.max(0, Math.min(W - side, cx - side / 2)), y: Math.max(0, Math.min(H - side, cy - side / 2)), s: side };
  }

  function target(N, shape) {
    const b = cropBox(photo, face);
    const g = grayOf(photo, b.x, b.y, b.s, b.s, N, N);
    // Histogramm-Ausgleich (wie equalize) + Kanten
    const hist = new Array(256).fill(0);
    g.forEach((v) => hist[Math.max(0, Math.min(255, v | 0))]++);
    const cdf = []; let acc = 0; for (let i = 0; i < 256; i++) { acc += hist[i]; cdf[i] = acc / g.length; }
    const eq = g.map((v) => cdf[Math.max(0, Math.min(255, v | 0))] * 255);
    const out = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const dark = 1 - eq[i] / 255;
      let edge = 0;
      if (x > 0 && y > 0 && x < N - 1 && y < N - 1) {
        const gx = eq[i + 1] - eq[i - 1], gy = eq[i + N] - eq[i - N];
        edge = Math.min(1, Math.hypot(gx, gy) / 255);
      }
      let v = Math.pow(Math.max(0, Math.min(1, (dark - 0.16) * 1.25)), 1.1) + 0.5 * edge;
      const inside = shape === "circle"
        ? Math.hypot(x - N / 2, y - N / 2) < N * 0.485
        : x > N * 0.02 && x < N * 0.98 && y > N * 0.02 && y < N * 0.98;
      out[i] = inside ? Math.min(1, v) : 0;
    }
    return out;
  }

  function nailsFor(shape, N, n) {
    if (shape === "circle") {
      const R = N / 2 * 0.985;
      return Array.from({ length: n }, (_, i) => {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        return { x: N / 2 + R * Math.cos(a), y: N / 2 + R * Math.sin(a), side: -1 };
      });
    }
    const per = n / 4, lo = N * 0.01, hi = N * 0.99, out = [];
    for (let s = 0; s < 4; s++) for (let i = 0; i < per; i++) {
      const tt = lo + (hi - lo) * i / per;
      const p = [[tt, lo], [hi, tt], [hi - (tt - lo), hi], [lo, hi - (tt - lo)]][s];
      out.push({ x: p[0], y: p[1], side: s });
    }
    return out;
  }

  function clearPreview() {
    running++;
    const c = $("preview"), g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    $("preview-status").textContent = t("s4_note");
  }

  function drawBoard(g, S, shape, panel, nails, N) {
    const pad = S * 0.07, inner = S - pad * 2;
    g.clearRect(0, 0, S, S);
    g.save();
    g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = 18; g.shadowOffsetX = 6; g.shadowOffsetY = 10;
    g.beginPath();
    if (shape === "circle") g.arc(S / 2, S / 2, S / 2 - pad * 0.45, 0, Math.PI * 2);
    else g.roundRect(pad * 0.55, pad * 0.55, S - pad * 1.1, S - pad * 1.1, 10);
    g.fillStyle = panel === "white" ? "#f4f2ee" : "#e7d4b8"; g.fill();
    g.restore();
    g.save(); g.clip();
    const img = panelImg[panel];
    if (img.complete && img.naturalWidth) g.drawImage(img, 0, 0, S, S);
    g.restore();
    const map = (p) => [pad + p.x / N * inner, pad + p.y / N * inner];
    return { map, pad, inner };
  }

  async function makePreview() {
    if (!photo) return;
    const my = ++running;
    const shape = opt("shape"), panel = opt("panel");
    const N = 220, n = shape === "circle" ? 220 : 240, maxLines = 2600, dark = 0.085, minSkip = 14;
    const tgt = target(N, shape);
    const nails = nailsFor(shape, N, n);
    const c = $("preview"), S = c.width, g = c.getContext("2d");
    const { map } = drawBoard(g, S, shape, panel, nails, N);
    // Linienpixel einmal je Nagelpaar vorberechnen
    const lines = new Map();
    const key = (a, b) => (a < b ? a * 1000 + b : b * 1000 + a);
    function pix(a, b) {
      const k = key(a, b);
      let p = lines.get(k);
      if (p) return p;
      const A = nails[a], B = nails[b];
      const steps = Math.max(Math.abs(B.x - A.x), Math.abs(B.y - A.y)) | 0;
      p = new Int32Array(steps + 1);
      for (let s = 0; s <= steps; s++) {
        const x = Math.min(N - 1, Math.max(0, Math.round(A.x + (B.x - A.x) * s / steps)));
        const y = Math.min(N - 1, Math.max(0, Math.round(A.y + (B.y - A.y) * s / steps)));
        p[s] = y * N + x;
      }
      lines.set(k, p);
      return p;
    }
    const scale = (S * 0.86) / N;          // Pixel je Arbeitspixel
    g.lineWidth = 0.8;
    g.strokeStyle = `rgba(22,20,20,${Math.min(0.9, dark * scale / g.lineWidth).toFixed(3)})`;
    let cur = 0, last = -1, count = 0;
    const btn = $("make-preview"); btn.disabled = true;
    while (count < maxLines && my === running) {
      for (let step = 0; step < 30 && count < maxLines; step++) {
        let best = -1, bestScore = 0.004;
        for (let j = 0; j < n; j++) {
          const d = Math.min((cur - j + n) % n, (j - cur + n) % n);
          if (d < minSkip || j === last) continue;
          if (nails[cur].side >= 0 && nails[cur].side === nails[j].side) continue;
          const p = pix(cur, j);
          let s = 0; for (let q = 0; q < p.length; q++) s += tgt[p[q]];
          s /= p.length;
          if (s > bestScore) { bestScore = s; best = j; }
        }
        if (best < 0) { count = maxLines; break; }
        const p = pix(cur, best);
        for (let q = 0; q < p.length; q++) tgt[p[q]] -= dark;
        const [x0, y0] = map(nails[cur]), [x1, y1] = map(nails[best]);
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        last = cur; cur = best; count++;
      }
      $("preview-status").textContent = t("s4_busy", { n: count.toLocaleString(lang) });
      await new Promise(requestAnimationFrame);
    }
    if (my !== running) return;
    g.fillStyle = "#8a857e";
    for (const p of nails) { const [x, y] = map(p); g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill(); }
    $("preview-status").textContent = t("s4_note");
    btn.disabled = false;
  }
  $("make-preview").addEventListener("click", makePreview);

  // ------------------------------------------------------------------ Bestellen
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
  async function photoBlob() {
    const max = 1600, k = Math.min(1, max / Math.max(photo.width, photo.height));
    const c = new OffscreenCanvas(Math.round(photo.width * k), Math.round(photo.height * k));
    c.getContext("2d").drawImage(photo, 0, 0, c.width, c.height);
    return c.convertToBlob({ type: "image/jpeg", quality: 0.9 });
  }
  $("order").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("email").value;
    $("email-error").hidden = emailOk(email);
    if (!emailOk(email) || !$("consent").checked || !photo) return;
    if (!CFG.ordersOpen || !CFG.orderUrl) { $("closed").hidden = false; return; }
    const btn = $("order-btn"); btn.disabled = true; btn.textContent = t("order_busy");
    try {
      const fd = new FormData();
      fd.append("photo", await photoBlob(), "photo.jpg");
      fd.append("email", email.trim());
      fd.append("shape", opt("shape"));
      fd.append("panel", opt("panel"));
      fd.append("lang", lang);
      fd.append("check", (lastCheck || []).join(","));
      fd.append("website", $("website").value);  // Honigtopf gegen Bots
      const r = await fetch(CFG.orderUrl, { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok || !data.code) throw new Error(data.error || r.status);
      orderCode = data.code;
      $("order").hidden = true;
      $("done").hidden = false;
      $("done-text").textContent = t("order_done", { code: orderCode });
      $("pay").href = CFG.payUrl;
    } catch (err) {
      console.error(err);
      alert(t("order_fail"));
      btn.disabled = false; btn.textContent = t("order_btn");
    }
  });

  // ------------------------------------------------------------------ Start
  applyLang();
  if (!CFG.ordersOpen) $("closed").hidden = false;
  intro();
})();
