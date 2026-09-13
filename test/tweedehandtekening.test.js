/* ============================================================================
   EEN TWEEDE MENS ONDER TWEE BANKHANDELINGEN.

   `scripts/overleving.js` had één rij die met zoveel woorden `nee` zei: *een
   medewerker handelt te kwader trouw, in zijn eentje.* De grond was gemeten --
   een medewerker op naam kon in zijn eentje rood-staan-ruimte geven en een
   incassoronde starten, en `KANTOORMACHT.json` telde nul kantoorroutes met een
   tweede handtekening.

   WAT DEZE TOETSEN BEWAKEN, en waarom juist deze. Een vier-ogen-laag faalt zelden
   doordat hij niets doet; hij faalt doordat hij er IS en niets tegenhoudt. Dit
   huis heeft die fout twee keer eerder gemaakt en beide keren staat hij
   uitgeschreven: bij de bankknop kwamen aanvrager en bevestiger allebei uit
   `req.body.naam` (twee tekstvelden, een sessie), en bij de documentenuitgifte
   kwam de naam onder de handtekening uit `req.body.wie`. Vandaar:

     1 een medewerker kan zijn eigen aanvraag niet bevestigen;
     2 de gedeelde kantoorcode kan geen van beide -- zonder identiteit is de
       vergelijking een vergelijking van twee lege waarden;
     3 het LIJF staat vast bij de aanvraag; de bevestiger stuurt er geen, dus
       "keur 250 goed en voer 9000 uit" kan nergens binnenkomen;
     4 er gebeurt NIETS bij de aanvraag zelf. Dat is de toets die het echt meet:
       een laag die het werk gewoon doet en er een aanvraag naast zet, ziet er
       precies zo uit als een laag die werkt.

   Draai los: node --test test/tweedehandtekening.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tweehand-'));
const CODE = 'KANTOOR-TWEEHAND-1';
let srv, base, gedeeld, eenA, eenB, lid, iban;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

/* Een kantoormedewerker OP NAAM: een gewoon lid dat de kantoorrol koppelt met de
   gedeelde code. Hij krijgt er geen recht bij, alleen een identiteit -- precies
   wat kluisAuth eist en wat de vergelijking hieronder nodig heeft. */
async function medewerker(merk) {
  const u = (Date.now() + merk * 7919).toString(36) + merk;
  const reg = await api('/api/auth/register', { name: 'Bankmens ' + merk,
    email: 'th' + u + '@voorbeeld.test',
    phone: '06' + String(10000000 + Math.floor(Math.random() * 8e7)),
    password: 'Geheim123!', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.body.token, 'medewerker ' + merk + ' geregistreerd');
  const kop = await api('/api/account/koppel', { soort: 'kantoor', code: CODE }, reg.body.token);
  assert.equal(kop.status, 200, 'medewerker ' + merk + ' koppelt de kantoorrol: ' + JSON.stringify(kop.body).slice(0, 120));
  const start = await api('/api/account/start', { rol: 'kantoor' }, reg.body.token);
  assert.ok(start.body.token, 'medewerker ' + merk + ' staat op naam in de backoffice');
  return start.body.token;
}

/* De rood-staan-ruimte lezen via het bankbord: dat is de enige weg die het
   kantoor er werkelijk voor heeft, en een toets die zijn eigen route verzint
   meet iets dat niemand gebruikt. */
async function roodVan(nr) {
  const bord = await api('/api/office/bank', {}, gedeeld);
  const r = (bord.body.rekeningen || []).find(x => x.iban === nr);
  assert.ok(r, 'de rekening staat niet op het bankbord: ' + JSON.stringify(bord.body).slice(0, 160));
  return r.roodLimiet || 0;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  base = srv.base;

  gedeeld = (await api('/api/office/login', { code: CODE })).body.token;
  assert.ok(gedeeld, 'de gedeelde kantoorinlog werkt');
  const live = await api('/api/office/bank/leden', { aan: true, naam: 'RTG' }, gedeeld);
  assert.equal(live.status, 200, 'de leden-bank staat live: ' + JSON.stringify(live.body).slice(0, 140));

  eenA = await medewerker(1);
  eenB = await medewerker(2);

  const u = Date.now().toString(36);
  lid = (await api('/api/auth/register', { name: 'Rekeninghouder', email: 'rh' + u + '@voorbeeld.test',
    phone: '06' + String(10000000 + Math.floor(Math.random() * 8e7)), password: 'Geheim123!',
    geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const akk = await api('/api/bank/akkoord', {}, lid);
  assert.equal(akk.status, 200, 'het lid opent een rekening: ' + JSON.stringify(akk.body).slice(0, 140));
  iban = akk.body.rekening.iban;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* DE DRAGENDE TOETS. Alles hieronder meet de ceremonie; deze meet of de
   ceremonie iets TEGENHOUDT. Zonder hem zou een laag die het werk gewoon doet
   en er een aanvraag naast zet, elke andere toets hier halen. */
test('1. een aanvraag verandert nog niets aan de rekening', async () => {
  const voor = await roodVan(iban);
  const r = await api('/api/office/bank/rekening/rood', { iban, euro: 250 }, eenA);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  assert.equal(r.body.needsAuth, true, 'een aanvraag hoort te zeggen dat hij op iemand wacht');
  assert.ok(r.body.aanvraag && r.body.aanvraag.id, 'en een kenmerk mee te geven');

  const na = await roodVan(iban);
  const limietVoor = voor, limietNa = na;
  assert.equal(limietNa, limietVoor,
    'de rood-staan-ruimte is bij de AANVRAAG al veranderd -- dan is de tweede handtekening decor');
  assert.notEqual(limietNa, 25000, 'de aanvraag heeft de gevraagde limiet al gezet');

  // en na de intrekking staat er niets meer open
  const weg = await api('/api/office/bank/handtekening/intrek', { id: r.body.aanvraag.id }, eenA);
  assert.equal(weg.status, 200, JSON.stringify(weg.body).slice(0, 140));
  assert.equal((await api('/api/office/bank/handtekening/open', {}, eenA)).body.aanvragen.length, 0);
});

test('2. de aanvrager kan zijn eigen aanvraag niet bevestigen', async () => {
  const r = await api('/api/office/bank/rekening/rood', { iban, euro: 300 }, eenA);
  const id = r.body.aanvraag.id;
  const zelf = await api('/api/office/bank/handtekening/bevestig', { id }, eenA);
  assert.equal(zelf.status, 403, 'de aanvrager tekende zijn eigen aanvraag af (kreeg ' + zelf.status + ')');
  assert.match(String(zelf.body.error || ''), /iemand anders/i, 'en de weigering zegt waarom');

  /* En hij staat er nog: een geweigerde bevestiging mag de aanvraag niet
     opbranden, anders is een tikfout van de aanvrager een stille annulering. */
  const open = await api('/api/office/bank/handtekening/open', {}, eenB);
  assert.ok(open.body.aanvragen.some(a => a.id === id), 'de aanvraag is verdwenen na een geweigerde bevestiging');

  const ander = await api('/api/office/bank/handtekening/bevestig', { id }, eenB);
  assert.equal(ander.status, 200, JSON.stringify(ander.body).slice(0, 160));
  assert.equal(ander.body.handeling, 'bank.rood');
  assert.equal(ander.body.scheiding, 'bewezen', 'de scheiding hoort op twee inlogs te rusten, niet op namen');
  assert.equal(await roodVan(iban), 30000, 'pas NA de tweede handtekening staat de limiet er');
});

test('3. de gedeelde kantoorcode kan niet aanvragen en niet bevestigen', async () => {
  /* De code komt al niet langs kluisAuth; dat is de eerste grendel en die staat
     in test/bankdeuren.test.js. Hier gaat het om de tweede: ook als hij er
     langs zou komen, is er geen mens om van te verschillen. */
  const aan = await api('/api/office/bank/rekening/rood', { iban, euro: 100 }, gedeeld);
  assert.equal(aan.status, 403, 'de gedeelde code kon rood-staan aanvragen');
  const bev = await api('/api/office/bank/handtekening/bevestig', { id: 'th-verzonnen' }, gedeeld);
  assert.equal(bev.status, 403, 'de gedeelde code kon bevestigen');
});

test('4. het lijf staat vast bij de aanvraag; de bevestiger stuurt er geen', async () => {
  const r = await api('/api/office/bank/rekening/rood', { iban, euro: 175 }, eenA);
  const id = r.body.aanvraag.id;
  /* De bevestiger probeert een ANDER bedrag mee te sturen. Er is geen veld om
     dat in te ontvangen -- dat is de hele bescherming, en zij is sterker dan een
     vingerafdruk vergelijken: er is geen tweede lijf om mee te vergelijken. */
  const bev = await api('/api/office/bank/handtekening/bevestig', { id, euro: 49000, iban }, eenB);
  assert.equal(bev.status, 200, JSON.stringify(bev.body).slice(0, 160));
  assert.equal(await roodVan(iban), 17500,
    'het bedrag van de BEVESTIGER is uitgevoerd -- dan is "keur 250 goed, voer 9000 uit" mogelijk');

  /* En de lijst geeft het lijf niet prijs: wie bevestigt hoort te zien WAT er
     gebeurt, niet de rauwe invoer. */
  const r2 = await api('/api/office/bank/rekening/rood', { iban, euro: 200 }, eenA);
  const open = await api('/api/office/bank/handtekening/open', {}, eenB);
  const mijn = open.body.aanvragen.find(a => a.id === r2.body.aanvraag.id);
  assert.ok(mijn, 'de aanvraag staat niet in de lijst');
  assert.ok(mijn.wat && mijn.onderwerp, 'de lijst zegt niet WAT er gebeurt en waarover');
  assert.equal(mijn.lijf, undefined, 'het rauwe lijf gaat mee naar buiten');
  await api('/api/office/bank/handtekening/intrek', { id: r2.body.aanvraag.id }, eenA);
});

test('5. een bevestiging wordt opgebruikt, ook bij een tweede poging', async () => {
  const r = await api('/api/office/bank/rekening/rood', { iban, euro: 120 }, eenA);
  const id = r.body.aanvraag.id;
  assert.equal((await api('/api/office/bank/handtekening/bevestig', { id }, eenB)).status, 200);
  /* Nog een keer met hetzelfde kenmerk: er staat niets meer open. Een
     handtekening die twee keer werkt, is een handtekening die je kunt
     hergebruiken op een aanvraag die de eerste keer werd afgewezen. */
  const nog = await api('/api/office/bank/handtekening/bevestig', { id }, eenB);
  assert.equal(nog.status, 404, 'dezelfde bevestiging werkte een tweede keer');
});

test('6. de incassoronde vraagt dezelfde twee mensen, en loopt de hele gouden weg', async () => {
  /* DE FIXTURE IS HET HALVE BEWIJS. De seed heeft geen vaste betaling die aan de
     beurt is, en sinds de gouden weg (MACHINE.md par. 5a) weigert de aanvraag een
     LEGE ronde: een voornemen van nul cent is een plan zonder inhoud, en het zou
     een tweede handtekening opsouperen voor een handeling die niets doet. Dus
     zetten we er een echte vaste betaling klaar en kijken of er werkelijk geld
     beweegt -- dit is de enige toets in dit huis waar een euro de hele machine
     doorloopt. */
  const u2 = (Date.now() + 991).toString(36);
  const lid2 = (await api('/api/auth/register', { name: 'Ontvanger', email: 'ov' + u2 + '@voorbeeld.test',
    phone: '06' + String(10000000 + Math.floor(Math.random() * 8e7)), password: 'Geheim123!',
    geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const akk2 = await api('/api/bank/akkoord', {}, lid2);
  assert.equal(akk2.status, 200, 'de tweede rekening: ' + JSON.stringify(akk2.body).slice(0, 140));
  const naarIban = akk2.body.rekening.iban;

  const vast = await api('/api/bank/terugkerend/zet',
    /* De geldgrens van lib/idem.js weigert een geldopdracht zonder sleutel, en
       terecht: twee klikken op een vaste betaling betalen niet een keer te veel
       maar elke maand opnieuw. */
    { vanIban: iban, naarIban, centen: 100, interval: 'maand', oms: 'Proefincasso',
      idem: 'proef-incasso-' + u2 }, lid);
  assert.equal(vast.status, 200, 'de vaste betaling: ' + JSON.stringify(vast.body).slice(0, 160));

  /* 31 dagen vooruit: dan is een maandelijkse betaling een keer aan de beurt. */
  const tot = Date.now() + 31 * 86400000;

  const r = await api('/api/office/bank/incasso', { tot }, eenA);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.equal(r.body.needsAuth, true, 'de incassoronde ging zonder tweede mens door');
  assert.equal(r.body.uitgevoerd, undefined, 'de ronde heeft al gedraaid bij de aanvraag');

  /* DE BAAN IS GELOPEN VOORDAT ER IETS BEWEEGT. Het voornemen staat er, met het
     totaal uit de vooruitblik, en het dossier zegt per as wat er gebeurde. */
  assert.ok(r.body.voornemen && r.body.voornemen.id, 'de aanvraag draagt geen voornemen');
  assert.equal(r.body.voornemen.totaalCenten, 100, 'het gewogen totaal komt uit de vooruitblik');
  assert.equal(r.body.vooruitblik.boekingen, 1);
  const assen = Object.fromEntries((r.body.dossier.assen || []).map(a => [a.as, a]));
  for (const as of ['mensbewijs', 'assurance', 'mandaat', 'streefstand', 'tegenfeit', 'frictie',
    'voornemen', 'autoriteit', 'envelop', 'bewijsketen', 'gevolg', 'idempotentie', 'hervatbaar'])
    assert.ok(assen[as], 'de as "' + as + '" staat niet in het dossier van de aanvraag');
  assert.equal(assen.mandaat.uitslag, 'niet zelfstandig',
    'het mandaat hoort hier NEE te zeggen: geld is nooit autonoom');

  /* DE ECONOMISCHE SLEUTEL: dezelfde grens is hetzelfde voornemen, geen tweede. */
  const nog = await api('/api/office/bank/incasso', { tot }, eenA);
  assert.equal(nog.status, 200, JSON.stringify(nog.body).slice(0, 160));
  assert.equal(nog.body.voornemen.id, r.body.voornemen.id,
    'een tweede aanvraag op dezelfde grens maakte een TWEEDE voornemen -- dan int een dubbeltik twee keer');
  /* Die tweede klik laat wel een tweede DEURTICKET achter (zie de kop van
     routes/kantoren/bank-incasso.js: rommel, geen risico). Hier halen we hem weg,
     zodat toets 7 straks een leeg loket aantreft en niet over onze rommel valt. */
  await api('/api/office/bank/handtekening/intrek', { id: nog.body.aanvraag.id }, eenA);

  const zelf = await api('/api/office/bank/handtekening/bevestig', { id: r.body.aanvraag.id }, eenA);
  assert.equal(zelf.status, 403, 'de aanvrager kon zijn eigen incassoronde aftekenen');

  /* Het saldo van de ONTVANGER, langs de weg die een lid werkelijk heeft
     (/api/bank/rekening geeft de detail van een eigen rekening). */
  const saldoVan = async () => (await api('/api/bank/rekening', { iban: naarIban }, lid2)).body;
  const saldoVoor = await saldoVan();
  const ok = await api('/api/office/bank/handtekening/bevestig', { id: r.body.aanvraag.id }, eenB);
  assert.equal(ok.status, 200, JSON.stringify(ok.body).slice(0, 200));
  assert.equal(ok.body.handeling, 'bank.incasso');

  /* EN NU HET ENIGE DAT ER ECHT TELT: is er geld verplaatst? */
  const saldoNa = await saldoVan();
  const c = (r) => Number((r.rekening || r).saldoCenten);
  assert.equal(c(saldoNa) - c(saldoVoor), 100,
    'de incassoronde heeft geen geld verplaatst: ' + JSON.stringify(saldoVoor).slice(0, 120) +
    ' -> ' + JSON.stringify(saldoNa).slice(0, 120));

  /* HET DOSSIER NA DE UITVOERING: de keten is rond, en dat is niet beweerd maar
     te lezen -- inclusief de hashketen die zichzelf verifieert. */
  const dos = await api('/api/office/bank/incasso/dossier', { voornemen: r.body.voornemen.id }, gedeeld);
  assert.equal(dos.status, 200, JSON.stringify(dos.body).slice(0, 160));

  /* EN HIER IS HET DOSSIER EERLIJKER DAN PRETTIG, en dat is precies waarom het
     bestaat. Deze medewerkers hebben geen passkey: kern/zwaarbewijs.js laat de
     handeling dan DOOR op de terugval en meldt dat aan de beveiliging, dus de as
     `assurance` staat op `vermoed` en telt niet als gehaald. De keten is dus
     gelopen, het geld is verplaatst, en de keten heet NIET rond -- met de naam van
     de ene as die eraan ontbreekt en de reden erbij.

     Wie deze toets ooit op `rond: true` wil hebben, geeft de medewerker een
     passkey; wie hem groen maakt door `vermoed` te laten meetellen, sloopt het
     verschil tussen een as die gelopen is en een as die aanwezig lijkt. */
  assert.deepEqual(dos.body.dossier.open, ['assurance'],
    'open assen na de uitvoering: ' + (dos.body.dossier.open || []).join(', '));
  assert.equal(dos.body.dossier.rond, false);
  const ass = dos.body.dossier.assen.find(a => a.as === 'assurance');
  assert.equal(ass.graad, 'vermoed');
  assert.match(ass.reden, /passkey/i, 'de open as zegt niet waarom hij open staat');
  const tweede = dos.body.dossier.assen.find(a => a.as === 'tweedeMens');
  const eerste = dos.body.dossier.assen.find(a => a.as === 'mensbewijs');
  assert.ok(tweede && tweede.uitslag, 'de tweede mens staat niet in het dossier');
  assert.notEqual(tweede.uitslag, eerste.wie,
    'aanvrager en bevestiger staan als dezelfde in het dossier -- dan zegt het dossier iets anders dan de deur');

  const bord = await api('/api/office/bank/incasso/dossier', {}, gedeeld);
  assert.equal(bord.body.ketenHeel.ok, true, 'de hashketen van de baan is niet heel');
  assert.equal(typeof bord.body.rond, 'number', 'het bord telt de ronde ketens niet');
});

/* De invoerkeuring hoort bij de AANVRAAG en niet pas bij de bevestiging: een
   collega die tien minuten later tekent, mag geen fout krijgen die niet de zijne
   is. En een afgekeurde aanvraag hoort niet als openstaand te blijven hangen. */
test('7. een onmogelijke aanvraag wordt meteen geweigerd en blijft niet staan', async () => {
  for (const euro of [-1, 50001, 'veel', {}]) {
    const r = await api('/api/office/bank/rekening/rood', { iban, euro }, eenA);
    assert.equal(r.status, 400, 'euro=' + JSON.stringify(euro) + ' werd als aanvraag aangenomen');
  }
  const onbekend = await api('/api/office/bank/rekening/rood', { iban: 'NL00RTGB0000000000', euro: 100 }, eenA);
  assert.equal(onbekend.status, 404, 'een onbekend IBAN werd als aanvraag aangenomen');
  assert.equal((await api('/api/office/bank/handtekening/open', {}, eenA)).body.aanvragen.length, 0,
    'een geweigerde aanvraag is blijven staan');
});

/* ============================================================================
   DE LAAG ZELF, ZONDER SERVER.

   Toets 3 hierboven bewijst minder dan het lijkt, en dat bleek uit een mutatie:
   haal de identiteitscontrole UIT kern/kantoor/tweedehandtekening.js en toets 3
   blijft groen. De reden is dat `kluisAuth` de gedeelde code al aan de DEUR
   tegenhoudt, dus de aanroep bereikt de laag nooit. Er staan twee grendels en
   de toets meet alleen de buitenste.

   Dat is precies de vorm die dit huis vaker heeft gehad: een binnenste grendel
   die niemand beproeft, tot iemand de buitenste verplaatst. Deze toetsen roepen
   de module daarom RECHTSTREEKS aan, zonder deur ertussen.
   ========================================================================== */
const maakTweedeHandtekening = require('../server/kern/kantoor/tweedehandtekening');

function losseLaag() {
  const db = { data: {} };
  const laag = maakTweedeHandtekening({ db, save: () => {} });
  const gedaan = [];
  laag.registreer('proef.doen', { wat: 'iets doen', voerUit: (lijf) => { gedaan.push(lijf); return { ok: true, lijf }; } });
  return { laag, gedaan, db };
}

test('8. de laag zelf weigert een aanvraag zonder mens, ook zonder deur ervoor', () => {
  const { laag } = losseLaag();
  for (const zonder of [null, undefined, '', 'kantoor', 'backoffice (gedeelde code)', 'user-x']) {
    const r = laag.vraag({ actie: 'proef.doen', lijf: {}, door: zonder });
    assert.equal(r.status, 403, 'door=' + JSON.stringify(zonder) + ' kon aanvragen');
    assert.equal(r.watNu, 'inloggen-op-naam', 'de weigering zegt niet hoe het wel kan');
  }
  assert.equal(laag.vraag({ actie: 'proef.doen', lijf: {}, door: 'user-7' }).needsAuth, true,
    'een echte sleutel hoort er wel door te komen');
});

test('9. de laag zelf weigert een bevestiging zonder mens', () => {
  const { laag, gedaan } = losseLaag();
  const a = laag.vraag({ actie: 'proef.doen', lijf: { bedrag: 1 }, door: 'user-7' });
  return Promise.all([null, '', 'kantoor', 'user-x'].map(async zonder => {
    const r = await laag.bevestig({ id: a.aanvraag.id, door: zonder });
    assert.equal(r.status, 403, 'door=' + JSON.stringify(zonder) + ' kon bevestigen');
  })).then(() => {
    assert.equal(gedaan.length, 0, 'er is iets uitgevoerd zonder tweede mens');
  });
});

test('10. de bevestiger kan geen lijf meesturen', async () => {
  const { laag, gedaan } = losseLaag();
  const a = laag.vraag({ actie: 'proef.doen', lijf: { bedrag: 250 }, door: 'user-7' });
  /* Alles wat een aanroeper zou kunnen proberen mee te geven. Er is geen veld
     om het in te ontvangen -- dat is de bescherming, en zij is sterker dan een
     vergelijking omdat er geen tweede lijf bestaat. */
  await laag.bevestig({ id: a.aanvraag.id, door: 'user-9', lijf: { bedrag: 9000 }, bedrag: 9000, euro: 9000 });
  assert.equal(gedaan.length, 1, 'de handeling is niet uitgevoerd');
  assert.deepEqual(gedaan[0], { bedrag: 250 },
    'het lijf van de BEVESTIGER is uitgevoerd -- dan is "keur 250 goed, voer 9000 uit" mogelijk');
});

test('11. een aanvraag zonder geregistreerde uitvoerder ontstaat niet', () => {
  const { laag } = losseLaag();
  const r = laag.vraag({ actie: 'niet.bestaand', lijf: {}, door: 'user-7' });
  assert.equal(r.status, 400,
    'er kan een aanvraag ontstaan voor een handeling die niemand kan uitvoeren; die blijft dan ' +
    'staan tot hij verloopt en is niet te bevestigen');
});
