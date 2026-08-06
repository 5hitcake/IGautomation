// Tafelrunde - rules module (Tier 1: turn-based, no imports, no timers).
// Co-op hex-grid tactics: 1-4 human heroes vs CPU-controlled enemies.
// State is plain JSON (numbers/strings/booleans/arrays/objects only).

export const meta = { game: "tafelrunde", minPlayers: 1, maxPlayers: 4 };

// ---------- hex helpers (axial coordinates) ----------
function key(q, r) { return q + "," + r; }
function hexDist(a, b) {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}
const DIRS = [{ q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }];
function neighbors(q, r) { return DIRS.map(d => ({ q: q + d.q, r: r + d.r })); }
function inBounds(q, r, radius) {
  return Math.abs(q) <= radius && Math.abs(r) <= radius && Math.abs(q + r) <= radius;
}

function obstacleSet(state) {
  const s = new Set();
  for (const o of state.board.obstacles) s.add(key(o.q, o.r));
  return s;
}
function livingHeroes(state) { return state.heroes.filter(h => h.hp > 0); }
function livingEnemies(state) { return state.enemies.filter(e => e.active && e.hp > 0); }
function occupantAt(state, q, r) {
  for (const h of state.heroes) if (h.hp > 0 && h.q === q && h.r === r) return { kind: "hero", unit: h };
  for (const e of state.enemies) if (e.active && e.hp > 0 && e.q === q && e.r === r) return { kind: "enemy", unit: e };
  return null;
}

// BFS reachable empty hexes within `range` steps, stepping only through empty (non-obstacle, non-occupied) hexes.
function reachable(state, from, range) {
  const obst = obstacleSet(state);
  const seen = new Map();
  seen.set(key(from.q, from.r), 0);
  let frontier = [from];
  for (let step = 1; step <= range; step++) {
    const next = [];
    for (const cell of frontier) {
      for (const n of neighbors(cell.q, cell.r)) {
        const k = key(n.q, n.r);
        if (seen.has(k)) continue;
        if (!inBounds(n.q, n.r, state.board.radius)) continue;
        if (obst.has(k)) continue;
        if (occupantAt(state, n.q, n.r)) continue;
        seen.set(k, step);
        next.push(n);
      }
    }
    frontier = next;
  }
  return seen; // key -> steps
}

function stepToward(state, from, to) {
  const obst = obstacleSet(state);
  let best = null, bestDist = hexDist(from, to);
  for (const n of neighbors(from.q, from.r)) {
    if (!inBounds(n.q, n.r, state.board.radius)) continue;
    const k = key(n.q, n.r);
    if (obst.has(k)) continue;
    const occ = occupantAt(state, n.q, n.r);
    if (occ) continue;
    const d = hexDist(n, to);
    if (d < bestDist) { bestDist = d; best = n; }
  }
  return best;
}

// ---------- class / enemy definitions ----------
const HERO_CLASSES = {
  waechter: { name: "Wächter", hp: 22, moveRange: 2, atkRange: 1, atkBase: 3, atkVar: 2, shieldGain: 4 },
  wildhueter: { name: "Wildhüter", hp: 15, moveRange: 2, atkRange: 3, atkBase: 2, atkVar: 2, specialRange: 3 },
};
const ENEMY_DEFS = {
  raider: { hp: 8, moveRange: 2, atkRange: 1, dmgBase: 1, dmgVar: 2 },
  archer: { hp: 6, moveRange: 2, atkRange: 3, dmgBase: 1, dmgVar: 2 },
  captain: { hp: 20, moveRange: 2, atkRange: 1, dmgBase: 3, dmgVar: 3 },
};

const OBSTACLES = [
  { q: 0, r: -2, type: "rock" }, { q: -1, r: 1, type: "rock" }, { q: 1, r: 1, type: "rock" },
  { q: 0, r: 2, type: "tree" }, { q: 2, r: -2, type: "tree" }, { q: -2, r: -1, type: "tree" },
];
const HERO_SPAWNS = [{ q: -4, r: 0 }, { q: -4, r: 1 }, { q: -4, r: 2 }, { q: -4, r: 3 }];
const RAIDER_SPAWNS = [{ q: 3, r: -3 }, { q: 3, r: -2 }, { q: 3, r: -1 }, { q: 3, r: 0 }, { q: 3, r: 1 }];
const ARCHER_SPAWNS = [{ q: 4, r: -3 }, { q: 4, r: -2 }, { q: 4, r: -1 }];
const CAPTAIN_SPAWN = { q: 4, r: 0 };
const MAX_ROUNDS = 30;

export function setup(players) {
  const n = players.length;
  const heroes = players.map((pid, i) => {
    const cls = i % 2 === 0 ? "waechter" : "wildhueter";
    const def = HERO_CLASSES[cls];
    const sp = HERO_SPAWNS[i];
    return { playerId: pid, cls, hp: def.hp, maxHp: def.hp, shield: 0, q: sp.q, r: sp.r, acted: false };
  });

  const raiderCount = n + 1;
  const archerCount = Math.floor(n / 2) + 1;
  const enemies = [];
  let eid = 0;
  for (let i = 0; i < raiderCount; i++) {
    const sp = RAIDER_SPAWNS[i % RAIDER_SPAWNS.length];
    enemies.push({ id: "e" + (eid++), type: "raider", hp: ENEMY_DEFS.raider.hp, maxHp: ENEMY_DEFS.raider.hp, q: sp.q, r: sp.r, active: true });
  }
  for (let i = 0; i < archerCount; i++) {
    const sp = ARCHER_SPAWNS[i % ARCHER_SPAWNS.length];
    enemies.push({ id: "e" + (eid++), type: "archer", hp: ENEMY_DEFS.archer.hp, maxHp: ENEMY_DEFS.archer.hp, q: sp.q, r: sp.r, active: true });
  }
  const captainHp = ENEMY_DEFS.captain.hp + 4 * (n - 1);
  enemies.push({ id: "e" + (eid++), type: "captain", hp: captainHp, maxHp: captainHp, q: CAPTAIN_SPAWN.q, r: CAPTAIN_SPAWN.r, active: false });

  return {
    board: { radius: 4, obstacles: OBSTACLES },
    players: players.slice(),
    heroes,
    enemies,
    round: 1,
    phase: "hero",
    activeHeroIdx: 0,
    taunt: null,
    log: [],
    over: null,
  };
}

function nextActiveHeroIdx(state, fromIdx) {
  for (let i = 0; i < state.heroes.length; i++) {
    const idx = (fromIdx + i) % state.heroes.length;
    const h = state.heroes[idx];
    if (h.hp > 0 && !h.acted) return idx;
  }
  return -1;
}

function pushLog(state, msg) {
  state.log = [...state.log.slice(-19), msg];
}

function dealDamage(target, dmg) {
  let remaining = dmg;
  if (target.shield && target.shield > 0) {
    const absorbed = Math.min(target.shield, remaining);
    target.shield -= absorbed;
    remaining -= absorbed;
  }
  target.hp = Math.max(0, target.hp - remaining);
}

function runEnemyPhase(state) {
  const alive = () => livingHeroes(state);
  for (const e of state.enemies) {
    if (!e.active || e.hp <= 0) continue;
    const heroesAlive = alive();
    if (heroesAlive.length === 0) break;
    let target = null;
    if (state.taunt) {
      const t = state.heroes.find(h => h.playerId === state.taunt.heroPlayerId && h.hp > 0);
      if (t) target = t;
    }
    if (!target) {
      target = heroesAlive.reduce((best, h) => {
        const d = hexDist(e, h);
        return !best || d < best.d ? { h, d } : best;
      }, null).h;
    }
    const def = ENEMY_DEFS[e.type];
    if (hexDist(e, target) > def.atkRange) {
      for (let step = 0; step < def.moveRange && hexDist(e, target) > def.atkRange; step++) {
        const next = stepToward(state, e, target);
        if (!next) break;
        e.q = next.q; e.r = next.r;
      }
    }
    if (hexDist(e, target) <= def.atkRange) {
      const dmg = def.dmgBase + Math.floor(Math.random() * def.dmgVar);
      dealDamage(target, dmg);
      pushLog(state, e.type + " trifft " + target.cls + " für " + dmg);
    }
  }
  state.taunt = null;

  const nonCaptainAlive = state.enemies.some(e => e.type !== "captain" && e.active && e.hp > 0);
  const captain = state.enemies.find(e => e.type === "captain");
  if (!nonCaptainAlive && captain && !captain.active) {
    captain.active = true;
    pushLog(state, "Der Hauptmann erscheint!");
  }
}

function checkGameOver(state) {
  if (livingHeroes(state).length === 0) {
    state.over = { over: true, outcome: "lose", winner: null, draw: false };
    return;
  }
  const captain = state.enemies.find(e => e.type === "captain");
  const enemiesRemaining = state.enemies.some(e => e.type !== "captain" && e.hp > 0) || (captain && captain.hp > 0);
  if (!enemiesRemaining) {
    state.over = { over: true, outcome: "win", winner: "team", draw: false };
    return;
  }
  if (state.round > MAX_ROUNDS) {
    state.over = { over: true, outcome: "lose", winner: null, draw: false };
  }
}

export function validateAction(state, playerId, action) {
  if (state.over) return { ok: false, error: "das Spiel ist bereits vorbei" };
  if (state.phase !== "hero") return { ok: false, error: "die Gegner sind noch am Zug" };
  const idx = state.heroes.findIndex(h => h.playerId === playerId);
  if (idx === -1) return { ok: false, error: "du steuerst keinen Helden in dieser Partie" };
  const hero = state.heroes[idx];
  if (hero.hp <= 0) return { ok: false, error: "dein Held ist besiegt" };
  if (hero.acted) return { ok: false, error: "du hast diese Runde schon eine Karte gespielt" };
  if (state.activeHeroIdx !== idx) return { ok: false, error: "nicht dein Zug" };
  if (!action || !["move", "attack", "special"].includes(action.card)) {
    return { ok: false, error: "unbekannte Karte" };
  }
  if (!Number.isInteger(action.q) || !Number.isInteger(action.r)) {
    return { ok: false, error: "Zielfeld fehlt" };
  }
  const def = HERO_CLASSES[hero.cls];
  const dist = hexDist(hero, action);

  if (action.card === "move") {
    if (!inBounds(action.q, action.r, state.board.radius)) return { ok: false, error: "Ziel liegt außerhalb des Bretts" };
    const r = reachable(state, hero, def.moveRange);
    if (!r.has(key(action.q, action.r)) || (action.q === hero.q && action.r === hero.r)) {
      return { ok: false, error: "Feld nicht erreichbar" };
    }
    return { ok: true };
  }
  if (action.card === "attack") {
    if (dist > def.atkRange) return { ok: false, error: "Ziel außer Reichweite" };
    const occ = occupantAt(state, action.q, action.r);
    if (!occ || occ.kind !== "enemy") return { ok: false, error: "dort steht kein Gegner" };
    return { ok: true };
  }
  if (action.card === "special") {
    if (hero.cls === "waechter") {
      return { ok: true }; // self-cast, target ignored
    } else {
      const range = HERO_CLASSES.wildhueter.specialRange;
      if (dist > range) return { ok: false, error: "Ziel außer Reichweite" };
      const occ = occupantAt(state, action.q, action.r);
      if (!occ || occ.kind !== "enemy") return { ok: false, error: "dort steht kein Gegner" };
      return { ok: true };
    }
  }
  return { ok: false, error: "ungültige Aktion" };
}

export function applyAction(state, playerId, action) {
  const s = JSON.parse(JSON.stringify(state));
  const idx = s.heroes.findIndex(h => h.playerId === playerId);
  const hero = s.heroes[idx];
  const def = HERO_CLASSES[hero.cls];

  if (action.card === "move") {
    hero.q = action.q; hero.r = action.r;
    pushLog(s, hero.cls + " zieht um");
  } else if (action.card === "attack") {
    const occ = occupantAt(s, action.q, action.r);
    const dmg = def.atkBase + Math.floor(Math.random() * def.atkVar);
    dealDamage(occ.unit, dmg);
    pushLog(s, hero.cls + " greift an: " + dmg + " Schaden");
  } else if (action.card === "special") {
    if (hero.cls === "waechter") {
      hero.shield += def.shieldGain;
      s.taunt = { heroPlayerId: playerId, round: s.round };
      pushLog(s, "Wächter ruft Schildwall aus");
    } else {
      const occ = occupantAt(s, action.q, action.r);
      dealDamage(occ.unit, 3);
      for (const n of neighbors(action.q, action.r)) {
        const near = occupantAt(s, n.q, n.r);
        if (near && near.kind === "enemy") dealDamage(near.unit, 1);
      }
      pushLog(s, "Wildhüter schießt Fallenpfeil");
    }
  }
  hero.acted = true;

  const next = nextActiveHeroIdx(s, idx + 1);
  if (next === -1) {
    s.phase = "enemy";
    runEnemyPhase(s);
    checkGameOver(s);
    if (!s.over) {
      s.round += 1;
      s.phase = "hero";
      for (const h of s.heroes) h.acted = false;
      const firstAlive = nextActiveHeroIdx(s, 0);
      s.activeHeroIdx = firstAlive === -1 ? 0 : firstAlive;
    }
  } else {
    s.activeHeroIdx = next;
    checkGameOver(s);
  }
  return s;
}

export function isGameOver(state) {
  if (state.over) return state.over;
  return { over: false };
}

export function viewFor(state, _playerId) {
  return state; // co-op, no hidden information in this version
}
