import { posKeys, sport } from './esportes.js';
import { lvl, ppos, rat, rodadas } from './grupo.js';
import { key, shuffle } from '../nucleo/util.js';

/* =================== sorteio inteligente =================== */
function history(exclude) {
  const h = {};
  rodadas()
    .filter(r => r.id !== exclude && r.times)
    .forEach((r, i) => {
      const wt = Math.pow(0.8, i);
      r.times.forEach(t => {
        const p = t.players;
        for (let x = 0; x < p.length; x++)
          for (let y = x + 1; y < p.length; y++) {
            const k = key(p[x], p[y]);
            h[k] = (h[k] || 0) + wt;
          }
      });
    });
  return h;
}
function draw(pids, n, novelty, rid) {
  const R = rat(),
    st = id => lvl(id) / 2;
  const hist = history(rid),
    sep = new Set((R.sep || []).map(([a, b]) => key(a, b)));
  const N = pids.length,
    sizes = Array.from({ length: n }, (_, i) => Math.floor(N / n) + (i < N % n ? 1 : 0)),
    wN = [0, 1.5, 4, 9][novelty] ?? 4;
  const P = {};
  pids.forEach(id => (P[id] = ppos(id)));
  function cost(T) {
    let c = 0;
    const avg = T.map(t => (t.reduce((s, id) => s + st(id), 0) / t.length) * (N / n));
    c += (Math.max(...avg) - Math.min(...avg)) ** 2 * 6;
    const KEY = sport().key;
    for (const p of posKeys()) {
      const cn = T.map(t => t.filter(id => P[id] === p).length),
        d = Math.max(...cn) - Math.min(...cn);
      c += d * (p === KEY ? 6 : 2) + (d > 1 ? (d - 1) ** 2 * (p === KEY ? 60 : 10) : 0);
    }
    const cr = T.map(t => t.filter(id => lvl(id) >= 9).length);
    if (Math.max(...cr) - Math.min(...cr) > 1) c += 25;
    for (const t of T)
      for (let x = 0; x < t.length; x++)
        for (let y = x + 1; y < t.length; y++) {
          const k = key(t[x], t[y]);
          if (sep.has(k)) c += 500;
          if (hist[k]) c += hist[k] * wN;
        }
    return c;
  }
  const sols = [],
    seen = new Set(),
    RS = N > 20 ? 50 : 120;
  for (let r = 0; r < RS; r++) {
    const sh = shuffle(pids.slice()),
      T = [];
    let k = 0;
    sizes.forEach(s => {
      T.push(sh.slice(k, k + s));
      k += s;
    });
    let c = cost(T),
      imp = true,
      g = 0;
    while (imp && g++ < 40) {
      imp = false;
      for (let a = 0; a < n; a++)
        for (let b = a + 1; b < n; b++)
          for (let i = 0; i < T[a].length; i++)
            for (let j = 0; j < T[b].length; j++) {
              [T[a][i], T[b][j]] = [T[b][j], T[a][i]];
              const c2 = cost(T);
              if (c2 < c - 1e-9) {
                c = c2;
                imp = true;
              } else [T[a][i], T[b][j]] = [T[b][j], T[a][i]];
            }
    }
    const sig = T.map(t => t.slice().sort().join(','))
      .sort()
      .join('/');
    if (!seen.has(sig)) {
      seen.add(sig);
      sols.push({ T: T.map(t => t.slice()), c });
    }
  }
  sols.sort((a, b) => a.c - b.c);
  const best = sols[0].c,
    pool = sols.filter(s => s.c <= best + Math.max(2, best * 0.08)).slice(0, 6);
  return pool[Math.floor(Math.random() * pool.length)].T;
}
function quality(r) {
  if (!r.times) return null;
  const R = rat(),
    st = id => lvl(id);
  const avg = r.times.map(t => t.players.reduce((s, id) => s + st(id), 0) / Math.max(1, t.players.length));
  const sep = new Set((R.sep || []).map(([a, b]) => key(a, b)));
  let viol = 0,
    pairs = 0,
    rep = 0;
  const prev = rodadas().filter(x => x.id !== r.id && x.times && (x.date || '') <= (r.date || '9'))[0];
  const ps = new Set();
  if (prev)
    prev.times.forEach(t => {
      const p = t.players;
      for (let x = 0; x < p.length; x++) for (let y = x + 1; y < p.length; y++) ps.add(key(p[x], p[y]));
    });
  r.times.forEach(t => {
    const p = t.players;
    for (let x = 0; x < p.length; x++)
      for (let y = x + 1; y < p.length; y++) {
        const k = key(p[x], p[y]);
        pairs++;
        if (sep.has(k)) viol++;
        if (ps.has(k)) rep++;
      }
  });
  return {
    diff: Math.max(...avg) - Math.min(...avg),
    viol,
    nsep: (R.sep || []).length,
    newPct: prev && pairs ? Math.round((1 - rep / pairs) * 100) : null,
    gk: sport().key ? r.times.map(t => t.players.filter(id => ppos(id) === sport().key).length) : null,
  };
}

export { draw, history, quality };
