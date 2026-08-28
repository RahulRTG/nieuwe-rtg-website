/* Ronde: de eerste klant, en de honderd daarna.

   Drie beweringen die hier het zwaarst wegen:

   1. DE LIJST HANGT AF VAN WAT DE ZAAK DOET. Een horecazaak zonder kaart is
      niet klaar; een dienstverlener heeft geen kaart nodig. Dat komt uit
      werkvormen.js en niet uit een lijstje per genre.
   2. ER IS GEEN TWEEDE POORT. De basisstappen worden uit kern/ondernemerpoort.js
      GELEZEN. Twee lijsten die allebei "is deze zaak er klaar voor" beweren,
      lopen uiteen -- en de Salon-pagina mag dus ook niet twee keer geteld
      worden.
   3. ZONDER ZAAK GEEN PERCENTAGE. Null en geen 0%: 0% zegt dat er niets gedaan
      is, terwijl er niets te doen valt.

   Draai los: node --test test/onderneming-eersteklant.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

/* Koppelen vraagt sinds deze ronde BEWIJS dat de zaak van de aanvrager is: in
   de route komt dat uit de sessie (een actieve beheerplek in het
   personeelsregister), of uit de eigen aanvraag waar RTG de zaak uit maakte.
   Een toets heeft geen sessie, dus zegt hij het hier met zoveel woorden: in
   deze opzet IS de zaak van dit lid. Zonder deze regel zou een toets stil
   uitgaan van een recht dat de code niet meer geeft. */
const MIJN_ZAAK = () => true;

const maakOnderneming = require('../server/kern/onderneming');
const EK = require('../server/kern/onderneming/eersteklant');

function stubKern(zaken, posts) {
  const lijst = zaken || [];
  const data = { ondernemingen: [], suppliers: lijst, posts: posts || [],
    supplierTypes: {
      zzp: { label: 'Zelfstandige', caps: ['services', 'agenda'] },
      restaurant: { label: 'Restaurant', caps: ['menu', 'orders', 'reservations'] }
    }, thuisHuizen: {} };
  const db = require('../server/kern/werkvormen').haakAan({ data });
  return maakOnderneming({
    db, save: () => {}, crypto: require('crypto'),
    schoon: (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : ''),
    ondernemerpoort: require('../server/opzet/salonregel')({ data }).ondernemerpoort,
    findSupplier: (code) => lijst.find(z => z.code === code) || null,
    ordersVanZaak: (code) => (lijst.find(z => z.code === code) || {}).orders || [],
    boekingenVanZaak: (code) => (lijst.find(z => z.code === code) || {}).boekingen || [],
    aanmeldingen: { aanvraag: () => ({ ok: true, aanmelding: { id: 'x' } }), een: () => ({ status: 404 }) }
  });
}

/* Een zaak die alles op orde heeft: door de poort, aanbod, prijzen, plaats. */
function volledigeZaak(over) {
  return Object.assign({
    code: 'GLAS', name: 'Glasheldere Ramen', type: 'zzp', city: 'Haarlem',
    staff: [{ id: 1 }], online: true,
    salon: { bio: 'Wij wassen ramen bij bedrijven in Haarlem.', foto: 'f.jpg' },
    rondleiding: { kassa: 'ja', werk: 'ja' },
    services: [{ id: 's1', name: 'Ramen wassen', price: 120 }],
    boekingen: [], orders: []
  }, over || {});
}

function ondMet(K, zaak) {
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Proef' }).onderneming.id);
  if (zaak) K.ondernemingKoppel(o, zaak.code, MIJN_ZAAK);
  return o;
}

/* ---------------- zonder zaak ---------------- */

test('zonder zaak is er geen percentage, en zeker geen 0%', () => {
  const K = stubKern();
  assert.equal(K.ondernemingEersteKlant(ondMet(K)), null,
    '0% zou zeggen dat er niets gedaan is, terwijl er niets te doen valt');
});

/* ---------------- de lijst volgt de werkvorm ---------------- */

test('een dienstverlener wordt om diensten gevraagd, niet om een kaart', () => {
  const zaak = volledigeZaak();
  const K = stubKern([zaak]);
  const e = K.ondernemingEersteKlant(ondMet(K, zaak));
  const ids = e.stappen.map(s => s.id);
  assert.ok(ids.includes('aanbod:services'), 'diensten worden gevraagd');
  assert.ok(!ids.includes('aanbod:menu'), 'een kaart niet');
});

test('een horecazaak met een team wordt om een kaart gevraagd en niet om diensten', () => {
  const zaak = volledigeZaak({ code: 'ETEN', type: 'restaurant', services: undefined,
    staff: [{ id: 1 }, { id: 2 }, { id: 3 }],
    menu: [{ id: 'm1', name: 'Dagschotel', price: 24 }] });
  const K = stubKern([zaak]);
  const ids = K.ondernemingEersteKlant(ondMet(K, zaak)).stappen.map(s => s.id);
  assert.ok(ids.includes('aanbod:menu'));
  assert.ok(!ids.includes('aanbod:services'), 'met personeel is dit geen eenmanszaak meer');
});

/* Dit is geen randgeval maar de belofte van werkvormen.js, en hij hoort dus
   vast te staan: wie in zijn eentje een restaurant runt IS ook zelfstandige,
   en krijgt allebei de gereedschapskisten. */
test('een restaurant van een persoon krijgt zowel de kaart als de diensten', () => {
  const zaak = volledigeZaak({ code: 'ETEN1', type: 'restaurant', staff: [{ id: 1 }],
    services: [{ id: 's', name: 'Catering', price: 200 }],
    menu: [{ id: 'm1', name: 'Dagschotel', price: 24 }] });
  const K = stubKern([zaak]);
  const ids = K.ondernemingEersteKlant(ondMet(K, zaak)).stappen.map(s => s.id);
  assert.ok(ids.includes('aanbod:menu') && ids.includes('aanbod:services'),
    'een zzp-restaurant is allebei, en de lijst volgt dat zonder dat iemand iets aanzet');
});

test('de lijst beweegt mee als de zaak iets anders gaat doen', () => {
  const zaak = volledigeZaak();
  const K = stubKern([zaak]);
  const o = ondMet(K, zaak);
  assert.ok(!K.ondernemingEersteKlant(o).stappen.some(s => s.id === 'aanbod:fleet'),
    'geen voertuigen, geen vlootstap');
  zaak.fleet = [{ id: 'a', kenteken: 'XX-01-XX' }];
  assert.ok(K.ondernemingEersteKlant(o).stappen.some(s => s.id === 'aanbod:fleet'),
    'zet hij er een busje in, dan komt de stap erbij -- er is geen schakelaar');
});

/* ---------------- geen tweede poort ---------------- */

test('de basisstappen komen uit de bestaande poort en tellen maar een keer', () => {
  const zaak = volledigeZaak();
  const K = stubKern([zaak]);
  const e = K.ondernemingEersteKlant(ondMet(K, zaak));
  const poort = e.stappen.filter(s => s.bron === 'poort');
  assert.ok(poort.some(s => s.id === 'poort:salon'), 'de Salon-pagina komt uit de poort');
  assert.equal(e.stappen.filter(s => /salon|etalage|pagina/i.test(s.id)).length, 1,
    'en staat er maar een keer in -- twee keer hetzelfde afvinken maakt van een teller een leugen');
});

test('een onvolledige Salon-pagina zakt via de poort, niet via een eigen regel', () => {
  const zaak = volledigeZaak({ salon: { bio: 'kort', foto: null }, photos: [] });
  const K = stubKern([zaak]);
  const e = K.ondernemingEersteKlant(ondMet(K, zaak));
  const salon = e.stappen.find(s => s.id === 'poort:salon');
  assert.equal(salon.klaar, false);
  assert.ok(e.open.some(s => s.id === 'poort:salon'));
  assert.ok(e.percentage < 100);
});

/* ---------------- de telling ---------------- */

test('het percentage is een exacte telling van de stappen', () => {
  const zaak = volledigeZaak();
  const K = stubKern([zaak]);
  const e = K.ondernemingEersteKlant(ondMet(K, zaak));
  assert.equal(e.klaar + e.open.length, e.totaal, 'klaar plus open is het totaal');
  assert.equal(e.percentage, Math.round((e.klaar / e.totaal) * 100));
});

test('de prijsstap komt pas op als er aanbod is', () => {
  const leeg = volledigeZaak({ services: [] });
  const K1 = stubKern([leeg]);
  assert.ok(!K1.ondernemingEersteKlant(ondMet(K1, leeg)).stappen.some(s => s.id === 'prijzen'),
    'zonder aanbod zou de prijsstap eeuwig open staan om een reden die de vorige stap al noemt');

  const zonderPrijs = volledigeZaak({ services: [{ id: 's', name: 'Iets', price: 0 }] });
  const K2 = stubKern([zonderPrijs]);
  const p = K2.ondernemingEersteKlant(ondMet(K2, zonderPrijs)).stappen.find(s => s.id === 'prijzen');
  assert.equal(p.klaar, false, 'met aanbod zonder prijs wel, en die staat open');
});

test('het eerste bericht telt de echte Salon-posts van deze zaak', () => {
  const zaak = volledigeZaak();
  const K1 = stubKern([zaak], []);
  assert.equal(K1.ondernemingEersteKlant(ondMet(K1, zaak)).stappen.find(s => s.id === 'eerste-bericht').klaar, false);

  const K2 = stubKern([zaak], [{ partnerCode: 'GLAS', text: 'Hallo' }, { partnerCode: 'ANDER', text: 'x' }]);
  const b = K2.ondernemingEersteKlant(ondMet(K2, zaak)).stappen.find(s => s.id === 'eerste-bericht');
  assert.equal(b.klaar, true);
  assert.ok(b.waarom.includes('1 bericht'), 'en telt alleen de eigen posts');
});

test('een zaak die niet online staat, staat niet klaar', () => {
  const dicht = volledigeZaak({ online: false });
  const K = stubKern([dicht]);
  const e = K.ondernemingEersteKlant(ondMet(K, dicht));
  assert.equal(e.stappen.find(s => s.id === 'online').klaar, false);
  assert.ok(e.open.some(s => s.id === 'online'));
});

/* ---------------- de mijlpalen ---------------- */

test('zonder klanten is het doel klaarstaan; met klanten is het groeien', () => {
  const zaak = volledigeZaak();
  const K = stubKern([zaak]);
  const o = ondMet(K, zaak);
  assert.equal(K.ondernemingEersteKlant(o).doel, 'klaarstaan');
  assert.equal(K.ondernemingEersteKlant(o).bereikt, null);
  assert.equal(K.ondernemingEersteKlant(o).volgende.klanten, 1);

  zaak.boekingen = [{ customerCodename: 'Reiger', status: 'bevestigd' }];
  const na = K.ondernemingEersteKlant(o);
  assert.equal(na.doel, 'groeien');
  assert.equal(na.bereikt, 'Eerste klant');
  assert.equal(na.volgende.klanten, 10);
  assert.equal(na.volgende.teGaan, 9);
});

test('de mijlpalen schuiven mee met het echte aantal klanten', () => {
  const zaak = volledigeZaak({ boekingen: Array.from({ length: 30 },
    (_, i) => ({ customerCodename: 'K' + i, status: 'bevestigd' })) });
  const K = stubKern([zaak]);
  const e = K.ondernemingEersteKlant(ondMet(K, zaak));
  assert.equal(e.klanten, 30);
  assert.equal(e.bereikt, 'Vijfentwintig klanten');
  assert.equal(e.volgende.klanten, 50);
  assert.deepEqual(e.mijlpalen.filter(m => m.bereikt).map(m => m.klanten), [1, 10, 25]);
});

test('een boeking die op betaling wacht is nog geen klant', () => {
  const zaak = volledigeZaak({ boekingen: [
    { customerCodename: 'Wilg', status: 'wacht-op-betaling' },
    { customerCodename: 'Wilg', status: 'bevestigd' },
    { customerCodename: 'Els', status: 'wacht-op-betaling' }
  ] });
  const K = stubKern([zaak]);
  assert.equal(K.ondernemingEersteKlant(ondMet(K, zaak)).klanten, 1,
    'dezelfde codenaam telt een keer, en wachten op betaling telt niet');
});

test('alle honderd gehaald: dan is er geen volgende mijlpaal meer', () => {
  const zaak = volledigeZaak({ boekingen: Array.from({ length: 120 },
    (_, i) => ({ customerCodename: 'K' + i, status: 'bevestigd' })) });
  const K = stubKern([zaak]);
  const e = K.ondernemingEersteKlant(ondMet(K, zaak));
  assert.equal(e.volgende, null);
  assert.equal(e.bereikt, 'Honderd klanten');
  assert.equal(EK.MIJLPALEN.length, e.mijlpalen.filter(m => m.bereikt).length);
});

/* ---------------- het dagbeeld pakt het op ---------------- */

test('het dagbeeld zet de eerste-klant-actie boven de losse aanvragen', () => {
  const zaak = volledigeZaak({ online: false,
    boekingen: [{ customerCodename: 'Els', status: 'aangevraagd' }] });
  const K = stubKern([zaak]);
  const d = K.ondernemingDagbeeld(ondMet(K, zaak));
  const iEerste = d.acties.findIndex(a => a.id === 'eersteklant');
  const iAanvraag = d.acties.findIndex(a => /aanvragen/.test(a.id));
  assert.ok(iEerste >= 0 && iAanvraag >= 0, 'allebei staan er');
  assert.ok(iEerste < iAanvraag,
    'een zaak die niet online staat krijgt sowieso geen aanvragen; dat gaat dus voor');
  assert.equal(d.acties.filter(a => /aanvragen/.test(a.id)).length, 1,
    'en er staat er maar een: twee keer hetzelfde vragen leest als een storing');
  assert.ok(d.eersteklant, 'en het beeld hangt aan het dagbeeld');
});
