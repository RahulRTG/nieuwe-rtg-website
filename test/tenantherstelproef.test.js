/* DE HERSTELPROEF -- en het verschil dat hij NIET mag verdoezelen.

   Een uitvoer die niemand ooit heeft teruggelezen, is een belofte. Deze proef
   maakt er een datum van: exporteren, teruglezen in een tijdelijke werkruimte,
   de catalogus per soort naast de eerste leggen, en die tijdelijke werkruimte
   weer weg.

   HET VERSCHIL DAT DEZE TOETS BEWAAKT, en het is de reden dat dit bestand er
   is. Wat hier bewezen wordt is het EXIT-pad: krijgt een klant zijn data
   terug. Wat NIET bewezen wordt is dat de dagback-up van het PLATFORM terug te
   zetten is -- een andere claim, met een ander faalpad, en het is de claim waar
   een SLA aan hangt. Ze door elkaar laten lopen zou de makkelijkste manier zijn
   om die SLA-voorwaarde op ja te krijgen zonder dat er iets is veranderd.
   Toets 4 zorgt dat dat niet stilletjes gebeurt.

   Vijf beweringen:

   1. Een geslaagde proef laat het ORIGINEEL onaangeroerd en laat NIETS staan.
   2. De uitslag is een feit met een datum, en bij een verschil staat WELKE
      soort afweek.
   3. Een achtergebleven proefwerkruimte van een afgebroken run wordt opgeruimd.
   4. De SLA-voorwaarde blijft op NEE, ook na een geslaagde proef, met een reden
      die het verschil noemt.
   5. De bewering die er WEL bij komt, draagt haar bron -- en verloopt.

   Draai los: node --experimental-sqlite --test test/tenantherstelproef.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-herstel-'));
let srv, base, tech, ruimte, beheer;

const post = (pad, body, token) => fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const S = () => ({ werkruimte: ruimte, beheerToken: beheer });

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const w = await post('/api/bedrijf/werkruimte/maak', { naam: 'Proefhuis BV' });
  ruimte = w.body.werkruimte; beheer = w.body.beheerToken;

  /* Wat inhoud, anders bewijst een geslaagde proef over een lege werkruimte
     niets: nul soorten die overeenkomen, komen altijd overeen. */
  const l = await post('/api/bedrijf/lid/aanmeld', { werkruimte: ruimte, naam: 'Pia' });
  await post('/api/bedrijf/lid/besluit', Object.assign({ lidId: l.body.lidId, akkoord: true }, S()));
  await post('/api/bedrijf/lid/rollen', Object.assign({ lidId: l.body.lidId, rollen: ['projectleider'] }, S()));
  const L = { werkruimte: ruimte, lidToken: l.body.lidToken };
  const p = await post('/api/bedrijf/project/maak', Object.assign({ naam: 'Uitrol', werkvorm: 'stadsuitrol' }, L));
  await post('/api/bedrijf/taak/maak', Object.assign({ titel: 'Vergunning', projectId: p.body.project.id, wie: 'Pia' }, L));

  tech = (await post('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
  await post('/api/techniek/tenant', { org: 'O-PROEF', naam: 'Proefhuis Groep' }, tech);
  await post('/api/techniek/tenant/bind', { org: 'O-PROEF', soort: 'werkruimte', code: ruimte }, tech);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* De hele werkruimte als tekst: de enige eerlijke manier om te toetsen dat de
   proef het origineel niet aanraakt. */
async function afdruk() {
  const uit = await post('/api/tenant/export', S());
  return JSON.stringify(uit.body.inhoud);
}

test('1. de proef raakt het origineel niet aan en laat niets staan', async () => {
  const voor = await afdruk();
  const r = await post('/api/tenant/herstelproef', S());
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.equal(r.body.proef.gelukt, true, JSON.stringify(r.body.proef).slice(0, 300));
  assert.equal(await afdruk(), voor, 'geen byte verschil in de eigen werkruimte');

  /* EN DE TIJDELIJKE WERKRUIMTE IS WEG. Een kopie van andermans data zonder
     eigenaar is precies wat hier niet mag blijven staan. Het bewijs zit in de
     VOLGENDE proef: die ruimt bij binnenkomst alles op wat er nog van een
     vorige run staat, en meldt hoeveel dat er waren. Nul betekent dat de eerste
     proef zijn eigen rommel heeft opgeruimd. */
  assert.equal(r.body.proef.opgeruimd, 0, 'deze run trof zelf niets aan');
  const tweede = await post('/api/tenant/herstelproef', S());
  assert.equal(tweede.body.proef.opgeruimd, 0,
    'en de vorige run liet niets achter -- anders had deze er een opgeruimd');
});

test('2. de uitslag is een feit met een datum, en noemt wat er is vergeleken', async () => {
  const r = await post('/api/tenant/herstelproef', S());
  const p = r.body.proef;
  assert.match(p.at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(p.werkruimte, ruimte);
  assert.ok(p.soorten > 3, 'er zijn meerdere soorten vergeleken: ' + p.soorten);
  assert.ok(p.objecten > 0, 'en er zat inhoud in: ' + p.objecten);
  assert.deepEqual(p.verschillen, []);
  assert.match(r.body.let, /EXIT-pad/i, 'en het antwoord zegt WAT het bewijst');
  assert.match(r.body.let, /niet.*dagback-up|niet deze back-up|is een andere claim/i,
    'en wat het NIET bewijst: ' + r.body.let);
});

test('3. een verschil wordt per soort genoemd, en niet als "mislukt"', () => {
  /* De vergelijking los, want een echt verschil is via de API niet te maken --
     de uitvoer gaat er ongewijzigd weer in. Dat is precies waarom deze functie
     apart staat: de fout die hij moet vangen, komt uit de OPSLAG en niet uit
     een verzoek. */
  const maak = require('../server/kern/tenant/herstelproef');
  const h = maak({ db: { data: {} }, save() {}, register: { vanWerkruimte: () => null, haal: () => null },
    uitgang: {} });
  const v = h.vergelijk(
    [{ soort: 'taken', aantal: 3, checksum: 'a' }, { soort: 'leden', aantal: 1, checksum: 'b' }],
    [{ soort: 'taken', aantal: 2, checksum: 'z' }, { soort: 'extra', aantal: 9, checksum: 'q' }]);
  assert.deepEqual(v, [
    { soort: 'taken', wat: 'andere inhoud', voor: 3, na: 2 },
    { soort: 'leden', wat: 'ontbreekt na het teruglezen' },
    { soort: 'extra', wat: 'kwam erbij na het teruglezen' }
  ], 'elk verschil bij naam: een proef die alleen "mislukt" zegt, kun je niet naspelen');
});

test('4. de SLA-voorwaarde blijft op NEE, ook na een geslaagde proef', async () => {
  const st = (await post('/api/tenant/status', S())).body.status;
  const sla = st.beweringen.find(b => b.id === 'sla');
  assert.equal(sla.mag, false, 'er is nog steeds geen SLA');

  const back = sla.voorwaarden.find(v => /PLATFORM-back-up/.test(v.wat));
  assert.ok(back, 'de voorwaarde noemt expliciet de PLATFORM-back-up: ' + sla.voorwaarden.map(v => v.wat).join(' | '));
  assert.equal(back.ja, false, 'en die blijft nee, hoe geslaagd de uitvoerproef ook was');
  /* DE ASSERTIE WAAR DEZE TOETS VOOR BESTAAT. De reden noemt allebei, zodat
     niemand de ene voor de andere kan aanzien. */
  assert.match(back.reden, /UITVOER van deze organisatie is wel teruggelezen/);
  assert.match(back.reden, /bewijst het exit-pad en niet deze back-up/);
});

test('5. de bewering die er WEL bij komt, draagt haar bron', async () => {
  const st = (await post('/api/tenant/status', S())).body.status;
  const b = st.beweringen.find(x => x.id === 'uitvoer-beproefd');
  assert.ok(b, 'de bewering bestaat: ' + st.beweringen.map(x => x.id).join(', '));
  assert.equal(b.mag, true);
  assert.match(b.bron, /soorten/);
  assert.match(b.bron, /geen verschil/);
  assert.match(b.bron, /exit-pad, niet de platform-back-up/, 'met de grens in de bron zelf');
  assert.ok(st.toonbaar.includes('uitvoer-beproefd'), 'en hij mag getoond worden');
});

test('6. zonder proef staat de bewering er ook, en dan op nee met de reden', async () => {
  const w = await post('/api/bedrijf/werkruimte/maak', { naam: 'Nooitbeproefd BV' });
  await post('/api/techniek/tenant', { org: 'O-NOOIT', naam: 'Nooit' }, tech);
  await post('/api/techniek/tenant/bind', { org: 'O-NOOIT', soort: 'werkruimte', code: w.body.werkruimte }, tech);
  const st = (await post('/api/tenant/status',
    { werkruimte: w.body.werkruimte, beheerToken: w.body.beheerToken })).body.status;
  const b = st.beweringen.find(x => x.id === 'uitvoer-beproefd');
  assert.equal(b.mag, false);
  assert.equal(b.bron, null);
  assert.match(b.reden, /nog geen herstelproef/,
    'weglaten leest als vergeten, dus hij staat er met de reden: ' + b.reden);
});

test('7. een achtergebleven proefwerkruimte wordt opgeruimd', () => {
  /* De opruiming los, want een afgebroken run is via de API niet na te spelen.
     Het register staat BUITEN de werkruimte: een merk OP de werkruimte leek
     eenvoudiger, maar dat veld is gewone inhoud en kwam dus in de uitvoer --
     de vergelijking meldde daarna trouw dat er een soort `proef` was bijgekomen.
     Een marker die in het gemeten object zit, meet zichzelf. */
  const maak = require('../server/kern/tenant/herstelproef');
  const db = { data: { werkruimtes: { WOUD: { code: 'WOUD' }, WECHT: { code: 'WECHT' } },
    herstelproefRuimtes: ['WOUD'] } };
  let bewaard = 0;
  const h = maak({ db, save: () => { bewaard++; }, register: {}, uitgang: {} });
  assert.equal(h.ruimOp(), 1);
  assert.deepEqual(Object.keys(db.data.werkruimtes), ['WECHT'], 'alleen de proefruimte gaat weg');
  assert.deepEqual(db.data.herstelproefRuimtes, [], 'en het register is leeg');
  assert.ok(bewaard > 0, 'en het is vastgelegd');
  assert.equal(h.ruimOp(), 0, 'een tweede keer valt er niets op te ruimen');
});

/* ---------- de drie beweringen die alleen VAN BINNEN te zien zijn ----------

   Drie mutaties overleefden de toetsen hierboven, en dat was terecht: ze gaan
   over dingen die je via de API niet kunt waarnemen. De tijdelijke werkruimte
   laten staan is onzichtbaar zolang er geen leespad naar de werkruimtebak is;
   `gelukt: true` hardcoderen valt niet op zolang elke echte proef slaagt; en
   een proef die nooit verloopt merk je pas over een halfjaar. Met een nagemaakte
   uitgang zijn ze alle drie wel te zien -- en een toets die alleen kijkt waar
   het licht is, dekt niet wat hij lijkt te dekken (LAT.md regel 9). */
function nepHuis(tweedeCatalogus) {
  const cat = [{ soort: 'taken', aantal: 2, checksum: 'aa' }, { soort: 'leden', aantal: 1, checksum: 'bb' }];
  const db = { data: { werkruimtes: { WECHT: { code: 'WECHT' } }, tenants: { 'O-X': { org: 'O-X' } } } };
  let n = 0;
  const uitgang = {
    exporteer: () => ({ ok: true, uitvoer: { catalogus: (n++ === 0 ? cat : (tweedeCatalogus || cat)) } }),
    lees: () => { db.data.werkruimtes.WTMP = { code: 'WTMP', beheerToken: 'x' }; return { ok: true, werkruimte: 'WTMP' }; }
  };
  const h = require('../server/kern/tenant/herstelproef')({
    db, save() {}, uitgang, register: { vanWerkruimte: () => ({ org: 'O-X' }), haal: () => ({ org: 'O-X' }) } });
  return { h, db };
}

test('8. de tijdelijke werkruimte staat er na afloop echt niet meer', () => {
  const { h, db } = nepHuis();
  const uit = h.doe('WECHT', 'toets');
  assert.equal(uit.proef.gelukt, true);
  assert.deepEqual(Object.keys(db.data.werkruimtes), ['WECHT'],
    'de proefwerkruimte is weg uit de BAK en niet alleen uit het register');
  assert.deepEqual(db.data.herstelproefRuimtes, []);
});

test('9. een verschil maakt de proef niet geslaagd', () => {
  const { h, db } = nepHuis([{ soort: 'taken', aantal: 2, checksum: 'ZZ' }]);
  const uit = h.doe('WECHT', 'toets');
  assert.equal(uit.proef.gelukt, false, 'een andere checksum is een verschil en geen detail');
  assert.equal(uit.proef.verschillen.length, 2, JSON.stringify(uit.proef.verschillen));
  assert.match(uit.let, /week af/);
  assert.deepEqual(Object.keys(db.data.werkruimtes), ['WECHT'], 'en ook nu blijft er niets staan');

  /* Een mislukte proef telt NIET als bewijs -- anders is "we hebben het
     geprobeerd" hetzelfde waard als "het werkte". */
  assert.equal(h.laatsteGeslaagde('O-X').ok, false);
  assert.match(h.laatsteGeslaagde('O-X').reden, /niet geslaagd/);
});

test('10. een oude proef vervalt, en zegt dat', () => {
  const { h, db } = nepHuis();
  h.doe('WECHT', 'toets');
  assert.equal(h.laatsteGeslaagde('O-X').ok, true, 'vers geldt hij');

  const oud = new Date(Date.now() - (h.GELDIG_DAGEN + 5) * 86400000).toISOString();
  db.data.tenants['O-X'].herstelproeven[0].at = oud;
  const l = h.laatsteGeslaagde('O-X');
  assert.equal(l.ok, false, 'een proef van vorig jaar is geen bewijs van vandaag');
  assert.match(l.reden, new RegExp('ouder dan ' + h.GELDIG_DAGEN + ' dagen'));
  assert.equal(l.proef.at, oud, 'en hij noemt WELKE proef het was');
});
