/* DE INGESCHAKELD-AS VAN DE VRIJGAVEPOORT (server/kern/vrijgave/stand.js) en de
   keuring van het standbestand (server/kern/vrijgave/standkeur.js): de randen.
   Een bestand dat niet te bekijken is, een slot dat niet te maken is of door
   een levende schrijver wordt vastgehouden, een werk dat niets oplevert, de
   herstelweg na een kapot bestand, de cache en zijn TTL, en per vormfout in het
   bestand een eigen weigering. Alles in een eigen tijdelijke map. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { maakStand, keur, leeg, FORMAAT, TTL_MS } = require('../server/kern/vrijgave/stand');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vrijgave-stand-takken-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;
const map = () => { const d = path.join(TMP, 'm' + (++n)); fs.mkdirSync(d, { recursive: true }); return d; };
const SHA = 'a'.repeat(64);

test('de datamap komt uit RTG_DATA_DIR, en anders uit server/data', () => {
  const d = map();
  assert.equal(maakStand({ env: { RTG_DATA_DIR: d } }).pad, path.join(d, 'vrijgave-stand.json'));
  assert.equal(maakStand({ env: {} }).pad, path.join(__dirname, '..', 'server', 'data', 'vrijgave-stand.json'));
  assert.equal(maakStand({ bestand: path.join(d, 'x.json') }).pad, path.join(d, 'x.json'));
});

test('zonder bestand: een lege stand, de veilige stand per capability, en "disabled" voor een onbekende id', () => {
  const st = maakStand({ bestand: path.join(map(), 's.json') });
  assert.deepEqual(st.lees().staat, leeg());
  assert.deepEqual(st.standVan('geld.inkomend'), { stand: 'disabled', standaard: true, versie: 0 });
  assert.deepEqual(st.standVan('geld.verzonnen'), { stand: 'disabled', standaard: true, versie: 0 });
  assert.equal(st.besluit('emoney.b3'), null);
});

test('een pad dat niet te bekijken is, is een configuratiefout: standVan geeft de fout, besluit geeft niets', () => {
  const d = map();
  const blok = path.join(d, 'een-bestand');
  fs.writeFileSync(blok, 'x');
  const st = maakStand({ bestand: path.join(blok, 'stand.json') });   // ENOTDIR bij de stat
  assert.deepEqual(st.standVan('geld.inkomend'), { fout: 'standbestand niet te bekijken' });
  assert.equal(st.besluit('emoney.b3'), null);
});

test('de cache houdt een lezing vast binnen de TTL en leest daarna opnieuw', () => {
  let t = 1000;
  const bestand = path.join(map(), 's.json');
  const st = maakStand({ bestand, nu: () => t });
  const a = st.lees();
  assert.equal(st.lees(), a, 'binnen de TTL hetzelfde object');
  t += TTL_MS + 1;
  const b = st.lees();
  assert.notEqual(b, a, 'na de TTL een nieuwe lezing');
  assert.deepEqual(b.staat, a.staat);
});

test('een ingetrokken besluit telt niet; een levend besluit wel', () => {
  const bestand = path.join(map(), 's.json');
  fs.writeFileSync(bestand, JSON.stringify({ formaat: FORMAAT, versie: 2, standen: { 'geld.inkomend': { stand: 'enabled', wie: 'user-1', sinds: 'x', reden: 'r' } },
    besluiten: { 'emoney.b3': { wie: 'user-1', sha256: SHA, ingetrokken: { wie: 'user-2' } }, 'provider.stripe': { wie: 'user-1', sha256: SHA } },
    geschiedenis: [] }));
  const st = maakStand({ bestand });
  assert.equal(st.besluit('emoney.b3'), null);
  assert.equal(st.besluit('provider.stripe').wie, 'user-1');
  assert.deepEqual(st.standVan('geld.inkomend'), { stand: 'enabled', wie: 'user-1', sinds: 'x', reden: 'r', versie: 2 });
});

test('muteer: een werk dat niets of een weigering teruggeeft schrijft niets en verhoogt de versie niet', () => {
  const bestand = path.join(map(), 's.json');
  const st = maakStand({ bestand });
  assert.deepEqual(st.muteer(undefined, () => null), { ok: false, status: 400, error: 'Geen wijziging.' });
  assert.deepEqual(st.muteer(null, () => ({ ok: false, status: 418, error: 'nee' })), { ok: false, status: 418, error: 'nee' });
  assert.equal(fs.existsSync(bestand), false);
  assert.equal(fs.existsSync(bestand + '.slot'), false, 'het slot is opgeruimd');
  const ja = st.muteer(0, s => { s.standen['geld.inkomend'] = { stand: 'suspended' }; return { ok: true }; });
  assert.deepEqual(ja, { versie: 1, ok: true });
  assert.equal(st.standVan('geld.inkomend').stand, 'suspended');
  /* Een verwachte versie die niet klopt: botsing, met de echte versie erbij. */
  const b = st.muteer('7', () => ({ ok: true }));
  assert.equal(b.reden, 'botsing');
  assert.equal(b.versie, 1);
  assert.equal(st.muteer('1', () => ({ ok: true })).versie, 2, 'een versie als tekst telt als getal');
});

test('muteer op een kapot bestand: zonder "herstel" een weigering, met "herstel" een nieuw bestand boven de hoogste versie', () => {
  const bestand = path.join(map(), 's.json');
  const st = maakStand({ bestand });
  for (let i = 0; i < 3; i++) st.muteer(undefined, () => ({ ok: true }));
  assert.equal(st.lees().staat.versie, 3);
  fs.writeFileSync(bestand, '{ kapot');
  const nee = st.muteer(undefined, () => ({ ok: true }));
  assert.equal(nee.reden, 'configuratiefout');
  assert.equal(nee.status, 409);
  const ja = st.muteer('herstel', s => { assert.deepEqual(s.standen, {}); return { ok: true, hersteld: true }; });
  assert.deepEqual(ja, { versie: 4, ok: true, hersteld: true });
  assert.equal(keur(JSON.parse(fs.readFileSync(bestand, 'utf8'))).versie, 4);
});

test('een slot van een levende schrijver houdt een tweede schakeling tegen met een 409', () => {
  const bestand = path.join(map(), 's.json');
  fs.writeFileSync(bestand + '.slot', 'bezig');
  const st = maakStand({ bestand });
  const r = st.muteer(undefined, () => { throw new Error('mag niet draaien'); });
  assert.deepEqual(r, { ok: false, status: 409, reden: 'slot', error: 'Een andere schakeling is nog bezig; probeer het zo opnieuw.' });
  assert.equal(fs.readFileSync(bestand + '.slot', 'utf8'), 'bezig', 'het slot van de ander blijft staan');
});

test('een slot dat om een andere reden niet te maken is, gooit door in plaats van stil te wachten', () => {
  const d = map();
  const bestand = path.join(d, 'x'.repeat(252));   // met ".slot" erachter te lang voor een bestandsnaam
  const st = maakStand({ bestand });
  assert.throws(() => st.muteer(undefined, () => ({ ok: true })), e => e.code === 'ENAMETOOLONG');
});

test('keur: iedere vormfout heeft een eigen weigering, en een goed bestand komt ongewijzigd terug', () => {
  const goed = () => ({ formaat: FORMAAT, versie: 0, standen: {}, besluiten: {}, geschiedenis: [] });
  assert.deepEqual(keur(goed()), goed());
  const geval = [
    [null, /onbekend formaat/],
    [Object.assign(goed(), { formaat: 'v0' }), /onbekend formaat/],
    [Object.assign(goed(), { beschikbaar: true }), /onbekend veld "beschikbaar" in het standbestand/],
    [Object.assign(goed(), { versie: -1 }), /versie ongeldig/],
    [Object.assign(goed(), { versie: 1.5 }), /versie ongeldig/],
    [Object.assign(goed(), { standen: [] }), /standen ongeldig/],
    [Object.assign(goed(), { standen: null }), /standen ongeldig/],
    [Object.assign(goed(), { standen: { 'geld.a': null } }), /stand van geld\.a ongeldig/],
    [Object.assign(goed(), { standen: { 'geld.a': [] } }), /stand van geld\.a ongeldig/],
    [Object.assign(goed(), { standen: { 'geld.a': { stand: 'enabled', verified: true } } }), /onbekend veld "verified" in de stand van geld\.a/],
    [Object.assign(goed(), { standen: { 'geld.a': { stand: 'aan' } } }), /onbekende stand "aan" bij geld\.a/],
    [Object.assign(goed(), { besluiten: [] }), /besluiten ongeldig/],
    [Object.assign(goed(), { besluiten: 'x' }), /besluiten ongeldig/],
    [Object.assign(goed(), { besluiten: { verzonnen: { wie: 'u', sha256: SHA } } }), /onbekend besluit verzonnen/],
    [Object.assign(goed(), { besluiten: { 'emoney.b3': null } }), /besluit emoney\.b3 ongeldig/],
    [Object.assign(goed(), { besluiten: { 'emoney.b3': [] } }), /besluit emoney\.b3 ongeldig/],
    [Object.assign(goed(), { besluiten: { 'emoney.b3': { wie: 'u', sha256: SHA, available: 1 } } }), /onbekend veld "available" in het besluit emoney\.b3/],
    [Object.assign(goed(), { besluiten: { 'emoney.b3': { wie: 1, sha256: SHA } } }), /besluit emoney\.b3 ongeldig/],
    [Object.assign(goed(), { besluiten: { 'emoney.b3': { wie: 'u', sha256: 'kort' } } }), /besluit emoney\.b3 ongeldig/],
    [Object.assign(goed(), { besluiten: { 'emoney.b3': { wie: 'u' } } }), /besluit emoney\.b3 ongeldig/],
    [Object.assign(goed(), { geschiedenis: {} }), /geschiedenis ongeldig/]
  ];
  for (const [obj, fout] of geval) assert.throws(() => keur(obj), fout, String(fout));
});

test('een vormfout in het bestand maakt het geheel ongeldig voor iedere lezer', () => {
  const bestand = path.join(map(), 's.json');
  fs.writeFileSync(bestand, JSON.stringify({ formaat: FORMAAT, versie: 1, standen: {}, besluiten: {}, geschiedenis: 'nee' }));
  const st = maakStand({ bestand });
  assert.deepEqual(st.standVan('geld.inkomend'), { fout: 'geschiedenis ongeldig' });
  assert.equal(st.besluit('emoney.b3'), null);
});
