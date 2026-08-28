/* FOUNDATION-registratie: openbaar aanvragen, nooit openbaar toelaten. De
   Boardroom moet elk toepasselijk bewijs afzonderlijk vastleggen voordat een
   schoolcode, vrijwilligerscode of partnercode ontstaat. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer , wachtOpBestand } = require('./helper');

let child, base, office, eigenaar;
const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-foundation-reg-'));
const post = async (pad, body, token) => {
  const headers = { 'Content-Type':'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method:'POST', headers, body:JSON.stringify(body || {}) });
};
const json = r => r.json();
const school = extra => Object.assign({ type:'school', naam:'Basisschool De Veilige Brug', plaats:'Utrecht',
  contactNaam:'Directeur Noor', email:'directie@veiligebrug.example', brin:'12AB',
  bevoegd:true, waarheidsgetrouw:true, privacyAkkoord:true }, extra || {});

test.before(async () => {
  ({ child, base } = await startServer({ env:{ RTG_DATA_DIR:map, SMTP_URL:'' } }));
  office = (await json(await post('/api/office/login', { code:'RTG-OFFICE' }))).token;
  eigenaar = (await json(await post('/api/auth/login', { login:'roellie.i@gmail.com', password:'Imran' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (_) {}
  try { fs.rmSync(map, { recursive:true, force:true }); } catch (_) {}
});

test('catalogus toont de vier veilige deuren en officiële bronnen', async () => {
  /* MET DE KANTOORTOKEN. Deze route stond open en werd door de ladder gevonden
     op de trede "de dwaler": een route die zonder inlog een geslaagd antwoord
     geeft. Wat eruit komt is de volledige eisencatalogus plus de actieve steden.
     Geen scherm vroeg hem op -- deze toets wel, en dat is precies waarom hij
     nu meetekent voor de poort in plaats van eromheen te lopen. */
  const r = await post('/api/foundation/registratie/catalogus', {}, office);
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.deepEqual(Object.keys(d.types).sort(), ['partnerstichting','school','vrijwilliger']);
  assert.ok(d.bronnen.brin.includes('duo.nl'));
  assert.ok(d.bronnen.anbi.includes('belastingdienst.nl'));
  assert.ok(d.eisenPerType.school.some(e => e.id === 'privacy_kinderen'));
  assert.ok(d.eisenPerType.vrijwilliger.some(e => e.id === 'vog'));
});

test('een school krijgt bij aanvragen nog geen schoolcode', async () => {
  assert.equal((await post('/api/foundation/registratie/aanvragen', school({ bevoegd:false }))).status, 400);
  const r = await post('/api/foundation/registratie/aanvragen', school());
  const d = await r.json();
  assert.equal(r.status, 200, d.error || 'schoolregistratie');
  assert.ok(d.id && d.statusToken);
  assert.equal(d.aanvraag.status, 'nieuw');
  assert.equal(d.aanvraag.toegang, undefined);
  school.id = d.id; school.token = d.statusToken;

  assert.equal((await post('/api/foundation/registratie/status', { id:d.id, statusToken:'verkeerd' })).status, 403);
  const st = await json(await post('/api/foundation/registratie/status', { id:d.id, statusToken:d.statusToken }));
  assert.equal(st.aanvraag.open, 5);
});

test('kantoor mag kijken, alleen Boardroom controleert en laat toe', async () => {
  assert.equal((await post('/api/office/foundation/registraties')).status, 401);
  const d = await json(await post('/api/office/foundation/registraties', {}, office));
  const a = d.registraties.find(x => x.brin === '12AB');
  assert.ok(a);
  assert.equal((await post('/api/office/foundation/registratie/controle', {
    id:a.id, onderdeel:'brin', uitkomst:'geverifieerd', referentie:'DUO 12AB' }, office)).status, 403);
  assert.equal((await post('/api/office/foundation/registratie/besluit', {
    id:a.id, action:'goedkeuren' }, eigenaar)).status, 409, 'ook de eigenaar kan open controles niet overslaan');

  for (const eis of a.toelating.eisen) {
    const r = await post('/api/office/foundation/registratie/controle', { id:a.id, onderdeel:eis.id,
      uitkomst:'geverifieerd', referentie:'Officiële controle ' + eis.id }, eigenaar);
    assert.equal(r.status, 200, eis.id + ': ' + await r.text());
  }
  const besluit = await json(await post('/api/office/foundation/registratie/besluit', {
    id:a.id, action:'goedkeuren' }, eigenaar));
  assert.match(besluit.toegang.schoolCode, /^S[0-9A-F]{5}$/);
  assert.equal(besluit.toegang.beheerToken, undefined, 'het permanente directietoken verlaat de uitgifte niet');
  assert.ok(Date.parse(besluit.toegang.activatieVerlooptAt) > Date.now());

  /* Wachten tot de activatiemail er ECHT is. Hier stond `setTimeout(r, 100)`:
     een gok die op een trage machine te kort is en op een snelle tijd weggooit. */
  const outbox = path.join(map, 'outbox');
  await wachtOpBestand(outbox, (naam, lees) => /#activeren=/i.test(lees()),
    { wat: 'de activatiemail voor het schooladres' });
  const mails = fs.readdirSync(outbox).map(f => fs.readFileSync(path.join(outbox, f), 'utf8')).join('\n');
  const activatie = /#activeren=([A-Z0-9]+\.[a-f0-9]{48})/i.exec(mails);
  assert.ok(activatie, 'het gecontroleerde schooladres krijgt een eenmalige activatielink');
  const actief = await json(await post('/api/foundation/school/school/activeren', { activatie:activatie[1] }));
  assert.ok(actief.beheerToken.length >= 20);
  assert.equal((await post('/api/foundation/school/school/activeren', { activatie:activatie[1] })).status, 403,
    'de activatielink werkt maar één keer');

  const overzicht = await post('/api/foundation/school/school/overzicht', {
    schoolCode:besluit.toegang.schoolCode, beheerToken:actief.beheerToken });
  assert.equal(overzicht.status, 200, 'de code opent pas na de Boardroom-uitgifte');
  const eigen = await json(await post('/api/foundation/registratie/status', { id:a.id, statusToken:school.token }));
  assert.equal(eigen.aanvraag.status, 'goedgekeurd');
  assert.equal(eigen.aanvraag.toegang.schoolCode, besluit.toegang.schoolCode);
});

test('minderjarige vrijwilliger vereist oudertoestemming en krijgt geen directe code', async () => {
  const b = { type:'vrijwilliger', naam:'Sam Vrijwilliger', plaats:'Utrecht', contactNaam:'Sam Vrijwilliger',
    email:'sam@vrijwilliger.example', minderjarig:true, ouderToestemming:false, werktMetKwetsbaren:true,
    bevoegd:true, waarheidsgetrouw:true, privacyAkkoord:true };
  assert.equal((await post('/api/foundation/registratie/aanvragen', b)).status, 400);
  b.ouderToestemming = true;
  const r = await json(await post('/api/foundation/registratie/aanvragen', b));
  assert.ok(r.id);
  assert.equal(r.aanvraag.toegang, undefined);
  assert.ok(r.aanvraag.controles.some(e => e.id === 'ouder_toestemming'));
  assert.ok(r.aanvraag.controles.some(e => e.id === 'vog'));
});
