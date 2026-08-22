/* DE BESTUURLIJKE LAAG: organen, mandaat, besluitvorming, inspraak, rekenkamer.

   Het weefsel kon alles uitrekenen. Deze laag gaat over wie het mag besluiten,
   en de zwaarste bewering staat in toets 2: het mandaat BIJT. Een project boven
   de ambtelijke grens komt er niet doorheen zonder een aangenomen besluit van
   het juiste orgaan dat het bedrag ook echt dekt. Een mandaat dat nergens een
   deur dichthoudt, is een mening.

   Per blok staat de mutatie waarmee de bewering is nagetrokken; alle zeven zijn
   gedraaid en beten. EEN SLOEG DE EERSTE KEER AF, en dat leverde meteen een
   reparatie in de PRODUCTCODE op: de rekenkamervraag over ontbrekende
   bestuurlijke dekking keek naar het BUDGET, en een project dat te duur is
   begroot komt sinds het mandaat helemaal niet meer langs de begroting. Die
   vraag kon dus nooit gesteld worden. Nu toetst de rekenkamer op wat het
   project werkelijk KOSTTE -- en daarmee vangt hij precies het geval dat de
   begroting per definitie niet kan tegenhouden: een project dat netjes onder
   de grens begon en er tijdens de rit overheen ging.

   En een defect dat toets 2 ving voordat een mutatie eraan te pas kwam: de
   route /api/office/weefsel/project/maak gaf `besluitId` niet door, waardoor
   het mandaat onmogelijk te halen was. De poort stond dicht voor iedereen,
   ook voor wie het besluit gewoon had.
   Draai los: node --test test/stadsbesluit.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office, lid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-besluit-'));

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const oapi = (pad, body) => api('office/' + pad, { ...(body || {}), naam: 'Aïsha' }, office);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-BESLUIT-1' } });
  base = srv.base;
  const o = await (await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }) })).json();
  office = o.token;
  const l = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: 'rtg' }) })).json();
  lid = l.token;
  assert.ok(office && lid, 'het kantoor en een lid loggen in');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------------- 1. De organen en het mandaat ----------------
   MUTATIE (RAAK, alleen deze toets): in bestuur.js de trede voor
   veiligheidskritiek werk weghalen -> een kritieke uitgave van 10.000 bleef
   ambtelijk en de toets zakte. Dat is de regel die het verschil maakt tussen
   een bedrag en een risico. */
test('organen: vier soorten met verschillende bevoegdheid, en een mandaat dat aan bedrag en risico hangt', async () => {
  const o = await oapi('weefsel/organen');
  assert.equal(o.status, 200);
  const per = Object.fromEntries(o.body.organen.map(x => [x.soort, x]));
  assert.ok(per.raad && per.college && per.wijkraad && per.rekenkamer, 'raad, college, wijkraad en rekenkamer staan er');
  assert.equal(o.body.soorten.raad.besluit, true, 'de raad besluit');
  assert.equal(o.body.soorten.wijkraad.besluit, false, 'een wijkraad adviseert en besluit niet');
  assert.equal(o.body.soorten.rekenkamer.besluit, false, 'de rekenkamer onderzoekt en besluit nooit');
  assert.equal(o.body.organen.filter(x => x.soort === 'wijkraad').length, 3, 'een wijkraad per wijk uit de geografie');
  assert.ok(per.raad.fracties.reduce((n, f) => n + f.zetels, 0) === per.raad.zetels, 'de zetels tellen op tot de raad');

  const klein = await oapi('weefsel/mandaat', { bedrag: 10000 });
  assert.equal(klein.body.besluitNodig, false, 'dagelijks beheer tekent een ambtenaar');
  assert.equal(klein.body.rol, 'ambtenaar');
  const midden = await oapi('weefsel/mandaat', { bedrag: 300000 });
  assert.equal(midden.body.orgaan, 'college');
  const groot = await oapi('weefsel/mandaat', { bedrag: 900000 });
  assert.equal(groot.body.orgaan, 'raad');
  // en het risico schuift een trede op: hetzelfde bedrag, ander orgaan
  const kritiek = await oapi('weefsel/mandaat', { bedrag: 10000, kritiek: true });
  assert.equal(kritiek.body.orgaan, 'college', 'veiligheidskritiek werk van 10.000 gaat naar het college');
  assert.match(kritiek.body.reden, /een trede hoger/, 'met de reden erbij');
});

/* ---------------- 2. Het mandaat bijt ----------------
   MUTATIE (RAAK, alleen deze toets): in begroting.js de mandaatcontrole
   weghalen -> het project van drie ton werd zonder besluit gewoon aangemaakt
   en de toets zakte. Dit is de bewering waar deze hele laag om draait. */
test('het mandaat bijt: geen project boven de grens zonder een besluit dat het dekt', async () => {
  const doel = await oapi('weefsel/doel/maak', { doelNaam: 'Veilige schoolroutes', jaar: 2026, indicator: 'doorlooptijd' });
  const doelId = doel.body.doel.id;

  // onder de grens: gewoon aanmaken
  const klein = await oapi('weefsel/project/maak', { doelId, projectNaam: 'Klein onderhoud', budget: 15000 });
  assert.equal(klein.status, 200);
  assert.equal(klein.body.project.mandaat, 'ambtenaar');

  // erboven zonder besluit: geweigerd, met de reden
  const zonder = await oapi('weefsel/project/maak', { doelId, projectNaam: 'Herinrichting plein', budget: 300000 });
  assert.equal(zonder.status, 403);
  assert.match(zonder.body.error, /buiten het ambtelijk mandaat/);
  assert.match(zonder.body.error, /collegebesluit/);

  // een besluit dat NOG NIET is aangenomen dekt ook niets
  const v = await oapi('weefsel/voorstel', { orgaan: 'college', titel: 'Herinrichting plein', bedrag: 300000 });
  assert.equal(v.status, 200);
  assert.equal(v.body.besluit.status, 'ingediend');
  const teVroeg = await oapi('weefsel/project/maak', { doelId, projectNaam: 'Herinrichting plein', budget: 300000, besluitId: v.body.besluit.id });
  assert.equal(teVroeg.status, 403);
  assert.match(teVroeg.body.error, /is ingediend, niet aangenomen/);

  // stemmen, sluiten, en dan mag het
  await oapi('weefsel/stem', { besluitId: v.body.besluit.id, fractie: 'wethouder Financien', voor: true });
  await oapi('weefsel/stem', { besluitId: v.body.besluit.id, fractie: 'wethouder Ruimte', voor: true });
  const dicht = await oapi('weefsel/besluit/sluit', { besluitId: v.body.besluit.id });
  assert.equal(dicht.body.besluit.status, 'aangenomen');
  const met = await oapi('weefsel/project/maak', { doelId, projectNaam: 'Herinrichting plein', budget: 300000, besluitId: v.body.besluit.id });
  assert.equal(met.status, 200);
  assert.equal(met.body.project.besluitId, v.body.besluit.id, 'het project draagt zijn dekking');

  // hetzelfde besluit dekt geen groter bedrag, en geen raadsbesluit
  const teDuur = await oapi('weefsel/project/maak', { doelId, projectNaam: 'Veel te duur', budget: 900000, besluitId: v.body.besluit.id });
  assert.equal(teDuur.status, 403);
  assert.match(teDuur.body.error, /Gemeenteraad/, 'negen ton vraagt de raad, niet het college');
  const board = (await oapi('boardroom')).body;
  assert.ok((board.audit || []).some(a => /AANGENOMEN/.test(a.wat)), 'het besluit staat in het auditlog');
});

/* ---------------- 3. Stemmen, adviseren en tegen een advies in ----------------
   MUTATIE (RAAK, alleen deze toets): in besluitvorming.js de meerderheid
   rekenen over de UITGEBRACHTE stemmen in plaats van over alle zetels -> 13
   voor tegen 6 tegen werd "aangenomen" en de toets zakte. Dat is precies het
   verschil tussen een meerderheid van de aanwezigen en van de raad. */
test('stemmen gaat per fractie met zetels, en een besluit tegen een advies in staat als zodanig in het register', async () => {
  const v = await oapi('weefsel/voorstel', { orgaan: 'raad', titel: 'Herinrichting Marina', bedrag: 800000,
    toelichting: 'kade opnieuw inrichten' });
  assert.equal(v.status, 200);

  // een wijkraad adviseert; een raad stemt
  const wijkraad = (await oapi('weefsel/organen')).body.organen.find(x => x.soort === 'wijkraad');
  const adv = await oapi('weefsel/advies', { besluitId: v.body.besluit.id, orgaan: wijkraad.id, standpunt: 'tegen', toelichting: 'te veel steen' });
  assert.equal(adv.status, 200);
  assert.equal(adv.body.besluit.adviezen[0].standpunt, 'tegen');
  assert.equal((await oapi('weefsel/advies', { besluitId: v.body.besluit.id, orgaan: 'raad', standpunt: 'voor' })).status, 400,
    'een besluitvormend orgaan adviseert niet, het stemt');
  assert.equal((await oapi('weefsel/stem', { besluitId: v.body.besluit.id, fractie: 'Bestaatniet', voor: true })).status, 400);

  // 13 van de 27 zetels voor: geen meerderheid, ook al is het meer dan tegen
  await oapi('weefsel/stem', { besluitId: v.body.besluit.id, fractie: 'Stadsbelang', voor: true });
  await oapi('weefsel/stem', { besluitId: v.body.besluit.id, fractie: 'Ondernemend', voor: true });
  await oapi('weefsel/stem', { besluitId: v.body.besluit.id, fractie: 'Groen & Water', voor: false });
  const uit = await oapi('weefsel/besluit/sluit', { besluitId: v.body.besluit.id });
  assert.equal(uit.body.besluit.uitslag.voor, 13);
  assert.equal(uit.body.besluit.uitslag.tegen, 6);
  assert.equal(uit.body.besluit.uitslag.totaal, 27, 'de meerderheid gaat over alle zetels, niet over de aanwezigen');
  assert.equal(uit.body.besluit.uitslag.meerderheidNodig, 14);
  assert.equal(uit.body.besluit.status, 'verworpen');
  assert.deepEqual(uit.body.besluit.tegenAdvies, [], 'het advies was tegen en het besluit werd verworpen: niet tegen het advies in');
  assert.equal((await oapi('weefsel/stem', { besluitId: v.body.besluit.id, fractie: 'Sociaal', voor: true })).status, 400,
    'na het sluiten kan er niet meer gestemd worden');

  /* En de andere kant: een besluit dat WEL wordt aangenomen terwijl de wijkraad
     tegen adviseerde. Dat moet zichtbaar zijn -- het is het enige moment waarop
     een adviesrecht iets betekent. */
  const v2 = await oapi('weefsel/voorstel', { orgaan: 'raad', titel: 'Parkeerterrein Boulevard', bedrag: 600000 });
  await oapi('weefsel/advies', { besluitId: v2.body.besluit.id, orgaan: wijkraad.id, standpunt: 'tegen' });
  for (const f of ['Stadsbelang', 'Ondernemend', 'Sociaal']) await oapi('weefsel/stem', { besluitId: v2.body.besluit.id, fractie: f, voor: true });
  const uit2 = await oapi('weefsel/besluit/sluit', { besluitId: v2.body.besluit.id });
  assert.equal(uit2.body.besluit.status, 'aangenomen', '18 van de 27 zetels');
  assert.deepEqual(uit2.body.besluit.tegenAdvies, [wijkraad.naam], 'dit ging tegen het advies van de wijkraad in');
  assert.match(uit2.body.let_op, /tegen het advies/, 'en dat staat er met zoveel woorden bij');
});

/* ---------------- 4. Het openbare besluitenregister ----------------
   MUTATIE (RAAK, alleen deze toets): de publieke route weghalen achter auth ->
   het register gaf 401 zonder inlog en de toets zakte. Een besluitenregister
   dat je alleen met een account kunt lezen, is geen openbaarheid. */
test('het besluitenregister is openbaar en draagt geen personen', async () => {
  const open = await fetch(base + '/api/stad/besluiten').then(r => r.json());
  assert.ok(Array.isArray(open.besluiten) && open.besluiten.length >= 2, 'het register staat er, zonder enige inlog');
  const b = open.besluiten.find(x => /Marina/.test(x.titel));
  assert.ok(b, 'het raadsbesluit staat erin');
  assert.equal(b.status, 'verworpen');
  assert.ok(b.uitslag.voor >= 0 && b.uitslag.totaal > 0, 'met de stemverhouding');
  assert.ok(b.stemmen.every(s => typeof s.zetels === 'number'), 'fracties stemmen met zetels');
  assert.ok(!JSON.stringify(open.besluiten).includes('codenaam'), 'er staat geen enkele codenaam in het register');
  assert.ok(b.mandaatUitleg, 'en bij een bedrag staat welk mandaat erbij hoort: ' + b.mandaatUitleg);

  /* HETZELFDE REGISTER VIA POST. routes/stad.js hangt beide werkwoorden op, maar
     alleen de GET was ooit aangeroepen: de dekkingsmeting telde per PAD en zette
     de POST daarmee gratis op groen. Sinds ze per METHODE telt, valt dat op.
     Let op de LEGE body: de POST-variant leest filters uit req.body, en zonder
     filters hoort hij hetzelfde openbare register te geven als de GET. */
  const viaPost = await fetch(base + '/api/stad/besluiten',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    .then(async r => ({ status: r.status, body: await r.json() }));
  assert.equal(viaPost.status, 200, 'het besluitenregister antwoordt ook op POST');
  assert.deepEqual(viaPost.body, open, 'en geeft zonder filters precies hetzelfde register');
});

/* ---------------- 5. Inwonersraadpleging ----------------
   MUTATIE (RAAK, alleen deze toets): in inspraak.js uitGebied altijd true
   laten zijn -> de gebiedstelling werd gelijk aan de totale telling en de
   toets zakte. Dat onderscheid is de hele reden dat een raadpleging aan een
   gebied hangt. */
test('raadpleging: kijken mag altijd, reageren vraagt een profiel, en het gebied telt apart', async () => {
  const zone = (await oapi('weefsel/gebieden', { niveau: 'zone' })).body.gebieden.find(z => z.naam === 'Marina');
  const r = await oapi('weefsel/raadpleging/maak', { vraag: 'Meer groen op de kade?', gebied: zone.id,
    opties: ['ja', 'nee', 'anders'], dagen: 30 });
  assert.equal(r.status, 200);
  assert.equal((await oapi('weefsel/raadpleging/maak', { vraag: 'Te weinig keuzes', opties: ['ja'] })).status, 400);

  // een gast mag lezen maar niet meepraten
  const g = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: 'guest' }) })).json();
  assert.equal((await api('stad/raadplegingen', {}, g.token)).status, 200, 'meelezen mag met de gratis laag');
  assert.equal((await api('stad/raadpleging/reageer', { id: r.body.raadpleging.id, keuze: 'ja' }, g.token)).status, 403);

  // een lid uit het gebied, en een lid daarbuiten
  const uitZone = await api('stad/raadpleging/reageer', { id: r.body.raadpleging.id, keuze: 'ja', zone: 'Marina', tekst: 'graag bomen' }, lid);
  assert.equal(uitZone.status, 200);
  assert.equal(uitZone.body.jouwReactie.uitGebied, true);
  const buur = await (await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Buur', email: 'raad' + Date.now() + '@x.nl', phone: '0612349999',
      password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg', pasApp: 'rtg' }) })).json();
  const buiten = await api('stad/raadpleging/reageer', { id: r.body.raadpleging.id, keuze: 'nee', zone: 'Centrum' }, buur.token);
  assert.equal(buiten.body.jouwReactie.uitGebied, false, 'wie in Centrum woont, telt niet mee in de gebiedstelling van Marina');

  const beeld = (await api('stad/raadplegingen', {}, lid)).body.raadplegingen.find(x => x.id === r.body.raadpleging.id);
  assert.equal(beeld.uitslag.reacties, 2);
  assert.equal(beeld.uitslag.uitHetGebied, 1, 'een van de twee komt uit het gebied');
  assert.equal(beeld.uitslag.allen.ja, 1);
  assert.equal(beeld.uitslag.alleenGebied.ja, 1);
  assert.equal(beeld.uitslag.alleenGebied.nee, 0, 'de stem van buiten telt niet mee in de gebiedstelling');
  assert.equal(beeld.jouwReactie.keuze, 'ja', 'het lid ziet zijn eigen antwoord terug');

  // je bedenken verandert je eigen reactie; het worden er geen twee
  const nogmaals = await api('stad/raadpleging/reageer', { id: r.body.raadpleging.id, keuze: 'anders', zone: 'Marina' }, lid);
  assert.equal(nogmaals.body.jouwReactie.gewijzigd, true);
  const na = (await api('stad/raadplegingen', {}, lid)).body.raadplegingen.find(x => x.id === r.body.raadpleging.id);
  assert.equal(na.uitslag.reacties, 2, 'nog steeds twee reacties');
  assert.equal(na.uitslag.allen.anders, 1);

  // en de vrije tekst van bewoners blijft binnen: het register toont hem niet
  assert.ok(!JSON.stringify(na).includes('graag bomen'), 'de toelichting van een ander is niet zichtbaar');
  await oapi('weefsel/raadpleging/sluit', { id: r.body.raadpleging.id });
  assert.equal((await api('stad/raadpleging/reageer', { id: r.body.raadpleging.id, keuze: 'ja' }, lid)).status, 400, 'gesloten is gesloten');
});

/* ---------------- 6. De rekenkamer ----------------
   MUTATIE (RAAK, alleen deze toets): in rekenkamer.js de vraag over ontbrekende
   dekking weghalen -> een project zonder besluit leverde geen enkele vraag op
   en de toets zakte. Dat is precies waar een rekenkamer voor bestaat. */
test('de rekenkamer legt cijfers naast elkaar en stelt vragen -- hij geeft geen cijfer', async () => {
  const doel = await oapi('weefsel/doel/maak', { doelNaam: 'Minder wateroverlast', jaar: 2026 });
  const p = await oapi('weefsel/project/maak', { doelId: doel.body.doel.id, projectNaam: 'Kolken schoonmaken', budget: 12000 });
  const kolk = (await oapi('weefsel/objecten', { soort: 'put' })).body.objecten[0];
  const wo = await oapi('weefsel/werk/maak', { objectId: kolk.id, omschrijving: 'kolk doorspuiten', soort: 'onderhoud' });
  await oapi('weefsel/project/koppel', { projectId: p.body.project.id, werkorderId: wo.body.werkorder.id });
  /* Het project begon netjes onder de ambtelijke grens (EUR 12.000) en kwam er
     tijdens de uitvoering ruim overheen. Dat is het geval dat de begroting per
     definitie NIET kan tegenhouden -- die bewaakt de grens bij het aanmaken --
     en dus precies waarvoor een rekenkamer bestaat. */
  await oapi('weefsel/werk/klaar', { id: wo.body.werkorder.id, kosten: 31000, uren: 40 });

  const r = await oapi('weefsel/onderzoek', { projectId: p.body.project.id });
  assert.equal(r.status, 200);
  assert.ok(r.body.feiten.length >= 4, 'een feitenblad');
  assert.ok(r.body.feiten.some(f => /Budget EUR 12000/.test(f)), 'met het budget');
  assert.ok(r.body.vragen.some(v => /overschreden/.test(v)), 'en de vraag over de overschrijding: ' + JSON.stringify(r.body.vragen));
  assert.ok(r.body.vragen.some(v => /tijdens de uitvoering overheen/.test(v)),
    'en de vraag die alleen achteraf te stellen is: het mandaat werd overschreden zonder besluit');
  assert.equal(r.body.mandaat.orgaan, 'college', 'op EUR 31.000 was een collegebesluit nodig geweest');
  assert.ok(r.body.vragen.some(v => /indicator/.test(v)), 'en over het niet-gemeten effect');
  assert.match(r.body.let_op, /geen oordeel/, 'het systeem oordeelt niet');
  assert.ok(!('score' in r.body) && !('cijfer' in r.body), 'er komt geen score uit');
  assert.equal((await oapi('weefsel/onderzoek', { projectId: 'P-BESTAATNIET' })).status, 404);

  const jaar = await oapi('weefsel/jaarbeeld', { jaar: 2026 });
  assert.equal(jaar.status, 200);
  assert.ok(jaar.body.projecten.length >= 3, 'alle projecten van het jaar');
  assert.equal(typeof jaar.body.zonderDekking, 'number');
  assert.ok(jaar.body.zonderEffect >= 1, 'en het aantal projecten waarvan het effect niet is gemeten');
});

/* ---------------- 7. De routes ----------------
   MUTATIE (RAAK, alleen deze toets): officeAuth van /api/office/weefsel/stem
   vervangen door een doorgeefluik -> 200 op een onzin-token. */
const BESTUUR_ROUTES = [
  '/api/office/weefsel/organen', '/api/office/weefsel/mandaat', '/api/office/weefsel/besluiten',
  '/api/office/weefsel/besluit', '/api/office/weefsel/voorstel', '/api/office/weefsel/advies',
  '/api/office/weefsel/stem', '/api/office/weefsel/besluit/sluit', '/api/office/weefsel/raadplegingen',
  '/api/office/weefsel/raadpleging/maak', '/api/office/weefsel/raadpleging/sluit',
  '/api/office/weefsel/onderzoek', '/api/office/weefsel/jaarbeeld'
];
test('elke bestuursroute staat achter de kantoordeur; het publieke register staat er bewust buiten', async () => {
  for (const vol of BESTUUR_ROUTES) {
    const pad = vol.slice(5);
    const zonder = await api(pad, {}, 'onzin-token');
    assert.ok(zonder.status === 401 || zonder.status === 403, vol + ' is dicht zonder kantoorinlog (gaf ' + zonder.status + ')');
    const open = await api(pad, { naam: 'Aïsha' }, office);
    assert.ok(open.status < 500, vol + ' gaf een serverfout (' + open.status + ')');
    assert.ok(Object.keys(open.body).length > 0, vol + ' gaf geen JSON-antwoord -- bestaat de route nog?');
  }
  // en de twee die met opzet open zijn
  for (const pad of ['/api/stad/besluiten', '/api/stad/algoritmes']) {
    const r = await fetch(base + pad).then(x => x.json());
    assert.ok(Object.keys(r).length > 0, pad + ' hoort openbaar te zijn en antwoordt zonder inlog');
  }
});
