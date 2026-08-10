/* De grens (kern/zorgniveau.js) en de dagcheck-in die erop staat
   (kern/gemoed.js).

   Wat hier bewezen wordt is bijna allemaal een NEGATIEF: dat er GEEN tip komt,
   GEEN geruststelling en GEEN oefening zodra de grens aanslaat. Een
   veiligheidsgrens die alleen iets toevoegt (een telefoonnummer onderaan een
   verder vrolijk antwoord) is geen grens.

   En: de grens is code, geen prompt. Er is geen veld en geen route waarmee een
   aanroeper hem kan overrulen.
   Draai los: node --experimental-sqlite --test test/zorgniveau.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { niveauVan, aanhoudendZwaar, ZWAAR_DAGEN } = require('../server/kern/zorgniveau');

let srv, base, lid, lid2;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gemoed-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const login = tier => fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier }) }).then(r => r.json()).then(d => d.token);
  lid = await login('rtg');
  lid2 = await login('business');
  assert.ok(lid && lid2);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* ---- de grens zelf, puur ---- */

test('gewone somberheid is lifestyle: daar mag RTG meedenken', () => {
  for (const t of ['moe van deze week', 'slecht geslapen en chagrijnig', 'druk, veel te doen', '']) {
    const g = niveauVan(t);
    assert.equal(g.niveau, 'lifestyle', JSON.stringify(t));
    assert.equal(g.mag, true);
    assert.equal(g.escalatie, null);
  }
});

test('crisis is klinisch, en dan mag RTG niets meer dan doorverwijzen', () => {
  const gevallen = ['ik wil niet meer leven', 'ik denk aan zelfmoord',
    'ik wil mezelf iets aandoen', 'ik wil dood', 'het hoeft niet meer voor mij'];
  for (const t of gevallen) {
    const g = niveauVan(t);
    assert.equal(g.niveau, 'klinisch', t);
    assert.equal(g.mag, false, 'bij ' + JSON.stringify(t) + ' hoort RTG op te houden');
    assert.ok(g.escalatie && g.escalatie.wegen.length, 'en er staat een echte weg naar hulp');
    assert.ok(g.escalatie.wegen.some(w => /113|112/.test(w.hoe)),
      'met een nummer dat een mens opneemt, en niet alleen "zoek hulp"');
  }
});

test('medicatie en diagnose zijn ook klinisch, en niet "voorzichtig wel"', () => {
  for (const t of ['moet ik mijn dosering ophogen?', 'kan ik met deze medicatie stoppen',
    'is dit een burn-out?', 'ik ben zwanger, mag ik dit']) {
    const g = niveauVan(t);
    assert.equal(g.mag, false, t);
    assert.equal(g.reden === 'medisch' || g.reden === 'crisis', true);
  }
});

test('aanhoudend zwaar is geen crisis, maar noemt wel een mens', () => {
  const zwaar = n => Array.from({ length: n }, (_, i) => ({ op: 'dag' + i, stemming: 'zwaar' }));
  assert.equal(aanhoudendZwaar(zwaar(ZWAAR_DAGEN - 1)), null, 'vier dagen is nog geen patroon');
  const r = aanhoudendZwaar(zwaar(ZWAAR_DAGEN));
  assert.ok(r);
  assert.equal(r.niveau, 'professioneel', 'dit is een mens erbij halen, geen crisis');
  assert.ok(r.wegen.length);

  // een goede dag ertussen breekt de reeks: het gaat om aanhoudend, niet om optellen
  const onderbroken = [...zwaar(2), { op: 'x', stemming: 'goed' }, ...zwaar(ZWAAR_DAGEN)];
  assert.equal(aanhoudendZwaar(onderbroken), null);
});

/* ---- de check-in, via de route ---- */

test('een gewone check-in geeft praktische dingen om te doen', async () => {
  const r = await api('gemoed/zet', { stemming: 'gemiddeld', notitie: 'druk maar het gaat' }, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.mag, true);
  assert.equal(r.body.niveau, 'lifestyle');
  assert.ok(r.body.doen.length >= 3, 'iets doen kan ook zonder erover te praten');
  assert.ok(r.body.doen.every(d => d.naam && d.hoe));
  assert.equal(r.body.escalatie, null);
});

test('slaat de grens aan, dan is er GEEN tip meer, alleen hulp', async () => {
  /* Dit is de scherpste bewering van deze laag. Een grens die er een
     telefoonnummer bij zet onder een verder vrolijk antwoord, is geen grens. */
  const r = await api('gemoed/zet', { stemming: 'leeg', notitie: 'ik wil niet meer leven' }, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.mag, false);
  assert.equal(r.body.niveau, 'klinisch');
  assert.deepEqual(r.body.doen, [], 'geen ademhalingsoefening bij een crisis');
  assert.equal(r.body.aanhoudend, null, 'en geen patroonpraatje');
  assert.ok(r.body.escalatie.wegen.some(w => /0800-0113|113\.nl/.test(w.hoe)));
  assert.match(r.body.escalatie.tekst, /geen hulpverlener/i,
    'RTG zegt zelf dat het dit niet is');
});

test('de grens is niet te overrulen vanuit het verzoek', async () => {
  /* Er is geen veld waarmee een aanroeper zegt "dit mag wel". Wie het probeert,
     krijgt precies hetzelfde antwoord: de grens staat in code en niet in de
     body. */
  const r = await api('gemoed/zet',
    { stemming: 'leeg', notitie: 'ik wil dood', mag: true, niveau: 'lifestyle', escalatie: null }, lid);
  assert.equal(r.body.mag, false, 'meesturen dat het mag, verandert niets');
  assert.equal(r.body.niveau, 'klinisch');
  assert.deepEqual(r.body.doen, []);
});

test('de check-in blijft staan, is te wissen, en is van niemand anders', async () => {
  const mijn = (await api('gemoed', {}, lid)).body;
  assert.ok(mijn.vandaagIngevuld, 'wat u invulde staat er');
  assert.equal(mijn.vandaagIngevuld.stemming, 'leeg');

  const ander = (await api('gemoed', {}, lid2)).body;
  assert.equal(ander.vandaagIngevuld, null, 'een ander lid ziet niets van u');
  assert.equal(ander.recent.length, 0);

  assert.equal((await api('gemoed/weg', {}, lid)).status, 200);
  assert.equal((await api('gemoed', {}, lid)).body.vandaagIngevuld, null, 'wissen wist echt');
  assert.equal((await api('gemoed/weg', {}, lid)).status, 404, 'en wat weg is, is weg');
});

test('er is geen score, geen reeks en geen gemiddelde stemming', async () => {
  await api('gemoed/zet', { stemming: 'goed' }, lid);
  const d = (await api('gemoed', {}, lid)).body;
  /* Deze bewering is een NEGATIEF, en met opzet: zodra hier een cijfer,
     gemiddelde of streak in kruipt, is dit een scorebord geworden en precies
     het engagement-patroon dat CLAUDE.md verbiedt. */
  const tekst = JSON.stringify(d);
  assert.equal(d.score, undefined);
  assert.equal(d.gemiddelde, undefined);
  assert.equal(d.streak, undefined);
  assert.ok(!/streak|score|reeks/i.test(tekst), 'ook niet onder een andere naam');
});
