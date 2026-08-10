/* DRIE PERSONEELSINGANGEN VAN HET MOBILITY OS DIE DOOR NIETS WERDEN AANGEROEPEN.
   Draai los: node --experimental-sqlite --test test/staff-inzet-mob.test.js

     /api/staff/mob/kaart/storingen   de storingslijst van de OV-vervoerder
     /api/staff/mob/mijn              het dispatchbeeld op de PDA
     /api/staff/mob/positie           de locatieprik tijdens een rit

   Ze stonden gebouwd, ze zaten in de app, en geen enkele toets kwam eraan. Wat
   dat betekent is niet "ongetoetst" maar "onbewaakt": viel de deur open, dan
   kon een chauffeur van bedrijf A de rit van bedrijf B volgen; ging de lijst
   stuk, dan zag de vervoerder zijn eigen storingen niet meer en betaalde hij
   niemand terug. Allebei stil, want er was niets dat kon zakken.

   Deze toetsen pingen die paden dus niet, ze BEWEREN er iets over. Elke aanroep
   draagt of de vorm van het antwoord, of de poort die dichtgaat, of een
   schrijfactie die daarna wordt teruggelezen op precies dat pad. De volgorde is
   de weg van een echte rit: eerst een leeg bord, dan een aanvraag op de markt,
   dan de toewijzing, dan de prik, dan het afrekenen.

   WAT VAN /api/staff/inzetbaarheid HIER ALLEEN ALS DEUR IN STAAT, EN WAAROM.
   Dat pad hoorde in het rijtje hierboven, maar zijn binnenkant is niet te halen
   zonder de productiecode te veranderen: server/routes/staff/inzetbaarheid.js
   pakt `payrollOS` en `sseToSupplier` niet uit zijn context (regel 6), terwijl
   de route ze op regel 9 en 20 gebruikt. Elke aanroep die de deur door komt
   eindigt daardoor in "ReferenceError: payrollOS is not defined" en een 500 --
   ook de nette invoer, nagemeten. Een toets die dat vastlegt zou de kapotte
   stand vastzetten in plaats van hem te repareren, en de strenge poort in
   test/helper.js kleurt de hele run sowieso rood op zo'n serverfout
   ("serverfout":true). Wat er WEL van te toetsen valt staat in toets 5: de deur.
   Die is geen opvulling -- achter hem liggen verzuimgegevens, en hij is het
   enige wat een route die ooit zonder supplierAuth wordt opgehangen tegenhoudt.
   De kapotte binnenkant hoort met een regeltje in de route gerepareerd te
   worden, niet hier omzeild; het staat in het antwoord bij deze opdracht. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, reiziger, taxiPda, taxiBaas, ovPda, ovBaas;
let ref, wagenGoed, wagenKaal, prikPositie;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-inzet-mob-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
// een wagen met alle papieren op orde; de kale wagen krijgt ze bewust niet
const PAPIEREN_OK = { kenteken: '2030-01-01', verzekering: '2030-01-01', apk: '2030-01-01',
  taxivergunning: '2030-01-01', boordcomputer: '2030-01-01' };

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Reiziger Prik', email: 'prik' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v',
    tier: 'rtg', pasApp: 'rtg' });
  reiziger = reg.body.token;

  const taxi = await api('/api/supplier/roster', { code: 'MKKX' });
  const ov = await api('/api/supplier/roster', { code: 'TRANSIT' });
  const taxiCh = (taxi.body.staff || []).find(x => x.role !== 'manager');
  const taxiMg = (taxi.body.staff || []).find(x => x.role === 'manager');
  const ovCh = (ov.body.staff || []).find(x => x.role !== 'manager');
  const ovMg = (ov.body.staff || []).find(x => x.role === 'manager');
  taxiPda = (await api('/api/supplier/login', { code: 'MKKX', staffId: taxiCh.id, pin: '5678' })).body.token;
  taxiBaas = (await api('/api/supplier/login', { code: 'MKKX', staffId: taxiMg.id, pin: '1234' })).body.token;
  ovPda = (await api('/api/supplier/login', { code: 'TRANSIT', staffId: ovCh.id, pin: '5678' })).body.token;
  ovBaas = (await api('/api/supplier/login', { code: 'TRANSIT', staffId: ovMg.id, pin: '1234' })).body.token;
  assert.ok(reiziger, 'de reiziger is lid');
  assert.ok(taxiPda && taxiBaas, 'chauffeur en manager van de taxizaak zijn ingelogd');
  assert.ok(ovPda && ovBaas, 'chauffeur en verkeersleiding van de OV-zaak zijn ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* De storingslijst is geen mededelingenbord maar de administratie van een
   BETALINGSVERPLICHTING: wat erin staat wordt straks uitbetaald aan iedereen
   die in dat venster een kaartje had. Vandaar dat er hier drie dingen worden
   nagelopen: dat wat aankwam er staat, dat wat werd geweigerd er NIET bij komt,
   en dat het verwerken van een teruggave op deze lijst zichtbaar wordt. */
test('1. de storingslijst draagt precies de meldingen die aankwamen', async () => {
  const leeg = await api('/api/staff/mob/kaart/storingen', {}, ovPda);
  assert.equal(leeg.status, 200, leeg.body.error || '');
  assert.deepEqual(leeg.body.storingen, [], 'een verse zaak heeft nog geen storingen');
  assert.equal(leeg.body.soorten.vertraging.deel, 0.5, 'de lijst noemt zelf wat een soort teruggeeft');
  assert.equal(leeg.body.soorten.uitval.deel, 1, 'een uitgevallen rit is helemaal terug');

  const van = new Date(Date.now() - 3600e3).toISOString();
  const tot = new Date(Date.now() + 3600e3).toISOString();
  const bus = await api('/api/staff/mob/kaart/storing',
    { lijnId: 'L1', soort: 'vertraging', oorzaak: 'brug open', van, tot }, ovPda);
  assert.equal(bus.status, 200, bus.body.error || '');
  const ferry = await api('/api/staff/mob/kaart/storing',
    { lijnId: 'F1', soort: 'uitval', oorzaak: 'windkracht 8', van, tot }, ovPda);
  assert.equal(ferry.status, 200, ferry.body.error || '');

  /* Een lijn die deze zaak niet rijdt is geen melding. Hij staat hier omdat een
     lijst die ook het geweigerde opneemt, betaalt voor iets dat niet is
     gebeurd -- en zonder deze regel zou "er staan er twee in" hieronder ook
     kloppen als de weigering stiekem toch was doorgekomen. */
  const vreemd = await api('/api/staff/mob/kaart/storing',
    { lijnId: 'BESTAATNIET', soort: 'uitval', van, tot }, ovPda);
  assert.equal(vreemd.status, 404);
  assert.match(vreemd.body.error, /rijdt die lijn niet/);

  const lijst = await api('/api/staff/mob/kaart/storingen', {}, ovPda);
  assert.equal(lijst.status, 200);
  assert.equal(lijst.body.storingen.length, 2, 'precies de twee meldingen die aankwamen');
  assert.deepEqual(lijst.body.storingen.map(s => s.id), [ferry.body.storing.id, bus.body.storing.id],
    'de laatste melding staat vooraan');
  const eerste = lijst.body.storingen[0];
  assert.equal(eerste.lijnNaam, 'Formentera-ferry', 'met de naam van de lijn erbij, niet alleen zijn code');
  assert.equal(eerste.oorzaak, 'windkracht 8');
  assert.equal(eerste.van, van, 'en het venster zoals het gemeld is');
  assert.equal(eerste.verwerkt, null, 'er is nog niets uitbetaald');
  assert.ok(lijst.body.storingen.every(s => s.vervoerder === 'TRANSIT'), 'en alles hoort bij de eigen zaak');

  /* Uitbetalen is een besluit van een mens (dat toetst test/ovkaart.test.js);
     hier gaat het erom dat dat besluit op DEZE lijst terugkomt. Zonder deze
     stap is "verwerkt: null" hierboven een waarde die nooit iets anders kan
     worden, en dan bewaakt hij niets. */
  const uit = await api('/api/supplier/mob/kaart/teruggave', { id: bus.body.storing.id }, ovBaas);
  assert.equal(uit.status, 200, uit.body.error || '');
  const na = await api('/api/staff/mob/kaart/storingen', {}, ovPda);
  const busNa = na.body.storingen.find(s => s.id === bus.body.storing.id);
  const ferryNa = na.body.storingen.find(s => s.id === ferry.body.storing.id);
  assert.ok(busNa.verwerkt, 'de verwerkte storing draagt zijn afhandeling');
  assert.equal(busNa.verwerkt.aantal, 0, 'niemand had een kaartje in dat venster, en dat staat er ook zo');
  assert.equal(ferryNa.verwerkt, null, 'de andere storing is er niet stilletjes mee afgehandeld');
});

test('1b. de storingslijst hoort bij een OV-vervoerder, niet bij een taxizaak', async () => {
  const taxi = await api('/api/staff/mob/kaart/storingen', {}, taxiPda);
  assert.equal(taxi.status, 409, 'een taxichauffeur heeft geen lijnen en dus geen storingslijst');
  assert.match(taxi.body.error, /OV-vervoerder/);
  const zonder = await api('/api/staff/mob/kaart/storingen', {});
  assert.equal(zonder.status, 401, 'en zonder personeelstoken komt er niets uit');
});

test('2. het bord van de chauffeur: de eigen vloot, en een rit die nog op de markt ligt', async () => {
  const leeg = await api('/api/staff/mob/mijn', {}, taxiPda);
  assert.equal(leeg.status, 200, leeg.body.error || '');
  assert.equal(leeg.body.vervoerder, 'MKKX', 'het bord zegt van welke zaak het is');
  assert.deepEqual(leeg.body.vloot, [], 'de zaak begint zonder wagens');
  assert.equal(leeg.body.inzetbaar, 0);
  assert.deepEqual(leeg.body.lopend, []);

  const goed = await api('/api/supplier/mob/voertuig', { categorie: 'taxi', naam: 'Wagen met papieren',
    loc: { lat: 38.9085, lng: 1.4325 }, energieNiveau: 90, bestuurder: 'chauffeur-goed',
    papieren: PAPIEREN_OK }, taxiBaas);
  const kaal = await api('/api/supplier/mob/voertuig', { categorie: 'taxi', naam: 'Kale wagen',
    loc: { lat: 38.9086, lng: 1.4326 }, energieNiveau: 95, bestuurder: 'chauffeur-kaal' }, taxiBaas);
  assert.equal(goed.status, 200, goed.body.error || '');
  assert.equal(kaal.status, 200, kaal.body.error || '');
  wagenGoed = goed.body.asset.id; wagenKaal = kaal.body.asset.id;

  const bord = await api('/api/staff/mob/mijn', {}, taxiPda);
  assert.equal(bord.body.vloot.length, 2, 'beide wagens staan op het bord');
  assert.equal(bord.body.inzetbaar, 1, 'maar alleen die met papieren telt als inzetbaar');
  assert.deepEqual(bord.body.papierenLet.map(a => a.id), [wagenKaal],
    'en de kale wagen staat op de lettenlijst, de andere niet');
  assert.ok(bord.body.papierenLet[0].redenen.length >= 1, 'met de reden erbij: ' + bord.body.papierenLet[0].redenen);

  /* Een reiziger vraagt een taxi, geen bedrijf. Zo'n rit heeft dus nog geen
     vervoerder en ligt op de markt: elke zaak in dezelfde stad ziet hem, en
     niemand heeft hem al. Dat verschil tussen "zichtbaar" en "van mij" is
     precies wat dit bord moet dragen. */
  const rit = await api('/api/mob/vraag', { ritsoort: 'direct', categorie: 'taxi',
    van: { lat: 38.908, lng: 1.432 }, naar: { zaak: 'KIKUNOI' }, stad: 'Ibiza' }, reiziger);
  assert.equal(rit.status, 200, rit.body.error || '');
  ref = rit.body.opdracht.ref;
  assert.equal(rit.body.opdracht.vervoerder, null, 'de reiziger koos geen bedrijf');

  const na = await api('/api/staff/mob/mijn', {}, taxiPda);
  assert.ok(na.body.open.some(o => o.ref === ref), 'de aanvraag staat als open werk op het bord');
  assert.deepEqual(na.body.lopend, [], 'maar er rijdt nog niets: hij is van niemand');
  const buur = await api('/api/staff/mob/mijn', {}, ovPda);
  assert.ok(buur.body.open.some(o => o.ref === ref), 'de markt is voor elke vervoerder in dezelfde stad');
  assert.deepEqual(buur.body.vloot, [], 'maar de vloot van MKKX is niet die van de buurzaak');
});

test('3. de positieprik: alleen op de eigen rit, en alleen met een echt punt', async () => {
  const opMarkt = await api('/api/staff/mob/positie', { ref, lat: 38.9, lng: 1.43 }, taxiPda);
  assert.equal(opMarkt.status, 403, 'een rit die nog op de markt ligt, is ook niet van jou om op te prikken');

  const toe = await api('/api/supplier/mob/toewijzen', { ref }, taxiBaas);
  assert.equal(toe.status, 200, toe.body.error || '');
  assert.equal(toe.body.opdracht.voertuig, wagenGoed, 'de motor kiest de wagen met papieren, niet de kale');

  const voor = await api('/api/staff/mob/mijn', {}, taxiPda);
  const staatKlaar = voor.body.lopend.find(o => o.ref === ref);
  assert.ok(staatKlaar, 'de toegewezen rit staat nu bij het lopende werk');
  assert.equal(staatKlaar.positie, null, 'en zolang er niet geprikt is, staat er geen positie op');

  assert.equal((await api('/api/staff/mob/positie',
    { ref: 'RTG-M-BESTAATNIET', lat: 38.9, lng: 1.43 }, taxiPda)).status, 404, 'een onbekende rit bestaat niet');
  const vreemd = await api('/api/staff/mob/positie', { ref, lat: 38.9, lng: 1.43 }, ovPda);
  assert.equal(vreemd.status, 403, 'een chauffeur van een andere zaak prikt niet mee');
  assert.match(vreemd.body.error, /andere vervoerder/);

  const krom = await api('/api/staff/mob/positie', { ref, lat: 'ergens', lng: 1.43 }, taxiPda);
  assert.equal(krom.status, 400);
  assert.match(krom.body.error, /geldige positie/);
  assert.equal((await api('/api/staff/mob/positie', { ref, lat: 38.9 }, taxiPda)).status, 400,
    'een halve prik is geen positie');

  const prik = await api('/api/staff/mob/positie', { ref, lat: 38.9012, lng: 1.4301 }, taxiPda);
  assert.equal(prik.status, 200, prik.body.error || '');
  assert.equal(prik.body.positie.lat, 38.9012);
  assert.equal(prik.body.positie.lng, 1.4301);
  assert.ok(prik.body.positie.at, 'met het tijdstip erbij, anders weet niemand hoe oud hij is');
  prikPositie = prik.body.positie;

  /* Een prik die nergens aankomt is geen prik. De twee schermen die hem moeten
     tonen zijn het planbord van de zaak en de app van de reiziger; ze horen
     allebei DEZELFDE waarde te tonen, want het is een rit. */
  const bord = await api('/api/staff/mob/mijn', {}, taxiPda);
  const lopend = bord.body.lopend.find(o => o.ref === ref);
  assert.deepEqual(lopend.positie, prikPositie, 'het planbord toont de prik van de chauffeur');
  assert.ok(!bord.body.open.some(o => o.ref === ref), 'en de rit is van het open werk af');
  const volg = await api('/api/mob/volg', { ref }, reiziger);
  assert.equal(volg.status, 200);
  assert.deepEqual(volg.body.positie, prikPositie, 'en de reiziger ziet waar zijn taxi is');

  const buur = await api('/api/staff/mob/mijn', {}, ovPda);
  assert.ok(!buur.body.open.concat(buur.body.lopend).some(o => o.ref === ref),
    'een toegewezen rit is voor de buurzaak van de markt af en komt nergens bij hem terug');
});

/* Waarom een rit die AF is geen posities meer aanneemt: dan bouw je een
   bewegingsprofiel van iemand die allang is uitgestapt. De weigering staat op
   de kern (EIND in kern/mobiliteit/keten.js) en niet op een scherm. */
test('4. na het afrekenen komt er geen prik meer bij, en de rit verhuist naar klaar', async () => {
  for (const s of ['onderweg', 'aangekomen', 'ingestapt', 'rijdt', 'voltooid', 'afgerekend']) {
    const r = await api('/api/staff/mob/status', { ref, status: s }, taxiPda);
    assert.equal(r.status, 200, 'stap ' + s + ': ' + (r.body.error || ''));
  }
  const na = await api('/api/staff/mob/positie', { ref, lat: 38.7, lng: 1.4 }, taxiPda);
  assert.equal(na.status, 409, 'een afgeronde rit neemt geen posities meer aan');
  assert.match(na.body.error, /al afgerekend/);

  // en die weigering heeft ook echt niets verplaatst
  const volg = await api('/api/mob/volg', { ref }, reiziger);
  assert.deepEqual(volg.body.positie, prikPositie, 'de laatst bekende plek is die van tijdens de rit');

  const bord = await api('/api/staff/mob/mijn', {}, taxiPda);
  assert.ok(bord.body.klaar.some(o => o.ref === ref), 'de rit staat bij het afgeronde werk');
  assert.ok(!bord.body.lopend.some(o => o.ref === ref), 'en niet meer bij het lopende');
  assert.equal(bord.body.inzetbaar, 1, 'de vloot staat er nog gewoon, de rit is af en de wagen niet');
});

/* De deuren staan hier apart en niet los verspreid, omdat het om EEN bewering
   gaat die op vier paden moet gelden: personeelswerk hangt achter supplierAuth
   en een klant is geen personeel. De foutmelding wordt meegelezen en niet alleen
   de 401, want een route die per ongeluk zonder supplierAuth wordt opgehangen
   kan best zelf een 401 geven om een heel andere reden -- dan zou "401" hier
   groen blijven terwijl de deur weg is. Met de tekst erbij zakt hij. */
test('5. de personeelsdeuren: een lidtoken is geen personeelstoken', async () => {
  for (const pad of ['/api/staff/mob/mijn', '/api/staff/mob/positie',
    '/api/staff/mob/kaart/storingen', '/api/staff/inzetbaarheid']) {
    const metLid = await api(pad, { ref }, reiziger);
    assert.equal(metLid.status, 401, pad + ' gaat niet open met een lidtoken');
    assert.match(metLid.body.error, /Niet ingelogd als leverancier/,
      pad + ': het is de personeelsdeur die weigert, niet toevallig iets anders');
    const zonder = await api(pad, { ref });
    assert.equal(zonder.status, 401, pad + ' gaat niet open zonder token');
    assert.match(zonder.body.error, /Niet ingelogd als leverancier/, pad + ' zonder token');
  }
});
