/* Magnaat na 1.0: WAAR JE BEGINT (regels.js, STARTPOSITIES). Niet iedereen
   begint in de keuken. Wat hier vastligt:
   - op dag 1 kies je het, naast de moeilijkheid, en later alleen door opnieuw te beginnen;
   - een startpositie verschuift de baan, het geld op de bank en eventueel een eigen vaste last;
   - de studieschuld is een echte terugkerende betaling, met uitstel, door het grootboek;
   - elke startpositie is speelbaar tot het eind, en niets doen is op geen enkele een verlies;
   - de erfenis is een buffer: slecht spel duurt er langer dan in de keuken;
   - een oude save zonder startpositie is de keuken. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { maakLeven } = require('../server/kern/magnaat-leven');
const R = require('../server/kern/magnaat-leven/regels');
const B = require('../server/kern/magnaat-leven/regels-bedrijf');
const { maakSpeler } = require('./lib-magnaatspeler');
const { boekVan } = require('../server/kern/magnaat-leven/boek');

function leven(db = { data: {} }) {
  let t = 1e12;
  const L = maakLeven({ db, nu: () => t });
  const v = { db, L, s: L.staat('lid'), st: () => db.data.magnaatLeven.lid };
  v.doe = (b) => { const r = L.actie('lid', b); if (!r.error) v.s = r; return r; };
  return v;
}

test('op dag 1 kies je waar je begint, naast de moeilijkheid; de keuzes komen van de server', () => {
  const v = leven();
  const a = v.s.vandaag.volgende.find(x => x.actie === 'start');
  assert.ok(a, 'de keuze staat tussen de handelingen');
  assert.deepEqual(a.invoer.begin.map(x => x.id), ['keuken', 'student', 'erfenis']);
  assert.equal(v.s.vandaag.volgende[0].actie, 'kies', 'de hoofdactie blijft: kies wat je maakt');
  assert.equal(v.s.wereld.start, 'keuken');
  assert.ok(!v.doe({ actie: 'moeilijkheid', stand: 'zwaar' }).error);
  assert.ok(!v.doe({ actie: 'start', begin: 'student' }).error);
  assert.equal(v.st().moeilijkheid, 'zwaar', 'de moeilijkheid blijft staan');
  assert.equal(v.st().start, 'student');
  assert.equal(v.s.wereld.start, 'student');
  assert.equal(v.L.verifieer('lid').ok, true);
});

test('student: een bijbaan, een studentenkamer, en een studieschuld die elke vier weken terugkomt', () => {
  const v = leven();
  v.doe({ actie: 'start', begin: 'student' });
  const st = v.st();
  assert.equal(st.baan.werkgever, 'Supermarkt De Linde');
  assert.equal(st.baan.urenPerWeek, 20);
  assert.equal(st.posten.find(p => p.soort === 'huur').bedrag, 42000);
  const studie = st.posten.find(p => p.soort === 'studie');
  assert.deepEqual([studie.bedrag, studie.dag, studie.leverancier], [6000, 20, 'de studiefinanciering']);
  assert.match(st.meldingen.map(m => m.tekst).join(' '), /vakkenvuller bij Supermarkt De Linde.*6?0,00 naar de studiefinanciering/);
  v.doe({ actie: 'kies', aanbod: 'foto' });
  for (let i = 0; i < 20; i++) v.doe({ actie: 'slaap' });
  assert.equal(v.st().dag, 21);
  const volgende = v.st().posten.filter(p => p.soort === 'studie');
  assert.deepEqual(volgende.map(p => p.dag), [48], 'betaald op dag 20, en weer over vier weken');
  assert.equal(boekVan(v.st()).saldo(v.st(), ['financier']), 6000, 'de aflossing ging in het grootboek naar de studiefinanciering');
  assert.equal(v.L.verifieer('lid').ok, true);
});

test('de studieschuld kun je een week uitstellen, zoals telefoon en verzekering', () => {
  const v = leven();
  v.doe({ actie: 'start', begin: 'student' });
  v.doe({ actie: 'kies', aanbod: 'foto' });
  for (let i = 0; i < 14; i++) v.doe({ actie: 'slaap' });
  const p = v.st().posten.find(x => x.soort === 'studie');
  const r = v.doe({ actie: 'uitstel', post: p.id });
  assert.ok(!r.error, r.error);
  assert.equal(v.st().posten.find(x => x.id === p.id).dag, 27);
});

test('erfenis: het geld van je tante staat vanaf dag 1 op de bank, en het grootboek klopt', () => {
  const v = leven();
  v.doe({ actie: 'start', begin: 'erfenis' });
  assert.equal(v.s.geld.bank, R.START_KAS + 800000);
  assert.equal(v.st().baan.werkgever, 'Bakkerij Van Dam');
  assert.equal(v.st().posten.some(p => p.soort === 'studie'), false);
  assert.match(v.st().meldingen.map(m => m.tekst).join(' '), /waarvan € 8\.000,00 van je tante/);
  assert.equal(v.L.verifieer('lid').ok, true);
});

test('later kiezen kan alleen door opnieuw te beginnen, en onzin wordt geweigerd', () => {
  const v = leven();
  assert.match(v.doe({ actie: 'start', begin: 'miljonair' }).error, /Kies waar je begint: de keuken, student, een kleine erfenis/);
  const wereld = v.st().wereld;
  assert.ok(!v.doe({ actie: 'start', begin: 'keuken' }).error);
  assert.equal(v.st().wereld, wereld, 'dezelfde keuze begint geen nieuw leven');
  v.doe({ actie: 'kies', aanbod: 'foto' });
  assert.match(v.doe({ actie: 'start', begin: 'erfenis' }).error, /begin dan opnieuw/);
  assert.match(v.doe({ actie: 'opnieuw', zeker: true, begin: 'x' }).error, /Kies waar je begint/);
  assert.ok(!v.doe({ actie: 'opnieuw', zeker: true, begin: 'erfenis' }).error);
  assert.equal(v.st().start, 'erfenis');
  assert.ok(!v.doe({ actie: 'opnieuw', zeker: true, moeilijkheid: 'licht' }).error);
  assert.equal(v.st().start, 'erfenis', 'opnieuw zonder startpositie houdt de vorige');
  assert.equal(v.st().moeilijkheid, 'licht');
});

test('een oude save zonder startpositie is de keuken', () => {
  const oud = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'magnaat-leven-v1.json'), 'utf8'));
  assert.equal(oud.data.magnaatLeven.oud.start, undefined);
  let t = 1e12;
  const L = maakLeven({ db: { data: structuredClone(oud.data) }, nu: () => t });
  const s = L.staat('oud');
  assert.equal(s.wereld.start, 'keuken');
  assert.equal(s.wereld.startKas, R.START_KAS);
});

test('elke startpositie is speelbaar, niets doen is geen verlies, en de erfenis is een buffer', () => {
  const eind = {}, slecht = {};
  for (const begin of Object.keys(R.STARTPOSITIES)) {
    const p = maakSpeler({ begin });
    for (let i = 0; i < 200 && !p.st().zelfstandig; i++) p.dag();
    eind[begin] = p.st().zelfstandig;
    assert.ok(eind[begin] >= 85 && eind[begin] <= 115, begin + ': zelfstandig op dag ' + eind[begin]);
    const lui = maakSpeler({ moeilijkheid: 'zwaar', begin });
    for (let i = 0; i < 200; i++) lui.L.actie(lui.key, { actie: 'slaap' });
    assert.equal(lui.st().voorbij, undefined, begin + ': wie alleen zijn baan doet, houdt zijn kamer');
    const q = maakSpeler({ moeilijkheid: 'zwaar', begin });
    for (let i = 0; i < 80 && !q.st().onderneming; i++) q.dag();
    for (const k of B.TEAMKANDIDATEN) q.L.actie(q.key, { actie: 'werf', kandidaat: k.id });
    for (let i = 0; i < 200 && !q.st().voorbij; i++) q.L.actie(q.key, { actie: 'slaap' });
    slecht[begin] = q.st().voorbij ? q.st().voorbij.dag : Infinity;
  }
  assert.ok(slecht.erfenis > slecht.keuken + 14, 'de erfenis houdt slecht spel langer vol: ' + JSON.stringify(slecht));
});

test('het scherm bouwt de keuze en stuurt hem mee', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/apps/magnaat-leven-invoer.js'), 'utf8'), { window });
  const I = window.RTGMagnaatLevenInvoer;
  const a = { actie: 'start', label: 'Kies waar je begint', waarom: 'w', invoer: { begin: [{ id: 'student', naam: 'Student' }] } };
  assert.match(I.html(a, { esc: String, duur: String, vrij: 0 }), /id="vnF-begin"/);
  assert.equal(I.zonderVelden(a), false);
  assert.deepEqual(JSON.parse(JSON.stringify(I.lichaam(a, () => ({ value: 'student' })))), { actie: 'start', begin: 'student' });
});
