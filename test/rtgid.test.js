/* RTG iD: de DigiD-vervanger op de eigen identiteitskluis. Bewaakt de
   koppelflow (code, bevestigen, weigeren, eenmalig token), de selectieve
   gegevensdeling (18plus zonder geboortedatum, alleen wat gevraagd is),
   het inzagelog met intrekken, machtigingen (mantelzorg) en de poorten.
   Draai los: node --experimental-sqlite --test test/rtgid.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { maakAuthenticator } = require('./webauthn-authenticator');

let srv, base, lidA, lidB, codeA, codeB, pkA, pkB, rpID, origin;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-id-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid(geboortedatum) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Lid ' + seq, email: 'id' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum, geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  const st = await api('/api/state', {}, reg.body.token);
  return { token: reg.body.token, codenaam: st.body.state.user.codename };
}

/* Een passkey aan een account hangen, met de echte ceremonie. De teller loopt
   per sleutel op: de server weigert een assertie waarvan de teller niet is
   gestegen (dat is de kloondetectie), dus een vaste teller zou de tweede inlog
   van elk lid laten zakken om een reden die niets met deze toets te maken
   heeft. */
async function passkeyVoor(token, naam) {
  const a = maakAuthenticator(rpID);
  const o = await api('/api/webauthn/registreer/opties', {}, token);
  assert.equal(o.status, 200);
  const r = await api('/api/webauthn/registreer',
    { antwoord: a.registratieAntwoord(o.body.opties.challenge, origin), naam: naam || 'Toetssleutel' }, token);
  assert.equal(r.status, 200, 'de passkey staat er: ' + JSON.stringify(r.body).slice(0, 160));
  let teller = 0;
  return { teken: (challenge) => a.loginAntwoord(challenge, origin, ++teller) };
}

/* Bevestigen in twee slagen: een ceremonie voor DEZE koppel, dan de assertie. */
async function bevestigMet(pk, token, koppelId, machtigingId) {
  const o = await api('/api/rtgid/stapop/opties', { koppelId }, token);
  assert.equal(o.status, 200, 'een ceremonie voor deze koppel: ' + JSON.stringify(o.body).slice(0, 160));
  return api('/api/rtgid/bevestig', { koppelId, machtigingId,
    ceremonie: o.body.ceremonie, antwoord: pk.teken(o.body.opties.challenge) }, token);
}

// de dienst-kant start een inlog; het lid zoekt de code op en bevestigt
async function inlog(dienst, attributen, lidToken, machtigingId, pk) {
  const s = await api('/api/rtgid/start', { dienst, attributen });
  assert.equal(s.status, 200);
  const k = await api('/api/rtgid/koppel', { code: s.body.code }, lidToken);
  assert.equal(k.status, 200);
  const b = await bevestigMet(pk || pkA, lidToken, k.body.koppelId, machtigingId);
  assert.equal(b.status, 200, 'bevestigen lukte: ' + JSON.stringify(b.body).slice(0, 160));
  const st = await api('/api/rtgid/status', { koppelId: s.body.koppelId });
  assert.equal(st.body.stand, 'bevestigd');
  return { idToken: st.body.idToken, koppelId: s.body.koppelId, code: s.body.code };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  /* De route leidt rpID en origin af uit het verzoek zelf, dus de authenticator
     moet voor exact diezelfde gastheer tekenen. */
  rpID = new URL(base).hostname; origin = new URL(base).origin;
  const a = await lid('1990-05-05'); const b = await lid('1992-02-02');
  lidA = a.token; codeA = a.codenaam; lidB = b.token; codeB = b.codenaam;
  assert.ok(lidA && lidB && codeA && codeB, 'twee leden met codenamen');
  pkA = await passkeyVoor(lidA, 'Telefoon van A');
  pkB = await passkeyVoor(lidB, 'Telefoon van B');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de koppelflow: code, dienstnaam in de app, bevestigen, eenmalig token', async () => {
  const s = await api('/api/rtgid/start', { dienst: 'MijnOverheid', attributen: ['codenaam', '18plus'] });
  assert.match(s.body.code, /^ID-[A-Z2-9]{5}$/, 'een koppelcode zonder verwarrende tekens');
  const k = await api('/api/rtgid/koppel', { code: s.body.code }, lidA);
  assert.equal(k.body.dienst, 'MijnOverheid', 'het lid ziet WIE er aanklopt voor er iets gebeurt');
  assert.deepEqual(k.body.attributen, ['codenaam', '18plus'], 'en welke gegevens er gevraagd worden');
  assert.equal((await api('/api/rtgid/status', { koppelId: s.body.koppelId })).body.stand, 'wacht');
  assert.equal(k.body.passkeys, 1, 'het scherm hoort te weten dat er een passkey is om mee te bevestigen');
  assert.equal((await bevestigMet(pkA, lidA, k.body.koppelId)).status, 200);
  const st = await api('/api/rtgid/status', { koppelId: s.body.koppelId });
  assert.equal(st.body.stand, 'bevestigd');
  assert.ok(st.body.idToken, 'het token komt precies een keer mee');
  const nogEen = await api('/api/rtgid/status', { koppelId: s.body.koppelId });
  assert.ok(!nogEen.body.idToken, 'en daarna nooit meer');
  // dezelfde code is daarna waardeloos
  assert.equal((await api('/api/rtgid/koppel', { code: s.body.code }, lidB)).status, 404);
});

test('2. selectieve deling: 18plus als bewijs, nooit meer dan gevraagd', async () => {
  const { idToken } = await inlog('Slijterij De Kurk', ['18plus'], lidA);
  const wie = await api('/api/rtgid/wie', { idToken });
  assert.equal(wie.status, 200);
  assert.equal(wie.body.dienst, 'Slijterij De Kurk');
  assert.equal(wie.body.attributen['18plus'], true, 'het bewijs 18-plus');
  assert.ok(!('leeftijd' in wie.body.attributen), 'geen leeftijd');
  assert.ok(!('naam' in wie.body.attributen), 'geen naam');
  assert.ok(!JSON.stringify(wie.body).includes('geboortedatum'), 'de geboortedatum verlaat de kluis nooit');
});

test('3. weigeren: er wordt niets gedeeld en er komt geen token', async () => {
  const s = await api('/api/rtgid/start', { dienst: 'Vage Webshop' });
  const k = await api('/api/rtgid/koppel', { code: s.body.code }, lidA);
  await api('/api/rtgid/weiger', { koppelId: k.body.koppelId }, lidA);
  const st = await api('/api/rtgid/status', { koppelId: s.body.koppelId });
  assert.equal(st.body.stand, 'geweigerd');
  assert.ok(!st.body.idToken);
});

test('4. het inzagelog en intrekken: het lid houdt de regie', async () => {
  const { idToken } = await inlog('Gemeente Ibiza', ['codenaam'], lidA);
  const inz = await api('/api/rtgid/inzage', {}, lidA);
  assert.ok(inz.body.log.some(l => l.dienst === 'Gemeente Ibiza' && l.soort === 'inlog'), 'de inlog staat in het log');
  assert.ok(inz.body.sessies.some(s => s.dienst === 'Gemeente Ibiza'), 'de actieve sessie is zichtbaar');
  await api('/api/rtgid/intrek', { dienst: 'Gemeente Ibiza' }, lidA);
  assert.equal((await api('/api/rtgid/wie', { idToken })).status, 403, 'na intrekken is het token dood');
  const na = await api('/api/rtgid/inzage', {}, lidA);
  assert.ok(na.body.log.some(l => l.soort === 'toegang ingetrokken'));
});

test('5. machtigen (mantelzorg): B logt in namens A, herroepbaar, alles in het log van A', async () => {
  const m = await api('/api/rtgid/machtig', { codenaam: codeB, dienst: 'MijnOverheid', dagen: 30 }, lidA);
  assert.equal(m.status, 200);
  const mId = m.body.machtiging.id;
  // B ziet de machtiging bij het opzoeken van een code voor die dienst
  const s = await api('/api/rtgid/start', { dienst: 'MijnOverheid', attributen: ['codenaam'] });
  const k = await api('/api/rtgid/koppel', { code: s.body.code }, lidB);
  assert.ok(k.body.machtigingen.some(x => x.id === mId), 'B kan kiezen: als zichzelf of namens A');
  const { idToken } = await inlog('MijnOverheid', ['codenaam'], lidB, mId, pkB);
  const wie = await api('/api/rtgid/wie', { idToken });
  assert.equal(wie.body.attributen.codenaam, codeA, 'de dienst ziet de identiteit van A');
  assert.equal(wie.body.namens, codeB, 'met de vermelding dat een gemachtigde handelde');
  const logA = await api('/api/rtgid/inzage', {}, lidA);
  assert.ok(logA.body.log.some(l => l.soort.includes('gemachtigde')), 'A ziet de inlog in het eigen log');
  // een machtiging geldt alleen voor de eigen dienst
  const s2 = await api('/api/rtgid/start', { dienst: 'Belastingdienst', attributen: ['codenaam'] });
  const k2 = await api('/api/rtgid/koppel', { code: s2.body.code }, lidB);
  assert.equal((await bevestigMet(pkB, lidB, k2.body.koppelId, mId)).status, 403);
  // en intrekken maakt er direct een einde aan
  await api('/api/rtgid/machtig/intrek', { id: mId }, lidA);
  assert.equal((await api('/api/rtgid/wie', { idToken })).status, 403, 'lopende namens-sessies gaan mee dicht');
});

test('6. de poorten: vals token, onbekende koppel, gast en anoniem', async () => {
  assert.equal((await api('/api/rtgid/wie', { idToken: 'vals' })).status, 403);
  assert.equal((await api('/api/rtgid/status', { koppelId: 'bestaatniet' })).status, 404);
  assert.equal((await api('/api/rtgid/inzage', {})).status, 401, 'de app-kant vraagt een leden-inlog');
  const gast = (await api('/api/login', { tier: 'guest', pasApp: 'rtg' })).body.token;
  assert.equal((await api('/api/rtgid/inzage', {}, gast)).status, 403, 'gasten hebben geen iD');
  assert.equal((await api('/api/rtgid/start', {})).status, 400, 'zonder dienstnaam geen koppel');
});

/* ---- de passkey-eis: bevestigen bewijst de PERSOON, niet het toestel ---- */

test('7. zonder passkey komt er geen bevestiging, en dus geen token', async () => {
  /* De oude tik in de app bewees dat iemand het TOESTEL had waarop de sessie
     leeft. Een geleende of gestolen telefoon met een openstaande app kon dus
     een identiteit weggeven. Dit is de toets die dat afsluit. */
  const s = await api('/api/rtgid/start', { dienst: 'MijnOverheid', attributen: ['codenaam'] });
  const k = await api('/api/rtgid/koppel', { code: s.body.code }, lidA);
  const kaal = await api('/api/rtgid/bevestig', { koppelId: k.body.koppelId }, lidA);
  assert.equal(kaal.status, 401, 'bevestigen zonder assertie kan niet');
  const st = await api('/api/rtgid/status', { koppelId: s.body.koppelId });
  assert.equal(st.body.stand, 'wacht', 'en de inlog staat gewoon nog te wachten');
  assert.ok(!st.body.idToken, 'er is niets gedeeld');
});

test('8. een assertie voor een ANDERE inlog past hier niet', async () => {
  /* De kern van de binding. Zonder deze regel zou een assertie die het lid gaf
     voor de slijterij, door een opvanger te hergebruiken zijn op een inlog bij
     de gemeente -- en dan bewijst de biometrie alleen dat er ooit een vinger op
     het toestel lag, niet dat iemand hiermee akkoord ging. */
  const een = await api('/api/rtgid/start', { dienst: 'Slijterij De Kurk', attributen: ['18plus'] });
  const twee = await api('/api/rtgid/start', { dienst: 'Gemeente Ibiza', attributen: ['codenaam'] });
  const kEen = await api('/api/rtgid/koppel', { code: een.body.code }, lidA);
  const kTwee = await api('/api/rtgid/koppel', { code: twee.body.code }, lidA);

  // een ceremonie die bij de EERSTE koppel hoort...
  const cer = await api('/api/rtgid/stapop/opties', { koppelId: kEen.body.koppelId }, lidA);
  assert.equal(cer.status, 200);
  // ...maar gebruikt op de TWEEDE
  const fout = await api('/api/rtgid/bevestig', { koppelId: kTwee.body.koppelId,
    ceremonie: cer.body.ceremonie, antwoord: pkA.teken(cer.body.opties.challenge) }, lidA);
  assert.equal(fout.status, 401);
  assert.match(fout.body.error, /andere handeling/i, 'en het zegt precies wat er niet klopt');
  assert.equal((await api('/api/rtgid/status', { koppelId: twee.body.koppelId })).body.stand, 'wacht');
});

test('9. de passkey van een ander bevestigt niets', async () => {
  const s = await api('/api/rtgid/start', { dienst: 'MijnOverheid', attributen: ['codenaam'] });
  const k = await api('/api/rtgid/koppel', { code: s.body.code }, lidA);
  const cer = await api('/api/rtgid/stapop/opties', { koppelId: k.body.koppelId }, lidA);
  // A vraagt de ceremonie aan, B tekent hem
  const fout = await api('/api/rtgid/bevestig', { koppelId: k.body.koppelId,
    ceremonie: cer.body.ceremonie, antwoord: pkB.teken(cer.body.opties.challenge) }, lidA);
  assert.equal(fout.status, 401, 'de sleutel van B hoort niet bij het account van A');
  assert.equal((await api('/api/rtgid/status', { koppelId: s.body.koppelId })).body.stand, 'wacht');
});

test('10. een ceremonie werkt precies een keer', async () => {
  const s = await api('/api/rtgid/start', { dienst: 'MijnOverheid', attributen: ['codenaam'] });
  const k = await api('/api/rtgid/koppel', { code: s.body.code }, lidA);
  const cer = await api('/api/rtgid/stapop/opties', { koppelId: k.body.koppelId }, lidA);
  const antwoord = pkA.teken(cer.body.opties.challenge);
  assert.equal((await api('/api/rtgid/bevestig', { koppelId: k.body.koppelId,
    ceremonie: cer.body.ceremonie, antwoord }, lidA)).status, 200);
  // dezelfde ceremonie EN dezelfde assertie, op een verse koppel
  const s2 = await api('/api/rtgid/start', { dienst: 'MijnOverheid', attributen: ['codenaam'] });
  const k2 = await api('/api/rtgid/koppel', { code: s2.body.code }, lidA);
  assert.equal((await api('/api/rtgid/bevestig', { koppelId: k2.body.koppelId,
    ceremonie: cer.body.ceremonie, antwoord }, lidA)).status, 401, 'een gebruikte ceremonie is op');
});

test('11. wie nog geen passkey heeft, ziet dat en kan er een maken', async () => {
  /* De eis is hard, dus de weg ernaartoe moet er zijn. Het scherm hoort te
     weten dat er nul passkeys zijn VOOR de knop, en het aanmaken moet daarna
     meteen werken -- anders is de eis een dichte deur zonder sleutelmaker. */
  const c = await lid('1991-03-03');
  const s = await api('/api/rtgid/start', { dienst: 'MijnOverheid', attributen: ['codenaam'] });
  const k = await api('/api/rtgid/koppel', { code: s.body.code }, c.token);
  assert.equal(k.body.passkeys, 0, 'het scherm weet dat er nog geen sleutel is');
  assert.equal(k.body.eigenAccount, true, 'en dat dit account er wel een kan maken');

  const zonder = await api('/api/rtgid/stapop/opties', { koppelId: k.body.koppelId }, c.token);
  assert.equal(zonder.status, 409, 'een ceremonie zonder sleutel kan niet');
  assert.equal(zonder.body.geenPasskey, true, 'en zegt met een eigen veld waarom, zodat het scherm de maakknop kan tonen');

  const pkC = await passkeyVoor(c.token, 'Nieuwe telefoon');
  const k2 = await api('/api/rtgid/koppel', { code: s.body.code }, c.token);
  assert.equal(k2.body.passkeys, 1, 'en daarna telt hij mee');
  assert.equal((await bevestigMet(pkC, c.token, k2.body.koppelId)).status, 200, 'bevestigen kan nu wel');
});

test('12. een demo-persona kan niet bevestigen, en hoort waarom', async () => {
  /* Dit is wat de harde eis kost. Een persona heeft geen eigen account en kan
     dus geen passkey maken; die krijgt geen vage weigering maar de reden. */
  const persona = (await api('/api/login', { tier: 'rtg', pasApp: 'rtg' })).body.token;
  const s = await api('/api/rtgid/start', { dienst: 'MijnOverheid', attributen: ['codenaam'] });
  const k = await api('/api/rtgid/koppel', { code: s.body.code }, persona);
  assert.equal(k.status, 200, 'opzoeken mag: hij mag zien wie er aanklopt');
  assert.equal(k.body.eigenAccount, false, 'maar het scherm weet dat hier geen sleutel te maken valt');
  const b = await api('/api/rtgid/bevestig', { koppelId: k.body.koppelId }, persona);
  assert.equal(b.status, 403);
  assert.match(b.body.error, /eigen RTG-account/i, 'met de reden erbij');
});

test('13. weigeren vraagt geen passkey: er wordt niets gedeeld', async () => {
  /* De eis hangt aan het DELEN, niet aan het bedienen van het scherm. Zou
     weigeren ook een passkey vragen, dan zou iemand zonder sleutel een
     ongewenste inlog niet eens kunnen wegklikken. */
  const c = await lid('1993-04-04');
  const s = await api('/api/rtgid/start', { dienst: 'Vage Webshop' });
  const k = await api('/api/rtgid/koppel', { code: s.body.code }, c.token);
  assert.equal((await api('/api/rtgid/weiger', { koppelId: k.body.koppelId }, c.token)).status, 200);
  assert.equal((await api('/api/rtgid/status', { koppelId: s.body.koppelId })).body.stand, 'geweigerd');
});

test('14. een ceremonie van iemand anders is niet over te nemen', async () => {
  /* Toets 9 dekt dit NIET, en dat bleek pas bij het muteren: daar tekent B met
     zijn eigen sleutel op de ceremonie van A, en dan valt hij al af doordat de
     sleutel van B niet aan het account van A hangt. De account-binding zelf
     wordt daar dus nooit geraakt.

     Hier wel. B is zelf ingelogd en tekent met zijn EIGEN sleutel, dus de
     sleutel-lookup slaagt; alleen het feit dat de ceremonie door A is
     aangevraagd houdt het tegen. Zonder die regel zou B de ceremonie van A
     kunnen afmaken op dezelfde koppel. */
  const s = await api('/api/rtgid/start', { dienst: 'MijnOverheid', attributen: ['codenaam'] });
  const kA = await api('/api/rtgid/koppel', { code: s.body.code }, lidA);
  const kB = await api('/api/rtgid/koppel', { code: s.body.code }, lidB);
  assert.equal(kA.body.koppelId, kB.body.koppelId, 'beiden kijken naar dezelfde wachtende inlog');

  // A vraagt de ceremonie aan; B maakt hem af met zijn eigen passkey
  const cerA = await api('/api/rtgid/stapop/opties', { koppelId: kA.body.koppelId }, lidA);
  assert.equal(cerA.status, 200);
  const gekaapt = await api('/api/rtgid/bevestig', { koppelId: kB.body.koppelId,
    ceremonie: cerA.body.ceremonie, antwoord: pkB.teken(cerA.body.opties.challenge) }, lidB);
  assert.equal(gekaapt.status, 401, 'de ceremonie van A is niet van B');
  assert.match(gekaapt.body.error, /ander account/i);
  assert.equal((await api('/api/rtgid/status', { koppelId: s.body.koppelId })).body.stand, 'wacht',
    'en de inlog staat nog gewoon te wachten');
});
