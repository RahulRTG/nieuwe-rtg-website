/* Een account voor alles: mensen registreren zich EEN keer; personeel, zaak
   en kantoor zijn daarna koppelingen aan dat ene account (na bewijs van de
   bestaande werk-inlog) en accStart munt exact dezelfde sessies als de losse
   logins. Draai los: node --experimental-sqlite --test test/eenaccount.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-1acc-'));
let srv, base, lid, staffId, staffNaam, staffPin;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  lid = (await api('/api/auth/register', { name: 'Sleutellid', email: 'sl' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const roster = await api('/api/supplier/roster', { code: 'KIKUNOI' });
  const staff = (roster.body.staff || []).find(s => s.role !== 'manager') || roster.body.staff[0];
  staffId = staff.id; staffNaam = staff.name;
  staffPin = staff.role === 'manager' ? '1234' : '5678';
  assert.ok(lid && staffId, 'lid geregistreerd en een personeelslid gevonden');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een anonieme gast heeft geen sleutelbos; een echt account begint leeg', async () => {
  const gast = (await api('/api/login', { tier: 'guest', pasApp: 'rtg' })).body.token;
  assert.equal((await api('/api/account/rollen', {}, gast)).status, 403, 'eerst een echt account maken');
  const leeg = await api('/api/account/rollen', {}, lid);
  assert.equal(leeg.status, 200);
  assert.deepEqual(leeg.body.rollen, [], 'nog niets gekoppeld');
});

test('2. personeel koppelen bewijst eerst de eigen PIN; daarna staat de rol op de bos', async () => {
  const fout = await api('/api/account/koppel', { soort: 'personeel', code: 'KIKUNOI', staffId, pin: '0000' }, lid);
  assert.equal(fout.status, 401, 'zonder juiste PIN geen koppeling');
  const goed = await api('/api/account/koppel', { soort: 'personeel', code: 'KIKUNOI', staffId, pin: staffPin }, lid);
  assert.equal(goed.status, 200, 'met de juiste PIN wel: ' + JSON.stringify(goed.body).slice(0, 120));
  assert.ok(goed.body.rollen.some(r => r.rol === 'personeel' && r.code === 'KIKUNOI' && r.naam === staffNaam));
});

test('3. met het ene account de PDA in: dezelfde sessie als de losse personeelslogin', async () => {
  const s = await api('/api/account/start', { rol: 'personeel', code: 'KIKUNOI', staffId }, lid);
  assert.equal(s.status, 200);
  assert.ok(s.body.token, 'er is een werk-token gemunt');
  const st = await api('/api/supplier/state', {}, s.body.token);
  assert.equal(st.status, 200, 'het token werkt op de zaak-API');
  assert.equal(st.body.state.supplier.code, 'KIKUNOI');
});

test('4. de zaak en het kantoor koppelen met hun eigen inlog, en starten', async () => {
  const z = await api('/api/account/koppel', { soort: 'zaak', username: 'rahul', password: 'Imran' }, lid);
  assert.equal(z.status, 200, 'de bedrijfsinlog bewijst de zaak-rol');
  const zs = await api('/api/account/start', { rol: 'zaak' }, lid);
  assert.equal((await api('/api/supplier/state', {}, zs.body.token)).status, 200, 'de zaak-sessie werkt');
  const kFout = await api('/api/account/koppel', { soort: 'kantoor', code: 'FOUT' }, lid);
  assert.equal(kFout.status, 401);
  const k = await api('/api/account/koppel', { soort: 'kantoor', code: 'RTG-OFFICE' }, lid);
  assert.equal(k.status, 200, 'de backoffice-code bewijst de kantoor-rol');
  const ks = await api('/api/account/start', { rol: 'kantoor' }, lid);
  assert.equal((await api('/api/office/kamers', {}, ks.body.token)).status, 200, 'de kantoor-sessie werkt op het kantoor');
  // de boardroom is de kamer van de eigenaar: een gekoppelde kantoor-rol opent hem NIET vanzelf
  assert.equal((await api('/api/office/boardroom', {}, ks.body.token)).status, 403, 'de boardroom-poort blijft dicht');
});

test('5. ontkoppelen sluit de deur weer, en de AI-stuur blijft van de sleutelbos af', async () => {
  await api('/api/account/ontkoppel', { rol: 'kantoor' }, lid);
  const s = await api('/api/account/start', { rol: 'kantoor' }, lid);
  assert.equal(s.status, 404, 'na ontkoppelen start er niets meer');
  const ai = await api('/api/member/doe', { pad: '/api/account/start', body: { rol: 'zaak' } }, lid);
  assert.equal(ai.status, 403, 'het AI-stuur mag de sleutelbos niet bedienen');
});

test('6. Rahuls welzijnszin: bij de zoveelste werkstart zegt hij iets, blokkeert hij niets', async () => {
  let zin = null;
  for (let i = 0; i < 6; i++) {
    const s = await api('/api/account/start', { rol: 'zaak' }, lid);
    assert.equal(s.status, 200, 'de start blijft gewoon werken');
    if (s.body.welzijn) zin = s.body.welzijn;
  }
  assert.ok(zin && /pauze|rust/.test(zin), 'de welzijnszin is er (pauze overdag, rust in de nacht) en is alleen een zin');
});

/* EEN PIN, EEN TELLER -- OOK ALS ER TWEE DEUREN NAAR TOE LOPEN.

   Een viercijferige pincode is bruikbaar zolang er maar een handjevol
   pogingen in past. Dat werkt alleen als de teller aan het DOEL hangt (deze
   pin) en niet aan de aanvrager. Hier hing hij aan de aanvrager: vijf
   pogingen per RTG-account per minuut, en een gratis RTG-account kost een
   e-mailadres. Twintig accounts gaven twintig keer zoveel pogingen op
   dezelfde pin, en /api/supplier/login -- de ANDERE deur naar precies
   dezelfde verifyStaffPin -- telde in zijn eigen boekje.

   Deze test loopt daarom over drie verse accounts en beide deuren. */
test('7. de pin-rem hangt aan het DOEL en wordt gedeeld met de losse personeelslogin', async () => {
  const versLid = async (n) => {
    const u = (Date.now() + n).toString().slice(-9);
    return (await api('/api/auth/register', { name: 'Raadlid ' + n, email: 'raad' + n + u + '@x.nl',
      phone: '06' + u, password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg', pasApp: 'rtg' })).body.token;
  };
  const [a, b, c] = [await versLid(1), await versLid(2), await versLid(3)];
  assert.ok(a && b && c, 'drie verse accounts');

  // account A loopt de vijf pogingen van dit doel op
  const statussen = [];
  for (let i = 0; i < 5; i++) {
    statussen.push((await api('/api/account/koppel', { soort: 'personeel', code: 'KIKUNOI', staffId, pin: '000' + i }, a)).status);
  }
  assert.deepEqual(statussen, [401, 401, 401, 401, 401], 'vijf foute pogingen worden vijf keer geweigerd');

  /* Account B heeft zelf NOG NIETS geprobeerd. Vroeger begon het hier weer bij
     nul; nu is het doel dicht en zegt de rem dat ook. */
  const nieuwAccount = await api('/api/account/koppel', { soort: 'personeel', code: 'KIKUNOI', staffId, pin: '9999' }, b);
  assert.equal(nieuwAccount.status, 429, 'een vers account krijgt GEEN nieuwe vijf pogingen op dezelfde pin');
  assert.match(nieuwAccount.body.error, /pincode/, 'en het is de doel-rem, niet de account-rem: ' + nieuwAccount.body.error);

  // en de andere deur naar dezelfde pin is óók dicht -- ook met de JUISTE pin
  const losseDeur = await api('/api/supplier/login', { code: 'KIKUNOI', staffId, pin: staffPin });
  assert.equal(losseDeur.status, 429, 'de losse personeelslogin deelt de teller (anders zijn het twee boekjes)');

  /* De rem is wel van DIT doel en niet van de hele zaak: een ander
     personeelslid moet gewoon door kunnen. Anders is de rem zelf een manier om
     een zaak plat te leggen. */
  const roster = await api('/api/supplier/roster', { code: 'KIKUNOI' });
  const ander = (roster.body.staff || []).find(s => s.id !== staffId);
  if (ander) {
    const andereDeur = await api('/api/account/koppel', { soort: 'personeel', code: 'KIKUNOI', staffId: ander.id, pin: '9999' }, c);
    assert.equal(andereDeur.status, 401, 'een ander personeelslid is niet meegeblokkeerd (kreeg ' + andereDeur.status + ')');
  }
});

/* De tweede factor telde helemaal niet mee. Kwam de backoffice-code goed door
   -- en die is gedeeld en niet geheim -- dan mocht de authenticator-code
   onbeperkt geraden worden. Zes cijfers zijn dan in minuten af, en dan staat
   de tweede factor er voor niets.

   Eigen server, want dit vraagt OFFICE_TOTP_SECRET in de omgeving. */
test('8. de tweede factor van het kantoor telt mee voor de rem', async () => {
  const TMP2 = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-1acc-totp-'));
  const CODE = 'PROEFCODE123';
  const srv2 = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP2,
    OFFICE_CODE: CODE, OFFICE_TOTP_SECRET: 'JBSWY3DPEHPK3PXP' } });
  const roep = (pad, body, token) => {
    const h = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    return fetch(srv2.base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
      .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  };
  try {
    const versLid = async (n) => {
      const u = (Date.now() + n).toString().slice(-9);
      return (await roep('/api/auth/register', { name: 'Factorlid ' + n, email: 'fa' + n + u + '@x.nl',
        phone: '06' + u, password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg', pasApp: 'rtg' })).body.token;
    };
    const a = await versLid(1), b = await versLid(2);
    assert.ok(a && b, 'twee verse accounts op de eigen server');

    // de code klopt, de factor niet: dat mag niet gratis herhaalbaar zijn
    const statussen = [];
    for (let i = 0; i < 5; i++) {
      statussen.push((await roep('/api/account/koppel', { soort: 'kantoor', code: CODE, totp: '00000' + i }, a)).status);
    }
    assert.deepEqual(statussen, [401, 401, 401, 401, 401], 'vijf foute factoren worden geweigerd');

    const vers = await roep('/api/account/koppel', { soort: 'kantoor', code: CODE, totp: '999999' }, b);
    assert.equal(vers.status, 429, 'een vers account krijgt geen nieuwe reeks pogingen op de tweede factor');
  } finally {
    stop(srv2 && srv2.child);
    try { fs.rmSync(TMP2, { recursive: true, force: true }); } catch (e) {}
  }
});
