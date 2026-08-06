// Headless balance/smoke test for logic.js: runs a naive greedy bot through
// 1-4 player games and prints the outcome. No rendering, no network.
// Usage: node tools/run_sim.mjs   (run from the tafelrunde/ directory)
import { setup, validateAction, applyAction, isGameOver, viewFor } from "../logic.js";

function hexDist(a, b) {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

const usedSpecial = new Set();

function chooseAction(state, playerId) {
  const hero = state.heroes.find((h) => h.playerId === playerId);
  const enemies = state.enemies.filter((e) => e.active && e.hp > 0);
  if (!enemies.length) return null;
  enemies.sort((a, b) => hexDist(hero, a) - hexDist(hero, b));
  const nearest = enemies[0];
  const range = hero.cls === "waechter" ? 1 : 3;
  if (hero.cls === "waechter" && !usedSpecial.has(playerId) && hexDist(hero, nearest) <= 3) {
    usedSpecial.add(playerId);
    return { card: "special", q: hero.q, r: hero.r };
  }
  if (hexDist(hero, nearest) <= range) {
    return { card: "attack", q: nearest.q, r: nearest.r };
  }
  const DIRS = [{ q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }];
  let best = null, bestD = hexDist(hero, nearest);
  for (const d of DIRS) {
    const cand = { q: hero.q + d.q, r: hero.r + d.r };
    const v = validateAction(state, playerId, { card: "move", q: cand.q, r: cand.r });
    if (v.ok) { const dist = hexDist(cand, nearest); if (dist < bestD) { bestD = dist; best = cand; } }
  }
  if (best) return { card: "move", q: best.q, r: best.r };
  return null;
}

function runSim(numPlayers) {
  const players = Array.from({ length: numPlayers }, (_, i) => "p" + i);
  let state = setup(players);
  console.log(`--- ${numPlayers} player(s) --- enemies:`, state.enemies.map((e) => e.type).join(","));
  let iterations = 0, stuck = 0;
  while (!isGameOver(state).over && iterations < 400) {
    if (state.phase === "hero") {
      const activeHero = state.heroes[state.activeHeroIdx];
      if (activeHero.hp <= 0) { iterations++; continue; }
      const action = chooseAction(state, activeHero.playerId);
      if (!action) { stuck++; if (stuck > 5) break; iterations++; continue; }
      const v = validateAction(state, activeHero.playerId, action);
      if (!v.ok) { console.log("INVALID ACTION", action, v.error); break; }
      state = applyAction(state, activeHero.playerId, action);
    }
    iterations++;
  }
  console.log("result:", JSON.stringify(isGameOver(state)), "rounds:", state.round, "iterations:", iterations);
  console.log("heroes hp:", state.heroes.map((h) => h.hp + "/" + h.maxHp).join(", "));
  console.log("enemies hp:", state.enemies.map((e) => e.type + ":" + e.hp + "/" + e.maxHp + (e.active ? "" : "(inactive)")).join(", "));
  JSON.parse(JSON.stringify(viewFor(state, players[0]))); // view must stay JSON-safe
}

for (const n of [1, 2, 3, 4]) runSim(n);
