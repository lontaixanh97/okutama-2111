"""Dựng hai cung đường từ dữ liệu OpenStreetMap + độ cao GSI, xuất js/routes.js"""
import json, math, heapq, sys, time, urllib.request, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'routes.js')
data = json.load(open(os.path.join(HERE, 'net.json')))

def hav(a, b):
    R = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))

# ---------- đồ thị đường đi ----------
coord = {}
adj = {}
ways = [e for e in data['elements'] if e['type'] == 'way' and 'geometry' in e]

def factor(t, mode):
    hw = t.get('highway')
    if hw in ('motorway', 'motorway_link', 'construction', 'proposed'):
        return None
    if t.get('access') in ('private', 'no') or t.get('foot') == 'no':
        return 30
    f = 1.0
    if hw in ('trunk', 'trunk_link', 'primary'):
        f = mode.get('trunk', 6)
    elif hw in ('secondary', 'tertiary'):
        f = mode.get('secondary', 2.2)
    elif hw in ('path', 'footway', 'steps', 'pedestrian'):
        f = mode.get('path', 0.9)
    if t.get('tunnel') == 'yes':
        f *= mode.get('tunnel', 4)
    if 'むかし' in t.get('name', ''):
        f = mode.get('mukashi', 0.3)
    return f

def build(mode, blocked=()):
    adj.clear()
    for w in ways:
        t = w.get('tags', {})
        if 'highway' not in t or w['id'] in blocked:
            continue
        f = factor(t, mode)
        if f is None:
            continue
        ns, g = w['nodes'], w['geometry']
        for i in range(len(ns) - 1):
            a, b = ns[i], ns[i + 1]
            pa, pb = (g[i]['lat'], g[i]['lon']), (g[i + 1]['lat'], g[i + 1]['lon'])
            coord[a], coord[b] = pa, pb
            d = hav(pa, pb)
            adj.setdefault(a, []).append((b, d * f, d))
            adj.setdefault(b, []).append((a, d * f, d))

def nearest(p):
    best, bd = None, 1e9
    for n in adj:
        d = hav(p, coord[n])
        if d < bd:
            best, bd = n, d
    return best, bd

def dijkstra(s, t):
    dist, prev, pq = {s: 0}, {}, [(0, s)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == t:
            break
        if d > dist.get(u, 1e18):
            continue
        for v, w, _ in adj.get(u, ()):
            nd = d + w
            if nd < dist.get(v, 1e18):
                dist[v], prev[v] = nd, u
                heapq.heappush(pq, (nd, v))
    if t not in dist:
        raise SystemExit(f'không nối được {s} -> {t}')
    path = [t]
    while path[-1] != s:
        path.append(prev[path[-1]])
    return path[::-1]

def route(vias, mode, blocked=()):
    build(mode, blocked)
    nodes = []
    for name, p in vias:
        n, d = nearest(p)
        print(f'   via {name}: snap {d:.0f} m')
        nodes.append(n)
    full = [nodes[0]]
    for a, b in zip(nodes, nodes[1:]):
        full += dijkstra(a, b)[1:]
    return [coord[n] for n in full]

def length(pts):
    return sum(hav(a, b) for a, b in zip(pts, pts[1:]))

def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    lat0 = math.radians(pts[0][0])
    def xy(p):
        return (p[1] * math.cos(lat0) * 111320, p[0] * 110540)
    def perp(p, a, b):
        (x, y), (x1, y1), (x2, y2) = xy(p), xy(a), xy(b)
        dx, dy = x2 - x1, y2 - y1
        if dx == dy == 0:
            return math.hypot(x - x1, y - y1)
        t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
        return math.hypot(x - x1 - t * dx, y - y1 - t * dy)
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        m, md = None, 0
        for k in range(i + 1, j):
            d = perp(pts[k], pts[i], pts[j])
            if d > md:
                m, md = k, d
        if m is not None and md > eps:
            keep[m] = True
            stack += [(i, m), (m, j)]
    return [p for p, k in zip(pts, keep) if k]

def resample(pts, step):
    out, acc, dists = [pts[0]], 0.0, [0.0]
    total = 0.0
    for a, b in zip(pts, pts[1:]):
        d = hav(a, b)
        while acc + d >= step and d > 0:
            t = (step - acc) / d
            a = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
            total += step - acc
            out.append(a); dists.append(total)
            d = hav(a, b); acc = 0.0
        acc += d; total += d
    out.append(pts[-1]); dists.append(length(pts))
    return out, dists

CACHE = os.path.join(HERE, 'ele_cache.json')
ele_cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
def elevation(p):
    k = f'{p[0]:.5f},{p[1]:.5f}'
    if k not in ele_cache:
        url = f'https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon={p[1]:.6f}&lat={p[0]:.6f}&outtype=JSON'
        for _ in range(4):
            try:
                v = json.load(urllib.request.urlopen(url, timeout=20))['elevation']
                ele_cache[k] = v if isinstance(v, (int, float)) else None
                break
            except Exception:
                time.sleep(1.5)
        else:
            ele_cache[k] = None
        time.sleep(0.12)
    return ele_cache[k]

# ---------- định nghĩa hai cung ----------
ROUTES = json.load(open(os.path.join(HERE, 'routes_def.json'), encoding='utf-8'))
result = {}
for key, R in ROUTES.items():
    print('==', key, R['name'])
    pts = route([(v[0], (v[1], v[2])) for v in R['vias']], R.get('mode', {}), set(R.get('blocked', [])))
    L = length(pts)
    samp, dists = resample(pts, R.get('step', 100))
    eles = [elevation(p) for p in samp]
    json.dump(ele_cache, open(CACHE, 'w'))
    # lấp chỗ thiếu + làm mượt nhẹ (hầm, cầu)
    for i, e in enumerate(eles):
        if e is None:
            eles[i] = next((x for x in eles[i:] if x is not None), None) or next(x for x in reversed(eles[:i]) if x is not None)
    sm = [sum(eles[max(0, i - 1):i + 2]) / len(eles[max(0, i - 1):i + 2]) for i in range(len(eles))]
    up = sum(max(0, b - a) for a, b in zip(sm, sm[1:]))
    down = sum(max(0, a - b) for a, b in zip(sm, sm[1:]))
    print(f'   dài {L/1000:.2f} km | lên {up:.0f} m | xuống {down:.0f} m | cao {min(sm):.0f}-{max(sm):.0f} m | {len(pts)} điểm')

    # ---------- chiếu lên khung SVG ----------
    lats, lons = [p[0] for p in pts], [p[1] for p in pts]
    for poi in R['pois']:
        lats.append(poi[1]); lons.append(poi[2])
    mlat, mlon = R.get('pad_lat', 0.0035), R.get('pad_lon', 0.004)
    S, N, Wd, E = min(lats) - mlat, max(lats) + mlat, min(lons) - mlon, max(lons) + mlon
    c = math.cos(math.radians((S + N) / 2))
    Wpx = 1000.0
    k = Wpx / ((E - Wd) * c)
    Hpx = (N - S) * k
    def P(p):
        return [round((p[1] - Wd) * c * k, 1), round((N - p[0]) * k, 1)]
    def inside(p, m=0.004):
        return S - m <= p[0] <= N + m and Wd - m <= p[1] <= E + m
    def clip_lines(geom):
        segs, cur = [], []
        for g in geom:
            p = (g['lat'], g['lon'])
            if inside(p):
                cur.append(p)
            else:
                if len(cur) > 1: segs.append(cur)
                cur = []
        if len(cur) > 1: segs.append(cur)
        return segs
    feats = {'river': [], 'stream': [], 'water': [], 'road': [], 'minor': [], 'rail': []}
    for e in data['elements']:
        t = e.get('tags', {})
        geoms = []
        if e['type'] == 'way' and 'geometry' in e:
            geoms = [e['geometry']]
        elif e['type'] == 'relation':
            geoms = [m['geometry'] for m in e.get('members', []) if m.get('role') == 'outer' and 'geometry' in m]
        for g in geoms:
            if t.get('natural') == 'water':
                poly = [(q['lat'], q['lon']) for q in g]
                if any(inside(q, 0) for q in poly) and length(poly) > 150:
                    feats['water'].append([P(q) for q in rdp(poly, 5)])
                continue
            kind = None
            if t.get('waterway') == 'river': kind = 'river'
            elif t.get('waterway') == 'stream': kind = 'stream'
            elif t.get('railway') == 'rail' and t.get('service') is None: kind = 'rail'
            elif t.get('highway') in ('trunk', 'primary'): kind = 'road'
            elif t.get('highway') in ('secondary', 'tertiary', 'unclassified', 'residential'): kind = 'minor'
            if not kind: continue
            for seg in clip_lines(g):
                if kind in ('stream', 'minor') and length(seg) < 120: continue
                feats[kind].append([P(q) for q in rdp(seg, 6 if kind != 'river' else 4)])
    trail = [P(p) for p in rdp(pts, 3)]
    # khoảng cách dọc tuyến của từng điểm mốc (điểm gần nhất trên tuyến)
    cum = [0.0]
    for a, b in zip(pts, pts[1:]): cum.append(cum[-1] + hav(a, b))
    pois = []
    for name, la, lo, *rest in R['pois']:
        i = min(range(len(pts)), key=lambda j: hav(pts[j], (la, lo)))
        pois.append({'name': name, 'xy': P((la, lo)), 'at': round(cum[i] / L, 4), 'off': round(hav(pts[i], (la, lo)))})
        print(f'   mốc {name}: km {cum[i]/1000:.2f}, lệch {hav(pts[i], (la, lo)):.0f} m')
    result[key] = {
        'name': R['name'], 'w': Wpx, 'h': round(Hpx, 1), 'km': round(L / 1000, 2),
        'up': round(up), 'down': round(down), 'min': round(min(sm)), 'max': round(max(sm)),
        'trail': trail, 'pois': pois,
        'profile': [[round(d / L, 4), round(e, 1)] for d, e in zip(dists, sm)],
        'feats': feats,
        'mpp': round(1 / k * 110540, 2),
        'gmaps': R.get('gmaps', ''),
    }

js = '/* Tạo tự động từ dữ liệu OpenStreetMap (ODbL) và độ cao GSI. Đừng sửa tay. */\nwindow.OKUTAMA_ROUTES = ' + json.dumps(result, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(OUT, 'w', encoding='utf-8').write(js)
print('ghi', OUT, len(js), 'byte')
