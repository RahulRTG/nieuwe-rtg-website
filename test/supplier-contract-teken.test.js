/* ============================================================================
   DE HANDTEKENING ONDER EEN ZAAKCONTRACT -- /api/supplier/contract/teken.

   Deze deur uit server/routes/supplier/contract.js werd door de hele suite
   nooit aangeroepen: scripts/dekking.js las hem uit het routejournaal als
   NOOIT AANGERAAKT, en test/routedekking.test.js eist 100% zonder norm om die
   eis mee te verlagen. Het buurmannetje /api/supplier/contracten kwam in het
   journaal langs (een lijst lezen kan altijd), maar het TEKENEN zelf niet --
   en dat is nu juist het onomkeerbare deel.

   WAT ER OP HET SPEL STAAT

   Een getekend contract is bewijs. Alles wat deze route bewaakt, gaat over de
   vraag of dat bewijs iets waard is:

     - EEN HANDTEKENING IS EEN HANDELING, geen vinkje. Zonder getypte naam en
       zonder een akkoord dat LETTERLIJK true is, gebeurt er niets -- een
       truthy 'ja' uit een slordig scherm mag geen contract sluiten.
     - ELKE PARTIJ TEKENT ZIJN EIGEN KANT, en maar een keer. De zaak tekent
       via de leiding, het aangeschreven personeelslid tekent zichzelf, en een
       collega die er niets mee te maken heeft, tekent niet.
     - EEN TWEEDE HANDTEKENING OVERSCHRIJFT DE EERSTE NIET. Wie hier stil
       overschrijft, wist wie er werkelijk tekende en wanneer.
     - EEN CONTRACT IS VAN DE ZAAK WAAR HET LIGT. De buurzaak vindt het niet,
       ook niet met de juiste referentie -- die referentie staat immers gewoon
       op het scherm van de klant.
     - PAS ALS BEIDEN TEKENDEN, is de status 'getekend'. Eerder niet.

   MUTATIES die zijn gedraaid en welke bewering erop zakte (LAT.md regel 2):
   - `&& x.supplierCode === s.code` uit de zoekregel gehaald
     -> toets 1 "een contract van een ander bedrijf bestaat hier niet" ZAKT (RAAK)
   - `req.body.akkoord !== true` vervangen door `!req.body.akkoord`
     -> toets 2 "een truthy 'ja' is geen akkoord" ZAKT (RAAK)
   - de 403-tak (`if (!zijde)`) eruit gehaald, dus terugval op 'zaak'
     -> toets 3 "een collega tekent niet mee" ZAKT (RAAK)
   - de twee 409-takken eruit gehaald, dus stil overschrijven
     -> toets 4 "de zaak tekent een keer" en toets 5 "ook de werknemer tekent
        maar een keer" ZAKKEN (RAAK)
   - `if (c.tekenZaak && c.tekenPartij)` vervangen door `if (... || ...)`
     -> toets 4 "een halve ondertekening is nog geen contract" en toets 6
        "dit contract wacht nog op de leiding" ZAKKEN (RAAK)

   Draai los: node --test test/supplier-contract-teken.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tekencontract-'));
/* Castell Bouw & Ambacht: de enige demozaak met een baas EN twee vaklieden, en
   dat derde paar handen is hier het punt -- zonder collega valt de vraag "wie
   gaat dit contract eigenlijk aan" niet te stellen. Het genre 'bouw' draagt
   geen persoonseis, dus de leveranciers-poort laat alle drie gewoon binnen. */
const ZAAK = 'CASTELL';
const BUUR = 'KIKUNOI';        // Sal de Mar, een heel ander bedrijf
let srv, base, baas, vakman, collega, buur, VAKMAN_ID, VAKMAN_NAAM, REF;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' },
    token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function moet(pad, body, token, wat) {
  const r = await api(pad, body, token);
  assert.equal(r.status, 200, wat + ' -- ' + (r.body.error || r.status));
  return r.body;
}

/* Het rooster is het scherm waarop je jezelf aanwijst en is dus open; de
   pincode niet. De seed geeft de eerste rij (de leiding) 1234 en de rest 5678. */
async function bemensing(code) {
  const rooster = await moet('/api/supplier/roster', { code }, null, 'het rooster van ' + code);
  const lijst = rooster.staff || [];
  const mg = lijst.find(x => x.role === 'manager');
  const vloer = lijst.filter(x => x.role !== 'manager');
  assert.ok(mg, 'de demozaak ' + code + ' heeft leiding');
  return { mg, vloer };
}

/* Het contract waar in dit bestand omheen wordt getekend: de zaak aan de ene
   kant, een eigen personeelslid aan de andere. */
async function versContract(titel) {
  const uit = await moet('/api/supplier/contract/maak', {
    soort: 'personeel', titel,
    tekst: 'De werknemer werkt als vakman op de projecten van de zaak, tegen het ' +
           'uurtarief uit de bijlage, met een opzegtermijn van een maand.',
    staffId: VAKMAN_ID
  }, baas, 'de zaak stelt een contract op');
  assert.equal(uit.contract.status, 'wacht', 'een vers contract is door niemand getekend');
  return uit.contract;
}

/* Het contract zoals het straks in de kast staat, opgehaald via de lijst van de
   zaak. Zonder deze terugleesstap toetst dit bestand alleen het antwoord van de
   route en niet wat er werkelijk is vastgelegd. */
async function uitDeKast(ref) {
  const lijst = await moet('/api/supplier/contracten', {}, baas, 'de contracten van de zaak');
  const c = (lijst.contracten || []).find(x => x.ref === ref);
  assert.ok(c, 'contract ' + ref + ' staat in de lijst van de zaak');
  return c;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;

  const eigen = await bemensing(ZAAK);
  assert.ok(eigen.vloer.length >= 2, 'de zaak heeft twee vaklieden naast de leiding');
  VAKMAN_ID = eigen.vloer[0].id;
  VAKMAN_NAAM = eigen.vloer[0].name;
  baas = (await api('/api/supplier/login', { code: ZAAK, staffId: eigen.mg.id, pin: '1234' })).body.token;
  vakman = (await api('/api/supplier/login', { code: ZAAK, staffId: VAKMAN_ID, pin: '5678' })).body.token;
  collega = (await api('/api/supplier/login', { code: ZAAK, staffId: eigen.vloer[1].id, pin: '5678' })).body.token;

  const anderBedrijf = await bemensing(BUUR);
  buur = (await api('/api/supplier/login', { code: BUUR, staffId: anderBedrijf.mg.id, pin: '1234' })).body.token;

  assert.ok(baas && vakman && collega && buur, 'vier sessies: drie bij de zaak, een bij de buren');
  REF = (await versContract('Arbeidsovereenkomst vakman')).ref;
});

test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { if (e && e.code !== 'ENOTEMPTY') throw e; }
});

test('1. tekenen kan alleen met een sessie, op een contract van de eigen zaak', async () => {
  const goed = { ref: REF, naam: 'Ferran Castell', akkoord: true };

  const anoniem = await api('/api/supplier/contract/teken', goed, null);
  assert.equal(anoniem.status, 401, 'zonder sessie wordt er niet getekend: ' + JSON.stringify(anoniem.body));

  const rommel = await api('/api/supplier/contract/teken', goed, 'niet-een-token');
  assert.equal(rommel.status, 401, 'een verzonnen token tekent niets');

  /* De scherpe: de buurzaak KENT de referentie (die staat op het contract zelf)
     maar hoort hem niet te vinden. Zonder de zaakcode in de zoekregel zou een
     bakker het arbeidscontract van een bouwbedrijf kunnen ondertekenen. */
  const buren = await api('/api/supplier/contract/teken', goed, buur);
  assert.equal(buren.status, 404, 'een contract van een ander bedrijf bestaat hier niet');
  assert.match(String(buren.body.error || ''), /niet gevonden/i, buren.body.error);

  const onzin = await api('/api/supplier/contract/teken',
    { ref: 'RTG-C-ZZZZZZ', naam: 'Ferran Castell', akkoord: true }, baas);
  assert.equal(onzin.status, 404, 'een referentie die niet bestaat');

  const leeg = await api('/api/supplier/contract/teken', { naam: 'Ferran Castell', akkoord: true }, baas);
  assert.equal(leeg.status, 404, 'en helemaal geen referentie ook niet');

  const nog = await uitDeKast(REF);
  assert.equal(nog.tekenZaak, null, 'na vier weigeringen staat er nog geen handtekening onder');
});

test('2. een handtekening vraagt een getypte naam en een akkoord dat true is', async () => {
  const zonderNaam = await api('/api/supplier/contract/teken', { ref: REF, naam: '   ', akkoord: true }, baas);
  assert.equal(zonderNaam.status, 400, 'spaties zijn geen naam');
  assert.match(String(zonderNaam.body.error || ''), /naam|akkoord/i, zonderNaam.body.error);

  const zonderAkkoord = await api('/api/supplier/contract/teken', { ref: REF, naam: 'Ferran Castell' }, baas);
  assert.equal(zonderAkkoord.status, 400, 'een naam zonder akkoord tekent niet');

  /* Akkoord moet LETTERLIJK true zijn. Een scherm dat 'ja' of 1 meestuurt, is
     een scherm dat het vinkje niet heeft gevraagd. */
  const bijnaAkkoord = await api('/api/supplier/contract/teken', { ref: REF, naam: 'Ferran Castell', akkoord: 'ja' }, baas);
  assert.equal(bijnaAkkoord.status, 400, "een truthy 'ja' is geen akkoord");

  const eenAkkoord = await api('/api/supplier/contract/teken', { ref: REF, naam: 'Ferran Castell', akkoord: 1 }, baas);
  assert.equal(eenAkkoord.status, 400, 'en een 1 evenmin');

  /* Een naam die geen tekst is, komt door schoon() als lege string terug en is
     dus geen handtekening -- en niet een [object Object] onder een contract. */
  const geenTekst = await api('/api/supplier/contract/teken',
    { ref: REF, naam: { voor: 'Ferran' }, akkoord: true }, baas);
  assert.equal(geenTekst.status, 400, 'een object is geen getypte naam');

  const nog = await uitDeKast(REF);
  assert.equal(nog.tekenZaak, null, 'geen van deze vijf pogingen liet iets achter');
  assert.equal(nog.status, 'wacht', 'en het contract wacht nog steeds');
});

test('3. de zijde is die van de mens: een collega die er niets mee te maken heeft, tekent niet', async () => {
  const vreemde = await api('/api/supplier/contract/teken',
    { ref: REF, naam: 'Pau Ricard', akkoord: true }, collega);
  assert.equal(vreemde.status, 403, 'dit contract staat niet op zijn naam');
  assert.match(String(vreemde.body.error || ''), /op uw naam/i, vreemde.body.error);

  const nog = await uitDeKast(REF);
  assert.equal(nog.tekenPartij, null, 'en er staat niets onder de kant van de werknemer');
});

test('4. de zaak tekent een keer, en een halve ondertekening is nog geen contract', async () => {
  /* De handtekening gaat door schoon(): geen HTML, en afgekapt op 60 tekens.
     Wat eronder komt te staan is bewijs en dus geen vrije invoer. */
  const getypt = '<b>Ferran Castell</b>, namens Castell Bouw & Ambacht te Sant Rafel, Ibiza, Spanje';
  const uit = await moet('/api/supplier/contract/teken', { ref: REF, naam: getypt, akkoord: true },
    baas, 'de leiding tekent namens de zaak');

  const c = uit.contract;
  assert.ok(c.tekenZaak, 'er staat nu een handtekening van de zaak onder');
  assert.equal(/[<>]/.test(c.tekenZaak.naam), false, 'zonder HTML: ' + c.tekenZaak.naam);
  assert.equal(c.tekenZaak.naam.length, 60, 'en afgekapt op 60 tekens');
  assert.ok(c.tekenZaak.naam.includes('Ferran Castell'), 'de getypte naam zelf blijft staan: ' + c.tekenZaak.naam);
  assert.ok(Date.parse(c.tekenZaak.at) > 0, 'met een tijdstempel erbij');
  assert.equal(c.tekenPartij, null, 'de werknemer heeft nog niet getekend');
  assert.equal(c.status, 'wacht',
    'en zolang er een kant ontbreekt is het contract NIET getekend maar wachtend');

  /* Nog een keer tekenen namens de zaak is geen tweede handtekening maar een
     poging tot overschrijven. Dat hoort te stuiten, en wat er stond moet blijven. */
  const nogmaals = await api('/api/supplier/contract/teken',
    { ref: REF, naam: 'Iemand anders', akkoord: true }, baas);
  assert.equal(nogmaals.status, 409, 'de zaak heeft al getekend');
  assert.match(String(nogmaals.body.error || ''), /al getekend/i, nogmaals.body.error);

  const nog = await uitDeKast(REF);
  assert.equal(nog.tekenZaak.naam, c.tekenZaak.naam, 'de eerste handtekening staat er nog, ongewijzigd');
  assert.equal(nog.tekenZaak.at, c.tekenZaak.at, 'met zijn eigen tijdstempel');
});

test('5. de tweede partij maakt het contract getekend, en de tekst blijft het bewijs', async () => {
  const voor = await uitDeKast(REF);

  const uit = await moet('/api/supplier/contract/teken',
    { ref: REF, naam: VAKMAN_NAAM, akkoord: true }, vakman, 'de werknemer tekent zijn eigen kant');

  const c = uit.contract;
  assert.ok(c.tekenPartij, 'zijn handtekening staat eronder');
  assert.equal(c.tekenPartij.naam, VAKMAN_NAAM, 'op zijn eigen naam');
  assert.equal(c.tekenZaak.naam, voor.tekenZaak.naam, 'de zaak-kant is niet aangeraakt');
  assert.equal(c.status, 'getekend', 'nu beide kanten er staan, is het contract getekend');
  assert.equal(c.tekst, voor.tekst, 'en de tekst is geen letter veranderd -- dat is het bewijs');
  assert.equal(c.ref, REF, 'nog steeds hetzelfde contract');

  const nogmaals = await api('/api/supplier/contract/teken',
    { ref: REF, naam: VAKMAN_NAAM, akkoord: true }, vakman);
  assert.equal(nogmaals.status, 409, 'ook de werknemer tekent maar een keer');
  assert.match(String(nogmaals.body.error || ''), /al getekend/i, nogmaals.body.error);

  const nog = await uitDeKast(REF);
  assert.equal(nog.status, 'getekend', 'zo staat hij ook in de kast van de zaak');
  assert.equal(nog.tekenPartij.at, c.tekenPartij.at, 'met de tijdstempel van de eerste keer');
});

test('6. elk contract heeft zijn eigen handtekeningen', async () => {
  /* Een tweede contract voor DEZELFDE werknemer. Zou de route op de mens en
     niet op de referentie tekenen, dan zou dit er al getekend uitzien. */
  const tweede = await versContract('Uitbreiding uren zomerseizoen');
  assert.notEqual(tweede.ref, REF, 'het is een ander contract');
  assert.equal(tweede.tekenZaak, null, 'dat nog door niemand is getekend');

  const uit = await moet('/api/supplier/contract/teken',
    { ref: tweede.ref, naam: VAKMAN_NAAM, akkoord: true }, vakman, 'de werknemer tekent als eerste');
  assert.ok(uit.contract.tekenPartij, 'zijn kant staat eronder');
  assert.equal(uit.contract.tekenZaak, null, 'de zaak nog niet');
  assert.equal(uit.contract.status, 'wacht', 'dus wacht dit contract nog op de leiding');

  const oude = await uitDeKast(REF);
  assert.equal(oude.status, 'getekend', 'en het eerste contract is er niet door veranderd');
});
