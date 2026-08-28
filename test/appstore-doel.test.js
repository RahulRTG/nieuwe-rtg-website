/* HET DOEL BIJ EEN MACHTIGING, EN DE VERGUNNINGSDIFF.

   Een machtiging zegt WAT een app krijgt; het doel zegt WAARVOOR. Dat tweede is
   waar een lid werkelijk op beslist, en het is het enige waarop een UPDATE te
   vergelijken valt: dezelfde machtiging voor een ander doel is een andere vraag.

   Wat deze toets vastlegt:

     1. Een machtiging zonder doel komt de poort niet door, en de fout noemt de
        doelen die er wel bij horen -- raden hoort niet bij een strenge poort.
     2. De doelen zijn een GESLOTEN lijst. Vrije tekst levert "om u beter van
        dienst te zijn" op: niet te vergelijken en niet te diffen.
     3. Wat een lid verleent, wordt met doel en al BEVROREN. Een nieuwe versie
        verandert niet waar hij ja op zei.
     4. Een update die meer vraagt, krijgt het NIET vanzelf -- en het lid ziet
        wat er wordt gevraagd voordat hij iets doet. Dit was een echt gat: tot
        deze toets kon een app in stilte groeien in bevoegdheden.
     5. Dezelfde machtiging voor een ander doel telt ook als meer.
     6. De mens die aftekent, ziet wat een inzending meer vraagt dan wat er live
        staat, zonder twee manifesten naast elkaar te leggen.
     7. Een weigering legt uit WELKE van de twee ontbrak: vroeg de app het niet,
        of gaf het lid het niet? Die twee hebben een andere oplossing.

   Draai los: node --experimental-sqlite --test test/appstore-doel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { MACHTIGINGEN, DOELEN } = require('../server/kern/appstore/machtigingen');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appstore-doel-'));
let srv, base, lid, sup, office, tech;
const ORG = 'O-DOEL';

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const HTML = '<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>D</title></head>' +
  '<body><p id="u">hoi</p><script src="app.js"></script></body></html>';
const bundel = (extra) => [{ pad: 'index.html', inhoud: HTML },
  { pad: 'app.js', inhoud: 'document.getElementById("u").textContent = "draait";' }].concat(extra || []);
const manifest = (over) => {
  const m = Object.assign({
    sleutel: 'doel-app', naam: 'Doelapp', versie: '1.0.0',
    uitleg: 'Een app die laat zien waarvoor hij iets vraagt, en niet alleen wat.',
    categorie: 'leven', machtigingen: [{ id: 'opslag.eigen', doel: 'voortgang-onthouden' }] }, over || {});
  delete m._extra;   // dit is bundelwerk, geen manifestveld
  return m;
};

async function inzend(over) {
  return api('/api/appstore/uitgever/inzenden', { manifest: manifest(over), bestanden: bundel(over && over._extra) }, sup);
}
async function publiceer(over) {
  const r = await inzend(over);
  assert.equal(r.status, 200, JSON.stringify(r.body.fouten || r.body.bevindingen || r.body.error || ''));
  /* De toegankelijkheidspoort staat sinds 27 augustus 2026 aan: publiceren kan
     niet zonder een geslaagde keuring op DEZE bundelhash. De keurloper doet dat
     in het echt (scripts/appstore-a11y.js); hier zetten we de uitslag zelf neer,
     want deze toetsen gaan over de winkel en niet over de keuring. */
  await api('/api/appstore/kantoor/toegankelijk',
    { versieId: r.body.versie.id, stand: 'in-orde', fouten: 0 }, office);
  const b = await api('/api/appstore/kantoor/besluit', { versieId: r.body.versie.id, besluit: 'gepubliceerd', door: 'Sam van RTG' }, office);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  return r.body.versie;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = (await api('/api/auth/register', { name: 'Doel Lid', email: 'doel@x.nl', phone: '0612345674',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  tech = (await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const chef = (roster.staff || []).find(x => x.role === 'manager');
  sup = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: chef.id, pin: '1234' })).body.token;
  assert.ok(lid && office && tech && sup);
  await api('/api/techniek/tenant', { org: ORG, naam: 'Doel Uitgeverij' }, tech);
  await api('/api/techniek/tenant/bind', { org: ORG, soort: 'zaak', code: 'KIKUNOI' }, tech);
  await api('/api/appstore/uitgever/aanvraag', { naam: 'Doel Uitgeverij', contact: 'dev@doel.nl' }, sup);
  await api('/api/appstore/kantoor/uitgever', { org: ORG, besluit: 'toegelaten', door: 'Sam van RTG' }, office);
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. een machtiging zonder doel komt de poort niet door, met de doelen erbij', async () => {
  const r = await inzend({ machtigingen: ['opslag.eigen'] });
  assert.equal(r.status, 400);
  const f = r.body.fouten[0];
  assert.match(f.wat, /heeft een doel nodig/);
  assert.match(f.wat, /voortgang-onthouden/, 'de mogelijke doelen staan erbij; raden hoort niet bij een strenge poort');
  assert.match(f.wat, /onthouden waar je gebleven was/, 'en in gewone taal, niet alleen als sleutel');
});

test('2. de doelen zijn een gesloten lijst', async () => {
  const r = await inzend({ machtigingen: [{ id: 'opslag.eigen', doel: 'om u beter van dienst te zijn' }] });
  assert.equal(r.status, 400);
  assert.match(r.body.fouten[0].wat, /gesloten lijst/);
  // en een doel dat bestaat maar bij een ANDERE machtiging hoort, telt ook niet
  const k = await inzend({ machtigingen: [{ id: 'opslag.eigen', doel: 'aanspreken' }] });
  assert.equal(k.status, 400);
  assert.match(k.body.fouten[0].wat, /hoort niet bij/);
  // twee keer dezelfde machtiging is een fout en geen stille ontdubbeling
  const d = await inzend({ machtigingen: [
    { id: 'opslag.eigen', doel: 'voortgang-onthouden' }, { id: 'opslag.eigen', doel: 'werk-bewaren' }] });
  assert.equal(d.status, 400);
  assert.match(d.body.fouten[0].wat, /twee keer/);
});

test('3. het lid ziet het doel, en wat hij geeft wordt bevroren', async () => {
  await publiceer();
  const kaart = (await api('/api/appstore/catalogus', {}, lid)).body.items[0];
  assert.equal(kaart.vraagt[0].doel, 'voortgang-onthouden');
  assert.equal(kaart.vraagt[0].waarvoor, DOELEN['voortgang-onthouden'],
    'het lid leest een zin, geen sleutel');

  const i = await api('/api/appstore/installeer', { sleutel: 'doel-app', machtigingen: ['opslag.eigen'] }, lid);
  assert.equal(i.status, 200);
  assert.equal(i.body.verleend[0].doel, 'voortgang-onthouden');
  const open = await api('/api/appstore/open', { sleutel: 'doel-app' }, lid);
  assert.equal(open.body.doelen['opslag.eigen'], 'voortgang-onthouden', 'het doel staat bij de verlening en niet bij de versie');
});

test('4. een update die MEER vraagt, krijgt het niet vanzelf', async () => {
  await publiceer({ versie: '2.0.0', _extra: [{ pad: 'v2.txt', inhoud: 'twee' }],
    machtigingen: [{ id: 'opslag.eigen', doel: 'voortgang-onthouden' }, { id: 'profiel.basis', doel: 'aanspreken' }] });

  const mijn = (await api('/api/appstore/mijn', {}, lid)).body.apps[0];
  assert.equal(mijn.verleend.length, 1, 'wat het lid gaf, is niet meegegroeid');
  assert.equal(mijn.updateVraagt.length, 1, 'en hij ziet dat er iets bij is gevraagd');
  assert.equal(mijn.updateVraagt[0].id, 'profiel.basis');
  assert.equal(mijn.updateVraagt[0].soort, 'nieuw');
  assert.equal(mijn.updateVraagt[0].waarvoor, DOELEN['aanspreken']);

  /* En de brug houdt hem tegen. Dit is de kern: een app die zijn manifest
     uitbreidt, mag daarmee niet meer KUNNEN -- alleen meer VRAGEN. */
  const nee = await api('/api/appstore/brug', { sleutel: 'doel-app', methode: 'profiel.wieBenIk' }, lid);
  assert.equal(nee.status, 403);

  // het lid kan het alsnog geven, en dan werkt het
  const ja = await api('/api/appstore/verleen', { sleutel: 'doel-app', machtigingen: ['opslag.eigen', 'profiel.basis'] }, lid);
  assert.equal(ja.status, 200);
  assert.equal((await api('/api/appstore/brug', { sleutel: 'doel-app', methode: 'profiel.wieBenIk' }, lid)).status, 200);
  assert.equal((await api('/api/appstore/mijn', {}, lid)).body.apps[0].updateVraagt.length, 0, 'daarna is er niets meer open');
});

test('5. dezelfde machtiging voor een ANDER doel telt ook als meer', async () => {
  await publiceer({ versie: '3.0.0', _extra: [{ pad: 'v3.txt', inhoud: 'drie' }],
    machtigingen: [{ id: 'opslag.eigen', doel: 'werk-bewaren' }, { id: 'profiel.basis', doel: 'aanspreken' }] });
  const mijn = (await api('/api/appstore/mijn', {}, lid)).body.apps[0];
  const diff = mijn.updateVraagt.find(x => x.id === 'opslag.eigen');
  assert.ok(diff, 'hetzelfde recht voor een ander doel is een nieuwe vraag');
  assert.equal(diff.soort, 'ander-doel');
  assert.equal(diff.eerderDoel, 'voortgang-onthouden');
  assert.equal(diff.doel, 'werk-bewaren');
  /* De app blijft gewoon werken met wat hij had: een update mag niet stilletjes
     meer krijgen, maar hij mag ook niet stilletjes stukgaan. */
  assert.equal((await api('/api/appstore/brug', { sleutel: 'doel-app', methode: 'opslag.lijst' }, lid)).status, 200);
});

test('6. de mens die aftekent ziet wat een inzending meer vraagt dan wat live staat', async () => {
  const r = await inzend({ versie: '4.0.0', _extra: [{ pad: 'v4.txt', inhoud: 'vier' }], prijsCenten: 250,
    machtigingen: [{ id: 'opslag.eigen', doel: 'werk-bewaren' }, { id: 'bericht.klaarzetten', doel: 'klaar-melden' }] });
  assert.equal(r.status, 200, JSON.stringify(r.body.fouten || r.body.bevindingen || ''));
  const w = await api('/api/appstore/kantoor/wachtrij', {}, office);
  const v = w.body.inzendingen.find(x => x.versie === '4.0.0');
  assert.ok(v && v.tovLive, 'de wachtrij zet de vergelijking erbij');
  assert.deepEqual(v.tovLive.erbij.map(x => x.id), ['bericht.klaarzetten'], 'wat er bij komt');
  assert.deepEqual(v.tovLive.eraf.map(x => x.id), ['profiel.basis'], 'en wat er af gaat');
  assert.equal(v.tovLive.prijsVan, 0);
  assert.equal(v.tovLive.prijsNaar, 250, 'ook een prijs die van gratis naar betaald gaat, is een verandering om te zien');
  assert.equal(v.tovLive.eersteVersie, false);
});

test('7. een weigering zegt WELKE van de twee ontbrak', async () => {
  /* Twee heel verschillende oorzaken met heel verschillende oplossingen: de app
     vroeg het niet (los het op in je manifest), of het lid gaf het niet (daar
     kun je niets aan doen, en dat hoort er dan ook te staan). */
  const nietGevraagd = await api('/api/appstore/brug', { sleutel: 'doel-app', methode: 'bericht.zet', args: { tekst: 'hoi' } }, lid);
  assert.equal(nietGevraagd.status, 403);
  assert.match(nietGevraagd.body.error, /vraagt hem niet in zijn manifest/);
  assert.match(nietGevraagd.body.hoe, /volgende versie/);
  assert.deepEqual(nietGevraagd.body.verleend.sort(), ['opslag.eigen', 'profiel.basis']);

  await api('/api/appstore/verleen', { sleutel: 'doel-app', machtigingen: ['opslag.eigen'] }, lid);
  const welGevraagd = await api('/api/appstore/brug', { sleutel: 'doel-app', methode: 'profiel.wieBenIk' }, lid);
  assert.equal(welGevraagd.status, 403);
  assert.match(welGevraagd.body.error, /niet verleend of weer ingetrokken/);
  assert.match(welGevraagd.body.hoe, /Alleen het lid/);
});

test('8. elk doel in de catalogus hoort bij ten minste een machtiging', () => {
  /* LAT-regel 6 in het klein: een doel dat te noemen is maar bij geen enkele
     machtiging hoort, is een woord dat een uitgever kan typen en dat nergens
     iets betekent. */
  const gebruikt = new Set();
  for (const m of MACHTIGINGEN) for (const d of m.doelen) gebruikt.add(d);
  for (const d of Object.keys(DOELEN)) {
    assert.ok(gebruikt.has(d), 'doel "' + d + '" staat in de catalogus maar hoort bij geen enkele machtiging');
  }
  for (const m of MACHTIGINGEN) {
    assert.ok(m.doelen.length, m.id + ' heeft geen enkel doel, en is daarmee niet te vragen');
    for (const d of m.doelen) assert.ok(DOELEN[d], m.id + ' noemt doel "' + d + '" dat niet in de catalogus staat');
  }
});
