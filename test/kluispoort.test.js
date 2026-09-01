/* ============================================================================
   DE KLUISPOORT -- een gedeelde code komt niet in de identiteitskluis.

   WAT HIER MISGING, EN WAAROM HET GEEN KLEINE FOUT WAS. /api/office/login geeft
   een backoffice-sessie op een GEDEELDE code. Die sessie draagt geen sleutel:
   de server weet dat er iemand van kantoor werkt, niet wie. Tot nu toe droeg
   diezelfde naamloze sessie de zwaarste handelingen die dit huis kent -- een
   paspoortscan beoordelen, nationaliteit en geboortedatum vastleggen, het
   nummer van een BIG-registratie openen.

   Het inzagejournaal was daar eerlijk over ("backoffice (gedeelde code)"), maar
   onder dat journaal ligt een hashketen. Dan staat er onwijzigbaar "iemand van
   kantoor" bij een besluit waar een mens naar een document heeft gekeken, en
   een spoor dat niet naar een mens leidt is geen spoor.

   Dit huis heeft die redenering al een keer gemaakt en opgeschreven, bij het
   pasbesluit: "een gedeelde code is geen mens" (test/helper.js, elevateTier).
   Deze toets trekt hem door naar de kluisdeuren.

   DE MUTATIES VOOR DIT BESTAND, elk een keer gedraaid en zien zakken:
     1. zet in kern/kantoor/kluispoort.js de lidKey-eis uit (altijd next())
        -> "de gedeelde code komt niet door de kluisdeur" zakt;
     2. zet /api/office/verify terug op officeAuth
        -> "het KYC-besluit staat achter de kluispoort" zakt;
     3. laat wiekijkt.js req.kantoorKey negeren
        -> "het journaal noemt de sleutel van wie keek" zakt.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const CODE = 'KANTOOR-KLUISPOORT';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kluispoort-'));
let BASE, srv, gedeeld, opNaam;

const post = async (pad, lijf, tok) => {
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers.Authorization = 'Bearer ' + tok;
  const r = await fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(lijf || {}) });
  let data = null; try { data = await r.json(); } catch (e) {}
  return { status: r.status, data };
};

/* Het inzagejournaal uit de bron lezen, net als test/kycspoor.test.js doet. */
const inzage = () => {
  try { return JSON.parse(fs.readFileSync(path.join(TMP, 'db.json'), 'utf8')).inzageLog || []; }
  catch (e) { return []; }
};

let teller = 0;
async function nieuwLid() {
  const email = 'kluis' + Date.now() + (++teller) + '@voorbeeld.test';
  const r = await post('/api/auth/register', { name: 'Kluis Lid ' + teller, email,
    password: 'geheim123', geboortedatum: '1990-03-03', pasApp: 'rtg' });
  assert.ok(r.data && r.data.token, 'het proeflid moet bestaan');
  return r.data.state.user.id;
}

test.before(async () => {
  srv = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_STORE: 'json', OFFICE_CODE: CODE } });
  BASE = srv.base;
  const o = await post('/api/office/login', { code: CODE });
  assert.ok(o.data && o.data.token, 'de gedeelde code hoort gewoon binnen te komen');
  gedeeld = o.data.token;
  opNaam = await kantoorAlsPersoon(BASE, CODE);
  assert.ok(opNaam, 'een kantoorsessie op naam moet te krijgen zijn');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('de gedeelde code komt niet door de kluisdeur, en hoort waarom', async () => {
  const r = await post('/api/office/verifications', {}, gedeeld);
  assert.equal(r.status, 403);
  assert.equal(r.data.poort, 'kluis');
  assert.match(r.data.error, /op naam/i);
  /* Een dichte deur zonder de weg erheen is een muur. */
  assert.equal(r.data.watNu, 'inloggen-op-naam');
});

test('het KYC-besluit staat achter de kluispoort', async () => {
  const id = await nieuwLid();
  const r = await post('/api/office/verify', { userId: id, decision: 'approve' }, gedeeld);
  assert.equal(r.status, 403, 'een gedeelde code mag geen identiteit goedkeuren');
  assert.equal(r.data.poort, 'kluis');
});

test('het gewone kantoorwerk blijft gewoon werken met de gedeelde code', async () => {
  /* DE HELFT DIE NIET MAG SNEUVELEN. De reparatie verkleint wat een naamloze
     sessie MAG; hij sluit de deur niet. Orders, ritten en meldingen zijn het
     dagelijkse werk van dit kantoor en horen niet stil te vallen voor een
     reparatie aan een andere deur. */
  const r = await post('/api/office/state', {}, gedeeld);
  assert.equal(r.status, 200);
  assert.ok(r.data && r.data.state, 'het overzicht hoort er gewoon te zijn');
});

test('op naam komt hij er wel door, en het journaal noemt de sleutel van wie keek', async () => {
  const id = await nieuwLid();
  const voor = inzage().length;
  const r = await post('/api/office/verify', { userId: id, decision: 'approve' }, opNaam);
  assert.equal(r.status, 200, JSON.stringify(r.data).slice(0, 200));
  /* WACHTEN OP DE TOESTAND, NIET OP DE KLOK. Hier stond een vaste 400 ms voor
     het journaal dat na het besluit wordt weggeschreven. Een vaste tijd meet
     twee dingen tegelijk -- of de regel er komt, en of de machine vrij was --
     en op een volle runner zakt hij zonder dat er iets mis is. Vandaar: kijken
     tot de regel er is, met een plafond zodat een uitblijvende regel de toets
     nog steeds laat zakken (en niet laat hangen). */
  const tot = Date.now() + 10000;
  while (inzage().length <= voor && Date.now() < tot) {
    await new Promise(z => setImmediate(z));
  }

  const na = inzage();
  assert.ok(na.length > voor, 'het besluit hoort een regel op te leveren');
  const regel = na[0];
  assert.equal(regel.overId, String(id));
  /* DE KERN VAN DE HELE REPARATIE. Hier stond tot nu toe "backoffice (gedeelde
     code)"; nu staat er een sleutel die naar een mens terugvoert. Een sleutel
     en geen naam: de kluis gaat hier niet open om op te schrijven wie er keek. */
  const wie = JSON.stringify(regel);
  assert.doesNotMatch(wie, /gedeelde code/, 'een besluit op naam mag niet als gedeelde code in het boek staan');
  assert.match(wie, /user-\d+|kantoor op naam/, 'het spoor moet naar een mens terug te voeren zijn');
});

test('de poort hangt op alle kluisdeuren en niet alleen op de eerste', async () => {
  /* Een grens die maar op een van de vier deuren staat, is geen grens: wie de
     ene dicht vindt, probeert de volgende. */
  for (const pad of ['/api/office/verifications', '/api/office/verify',
    '/api/office/vakbewijs/nummer', '/api/office/vakbewijs/teken', '/api/office/vakbewijs/intrek']) {
    const r = await post(pad, {}, gedeeld);
    assert.equal(r.status, 403, pad + ' liet de gedeelde code door');
    assert.equal(r.data.poort, 'kluis', pad + ' weigerde om een andere reden');
  }
});
