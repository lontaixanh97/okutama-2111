/* Okutama 21.11 — hiệu ứng: lá rơi, núi nhiều lớp, bảng lật, bầu trời theo giờ, ba lô, cây đổi màu */
(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.add('js');

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const TAU = Math.PI * 2;
  const SVGNS = 'http://www.w3.org/2000/svg';

  const svgEl = (name, attrs, parent) => {
    const n = document.createElementNS(SVGNS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const rng = (seed) => () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => {
    const A = hex(a), B = hex(b);
    return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
  };
  const ramp = (stops, x) => {
    if (x <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (x <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (x - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
    }
    return stops[stops.length - 1][1];
  };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* bỏ qua */ } },
  };

  /* ---------- Hình lá momiji dùng chung ---------- */
  const MOMIJI = (() => {
    const angles = [-128, -82, -40, 0, 40, 82, 128];
    const lens = [22, 37, 46, 50, 46, 37, 22];
    const pt = (deg, r) => [Math.sin((deg * Math.PI) / 180) * r, -Math.cos((deg * Math.PI) / 180) * r];
    const pts = [pt(-170, 7)];
    angles.forEach((a, i) => {
      pts.push(pt(a, lens[i]));
      pts.push(i < angles.length - 1 ? pt((a + angles[i + 1]) / 2, 14) : pt(170, 7));
    });
    return pts;
  })();

  /* ==========================================================
     1. Núi nhiều lớp ở hero
     ========================================================== */
  const landLayers = [];
  (function buildLand() {
    const svg = $('#land');
    if (!svg) return;
    const P = 1600;
    const rand = rng(21112026);
    const ridge = (base, amp) => {
      const ks = [1, 2, 3, 5, 7, 11];
      const ph = ks.map(() => rand() * TAU);
      const am = ks.map((k) => (amp / k ** 0.9) * (0.6 + 0.8 * rand()));
      return (x) => base + ks.reduce((s, k, i) => s + am[i] * Math.sin((TAU * k * x) / P + ph[i]), 0);
    };
    const pathOf = (fn) => {
      let d = 'M-120 700';
      for (let x = -120; x <= 1720; x += 10) d += ` L${x} ${fn(x).toFixed(1)}`;
      return `${d} L1720 700Z`;
    };
    const layer = (depth) => {
      const g = svgEl('g', {}, svg);
      landLayers.push({ g, depth });
      return g;
    };
    const canopy = (g, fn, n, rMin, rMax, palette) => {
      const blobs = [];
      for (let i = 0; i < n; i++) {
        const x = -120 + rand() * 1840;
        const r = rMin + rand() * (rMax - rMin);
        blobs.push({ x, y: fn(x) + (rand() - 0.25) * r * 1.6, r, c: palette[Math.floor(rand() * palette.length)] });
      }
      blobs.sort((a, b) => a.y - b.y).forEach((b) => svgEl('circle', { cx: b.x.toFixed(1), cy: b.y.toFixed(1), r: b.r.toFixed(1), fill: b.c }, g));
    };

    let fn = ridge(240, 70);
    svgEl('path', { d: pathOf(fn), fill: '#7FA9AE' }, layer(0.05));
    fn = ridge(310, 60);
    svgEl('path', { d: pathOf(fn), fill: '#3F7577' }, layer(0.1));

    fn = ridge(385, 44);
    let g = layer(0.18);
    svgEl('path', { d: pathOf(fn), fill: '#8F4A35' }, g);
    canopy(g, fn, 130, 12, 26, ['#B5533C', '#C97B3A', '#D9A441', '#9E3B3B', '#B5533C', '#6F8F6B']);

    fn = ridge(462, 38);
    g = layer(0.3);
    svgEl('path', { d: pathOf(fn), fill: '#7A2130' }, g);
    canopy(g, fn, 105, 20, 42, ['#D7263D', '#B81D36', '#F26B21', '#F4B41A', '#E8892B', '#C2410C', '#D7263D', '#4F7F4A']);

    fn = ridge(566, 22);
    g = layer(0.45);
    for (let i = 0; i < 30; i++) {
      const x = -120 + rand() * 1840, y = fn(x) + 8, h = 70 + rand() * 90, w = 26 + rand() * 18;
      svgEl('path', { d: `M${x - w / 2} ${y} L${x} ${y - h} L${x + w / 2} ${y}Z`, fill: '#0A2A2B' }, g);
    }
    svgEl('path', { d: pathOf(fn), fill: '#0A2A2B' }, g);
  })();

  let pointerX = 0.5;
  const parallax = () => {
    if (reduce || !landLayers.length) return;
    const y = window.scrollY;
    if (y > innerHeight * 1.2) return;
    for (const { g, depth } of landLayers) {
      const tx = (0.5 - pointerX) * depth * 120;
      const ty = y * (0.5 - depth) * 0.42;
      g.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`;
    }
  };

  /* ==========================================================
     2. Lá rơi (canvas)
     ========================================================== */
  const leaves = (() => {
    const cv = $('#leaves');
    const ctx = cv.getContext('2d');
    const shape = new Path2D();
    MOMIJI.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
    shape.closePath();
    const colors = ['#D7263D', '#B81D36', '#F26B21', '#F4B41A', '#E8892B', '#D7263D'];
    const list = [];
    let w = 0, h = 0, wind = 0, raf = 0, last = 0;
    let on = !reduce && store.get('okutama-leaves', true);

    const make = (x, y, burst) => {
      const z = 0.45 + Math.random() * 0.75;
      const a = Math.random() * TAU, sp = 2 + Math.random() * 5;
      return {
        x: x ?? Math.random() * w,
        y: y ?? Math.random() * h,
        z,
        vx: burst ? Math.cos(a) * sp : -0.2 - Math.random() * 0.5,
        vy: burst ? Math.sin(a) * sp - 3 : 0.5 + Math.random() * 0.9,
        rot: Math.random() * TAU,
        vr: (Math.random() - 0.5) * 0.06,
        ph: Math.random() * TAU,
        ff: 0.02 + Math.random() * 0.04,
        c: colors[(Math.random() * colors.length) | 0],
        burst,
      };
    };
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = innerWidth; h = innerHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = w < 700 ? 11 : 24;
      const base = list.filter((l) => !l.burst).length;
      for (let i = base; i < target; i++) list.push(make());
    };
    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      const dt = clamp((t - last) / 16.7, 0.2, 3);
      last = t;
      wind *= 0.965;
      ctx.clearRect(0, 0, w, h);
      for (let i = list.length - 1; i >= 0; i--) {
        const l = list[i];
        l.ph += l.ff * dt;
        l.rot += l.vr * dt;
        if (l.burst) { l.vy += 0.09 * dt; l.vx *= 0.985; }
        l.x += (l.vx + wind * l.z + Math.sin(l.ph) * 0.7) * dt;
        l.y += l.vy * l.z * dt;
        if (l.burst) {
          if (l.y > h + 60 || l.x < -60 || l.x > w + 60) { list.splice(i, 1); continue; }
        } else {
          if (l.y > h + 40) { l.y = -40; l.x = Math.random() * w; }
          else if (l.y < -60) l.y = h + 30;
          if (l.x < -50) l.x = w + 40; else if (l.x > w + 50) l.x = -40;
        }
        const s = 0.26 * l.z + 0.1;
        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.rotate(l.rot);
        ctx.scale(s * Math.cos(l.ph * 1.6), s);
        ctx.fillStyle = l.c;
        ctx.fill(shape);
        ctx.fillRect(-1.5, 4, 3, 26);
        ctx.restore();
      }
    };
    const start = () => { if (!raf && on && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    resize();
    start();
    addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    addEventListener('pointermove', (e) => {
      pointerX = e.clientX / innerWidth;
      wind = clamp(wind + clamp(e.movementX || 0, -40, 40) * 0.012, -5, 5);
    }, { passive: true });

    return {
      burst(x, y, n = 8) { if (!on) return; for (let i = 0; i < n; i++) list.push(make(x, y, true)); },
      scrollBy(dy) { for (const l of list) if (!l.burst) l.y -= dy * 0.22 * l.z; },
      toggle() {
        on = !on;
        store.set('okutama-leaves', on);
        if (on) start(); else { stop(); ctx.clearRect(0, 0, w, h); }
        return on;
      },
      get on() { return on; },
    };
  })();

  // 'click' chứ không phải 'pointerdown': trên điện thoại, vuốt để cuộn không được tính là chạm
  addEventListener('click', (e) => {
    if (e.target.closest('input, label, video')) return;
    leaves.burst(e.clientX, e.clientY, 7);
  });
  const leafBtn = $('#leaf-toggle');
  const syncLeafBtn = () => {
    leafBtn.textContent = leaves.on ? 'Tắt lá rơi' : 'Bật lá rơi';
    leafBtn.setAttribute('aria-pressed', String(leaves.on));
  };
  leafBtn.addEventListener('click', () => { leaves.toggle(); syncLeafBtn(); });
  syncLeafBtn();

  /* ==========================================================
     3. Ô lật: bảng giờ tàu + đếm ngược
     ========================================================== */
  const flapInit = (node) => {
    const text = node.textContent.trim();
    node.textContent = '';
    const sr = document.createElement('span');
    sr.className = 'vh';
    sr.textContent = text;
    node.appendChild(sr);
    node._sr = sr;
    node._cells = [...text].map((ch) => {
      const c = document.createElement('span');
      c.className = ch === ':' ? 'flap flap--sep' : 'flap';
      c.setAttribute('aria-hidden', 'true');
      c.textContent = ch === ':' ? ':' : ' ';
      c.dataset.to = ch;
      node.appendChild(c);
      return c;
    });
    return text;
  };
  const flip = (cell, ch) => {
    cell.textContent = ch;
    if (reduce) return;
    cell.classList.remove('is-flip');
    void cell.offsetWidth;
    cell.classList.add('is-flip');
  };
  const spin = (cell, target, delay) => {
    if (reduce) { cell.textContent = target; return; }
    let n = 5 + ((Math.random() * 6) | 0);
    setTimeout(function step() {
      if (n-- <= 0) return flip(cell, target);
      flip(cell, String((Math.random() * 10) | 0));
      setTimeout(step, 60);
    }, delay);
  };

  // Bảng giờ: lật khi cuộn tới
  const boardIO = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      boardIO.unobserve(en.target);
      en.target._cells.forEach((c, i) => c.dataset.to !== ':' && spin(c, c.dataset.to, i * 90));
    }
  }, { threshold: 0.6 });
  $$('.flaps[data-board]').forEach((n) => { flapInit(n); boardIO.observe(n); });

  // Đếm ngược tới chuyến 08:12 JST ở Tachikawa, ngày 21/11/2026
  (function countdown() {
    const DEPART = Date.UTC(2026, 10, 20, 23, 12, 0);
    const HOME = Date.UTC(2026, 10, 21, 10, 3, 0);
    const label = $('#countdown-label');
    const units = {};
    $$('.flaps[data-unit]').forEach((n) => { flapInit(n); units[n.dataset.unit] = n; });
    let first = true;
    const set = (node, value) => {
      const text = String(value).padStart(2, '0');
      node._sr.textContent = text;
      [...text].forEach((ch, i) => {
        const c = node._cells[i];
        if (c.textContent === ch) return;
        first ? spin(c, ch, 1300 + i * 80) : flip(c, ch);
      });
    };
    const tick = () => {
      const now = Date.now();
      let left = Math.max(0, DEPART - now);
      if (now >= HOME) label.textContent = 'Chuyến đi đã xong. Hẹn mùa lá năm sau.';
      else if (now >= DEPART) label.textContent = 'Chuyến đi đang diễn ra. Đi vui nhé!';
      const s = Math.floor(left / 1000);
      set(units.d, Math.floor(s / 86400));
      set(units.h, Math.floor((s % 86400) / 3600));
      set(units.m, Math.floor((s % 3600) / 60));
      set(units.s, s % 60);
      first = false;
    };
    tick();
    setInterval(tick, 1000);
  })();

  /* ==========================================================
     4. Thanh tuyến tàu
     ========================================================== */
  const nav = $('.line');
  const navLinks = $$('.line__stops a');
  const navTrain = $('.line__train');
  const navSections = navLinks.map((a) => $(a.getAttribute('href')));
  let navIdx = -2;
  const updateNav = (force) => {
    const y = innerHeight * 0.42;
    let idx = -1;
    navSections.forEach((s, i) => { if (s.getBoundingClientRect().top <= y) idx = i; });
    if (idx === navIdx && !force) return;
    navIdx = idx;
    navLinks.forEach((a, i) => (i === idx ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    const x = idx < 0 ? -80 : navLinks[idx].getBoundingClientRect().left + navLinks[idx].offsetWidth / 2 - nav.getBoundingClientRect().left;
    navTrain.style.setProperty('--x', `${x}px`);
  };

  /* ==========================================================
     5. Lịch trình: bầu trời + mặt trời chạy theo vị trí cuộn
     ========================================================== */
  const day = $('#lich-trinh');
  const route = $('#route');
  const marker = $('#route-marker');
  const fill = $('#route-fill');
  const track = $('.route__track');
  const dialSun = $('#dial-sun');
  const dialTime = $('#dial-time');
  const dialLabel = $('#dial-label');
  const allStops = $$('.stop', route).map((el) => ({ el, min: +el.dataset.min, mode: el.dataset.mode, label: el.dataset.label, y: 0 }));
  let stops = allStops; // chỉ các chặng của phương án đang chọn
  const SKY_A = [[410, '#2B4460'], [540, '#5FA3BF'], [720, '#6FB6CC'], [900, '#86B4C4'], [975, '#D9824F'], [1005, '#6B3A63'], [1045, '#1B1B3F'], [1143, '#12122E']];
  const SKY_B = [[410, '#F4B9A0'], [540, '#DDF0EE'], [720, '#E6F3EE'], [900, '#F6E3B8'], [975, '#F9C56B'], [1005, '#E4572E'], [1045, '#4A2F5E'], [1143, '#2A2148']];
  const SUNRISE = 382, SUNSET = 991;
  let reached = -1;

  const measureDay = () => {
    const off = matchMedia('(max-width: 759px)').matches ? 19 : 29;
    stops = allStops.filter((s) => s.el.offsetParent !== null);
    stops.forEach((s) => (s.y = s.el.offsetTop + off));
    const y0 = stops[0].y, y1 = stops[stops.length - 1].y;
    track.style.top = fill.style.top = `${y0}px`;
    track.style.height = `${y1 - y0}px`;
    track.style.bottom = 'auto';
  };
  const updateDay = () => {
    const rect = route.getBoundingClientRect();
    if (rect.bottom < -200 || rect.top > innerHeight + 200) return;
    const y0 = stops[0].y, y1 = stops[stops.length - 1].y;
    const p = clamp(innerHeight * 0.5 - rect.top, y0, y1);
    marker.style.transform = `translateY(${p}px)`;
    fill.style.height = `${p - y0}px`;

    let i = 0;
    while (i < stops.length - 1 && stops[i + 1].y <= p) i++;
    const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
    const t = b.y > a.y ? clamp((p - a.y) / (b.y - a.y), 0, 1) : 0;
    const min = a.min + (b.min - a.min) * t;

    if (i !== reached) {
      reached = i;
      stops.forEach((s, k) => s.el.classList.toggle('is-reached', k <= i));
      marker.dataset.mode = t > 0.02 && b.mode === 'train' && a.mode === 'train' ? 'train' : a.mode;
      dialLabel.textContent = a.label;
    }
    day.style.setProperty('--sky-a', ramp(SKY_A, min));
    day.style.setProperty('--sky-b', ramp(SKY_B, min));
    day.style.setProperty('--night', clamp((min - 1000) / 60, 0, 1).toFixed(2));

    const m = Math.round(min);
    dialTime.textContent = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const night = min > SUNSET;
    const st = night ? ((min - SUNSET) / (1143 - SUNSET)) * 0.38 : (min - SUNRISE) / (SUNSET - SUNRISE);
    dialSun.setAttribute('cx', (100 - 82 * Math.cos(Math.PI * st)).toFixed(1));
    dialSun.setAttribute('cy', (100 - 82 * Math.sin(Math.PI * st)).toFixed(1));
    dialSun.style.fill = night ? '#F6F8F3' : ramp([[410, '#FFD0A0'], [600, '#F4B41A'], [930, '#F4B41A'], [991, '#F26B21']], min);
  };

  /* ==========================================================
     6. Video trong cửa sổ tàu + tay nắm đung đưa
     ========================================================== */
  const video = $('#trailer-video');
  const videoBtn = $('#video-toggle');
  let userPaused = reduce;
  const syncVideo = () => {
    const playing = !video.paused;
    videoBtn.textContent = playing ? 'Tạm dừng video' : 'Phát video';
    videoBtn.setAttribute('aria-pressed', String(playing));
  };
  video.addEventListener('play', syncVideo);
  video.addEventListener('pause', syncVideo);
  videoBtn.addEventListener('click', () => {
    if (video.paused) { userPaused = false; video.play().catch(() => {}); }
    else { userPaused = true; video.pause(); }
  });
  new IntersectionObserver(([en]) => {
    if (en.isIntersecting && !userPaused) video.play().catch(() => {});
    else if (!en.isIntersecting) video.pause();
  }, { threshold: 0.45 }).observe(video);

  const straps = $('.straps');
  let sway = 1;

  /* ==========================================================
     7. Ba lô
     ========================================================== */
  (function pack() {
    const KEY = 'okutama-2111-pack';
    const boxes = $$('#checklist input[type="checkbox"]');
    const bag = $('#bag');
    const level = $('#bag-level');
    const count = $('#bag-count');
    const status = $('#bag-status');
    const saved = store.get(KEY, {});
    $('#bag-total').textContent = boxes.length;

    const render = (celebrate) => {
      const n = boxes.filter((b) => b.checked).length;
      count.textContent = n;
      level.setAttribute('y', (234 - 198 * (n / boxes.length)).toFixed(1));
      status.textContent = n === 0 ? 'Ba lô còn trống.' : n < boxes.length ? `Còn thiếu ${boxes.length - n} món.` : 'Đủ đồ rồi. Sẵn sàng lên đường!';
      if (celebrate && n === boxes.length) {
        const r = bag.getBoundingClientRect();
        leaves.burst(r.left + r.width / 2, r.top + r.height / 3, 26);
      }
    };
    const squish = () => !reduce && bag.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.1,.9)' }, { transform: 'scale(.96,1.05)' }, { transform: 'scale(1)' }],
      { duration: 420, easing: 'ease-out' }
    );
    const fly = (box) => {
      if (reduce) return render(true);
      const a = box.getBoundingClientRect(), b = bag.getBoundingClientRect();
      const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
      const x1 = b.left + b.width / 2, y1 = b.top + b.height * 0.3;
      const chip = document.createElement('span');
      chip.className = 'chip';
      document.body.appendChild(chip);
      chip.animate(
        [
          { transform: `translate(${x0}px,${y0}px) scale(.6) rotate(0deg)` },
          { transform: `translate(${(x0 + x1) / 2}px,${Math.min(y0, y1) - 90}px) scale(1.2) rotate(260deg)`, offset: 0.5 },
          { transform: `translate(${x1}px,${y1}px) scale(.5) rotate(520deg)` },
        ],
        { duration: 620, easing: 'cubic-bezier(.4,0,.6,1)' }
      ).onfinish = () => { chip.remove(); squish(); render(true); };
    };

    boxes.forEach((box) => {
      box.checked = !!saved[box.dataset.id];
      box.addEventListener('change', () => {
        saved[box.dataset.id] = box.checked;
        store.set(KEY, saved);
        box.checked ? fly(box) : render(false);
      });
    });
    $('#bag-reset').addEventListener('click', () => {
      boxes.forEach((b) => { b.checked = false; saved[b.dataset.id] = false; });
      store.set(KEY, saved);
      render(false);
      squish();
    });
    render(false);
  })();

  /* ==========================================================
     8. Cây đổi màu theo ngày
     ========================================================== */
  (function koyo() {
    const svg = $('#tree');
    const range = $('#koyo-range');
    const dateEl = $('#koyo-date');
    const statusEl = $('#koyo-status');
    const rand = rng(1121);
    const COLORS = [[4, '#5E8C4A'], [9, '#F4B41A'], [13, '#F26B21'], [17, '#D7263D'], [30, '#A81B31'], [38, '#7A4A2B']];

    svgEl('ellipse', { cx: 210, cy: 312, rx: 190, ry: 16, fill: '#C3D3C8' }, svg);
    const ground = [];
    for (let i = 0; i < 26; i++) {
      ground.push(svgEl('circle', { cx: 40 + rand() * 340, cy: 304 + rand() * 14, r: 5 + rand() * 5, fill: ['#D7263D', '#F26B21', '#F4B41A', '#A81B31'][i % 4], opacity: 0 }, svg));
    }
    svgEl('path', { d: 'M196 316c6-60 4-96-22-140M224 316c-6-64 0-100 30-146M210 316V150', fill: 'none', stroke: '#0B2526', 'stroke-width': 16, 'stroke-linecap': 'round' }, svg);
    const blobs = [];
    for (let i = 0; i < 58; i++) {
      const a = rand() * TAU, d = Math.sqrt(rand());
      const cx = 210 + Math.cos(a) * d * 168, cy = 128 + Math.sin(a) * d * 96;
      blobs.push({ cx, cy, r: 22 + rand() * 20, off: (rand() - 0.5) * 7, hold: rand() * 7 });
    }
    blobs.sort((a, b) => a.cy - b.cy).forEach((b) => (b.el = svgEl('circle', { cx: b.cx.toFixed(1), cy: b.cy.toFixed(1), r: b.r.toFixed(1), stroke: '#0B2526', 'stroke-width': 3 }, svg)));

    const label = (d) => (d < 30 ? `${d + 1}/11` : `${d - 29}/12`);
    const state = (d) =>
      d < 8 ? 'Mới chớm đổi màu' :
      d < 16 ? 'Đang đổi màu, khoảng 5 phần' :
      d < 31 ? 'Đỉnh điểm, đỏ rực cả sườn núi' : 'Lá bắt đầu rụng';
    const update = () => {
      const d = +range.value;
      for (const b of blobs) {
        const p = d + b.off;
        const gone = p > 31 + b.hold;
        b.el.style.fill = ramp(COLORS, p);
        b.el.style.opacity = gone ? 0 : 1;
        b.el.style.transform = gone ? 'translateY(150px) scale(.3)' : 'none';
      }
      ground.forEach((g, i) => g.setAttribute('opacity', d >= 24 + i * 0.6 ? 1 : 0));
      dateEl.textContent = label(d);
      statusEl.textContent = state(d);
      range.setAttribute('aria-valuetext', `${label(d)}, ${state(d).toLowerCase()}`);
    };
    range.addEventListener('input', update);
    update();
  })();

  /* ==========================================================
     Vòng lặp cuộn
     ========================================================== */
  let lastY = window.scrollY, queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const y = window.scrollY, dy = y - lastY;
      lastY = y;
      leaves.scrollBy(dy);
      parallax();
      updateNav();
      updateDay();
      if (!reduce && straps) {
        sway = clamp(Math.max(sway * 0.9, 1 + Math.abs(dy) / 14), 1, 4.5);
        straps.style.setProperty('--sway', sway.toFixed(2));
      }
    });
  };
  const relax = () => {
    if (sway > 1.01) { sway = Math.max(1, sway * 0.94); straps.style.setProperty('--sway', sway.toFixed(2)); }
  };
  if (!reduce) setInterval(relax, 120);

  const layout = () => { measureDay(); reached = -1; updateDay(); updateNav(true); parallax(); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', layout);
  document.addEventListener('planchange', layout);
  addEventListener('pointermove', () => { if (!queued && window.scrollY < innerHeight) requestAnimationFrame(parallax); }, { passive: true });
  layout();
  addEventListener('load', layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
})();
