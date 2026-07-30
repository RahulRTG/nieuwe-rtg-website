/* Bedrijfsgeheimen in het Onderzoekslab (kern/onderzoekslab.js): wie aan een
   project werkt (op het team) ziet het; de boardroom ziet alles; een
   buitenstaander ziet niets. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

function maak() {
  const db = { data: {} };
  return require('../server/kern/onderzoekslab')({ db, save: () => {}, crypto, anthropic: null }).lab;
}

test('de maker staat meteen op het team van zijn project', () => {
  const lab = maak();
  const r = lab.projectMaak({ titel: 'Zonneboer', veld: 'landbouw', doel: 'Zonne-energie voor de boerderij.' }, 'user-7');
  assert.equal(r.ok, true);
  assert.deepEqual(r.project.team, ['user-7']);
});

test('overzichtVoor toont alleen eigen teamprojecten; de boardroom ziet alles', () => {
  const lab = maak();
  lab.projectMaak({ titel: 'RTG geheim', veld: 'hardware', doel: 'Een besloten RTG-prototype.' }, 'user-rtg');
  lab.projectMaak({ titel: 'RTF geheim', veld: 'zorg', doel: 'Een besloten RTF-onderzoek.' }, 'user-rtf');

  // de RTG-medewerker ziet alleen zijn eigen project
  const rtg = lab.overzichtVoor({ key: 'user-rtg', boardroom: false });
  assert.equal(rtg.projecten.length, 1);
  assert.equal(rtg.projecten[0].titel, 'RTG geheim');

  // een buitenstaander (geen team, geen boardroom) ziet niets
  const vreemd = lab.overzichtVoor({ key: 'user-vreemd', boardroom: false });
  assert.equal(vreemd.projecten.length, 0);

  // de boardroom ziet beide bedrijfsgeheimen
  const board = lab.overzichtVoor({ key: 'user-baas', boardroom: true });
  assert.equal(board.projecten.length, 2);
});

test('teamZet breidt de kring uit die het project mag zien', () => {
  const lab = maak();
  const p = lab.projectMaak({ titel: 'Samenwerk', veld: 'water', doel: 'Schoon water voor het dorp.' }, 'user-a').project;
  // voordat B op het team staat, ziet B niets
  assert.equal(lab.overzichtVoor({ key: 'user-b', boardroom: false }).projecten.length, 0);
  lab.teamZet(p.id, ['user-a', 'user-b']);
  assert.equal(lab.overzichtVoor({ key: 'user-b', boardroom: false }).projecten.length, 1);
});
