/* HET SEMANTISCHE IDENTITEITSCONTRACT, getoetst tegen de code die het beschrijft.

   server/lib/idem-contract.js verandert geen gedrag; het declareert wat twee
   handlers vandaag met de hand herontdekken. Een declaratie die naast de code
   staat is binnen een maand een leugen, dus deze toets houdt ze tegen elkaar:
   de verklaarde velden moeten letterlijk in de handler voorkomen, en het
   gedrag dat eruit volgt wordt tegen een ECHTE server gemeten.

   De scherpste toets staat onderaan en gaat over `teSmal`: van
   /api/supplier/betaalverzoek is gemeten dat de ontvanger NIET in de identiteit
   zit. Dat is een gebrek in de route, geen vrijheid van het contract -- en
   zolang het er is, hoort het uitgeschreven te staan in plaats van stil te zijn.
   Draai los: node --test test/idemcontract.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const contract = require('../server/lib/idem-contract');

const bron = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

/* De afdruk in de handler is een SAMENGESTELDE uitdrukking ('pasuit|' + iban +
   '|' + soort), dus een regex op het eerste stringdeel leest alleen 'pasuit|'
   -- zo stond deze toets even groen te wezen op de verkeerde tekst. Hier wordt
   het tweede argument van metIdem() diepte-bewust uitgelezen, zodat de SLEUTEL
   (argument een) en de IDENTITEIT (argument twee) uit elkaar blijven. Zonder
   dat onderscheid kan de toets niet zien of een veld de sleutel bepaalt of de
   betekenis, en juist dat verschil is waar deze laag over gaat. */
function tweedeArgumentVan(src, functie) {
  const start = src.indexOf(functie + '(');
  if (start < 0) return null;
  let i = start + functie.length + 1, diepte = 0, arg = 0, buf = '';
  let quote = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) { if (c === '\\') { i++; continue; } if (c === quote) quote = null; if (arg === 1) buf += c; continue; }
    if (c === '\'' || c === '"' || c === '`') { quote = c; if (arg === 1) buf += c; continue; }
    if (c === '(' || c === '[' || c === '{') diepte++;
    else if (c === ')' || c === ']' || c === '}') { if (diepte === 0) break; diepte--; }
    else if (c === ',' && diepte === 0) { arg++; if (arg > 1) break; continue; }
    if (arg === 1) buf += c;
  }
  return arg >= 1 ? buf.trim() : null;
}

test('de canonieke lijst is gesloten: elk verklaard veld noemt een bestaand type', () => {
  for (const [cap, c] of Object.entries(contract.CONTRACTEN)) {
    for (const [veld, soort] of Object.entries(c.identiteit.canoniek || {})) {
      assert.ok(contract.CANONIEK[soort], cap + '.' + veld + ' noemt onbekend canoniek type ' + soort);
    }
    assert.ok(contract.IDENTITEITSMODI[c.identiteit.modus], cap + ' noemt een onbekende modus');
    assert.ok(contract.HERHALING[c.herhaling], cap + ' noemt een onbekende herhalingsstand');
    assert.ok(contract.LEVERING[c.levering], cap + ' noemt een onbekende leveringsstand');
  }
});

test('bank.pas.uitgeven: de verklaarde velden staan letterlijk in de handler', () => {
  const src = bron('server/kern/bank/passen.js');
  /* De handler bouwt zijn identiteit met de hand. Die uitdrukking is de
     waarheid; het contract mag er niet van afwijken. */
  const afdruk = tweedeArgumentVan(src, 'metIdem');
  assert.ok(afdruk && afdruk.length > 5, 'de hand-gebouwde afdruk van uitgeven() is niet meer te vinden');
  for (const veld of contract.CONTRACTEN['bank.pas.uitgeven'].identiteit.velden) {
    assert.ok(afdruk.includes(veld), 'verklaard veld ' + veld + ' zit niet in de afdruk van de handler: ' + afdruk);
  }
  for (const veld of Object.keys(contract.CONTRACTEN['bank.pas.uitgeven'].identiteit.buiten)) {
    if (veld === 'idem') continue; // de sleutel zit wel in de SLEUTEL, niet in de afdruk
    assert.ok(!afdruk.includes(veld), 'veld ' + veld + ' heet buiten de identiteit maar staat in de afdruk');
  }
});

test('bank.pas.uitgeven: de standaard soort staat ook echt in de handler', () => {
  const src = bron('server/kern/bank/passen.js');
  const st = contract.CONTRACTEN['bank.pas.uitgeven'].identiteit.standaarden;
  for (const [veld, waarde] of Object.entries(st)) {
    assert.match(src, new RegExp(veld + "\\s*=\\s*'" + waarde + "'"),
      'de verklaarde standaard ' + veld + "='" + waarde + "' staat niet in de handler");
  }
  /* En de standaard doet wat hij belooft: een lijf zonder soort levert dezelfde
     identiteit als een lijf met de standaardwaarde. Zonder deze regel zou het
     contract SMALLER zijn dan de code. */
  assert.equal(contract.identiteitVan('bank.pas.uitgeven', { iban: 'NL01' }),
    contract.identiteitVan('bank.pas.uitgeven', { iban: 'NL01', soort: 'debit' }));
});

test('supplier.betaalverzoek: de verklaarde identiteit staat letterlijk in de handler', () => {
  const src = bron('server/kern/directpay/verzoek.js');
  /* De handler vergelijkt met de hand, en op precies EEN veld. */
  assert.match(src, /al\.bedrag\s*!==\s*cent/,
    'de hand-gebouwde vergelijking van verzoekMaak() is niet meer te vinden');
  assert.deepEqual(contract.CONTRACTEN['supplier.betaalverzoek'].identiteit.velden, ['centen'],
    'de handler vergelijkt alleen het bedrag; het contract mag niet meer claimen');
});

test('een veld dat teSmal heet, mag NOOIT stilzwijgend in velden staan', () => {
  for (const [cap, c] of Object.entries(contract.CONTRACTEN)) {
    for (const veld of Object.keys(c.identiteit.teSmal || {})) {
      assert.ok(!c.identiteit.velden.includes(veld),
        cap + ': ' + veld + ' staat in teSmal EN in velden -- dat is een verbreding die als beschrijving vermomd is');
      assert.ok(String(c.identiteit.teSmal[veld]).length > 20,
        cap + ': ' + veld + ' staat in teSmal zonder uitgeschreven reden');
    }
  }
});

test('geldbedrag canonicaliseert, exact doet dat met opzet niet', () => {
  assert.equal(contract.CANONIEK.geldbedrag('5000'), 5000);
  assert.equal(contract.CANONIEK.geldbedrag(4999.6), 5000);
  assert.equal(contract.CANONIEK.geldbedrag('nogal wat'), null);
  /* exact laat staan: een generieke trim of lowercase zou de infrastructuur
     businessbetekenis laten verzinnen. */
  assert.equal(contract.CANONIEK.exact(' Anna '), ' Anna ');
  assert.equal(contract.CANONIEK.valuta(' eur '), 'EUR');
});

test('geen contract is iets anders dan een lege identiteit', () => {
  assert.equal(contract.identiteitVan('bestaat.niet', { a: 1 }), null);
  /* En twee verschillende onverklaarde handelingen vallen dus niet samen: ze
     geven allebei null, en null is geen sleutel om op te dedupliceren. */
  assert.equal(contract.identiteitVan('ook.niet', { b: 2 }), null);
  assert.notEqual(contract.identiteitVan('supplier.betaalverzoek', { centen: 1 }), null);
});

/* ------------------------------------------------------------------------
   TEGEN EEN ECHTE SERVER. Het contract mag beweren wat het wil; alleen de
   route bewijst het. */
let srv, base, winkel;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-idemcontract-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'MAISON' } });
  base = srv.base;
  const r = await fetch(base + '/api/supplier/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'rahul', password: 'Imran' }) });
  winkel = (await r.json()).token;
});
test.after(async () => { if (srv) await stop(srv); });

const post = (pad, body) => fetch(base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + winkel },
  body: JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('ECHT: gelijke contractidentiteit -> de route ziet een herhaling', async () => {
  const s = 'ct-gelijk-' + Date.now();
  const a = await post('/api/supplier/betaalverzoek', { codename: 'ANNA-001', centen: 5000, idem: s });
  const b = await post('/api/supplier/betaalverzoek', { codename: 'ANNA-001', centen: 5000, omschrijving: 'andere tekst', idem: s });
  assert.equal(contract.identiteitVan('supplier.betaalverzoek', { centen: 5000 }),
    contract.identiteitVan('supplier.betaalverzoek', { centen: 5000 }));
  assert.equal(b.status, 200);
  assert.equal(b.body.herhaald, true, 'gelijke identiteit hoort een herhaling te zijn');
  assert.equal(a.body.verzoek.ref, b.body.verzoek.ref);
});

test('ECHT: verschillende contractidentiteit -> de route weigert met 409', async () => {
  const s = 'ct-anders-' + Date.now();
  await post('/api/supplier/betaalverzoek', { codename: 'ANNA-001', centen: 5000, idem: s });
  const b = await post('/api/supplier/betaalverzoek', { codename: 'ANNA-001', centen: 7500, idem: s });
  assert.notEqual(contract.identiteitVan('supplier.betaalverzoek', { centen: 5000 }),
    contract.identiteitVan('supplier.betaalverzoek', { centen: 7500 }));
  assert.equal(b.status, 409, 'een andere identiteit op dezelfde sleutel hoort te weigeren');
});

test('ECHT: de teSmal-bevinding is echt, en blijft zichtbaar zolang zij bestaat', async () => {
  const s = 'ct-ontvanger-' + Date.now();
  const a = await post('/api/supplier/betaalverzoek', { codename: 'ANNA-001', centen: 5000, idem: s });
  const b = await post('/api/supplier/betaalverzoek', { codename: 'BOB-002', centen: 5000, idem: s });
  /* Dit is GEEN goedkeuring. De route geeft het verzoek van de eerste ontvanger
     terug en de zaak leest "gelukt", terwijl de tweede ontvanger niets krijgt.
     Verandert iemand dat -- en dat zou goed zijn -- dan zakt deze toets en moet
     `teSmal` in het contract mee veranderen. Dat is precies de bedoeling: het
     gebrek mag niet stil verdwijnen en ook niet stil blijven. */
  assert.equal(b.status, 200);
  assert.equal(b.body.herhaald, true);
  assert.equal(b.body.verzoek.naarCodename, 'ANNA-001',
    'de route geeft nog steeds de EERSTE ontvanger terug -- werk `teSmal` bij als dit is gerepareerd');
  assert.equal(a.body.verzoek.ref, b.body.verzoek.ref);
  assert.ok(contract.CONTRACTEN['supplier.betaalverzoek'].identiteit.teSmal.naarCodename,
    'het contract hoort dit gebrek uitgeschreven te dragen');
});
