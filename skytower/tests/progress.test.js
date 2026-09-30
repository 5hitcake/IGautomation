import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buySkin, selectSkin, skinState, unlockGoals, goalProgress, skinById, isOwned } from '../src/systems/progress.js';

const fresh = (extra = {}) => ({
  coins: 0, ownedSkins: [], selectedSkin: 'wolki', bestFloor: 0, bestCombo: 0, runs: 0, totalScore: 0, ...extra,
});

test('Wolki gehört einem von Anfang an und ist ausgewählt', () => {
  const d = fresh();
  assert.equal(isOwned(d, 'wolki'), true);
  assert.equal(skinState(d, skinById('wolki')), 'selected');
});

test('Skin kaufen zieht Münzen ab, zu teuer klappt nicht', () => {
  const d = fresh({ coins: 600 });
  assert.equal(skinState(d, skinById('sonne')), 'tooExpensive');
  assert.equal(buySkin(d, 'sonne'), false);
  assert.equal(skinState(d, skinById('regen')), 'buyable');
  assert.equal(buySkin(d, 'regen'), true);
  assert.equal(d.coins, 300);
  assert.equal(buySkin(d, 'regen'), false, 'nicht doppelt kaufen');
  assert.equal(d.coins, 300);
  assert.equal(skinState(d, skinById('regen')), 'owned');
});

test('Erfolgs- und Premium-Skins kann man nicht kaufen', () => {
  const d = fresh({ coins: 99999 });
  assert.equal(buySkin(d, 'ballon'), false);
  assert.equal(buySkin(d, 'einhorn'), false);
  assert.equal(skinState(d, skinById('ballon')), 'goal');
  assert.equal(skinState(d, skinById('einhorn')), 'premium');
});

test('Nur eigene Skins lassen sich auswählen', () => {
  const d = fresh();
  assert.equal(selectSkin(d, 'astro'), false);
  assert.equal(d.selectedSkin, 'wolki');
  d.ownedSkins.push('astro');
  assert.equal(selectSkin(d, 'astro'), true);
  assert.equal(skinState(d, skinById('astro')), 'selected');
});

test('Engel-Wolki bleibt geheim, bis das Himmelstor erreicht ist', () => {
  const d = fresh({ coins: 99999 });
  assert.equal(skinState(d, skinById('engel')), 'secret');
  assert.equal(buySkin(d, 'engel'), false);
  d.gateCount = 1;
  assert.deepEqual(unlockGoals(d).map((s) => s.id), ['engel']);
  assert.equal(skinState(d, skinById('engel')), 'owned');
});

test('Erfolge schalten Skins frei, auch die Goldene Wolke über Punkte', () => {
  const d = fresh({ bestFloor: 230, bestCombo: 49, totalScore: 1_000_000 });
  const got = unlockGoals(d).map((s) => s.id).sort();
  assert.deepEqual(got, ['ballon', 'gold']);
  assert.deepEqual(unlockGoals(d), [], 'kein zweites Mal');
  assert.deepEqual(goalProgress(d, skinById('blitz')), { current: 49, target: 50, done: false });
});

test('Alien und Roboter bleiben geheim, bis Etage 800 bzw. eine 100er-Combo geschafft ist', () => {
  const d = fresh({ coins: 99999, bestFloor: 799, bestCombo: 99 });
  assert.equal(skinState(d, skinById('alien')), 'secret');
  assert.equal(skinState(d, skinById('roboter')), 'secret');
  assert.equal(buySkin(d, 'alien'), false);
  assert.ok(!unlockGoals(d).some((s) => ['alien', 'roboter'].includes(s.id)));
  d.bestFloor = 800;
  d.bestCombo = 100;
  const got = unlockGoals(d).map((s) => s.id);
  assert.ok(got.includes('alien') && got.includes('roboter'));
  assert.equal(skinState(d, skinById('alien')), 'owned');
});

test('Sternen-Wolki gibt es nur für einen perfekten Aufstieg zum Himmelstor', () => {
  const d = fresh({ coins: 99999, gateCount: 3 });
  assert.equal(skinState(d, skinById('sterne')), 'secret');
  assert.equal(buySkin(d, 'sterne'), false);
  assert.ok(!unlockGoals(d).some((s) => s.id === 'sterne'), 'Tor allein reicht nicht');
  d.perfectCount = 1;
  assert.ok(unlockGoals(d).some((s) => s.id === 'sterne'));
});
