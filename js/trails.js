/* Okutama 21.11 — chọn phương án, bản đồ cung đường và biểu đồ độ cao */
(() => {
  'use strict';
  const R = window.OKUTAMA_ROUTES;
  const root = document.documentElement;
  if (!R) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs = {}, parent) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const km = (n, d = 1) => n.toFixed(d).replace('.', ',');
  const line = (pts) => 'M' + pts.map((p) => p.join(' ')).join('L');
  const KEY = 'okutama-2111-plan';

  /* ---------- độ cao tại vị trí t (0..1) ---------- */
  const eleAt = (prof, t) => {
    let i = 1;
    while (i < prof.length - 1 && prof[i][0] < t) i++;
    const [t0, e0] = prof[i - 1], [t1, e1] = prof[i];
    return e0 + (e1 - e0) * (t1 > t0 ? clamp((t - t0) / (t1 - t0), 0, 1) : 0);
  };

  /* ==========================================================
     Đường độ cao nhỏ trên thẻ so sánh (cùng một tỉ lệ)
     ========================================================== */
  const ALL = Object.values(R);
  const LO = Math.min(...ALL.map((r) => r.min)) - 15;
  const HI = Math.max(...ALL.map((r) => r.max)) + 15;
  const MAXKM = Math.max(...ALL.map((r) => r.km));
  $$('[data-spark]').forEach((svg) => {
    const r = R[svg.dataset.spark];
    const pts = r.profile.map(([t, e]) => [+(t * r.km / MAXKM * 300).toFixed(1), +(66 - ((e - LO) / (HI - LO)) * 60).toFixed(1)]);
    el('path', { d: `${line(pts)}L${pts[pts.length - 1][0]} 70L0 70Z`, class: 'spark__area' }, svg);
    el('path', { d: line(pts), class: 'spark__line', 'vector-effect': 'non-scaling-stroke' }, svg);
  });

  /* ==========================================================
     Bản đồ + biểu đồ cho từng cung
     ========================================================== */
  const views = {};

  function build(key) {
    const r = R[key];
    const host = $(`[data-map="${key}"]`);
    const profHost = $(`[data-profile="${key}"]`);
    const sights = $$(`[data-sights="${key}"] > li`);
    const gmaps = $(`[data-gmaps="${key}"]`);
    if (gmaps && r.gmaps) gmaps.href = r.gmaps;

    /* ---------- bản đồ ---------- */
    const scroller = document.createElement('div');
    scroller.className = 'tmap__scroll';
    host.prepend(scroller);
    const stage = document.createElement('div');
    stage.className = 'tmap__stage';
    scroller.appendChild(stage);
    const svg = el('svg', { viewBox: `0 0 ${r.w} ${r.h}`, class: 'tmap__svg', role: 'img', 'aria-label': `Bản đồ cung đường ${r.name}, dài ${km(r.km)} km` }, stage);

    const layer = (cls) => el('g', { class: cls }, svg);
    const draw = (g, list, cls) => list.forEach((pts) => el('path', { d: line(pts), class: cls }, g));
    draw(layer('m-streams'), r.feats.stream, 'm-stream');
    draw(layer('m-minor'), r.feats.minor, 'm-minorroad');
    const rv = layer('m-rivers');
    draw(rv, r.feats.river, 'm-river');
    const wt = layer('m-waters');
    r.feats.water.forEach((pts) => el('path', { d: line(pts) + 'Z', class: 'm-water' }, wt));
    draw(layer('m-flows'), r.feats.river, 'm-flow');
    const rd = layer('m-roads');
    draw(rd, r.feats.road, 'm-road');
    draw(rd, r.feats.road, 'm-road-in');
    const rl = layer('m-rails');
    draw(rl, r.feats.rail, 'm-rail');
    draw(rl, r.feats.rail, 'm-rail-in');

    const tg = layer('m-trail');
    el('path', { d: line(r.trail), class: 'm-trail-ghost' }, tg);
    el('path', { d: line(r.trail), class: 'm-trail-case', pathLength: 1 }, tg);
    const trail = el('path', { d: line(r.trail), class: 'm-trail-line', pathLength: 1 }, tg);
    const drawn = [tg.children[1], trail];
    let total = 0;

    // thước tỉ lệ 500 m + mũi tên bắc
    const sc = layer('m-scale');
    const sw = 500 / r.mpp;
    el('path', { d: `M24 ${r.h - 26}v8h${sw.toFixed(1)}v-8`, class: 'm-scale-bar' }, sc);
    el('text', { x: 24 + sw / 2, y: r.h - 30, class: 'm-scale-text', 'text-anchor': 'middle' }, sc).textContent = '500 m';
    const na = el('g', { transform: 'translate(40 46)', class: 'm-north' }, svg);
    el('path', { d: 'M0-24L11 12 0 5-11 12Z' }, na);
    el('text', { y: 30, 'text-anchor': 'middle' }, na).textContent = 'B';

    // người đi bộ
    const hiker = el('g', { class: 'm-hiker' }, svg);
    el('circle', { r: 19 }, hiker);
    el('path', { d: 'M1-9a3.4 3.4 0 1 0 0-.1M1-4v8M1 4l-5 9M1 4l5 8M1-2l-6 4M1-2l6 2', class: 'm-hiker-fig' }, hiker);

    // điểm mốc
    const tip = document.createElement('div');
    tip.className = 'tmap__tip';
    tip.hidden = true;
    stage.appendChild(tip);
    const pg = layer('m-pins');
    const pins = r.pois.map((p, i) => {
      const g = el('g', { class: 'm-pin', transform: `translate(${p.xy[0]} ${p.xy[1]})`, tabindex: 0, role: 'button', 'aria-label': `${i + 1}. ${p.name}` }, pg);
      el('circle', { r: 17 }, g);
      el('text', { y: 6, 'text-anchor': 'middle' }, g).textContent = i + 1;
      return g;
    });

    /* ---------- biểu đồ độ cao ---------- */
    const PW = innerWidth < 760 ? 440 : 1000, PH = 210, L = 54, Rt = 16, T = 30, B = 34;
    const lo = Math.floor((r.min - 12) / 10) * 10, hi = Math.ceil((r.max + 12) / 10) * 10;
    const px = (t) => L + t * (PW - L - Rt);
    const py = (e) => T + (1 - (e - lo) / (hi - lo)) * (PH - T - B);
    const ps = el('svg', { viewBox: `0 0 ${PW} ${PH}`, class: 'tprof__svg' });
    profHost.appendChild(ps);
    const ticks = hi - lo > 150 ? 100 : 20;
    for (let e = Math.ceil(lo / ticks) * ticks; e <= hi; e += ticks) {
      el('path', { d: `M${L} ${py(e).toFixed(1)}H${PW - Rt}`, class: 'p-grid' }, ps);
      el('text', { x: L - 8, y: py(e) + 5, 'text-anchor': 'end', class: 'p-label' }, ps).textContent = `${e} m`;
    }
    for (let d = 0; d <= r.km; d += r.km > 7 ? 2 : 1) {
      el('text', { x: px(d / r.km), y: PH - 10, 'text-anchor': 'middle', class: 'p-label' }, ps).textContent = `${d} km`;
    }
    const pp = r.profile.map(([t, e]) => [+px(t).toFixed(1), +py(e).toFixed(1)]);
    el('path', { d: `${line(pp)}L${px(1)} ${PH - B}L${L} ${PH - B}Z`, class: 'p-area' }, ps);
    el('path', { d: line(pp), class: 'p-line' }, ps);
    el('path', { d: `M${L} ${PH - B}H${PW - Rt}`, class: 'p-axis' }, ps);
    const pdots = r.pois.map((p, i) => {
      const g = el('g', { class: 'p-pin', transform: `translate(${px(p.at).toFixed(1)} ${py(eleAt(r.profile, p.at)).toFixed(1)})` }, ps);
      el('circle', { r: 12 }, g);
      el('text', { y: 4.5, 'text-anchor': 'middle' }, g).textContent = i + 1;
      return g;
    });
    const cur = el('g', { class: 'p-cursor' }, ps);
    el('path', { d: `M0 ${T - 8}V${PH - B}` }, cur);
    el('circle', { r: 7 }, cur);
    const read = document.createElement('p');
    read.className = 'tprof__read';
    profHost.appendChild(read);

    /* ---------- trạng thái ---------- */
    let pos = 0, active = -1, raf = 0, played = false;
    const setPos = (t, drawTo) => {
      pos = clamp(t, 0, 1);
      if (!total) total = trail.getTotalLength();
      const pt = trail.getPointAtLength(pos * total);
      hiker.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
      const e = eleAt(r.profile, pos);
      cur.setAttribute('transform', `translate(${px(pos).toFixed(1)} 0)`);
      cur.lastChild.setAttribute('cy', py(e).toFixed(1));
      read.innerHTML = `<b>km ${km(pos * r.km)}</b><span>cao ${Math.round(e)} m</span><span>còn ${km((1 - pos) * r.km)} km</span>`;
      if (drawTo !== undefined) {
        drawn.forEach((p) => (p.style.strokeDashoffset = 1 - drawTo));
        pins.forEach((g, i) => g.classList.toggle('is-on', r.pois[i].at <= drawTo + 0.004));
      }
    };
    const activate = (i, move = true) => {
      active = i;
      pins.forEach((g, k) => g.classList.toggle('is-active', k === i));
      pdots.forEach((g, k) => g.classList.toggle('is-active', k === i));
      sights.forEach((li, k) => li.classList.toggle('is-active', k === i));
      if (i < 0) { tip.hidden = true; return; }
      const p = r.pois[i];
      tip.textContent = `${i + 1}. ${p.name}`;
      tip.style.left = `${(p.xy[0] / r.w) * 100}%`;
      tip.style.top = `${(p.xy[1] / r.h) * 100}%`;
      tip.classList.toggle('is-left', p.xy[0] > r.w * 0.7);
      tip.classList.toggle('is-right', p.xy[0] < r.w * 0.3);
      tip.hidden = false;
      if (move) { cancelAnimationFrame(raf); setPos(p.at, 1); }
      // đưa điểm mốc vào giữa khung nếu bản đồ đang cuộn ngang
      if (scroller.scrollWidth > scroller.clientWidth + 4) {
        scroller.scrollTo({ left: (p.xy[0] / r.w) * scroller.scrollWidth - scroller.clientWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
      }
    };
    const play = () => {
      cancelAnimationFrame(raf);
      activate(-1, false);
      played = true;
      if (reduce) return setPos(0, 1);
      const t0 = performance.now(), dur = 4200 + r.km * 180;
      const step = (now) => {
        const k = clamp((now - t0) / dur, 0, 1);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        setPos(e, e);
        if (scroller.scrollWidth > scroller.clientWidth + 4) scroller.scrollLeft = e * (scroller.scrollWidth - scroller.clientWidth);
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    pins.forEach((g, i) => {
      g.addEventListener('click', (ev) => { ev.stopPropagation(); activate(active === i ? -1 : i); });
      g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); activate(i); } });
      g.addEventListener('pointerenter', (ev) => ev.pointerType === 'mouse' && activate(i, false));
    });
    sights.forEach((li, i) => {
      const btn = $('button', li);
      btn.addEventListener('click', () => {
        activate(i);
        if (host.getBoundingClientRect().top < 0) host.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      });
    });
    const scrub = (ev) => {
      const box = ps.getBoundingClientRect();
      const x = ((ev.clientX - box.left) / box.width) * PW;
      cancelAnimationFrame(raf);
      activate(-1, false);
      setPos((x - L) / (PW - L - Rt), 1);
    };
    ps.addEventListener('pointerdown', (ev) => { ps.setPointerCapture(ev.pointerId); scrub(ev); });
    ps.addEventListener('pointermove', (ev) => { if (ev.pointerType === 'mouse' || ev.buttons || ev.pressure > 0) scrub(ev); });

    const replay = document.createElement('button');
    replay.type = 'button';
    replay.className = 'tmap__replay';
    replay.textContent = 'Xem lại đường đi';
    replay.addEventListener('click', play);
    host.appendChild(replay);

    setPos(0, reduce ? 1 : 0);
    views[key] = { play, host, get played() { return played; } };
  }

  // dựng khi cả hai khung đều đang hiển thị để đo được chiều dài đường
  root.removeAttribute('data-plan');
  Object.keys(R).forEach(build);

  /* ==========================================================
     Chuyển phương án
     ========================================================== */
  const cards = $$('.plan[data-choose]');
  let plan = 'a';
  try { const v = localStorage.getItem(KEY); if (v && R[v]) plan = v; } catch { /* bỏ qua */ }

  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      const v = Object.values(views).find((x) => x.host === en.target);
      if (en.isIntersecting && v && !v.played) v.play();
    }
  }, { threshold: 0.35 });
  Object.values(views).forEach((v) => io.observe(v.host));

  const setPlan = (next, user) => {
    plan = next;
    root.dataset.plan = next;
    cards.forEach((c) => {
      const on = c.dataset.choose === next;
      c.setAttribute('aria-checked', String(on));
      c.tabIndex = on ? 0 : -1;
      $('.plan__pick', c).textContent = on ? 'Đang chọn' : `Chọn phương án ${c.dataset.choose.toUpperCase()}`;
    });
    if (user) {
      try { localStorage.setItem(KEY, next); } catch { /* bỏ qua */ }
      const v = views[next];
      // khung vừa hiện ra: phát lại đường đi
      requestAnimationFrame(() => { if (v.host.getBoundingClientRect().top < innerHeight) v.play(); });
    }
    document.dispatchEvent(new CustomEvent('planchange', { detail: next }));
  };
  cards.forEach((c, i) => {
    c.addEventListener('click', () => setPlan(c.dataset.choose, true));
    c.addEventListener('keydown', (ev) => {
      if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(ev.key)) return;
      ev.preventDefault();
      const n = cards[(i + (ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : cards.length - 1)) % cards.length];
      n.focus();
      setPlan(n.dataset.choose, true);
    });
  });
  setPlan(plan, false);
})();
