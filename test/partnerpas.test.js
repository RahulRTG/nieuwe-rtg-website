/* De toegangseis voor nieuwe partners: een partnerplek vraag je aan ALS LID,
   met een ZAKELIJKE pas. Het kantoor geeft ook alleen een code uit bij een
   aanvraag met ledenbewijs.

   HIER STOND "ELKE PAS TELT", EN DAT IS OP 20 AUGUSTUS 2026 VERVANGEN. De
   redenering eronder klopte wel: de poort eiste toen DE Business Pass, en die
   is sinds de ladder vanaf 5.000 euro per maand -- dus sloot hij het restaurant
   met acht man buiten, precies de klant die MARKT.md als ingang aanwijst. Het
   antwoord daarop was eerst "dan telt elke pas", en dat was twee dagen later
   niet meer nodig: COMMERCIE.md 3b maakt RTG Business Lite (150 euro) de
   partnerpoort, en dat is de trede die er speciaal voor is. De poort vraagt
   sindsdien de capability `can_be_partner` en geen pas-id, zodat een volgende
   trede zichzelf niet opnieuw buitensluit.

   Een consumentenpas is dus geen bedrijf. Wie helemaal geen pas heeft, komt er
   nog steeds niet in -- die regel is niet veranderd.
   Draai: node --experimental-sqlite --test test/partnerpas.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pp-'));
let child, businessToken, rtgToken, gastToken, officeToken, eigenaarToken;
let partnerCode, partnerPin;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();
const aanvraag = extra => Object.assign({
  company: 'Bodega Norte', type: 'restaurant', city: 'Ibiza',
  contactName: 'Pep Serra', email: 'pep@bodeganorte.example', akkoord: true
}, extra);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  businessToken = (await json(await api('/api/login', { username: 'Rahul', password: 'Imran' }))).token;
  rtgToken = (await json(await api('/api/login', { tier: 'rtg' }))).token;
  gastToken = (await json(await api('/api/login', { tier: 'guest' }))).token;
  officeToken = (await json(await api('/api/office/login', { code: 'RTG-OFFICE' }))).token;
  eigenaarToken = (await json(await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('zonder pas geen aanvraag (en dus geen code)', async () => {
  const kaal = await api('/api/partner/apply', aanvraag());
  assert.equal(kaal.status, 403);
  assert.match((await kaal.json()).error, /pas|lid/i);
  // en een verzonnen token opent de deur evenmin
  const nep = await api('/api/partner/apply', aanvraag({ passToken: 'zomaar-wat' }));
  assert.equal(nep.status, 403);
  /* EN DE GRATIS LAAG, met een ECHTE sessie. Dit geval is het enige dat de
     paseis zelf meet: zonder token valt de aanvraag al af op "geen sessie", dus
     een eis die iedereen toelaat zou hierboven niets veranderen. Deze aanvrager
     is wel binnen, alleen zonder pas. */
  assert.ok(gastToken, 'de gratis laag kan inloggen');
  const gast = await api('/api/partner/apply', aanvraag({ company: 'Gast Onderneming', passToken: gastToken }));
  assert.equal(gast.status, 403, 'een ingelogde gast zonder pas komt er niet in');
});

test('een consumentenpas is geen bedrijf: de partnerpoort vraagt een zakelijke trede', async () => {
  const rtg = await api('/api/partner/apply', aanvraag({ company: 'Casa Marisol', passToken: rtgToken }));
  assert.equal(rtg.status, 403, 'een RTG Pass is een persoonlijke pas en geen zaak');
  const uit = await json(rtg);
  assert.match(String(uit.error || ''), /zakelijke pas/,
    'en de weigering zegt WELKE pas het wel doet, anders is 403 een doodlopende weg');
  const st = await json(await api('/api/office/state', {}, officeToken));
  const a = (st.state.partnerApplications || []).find(x => x.company === 'Casa Marisol');
  assert.equal(a, undefined, 'een geweigerde aanvraag hoort ook niet stil op het kantoor te landen');
});

test('met Business Pass: aanvraag met ledenbewijs, en het kantoor geeft de code uit', async () => {
  const ok = await api('/api/partner/apply', aanvraag({ passToken: businessToken }));
  assert.equal(ok.status, 200);
  // het kantoor ziet de aanvraag met het ledenbewijs en keurt goed
  const st = await json(await api('/api/office/state', {}, officeToken));
  const a = (st.state.partnerApplications || []).find(x => x.company === 'Bodega Norte');
  assert.ok(a && a.pas && a.pas.tier === 'business', 'het ledenbewijs zit op de aanvraag');
  assert.equal((await api('/api/office/partner/decide', { id: a.id, action: 'goedkeuren' }, officeToken)).status, 403,
    'de gedeelde kantoordeur mag geen partners toelaten');
  const besluit = await json(await api('/api/office/partner/decide', { id: a.id, action: 'goedkeuren' }, eigenaarToken));
  assert.ok(besluit.code || besluit.ok, 'goedkeuren levert een bedrijfscode op');
  partnerCode = besluit.code; partnerPin = besluit.pin;
});

test('partner schorsen trekt bestaande toegang onmiddellijk in', async () => {
  const roster = await json(await api('/api/supplier/roster', { code: partnerCode }));
  const manager = roster.staff.find(x => x.role === 'manager');
  const login = await json(await api('/api/supplier/login', { code: partnerCode, staffId: manager.id, pin: partnerPin }));
  assert.ok(login.token, 'de nieuwe manager kan voor schorsing naar binnen');
  const stop = await api('/api/office/partner/status', { code: partnerCode, status: 'geschorst', reden: 'Geautomatiseerde toegangstest' }, eigenaarToken);
  assert.equal(stop.status, 200);
  assert.equal((await api('/api/supplier/state', {}, login.token)).status, 401, 'bestaande sessie is ingetrokken');
  assert.equal((await api('/api/supplier/login', { code: partnerCode, staffId: manager.id, pin: partnerPin })).status, 403, 'nieuwe toegang blijft dicht');
  assert.equal((await api('/api/office/partner/status', { code: partnerCode, status: 'actief' }, eigenaarToken)).status, 200, 'boardroom kan een schorsing gecontroleerd opheffen');
});
