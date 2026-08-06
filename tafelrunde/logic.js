// Tafelrunde - rules module (Tier 1: turn-based, no imports, no timers).
// Co-op hex-grid tactics: 1-4 human heroes vs CPU-controlled enemies.
// Each card is a fixed SEQUENCE of steps (e.g. move -> attack, or attack -> shield).
// Playing a card means resolving its steps in order; steps that need a player-picked
// target (move/attack) wait for the next action, self-only steps (shield/splash)
// resolve immediately in the same call.
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

// ---------- class / card / enemy definitions ----------
const HERO_CLASSES = {
  waechter: { name: "Wächter", hp: 22 },
  wildhueter: { name: "Wildhüter", hp: 15 },
};

// Every card is a fixed sequence of steps. "move"/"attack" need a player-picked
// target hex each time they're the current step; "shield"/"splashFromLast"
// resolve automatically right after the previous step, no extra input needed.
const CARDS = {
  waechter: {
    ansturm: { name: "Ansturm", steps: [
      { type: "move", range: 2 },
      { type: "attack", range: 1, dmgBase: 3, dmgVar: 2 },
    ] },
    schildhieb: { name: "Schildhieb", steps: [
      { type: "attack", range: 1, dmgBase: 2, dmgVar: 2 },
      { type: "shield", amount: 3 },
    ] },
    rueckzug: { name: "Rückzug", steps: [
      { type: "attack", range: 1, dmgBase: 2, dmgVar: 2 },
      { type: "move", range: 1 },
    ] },
  },
  wildhueter: {
    sprungschuss: { name: "Sprungschuss", steps: [
      { type: "move", range: 2 },
      { type: "attack", range: 2, dmgBase: 2, dmgVar: 2 },
    ] },
    sicherung: { name: "Sicherung", steps: [
      { type: "attack", range: 2, dmgBase: 2, dmgVar: 2 },
      { type: "shield", amount: 2 },
    ] },
    explosivpfeil: { name: "Explosivpfeil", steps: [
      { type: "attack", range: 2, dmgBase: 2, dmgVar: 2 },
      { type: "splashFromLast", amount: 1 },
    ] },
  },
};

const ENEMY_DEFS = {
  raider: { hp: 8, moveRange: 2, atkRange: 1, dmgBase: 1, dmgVar: 2 },
  archer: { hp: 6, moveRange: 2, atkRange: 3, dmgBase: 1, dmgVar: 2 },
  captain: { hp: 20, moveRange: 2, atkRange: 1, dmgBase: 3, dmgVar: 3 },
};

// Each enemy type has two situational moves it can telegraph and then execute -
// the mirror of hero cards, just chosen by simple AI instead of a player.
const ENEMY_MOVES = {
  raider: {
    vorstoss: { name: "Vorstoß", desc: "nähert sich und schlägt zu" },
    wutschlag: { name: "Wutschlag", desc: "doppelter Nahkampf-Treffer" },
  },
  archer: {
    zielschuss: { name: "Zielschuss", desc: "hält Abstand und schießt" },
    rueckzugsschuss: { name: "Rückzugsschuss", desc: "weicht zurück und schießt" },
  },
  captain: {
    wuchtschlag: { name: "Wuchtschlag", desc: "harter Einzeltreffer" },
    wirbelangriff: { name: "Wirbelangriff", desc: "trifft alle angrenzenden Helden" },
  },
};

function nearestHero(state, unit) {
  const heroesAlive = livingHeroes(state);
  if (!heroesAlive.length) return null;
  return heroesAlive.reduce((best, h) => {
    const d = hexDist(unit, h);
    return !best || d < best.d ? { h, d } : best;
  }, null).h;
}

// Decide which move an enemy WILL use next enemy phase, based on the board right now.
// Stored on the enemy as plannedMove so the client can show it before it happens.
function decideEnemyMove(state, enemy) {
  const target = nearestHero(state, enemy);
  if (!target) return null;
  const dist = hexDist(enemy, target);
  if (enemy.type === "raider") return dist <= 1 ? "wutschlag" : "vorstoss";
  if (enemy.type === "archer") return dist <= 1 ? "rueckzugsschuss" : "zielschuss";
  if (enemy.type === "captain") {
    const adjacent = livingHeroes(state).filter(h => hexDist(enemy, h) <= 1).length;
    return adjacent >= 2 ? "wirbelangriff" : "wuchtschlag";
  }
  return null;
}

function moveToward(state, unit, target, moveRange, stopRange) {
  for (let step = 0; step < moveRange && hexDist(unit, target) > stopRange; step++) {
    const next = stepToward(state, unit, target);
    if (!next) break;
    unit.q = next.q; unit.r = next.r;
  }
}

function stepAway(state, from, avoid) {
  const obst = obstacleSet(state);
  let best = null, bestDist = hexDist(from, avoid);
  for (const n of neighbors(from.q, from.r)) {
    if (!inBounds(n.q, n.r, state.board.radius)) continue;
    const k = key(n.q, n.r);
    if (obst.has(k)) continue;
    if (occupantAt(state, n.q, n.r)) continue;
    const d = hexDist(n, avoid);
    if (d > bestDist) { bestDist = d; best = n; }
  }
  return best;
}

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
    return {
      playerId: pid, cls, hp: def.hp, maxHp: def.hp, shield: 0, q: sp.q, r: sp.r,
      acted: false, cardStep: null, lastAttackTarget: null,
    };
  });

  const raiderCount = n + 1;
  const archerCount = Math.floor(n / 2) + 1;
  const enemies = [];
  let eid = 0;
  for (let i = 0; i < raiderCount; i++) {
    const sp = RAIDER_SPAWNS[i % RAIDER_SPAWNS.length];
    enemies.push({ id: "e" + (eid++), type: "raider", hp: ENEMY_DEFS.raider.hp, maxHp: ENEMY_DEFS.raider.hp, q: sp.q, r: sp.r, active: true, plannedMove: null });
  }
  for (let i = 0; i < archerCount; i++) {
    const sp = ARCHER_SPAWNS[i % ARCHER_SPAWNS.length];
    enemies.push({ id: "e" + (eid++), type: "archer", hp: ENEMY_DEFS.archer.hp, maxHp: ENEMY_DEFS.archer.hp, q: sp.q, r: sp.r, active: true, plannedMove: null });
  }
  const captainHp = ENEMY_DEFS.captain.hp + 4 * (n - 1);
  enemies.push({ id: "e" + (eid++), type: "captain", hp: captainHp, maxHp: captainHp, q: CAPTAIN_SPAWN.q, r: CAPTAIN_SPAWN.r, active: false, plannedMove: null });

  const state = {
    board: { radius: 4, obstacles: OBSTACLES },
    players: players.slice(),
    heroes,
    enemies,
    round: 1,
    phase: "hero",
    activeHeroIdx: 0,
    log: [],
    over: null,
  };
  for (const e of enemies) if (e.active) e.plannedMove = decideEnemyMove(state, e);
  return state;
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

function rollDmg(def) { return def.dmgBase + Math.floor(Math.random() * def.dmgVar); }

function runEnemyMove(state, e) {
  const def = ENEMY_DEFS[e.type];
  const target = nearestHero(state, e);
  if (!target) return;
  const move = e.plannedMove || decideEnemyMove(state, e);
  const moveDef = ENEMY_MOVES[e.type][move];

  if (e.type === "raider" && move === "wutschlag" && hexDist(e, target) <= def.atkRange) {
    const dmg = rollDmg(def) + 1;
    dealDamage(target, dmg);
    pushLog(state, "Plünderer (" + moveDef.name + ") trifft " + target.cls + " hart für " + dmg);
    return;
  }
  if (e.type === "archer" && move === "rueckzugsschuss" && hexDist(e, target) <= 1) {
    const away = stepAway(state, e, target);
    if (away) { e.q = away.q; e.r = away.r; }
    if (hexDist(e, target) <= def.atkRange) {
      const dmg = rollDmg(def);
      dealDamage(target, dmg);
      pushLog(state, "Bogenschütze (" + moveDef.name + ") trifft " + target.cls + " für " + dmg);
    }
    return;
  }
  if (e.type === "captain" && move === "wirbelangriff") {
    moveToward(state, e, target, def.moveRange, def.atkRange);
    for (const h of livingHeroes(state)) {
      if (hexDist(e, h) <= 1) {
        const dmg = Math.max(1, Math.round(rollDmg(def) * 0.7));
        dealDamage(h, dmg);
        pushLog(state, "Hauptmann (" + moveDef.name + ") trifft " + h.cls + " für " + dmg);
      }
    }
    return;
  }

  // default pattern (vorstoss / zielschuss / wuchtschlag): close in, then hit once
  moveToward(state, e, target, def.moveRange, def.atkRange);
  if (hexDist(e, target) <= def.atkRange) {
    const dmg = e.type === "captain" ? rollDmg(def) + 1 : rollDmg(def);
    dealDamage(target, dmg);
    pushLog(state, (moveDef ? moveDef.name : e.type) + " trifft " + target.cls + " für " + dmg);
  }
}

function runEnemyPhase(state) {
  for (const e of state.enemies) {
    if (!e.active || e.hp <= 0) continue;
    if (livingHeroes(state).length === 0) break;
    runEnemyMove(state, e);
  }

  const nonCaptainAlive = state.enemies.some(e => e.type !== "captain" && e.active && e.hp > 0);
  const captain = state.enemies.find(e => e.type === "captain");
  if (!nonCaptainAlive && captain && !captain.active) {
    captain.active = true;
    pushLog(state, "Der Hauptmann erscheint!");
  }

  for (const e of state.enemies) {
    if (e.active && e.hp > 0) e.plannedMove = decideEnemyMove(state, e);
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

// Which step of `cardId` is next for this hero: the step index they were mid-card on,
// or step 0 if they're starting a fresh card this turn.
function currentStep(hero, cardId) {
  if (hero.cardStep && hero.cardStep.cardId === cardId) return hero.cardStep.stepIndex;
  return 0;
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
  if (!action || typeof action.cardId !== "string") return { ok: false, error: "unbekannte Karte" };
  if (hero.cardStep && hero.cardStep.cardId !== action.cardId) {
    return { ok: false, error: "erst die begonnene Karte zu Ende spielen" };
  }
  if (!Number.isInteger(action.q) || !Number.isInteger(action.r)) {
    return { ok: false, error: "Zielfeld fehlt" };
  }
  const card = CARDS[hero.cls] && CARDS[hero.cls][action.cardId];
  if (!card) return { ok: false, error: "unbekannte Karte" };
  const stepIndex = currentStep(hero, action.cardId);
  const step = card.steps[stepIndex];
  if (!step) return { ok: false, error: "Karte bereits abgeschlossen" };
  const dist = hexDist(hero, action);

  if (step.type === "move") {
    if (!inBounds(action.q, action.r, state.board.radius)) return { ok: false, error: "Ziel liegt außerhalb des Bretts" };
    const r = reachable(state, hero, step.range);
    if (!r.has(key(action.q, action.r)) || (action.q === hero.q && action.r === hero.r)) {
      return { ok: false, error: "Feld nicht erreichbar" };
    }
    return { ok: true };
  }
  if (step.type === "attack") {
    if (dist > step.range) return { ok: false, error: "Ziel außer Reichweite" };
    const occ = occupantAt(state, action.q, action.r);
    if (!occ || occ.kind !== "enemy") return { ok: false, error: "dort steht kein Gegner" };
    return { ok: true };
  }
  return { ok: false, error: "ungültige Aktion" };
}

// Resolve any steps from `fromIndex` onward that don't need a player-picked target
// (shield / splashFromLast), stopping at the next move/attack step or the card's end.
function autoResolveTrailing(state, hero, card, fromIndex) {
  let i = fromIndex;
  while (i < card.steps.length) {
    const step = card.steps[i];
    if (step.type === "shield") {
      hero.shield += step.amount;
      pushLog(state, hero.cls + " (" + card.name + ") erhält Schild +" + step.amount);
      i++;
    } else if (step.type === "splashFromLast") {
      const last = hero.lastAttackTarget;
      if (last) {
        for (const n of neighbors(last.q, last.r)) {
          const near = occupantAt(state, n.q, n.r);
          if (near && near.kind === "enemy") dealDamage(near.unit, step.amount);
        }
        pushLog(state, hero.cls + "'s (" + card.name + ") Angriff streut auf Nachbarn");
      }
      i++;
    } else {
      break; // move / attack: needs the next player action
    }
  }
  return i;
}

// Does `step` have at least one legal target right now? Used to skip a step
// instead of soft-locking the hero when e.g. no enemy is left in range.
function stepHasTarget(state, hero, step) {
  if (step.type === "move") {
    const r = reachable(state, hero, step.range);
    return r.size > 1 || !r.has(key(hero.q, hero.r));
  }
  if (step.type === "attack") {
    return state.enemies.some(e => e.active && e.hp > 0 && hexDist(hero, e) <= step.range);
  }
  return true;
}

export function applyAction(state, playerId, action) {
  const s = JSON.parse(JSON.stringify(state));
  const idx = s.heroes.findIndex(h => h.playerId === playerId);
  const hero = s.heroes[idx];
  const card = CARDS[hero.cls][action.cardId];
  const stepIndex = currentStep(hero, action.cardId);
  const step = card.steps[stepIndex];

  if (step.type === "move") {
    hero.q = action.q; hero.r = action.r;
    pushLog(s, hero.cls + " (" + card.name + ") zieht um");
  } else if (step.type === "attack") {
    const occ = occupantAt(s, action.q, action.r);
    const dmg = step.dmgBase + Math.floor(Math.random() * step.dmgVar);
    dealDamage(occ.unit, dmg);
    hero.lastAttackTarget = { q: action.q, r: action.r };
    pushLog(s, hero.cls + " (" + card.name + ") trifft für " + dmg);
  }

  let next = autoResolveTrailing(s, hero, card, stepIndex + 1);
  while (next < card.steps.length && !stepHasTarget(s, hero, card.steps[next])) {
    pushLog(s, card.name + ": " + card.steps[next].type + "-Schritt hat kein Ziel und verpufft");
    next = autoResolveTrailing(s, hero, card, next + 1);
  }
  if (next < card.steps.length) {
    hero.cardStep = { cardId: action.cardId, stepIndex: next };
    checkGameOver(s);
    return s; // still this hero's turn - waiting for the next step's target
  }

  hero.cardStep = null;
  hero.lastAttackTarget = null;
  hero.acted = true;

  const nextHero = nextActiveHeroIdx(s, idx + 1);
  if (nextHero === -1) {
    s.phase = "enemy";
    runEnemyPhase(s);
    checkGameOver(s);
    if (!s.over) {
      s.round += 1;
      s.phase = "hero";
      for (const h of s.heroes) { h.acted = false; h.cardStep = null; h.lastAttackTarget = null; }
      const firstAlive = nextActiveHeroIdx(s, 0);
      s.activeHeroIdx = firstAlive === -1 ? 0 : firstAlive;
    }
  } else {
    s.activeHeroIdx = nextHero;
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
