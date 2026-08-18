/* DE INVOERBALIE (kern/invoer.js + kern/invoer-lezer.js) -- REIZEN.md fase 2.

   WAT HIER BEWEZEN MOET WORDEN. Deze laag leest andermans documenten en zet er
   reisonderdelen van. Dat is de plek waar een systeem het makkelijkst gaat
   liegen: een half gelezen datum als zekerheid presenteren, een bestemming
   raden omdat er toevallig een woord in staat, of een extractie meteen in
   iemands reisplan zetten. De toetsen hieronder stellen daarom vooral vast wat
   er NIET gebeurt:

   1. wat niet gelezen kan worden, komt niet als leeg veld terug maar helemaal
      niet -- en een lezing zonder bewijs (zes hoofdletters zonder woord ervoor)
      wordt geen boekingsnummer;
   2. het jaar van een boardingpass is AFGELEID (de standaard kent alleen een
      dagnummer), en dat veld staat daarom onder de drempel en met een vlag;
   3. lezen zet niets in uw reis -- pas bevestigen doet dat;
   4. de zekerheden komen van de lezer en niet van de aanvrager: wie ze meestuurt
      verandert er niets mee;
   5. een correctie van een mens overschrijft de lezing niet, ze komt ernaast;
   6. het origineel gaat naar de eigen kluis van het lid en blijft daar staan als
      het onderdeel weer weggehaald wordt (invoeren is geen val).

   En aan het eind de reden dat dit bestaat: een elders geboekt hotel komt in
   DEZELFDE reis terecht als een boeking die wel bij RTG is gedaan.

   Draai los: node --experimental-sqlite --test test/invoer.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const lezer = require('../server/kern/invoer-lezer');

/* Het voorbeeld uit de IATA-resolutie zelf (Bar Coded Boarding Pass, M1). */
const PAS = 'M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 226F001A0025 100';
const dag = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const dataUrl = (mime, tekst) => 'data:' + mime + ';base64,' + Buffer.from(tekst, 'utf8').toString('base64');

let srv, base, lid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-invoer-'));
const post = (pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await post('/api/auth/register', { name: 'Reiziger', email: 'in' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
  lid = reg.body.token;
  assert.ok(lid, 'het lid staat ingeschreven');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. de boardingpass wordt op vaste posities gelezen, en het jaar is afgeleid', () => {
  const r = lezer.lees(PAS, { vandaag: '2026-08-18' });
  assert.equal(r.hoe, 'bcbp');
  assert.equal(r.soort, 'vlucht');
  assert.equal(r.velden.van.waarde, 'YUL');
  assert.equal(r.velden.naar.waarde, 'FRA');
  assert.equal(r.velden.vlucht.waarde, 'AC834');
  assert.equal(r.velden.kenmerk.waarde, 'ABC123');
  assert.equal(r.velden.stoel.waarde, '001A');
  // dagnummer 226 van 2026 is 14 augustus; het jaar staat NIET in de barcode
  assert.equal(r.velden.van_datum.waarde, '2026-08-14');
  assert.equal(r.velden.van_datum.afgeleid, true, 'en dat hoort als afleiding gemarkeerd te staan');
  assert.ok(r.velden.van_datum.zekerheid < lezer.DREMPEL, 'dus onder de drempel');
  assert.deepEqual(r.onzeker, ['van_datum'], 'en als enige na te kijken');
  assert.equal(r.zeker, false);
  // een strook die niet aan zijn vorm voldoet is geen boardingpass
  assert.equal(lezer.leesBoardingpass('M1KORT/TE KORT', '2026-08-18'), null);
  assert.equal(lezer.leesBoardingpass(PAS.replace('YULFRA', 'yulfra'), '2026-08-18'), null,
    'kleine letters op de vliegveldpositie: dan is het die strook niet');
});

test('2. uit vrije tekst wordt niets verzonnen', () => {
  const plaatsVind = (t) => /dubai/i.test(t) ? { plaats: 'Dubai', land: 'AE', bron: 'de plaatsenlijst' } : null;
  const met = lezer.lees('Hotel in Dubai, check-in 12 oktober 2026, check-out 17 oktober 2026. Boekingsnummer: XY7788Q', { plaatsVind });
  assert.equal(met.velden.bestemming.waarde, 'Dubai');
  assert.equal(met.velden.soort.waarde, 'verblijf');
  assert.equal(met.velden.van_datum.waarde, '2026-10-12');
  assert.equal(met.velden.tot_datum.waarde, '2026-10-17');
  assert.equal(met.velden.kenmerk.waarde, 'XY7788Q');
  assert.ok(met.velden.van_datum.uitleg.includes('12 oktober 2026'), 'de uitleg wijst naar de tekst zelf');

  // geen bekende plaats: dan is er geen bestemming, en niet een lege
  const zonder = lezer.lees('Bevestiging voor uw verblijf in Klein-Zundert, 12 oktober 2026', { plaatsVind });
  assert.ok(!('bestemming' in zonder.velden), 'een onbekende plaats wordt niet geraden en niet leeg gemeld');

  // zes hoofdletters zonder woord ervoor zijn geen boekingsnummer
  const los = lezer.lees('Uw reis naar Dubai. ABCDEF staat hier zomaar. 12 oktober 2026', { plaatsVind });
  assert.ok(!('kenmerk' in los.velden), 'zonder aanwijzing wordt er geen kenmerk gegokt');
});

test('3. lezen zet niets in uw reis; pas bevestigen doet dat', async () => {
  const voor = await post('/api/reis/reizen', {}, lid);
  const aantalVoor = voor.body.reizen.length;

  const lees = await post('/api/reis/invoer/lees', {
    naam: 'hotel-dubai.txt',
    dataUrl: dataUrl('text/plain', 'Hilton Dubai Palm\nCheck-in ' + dag(40) + ', check-out ' + dag(45) + '\nBoekingsnummer: XY7788Q')
  }, lid);
  assert.equal(lees.status, 200);
  assert.ok(lees.body.voorstel.id, 'er komt een voorstel terug');
  assert.equal(lees.body.voorstel.velden.bestemming.waarde, 'Dubai');
  assert.equal(lees.body.voorstel.velden.soort.waarde, 'verblijf');

  const tussen = await post('/api/reis/reizen', {}, lid);
  assert.equal(tussen.body.reizen.length, aantalVoor, 'na het LEZEN staat er nog niets in de reizen');
  assert.deepEqual((await post('/api/reis/invoer/mijn', {}, lid)).body.onderdelen, [],
    'en er is nog geen onderdeel');

  const bev = await post('/api/reis/invoer/bevestig', { id: lees.body.voorstel.id,
    velden: { titel: 'Hilton Dubai Palm' } }, lid);
  assert.equal(bev.status, 200);
  assert.equal(bev.body.onderdeel.herkomst, 'document', 'een tekstbestand is een document');
  assert.equal(bev.body.onderdeel.bestemming, 'Dubai');

  const na = await post('/api/reis/reizen', {}, lid);
  const reis = na.body.reizen.find(r => /dubai/i.test(r.bestemming));
  assert.ok(reis, 'nu staat de reis er wel');
  assert.deepEqual(reis.herkomsten, ['document']);
  // dezelfde bevestiging nog eens kan niet
  assert.equal((await post('/api/reis/invoer/bevestig', { id: lees.body.voorstel.id, velden: { titel: 'x' } }, lid)).status, 409);
});

test('4. de zekerheden komen van de lezer, niet van de aanvrager', async () => {
  const lees = await post('/api/reis/invoer/lees', {
    tekst: 'Vlucht naar Mykonos op ' + dag(50) + ', gate 12'
  }, lid);
  const v = lees.body.voorstel;
  assert.equal(v.velden.van_datum.zekerheid, 0.7, 'een datum uit vrije tekst is niet zeker');
  assert.ok(v.onzeker.includes('van_datum'));

  /* Een GELEZEN veld is niet van buitenaf te schrijven. Deze aanvraag probeert
     het vluchtnummer uit de boardingpass te overschrijven; dat veld staat niet
     in de lijst die een mens mag zetten, dus er verandert niets. */
  const pasLees = await post('/api/reis/invoer/lees', { tekst: PAS }, lid);
  const bev = await post('/api/reis/invoer/bevestig', { id: pasLees.body.voorstel.id, velden: {
    titel: 'Vlucht', vlucht: 'ZZ999', van_datum: '2030-01-01'
  } }, lid);
  assert.equal(bev.status, 200);
  assert.equal(bev.body.onderdeel.velden.vlucht.waarde, 'AC834', 'het gelezen vluchtnummer blijft staan');
  assert.equal(bev.body.onderdeel.velden.vlucht.hoe, 'bcbp', 'en blijft van de lezer');
  // wat een mens WEL mag zetten, komt naast de lezing te staan en niet eroverheen
  const datumveld = bev.body.onderdeel.velden.van_datum;
  assert.equal(datumveld.waarde, '2030-01-01');
  assert.equal(datumveld.hoe, 'mens', 'wat een mens zet, heet "mens" en niet "bcbp"');
  assert.equal(datumveld.zekerheid, 1, 'de zekerheid zet de server, niet de aanvrager');
  assert.equal(datumveld.gelezen, '2026-08-14', 'en wat de lezer ervan maakte blijft ernaast staan');

  // een onzin-waarde levert geen datum op, en dan gaat het onderdeel niet door
  const rommel = await post('/api/reis/invoer/lees', { tekst: PAS }, lid);
  assert.equal((await post('/api/reis/invoer/bevestig', { id: rommel.body.voorstel.id, velden: {
    titel: 'Vlucht', van_datum: { waarde: '2030-01-01' } } }, lid)).status, 400);
});

test('5. een correctie maakt het onderdeel zeker; zonder correctie blijft het na te kijken', async () => {
  const a = await post('/api/reis/invoer/lees', { tekst: PAS }, lid);
  /* Geen `soort` meegestuurd: de strook zei zelf al dat dit een vlucht is. */
  const zonder = await post('/api/reis/invoer/bevestig', { id: a.body.voorstel.id,
    velden: { titel: 'AC834 naar Frankfurt', bestemming: 'Monaco' } }, lid);
  assert.equal(zonder.status, 200, zonder.body.error || '');
  assert.equal(zonder.body.onderdeel.soort, 'vlucht', 'het soort komt uit de boardingpass zelf');
  assert.equal(zonder.body.onderdeel.status, 'tecontroleren',
    'het afgeleide jaar staat nog onder de drempel, dus vraagt dit onderdeel aandacht');
  assert.deepEqual(zonder.body.onderdeel.onzeker, ['van_datum']);

  const b = await post('/api/reis/invoer/lees', { tekst: PAS }, lid);
  const met = await post('/api/reis/invoer/bevestig', { id: b.body.voorstel.id,
    velden: { titel: 'AC834 naar Frankfurt', bestemming: 'Monaco', van_datum: dag(60) } }, lid);
  assert.equal(met.body.onderdeel.status, 'ingelezen', 'met de datum bevestigd is er niets meer na te kijken');
  assert.deepEqual(met.body.onderdeel.onzeker, []);
  assert.equal(met.body.onderdeel.van, dag(60));

  // en in de reiswereld vraagt de onzekere om aandacht
  const w = await post('/api/reis/reizen', {}, lid);
  const alles = w.body.reizen.reduce((a, r) => a.concat(r.onderdelen), []);
  const nakijken = alles.find(x => x.status === 'tecontroleren');
  assert.ok(nakijken, 'het onzekere onderdeel staat in de reiswereld');
  assert.equal(nakijken.sig, 'aandacht');
  assert.equal(nakijken.wacht, 'uw controle');
});

test('6. het bewijsstuk staat in de eigen kluis en blijft daar na weghalen', async () => {
  const lees = await post('/api/reis/invoer/lees', {
    naam: 'ticket.txt', dataUrl: dataUrl('text/plain', 'Trein naar Parijs op ' + dag(70))
  }, lid);
  const bewijs = lees.body.voorstel.bewijs;
  assert.ok(bewijs && bewijs.bestandId, 'het origineel is bewaard');
  const kluis = await post('/api/bestanden/mijn', {}, lid);
  const inKluis = (b) => JSON.stringify(b.body).includes(bewijs.bestandId);
  assert.ok(inKluis(kluis), 'en staat in de eigen kluis van het lid');

  const bev = await post('/api/reis/invoer/bevestig', { id: lees.body.voorstel.id,
    velden: { titel: 'Thalys', soort: 'spoor' } }, lid);
  assert.equal(bev.status, 200);
  const weg = await post('/api/reis/invoer/weg', { id: bev.body.onderdeel.id }, lid);
  assert.equal(weg.status, 200);
  assert.equal(weg.body.bewijsBlijft, true);
  assert.ok(inKluis(await post('/api/bestanden/mijn', {}, lid)),
    'het bewijsstuk blijft van het lid; invoeren is geen val');
  assert.ok(!(await post('/api/reis/invoer/mijn', {}, lid)).body.onderdelen.some(x => x.id === bev.body.onderdeel.id));
});

test('7. wat niet gelezen kan worden, wordt niet gedaan alsof', async () => {
  // een pdf zonder tekst erbij: bewaard als bewijsstuk, geen verzonnen velden
  const pdf = await post('/api/reis/invoer/lees', { naam: 'voucher.pdf', dataUrl: dataUrl('application/pdf', '%PDF-1.4 binaire onzin') }, lid);
  assert.equal(pdf.status, 200);
  assert.deepEqual(pdf.body.voorstel.velden, {}, 'er wordt niets uit een pdf verzonnen');
  assert.ok(pdf.body.voorstel.bewijs.bestandId, 'maar het bewijsstuk is bewaard');
  assert.match(pdf.body.opmerking, /niets uit lezen/i, 'en dat wordt gezegd ook');
  // zonder datum kan het bij geen enkele reis horen
  assert.equal((await post('/api/reis/invoer/bevestig', { id: pdf.body.voorstel.id,
    velden: { titel: 'Voucher', soort: 'activiteit' } }, lid)).status, 400);
  // helemaal niets meesturen
  assert.equal((await post('/api/reis/invoer/lees', {}, lid)).status, 400);
});

test('8. een voorstel is van een lid, en van niemand anders', async () => {
  const u = Date.now().toString().slice(-7);
  const ander = (await post('/api/auth/register', { name: 'Ander', email: 'an' + u + '@x.nl',
    phone: '061' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const lees = await post('/api/reis/invoer/lees', { tekst: 'Hotel Dubai op ' + dag(80) }, lid);
  assert.equal((await post('/api/reis/invoer/bevestig', { id: lees.body.voorstel.id,
    velden: { titel: 'gejat', soort: 'verblijf' } }, ander)).status, 404,
    'het voorstel van een ander bestaat voor jou niet');
  assert.equal((await post('/api/reis/invoer/lees', { tekst: 'x' }, null)).status, 401);
});

test('9. waarom dit bestaat: een elders geboekt hotel komt in DEZELFDE reis', async () => {
  // een echte RTG-boeking naar Ibiza ...
  const cat = await post('/api/reisbureau', {}, lid);
  const ibiza = cat.body.reizen.find(r => /ibiza/i.test(r.bestemming));
  assert.ok(ibiza, 'de catalogus heeft Ibiza');
  const boek = await post('/api/reisbureau/boek', { tripId: ibiza.id, personen: 2, vertrek: dag(100) }, lid);
  assert.equal(boek.status, 200);

  // ... en een hotel dat bij een ander is geboekt, ingevoerd uit de bevestiging
  const lees = await post('/api/reis/invoer/lees', {
    naam: 'casa-ibiza.txt',
    dataUrl: dataUrl('text/plain', 'Booking confirmation: Casa Ibiza, check-in ' + dag(100) +
      ', check-out ' + dag(104) + '. Booking reference: QQ1234')
  }, lid);
  const bev = await post('/api/reis/invoer/bevestig', { id: lees.body.voorstel.id,
    velden: { titel: 'Casa Ibiza', van_datum: dag(100), tot_datum: dag(104) } }, lid);
  assert.equal(bev.status, 200);

  const r = await post('/api/reis/reizen', {}, lid);
  const reis = r.body.reizen.find(x => /ibiza/i.test(x.bestemming) && x.venster.van === dag(100));
  assert.ok(reis, 'er is een reis naar Ibiza');
  assert.equal(reis.telling.onderdelen, 2, 'met beide onderdelen erin');
  assert.deepEqual(reis.herkomsten.sort(), ['document', 'rtg'],
    'de een bij RTG geboekt, de ander zelf ingevoerd -- en dat blijft zichtbaar');
});
