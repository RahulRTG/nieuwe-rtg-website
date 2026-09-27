'use strict';
/* De HTTP-deur van RTG Academy (server/routes/leerhuis.js) tegen een ECHTE
   server -- LAT-regel 17: een nagemaakte app bewijst het handlergedrag en niet
   de montage of de deur.

   Wat hij bewijst, en wat hem laat zakken (met de hand nagetrokken):
     - de functie staat standaard UIT, en dicht is dicht       -> toets 1
       (zet `standaard: true` in cat-life2.js en hij zakt)
     - een leerhuis openen gaat alleen op naam, niet met de gedeelde code en
       niet via de ledendeur                                    -> toets 2
     - de actor komt uit de SESSIE: een veld `door` in het lijf verandert niets
       (laat de route `b.door` doorgeven en toets 4 zakt)        -> toets 4
     - zonder sleutel geen handeling, en dezelfde sleutel twee keer schrijft
       een keer (haal de sleutelregel uit de route en toets 3 zakt) -> toets 3
     - een certificaat alleen voor wie aantoonbaar 18+ is, leren voor iedereen
       met een relatie (haal de volwassenLid-regel weg en toets 5 zakt)
                                                                -> toets 5
     - een lid leest zijn eigen stand en niet het bestuursbeeld  -> toets 6

   Draai los: node --test test/leerhuis-routes.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, kantoorAlsPersoon, keurLidGoed } = require('./helper');

let BASE, child, E, N, X, office, eId, nId;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-leerhuis-'));
const ORG = 'RTG-OPS';

const post = (pad, body, tok, kop) => fetch(BASE + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}, kop || {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const codeVan = async (tok) => (await post('/api/state', {}, tok)).body.state.user.codename;
const doe = (tok, actie, invoer, sleutel, extra) => post('/api/leerhuis/doe', Object.assign({ org: ORG, actie, invoer, sleutel }, extra || {}), tok);
const lees = (tok, vraag, extra) => post('/api/leerhuis/lees', Object.assign({ org: ORG, vraag }, extra || {}), tok);

async function schakel(aan) {
  const login = (await post('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body;
  const vz = (await post('/api/techniek/functie', { id: 'leerhuis', aan }, login.token)).body;
  if (vz.status === 'wacht') assert.equal((await post('/api/techniek/functie/besluit', { verzoekId: vz.verzoekId }, login.token)).body.status, 'akkoord');
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const lid = async (naam, mail, tel, geboren) => (await post('/api/auth/register', { name: naam, email: mail,
    phone: tel, password: 'geheim12345', geboortedatum: geboren, tier: 'rtg' })).body.token;
  E = await lid('Eigenaar Leerhuis', 'lh-e@x.nl', '0612348001', '1980-02-02');
  N = await lid('Nieuwe Collega', 'lh-n@x.nl', '0612348002', '1995-05-05');
  X = await lid('Buiten Staander', 'lh-x@x.nl', '0612348003', '1990-09-09');
  eId = await keurLidGoed(BASE, E, await codeVan(E), '1980-02-02');
  nId = await keurLidGoed(BASE, N, await codeVan(N), '1995-05-05');
  office = await kantoorAlsPersoon(BASE, 'RTG-OFFICE');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de functie staat standaard uit: geen leerhuis tot een mens hem aanzet', async () => {
  const r = await lees(E, 'mijn');
  assert.notEqual(r.status, 200, 'de ledendeur hoort dicht te zijn: ' + JSON.stringify(r.body));
  const o = await post('/api/office/leerhuis/open', { id: ORG, soort: 'RTG', naam: 'Operations', eigenaar: 'user-' + eId }, office);
  assert.notEqual(o.status, 200, 'ook de kantoordeur is dicht zolang de functie uit staat');
  await schakel(true);
});

test('2. een leerhuis opent alleen het kantoor op naam, en maar een keer', async () => {
  const gedeeld = (await post('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  const viaCode = await post('/api/office/leerhuis/open', { id: ORG, soort: 'RTG', naam: 'Operations', eigenaar: 'user-' + eId }, gedeeld);
  assert.equal(viaCode.status, 403);
  const viaLid = await doe(E, 'orgOpen', { id: ORG, soort: 'RTG', eigenaar: 'lid:' + eId }, 'x-open');
  assert.equal(viaLid.status, 403);
  const open = await post('/api/office/leerhuis/open', { id: ORG, soort: 'RTG', naam: 'Operations', eigenaar: 'user-' + eId }, office);
  assert.equal(open.status, 200, JSON.stringify(open.body));
  const nogmaals = await post('/api/office/leerhuis/open', { id: ORG, soort: 'RTG', naam: 'Operations', eigenaar: 'user-' + eId }, office);
  assert.equal(nogmaals.status, 200);
  assert.equal(nogmaals.body.herhaald, true, 'dezelfde opening twee keer is een herhaling en geen tweede leerhuis');
});

test('3. geen handeling zonder sleutel; dezelfde sleutel twee keer schrijft een keer', async () => {
  const zonder = await doe(E, 'relatieZet', { persoon: 'lid:' + nId, soort: 'EMPLOYEE' }, '');
  assert.equal(zonder.status, 400);
  const een = await doe(E, 'relatieZet', { persoon: 'lid:' + nId, soort: 'EMPLOYEE', manager: 'lid:' + eId }, 'rel-n-1');
  assert.equal(een.status, 200, JSON.stringify(een.body));
  const twee = await doe(E, 'relatieZet', { persoon: 'lid:' + nId, soort: 'EMPLOYEE', manager: 'lid:' + eId }, 'rel-n-1');
  assert.equal(twee.status, 200);
  assert.equal(twee.body.herhaald, true);
  const u = await lees(E, 'uitkomst', { sleutel: 'rel-n-1' });
  assert.equal(u.body.antwoord.bekend, true);
  const vreemd = await lees(N, 'uitkomst', { sleutel: 'rel-n-1' });
  assert.equal(vreemd.body.antwoord.bekend, false, 'een ander leest mijn sleutels niet');
});

test('4. de actor komt uit de sessie: een veld door in het lijf verandert niets', async () => {
  const r = await doe(N, 'bestuurZet', { persoon: 'lid:' + nId, rol: 'ASSESSOR' }, 'vals-1', { door: 'lid:' + eId });
  assert.equal(r.status, 403, JSON.stringify(r.body));
  const r2 = await doe(N, 'bestuurZet', { persoon: 'lid:' + nId, rol: 'ASSESSOR', door: 'lid:' + eId }, 'vals-2');
  assert.equal(r2.status, 403);
  const echt = await doe(E, 'bestuurZet', { persoon: 'lid:' + nId, rol: 'ASSESSOR' }, 'best-1');
  assert.equal(echt.status, 200, JSON.stringify(echt.body));
});

test('5. B5: leren mag zonder 18+-keuring, een certificaat niet -- en zonder account komt er niets in', async () => {
  const xId = (await post('/api/state', {}, X)).body.state.user.id;
  assert.equal((await lees(X, 'mijn')).status, 403, 'zonder relatie met de organisatie leest niemand iets');
  assert.equal((await doe(E, 'relatieZet', { persoon: 'lid:' + xId, soort: 'VOLUNTEER' }, 'rel-x-1')).status, 200);
  const m = await lees(X, 'mijn');
  assert.equal(m.status, 200, 'wie niet gekeurd is, leert gewoon mee: ' + JSON.stringify(m.body));
  const c = await doe(E, 'certificaatUitgeven', { persoon: 'lid:' + xId, vaardigheden: ['terugboeken'], beoordelingen: [] }, 'cert-x-1');
  assert.equal(c.status, 403);
  assert.match(c.body.hoe || '', /B5/, 'de weigering noemt de grens en niet een ontbrekende rol');
  const vreemd = await doe(E, 'certificaatUitgeven', { persoon: 'concern:iemand', vaardigheden: ['terugboeken'], beoordelingen: [] }, 'cert-c-1');
  assert.equal(vreemd.status, 403, 'wie zijn leeftijd niet kan laten vaststellen, krijgt geen certificaat');
  const volw = await doe(E, 'certificaatUitgeven', { persoon: 'lid:' + nId, vaardigheden: ['terugboeken'], beoordelingen: [] }, 'cert-n-1');
  assert.doesNotMatch(volw.body.hoe || '', /B5/, 'een volwassene komt langs de 18+-grens; wat er dan weigert is de kern');
  assert.equal((await post('/api/leerhuis/lees', { org: ORG, vraag: 'mijn' }, null)).status, 401);
});

test('6. een lid leest zijn eigen stand, het bestuur leest het organisatiebeeld', async () => {
  const m = await lees(N, 'mijn');
  assert.equal(m.status, 200, JSON.stringify(m.body));
  for (const k of ['VANDAAG', 'PAD', 'OEFENEN', 'VAARDIGHEDEN', 'GROEI', 'COACH']) assert.ok(k in m.body.antwoord, k);
  assert.equal(m.body.antwoord.VAARDIGHEDEN.persoon, 'lid:' + nId, 'de vakstaat is van de lezer zelf');
  assert.equal((await lees(N, 'gereedheid', { eisen: { ops: 1 } })).status, 403);
  const g = await lees(E, 'gereedheid', { eisen: { ops: 1 } });
  assert.equal(g.status, 200);
  assert.equal(g.body.antwoord.stand, 'BLOCKED');
  assert.equal((await lees(N, 'mijn', { org: 'BESTAAT-NIET' })).status, 404);
  const geschikt = await lees(N, 'geschiktheid', { handeling: 'betaling.terugboeken' });
  assert.equal(geschikt.body.antwoord.uitkomst, 'NOT_ELIGIBLE');
  assert.equal(geschikt.body.antwoord.verleent, false);
});
