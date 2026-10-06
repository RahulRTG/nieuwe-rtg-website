/* ============================================================================
   DE WERKPLEKINLOG VRAAGT DE TWEEDE FACTOR -- regressie voor N19 uit de V1-audit.

   DE FOUT: POST /api/supplier/mijn/login gaf een RTG-lid op e-mail en wachtwoord
   meteen een werksessie die aan zijn account hangt, ook met de tweede factor
   aan. tweefactor.inlogPoort werd niet gevraagd en het pad stond niet in de
   inlogpauze. De eindkeuring van ronde 4 zag het zelf: /api/auth/login gaf voor
   dat lid een bewijs, deze deur een token, en met dat token opende
   /api/supplier/state.

   DE FIX (server/routes/supplier/pda/posities-inlog.js, besluit van de eigenaar):
   dezelfde tweede stap als de gewone inlog. Met de tweede factor aan geeft het
   wachtwoord alleen een bewijs met een EIGEN doel (`werk2`) en geen werksessie,
   en dezelfde route ruilt { bewijs, code } om. De rem op de code is de gedeelde
   (server/kern/identiteit/tweedestap-rem.js), het bewijs valt onder de
   sessiegrens van N12, en het pad staat in INLOG_PADEN.

   Elk account dat hier een slot of een nieuw wachtwoord krijgt, is een eigen
   account, zodat de toetsen niet van elkaars volgorde afhangen. Nora Prins uit
   de zaaiset (Sal de Mar en Vora Beach Club) draagt de gewone weg.

   Draai los: node --test test/werkplek-tweede.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { totpCode } = require('../server/kern/totp');
const { zwaarApi } = require('./zwaarpasskey');

const NORA = 'nora@rtg.example', NORA_WW = 'werk';
const EIGENAAR = 'roellie.i@gmail.com', EIGENAAR_WW = 'Imran';
const WW = 'geheim12';
let srv, dir, eigenaarToken, managerToken, zaakNaam, nora;

async function api(pad, body, token, ip) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (ip) headers['X-Forwarded-For'] = ip;
  const r = await fetch(srv.base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const kort = (b) => JSON.stringify(b).slice(0, 200);
const verkeerdeCode = (geheim) => {
  const geldig = new Set([-30000, 0, 30000].map(d => totpCode(geheim, Date.now() + d, 30)));
  let c = '000000';
  for (let i = 0; geldig.has(c); i++) c = String(100000 + i);
  return c;
};
const werkLogin = (login, password, extra, ip) =>
  api('/api/supplier/mijn/login', Object.assign({ login, password }, extra || {}), null, ip);

/* De tweede factor aanzetten op een account waarvoor we een ledentoken hebben.

   `code()` geeft telkens een JUISTE code die nog niet gebruikt is. Een
   TOTP-code werkt een keer (server/kern/totp.js weigert een herhaling binnen
   zijn venster) en het venster kent er drie, waarvan het aanzetten er al een
   opmaakt; daarna komt er een herstelcode. Zo zakt een toets die vaker de juiste
   code nodig heeft niet op de herhaalrem in plaats van op wat hij toetst.

   Nooit de code van de VORIGE stap: die is nog maar tot de volgende stapgrens
   geldig, en dat kan een paar milliseconden zijn (de e2e viel daar onder
   belasting een keer precies tussen). Deze stap en de volgende blijven
   minstens dertig seconden geldig. */
async function zetTweedeAan(token, wachtwoord) {
  const begin = await api('/api/mijn/tweefactor/begin', { huidig: wachtwoord }, token);
  assert.ok(begin.body.geheim, 'tweede factor beginnen: ' + kort(begin.body));
  const geheim = begin.body.geheim, eerste = totpCode(geheim, Date.now(), 30);
  const aan = await api('/api/mijn/tweefactor/bevestig', { code: eerste }, token);
  assert.equal(aan.status, 200, 'tweede factor aan: ' + kort(aan.body));
  const herstelcodes = aan.body.herstelcodes || [];
  const gebruikt = new Set([eerste]), reserve = herstelcodes.slice(1);
  const code = () => {
    for (const d of [30000, 0]) {
      const c = totpCode(geheim, Date.now() + d, 30);
      if (!gebruikt.has(c)) { gebruikt.add(c); return c; }
    }
    return reserve.shift();
  };
  return { geheim, herstelcodes, code };
}

/* Een eigen lid met een werkplek bij Sal de Mar: registreren, door de manager
   uitgenodigd, zelf aangemeld met de kassacode. Desgewenst met tweede factor. */
async function eigenWerknemer(email, metTweede) {
  // een eigen naam per uitnodiging: dezelfde naam geeft de zaak niet twee keer uit
  const naam = 'Werk ' + email.split('@')[0].replace(/[^a-z]+/g, ' ').trim();
  const reg = await api('/api/auth/register', { name: naam, email, password: WW, geboortedatum: '1990-01-01' });
  assert.ok(reg.body.token, 'registratie: ' + kort(reg.body));
  const inv = await api('/api/supplier/staff/invite', { name: naam, func: 'Bediening' }, managerToken);
  assert.equal(inv.status, 200, 'uitnodiging: ' + kort(inv.body));
  const join = await api('/api/supplier/staff/join', { bedrijf: zaakNaam, kassacode: inv.body.invite.kassacode,
    login: email, password: WW });
  assert.equal(join.status, 200, 'aanmelding bij de zaak: ' + kort(join.body));
  const lid = { email, token: reg.body.token, staffId: join.body.staffId };
  if (metTweede) Object.assign(lid, await zetTweedeAan(reg.body.token, WW));
  return lid;
}

test.before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werk2-'));
  srv = await startServer({ env: { RTG_DATA_DIR: dir, SMTP_URL: '', RTG_OWNER_EMAIL: '' } });
  const eig = await api('/api/auth/login', { login: EIGENAAR, password: EIGENAAR_WW, pasApp: 'business' });
  assert.ok(eig.body.token, 'de eigenaar logt in: ' + kort(eig.body));
  eigenaarToken = eig.body.token;
  const roster = await api('/api/supplier/roster', { code: 'KIKUNOI' });
  zaakNaam = roster.body.supplier.name;
  const manager = roster.body.staff.find(x => x.role === 'manager');
  const ml = await api('/api/supplier/login', { code: 'KIKUNOI', staffId: manager.id, pin: '1234' });
  assert.ok(ml.body.token, 'de manager van de zaak logt in: ' + kort(ml.body));
  managerToken = ml.body.token;
});
test.after(async () => {
  await stop(srv);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
});

test('1. zonder tweede factor verandert er niets: het wachtwoord geeft meteen de werksessie', async () => {
  const r = await werkLogin(NORA, NORA_WW);
  assert.equal(r.status, 200, kort(r.body));
  assert.ok(r.body.token, 'zonder tweede factor is het wachtwoord genoeg, zoals bij /api/auth/login');
  assert.equal(r.body.tweedeFactorNodig, undefined);
  assert.equal(r.body.posities.length, 2, 'beide werkplekken staan klaar');
  assert.equal((await api('/api/supplier/state', {}, r.body.token)).status, 200);
});

test('2. met de tweede factor aan geeft het wachtwoord een bewijs en geen werksessie', async () => {
  const lid = await api('/api/auth/login', { login: NORA, password: NORA_WW });
  assert.ok(lid.body.token, 'Nora logt in als lid: ' + kort(lid.body));
  nora = await zetTweedeAan(lid.body.token, NORA_WW);

  const r = await werkLogin(NORA, NORA_WW);
  assert.equal(r.status, 200, kort(r.body));
  assert.equal(r.body.token, undefined, 'op alleen het wachtwoord hoort er geen werksessie uit te komen');
  assert.equal(r.body.tweedeFactorNodig, true);
  assert.ok(r.body.bewijs, 'wel een bewijs voor de tweede stap');
  assert.equal(r.body.posities, undefined, 'en nog geen werkplekken: die horen bij een bewezen lid');
  assert.equal(r.body.state, undefined);
  const metBewijs = await api('/api/supplier/state', {}, r.body.bewijs);
  assert.equal(metBewijs.status, 401, 'het bewijs is geen sessie (kreeg ' + metBewijs.status + ')');
});

test('3. bewijs plus de juiste code geeft de werksessie, op het gevraagde bedrijf', async () => {
  const stap1 = await werkLogin(NORA, NORA_WW, { bedrijf: 'VORA' });
  assert.ok(stap1.body.bewijs, kort(stap1.body));
  const fout = await api('/api/supplier/mijn/login', { bewijs: stap1.body.bewijs, code: verkeerdeCode(nora.geheim), bedrijf: 'VORA' });
  assert.equal(fout.status, 403, 'een verkeerde code weigert: ' + kort(fout.body));
  assert.equal(fout.body.token, undefined);
  const goed = await api('/api/supplier/mijn/login', { bewijs: stap1.body.bewijs, code: nora.code(), bedrijf: 'VORA' });
  assert.equal(goed.status, 200, 'een typefout trekt het bewijs niet in: ' + kort(goed.body));
  assert.ok(goed.body.token);
  assert.equal(goed.body.supplier.code, 'VORA', 'het gevraagde bedrijf reist met de tweede stap mee');
  assert.equal(goed.body.posities.length, 2);
  assert.equal((await api('/api/supplier/state', {}, goed.body.token)).status, 200, 'de werksessie werkt');
  const nogEens = await api('/api/supplier/mijn/login', { bewijs: stap1.body.bewijs, code: nora.code() });
  assert.equal(nogEens.status, 401, 'een gebruikt bewijs werkt geen tweede keer');
  // een bedrijf waar Nora niet werkt telt niet: ze landt op een eigen werkplek
  const stap1b = await werkLogin(NORA, NORA_WW);
  const vreemd = await api('/api/supplier/mijn/login', { bewijs: stap1b.body.bewijs, code: nora.code(), bedrijf: 'HOSHI' });
  assert.equal(vreemd.status, 200, kort(vreemd.body));
  assert.ok(['KIKUNOI', 'VORA'].includes(vreemd.body.supplier.code), 'nooit een zaak waar zij niet op het rooster staat');
});

test('4. foute codes tellen in de gedeelde rem: na tien is het dicht, ook bij /api/auth/tweede', async () => {
  const lid = await eigenWerknemer('werk2-rem@voorbeeld.test', true);
  for (let i = 1; i <= 10; i++) {
    const ip = '198.51.100.' + i;
    const stap1 = await werkLogin(lid.email, WW, null, ip);
    assert.ok(stap1.body.bewijs, 'poging ' + i + ': ' + kort(stap1.body));
    const r = await api('/api/supplier/mijn/login', { bewijs: stap1.body.bewijs, code: verkeerdeCode(lid.geheim) }, null, ip);
    assert.equal(r.status, 403, 'poging ' + i);
  }
  const stap1 = await werkLogin(lid.email, WW, null, '198.51.100.99');
  const dicht = await api('/api/supplier/mijn/login', { bewijs: stap1.body.bewijs, code: lid.code() }, null, '198.51.100.99');
  assert.equal(dicht.status, 429, 'op slot is op slot, ook voor de juiste code (kreeg ' + dicht.status + ')');
  assert.equal(dicht.body.token, undefined);
  const viaLid = await api('/api/auth/login', { login: lid.email, password: WW }, null, '198.51.100.98');
  assert.ok(viaLid.body.bewijs, 'de gewone inlog vraagt ook de tweede factor: ' + kort(viaLid.body));
  const tweede = await api('/api/auth/tweede', { bewijs: viaLid.body.bewijs, code: lid.code() }, null, '198.51.100.98');
  assert.equal(tweede.status, 429, 'dezelfde accountemmer als de gewone tweede stap');
});

test('5. de bewijzen zijn niet uitwisselbaar met inlog2 en tech2', async () => {
  const lid = await eigenWerknemer('werk2-wissel@voorbeeld.test', true);
  const toegang = await api('/api/techniek/toegang', { email: lid.email }, eigenaarToken);
  assert.equal(toegang.status, 200, 'de eigenaar geeft techniektoegang: ' + kort(toegang.body));

  const werk = await werkLogin(lid.email, WW);
  assert.ok(werk.body.bewijs, kort(werk.body));
  const werkBijLid = await api('/api/auth/tweede', { bewijs: werk.body.bewijs, code: lid.code() });
  assert.equal(werkBijLid.status, 401, 'een werkplekbewijs geeft bij /api/auth/tweede geen ledentoken');
  const werkBijTech = await api('/api/techniek/inloggen', { bewijs: werk.body.bewijs, code: lid.code() });
  assert.equal(werkBijTech.status, 401, 'en opent de techniekpagina niet');

  const inlog = await api('/api/auth/login', { login: lid.email, password: WW });
  assert.ok(inlog.body.bewijs, kort(inlog.body));
  const inlogHier = await api('/api/supplier/mijn/login', { bewijs: inlog.body.bewijs, code: lid.code() });
  assert.equal(inlogHier.status, 401, 'een gewoon inlogbewijs opent de werkplek niet');
  assert.equal(inlogHier.body.token, undefined);

  const tech = await api('/api/techniek/inloggen', { login: lid.email, wachtwoord: WW });
  assert.ok(tech.body.bewijs, 'met recht en tweede factor geeft de techniekpagina een bewijs: ' + kort(tech.body));
  const techHier = await api('/api/supplier/mijn/login', { bewijs: tech.body.bewijs, code: lid.code() });
  assert.equal(techHier.status, 401, 'een techniekbewijs opent de werkplek niet');
  assert.equal(techHier.body.token, undefined);

  // en het eigen bewijs werkt nog: de weigeringen hierboven lagen aan het doel
  const eigen = await api('/api/supplier/mijn/login', { bewijs: werk.body.bewijs, code: lid.code() });
  assert.equal(eigen.status, 200, kort(eigen.body));
  assert.ok(eigen.body.token);
});

test('6. een wachtwoordwijziging tussen stap een en twee laat het bewijs vervallen', async () => {
  const lid = await eigenWerknemer('werk2-ww@voorbeeld.test', true);
  const stap1 = await werkLogin(lid.email, WW);
  assert.ok(stap1.body.bewijs, kort(stap1.body));
  // de grens moet aantoonbaar NA het uitgiftemoment liggen: wacht op de volgende kloktik
  const uitgegeven = Date.now();
  while (Date.now() <= uitgegeven) await new Promise(r => setTimeout(r, 1));
  const wissel = await api('/api/auth/password', { huidig: WW, nieuw: 'geheim-nieuw-34' }, lid.token);
  assert.equal(wissel.status, 200, 'wachtwoord wijzigen: ' + kort(wissel.body));
  const stap2 = await api('/api/supplier/mijn/login', { bewijs: stap1.body.bewijs, code: lid.code() });
  assert.equal(stap2.status, 401, 'een bewijs van het oude wachtwoord telt niet meer (kreeg ' + stap2.status + ')');
  assert.equal(stap2.body.token, undefined);
  // tegenproef: met het nieuwe wachtwoord gaat het gewoon
  const vers = await werkLogin(lid.email, 'geheim-nieuw-34');
  const goed = await api('/api/supplier/mijn/login', { bewijs: vers.body.bewijs, code: lid.code() });
  assert.equal(goed.status, 200, kort(goed.body));
});

test('7. de inlogpauze houdt beide stappen tegen met 503', async () => {
  const stap1 = await werkLogin(NORA, NORA_WW);
  assert.ok(stap1.body.bewijs, 'een bewijs van voor de pauze: ' + kort(stap1.body));
  const tech = await api('/api/techniek/inloggen', { login: EIGENAAR, wachtwoord: EIGENAAR_WW });
  assert.ok(tech.body.token, 'de eigenaar op de techniekpagina: ' + kort(tech.body));
  const spring = await api('/api/techniek/zekering', { id: 'inlogpauze', actie: 'spring', reden: 'toets N19' }, tech.body.token);
  assert.equal(spring.status, 200, kort(spring.body));
  try {
    const een = await werkLogin(NORA, NORA_WW);
    assert.equal(een.status, 503, 'het wachtwoord komt tijdens de pauze niet aan (kreeg ' + een.status + ')');
    const twee = await api('/api/supplier/mijn/login', { bewijs: stap1.body.bewijs, code: nora.code() });
    assert.equal(twee.status, 503, 'de tweede stap loopt over hetzelfde pad en wacht ook');
  } finally {
    const reset = await api('/api/techniek/zekering', { id: 'inlogpauze', actie: 'reset' }, tech.body.token);
    assert.equal(reset.status, 200, kort(reset.body));
  }
  const na = await api('/api/supplier/mijn/login', { bewijs: stap1.body.bewijs, code: nora.code() });
  assert.equal(na.status, 200, 'na de pauze werkt hetzelfde bewijs weer: ' + kort(na.body));
});

test('8. zonder tweefactor.inlogPoort of zonder zijn rem start de route niet', () => {
  const maak = require('../server/routes/supplier/pda/posities-inlog');
  const geen = () => {};
  const ctx = { app: { post: geen }, accounts: {}, tooManyTries: geen, noteFailedTry: geen, loginFails: new Map(),
    logActivity: geen, heeftKantoor: geen };
  const werk = { posities: geen, antwoord: geen };
  assert.throws(() => maak(ctx, werk), /inlogPoort/, 'zonder tweefactor');
  assert.throws(() => maak(Object.assign({}, ctx, { tweefactor: { rem: {} } }), werk), /inlogPoort/, 'zonder inlogpoort');
  assert.throws(() => maak(Object.assign({}, ctx, { tweefactor: { inlogPoort: geen } }), werk), /inlogPoort/, 'zonder rem');
  const routes = [];
  maak(Object.assign({}, ctx, { app: { post: (p) => routes.push(p) }, tweefactor: { inlogPoort: geen, rem: {} } }), werk);
  assert.deepEqual(routes, ['/api/supplier/mijn/login'], 'met beide wel');
});

test('9. de werkplekken worden na de code opnieuw gelezen: van het rooster gehaald is geen sessie', async () => {
  const lid = await eigenWerknemer('werk2-rooster@voorbeeld.test', true);
  const stap1 = await werkLogin(lid.email, WW);
  assert.ok(stap1.body.bewijs, kort(stap1.body));
  const weg = await api('/api/supplier/staff/remove', { staffId: lid.staffId }, managerToken);
  assert.equal(weg.status, 200, 'de manager haalt hem van het rooster: ' + kort(weg.body));
  const stap2 = await api('/api/supplier/mijn/login', { bewijs: stap1.body.bewijs, code: lid.code() });
  assert.equal(stap2.status, 404, 'geen werkplek meer, dus geen werksessie: ' + kort(stap2.body));
  assert.equal(stap2.body.token, undefined);
});

test('10. of het lid nog actief is, wordt in stap twee opnieuw gelezen, VOOR de code', async () => {
  const zw = await zwaarApi((p, b, t) => api(p, b, t), srv.base, eigenaarToken);
  const sso = await zw('/api/techniek/sso', { org: 'werk2org', naam: 'Werk BV', issuer: 'https://login.werk2-idp.test',
    clientId: 'rtg-werk2', clientSecret: 'werk2-geheim', domeinen: ['werk2-org.test'], actief: true }, eigenaarToken);
  assert.equal(sso.status, 200, 'SSO-koppeling: ' + kort(sso.body));
  const sleutel = await api('/api/techniek/sso/scimsleutel', { org: 'werk2org' }, eigenaarToken);
  assert.equal(sleutel.status, 200, 'SCIM-sleutel: ' + kort(sleutel.body));
  const scimKop = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (sleutel.body.sleutel || sleutel.body.token) };

  const lid = await eigenWerknemer('werk2-uit@werk2-org.test', true);
  const stap1 = await werkLogin(lid.email, WW);
  assert.ok(stap1.body.bewijs, kort(stap1.body));
  const zoek = await fetch(srv.base + '/api/scim/v2/Users?filter=' + encodeURIComponent('userName eq "' + lid.email + '"'), { headers: scimKop });
  const lijst = await zoek.json();
  const id = lijst.Resources && lijst.Resources[0] && lijst.Resources[0].id;
  assert.ok(id, 'de organisatie vindt haar medewerker: ' + kort(lijst));
  const uit = await fetch(srv.base + '/api/scim/v2/Users/' + encodeURIComponent(id), { method: 'PATCH', headers: scimKop,
    body: JSON.stringify({ schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'], Operations: [{ op: 'replace', path: 'active', value: false }] }) });
  assert.equal(uit.status, 200, 'de organisatie meldt hem uit dienst');

  // een verkeerde code krijgt 401 en geen 403: de stand komt voor de code
  const fout = await api('/api/supplier/mijn/login', { bewijs: stap1.body.bewijs, code: verkeerdeCode(lid.geheim) });
  assert.equal(fout.status, 401, 'uit dienst wordt gelezen voor de code wordt getoetst (kreeg ' + fout.status + ')');
  const goed = await api('/api/supplier/mijn/login', { bewijs: stap1.body.bewijs, code: lid.code() });
  assert.equal(goed.status, 401, 'ook met de juiste code geen werksessie: ' + kort(goed.body));
  assert.equal(goed.body.token, undefined);
});

test('11. een herstelcode werkt als tweede stap en zegt hoeveel er over zijn', async () => {
  const lid = await eigenWerknemer('werk2-herstel@voorbeeld.test', true);
  assert.ok(lid.herstelcodes.length > 1, 'er zijn herstelcodes uitgegeven');
  const stap1 = await werkLogin(lid.email, WW);
  const r = await api('/api/supplier/mijn/login', { bewijs: stap1.body.bewijs, code: lid.herstelcodes[0] });
  assert.equal(r.status, 200, kort(r.body));
  assert.ok(r.body.token);
  assert.equal(r.body.soort, 'herstelcode');
  assert.match(String(r.body.let || ''), /herstelcode/, 'het lid hoort hoeveel er nog over zijn');
  const nogEens = await api('/api/supplier/mijn/login', { bewijs: (await werkLogin(lid.email, WW)).body.bewijs, code: lid.herstelcodes[0] });
  assert.equal(nogEens.status, 403, 'een herstelcode werkt een keer');
});

test('12. met alleen het wachtwoord hoort niemand of dit account ergens werkt', async () => {
  /* Zonder tweede factor zegt de deur na het wachtwoord meteen "u staat nergens
     op het rooster" (test/pda-aanmelden.test.js). Met de tweede factor aan komt
     dat antwoord pas na de code: wie alleen het wachtwoord kent, krijgt hetzelfde
     bewijs als een lid met een werkplek. */
  const email = 'werk2-los@voorbeeld.test';
  const reg = await api('/api/auth/register', { name: 'Werk Los', email, password: WW, geboortedatum: '1990-01-01' });
  assert.ok(reg.body.token, 'registratie: ' + kort(reg.body));
  const los = await zetTweedeAan(reg.body.token, WW);
  const stap1 = await werkLogin(email, WW);
  assert.equal(stap1.status, 200, 'geen 404 op alleen het wachtwoord: ' + kort(stap1.body));
  assert.equal(stap1.body.tweedeFactorNodig, true);
  assert.ok(stap1.body.bewijs);
  assert.equal(stap1.body.kantoor, undefined);
  const stap2 = await api('/api/supplier/mijn/login', { bewijs: stap1.body.bewijs, code: los.code() });
  assert.equal(stap2.status, 404, 'na de code wel het eerlijke antwoord: ' + kort(stap2.body));
  assert.equal(stap2.body.token, undefined);
});

test('13. een geslaagde code bij de werkdeur leegt de accountemmer van de gedeelde rem', async () => {
  /* Negen typefouten en dan de juiste code: daarna begint het account opnieuw
     bij nul. Zonder rem.gelukt bleven de negen staan, en zette de eerstvolgende
     typefout van het lid hem vijf minuten buiten, ook met de juiste code in de
     hand (het patroon van test/tweede-rem.test.js toets 6, nu voor deze deur).
     Een eigen adres, zodat de bronemmer van de andere toetsen niet meetelt. */
  const lid = await eigenWerknemer('werk2-gelukt@voorbeeld.test', true);
  const ip = '198.51.100.150';
  const fout = verkeerdeCode(lid.geheim);
  let stap1 = await werkLogin(lid.email, WW, null, ip);
  assert.ok(stap1.body.bewijs, kort(stap1.body));
  for (let i = 1; i <= 9; i++) {
    const r = await api('/api/supplier/mijn/login', { bewijs: stap1.body.bewijs, code: fout }, null, ip);
    assert.equal(r.status, 403, 'typefout ' + i);
  }
  const binnen = await api('/api/supplier/mijn/login', { bewijs: stap1.body.bewijs, code: lid.code() }, null, ip);
  assert.equal(binnen.status, 200, 'de juiste code na negen typefouten geeft de werksessie: ' + kort(binnen.body));
  assert.ok(binnen.body.token);
  stap1 = await werkLogin(lid.email, WW, null, ip);
  assert.ok(stap1.body.bewijs, kort(stap1.body));
  for (let i = 1; i <= 9; i++) {
    const r = await api('/api/supplier/mijn/login', { bewijs: stap1.body.bewijs, code: fout }, null, ip);
    assert.equal(r.status, 403, 'na een geslaagde code telt de emmer opnieuw vanaf nul (typefout ' + i + ', kreeg ' + r.status + ')');
  }
  const weer = await api('/api/supplier/mijn/login', { bewijs: stap1.body.bewijs, code: lid.code() }, null, ip);
  assert.equal(weer.status, 200, 'en de juiste code werkt nog, geen slot: ' + kort(weer.body));
  assert.ok(weer.body.token);
});
