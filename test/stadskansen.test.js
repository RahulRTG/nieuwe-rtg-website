/* DE STEDELIJKE KANSENLAAG: onderwijs, werk en de lokale economie.

   Het punt van deze laag is dat hij bijna niets zelf bijhoudt: vacatures komen
   uit kern/werk, bedrijven uit de partnerlijst, beroepen uit de
   Beroepen-Bibliotheek, aankomend werk uit de onderhoudsplanning. Wat hij
   toevoegt is de PLAATS en de VERBINDING. Deze toetsen meten dus vooral of die
   verbindingen echt kloppen -- en of ze eerlijk nul zeggen als een bron
   ontbreekt in plaats van "er is geen werk".

   Per blok staat de mutatie waarmee de bewering is nagetrokken; alle zes zijn
   gedraaid en beten. TWEE ERVAN SLOEGEN DE EERSTE KEER AF, en om verschillende
   redenen -- allebei het opschrijven waard:

   - de mutatie op de pand-omgeving zette `omgeving: null` VOORAAN in hetzelfde
     object-literal, waar de echte sleutel er verderop overheen schreef. De
     mutatie deed dus niets. Een mutatie die je niet ziet bijten kan ook een
     kapotte mutatie zijn, en dat is een andere fout dan een zwakke toets.
   - de hinder-toets zette het werk toevallig aan hetzelfde straatsegment als
     het bedrijf, dus "alleen exact hetzelfde gebied" bleef groen. Nu staat het
     werk in een ANDER segment van dezelfde zone -- want dat is de bewering:
     een ondernemer heeft last van werk in zijn zone, niet alleen van werk
     precies voor zijn deur.

   En een echt defect dat daaruit boven kwam: de kolken stonden in de seed op
   de helft van de dwarsstraat, en dat is precies het kruispunt met de laan.
   Ze bonden daardoor aan de verkeerde straat en heetten "Marinastraat kolk"
   terwijl hun adres de Marinalaan was.
   Draai los: node --experimental-sqlite --test test/stadskansen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office, partner;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kansen-'));

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const oapi = (pad, body) => api('office/' + pad, { ...(body || {}), naam: 'Aïsha' }, office);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-KANSEN-1' } });
  base = srv.base;
  const o = await (await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }) })).json();
  office = o.token;
  const kik = await api('supplier/login', { username: 'rahul', password: 'Imran' });
  partner = kik.body.token;
  assert.ok(office && partner, 'het kantoor en een partner loggen in');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------------- 1. Werk op de kaart, en een tekort dat een leerpad wordt ----------------
   MUTATIE (RAAK, alleen deze toets): in kansen.js de beroepenmatch op een
   EXACTE gelijkheid laten draaien in plaats van op "komt voor in de tekst" ->
   "Ervaren lasser (mig/mag)" matchte niets meer, het tekort verdween en de
   toets zakte op het leerpad. Dat is de kern van deze laag: een vacaturetekst
   is nooit precies een beroepsnaam. */
test('werk: vacatures landen in de wijk waar ze staan, en een tekort wijst naar een gratis leerpad', async () => {
  // een echte vacature bij een echte partner (de demo-zaak staat in de stad)
  const v = await api('supplier/vacature', { func: 'Ervaren lasser (mig/mag)', omschrijving: 'Vast werk in de werkplaats',
    uren: '38 uur', soort: 'vast', minLeeftijd: 18 }, partner);
  assert.ok(v.status === 200 || v.status === 201, 'de partner zet een vacature open (' + v.status + ')');

  const k = await oapi('weefsel/kansen');
  assert.equal(k.status, 200);
  assert.equal(k.body.bronnen.vacatures, true, 'de vacaturebron is gekoppeld');
  assert.equal(k.body.bronnen.beroepen, true, 'en de beroepenbron ook');
  assert.ok(k.body.werk.bedrijven >= 1, 'er staan bedrijven in de stad: ' + k.body.werk.bedrijven);
  assert.ok(k.body.werk.perWijk.length >= 1, 'en ze hangen aan een wijk');
  assert.match(k.body.let_op, /nooit wie er zoekt/, 'de laag telt werk, geen werkzoekenden');

  const t = await oapi('weefsel/tekorten');
  assert.equal(t.status, 200);
  const lasser = t.body.beroepen.find(b => b.beroep === 'Lasser');
  assert.ok(lasser, 'de vacaturetekst "Ervaren lasser (mig/mag)" is herkend als het beroep Lasser');
  assert.equal(lasser.wereld, 'techniek');
  assert.match(lasser.leren, /gratis leerpad voor Lasser/, 'en er hangt meteen een leerpad aan');
  assert.ok(Array.isArray(t.body.zonderBeroep), 'wat NIET matcht staat apart, zodat het gat zichtbaar blijft');
});

/* ---------------- 2. Leegstand met zijn omgeving ----------------
   MUTATIE (RAAK, alleen deze toets): in ondernemers.js de omgeving weglaten uit
   publiekPand -> de toets zakte op "wat staat eromheen". Dat is precies wat
   deze laag toevoegt boven een lijst met adressen; zonder dat is het een
   spreadsheet die elke makelaar ook heeft. */
test('leegstand: een pand is een object in het register, en de stad weet wat eromheen staat', async () => {
  const l = await oapi('weefsel/leegstand');
  assert.equal(l.status, 200);
  assert.ok(l.body.aantal >= 2, 'er staan panden leeg: ' + l.body.aantal);
  const p = l.body.panden[0];
  assert.ok(p.m2 > 0 && p.huur > 0, 'met oppervlak en huur');
  assert.ok(p.leegMaanden >= 1, 'en hoe lang al: ' + p.leegMaanden + ' maanden');
  assert.ok(p.omgeving && typeof p.omgeving.haltes === 'number', 'met de omgeving erbij: ' + JSON.stringify(p.omgeving));
  assert.ok(p.plaats.includes('·'), 'en de plek in de stad: ' + p.plaats);
  assert.ok(l.body.panden[0].leegMaanden >= l.body.panden[l.body.panden.length - 1].leegMaanden, 'langst leegstaand bovenaan');

  // de economische staat is te zetten, en alleen op een pand
  const pand = (await oapi('weefsel/objecten', { soort: 'pand' })).body.objecten.find(o => !l.body.panden.some(x => x.objectId === o.id));
  const zet = await oapi('weefsel/pand/zet', { objectId: pand.id, leeg: true, m2: 240, huur: 1600 });
  assert.equal(zet.status, 200);
  assert.equal(zet.body.pand.leeg, true);
  assert.equal((await oapi('weefsel/leegstand')).body.aantal, l.body.aantal + 1);
  const lantaarn = (await oapi('weefsel/objecten', { soort: 'lantaarn' })).body.objecten[0];
  assert.equal((await oapi('weefsel/pand/zet', { objectId: lantaarn.id, leeg: true })).status, 400, 'een lantaarn is geen pand');
  const board = (await oapi('boardroom')).body;
  assert.ok((board.audit || []).some(a => /staat nu LEEG/.test(a.wat)), 'en het staat in het auditlog');
});

/* ---------------- 3. Hinder en opdrachten ----------------
   MUTATIE (RAAK, alleen deze toets): in ondernemers.js het zone-filter van
   hinder() omdraaien (alleen exact hetzelfde gebied in plaats van ook de zone)
   -> geen enkel bedrijf werd nog geraakt en de toets zakte. Een ondernemer
   staat zelden precies aan het straatsegment waar gewerkt wordt; de zone is
   het niveau waarop hij er last van heeft. */
test('hinder: wie moet weten dat zijn straat open gaat, en welk werk staat open voor een lokale partij', async () => {
  // werk in de zone waar de demo-zaak staat
  const bedrijfZone = (await oapi('weefsel/kansen')).body.werk.perWijk[0];
  assert.ok(bedrijfZone, 'er is een wijk met bedrijven');
  const paal = (await oapi('weefsel/objecten', { soort: 'lantaarn', gebied: bedrijfZone.gebied })).body.objecten[0];
  await oapi('weefsel/werk/maak', { objectId: paal.id, omschrijving: 'kabelwerk, straat open van 3 tot 7 juni', soort: 'onderhoud' });

  const h = await oapi('weefsel/hinder');
  assert.equal(h.status, 200);
  assert.ok(h.body.aantal >= 1, 'er is werk dat een ondernemer raakt: ' + h.body.aantal);
  const raak = h.body.hinder.find(x => /kabelwerk/.test(x.omschrijving));
  assert.ok(raak, 'de kabelklus staat erbij');
  assert.ok(raak.bedrijven.length >= 1, 'met de bedrijven die het raakt');
  assert.match(raak.bericht, /Er staat werk gepland/, 'en een bericht dat een mens kan versturen');

  /* En de bewering die er echt toe doet: het bereik is de ZONE en niet het
     straatsegment. Een ondernemer staat zelden precies aan de stoep waar
     gewerkt wordt, maar heeft er wel last van. Vandaar werk op een object in
     een ANDER segment van dezelfde zone -- dat moet hem nog steeds bereiken.
     (Mijn eerste versie toetste dit niet: daar stond het bedrijf toevallig aan
     hetzelfde segment, dus een mutatie naar "alleen exact hetzelfde gebied"
     bleef groen.) */
  const zoneNaam = raak.bedrijven[0].zone;
  const kolk = (await oapi('weefsel/objecten', { soort: 'put' })).body.objecten
    .find(o => o.plaats.includes(zoneNaam) && o.gebied !== paal.gebied);
  assert.ok(kolk, 'er is een object in een ander segment van ' + zoneNaam);
  await oapi('weefsel/werk/maak', { objectId: kolk.id, omschrijving: 'kolk vervangen in de dwarsstraat', soort: 'onderhoud' });
  const h2 = await oapi('weefsel/hinder');
  const ander = h2.body.hinder.find(x => /dwarsstraat/.test(x.omschrijving));
  assert.ok(ander, 'ook dat werk staat op de hinderlijst');
  assert.ok(ander.bedrijven.some(b => b.zone === zoneNaam),
    'en het bereikt de ondernemer in dezelfde zone, ook al ligt het aan een andere straat');

  const o = await oapi('weefsel/opdrachten');
  assert.equal(o.status, 200);
  assert.ok(o.body.opdrachten.length >= 3, 'er komt werk aan, gebundeld per soort');
  const zonderContract = o.body.opdrachten.filter(x => x.kans);
  assert.ok(zonderContract.length >= 1, 'en voor een deel loopt nog geen contract: ' + zonderContract.length);
  assert.match(zonderContract[0].kans, /staat open voor een lokale partij/);

  // zodra er een contract voor die soort loopt, is het geen open kans meer
  const soort = zonderContract[0].soort;
  await oapi('weefsel/contract/maak', { partij: 'Lokaal Beheer VOF', soorten: [soort] });
  const na = (await oapi('weefsel/opdrachten')).body.opdrachten.find(x => x.soort === soort);
  assert.equal(na.contract, 'Lokaal Beheer VOF', 'het contract staat er nu bij');
  assert.equal(na.kans, null, 'en het is geen open kans meer');
});

/* ---------------- 4. Drukte rond een evenement ----------------
   MUTATIE (RAAK, alleen deze toets): in ondernemers.js drukte() de
   ondernemerslijst laten weglaten -> de toets zakte op wie er geinformeerd
   moet worden. De simulatie zelf blijft dan gewoon werken, en dat is precies
   het verschil dat deze laag maakt. */
test('drukte: de simulatie zegt wat er op de stad afkomt, de kansenlaag zegt wie dat moet weten', async () => {
  const wijk = (await oapi('weefsel/kansen')).body.werk.perWijk.find(w => w.bedrijven > 0);
  assert.ok(wijk && wijk.gebied, 'er is een wijk met bedrijven');
  const d = await oapi('weefsel/drukte', { gebied: wijk.gebied, bezoekers: 15000, uren: 8 });
  assert.equal(d.status, 200);
  assert.equal(d.body.bezoekers, 15000);
  assert.ok(d.body.knelpunten.length >= 1, 'de simulatie noemt de knelpunten');
  assert.ok(Array.isArray(d.body.ondernemers) && d.body.ondernemers.length >= 1, 'en de kansenlaag noemt wie het raakt');
  assert.match(d.body.bericht, /bezoekers naar/, 'met een bericht dat te versturen is');
  assert.equal((await oapi('weefsel/drukte', { gebied: 'G-bestaatniet', bezoekers: 100 })).status, 404);
});

/* ---------------- 5. Zonder bron: nul, en niet "geen werk" ----------------
   Dit is de bewering die het makkelijkst stil kapot gaat: als de koppeling in
   server.js ooit wegvalt, hoort deze laag te zeggen dat de BRON weg is. Een
   dashboard dat dan "0 vacatures" toont, laat een wethouder concluderen dat er
   geen werk is in zijn stad. De toets leest daarom niet alleen het getal maar
   ook het vlaggetje eronder. */
test('zonder bron zegt de laag dat de bron ontbreekt, niet dat er geen werk is', async () => {
  const maak = require('../server/kern/stadsweefsel');
  const db = { data: {} };
  const { weefsel } = maak({ db, save: () => {}, crypto: require('crypto') });
  weefsel.weefselZorg();
  const k = weefsel.weefselKansen();
  assert.equal(k.werk.vacatures, 0);
  assert.equal(k.bronnen.vacatures, false, 'het vlaggetje zegt dat de bron ontbreekt');
  assert.match(k.let_op, /bron is niet gekoppeld/, 'en de tekst zegt het ook: ' + k.let_op);
  // met een bron erbij telt hij gewoon
  const zone = weefsel.weefselGebieden({ niveau: 'zone' }).gebieden[0];
  weefsel.weefselKoppelEconomie({ vacatures: () => [{ id: 'v', bedrijf: 'X', func: 'Elektricien', loc: zone.centrum }] });
  const k2 = weefsel.weefselKansen();
  assert.equal(k2.bronnen.vacatures, true);
  assert.equal(k2.werk.vacatures, 1, 'nu telt hij er een');
  assert.match(k2.let_op, /waar het WERK is/);
});

/* ---------------- 6. De routes ----------------
   MUTATIE (RAAK, alleen deze toets): officeAuth van /api/office/weefsel/kansen
   vervangen door een doorgeefluik -> 200 op een onzin-token. */
const KANSEN_ROUTES = [
  '/api/office/weefsel/kansen', '/api/office/weefsel/tekorten', '/api/office/weefsel/leegstand',
  '/api/office/weefsel/pand/zet', '/api/office/weefsel/hinder', '/api/office/weefsel/opdrachten',
  '/api/office/weefsel/drukte'
];
test('elke kansenroute staat achter de kantoordeur en antwoordt zonder serverfout', async () => {
  for (const vol of KANSEN_ROUTES) {
    const pad = vol.slice(5);
    const zonder = await api(pad, {}, 'onzin-token');
    assert.ok(zonder.status === 401 || zonder.status === 403, vol + ' is dicht zonder kantoorinlog (gaf ' + zonder.status + ')');
    const open = await api(pad, { naam: 'Aïsha' }, office);
    assert.ok(open.status < 500, vol + ' gaf een serverfout (' + open.status + ')');
    assert.ok(Object.keys(open.body).length > 0, vol + ' gaf geen JSON-antwoord -- bestaat de route nog?');
  }
});
