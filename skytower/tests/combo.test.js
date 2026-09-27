import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ComboTracker, calloutFor } from '../src/systems/combo.js';

test('kurze Sprünge zählen nur Etagen, keine Combo', () => {
  const c = new ComboTracker();
  c.land(1);
  c.land(2);
  c.land(3);
  assert.equal(c.active, false);
  assert.equal(c.score, 30);
});

test('zwei Combo-Sprünge ergeben Etagen² Bonuspunkte', () => {
  const ended = [];
  const c = new ComboTracker((r) => ended.push(r));
  c.land(3); // +3
  c.land(7); // +4
  assert.equal(c.active, true);
  c.land(8); // nur +1 -> Combo endet
  assert.equal(ended.length, 1);
  assert.deepEqual(
    { floors: ended[0].floors, counted: ended[0].counted, points: ended[0].points },
    { floors: 7, counted: true, points: 49 },
  );
  assert.equal(c.bestCombo, 7);
  assert.equal(c.score, 8 * 10 + 49);
});

test('ein einzelner Combo-Sprung wird nicht gewertet', () => {
  const c = new ComboTracker();
  c.land(4);
  c.land(4); // gleiche Plattform -> Ende
  assert.equal(c.comboPoints, 0);
  assert.equal(c.bestCombo, 0);
});

test('Combo endet, wenn der Timer abläuft', () => {
  const c = new ComboTracker();
  c.land(2);
  c.land(5);
  c.update(2.9);
  assert.equal(c.active, true);
  c.update(0.2);
  assert.equal(c.active, false);
  assert.equal(c.comboPoints, 25);
});

test('Landung nach dem Fallen auf eine tiefere Etage beendet die Combo', () => {
  const c = new ComboTracker();
  c.land(2);
  c.land(4);
  c.land(3);
  assert.equal(c.comboPoints, 16);
  assert.equal(c.maxFloor, 4);
});

test('Combo-Rufe nach Schwellen', () => {
  assert.equal(calloutFor(3), null);
  assert.equal(calloutFor(4), 'Gut!');
  assert.equal(calloutFor(50), 'Himmlisch!');
  assert.equal(calloutFor(999), 'LEGENDE!');
});
