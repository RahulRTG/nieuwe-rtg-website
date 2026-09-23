/* RTG Werk OS: de uitgave met de STRENGSTE VAN TWEE TEKENGRENZEN en de
   BETAALWIJZE die de werkruimte kiest (AUTHORITY.md par. 5e, vervolg).

   Tegen een echte server, met echte RTG-accounts en een echte SEPA-opdracht:

   1. een bestuurder in de concerngraaf is een codenaam of uitdrukkelijk extern;
      een vrije naam wordt geweigerd;
   2. een werkruimte koppelt aan een entiteit alleen via een lid dat eigenaar van
      die entiteit is;
   3. de laagste grens wint: de tekenlimiet uit de concerngraaf houdt een
      goedkeuring tegen, en de werkruimtegrens ook als die lager is;
   4. via RTG Bank kan pas als RTG de weg aanzet (standaard uit), en dan toetst het
      Werk OS de SEPA-opdracht: van wie, hoeveel, naar welk IBAN;
   5. zet RTG de weg uit, dan valt de werkruimte terug op extern, met de reden.

   Draai los: node --test test/bedrijfuitgave-mix.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');

let BASE, child, EIG, BAAS;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uitgavemix-'));
const api = (pad, body, token) => fetch(BASE + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let W, B, FIN, DIR, CFO;
const LIDID = {};
let n = 0;
async function rtgAccount(naam) {
  n += 1;
  const u = (Date.now() + n * 7919).toString().slice(-8);
  const r = (await api('/api/auth/register', { name: naam, email: 'mix' + u + '@voorbeeld.test', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg', pasApp: 'rtg' })).body;
  const me = (await api('/api/auth/me', {}, r.token)).body;
  return { token: r.token, codenaam: me.user.codename };
}
async function lid(naam, rollen, rtg) {
  const a = (await api('/api/bedrijf/lid/aanmeld', { werkruimte: W, naam })).body;
  await api('/api/bedrijf/lid/besluit', { werkruimte: W, beheerToken: B, lidId: a.lidId, akkoord: true });
  await api('/api/bedrijf/lid/rollen', { werkruimte: W, beheerToken: B, lidId: a.lidId, rollen });
  const wie = { werkruimte: W, lidToken: a.lidToken };
  if (rtg) {
    const k = await api('/api/bedrijf/lid/koppel', wie, rtg.token);
    assert.equal(k.status, 200, 'het lid hangt aan zijn RTG-account: ' + JSON.stringify(k.body));
    Object.assign(wie, { rtg });
  }
  LIDID[a.lidToken] = a.lidId;
  return wie;
}
const bare = (wie) => ({ werkruimte: wie.werkruimte, lidToken: wie.lidToken });
const maak = (wie, bedrag, extra) => api('/api/bedrijf/uitgave/maak', Object.assign({ omschrijving: 'Servers',
  begunstigde: 'Hosting BV', bedrag }, extra || {}, bare(wie)));
const keur = (wie, id) => api('/api/bedrijf/keur', Object.assign({ soort: 'uitgave', id, recht: 'geld.goedkeuren' }, bare(wie)));

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  EIG = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  BAAS = (await api('/api/account/start', { rol: 'kantoor' }, EIG)).body.token;
  assert.ok(EIG && BAAS, 'de eigenaar en zijn kantoorsessie');
  const w = (await api('/api/bedrijf/werkruimte/maak', { naam: 'RTG Mix', land: 'NL' })).body;
  W = w.werkruimte; B = w.beheerToken;
  FIN = await lid('Fenna', ['financieel']);
  DIR = await lid('Diederik', ['directie'], await rtgAccount('Diederik Mix'));
  CFO = await lid('Chris', ['directie'], await rtgAccount('Chris Mix'));
});
test.after(() => {
  stop(child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1-3. codenaam in de concerngraaf, koppeling door de eigenaar, en de laagste grens wint', async () => {
  const ent = await api('/api/concern/entiteit/nieuw', { naam: 'Mix Holding BV', land: 'NL', rechtsvorm: 'bv' }, DIR.rtg.token);
  assert.equal(ent.status, 200, JSON.stringify(ent.body));
  const E = ent.body.entiteit.id;
  const feit = (b) => api('/api/concern/feit/zet', Object.assign({ entiteit: E, soort: 'bestuurder', waarde: 'directeur',
    bronSoort: 'mens' }, b), DIR.rtg.token);

  const vrij = await feit({ sleutel: 'marco' });
  assert.equal(vrij.status, 404, 'een vrije naam is geen bestuurder die een tekengrens kan dragen: ' + JSON.stringify(vrij.body));
  assert.equal((await feit({ sleutel: 'marco', extern: true })).status, 200, 'wel als iemand van buiten RTG');
  /* Een externe die toevallig dezelfde naam draagt als een lid, telt voor dat lid
     niet mee: de naam is niet door RTG herkend (extern: true). */
  assert.equal((await feit({ sleutel: DIR.rtg.codenaam, extern: true, extra: { bevoegd: 'alleen', tekenlimiet: 100 } })).status, 200);
  const cfo = await feit({ sleutel: CFO.rtg.codenaam.toLowerCase(), extra: { bevoegd: 'alleen', tekenlimiet: 300 } });
  assert.equal(cfo.status, 200, JSON.stringify(cfo.body));

  assert.equal((await api('/api/bedrijf/werkruimte/entiteit', Object.assign({ entiteitId: E }, bare(FIN)))).status, 403,
    'een lid zonder RTG-account koppelt niets');
  assert.equal((await api('/api/bedrijf/werkruimte/entiteit', Object.assign({ entiteitId: E }, bare(CFO)))).status, 404,
    'een lid dat niet de eigenaar van de entiteit is, koppelt hem niet');
  assert.equal((await api('/api/bedrijf/werkruimte/entiteit', { werkruimte: W, beheerToken: B, entiteitId: E })).status, 403,
    'het beheer-token ook niet');
  assert.equal((await api('/api/bedrijf/werkruimte/entiteit', Object.assign({ entiteitId: E }, bare(DIR)))).status, 200);

  const u = (await maak(FIN, 800)).body.uitgave;
  const cfoKeur = await keur(CFO, u.id);
  assert.equal(cfoKeur.status, 403, JSON.stringify(cfoKeur.body));
  assert.match(cfoKeur.body.error, /tekenlimiet van 300\.00/, 'de grens uit de concerngraaf');
  assert.equal((await keur(DIR, u.id)).status, 200,
    'wie niet als herkende bestuurder staat, keurt binnen de werkruimtegrens -- ook als een externe zijn naam draagt');

  await api('/api/bedrijf/lid/tekengrens', { werkruimte: W, beheerToken: B, lidId: LIDID[CFO.lidToken], bedrag: 200 });
  const klein = (await maak(FIN, 250)).body.uitgave;
  const lager = await keur(CFO, klein.id);
  assert.equal(lager.status, 403);
  assert.match(lager.body.error, /tekengrens van 200\.00 euro in deze werkruimte/, 'de lagere werkruimtegrens wint');
  await api('/api/bedrijf/lid/tekengrens', { werkruimte: W, beheerToken: B, lidId: LIDID[CFO.lidToken], bedrag: '' });
  assert.equal((await keur(CFO, klein.id)).status, 200, 'onder beide grenzen gaat het door');
});

test('4-5. via RTG Bank: pas als RTG hem aanzet, en de SEPA-opdracht wordt getoetst', async () => {
  const dicht = await api('/api/bedrijf/werkruimte/betaalwijze', Object.assign({ wijze: 'rtgbank' }, bare(DIR)));
  assert.equal(dicht.status, 409, 'standaard uit: ' + JSON.stringify(dicht.body));
  assert.equal((await api('/api/office/werkos/bankpad', {}, EIG)).body.aan, false);
  const aan = await api('/api/office/werkos/bankpad/zet', { aan: true }, EIG);
  assert.equal(aan.status, 200, JSON.stringify(aan.body));
  assert.equal((await api('/api/bedrijf/werkruimte/betaalwijze', Object.assign({ wijze: 'rtgbank' }, bare(DIR)))).status, 200);

  const IBAN = 'NL91ABNA0417164300';
  const u = (await maak(FIN, 125, { iban: 'nl91 abna 0417 1643 00' })).body.uitgave;
  assert.equal(u.iban, IBAN);
  assert.equal((await keur(DIR, u.id)).status, 200);

  // de bank: vergunning, leden-bank aan, en de CFO betaalt vanaf zijn eigen rekening
  assert.equal((await api('/api/office/bank/vergunning', { soort: 'bank', nummer: 'NL-TOETS-9', entiteit: 'RTG Bank N.V.', landen: ['NL'] }, BAAS)).status, 200);
  assert.equal((await api('/api/office/bank/leden', { aan: true }, BAAS)).body.ledenAan, true);
  const rek = (await api('/api/bank/akkoord', {}, CFO.rtg.token)).body.rekening.iban;
  await api('/api/bank/storten', { iban: rek, centen: 50000, idem: 'mix-stort' }, CFO.rtg.token);
  const sepa = await api('/api/bank/sepa', { iban: rek, centen: 12500, naarIban: IBAN, begunstigde: 'Hosting BV', idem: 'mix-1' }, CFO.rtg.token);
  assert.equal(sepa.status, 200, JSON.stringify(sepa.body));
  const scheef = await api('/api/bank/sepa', { iban: rek, centen: 9900, naarIban: IBAN, begunstigde: 'Hosting BV', idem: 'mix-2' }, CFO.rtg.token);

  const betaal = (wie, opdrachtId) => api('/api/bedrijf/uitgave/betaald', Object.assign({ id: u.id, opdrachtId }, bare(wie)));
  assert.equal((await betaal(CFO, 'BO000000000000')).status, 404, 'een opdracht die niet bestaat');
  assert.equal((await betaal(DIR, sepa.body.opdrachtId)).status, 403, 'een opdracht van een ander');
  const bedrag = await betaal(CFO, scheef.body.opdrachtId);
  assert.equal(bedrag.status, 409, 'een ander bedrag: ' + JSON.stringify(bedrag.body));
  assert.match(bedrag.body.error, /99\.00 euro/);
  const ok = await betaal(CFO, sepa.body.opdrachtId);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.uitgave.stand, 'betaald');
  assert.equal(ok.body.uitgave.betaald.via, 'rtgbank');
  assert.equal(ok.body.uitgave.betaald.kenmerk, sepa.body.opdrachtId);
  assert.match(ok.body.let, /SEPA-opdracht/, 'de bevestiging zegt hoe er betaald is, niet "buiten RTG"');

  const tweede = (await maak(FIN, 125, { iban: IBAN })).body.uitgave;
  await keur(DIR, tweede.id);
  const dubbel = await api('/api/bedrijf/uitgave/betaald', Object.assign({ id: tweede.id, opdrachtId: sepa.body.opdrachtId }, bare(CFO)));
  assert.equal(dubbel.status, 409, 'een opdracht betaalt een uitgave, niet twee');

  // RTG zet de weg uit: de werkruimte valt terug op extern, met de reden
  assert.equal((await api('/api/office/werkos/bankpad/zet', { aan: false }, EIG)).status, 200);
  const lijst = (await api('/api/bedrijf/uitgaven', bare(FIN))).body;
  assert.equal(lijst.betaalwijze.wijze, 'extern');
  assert.equal(lijst.betaalwijze.gekozen, 'rtgbank');
  assert.match(lijst.betaalwijze.reden, /uitgezet/);
  const extern = await api('/api/bedrijf/uitgave/betaald', Object.assign({ id: tweede.id, kenmerk: 'BANK-EXT' }, bare(CFO)));
  assert.equal(extern.status, 200, 'buiten RTG, met een kenmerk: ' + JSON.stringify(extern.body));
});

test('alleen de eigenaar zet de weg via RTG Bank aan, ook niet wie de boardroom in mag', async () => {
  const { kantoorKoppelBody } = require('./helper');
  assert.equal((await api('/api/office/boardroom/toegang/geef', { codenaam: DIR.rtg.codenaam }, EIG)).status, 200);
  assert.equal((await api('/api/account/koppel', await kantoorKoppelBody(BASE, DIR.rtg.token), DIR.rtg.token)).status, 200);
  const kantoor = (await api('/api/account/start', { rol: 'kantoor' }, DIR.rtg.token)).body.token;
  assert.equal((await api('/api/office/werkos/bankpad', {}, kantoor)).status, 200, 'lezen mag in de boardroom');
  const r = await api('/api/office/werkos/bankpad/zet', { aan: true }, kantoor);
  assert.equal(r.status, 403, JSON.stringify(r.body));
  assert.match(r.body.error, /Alleen de eigenaar/);
});
