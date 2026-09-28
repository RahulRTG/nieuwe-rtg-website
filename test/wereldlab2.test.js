/* De livinglab-wereld: een veldnaam, drie betekenissen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { ID_BETEKENIS, idVoor, zetLab2Klaar } = require('../scripts/lib/wereld-lab2');

test('elk deelgebied wijst naar een ding dat de wereld ook maakt', () => {
  const gemaakt = new Set(['lab', 'studie', 'apparaat', 'labpas']);
  for (const [sub, wat] of Object.entries(ID_BETEKENIS)) {
    assert.ok(sub.startsWith('/api/lab2/'), sub);
    assert.ok(gemaakt.has(wat), sub + ' wijst naar "' + wat + '", en dat maakt de wereld niet');
  }
});

/* DE KERN VAN DEZE WERELD. Een enkel `id` zou in twee van de vier gevallen
   het verkeerde ding aanwijzen; een eerste versie deed dat en leverde 3
   routes op in plaats van 21. */
test('hetzelfde veld krijgt per deelgebied een ander ding', () => {
  const extra = { lab: 'L1', studie: 'S1', apparaat: 'A1', labpas: 'P1' };
  assert.deepEqual(idVoor(extra, '/api/lab2/bewijs/conclusie'), { id: 'S1' });
  assert.deepEqual(idVoor(extra, '/api/lab2/app/lijst'), { id: 'A1' });
  assert.deepEqual(idVoor(extra, '/api/lab2/lab/budget'), { id: 'L1' });
  assert.deepEqual(idVoor(extra, '/api/lab2/mijn/observatie'), { id: 'P1' });
});

/* De hele tabel, per ding. Vier voorbeelden hierboven laten elf deelgebieden
   vrij: /themas van 'lab' naar 'studie' zetten bleef groen, en dan meet de
   proef stil het verkeerde ding (de 1938 -> 1936 uit ./idperdeel.js). */
test('elk deelgebied wijst naar het ding dat zijn weigering noemt', () => {
  const perDing = {};
  for (const [sub, wat] of Object.entries(ID_BETEKENIS))
    (perDing[wat] = perDing[wat] || []).push(sub.slice('/api/lab2/'.length));
  for (const l of Object.values(perDing)) l.sort();
  assert.deepEqual(perDing, {
    apparaat: ['app'],
    labpas: ['mijn'],
    lab: ['impact', 'lab', 'opbrengst', 'overzicht', 'themas'],
    studie: ['bewijs', 'bewoner', 'coach', 'ethiek', 'mens', 'plan', 'studie', 'uit', 'werk']
  });
});

/* Een deelgebied dat er niet in staat krijgt GEEN id. Een gok zou hier een
   404 vervangen door een stille meting op het verkeerde ding. */
test('een onbekend deelgebied krijgt niets mee', () => {
  const extra = { lab: 'L1', studie: 'S1' };
  assert.deepEqual(idVoor(extra, '/api/lab2/onbekend/iets'), {});
  assert.deepEqual(idVoor(extra, '/api/mall/bestel'), {});
});

/* En een ding dat de wereld niet heeft kunnen maken, wordt niet verzonnen. */
test('zonder het ding komt er geen id', () => {
  assert.deepEqual(idVoor({ lab: 'L1' }, '/api/lab2/bewijs/conclusie'), {});
});

/* DE OPBOUW ZELF, met een nep-post: de mutatiemotor muteert hier de operatoren
   (een 2xx-grens, een actief lab zoeken, klaar pas met een onderzoek), en die
   raakte geen enkele toets. */
function nepPost(antwoorden) {
  const gezien = [];
  const post = async (pad, lijf, token) => {
    gezien.push({ pad, lijf, token });
    const a = antwoorden[pad];
    return typeof a === 'function' ? a(lijf) : a;
  };
  return { post, gezien };
}
const LABS = { status: 200, data: { labs: [{ id: 'L0', actief: false }, { id: 'L1', actief: true }] } };

test('zonder kantoorsessie op naam wordt er niets gevraagd', async () => {
  const { post, gezien } = nepPost({});
  const uit = await zetLab2Klaar({ post, tokens: {} });
  assert.equal(uit.klaar, false);
  assert.match(uit.reden, /kantoorsessie/);
  assert.equal(gezien.length, 0);
});

test('alleen een ACTIEF lab telt, en zonder onderzoek is de wereld niet klaar', async () => {
  const inactief = nepPost({ '/api/lab2/labs': { status: 200, data: { labs: [{ id: 'L0', actief: false }] } } });
  const a = await zetLab2Klaar({ post: inactief.post, tokens: { office: 'T' } });
  assert.equal(a.klaar, false);
  assert.match(a.reden, /1 labs maar geen enkele staat op actief/);

  const geweigerd = nepPost({ '/api/lab2/labs': LABS,
    '/api/lab2/studie/maak': { status: 409, data: { error: 'nee' } } });
  const b = await zetLab2Klaar({ post: geweigerd.post, tokens: { office: 'T' } });
  assert.equal(b.klaar, false, 'een 409 is geen onderzoek');
  assert.deepEqual(b.extra, { lab: 'L1', labId: 'L1' });
  assert.equal(b.stappen.find(s => s.pad === '/api/lab2/studie/maak').waarom, 'nee');
});

test('de volle opbouw zet elk ding onder beide namen en geeft het kantoortoken mee', async () => {
  const { post, gezien } = nepPost({
    '/api/lab2/labs': LABS,
    '/api/lab2/studie/maak': { status: 201, data: { studie: { id: 'S1' } } },
    '/api/lab2/app/maak': { status: 200, data: { app: { id: 'A1' } } },
    '/api/lab2/bewoner/paspoort-maak': { status: 200, data: { paspoort: { code: 'P1' } } }
  });
  const uit = await zetLab2Klaar({ post, tokens: { 'kantoor-op-naam': 'NAAM', office: 'GEDEELD' } });
  assert.equal(uit.klaar, true);
  assert.equal(uit.reden, null);
  assert.deepEqual(uit.extra, { lab: 'L1', labId: 'L1', studie: 'S1', studieId: 'S1',
    apparaat: 'A1', apparaatId: 'A1', labpas: 'P1', code: 'P1' });
  assert.ok(gezien.every(g => g.token === 'NAAM'), 'de sessie op naam gaat voor de gedeelde');
  assert.ok(uit.stappen.every(s => s.ok));
  assert.deepEqual(uit.idVoor('/api/lab2/app/lijst'), { id: 'A1' });
});
