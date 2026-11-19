import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  interpolateColors,
  random,
  spring,
  useCurrentFrame,
} from "remotion";

export const W = 1280;
export const H = 720;
export const FPS = 30;
export const DURATION = 600; // 20 giây

const C = {
  lake: "#0F3D3E",
  deep: "#0A2A2B",
  paper: "#F6F8F3",
  momiji: "#D7263D",
  icho: "#F4B41A",
  rail: "#F26B21",
  ink: "#0B2526",
};
const DISPLAY = '"Dela Gothic One", sans-serif';
const BODY = '"Bricolage Grotesque Variable", sans-serif';
const TAU = Math.PI * 2;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
const mod = (n, m) => ((n % m) + m) % m;
const outQuint = Easing.bezier(0.2, 0.8, 0.2, 1);

/* ---------- Phong cảnh: dãy núi tuần hoàn để cuộn ngang ---------- */
const PERIOD = 1600;

function makeRidge(seed, base, amp) {
  const ks = [1, 2, 3, 5, 7, 11];
  const ph = ks.map((_, i) => random(`${seed}-p${i}`) * TAU);
  const am = ks.map((k, i) => (amp / k ** 0.9) * (0.6 + 0.8 * random(`${seed}-a${i}`)));
  return (x) => base + ks.reduce((s, k, i) => s + am[i] * Math.sin((TAU * k * x) / PERIOD + ph[i]), 0);
}
function ridgePath(fn) {
  let d = `M0 ${H + 20}`;
  for (let x = 0; x <= PERIOD * 2; x += 10) d += ` L${x} ${fn(x).toFixed(1)}`;
  return `${d} L${PERIOD * 2} ${H + 20} Z`;
}
function makeCanopy(seed, fn, n, rMin, rMax, palette) {
  return Array.from({ length: n }, (_, i) => {
    const x = random(`${seed}-x${i}`) * PERIOD;
    const r = rMin + random(`${seed}-r${i}`) * (rMax - rMin);
    return {
      x,
      y: fn(x) + (random(`${seed}-y${i}`) - 0.25) * r * 1.6,
      r,
      color: palette[Math.floor(random(`${seed}-c${i}`) * palette.length)],
    };
  }).sort((a, b) => a.y - b.y);
}

const farFn = makeRidge("far", 330, 70);
const midFn = makeRidge("mid", 400, 60);
const autumnBackFn = makeRidge("ab", 470, 46);
const autumnFrontFn = makeRidge("af", 548, 40);
const frontFn = makeRidge("front", 668, 26);

const FAR = ridgePath(farFn);
const MID = ridgePath(midFn);
const AUT_BACK = ridgePath(autumnBackFn);
const AUT_FRONT = ridgePath(autumnFrontFn);
const FRONT = ridgePath(frontFn);

const CANOPY_BACK = makeCanopy("cb", autumnBackFn, 110, 12, 26, [
  "#B5533C", "#C97B3A", "#D9A441", "#9E3B3B", "#B5533C", "#6F8F6B",
]);
const CANOPY_FRONT = makeCanopy("cf", autumnFrontFn, 90, 20, 42, [
  "#D7263D", "#B81D36", "#F26B21", "#F4B41A", "#E8892B", "#C2410C", "#D7263D", "#4F7F4A",
]);
const CEDARS = Array.from({ length: 26 }, (_, i) => {
  const x = random(`cd-x${i}`) * PERIOD;
  return { x, y: frontFn(x) + 8, h: 70 + random(`cd-h${i}`) * 90, w: 26 + random(`cd-w${i}`) * 18 };
});

const Tiled = ({ offset, children }) => (
  <g transform={`translate(${-mod(offset, PERIOD)} 0)`}>
    {children}
    <g transform={`translate(${PERIOD} 0)`}>{children}</g>
  </g>
);

/* ---------- Lá momiji ---------- */
function momijiPath() {
  const angles = [-128, -82, -40, 0, 40, 82, 128];
  const lens = [22, 37, 46, 50, 46, 37, 22];
  const pt = (deg, r) => {
    const a = (deg * Math.PI) / 180;
    return `${(Math.sin(a) * r).toFixed(1)} ${(-Math.cos(a) * r).toFixed(1)}`;
  };
  let d = `M${pt(-170, 7)}`;
  angles.forEach((a, i) => {
    d += ` L${pt(a, lens[i])}`;
    const next = i < angles.length - 1 ? (a + angles[i + 1]) / 2 : 170;
    d += ` L${pt(next, i < angles.length - 1 ? 14 : 7)}`;
  });
  return `${d} Z`;
}
const LEAF = momijiPath();
const LEAF_COLORS = [C.momiji, "#B81D36", C.rail, C.icho, "#E8892B", C.momiji];
const LEAVES = Array.from({ length: 34 }, (_, i) => ({
  x0: random(`lx${i}`) * (W + 300),
  y0: random(`ly${i}`) * (H + 200),
  vy: 1.1 + random(`lv${i}`) * 2.1,
  vx: -(0.7 + random(`lw${i}`) * 1.9),
  size: 0.28 + random(`ls${i}`) * 0.5,
  rot0: random(`lr${i}`) * 360,
  rotV: (random(`lq${i}`) - 0.5) * 5,
  swayA: 14 + random(`la${i}`) * 34,
  swayF: 0.025 + random(`lf${i}`) * 0.04,
  flipF: 0.03 + random(`lg${i}`) * 0.06,
  phase: random(`lp${i}`) * TAU,
  color: LEAF_COLORS[i % LEAF_COLORS.length],
}));

const Leaves = ({ frame }) => (
  <g>
    {LEAVES.map((l, i) => {
      const x = mod(l.x0 + l.vx * frame + l.swayA * Math.sin(frame * l.swayF + l.phase), W + 300) - 150;
      const y = mod(l.y0 + l.vy * frame, H + 200) - 100;
      const flip = Math.cos(frame * l.flipF + l.phase);
      return (
        <g
          key={i}
          transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(l.rot0 + l.rotV * frame).toFixed(1)}) scale(${(l.size * flip).toFixed(3)} ${l.size})`}
        >
          <path d={LEAF} fill={l.color} />
          <path d="M0 4 L0 30" stroke={l.color} strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    })}
  </g>
);

/* ---------- Cầu treo ---------- */
const Bridge = ({ frame }) => {
  const local = frame - 372;
  const draw = interpolate(local, [0, 34], [0, 1], { ...clamp, easing: outQuint });
  const x = 520 - 0.95 * (frame - 372);
  const span = 520;
  const cable = `M-100 0 L0 -112 Q${span / 2} 62 ${span} -112 L${span + 100} 0`;
  const hangers = [];
  for (let hx = 26; hx < span; hx += 26) {
    const t = hx / span;
    const cy = -112 + 174 * 2 * t * (1 - t) * 1; // xấp xỉ parabol của cáp
    hangers.push(<line key={hx} x1={hx} y1={cy} x2={hx} y2={0} stroke={C.ink} strokeWidth={2} />);
  }
  const walker = interpolate(local, [30, 110], [40, span - 60], clamp);
  return (
    <g transform={`translate(${x} 505)`} opacity={interpolate(local, [0, 8], [0, 1], clamp)}>
      <g style={{ clipPath: `inset(-200px ${((1 - draw) * 100).toFixed(1)}% -50px -120px)` }}>
        <path d={cable} fill="none" stroke={C.ink} strokeWidth={5} strokeLinejoin="round" />
        {hangers}
        <rect x={-100} y={-3} width={span + 200} height={12} rx={3} fill={C.paper} stroke={C.ink} strokeWidth={3} />
        <rect x={-9} y={-124} width={18} height={150} rx={4} fill={C.momiji} stroke={C.ink} strokeWidth={3} />
        <rect x={span - 9} y={-124} width={18} height={150} rx={4} fill={C.momiji} stroke={C.ink} strokeWidth={3} />
      </g>
      {local > 30 &&
        [0, 34].map((gap, i) => {
          const bob = Math.abs(Math.sin((frame + i * 5) * 0.35)) * 4;
          return (
            <g key={i} transform={`translate(${walker - gap} ${-6 - bob})`}>
              <circle cx={0} cy={-30} r={7} fill={C.ink} />
              <rect x={-6} y={-23} width={12} height={22} rx={5} fill={i === 0 ? C.icho : C.paper} stroke={C.ink} strokeWidth={2.5} />
            </g>
          );
        })}
    </g>
  );
};

/* ---------- Đồng hồ trong ngày ---------- */
const clockMinutes = (f) =>
  interpolate(
    f,
    [0, 110, 138, 176, 212, 246, 262, 300, 450, 500, 545, 600],
    [440, 454, 454, 521, 578, 619, 630, 655, 925, 991, 1018, 1143],
    clamp
  );
const fmt = (m) => {
  const mm = Math.round(m);
  return `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`;
};

/* ---------- Biển tên ga ---------- */
const Sign = ({ frame, start, end, x, y, title, sub, kanji, tilt = 0 }) => {
  const s = spring({ frame: frame - start, fps: FPS, config: { damping: 13, stiffness: 140, mass: 0.8 } });
  const out = interpolate(frame, [end - 10, end], [1, 0], clamp);
  if (frame < start || frame > end) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translateY(${(1 - s) * 70}px) rotate(${tilt * s}deg) scale(${0.85 + 0.15 * s})`,
        opacity: Math.min(s * 1.6, 1) * out,
        background: C.paper,
        border: `4px solid ${C.ink}`,
        borderRadius: 10,
        boxShadow: `8px 8px 0 ${C.ink}`,
        overflow: "hidden",
        minWidth: 420,
      }}
    >
      <div style={{ padding: "18px 30px 14px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, justifyContent: "space-between" }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 50, lineHeight: 1.15, color: C.ink }}>{title}</div>
          <div style={{ fontFamily: DISPLAY, fontSize: 24, color: C.lake, opacity: 0.75 }}>{kanji}</div>
        </div>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 27, color: C.lake, marginTop: 4 }}>{sub}</div>
      </div>
      <div style={{ height: 14, background: C.rail }} />
    </div>
  );
};

/* ---------- Cảnh 1: tựa ---------- */
const Title = ({ frame }) => {
  if (frame > 128) return null;
  const out = interpolate(frame, [112, 126], [1, 0], clamp);
  const sub = spring({ frame: frame - 40, fps: FPS, config: { damping: 16, stiffness: 120 } });
  const stamp = spring({ frame: frame - 62, fps: FPS, config: { damping: 9, stiffness: 190, mass: 0.7 } });
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", left: 96, top: 92, display: "flex", gap: 6 }}>
        {["奥", "多", "摩"].map((ch, i) => {
          const s = spring({ frame: frame - 10 - i * 7, fps: FPS, config: { damping: 11, stiffness: 150, mass: 0.9 } });
          return (
            <div
              key={ch}
              style={{
                fontFamily: DISPLAY,
                fontSize: 232,
                lineHeight: 1,
                color: C.paper,
                textShadow: `10px 10px 0 ${C.ink}`,
                transform: `translateY(${(1 - s) * 140}px) rotate(${(1 - s) * (i - 1) * 14}deg)`,
                opacity: Math.min(s * 2, 1),
              }}
            >
              {ch}
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          left: 104,
          top: 356,
          fontFamily: DISPLAY,
          fontSize: 58,
          color: C.paper,
          textShadow: `5px 5px 0 ${C.ink}`,
          transform: `translateX(${(1 - sub) * -60}px)`,
          opacity: sub,
        }}
      >
        Một ngày ngắm lá đỏ
      </div>
      <div
        style={{
          position: "absolute",
          left: 890,
          top: 120,
          width: 270,
          height: 270,
          borderRadius: "50%",
          border: `10px solid ${C.momiji}`,
          boxShadow: `inset 0 0 0 5px ${C.paper}, inset 0 0 0 9px ${C.momiji}`,
          background: C.paper,
          color: C.momiji,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          transform: `rotate(-11deg) scale(${interpolate(stamp, [0, 1], [2.6, 1])})`,
          opacity: Math.min(stamp * 3, 1),
        }}
      >
        <div style={{ fontFamily: DISPLAY, fontSize: 34, letterSpacing: 8 }}>紅葉</div>
        <div style={{ fontFamily: DISPLAY, fontSize: 86, lineHeight: 1.05 }}>21.11</div>
        <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 30 }}>Thứ Bảy</div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Cảnh 2: tuyến đường ---------- */
const STOPS = [
  { x: 150, at: 138, time: "07:34", name: "Nhà mình", kanji: "獨協大学前" },
  { x: 430, at: 176, time: "08:41", name: "Nishi-Kokubunji", kanji: "西国分寺" },
  { x: 710, at: 212, time: "09:38", name: "Ōme", kanji: "青梅" },
  { x: 990, at: 246, time: "10:19", name: "Okutama", kanji: "奥多摩" },
];
const Route = ({ frame }) => {
  if (frame < 118 || frame > 282) return null;
  const inn = spring({ frame: frame - 120, fps: FPS, config: { damping: 15, stiffness: 120 } });
  const out = interpolate(frame, [268, 280], [1, 0], clamp);
  const head = interpolate(frame, [138, 176, 182, 212, 218, 246], [150, 430, 430, 710, 710, 990], { ...clamp, easing: Easing.inOut(Easing.quad) });
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        top: 150,
        width: 1140,
        height: 330,
        background: C.paper,
        border: `4px solid ${C.ink}`,
        borderRadius: 14,
        boxShadow: `10px 10px 0 ${C.ink}`,
        transform: `translateY(${(1 - inn) * -90}px)`,
        opacity: Math.min(inn * 1.5, 1) * out,
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", left: 40, top: 22, fontFamily: DISPLAY, fontSize: 34, color: C.ink }}>
        Từ nhà tới Okutama
      </div>
      <div style={{ position: "absolute", right: 40, top: 30, fontFamily: BODY, fontWeight: 700, fontSize: 24, color: C.lake }}>
        3 lần đổi tàu, IC 1.752 yên
      </div>
      <svg width={1140} height={330} style={{ position: "absolute", inset: 0 }}>
        <line x1={150} y1={190} x2={990} y2={190} stroke="#D5DDD6" strokeWidth={14} strokeLinecap="round" />
        <line x1={150} y1={190} x2={head} y2={190} stroke={C.rail} strokeWidth={14} strokeLinecap="round" />
        {STOPS.map((s) => {
          const p = spring({ frame: frame - s.at, fps: FPS, config: { damping: 9, stiffness: 200, mass: 0.6 } });
          return <circle key={s.name} cx={s.x} cy={190} r={17 * p} fill={C.paper} stroke={C.ink} strokeWidth={6} />;
        })}
        {/* đoàn tàu */}
        <g transform={`translate(${head - 60} ${150 + Math.sin(frame * 0.9) * (head < 990 ? 1.2 : 0)})`} opacity={frame >= 134 ? 1 : 0}>
          <rect x={0} y={0} width={104} height={34} rx={8} fill="#E9EEEA" stroke={C.ink} strokeWidth={4} />
          <rect x={2} y={20} width={100} height={8} fill={C.rail} />
          {[10, 34, 58, 82].map((wx) => (
            <rect key={wx} x={wx} y={6} width={15} height={11} rx={2} fill={C.lake} />
          ))}
        </g>
      </svg>
      {STOPS.map((s) => {
        const p = spring({ frame: frame - s.at, fps: FPS, config: { damping: 14, stiffness: 160 } });
        return (
          <div
            key={s.name}
            style={{
              position: "absolute",
              left: s.x - 120,
              width: 240,
              top: 88,
              textAlign: "center",
              opacity: p,
              transform: `translateY(${(1 - p) * 14}px)`,
            }}
          >
            <div style={{ fontFamily: DISPLAY, fontSize: 36, color: C.ink, height: 52 }}>{s.time}</div>
            <div style={{ height: 76 }} />
            <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 27, color: C.ink }}>{s.name}</div>
            <div style={{ fontFamily: DISPLAY, fontSize: 19, color: C.lake, opacity: 0.7, marginTop: 2 }}>{s.kanji}</div>
          </div>
        );
      })}
    </div>
  );
};

/* ---------- Cảnh 4: hoàng hôn + hẹn giờ ---------- */
const Line = ({ frame, at, children, size = 54, top }) => {
  const s = spring({ frame: frame - at, fps: FPS, config: { damping: 15, stiffness: 130 } });
  return (
    <div
      style={{
        position: "absolute",
        left: 96,
        top,
        fontFamily: DISPLAY,
        fontSize: size,
        color: C.paper,
        textShadow: `5px 5px 0 ${C.ink}`,
        transform: `translateX(${(1 - s) * -70}px)`,
        opacity: s,
      }}
    >
      {children}
    </div>
  );
};
const Ending = ({ frame }) => {
  if (frame < 452) return null;
  const listOut = interpolate(frame, [536, 546], [1, 0], clamp);
  const end = spring({ frame: frame - 548, fps: FPS, config: { damping: 12, stiffness: 150 } });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: listOut }}>
        <Line frame={frame} at={458} top={110}>16:31 mặt trời lặn</Line>
        <Line frame={frame} at={480} top={196}>Ngâm onsen Moegi no Yu</Line>
        <Line frame={frame} at={502} top={282}>16:58 tàu về, 19:03 tới nhà</Line>
      </AbsoluteFill>
      {frame >= 546 && (
        <div
          style={{
            position: "absolute",
            left: 96,
            top: 120,
            transform: `scale(${0.8 + 0.2 * end})`,
            transformOrigin: "left top",
            opacity: Math.min(end * 2, 1),
          }}
        >
          <div style={{ fontFamily: DISPLAY, fontSize: 150, lineHeight: 1.1, color: C.paper, textShadow: `9px 9px 0 ${C.ink}` }}>
            Hẹn 10:30
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: 52, color: C.icho, textShadow: `5px 5px 0 ${C.ink}`, marginTop: 6 }}>
            Trước cửa ga Okutama
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

/* ---------- Tổng thể ---------- */
export const Trailer = () => {
  const frame = useCurrentFrame();

  const skyTop = interpolateColors(frame, [0, 120, 320, 450, 540, 600], ["#2B4460", "#5FA3BF", "#6FB6CC", "#D9824F", "#3A2E5C", "#231F45"]);
  const skyBottom = interpolateColors(frame, [0, 120, 320, 450, 540, 600], ["#F4B9A0", "#DDF0EE", "#E6F3EE", "#F9C56B", "#E4572E", "#8A3B5C"]);
  const sunT = interpolate(frame, [0, 560], [0.04, 1], clamp);
  const sunX = 140 + sunT * 1000;
  const sunY = 590 - Math.sin(Math.PI * sunT) * 470;
  const sunColor = interpolateColors(frame, [0, 120, 400, 520], ["#FFD0A0", "#FFF6CF", "#FFF0B0", "#FF5A36"]);
  const dusk = interpolate(frame, [450, 560], [0, 0.5], clamp);
  const dawn = interpolate(frame, [0, 90], [0.28, 0], clamp);
  const fade = Math.min(interpolate(frame, [0, 12], [1, 0], clamp) + interpolate(frame, [588, 599], [0, 1], clamp), 1);

  return (
    <AbsoluteFill style={{ background: C.deep }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={skyTop} />
            <stop offset="0.72" stopColor={skyBottom} />
          </linearGradient>
          <radialGradient id="glow">
            <stop offset="0" stopColor={sunColor} stopOpacity="0.75" />
            <stop offset="1" stopColor={sunColor} stopOpacity="0" />
          </radialGradient>
          <filter id="soft" x="-20%" y="-100%" width="140%" height="300%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
        </defs>
        <rect width={W} height={H} fill="url(#sky)" />
        <circle cx={sunX} cy={sunY} r={190} fill="url(#glow)" />
        <circle cx={sunX} cy={sunY} r={54} fill={sunColor} />

        <Tiled offset={frame * 0.25}>
          <path d={FAR} fill="#7FA9AE" />
        </Tiled>
        <Tiled offset={frame * 0.45}>
          <path d={MID} fill="#3F7577" />
        </Tiled>
        <g filter="url(#soft)" opacity={0.75}>
          <ellipse cx={mod(900 - frame * 0.5, W + 700) - 350} cy={430} rx={360} ry={22} fill="#F6F8F3" />
          <ellipse cx={mod(200 - frame * 0.35, W + 700) - 350} cy={470} rx={420} ry={26} fill="#F6F8F3" />
        </g>
        <Tiled offset={frame * 0.7}>
          <path d={AUT_BACK} fill="#8F4A35" />
          {CANOPY_BACK.map((b, i) => (
            <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={b.color} />
          ))}
        </Tiled>
        <Tiled offset={frame * 0.95}>
          <path d={AUT_FRONT} fill="#7A2130" />
          {CANOPY_FRONT.map((b, i) => (
            <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={b.color} />
          ))}
        </Tiled>
        {frame >= 372 && frame < 470 && <Bridge frame={frame} />}
        <Tiled offset={frame * 1.7}>
          {CEDARS.map((t, i) => (
            <path key={i} d={`M${t.x - t.w / 2} ${t.y} L${t.x} ${t.y - t.h} L${t.x + t.w / 2} ${t.y} Z`} fill={C.deep} />
          ))}
          <path d={FRONT} fill={C.deep} />
        </Tiled>

        <rect width={W} height={H} fill="#1C1642" opacity={dusk} style={{ mixBlendMode: "multiply" }} />
        <rect width={W} height={H} fill="#2B2F5C" opacity={dawn} style={{ mixBlendMode: "multiply" }} />
        <Leaves frame={frame} />
      </svg>

      <Title frame={frame} />
      <Route frame={frame} />
      <Sign frame={frame} start={284} end={338} x={90} y={96} tilt={-2} title="Hồ Okutama" kanji="奥多摩湖" sub="Đập Ogouchi, mặt hồ màu ngọc" />
      <Sign frame={frame} start={330} end={384} x={640} y={150} tilt={2} title="Mukashi Michi" kanji="むかし道" sub="10 km đường xưa, xuôi dốc" />
      <Sign frame={frame} start={384} end={448} x={110} y={84} tilt={-1.5} title="Cầu treo Shidakura" kanji="しだくら橋" sub="Đứng giữa khe núi sông Tama" />
      <Ending frame={frame} />

      {/* đồng hồ trong ngày */}
      <div
        style={{
          position: "absolute",
          right: 44,
          bottom: 40,
          background: C.ink,
          color: C.icho,
          fontFamily: DISPLAY,
          fontSize: 44,
          padding: "6px 22px 8px",
          borderRadius: 10,
          border: `3px solid ${C.paper}`,
          fontVariantNumeric: "tabular-nums",
          opacity: interpolate(frame, [70, 90], [0, 1], clamp),
        }}
      >
        {fmt(clockMinutes(frame))}
      </div>

      <AbsoluteFill style={{ background: C.deep, opacity: fade }} />
    </AbsoluteFill>
  );
};
