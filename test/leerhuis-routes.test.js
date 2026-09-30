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
     - besluit B1: de factuurcorrectie wordt meegelezen en niemand wordt
       tegengehouden (haal de meelezer uit opzet/kantoordeur.js)   -> toets 7
     - besluit B2: de bron-eis bij het openen weg                 -> toets 8
     - de cockpits op codenaam (laat metNamen de naam weg)        -> toets 10
     - het werkscherm: assessor- en kenniswerk alleen met de rol   -> toets 11
       (en de leesroute las eerst zijn eigen kopie van de relatie; toets 8
       vond dat wie uit dienst was, nog meelas)

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

test('7. B1 in de schaduw: een echte terugboeking wordt meegelezen en niemand wordt tegengehouden', async () => {
  /* De eigenaar van dit huis als MEDEWERKER op naam (office) en als lid (eig).
     Hij krijgt het RTG-leerhuis, maar geen certificaat en geen beleid: dus
     "niet geschikt", en toch moet de terugboeking gewoon slagen. */
  const eig = (await post('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  const eigId = (await post('/api/state', {}, eig)).body.state.user.id;
  const open = await post('/api/office/leerhuis/open', { id: 'RTG', soort: 'RTG', naam: 'RTG', eigenaar: 'user-' + eigId }, office);
  assert.equal(open.status, 200, JSON.stringify(open.body));

  const reg = await post('/api/auth/register', { name: 'Schaduw Lid', email: 'lh-s@x.nl', phone: '0612348009',
    password: 'geheim12345', geboortedatum: '1985-04-04', tier: 'rtg', pasApp: 'rtg' });
  const lid = reg.body.token;
  const userId = reg.body.state.user.id;
  const PNG = 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]).toString('base64');
  await post('/api/verify/upload', { image: PNG }, lid);
  await post('/api/verify/selfie', { image: PNG }, lid);
  const factuur = ((await post('/api/state', {}, lid)).body.state.invoices || []).find(i => i.status === 'open');
  assert.ok(factuur, 'het nieuwe lid heeft een open factuur');
  assert.equal((await post('/api/pay/saldo', { invoiceId: factuur.id }, lid)).status, 200);

  const voor = (await lees(eig, 'schaduw', { org: 'RTG' })).body.antwoord.routes[0];
  const r = await post('/api/office/pay/factuurcorrectie',
    { userId, invoiceId: factuur.id, grond: 'niet-geleverd', reden: 'schaduwproef' }, office);
  assert.equal(r.status, 200, 'de schaduw houdt niemand tegen: ' + JSON.stringify(r.body));
  const na = (await lees(eig, 'schaduw', { org: 'RTG' })).body.antwoord.routes[0];
  assert.equal(na.route, 'POST /api/office/pay/factuurcorrectie');
  assert.equal(na.oneens, voor.oneens + 1, 'toegelaten maar niet geschikt: precies wat afdwingen had tegengehouden');
  assert.ok(!JSON.stringify(na).includes('lid:'), 'een teller en geen journaal: er staat geen mens in');
});

test('8. B2: een leerhuis met een entiteit als bron volgt het dienstverband, en een verklaring houdt dat niet tegen', async () => {
  const lid = async (n, geboren) => (await post('/api/auth/register', { name: 'Bron ' + n, email: 'lh-b' + n + '@x.nl',
    phone: '06123481' + n, password: 'geheim12345', geboortedatum: geboren || '1988-08-08', tier: 'rtg' })).body.token;
  const A = await lid(10), W = await lid(11), V = await lid(12);
  const id = async (t) => (await post('/api/state', {}, t)).body.state.user.id;
  const [aId, wId, vId] = [await id(A), await id(W), await id(V)];
  const ent = (await post('/api/concern/entiteit/nieuw', { naam: 'Leerhuis Bron BV', land: 'NL', rechtsvorm: 'bv' }, A)).body.entiteit;
  assert.ok(ent && ent.id, 'een entiteit om in te werken');
  const emp = await post('/api/concern/mens/nieuw', { entiteit: ent.id, persoon: 'user-' + wId, rol: 'Operations', van: '2026-01-01' }, A);
  assert.equal(emp.status, 200, JSON.stringify(emp.body));

  const zonderEigenaarInBron = await post('/api/office/leerhuis/open',
    { id: 'BRON-BV', soort: 'BUSINESS', naam: 'Bron BV', eigenaar: 'user-' + vId, bron: { soort: 'entiteit', id: ent.id } }, office);
  assert.equal(zonderEigenaarInBron.status, 409, 'het kantoor opent geen leerhuis waarin de eigenaar zelf niet in de bron staat');
  const open = await post('/api/office/leerhuis/open',
    { id: 'BRON-BV', soort: 'BUSINESS', naam: 'Bron BV', eigenaar: 'user-' + aId, bron: { soort: 'entiteit', id: ent.id } }, office);
  assert.equal(open.status, 200, JSON.stringify(open.body));

  const zet = (p, s) => post('/api/leerhuis/doe', { org: 'BRON-BV', actie: 'relatieZet', invoer: { persoon: 'lid:' + p, soort: 'EMPLOYEE' }, sleutel: s }, A);
  assert.equal((await zet(wId, 'b-w')).status, 200, 'in dienst: de relatie mag');
  const vreemd = await zet(vId, 'b-v');
  assert.equal(vreemd.status, 409, 'niet in dienst: geen verklaring kan dat vervangen');
  assert.equal((await post('/api/leerhuis/lees', { org: 'BRON-BV', vraag: 'mijn' }, W)).status, 200);

  /* Het dienstverband stopt; het leerhuis doet niets, en toch stopt de relatie. */
  const eind = await post('/api/concern/mens/uitdienst', { employment: emp.body.employment.id, per: '2026-02-01' }, A);
  assert.equal(eind.status, 200, JSON.stringify(eind.body));
  assert.equal((await post('/api/leerhuis/lees', { org: 'BRON-BV', vraag: 'mijn' }, W)).status, 403,
    'wie niet meer in dienst is, leest het leerhuis van zijn oude werkgever niet meer');
});

test('9. B7: het startpakket laden kan alleen de curriculumeigenaar, en opnieuw laden schrijft niets', async () => {
  const laad = (tok, s) => doe(tok, 'startpakketLaden', {}, s);
  assert.equal((await laad(N, 'pak-0')).status, 403, 'zonder CURRICULUM_OWNER geen pakket');
  assert.equal((await doe(E, 'bestuurZet', { persoon: 'lid:' + nId, rol: 'CURRICULUM_OWNER' }, 'best-co')).status, 200);
  const vooraf = await lees(E, 'startpakket');
  assert.equal(vooraf.status, 200, JSON.stringify(vooraf.body));
  assert.equal(vooraf.body.antwoord.stappen.length, 8, 'het bestuur ziet wat er klaargezet zou worden');
  const r = await laad(N, 'pak-1');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.gezet.length, 8);
  const nog = await laad(N, 'pak-2');
  assert.equal(nog.body.gezet.length, 0, 'wat er al staat, wordt overgeslagen en niet overschreven');
});

test('10. fase B-UI: de cockpits noemen mensen op codenaam, en wie geen trainer is krijgt geen trainerbeeld', async () => {
  /* N heeft sinds toets 3 een relatie met E als manager. */
  const m = await lees(E, 'managerCockpit');
  assert.equal(m.status, 200, JSON.stringify(m.body));
  const lidN = (m.body.antwoord.TEAM || []).find(x => x.persoon === 'lid:' + nId);
  assert.ok(lidN, 'N staat in het team van E');
  assert.equal(lidN.naam, await codeVan(N), 'het team toont de codenaam, niet de sleutel en niet de echte naam');
  assert.doesNotMatch(JSON.stringify(m.body), /Nieuwe Collega/, 'de echte naam komt nergens in het antwoord');
  const t = await lees(E, 'trainerCockpit');
  assert.equal(t.status, 200);
  assert.equal(t.body.antwoord.ok, false, 'E is geen trainer, dus het scherm toont dat vak niet');
});

test('11. fase B-UI werkscherm: het werk van assessor en kenniseigenaar komt over de deur, alleen voor wie de rol heeft', async () => {
  /* N is sinds toets 4 assessor en sinds toets 9 curriculumeigenaar die het startpakket laadde. */
  const a = await lees(N, 'assessorWerk');
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(a.body.antwoord.ok, true);
  assert.ok(Array.isArray(a.body.antwoord.OPEN) && Array.isArray(a.body.antwoord.LOPEND));
  assert.equal((await lees(E, 'assessorWerk')).body.antwoord.ok, false, 'de eigenaar is geen assessor en ziet dus geen beoordelingen');
  assert.equal((await lees(N, 'kennisWerk')).body.antwoord.ok, false, 'nog geen kenniseigenaar');
  assert.equal((await doe(E, 'bestuurZet', { persoon: 'lid:' + nId, rol: 'KNOWLEDGE_OWNER' }, 'best-ko')).status, 200);
  const k = await lees(N, 'kennisWerk');
  const c = k.body.antwoord.CONCEPTEN.find(x => x.id === 'pakket-kennis-codenamen');
  assert.ok(c, 'het concept uit het startpakket wacht op een kenniseigenaar');
  assert.equal(c.bronNodig, true, 'een startpakketconcept vraagt de eigen bron');
  assert.equal(c.eigen, true, 'N laadde het zelf, dus een ander activeert het');
  assert.equal((await lees(X, 'kennisWerk')).body.antwoord.ok, false, 'een vrijwilliger zonder rol ziet geen concepten');
});

test('12. de eigenaar wijst een nieuwe collega aan op codenaam, met reden, en dat staat op de inzagekaart van die collega', async () => {
  const Z = (await post('/api/auth/register', { name: 'Zonder Sleutel', email: 'lh-z@x.nl', phone: '0612348009',
    password: 'geheim12345', geboortedatum: '1992-02-02', tier: 'rtg' })).body.token;
  const code = await codeVan(Z);
  assert.equal((await lees(Z, 'mijn')).status, 403, 'nog geen relatie');
  const zet = (tok, invoer, sleutel) => doe(tok, 'relatieZet', Object.assign({ codenaam: code, soort: 'EMPLOYEE' }, invoer), sleutel);
  assert.equal((await zet(X, { reden: 'nieuwe collega bij Operations' }, 'aanw-x')).status, 403, 'wie geen eigenaar is, kan geen codenaam nagaan');
  assert.equal((await zet(E, { reden: '' }, 'aanw-leeg')).status, 400, 'zonder reden geen opzoeking');
  assert.equal((await doe(E, 'relatieZet', { codenaam: 'Bestaat Niet 0000', soort: 'EMPLOYEE', reden: 'nieuwe collega' }, 'aanw-niet')).status, 404);
  const r = await zet(E, { reden: 'nieuwe collega bij Operations' }, 'aanw-z');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await lees(Z, 'mijn')).status, 200, 'de relatie staat, op de sleutel die de server erbij zocht');
  const kaart = (await post('/api/inzagekaart', {}, Z)).body;
  assert.ok(JSON.stringify(kaart).includes('nieuwe collega bij Operations'), 'de collega ziet wie hem opzocht en waarom: ' + JSON.stringify(kaart).slice(0, 400));
  assert.doesNotMatch(JSON.stringify(r.body), /Zonder Sleutel/, 'de echte naam komt nergens in het antwoord');
});
