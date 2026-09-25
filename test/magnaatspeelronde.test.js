/* Magnaat na 1.0: DE SPEELRONDE MET MENSEN (./server/kern/magnaat-leven/oordeel.js).
   Op drie momenten vraagt het spel hoe het speelt. Wat hier vastligt:
   - de vraag komt pas als het moment er is, en is nooit de hoofdactie;
   - een oordeel is ANONIEM: in de opslag staat geen sessiesleutel, codenaam of wereld;
   - een antwoord sluit het moment (en eerdere open momenten), overslaan bewaart niets;
   - ook een leven dat voorbij is kan nog zeggen hoe het speelde, en verder niets;
   - het kantoor ziet tellingen per niveau en moment, en de losse regels, via de
     bestaande status en achter de boardroom-poort. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { maakLeven } = require('../server/kern/magnaat-leven');
const { boekVan } = require('../server/kern/magnaat-leven/boek');
const O = require('../server/kern/magnaat-leven/oordeel');
const { maakSpeler } = require('./lib-magnaatspeler');
const B = require('../server/kern/magnaat-leven/regels-bedrijf');

function leven(key = 'geheim-sessiesleutel') {
  let t = 1e12;
  const db = { data: {} };
  const L = maakLeven({ db, nu: () => t });
  L.staat(key);
  const st = () => db.data.magnaatLeven[key];
  const vraag = () => L.staat(key).vandaag.volgende.find(a => a.actie === 'oordeel');
  return { db, L, key, st, vraag, doe: (b) => L.actie(key, b) };
}
function metOnderneming(v) {
  assert.ok(!v.doe({ actie: 'kies', aanbod: 'foto' }).error);
  v.st().ondernemingVraag = v.st().dag;
  boekVan(v.st()).boekOver(v.st(), { soort: 'OPENING', van: ['begin'], naar: ['kas'], bedrag: 400000, omschrijving: 'proef', sleutel: 'proef' });
  assert.ok(!v.doe({ actie: 'onderneming', naam: 'Proef Oudwijk' }).error);
}

test('de vraag komt pas als het moment er is, en is nooit de hoofdactie', () => {
  const v = leven();
  v.doe({ actie: 'kies', aanbod: 'foto' });
  assert.equal(v.vraag(), undefined, 'zonder onderneming geen vraag');
  const w = leven();
  metOnderneming(w);
  const a = w.vraag();
  assert.ok(a, 'na de inschrijving staat de vraag er');
  assert.equal(a.invoer.moment, 'onderneming');
  assert.deepEqual(a.invoer.oordeel.map(x => x.id), ['te-makkelijk', 'goed', 'te-zwaar', 'overslaan']);
  assert.notEqual(w.L.staat(w.key).vandaag.volgende[0].actie, 'oordeel');
});

test('een oordeel is anoniem: geen sessiesleutel, geen codenaam, geen wereld in de opslag', () => {
  const v = leven();
  metOnderneming(v);
  const lang = 'Te\u0000 zwaar\n\n' + 'x'.repeat(400);
  const r = v.doe({ actie: 'oordeel', moment: 'onderneming', oordeel: 'te-zwaar', toelichting: lang });
  assert.ok(!r.error, r.error);
  const lijst = v.db.data.magnaatOordelen;
  assert.equal(lijst.length, 1);
  assert.deepEqual(Object.keys(lijst[0]).sort(), ['dag', 'moeilijkheid', 'moment', 'oordeel', 'op', 'tekst']);
  assert.equal(lijst[0].tekst.length, O.TEKST);
  assert.match(lijst[0].tekst, /^Te zwaar x/, 'stuurtekens en regelovergangen zijn weg');
  const json = JSON.stringify(lijst);
  for (const verboden of [v.key, v.st().wereld, v.st().codenaam].filter(Boolean)) assert.ok(!json.includes(verboden), 'bevat ' + verboden);
  assert.equal(v.vraag(), undefined, 'het moment is beantwoord');
  assert.match(v.doe({ actie: 'oordeel', moment: 'onderneming', oordeel: 'goed' }).error, /geen vraag open/);
  assert.equal(lijst.length, 1, 'een tweede keer telt niet');
});

test('overslaan sluit de vraag en bewaart niets; een onzinoordeel laat hem open', () => {
  const v = leven();
  metOnderneming(v);
  assert.match(v.doe({ actie: 'oordeel', moment: 'onderneming', oordeel: 'geweldig' }).error, /te makkelijk, goed zo of te zwaar/);
  assert.match(v.doe({ actie: 'oordeel', moment: 'zelfstandig', oordeel: 'goed' }).error, /niet \(meer\) open/);
  assert.ok(v.vraag(), 'de vraag staat nog open');
  assert.ok(!v.doe({ actie: 'oordeel', moment: 'onderneming', oordeel: 'overslaan' }).error);
  assert.equal(v.vraag(), undefined);
  assert.equal((v.db.data.magnaatOordelen || []).length, 0);
});

test('een leven dat voorbij is kan nog zeggen hoe het speelde, en verder niets; dat sluit ook het eerdere moment', () => {
  const p = maakSpeler({ moeilijkheid: 'zwaar' });
  for (let i = 0; i < 80 && !p.st().onderneming; i++) p.dag();
  for (const k of B.TEAMKANDIDATEN) p.L.actie(p.key, { actie: 'werf', kandidaat: k.id });
  for (let i = 0; i < 150 && !p.st().voorbij; i++) p.L.actie(p.key, { actie: 'slaap' });
  assert.ok(p.st().voorbij);
  const a = p.L.staat(p.key).vandaag.volgende;
  assert.deepEqual(a.map(x => x.actie), ['oordeel']);
  assert.equal(a[0].invoer.moment, 'voorbij', 'het zwaarste moment eerst');
  assert.equal(p.L.actie(p.key, { actie: 'slaap' }).status, 409);
  assert.ok(!p.L.actie(p.key, { actie: 'oordeel', moment: 'voorbij', oordeel: 'te-zwaar', toelichting: 'Personeel was te duur' }).error);
  assert.deepEqual(p.L.staat(p.key).vandaag.volgende, [], 'daarna ook de vraag van de inschrijving niet meer');
  assert.deepEqual(p.db.data.magnaatOordelen.map(x => [x.moment, x.moeilijkheid, x.oordeel]), [['voorbij', 'zwaar', 'te-zwaar']]);
});

test('het overzicht telt per niveau en moment, geeft de laatste regels, en is begrensd', () => {
  const lijst = [];
  for (let i = 0; i < O.MAX + 5; i++) lijst.push({ moment: 'zelfstandig', moeilijkheid: ['licht', 'normaal', 'zwaar'][i % 3], dag: 90, oordeel: 'goed', tekst: null, op: '2026-09-25' });
  lijst.push({ moment: 'voorbij', moeilijkheid: 'zwaar', dag: 92, oordeel: 'te-zwaar', tekst: 'eerste', op: '2026-09-25' });
  lijst.push({ moment: 'voorbij', moeilijkheid: 'zwaar', dag: 93, oordeel: 'te-zwaar', tekst: 'tweede', op: '2026-09-25' });
  lijst.push({ moment: 'raar', moeilijkheid: 'extreem', dag: 1, oordeel: 'goed', tekst: null, op: '2026-09-25' });
  const o = O.oordeelOverzicht(lijst);
  assert.equal(o.totaal, lijst.length);
  assert.equal(o.perNiveau.zwaar.voorbij['te-zwaar'], 2);
  assert.equal(o.perNiveau.licht.zelfstandig.goed + o.perNiveau.normaal.zelfstandig.goed + o.perNiveau.zwaar.zelfstandig.goed, O.MAX + 5);
  assert.deepEqual(o.regels.map(r => r.tekst), ['tweede', 'eerste'], 'nieuwste eerst');
  assert.equal(o.perNiveau.extreem, undefined, 'een onbekend niveau wordt niet verzonnen');
  assert.match(o.grens, /Anoniem/);

  const v = leven();
  metOnderneming(v);
  v.db.data.magnaatOordelen = lijst.slice(0, O.MAX);
  v.doe({ actie: 'oordeel', moment: 'onderneming', oordeel: 'goed' });
  assert.equal(v.db.data.magnaatOordelen.length, O.MAX, 'de oudste valt eraf');
});

test('het kantoor krijgt de speelronde via de bestaande status, achter de boardroom-poort', () => {
  const routes = {};
  const boardroomAuth = (req, res, next) => next();
  const v = leven();
  metOnderneming(v);
  v.doe({ actie: 'oordeel', moment: 'onderneming', oordeel: 'te-makkelijk', toelichting: 'kan sneller' });
  const kern = {
    app: { post: (pad, ...h) => { routes[pad] = h; }, get: () => {} },
    auth: () => {}, geenGast: () => false, boardroomAuth, supplierAuth: () => {}, managerOnly: () => {},
    magnaatWereld: { partnerstudio: {}, kantoorStatus: () => ({ ok: true }), leven: v.L }
  };
  require('../server/routes/magnaatwereld')(kern);
  const h = routes['/api/office/magnaat/status'];
  assert.equal(h[0], boardroomAuth, 'achter de boardroom-poort');
  return new Promise((klaar) => {
    h[1]({ body: {} }, { json: (r) => {
      assert.equal(r.ok, true);
      assert.equal(r.speelronde.totaal, 1);
      assert.equal(r.speelronde.perNiveau.normaal.onderneming['te-makkelijk'], 1);
      assert.deepEqual(r.speelronde.regels.map(x => x.tekst), ['kan sneller']);
      klaar();
    }, status: () => ({ json: (e) => assert.fail(JSON.stringify(e)) }) });
  });
});

test('het scherm bouwt de vraag en stuurt het oordeel met de toelichting', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/apps/magnaat-leven-invoer.js'), 'utf8'), { window });
  const I = window.RTGMagnaatLevenInvoer;
  const a = { actie: 'oordeel', label: 'Hoe speelt het?', waarom: 'w',
    invoer: { moment: 'zelfstandig', oordeel: [{ id: 'goed', naam: 'Goed zo' }, { id: 'overslaan', naam: 'Overslaan' }], toelichting: 'tekst' } };
  const esc = (x) => String(x);
  const html = I.html(a, { esc, duur: esc, vrij: 0 });
  assert.match(html, /id="vnF-oordeel"/);
  assert.match(html, /id="vnF-toelichting" maxlength="280"/);
  assert.equal(I.zonderVelden(a), false);
  const velden = { '#vnF-oordeel': { value: 'goed' }, '#vnF-toelichting': { value: 'prima' } };
  assert.deepEqual(JSON.parse(JSON.stringify(I.lichaam(a, (s) => velden[s]))), { actie: 'oordeel', moment: 'zelfstandig', oordeel: 'goed', toelichting: 'prima' });
});
