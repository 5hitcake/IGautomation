// Headless balance/smoke test for logic.js's multi-step card system.
// Runs a naive greedy bot through 1-4 player games and prints the outcome.
// No rendering, no network. Usage: node tools/run_sim.mjs
import { setup, validateAction, applyAction, isGameOver, viewFor } from "../logic.js";

const DIRS = [{ q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }];
function hexDist(a, b) { return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2; }
function neighbors(q, r) { return DIRS.map((d) => ({ q: q + d.q, r: r + d.r })); }
function inBounds(q, r, radius) { return Math.abs(q) <= radius && Math.abs(r) <= radius && Math.abs(q + r) <= radius; }
function occupantAt(state, q, r) {
  for (const h of state.heroes) if (h.hp > 0 && h.q === q && h.r === r) return true;
  for (const e of state.enemies) if (e.active && e.hp > 0 && e.q === q && e.r === r) return true;
  return false;
}
function obstacleAt(state, q, r) { return state.board.obstacles.some((o) => o.q === q && o.r === r); }
function reachable(state, from, range) {
  const seen = new Map(); seen.set(from.q + "," + from.r, 0);
  let frontier = [from];
  for (let step = 1; step <= range; step++) {
    const next = [];
    for (const cell of frontier) for (const n of neighbors(cell.q, cell.r)) {
      const k = n.q + "," + n.r;
      if (seen.has(k) || !inBounds(n.q, n.r, state.board.radius) || obstacleAt(state, n.q, n.r) || occupantAt(state, n.q, n.r)) continue;
      seen.set(k, step); next.push(n);
    }
    frontier = next;
  }
  return seen;
}

// Mirror of logic.js's CARDS, just for the bot to know what to try (ids only matter;
// validateAction is the real authority).
const CARD_IDS = {
  waechter: ["ansturm", "schildhieb", "rueckzug"],
  wildhueter: ["sprungschuss", "sicherung", "explosivpfeil"],
};

function chooseTarget(state, hero, stepType, range) {
  const enemies = state.enemies.filter((e) => e.active && e.hp > 0);
  if (stepType === "attack") {
    const inRange = enemies.filter((e) => hexDist(hero, e) <= range);
    if (!inRange.length) return null;
    inRange.sort((a, b) => a.hp - b.hp);
    return { q: inRange[0].q, r: inRange[0].r };
  }
  if (stepType === "move") {
    if (!enemies.length) return null;
    enemies.sort((a, b) => hexDist(hero, a) - hexDist(hero, b));
    const nearest = enemies[0];
    const r = reachable(state, hero, range);
    let best = null, bestD = hexDist(hero, nearest);
    for (const [k] of r) {
      if (k === hero.q + "," + hero.r) continue;
      const [q, rr] = k.split(",").map(Number);
      const d = hexDist({ q, r: rr }, nearest);
      if (d < bestD) { bestD = d; best = { q, r: rr }; }
    }
    return best;
  }
  return null;
}

function playHeroTurn(state, playerId) {
  const hero = state.heroes.find((h) => h.playerId === playerId);
  let guard = 0;
  while (state.phase === "hero" && state.heroes[state.activeHeroIdx].playerId === playerId && !state.heroes[state.activeHeroIdx].acted) {
    guard++;
    if (guard > 6) { console.log("BOT STUCK on", playerId); return state; }
    const live = state.heroes.find((h) => h.playerId === playerId);
    let cardIds = live.cardStep ? [live.cardStep.cardId] : CARD_IDS[live.cls];
    if (!live.cardStep && live.hp < live.maxHp * 0.6) {
      // prefer the attack+shield card when hurt, instead of always the aggressive one
      const shieldCard = live.cls === "waechter" ? "schildhieb" : "sicherung";
      cardIds = [shieldCard, ...cardIds.filter((c) => c !== shieldCard)];
    }
    let sent = false;
    for (const cardId of cardIds) {
      // Probe validateAction with a range of plausible targets to find the current step's type/range indirectly:
      // simplest robust approach - try move targets and attack targets around the hero and see what validates.
      const candidates = [];
      for (const n of neighbors(live.q, live.r)) candidates.push(n);
      for (const e of state.enemies) if (e.active && e.hp > 0) candidates.push({ q: e.q, r: e.r });
      for (let rr = -4; rr <= 4; rr++) for (let qq = -4; qq <= 4; qq++) candidates.push({ q: qq, r: rr });
      for (const c of candidates) {
        const v = validateAction(state, playerId, { cardId, q: c.q, r: c.r });
        if (v.ok) {
          state = applyAction(state, playerId, { cardId, q: c.q, r: c.r });
          sent = true;
          break;
        }
      }
      if (sent) break;
    }
    if (!sent) { console.log("NO VALID ACTION for", playerId, "cardStep", live.cardStep); return state; }
  }
  return state;
}

function runSim(numPlayers) {
  const players = Array.from({ length: numPlayers }, (_, i) => "p" + i);
  let state = setup(players);
  console.log(`--- ${numPlayers} player(s) --- enemies:`, state.enemies.map((e) => e.type).join(","));
  let rounds = 0;
  while (!isGameOver(state).over && rounds < 60) {
    if (state.phase === "hero") {
      const activeHero = state.heroes[state.activeHeroIdx];
      if (activeHero.hp <= 0) { state.activeHeroIdx = (state.activeHeroIdx + 1) % state.heroes.length; rounds++; continue; }
      state = playHeroTurn(state, activeHero.playerId);
    }
    rounds++;
  }
  console.log("result:", JSON.stringify(isGameOver(state)), "round:", state.round, "loopSteps:", rounds);
  console.log("heroes hp:", state.heroes.map((h) => h.hp + "/" + h.maxHp).join(", "));
  console.log("enemies hp:", state.enemies.map((e) => e.type + ":" + e.hp + "/" + e.maxHp + (e.active ? "" : "(inactive)")).join(", "));
  JSON.parse(JSON.stringify(viewFor(state, players[0]))); // view must stay JSON-safe
}

for (const n of [1, 2, 3, 4]) runSim(n);
