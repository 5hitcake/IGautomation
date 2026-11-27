import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareText, shouldAskForReview } from '../src/services/social.js';
import { tr } from '../src/i18n.js';

test('Teilen-Text nennt Etage und Punkte eines Rekords', () => {
  const t = shareText({ score: 4120, floor: 412 });
  assert.match(t, /412/);
  assert.match(t, /Wolki: Sky Climber/);
});

test('Teilen-Text für Himmelstor und Himmelreich', () => {
  assert.match(shareText({ score: 1, floor: 1000, won: true }), /1000/);
  assert.match(shareText({ score: 1, floor: 1042, heaven: true }), new RegExp(`42 ${tr('Etagen', 'floors')}`));
});

test('Außerhalb der App wird nie um eine Bewertung gebeten', () => {
  assert.equal(shouldAskForReview(), false);
});
