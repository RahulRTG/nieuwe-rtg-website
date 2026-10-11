/* ============================================================================
   HET ZAAKDOOSJOURNAAL NEEMT GEEN INLOG OP -- regressie voor N27 uit de V1-audit.

   DE FOUT: in lokale modus komt elke geslaagde POST onder /api/supplier/ in het
   naspeeljournaal, met lijf en antwoord, en dat journaal ligt onversleuteld op
   het kastje tot het naar de cloud wordt nagespeeld. Uitgezonderd was alleen
   '/api/supplier/login', letterlijk, op twee plekken. Daardoor kwamen
   /api/supplier/login/ (met slash) en /api/supplier/mijn/login (e-mail plus
   wachtwoord, of bewijs plus code) erin, met het werktoken uit het antwoord.

   DE FIX (server/kern/zaakdoos/journaal.js, besluit van de eigenaar):
     1. welk pad een inlog is, staat op EEN plek: INLOG_PADEN, gelezen met
        vastePaden() via isInlogPad (server/middleware/remmen.js);
     2. van het antwoord blijft alleen wat het naspelen leest (ref, id, pickup,
        orderRef), dus geen token na een wissel en geen kassacode;
     3. een lijf met een wachtwoord gaat er niet in (slot 4B).

   DE AANMELDING IS SINDS N29 EEN INLOGPAD. /api/supplier/staff/join draagt een
   RTG-wachtwoord en was daarom het voorbeeld van slot 4B. N29 zette hem op
   INLOG_PADEN, dus houdt slot 1 hem nu al tegen en bewees de aanmelding in toets
   1 niets meer over slot 4B. Daarvoor is er toets 2: een wachtwoord in het lijf
   van een GEWONE zaakroute, door dezelfde echte doos. Dat de aanmelding lokaal
   200 geeft en nooit wordt nagespeeld, staat als gevolg in slot 4B van
   journaal.js.

   DE PROEF draait een ECHTE doos in lokale modus. Er is geen cloud nodig: het
   cloudadres is een poort die elke verbinding meteen dichtgooit, en dan valt de
   doos vanzelf naar lokaal -- precies wat er op het strand gebeurt. Daarna leest
   hij het journaal zoals iemand met het kastje in handen het leest: uit
   store.db op schijf. De meeste verzoeken vragen GEEN compressie (zoals curl):
   jsonGzip() in server/middleware/compressie.js wikkelt res.json NA de
   journaalpoort en stuurt een antwoord boven de kilobyte met res.send, dus met
   compressie komt zo'n antwoord nooit bij het journaal. Dan zou deze toets een
   toevalstreffer meten in plaats van het padbeleid. De eerste stap van de tweede
   factor gaat juist WEL met compressie, zoals een browser: dat antwoord is klein
   en kwam ook zo in het journaal.

   DE TEGENPROEF: twee gewone keukenhandelingen (overschot) staan er wel in, met
   hun lijf intact. Zonder die proef zou een lege of versleutelde lezing hier
   groen staan.

   Draai los: node --test test/doos-inlogjournaal.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { startServer, stop } = require('./helper');
const { isInlogPad } = require('../server/middleware/remmen');
const { journaalPadOk } = require('../server/kern/zaakdoos/journaal');
const { totpCode } = require('../server/kern/totp');

const WW = 'n27-' + crypto.randomBytes(9).toString('hex');
const EMAIL = 'n27-' + crypto.randomBytes(4).toString('hex') + '@rtg.example';
let doos, dir, dodeCloud;

const kort = (b) => JSON.stringify(b).slice(0, 200);
/* `kaal` vraagt geen compressie; zonder kaal gaat het verzoek zoals uit een
   browser (fetch vraagt gzip, deflate en br). */
async function api(pad, body, token, kaal = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (kaal) headers['Accept-Encoding'] = 'identity';
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(doos.base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(30000) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
function journaalOpSchijf() {
  const db = new DatabaseSync(path.join(dir, 'store.db'), { readOnly: true });
  try {
    const r = db.prepare("SELECT val FROM kv WHERE key = 'doosJournaal'").get();
    return r ? String(r.val) : '';
  } finally { db.close(); }
}
/* Het journaal op schijf, zodra er een regel in staat die `klaar` herkent: een
   handeling die NA de andere ging, zodat haar regel bewijst dat de rest er al staat. */
async function journaalMet(klaar) {
  let rauw = '', rij = [];
  for (let i = 0; i < 150; i++) {
    rauw = journaalOpSchijf();
    try { rij = JSON.parse(rauw || '[]'); } catch (e) { rij = []; }
    if (Array.isArray(rij) && rij.some(klaar)) break;
    await new Promise(r => setTimeout(r, 200));
  }
  assert.ok(Array.isArray(rij) && rij.some(klaar), 'het journaal op schijf is leesbare JSON met de laatste regel: ' + rauw.slice(0, 120));
  return { rauw, rij };
}

test.before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-doos-inlog-'));
  // een "cloud" die elke verbinding meteen dichtgooit: de lijn is weg
  dodeCloud = net.createServer(s => s.destroy());
  await new Promise(ok => dodeCloud.listen(0, '127.0.0.1', ok));
  doos = await startServer({ env: {
    RTG_DATA_DIR: dir, SMTP_URL: '', RTG_ENC_KEY: '',
    RTG_DOOS_CLOUD: 'http://127.0.0.1:' + dodeCloud.address().port,
    RTG_DOOS_SLEUTEL: 'doos-inlog-sleutel-' + crypto.randomBytes(8).toString('hex'), RTG_DOOS_NAAM: 'n27doos'
  } });
  let modus;
  for (let i = 0; i < 300 && modus !== 'lokaal'; i++) {
    try { modus = (await (await fetch(doos.base + '/api/doos/status')).json()).modus; } catch (e) { /* nog niet */ }
    if (modus !== 'lokaal') await new Promise(r => setTimeout(r, 200));
  }
  assert.equal(modus, 'lokaal', 'de doos zonder lijn staat in lokale modus');
});
test.after(async () => {
  await stop(doos && doos.child);
  if (dodeCloud) dodeCloud.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
});

test('geen inlog, geen wachtwoord, geen code en geen token in het doosjournaal; een keukenhandeling wel', async () => {
  const geheimen = { WW, Imran: 'Imran' };

  // 1. de bedrijfsinlog, letterlijk en met een slash erachter
  const t1 = await api('/api/supplier/login', { username: 'rahul', password: 'Imran' });
  assert.equal(t1.status, 200, 'bedrijfsinlog: ' + kort(t1.body));
  const t2 = await api('/api/supplier/login/', { username: 'rahul', password: 'Imran' });
  assert.equal(t2.status, 200, 'bedrijfsinlog met slash: ' + kort(t2.body));
  Object.assign(geheimen, { t1: t1.body.token, t2: t2.body.token });

  // de tegenproef, deel een: een gewone keukenhandeling
  const state = (await api('/api/supplier/state', {}, t1.body.token)).body.state || {};
  const itemId = state.menu && state.menu[0] && state.menu[0].id;
  assert.ok(itemId && state.supplier, 'de zaakstaat op de doos: ' + kort(state));
  const o1 = await api('/api/supplier/overschot', { op: 'erbij', itemId, qty: 2 }, t1.body.token);
  assert.equal(o1.status, 200, 'overschot lokaal: ' + kort(o1.body));

  // 2. een eigen lid meldt zich aan bij de zaak (kassacode + eigen RTG-inlog); sinds N29 een inlogpad
  const reg = await api('/api/auth/register', { name: 'Werk Nzevenentwintig', email: EMAIL, password: WW, geboortedatum: '1990-01-01' });
  assert.ok(reg.body.token, 'registratie op de doos: ' + kort(reg.body));
  const inv = await api('/api/supplier/staff/invite', { name: 'Werk Nzevenentwintig', func: 'Bediening' }, t1.body.token);
  assert.equal(inv.status, 200, 'uitnodiging: ' + kort(inv.body));
  geheimen.kassacode = inv.body.invite.kassacode;
  const join = await api('/api/supplier/staff/join', { bedrijf: state.supplier.name, kassacode: inv.body.invite.kassacode, login: EMAIL, password: WW });
  assert.equal(join.status, 200, 'aanmelding bij de zaak: ' + kort(join.body));

  // 3. de werkplekinlog met e-mail en wachtwoord, letterlijk en met slash
  const t3 = await api('/api/supplier/mijn/login', { login: EMAIL, password: WW });
  assert.equal(t3.status, 200, 'werkplekinlog: ' + kort(t3.body));
  const t4 = await api('/api/supplier/mijn/login/', { login: EMAIL, password: WW });
  assert.equal(t4.status, 200, 'werkplekinlog met slash: ' + kort(t4.body));
  Object.assign(geheimen, { t3: t3.body.token, t4: t4.body.token });

  // 4. een wissel van werkplek: het antwoord draagt een vers werktoken
  const nora = await api('/api/supplier/mijn/login', { login: 'nora@rtg.example', password: 'werk' });
  assert.equal(nora.status, 200, 'Nora logt in: ' + kort(nora.body));
  const ander = (nora.body.posities || []).find(p => p.code !== nora.body.supplier.code);
  assert.ok(ander, 'Nora werkt bij twee zaken: ' + kort(nora.body.posities));
  const wissel = await api('/api/supplier/mijn/wissel', { code: ander.code }, nora.body.token);
  assert.equal(wissel.status, 200, 'wissel: ' + kort(wissel.body));
  Object.assign(geheimen, { nora: nora.body.token, wissel: wissel.body.token });

  // 5. de werkplekinlog met de tweede factor: bewijs plus code
  const begin = await api('/api/mijn/tweefactor/begin', { huidig: WW }, reg.body.token);
  assert.ok(begin.body.geheim, 'tweede factor beginnen: ' + kort(begin.body));
  const aan = await api('/api/mijn/tweefactor/bevestig', { code: totpCode(begin.body.geheim, Date.now(), 30) }, reg.body.token);
  assert.equal(aan.status, 200, 'tweede factor aan: ' + kort(aan.body));
  const herstel = (aan.body.herstelcodes || [])[0];
  assert.ok(herstel, 'er is een herstelcode');
  const stap1 = await api('/api/supplier/mijn/login', { login: EMAIL, password: WW }, null, false); // zoals een browser
  assert.ok(stap1.body.bewijs && !stap1.body.token, 'stap een geeft een bewijs: ' + kort(stap1.body));
  const stap2 = await api('/api/supplier/mijn/login', { bewijs: stap1.body.bewijs, code: herstel });
  assert.equal(stap2.status, 200, 'stap twee: ' + kort(stap2.body));
  Object.assign(geheimen, { bewijs: stap1.body.bewijs, herstel, t5: stap2.body.token });

  // de tegenproef, deel twee: NA alle inlogs, zodat zijn regel bewijst dat de rest al op schijf staat
  const o2 = await api('/api/supplier/overschot', { op: 'erbij', itemId, qty: 3 }, t1.body.token);
  assert.equal(o2.status, 200, 'tweede overschot lokaal: ' + kort(o2.body));

  // het journaal op schijf, zodra de laatste keukenhandeling erin staat
  const { rauw, rij } = await journaalMet(e => e.pad === '/api/supplier/overschot' && e.body && e.body.qty === 3);

  // de tegenproef: beide keukenhandelingen staan er, met hun lijf intact
  for (const qty of [2, 3]) {
    assert.ok(rij.some(e => e.pad === '/api/supplier/overschot' && e.body.itemId === itemId && e.body.qty === qty),
      'de keukenhandeling met qty ' + qty + ' staat in het journaal: ' + rij.map(e => e.pad).join(', '));
  }
  // geen inlogroute, in welke spelling ook
  const inlog = rij.filter(e => isInlogPad(e.pad)).map(e => e.pad);
  assert.deepEqual(inlog, [], 'inlogroutes in het journaal');
  // geen wachtwoordveld, en geen enkel geheim dat hierboven over de lijn ging
  assert.ok(!/"(password|wachtwoord)"/i.test(rauw), 'een wachtwoordveld in het journaal');
  for (const [naam, waarde] of Object.entries(geheimen)) {
    assert.ok(typeof waarde === 'string' && waarde.length >= 5, 'geheim ' + naam + ' is een echte waarde');
    assert.ok(!rauw.includes(waarde), 'het geheim "' + naam + '" staat in het doosjournaal');
  }
  // en een gewone schrijfactie met een geheim in het antwoord staat er wel, zonder dat geheim
  const invRegel = rij.find(e => e.pad === '/api/supplier/staff/invite');
  assert.ok(invRegel, 'de uitnodiging zelf wordt nagespeeld');
  assert.deepEqual(invRegel.res, { invite: { id: inv.body.invite.id } }, 'van het antwoord blijft alleen de ref');
});

/* SLOT 4B DOOR DE ECHTE DOOS (ronde 6b). Geen supplierroute buiten INLOG_PADEN
   vraagt vandaag een wachtwoord, dus het lijf gaat mee met een gewone
   keukenhandeling: precies de client die te veel meestuurt, of de deur die er
   morgen bij komt. De handeling zelf slaagt lokaal; alleen de regel blijft uit
   het journaal. Drie vormen, elk voor een tak van draagtWachtwoord (een naam,
   een hoofdlettervorm, afdalen in een object en in een lijst), en de tegenproef
   NA de drie: hetzelfde lijf met een sleutel die er alleen op lijkt, en het
   woord als waarde, staat er wel in. De losse takken op elke diepte staan in
   toets 7 van test/doos-journaal.test.js. */
test('een wachtwoord in het lijf van een gewone zaakroute komt niet in het doosjournaal; hetzelfde lijf zonder wel', async () => {
  const PAD = '/api/supplier/overschot';
  assert.equal(isInlogPad(PAD), false, PAD + ' staat op INLOG_PADEN; dan beproeft deze toets slot 1 en niet slot 4B');
  assert.equal(journaalPadOk(PAD), true, PAD + ' moet slot 1 passeren');
  const t = await api('/api/supplier/login', { username: 'rahul', password: 'Imran' });
  assert.equal(t.status, 200, 'bedrijfsinlog: ' + kort(t.body));
  const state = (await api('/api/supplier/state', {}, t.body.token)).body.state || {};
  const itemId = state.menu && state.menu[0] && state.menu[0].id;
  assert.ok(itemId, 'een gerecht op de doos: ' + kort(state));
  const merk = 'r6b-' + crypto.randomBytes(6).toString('hex');
  const geweigerd = [
    ['plat, in kleine letters', 11, { password: merk + '-plat' }],
    ['genest, de Nederlandse naam met een hoofdletter', 12, { account: { profiel: { Wachtwoord: merk + '-genest' } } }],
    ['in een lijst, in hoofdletters', 13, { leden: [{ naam: 'A' }, { PASSWORD: merk + '-lijst' }] }]
  ];
  for (const [vorm, qty, extra] of geweigerd) {
    const r = await api(PAD, Object.assign({ op: 'erbij', itemId, qty }, extra), t.body.token);
    assert.equal(r.status, 200, 'de handeling zelf slaagt lokaal (' + vorm + '): ' + kort(r.body));
  }
  const tegen = { op: 'erbij', itemId, qty: 14, passwordHint: merk + '-tegen', opmerking: 'password' };
  const r = await api(PAD, tegen, t.body.token);
  assert.equal(r.status, 200, 'de tegenproef slaagt lokaal: ' + kort(r.body));

  const { rauw, rij } = await journaalMet(e => e.pad === PAD && e.body && e.body.passwordHint === merk + '-tegen');
  const regel = rij.find(e => e.pad === PAD && e.body.passwordHint === merk + '-tegen');
  assert.deepEqual(regel.body, tegen, 'de tegenproef staat erin, met zijn lijf intact');
  for (const [vorm, qty] of geweigerd) {
    assert.ok(!rij.some(e => e.pad === PAD && e.body && e.body.qty === qty), 'het lijf met een wachtwoord ' + vorm + ' staat in het journaal');
  }
  for (const stuk of ['-plat', '-genest', '-lijst']) {
    assert.ok(!rauw.includes(merk + stuk), 'het wachtwoord "' + stuk + '" staat in het doosjournaal');
  }
});
