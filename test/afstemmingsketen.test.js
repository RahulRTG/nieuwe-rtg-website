/* ============================================================================
   DE AFSTEMMING DOOR DE GELDKETEN -- over een echte server, met echt geld.

   Een uitbetaling met onbekende uitkomst (MONEY-012) wordt afgestemd op een
   afschriftregel: een kantoormens neemt hem over, een tweede mens tekent af, en
   bij `niet-uitgevoerd` komt het geld terug op de rekening van het lid. Sinds 11
   oktober 2026 loopt dat door kern/kantoor/geldketen.js, met een passkey bij
   BEIDE handtekeningen (besluit eigenaar 25 september 2026).

   DE FIXTURE. Een opdracht komt alleen op ONBEKEND als de rail na het versturen
   blijft zwijgen, en de testrail antwoordt altijd. Dus: het lid stuurt een echte
   SEPA-overboeking (het geld staat dan echt van zijn rekening af en de opdracht op
   INGEDIEND), de server stopt, de STAND van die ene opdracht gaat in de opslag op
   ONBEKEND -- precies wat de rij zelf doet na de laatste stille poging
   (kern/betaalopdracht/inzending.js) -- en de server start op dezelfde data. Het
   grootboek wordt niet aangeraakt; daar staat het geld al vast.

   WAT DIT BEWIJST
     1. zonder passkey komt de aanvraag er niet door, en laat hij niets achter;
     2. met passkey staat er een voornemen met dossier, en er beweegt nog niets;
     3. de aanvrager tekent zijn eigen afstemming niet af;
     4. de tweede mens tekent met passkey af en het geld komt PRECIES een keer terug;
     5. een tweede aanvraag op dezelfde opdracht wordt geweigerd (hij is niet meer ONBEKEND);
     6. het dossier zegt eerlijk dat de keten NIET rond is, met `atomair` open.
   Draai los: node --test test/afstemmingsketen.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { startServer, stop, stopNet, kantoorKoppelBody } = require('./helper');
const { kantoorPasskey } = require('./kantoorpasskey');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-afstemketen-'));
const CODE = 'KANTOOR-AFSTEM-1';
const ENV = { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE };
let srv, base;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const uniek = (n) => (Date.now() + n * 7919).toString(36) + n;
async function registreer(n, naam) {
  const u = uniek(n);
  const r = await api('/api/auth/register', { name: naam, email: 'af' + u + '@voorbeeld.test',
    phone: '06' + String(10000000 + Math.floor(Math.random() * 8e7)), password: 'Geheim123!',
    geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(r.body.token, naam + ' geregistreerd');
  return r.body.token;
}
async function medewerker(n) {
  const lid = await registreer(n, 'Bankmens ' + n);
  const kop = await api('/api/account/koppel', await kantoorKoppelBody(base, lid), lid);
  assert.equal(kop.status, 200, 'medewerker ' + n + ' koppelt de kantoorrol');
  const start = await api('/api/account/start', { rol: 'kantoor' }, lid);
  assert.ok(start.body.token, 'medewerker ' + n + ' staat op naam in de backoffice');
  return { lid, kantoor: start.body.token };
}

/* De stand van EEN opdracht in de opslag zetten, met de server uit. */
function zetStand(id, stand) {
  const bestand = fs.readdirSync(TMP).find(f => f.endsWith('.db') && /store/.test(f)) || 'store.db';
  const db = new DatabaseSync(path.join(TMP, bestand));
  try {
    const rij = db.prepare('SELECT val, ver FROM kv WHERE key = ?').get('betaalOpdrachten');
    assert.ok(rij && rij.val, 'de betaalopdrachten staan in de opslag (' + bestand + ')');
    const lijst = JSON.parse(rij.val);
    const o = lijst.find(x => x.id === id);
    assert.ok(o, 'de opdracht staat in de opslag');
    o.status = stand; o.misschienVerstuurd = true; o.volgendeAt = null;
    db.prepare('UPDATE kv SET val = ?, ver = ? WHERE key = ?').run(JSON.stringify(lijst), rij.ver + 1, 'betaalOpdrachten');
  } finally { db.close(); }
}

let lid, iban, opdrachtId, opdracht2, A, B, pk, sleutelA, sleutelB;

test.before(async () => {
  srv = await startServer({ env: ENV });
  base = srv.base;
  const gedeeld = (await api('/api/office/login', { code: CODE })).body.token;
  assert.equal((await api('/api/office/bank/leden', { aan: true, naam: 'RTG' }, gedeeld)).status, 200, 'de leden-bank staat live');
  lid = await registreer(1, 'Rekeninghouder');
  const akk = await api('/api/bank/akkoord', {}, lid);
  assert.equal(akk.status, 200, 'het lid opent een rekening: ' + JSON.stringify(akk.body).slice(0, 140));
  iban = akk.body.rekening.iban;
  const stort = await api('/api/bank/storten', { iban, centen: 5000, idem: 'afst-stort' }, lid);
  assert.equal(stort.status, 200, 'storten: ' + JSON.stringify(stort.body).slice(0, 140));
  const uit = await api('/api/bank/sepa', { iban, centen: 1500, naarIban: 'NL91ABNA0417164300',
    begunstigde: 'Ontvanger', oms: 'Afstemketen', idem: 'afst-sepa' }, lid);
  assert.equal(uit.status, 200, 'de SEPA-overboeking: ' + JSON.stringify(uit.body).slice(0, 160));
  opdrachtId = uit.body.opdrachtId;
  assert.ok(opdrachtId, 'er is een betaalopdracht');
  const uit2 = await api('/api/bank/sepa', { iban, centen: 700, naarIban: 'NL91ABNA0417164300',
    begunstigde: 'Ontvanger', oms: 'Afstemketen twee', idem: 'afst-sepa-2' }, lid);
  opdracht2 = uit2.body.opdrachtId;
  assert.ok(opdracht2, 'er is een tweede betaalopdracht');

  // de rail zwijgt: herstart op dezelfde data met de opdracht op ONBEKEND
  await stopNet(srv.child);   // netjes: de opslag is dicht voordat hij wordt gelezen
  zetStand(opdrachtId, 'ONBEKEND');
  zetStand(opdracht2, 'ONBEKEND');
  srv = await startServer({ env: ENV });
  base = srv.base;

  A = await medewerker(2);
  B = await medewerker(3);
  pk = kantoorPasskey(base);
  sleutelA = await pk.zet(A.lid);
  sleutelB = await pk.zet(B.lid);
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

const saldo = async () => Number((await api('/api/bank/rekening', { iban }, lid)).body.rekening.saldoCenten);
const LIJF = () => ({ id: opdrachtId, uitspraak: 'niet-uitgevoerd', bron: 'afschrift 11-10, regel 4' });

test('de afstemming loopt de geldketen: passkey, voornemen, vier ogen, en het geld komt een keer terug', async () => {
  const open = async () => (await api('/api/office/bank/handtekening/open', {}, B.kantoor)).body.aanvragen.length;
  const voorOpen = await open();
  const saldoVoor = await saldo();

  // 1. zonder passkey niet -- en er blijft geen aanvraag staan
  const kaal = await api('/api/office/bank/opdrachten/afstemming', LIJF(), A.kantoor);
  assert.ok(kaal.status === 401 || kaal.status === 403, 'zonder passkey door de aanvraag: ' + kaal.status);
  assert.equal(await open(), voorOpen, 'een geweigerde aanvraag liet iets achter om af te tekenen');

  // 2. met passkey: een voornemen met dossier, en er beweegt nog niets
  const cer = await pk.ceremonie(sleutelA, '/api/office/bank/afstemming/opties', { id: opdrachtId, uitspraak: 'niet-uitgevoerd' }, A.kantoor);
  const r = await api('/api/office/bank/opdrachten/afstemming', { ...LIJF(), ...cer }, A.kantoor);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 240));
  assert.equal(r.body.needsAuth, true, 'de afstemming wacht op een tweede mens');
  assert.ok(r.body.voornemen && r.body.voornemen.id, 'er staat een voornemen');
  assert.equal(r.body.vooruitblik.uitkomst, 'NIET_UITGEVOERD');
  assert.ok(r.body.vooruitblik.bedragCenten >= 1500, 'de vooruitblik noemt het bedrag dat terugkomt');
  const assen = Object.fromEntries((r.body.dossier.assen || []).map(a => [a.as, a]));
  for (const as of ['mensbewijs', 'assurance', 'mandaat', 'streefstand', 'tegenfeit', 'voornemen',
    'autoriteit', 'envelop', 'bewijsketen', 'idempotentie', 'atomair'])
    assert.ok(assen[as], 'de as "' + as + '" staat niet in het dossier');
  assert.equal(assen.assurance.graad, 'bewezen', 'de aanvraag is met een passkey bevestigd');
  assert.equal(assen.mandaat.uitslag, 'niet zelfstandig', 'geld is nooit autonoom');
  assert.equal(await saldo(), saldoVoor, 'de aanvraag heeft al geld teruggeboekt');

  // 3. niet zichzelf
  const hand = (sl, wie) => pk.ceremonie(sl, '/api/office/bank/handtekening/opties', { id: r.body.aanvraag.id }, wie);
  const zelf = await api('/api/office/bank/handtekening/bevestig', { id: r.body.aanvraag.id, ...(await hand(sleutelA, A.kantoor)) }, A.kantoor);
  assert.equal(zelf.status, 403, 'de aanvrager tekende zijn eigen afstemming af');

  // ... en de tweede handtekening vraagt nu ook een passkey (bank.afstemming is `geld`)
  const zonder = await api('/api/office/bank/handtekening/bevestig', { id: r.body.aanvraag.id }, B.kantoor);
  assert.ok(zonder.status === 401 || zonder.status === 403, 'tekenen zonder passkey ging door: ' + zonder.status);
  assert.equal(await saldo(), saldoVoor);

  // 4. de tweede mens tekent af: het geld komt terug, een keer
  const ok = await api('/api/office/bank/handtekening/bevestig', { id: r.body.aanvraag.id, ...(await hand(sleutelB, B.kantoor)) }, B.kantoor);
  assert.equal(ok.status, 200, JSON.stringify(ok.body).slice(0, 240));
  assert.equal(ok.body.uitkomst, 'NIET_UITGEVOERD');
  const terug = (await saldo()) - saldoVoor;
  assert.ok(terug >= 1500 && terug <= r.body.vooruitblik.bedragCenten,
    'het geld kwam niet (precies) terug: +' + terug + ' tegen een bovengrens van ' + r.body.vooruitblik.bedragCenten);

  // 5. nog een keer kan niet: de opdracht is niet meer ONBEKEND, en er komt niets bij
  const cer2 = await pk.ceremonie(sleutelA, '/api/office/bank/afstemming/opties', { id: opdrachtId, uitspraak: 'niet-uitgevoerd' }, A.kantoor);
  const nog = await api('/api/office/bank/opdrachten/afstemming', { ...LIJF(), ...cer2 }, A.kantoor);
  assert.equal(nog.status, 409, 'een tweede afstemming werd aangenomen: ' + JSON.stringify(nog.body).slice(0, 160));
  assert.equal((await saldo()) - saldoVoor, terug, 'er kwam een tweede keer geld terug');

  // 6. het dossier: alle assen gelopen behalve atomair, en dat zegt het
  const dos = await api('/api/office/bank/incasso/dossier', { voornemen: r.body.voornemen.id }, B.kantoor);
  assert.equal(dos.status, 200, JSON.stringify(dos.body).slice(0, 160));
  console.log('# open assen na de uitvoering: ' + (dos.body.dossier.open || []).join(', '));
  assert.equal(dos.body.dossier.rond, false, 'de keten heet rond terwijl de uitvoering niet atomair is');
  assert.ok((dos.body.dossier.open || []).includes('atomair'), 'atomair staat niet open: ' + (dos.body.dossier.open || []).join(', '));
  const da = Object.fromEntries(dos.body.dossier.assen.map(a => [a.as, a]));
  assert.ok(da.uitvoering && da.uitvoering.graad === 'gemeten', 'de uitvoering ging door de baan');
  assert.ok(da.tweedeMens && da.tweedeMens.uitslag && da.tweedeMens.uitslag !== da.mensbewijs.wie,
    'de tweede mens staat in het dossier en is een ander dan de aanvrager');
});

/* Een VERSCHIL laat de opdracht op ONBEKEND staan. Daarna moet een correctie met de
   juiste gegevens nog door kunnen -- dat kon voor de geldketen, en de eerste versie
   van deze baan sloot het af (dezelfde economische sleutel gaf het oude, al
   uitgevoerde voornemen terug). */
test('na een VERSCHIL kan dezelfde opdracht alsnog worden BEVESTIGD, en een ceremonie dekt geen andere uitspraak', async () => {
  const doe = async (lijf) => {
    const c = await pk.ceremonie(sleutelA, '/api/office/bank/afstemming/opties', { id: opdracht2, uitspraak: lijf.uitspraak }, A.kantoor);
    const r = await api('/api/office/bank/opdrachten/afstemming', { id: opdracht2, bron: 'afschrift 11-10', ...lijf, ...c }, A.kantoor);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
    const h = await pk.ceremonie(sleutelB, '/api/office/bank/handtekening/opties', { id: r.body.aanvraag.id }, B.kantoor);
    return { r, ok: await api('/api/office/bank/handtekening/bevestig', { id: r.body.aanvraag.id, ...h }, B.kantoor) };
  };

  // zonder referentie van de rail weigert de vooruitblik al, VOOR de passkey en zonder ticket
  const zonderRef = await api('/api/office/bank/opdrachten/afstemming',
    { id: opdracht2, uitspraak: 'uitgevoerd', centen: 700, valuta: 'eur', bron: 'afschrift' }, A.kantoor);
  assert.equal(zonderRef.status, 400, 'zonder providerRef: ' + JSON.stringify(zonderRef.body).slice(0, 140));

  // een ceremonie voor `uitgevoerd` draagt geen `niet-uitgevoerd`
  const cU = await pk.ceremonie(sleutelA, '/api/office/bank/afstemming/opties', { id: opdracht2, uitspraak: 'uitgevoerd' }, A.kantoor);
  const verkeerd = await api('/api/office/bank/opdrachten/afstemming',
    { id: opdracht2, uitspraak: 'niet-uitgevoerd', bron: 'afschrift', ...cU }, A.kantoor);
  assert.ok([400, 401, 403].includes(verkeerd.status), 'een ceremonie voor een andere uitspraak werd aangenomen: ' + verkeerd.status + ' ' + JSON.stringify(verkeerd.body).slice(0, 160));

  // ronde 1: een ander bedrag -- VERSCHIL, er gebeurt niets met het geld
  const een = await doe({ uitspraak: 'uitgevoerd', centen: 699, valuta: 'eur', providerRef: 'po_proef_1' });
  assert.equal(een.ok.status, 200, JSON.stringify(een.ok.body).slice(0, 200));
  assert.equal(een.ok.body.uitkomst, 'VERSCHIL');

  // ronde 2: het juiste bedrag -- een NIEUW voornemen, en BEVESTIGD
  const twee = await doe({ uitspraak: 'uitgevoerd', centen: 700, valuta: 'eur', providerRef: 'po_proef_1' });
  assert.notEqual(twee.r.body.voornemen.id, een.r.body.voornemen.id, 'de correctie kreeg het oude voornemen terug');
  assert.equal(twee.ok.status, 200, 'de correctie liep vast: ' + JSON.stringify(twee.ok.body).slice(0, 200));
  assert.equal(twee.ok.body.uitkomst, 'BEVESTIGD');
});
