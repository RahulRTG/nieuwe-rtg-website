/* RTG-punten, het tegoed dat eruit komt, en de cadeaukaart die niets kostte.

   Deze toets bestond niet, en dat is het punt. Er liepen twee geldstromen mee
   die door geen enkele toets werden aangeraakt:

   1. VERZILVERDE PUNTEN ZIJN GELD. 100 punten worden 10 euro tegoed, dat bij de
      volgende betaling automatisch wordt verrekend. Het bedrag stond in euro's
      als drijvende komma, kende geen plafond, en de schakelaar van /api/punten
      hing aan geen enkel vermogen uit kern/bevoegdheid/lijst.js.
   2. EEN CADEAUKAART KOPEN IN DE APP KOSTTE NIETS. /api/giftcard/buy maakte een
      kaart met saldo aan, meldde de zaak dat er een kaart verkocht was, en inde
      niets -- terwijl die kaart aan de kassa van diezelfde zaak inwisselbaar is
      en in kern/fiscaal als verplichting op zijn balans komt.

   MUTATIES GEZIEN ZAKKEN (LAT.md regel 2):
   - de plafondcontrole in verzilverPunten weggehaald: "boven het plafond gaat
     verzilveren niet door" zakte;
   - `tegoedCenten` weer als euro's opgeslagen (delen door 100 bij het
     bijschrijven): "het tegoed staat in centen" zakte;
   - de aanroep van pay.partnerIn in /api/giftcard/buy overgeslagen (de hele
     aanroep, niet alleen de foutcontrole -- die eerste poging beet niet, want
     dan wordt er nog steeds betaald): "de kaart is echt betaald" zakte;
   - de herhaal-controle op de kaart uitgezet: "dezelfde sleutel levert EEN
     kaart op" zakte met twee kaarten.
   Alle vier teruggedraaid, daarna groen.

   Die laatste is er dankzij deze toets bij gekomen. De reparatie hierboven
   maakte de BETALING idempotent en de KAART niet: een dubbeltik schreef een
   keer af en muntte twee kaarten. Een toets die alleen de statuscode had
   geteld, was daar groen op gebleven.

   Draai los: node --experimental-sqlite --test test/punten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-punten-'));

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const MINI_PNG = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let teller = 0;
async function versLid() {
  const u = Date.now() + '-' + (++teller);
  const r = await api('/api/auth/register', {
    name: 'Punten Toets ' + teller, email: 'pt-' + u + '@toets.example',
    password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg'
  });
  assert.ok(r.body.token, 'registreren hoort een token te geven');
  assert.equal((await api('/api/verify/upload', { image: MINI_PNG }, r.body.token)).status, 200);
  return r.body.token;
}

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); base = srv.base; });
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* ------------------------------------------------------------- de punten -- */

test('punten verzilveren geeft tegoed in CENTEN, en de euro-vorm blijft voor het scherm', async () => {
  const tok = await versLid();
  const leeg = await api('/api/punten', {}, tok);
  assert.equal(leeg.status, 200);
  assert.equal(leeg.body.saldo, 0, 'een vers lid begint op nul punten');
  assert.equal(leeg.body.tegoedCenten, 0, 'en op nul tegoed');
  assert.ok(leeg.body.plafondCenten > 0, 'het plafond staat in het antwoord: ' + JSON.stringify(leeg.body).slice(0, 160));

  // verzilveren kan alleen per 100, en alleen met genoeg punten
  assert.equal((await api('/api/punten/verzilver', { punten: 50 }, tok)).status, 400, 'per 100, niet per 50');
  assert.equal((await api('/api/punten/verzilver', { punten: 100 }, tok)).status, 409, 'en niet zonder punten');
});

/* De rekenkant los, want over de routes kun je geen punten VERDIENEN zonder een
   hele bestelketen af te lopen -- en dat maakt de toets over iets anders dan
   waar hij over gaat. Hier praat de toets rechtstreeks tegen de module, met een
   nep-db, zodat het plafond en de centen precies te meten zijn. */
test('het tegoed rekent in centen en stopt bij het plafond', async () => {
  const data = { punten: {} };
  let bewaard = 0;
  const punten = require('../server/kern/ervaring/leden/punten')({
    db: { data }, save: () => { bewaard++; }, nu: () => Date.now()
  });

  // 6000 punten sparen: 600 euro aan tegoed, en het plafond ligt op 500
  data.punten.k = { saldo: 6000, tegoedCenten: 0, historie: [] };
  /* verzilverPunten is async sinds verzilveren in de wallet landt: er staat een
     echte boeking vanaf de huisrekening tegenover. Zonder await is `r` een
     belofte en is `r.ok` undefined -- dan meet deze lus niets. Deze stub geeft
     geen `payVan` mee, dus loopt hij bewust over de terugval (het oude tegoed
     met zijn plafond), en dat is precies wat hieronder wordt gemeten. */
  for (let i = 0; i < 50; i++) {
    const r = await punten.verzilverPunten('k', 100);
    assert.equal(r.ok, true, 'ronde ' + i + ' hoort te lukken: ' + JSON.stringify(r).slice(0, 120));
  }
  const stand = punten.puntenVan('k');
  assert.equal(stand.tegoedCenten, 50000, 'vijftig keer tien euro staat als 50000 CENTEN');
  assert.equal(stand.tegoed, 500, 'en het scherm ziet er nog steeds euro\'s');

  const overheen = await punten.verzilverPunten('k', 100);
  assert.equal(overheen.status, 409, 'boven het plafond gaat verzilveren niet door');
  assert.equal(punten.puntenVan('k').saldo, 1000, 'en de punten blijven staan; ze zijn niet verdampt');

  /* Verrekenen praat in EURO'S met zijn aanroepers (o.total is een euro-getal)
     maar houdt de opslag in centen. Een bedrag met centen erin hoort exact af
     te gaan, en dat is precies wat een drijvende komma niet garandeert. */
  const korting = punten.pasTegoedToe('k', 12.34);
  assert.equal(korting, 12.34, 'de korting komt in euro\'s terug');
  assert.equal(punten.puntenVan('k').tegoedCenten, 50000 - 1234, 'en gaat exact in centen van het tegoed af');
  assert.ok(bewaard > 0, 'er is onderweg echt opgeslagen');
});

test('een bestaande installatie met tegoed in euro-floats wordt EEN keer omgerekend', async () => {
  const data = { punten: { oud: { saldo: 12, tegoed: 30.5, historie: [] } } };
  let bewaard = 0;
  const punten = require('../server/kern/ervaring/leden/punten')({
    db: { data }, save: () => { bewaard++; }, nu: () => Date.now()
  });
  const eerst = punten.puntenVan('oud');
  assert.equal(eerst.tegoedCenten, 3050, 'dertig euro vijftig wordt 3050 centen');
  assert.equal(data.punten.oud.tegoed, undefined, 'en het oude euro-veld is weg');
  assert.equal(bewaard, 1, 'de omrekening is opgeslagen');
  punten.puntenVan('oud');
  assert.equal(bewaard, 1, 'en gebeurt daarna niet nog eens');
});

/* ------------------------------------------------------- de cadeaukaart -- */

test('een cadeaukaart in de app kost nu echt geld, en de zaak ontvangt het', async () => {
  const tok = await versLid();
  const zaken = await api('/api/suppliers', {}, tok);
  const zaak = (zaken.body.suppliers || zaken.body || []).find ? (zaken.body.suppliers || []).find(Boolean) : null;
  assert.ok(zaak && zaak.code, 'er is een zaak om een kaart bij te kopen: ' + JSON.stringify(zaken.body).slice(0, 200));

  const voor = (await api('/api/pay/overzicht', {}, tok)).body.saldo;
  const koop = await api('/api/giftcard/buy', { supplierCode: zaak.code, bedrag: 50, idem: 'gc-1' }, tok);
  assert.equal(koop.status, 200, JSON.stringify(koop.body).slice(0, 200));
  assert.equal(koop.body.kaart.bedrag, 50);
  assert.equal(koop.body.betaaldCenten, 5000, 'er is vijftig euro geind');

  /* Het bewijs staat in het grootboek van het lid: een afschrijving van precies
     50 euro. Zonder deze regel bewijst "status 200" alleen dat er een kaart is. */
  const na = await api('/api/pay/overzicht', {}, tok);
  assert.ok(na.body.geschiedenis.some(r => r.centen === -5000),
    'de kaart is echt betaald: ' + JSON.stringify(na.body.geschiedenis).slice(0, 240));
  assert.equal(na.body.saldo, voor + (koop.body.bijgeladen || 0) - 5000, 'en het saldo klopt op de cent');

  // dubbeltikken koopt er geen tweede
  const weer = await api('/api/giftcard/buy', { supplierCode: zaak.code, bedrag: 50, idem: 'gc-1' }, tok);
  assert.equal(weer.status, 200);
  const kaarten = await api('/api/giftcards/mine', {}, tok);
  assert.equal(kaarten.body.kaarten.length, 1, 'dezelfde sleutel levert EEN kaart op');

  const gezond = await fetch(base + '/api/pay/gezond').then(r => r.json());
  assert.equal(gezond.klopt, true, 'en het grootboek sluit nog steeds op de cent');
});
