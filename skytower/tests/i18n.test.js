import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANG, tr, num } from '../src/i18n.js';
import { SKIN_LIST, GOAL_TEXT } from '../src/systems/progress.js';
import { ZONES } from '../src/config.js';

test('Sprache ist Deutsch oder Englisch, tr wählt passend', () => {
  assert.ok(['de', 'en'].includes(LANG));
  assert.equal(tr('Hallo', 'Hello'), LANG === 'de' ? 'Hallo' : 'Hello');
  assert.equal(num(1000), LANG === 'de' ? '1.000' : '1,000');
});

test('alle Skins, Zonen und Ziele haben Texte', () => {
  for (const s of SKIN_LIST) assert.ok(s.name && typeof s.name === 'string', s.id);
  for (const z of ZONES) assert.ok(z.name && typeof z.name === 'string');
  for (const f of Object.values(GOAL_TEXT)) assert.ok(f(10).length > 3);
});
