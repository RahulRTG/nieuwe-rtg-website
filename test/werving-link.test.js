/* De wervingslink: een werkgever nodigt iemand uit die nog geen RTG-account
   heeft, en die persoon is na het aanmelden meteen personeel.

   WAT HIER GEREPAREERD IS. Personeel heeft altijd een eigen RTG-account -- dat
   was al zo. Maar de weg ernaartoe was alleen begaanbaar voor wie dat account
   AL had: open de leverancier-app, typ de bedrijfsnaam over, typ de kassacode.
   Wie nog geen account had, kreeg een code die nergens paste. Nu draagt een
   link diezelfde uitnodiging, en registreren en in dienst treden is een
   handeling.

   En er wordt vastgelegd VIA WELK BEDRIJF iemand lid is geworden. Dat stond
   nergens: de uitnodiging wist wel wie hem inwisselde, maar het lid wist niet
   meer waar het vandaan kwam, en het RTG-kantoor dus ook niet.

   Wat de toetsen bewaken, en waarom juist dat:
   - de link werkt zonder bestaand account, en verbindt in EEN handeling;
   - de uitnodiging blijft EENMALIG -- de link is een tweede weg naar dezelfde
     uitnodiging, geen tweede uitnodiging;
   - kijken vertelt weinig (bedrijfsnaam en functie, verder niets);
   - de herkomst is de EERSTE werkgever en verschuift niet bij een tweede baan;
   - een verlopen, gebruikte of verzonnen code opent niets.

   Draai los: node --experimental-sqlite --test test/werving-link.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function versDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werv-')); }

async function post(base, pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

/* Een zaak met een manager die kan uitnodigen. De demo-seed levert er een; we
   halen de manager uit het rooster en loggen in met zijn pincode -- hetzelfde
   stramien als test/activiteiten.test.js. */
const ZAAK = 'ESVEDRA';
async function managerSessie(base) {
  const rost = await post(base, '/api/supplier/roster', { code: ZAAK });
  assert.equal(rost.status, 200, 'rooster: ' + JSON.stringify(rost.data).slice(0, 200));
  const man = (rost.data.staff || []).find(x => x.role === 'manager');
  assert.ok(man, 'de demo-zaak heeft een manager');
  const r = await post(base, '/api/supplier/login', { code: ZAAK, staffId: man.id, pin: '1234' });
  assert.equal(r.status, 200, 'zaak-login: ' + JSON.stringify(r.data).slice(0, 200));
  return r.data.token;
}

const versEmail = () => 'w' + Math.random().toString(36).slice(2, 10) + '@x.nl';

test('een uitnodigingslink maakt van een nieuwe bezoeker in een handeling personeel', async () => {
  const TMP = versDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  try {
    const mgr = await managerSessie(base);

    // 1) de werkgever nodigt uit en krijgt naast de code een LINK
    const inv = await post(base, '/api/supplier/staff/invite', { name: 'Sam', func: 'Bediening' }, mgr);
    assert.equal(inv.status, 200, 'uitnodigen: ' + JSON.stringify(inv.data).slice(0, 200));
    const code = inv.data.invite.kassacode;
    assert.match(code, /^[A-Z0-9]{6}$/, 'een kassacode van zes tekens');
    assert.ok(inv.data.link && inv.data.link.endsWith('/werken/' + code),
      'en een link die diezelfde code draagt: ' + inv.data.link);

    // 2) wie hem opent ziet waar hij is, en verder niets
    const kijk = await post(base, '/api/werving/kijk', { kassacode: code });
    assert.equal(kijk.status, 200, 'kijken: ' + JSON.stringify(kijk.data).slice(0, 200));
    assert.ok(kijk.data.bedrijf, 'de bedrijfsnaam staat erbij');
    assert.equal(kijk.data.functie, 'Bediening');
    assert.equal(kijk.data.adres, undefined, 'maar geen adres');
    assert.equal(kijk.data.leden, undefined, 'en geen ledental');

    // 3) aanmelden MET de code: gratis account en meteen in dienst
    const email = versEmail();
    const reg = await post(base, '/api/auth/register', { name: 'Sam Jansen', email,
      password: 'geheim12345', geboortedatum: '1996-05-05', wervingscode: code });
    assert.equal(reg.status, 200, 'registreren: ' + JSON.stringify(reg.data).slice(0, 200));
    assert.ok(reg.data.token, 'er is een account');
    assert.ok(reg.data.werk, 'en hij is meteen verbonden aan het bedrijf');
    assert.equal(reg.data.werk.bedrijf, kijk.data.bedrijf);
    assert.ok(reg.data.werk.staffId, 'met een personeelsrecord');

    // 4) hij staat echt in het team van die zaak -- gelezen uit het rooster,
    //    dus uit wat de zaak zelf ziet en niet uit het antwoord op stap 3
    const rost = await post(base, '/api/supplier/roster', { code: ZAAK });
    const namen = (rost.data.staff || []).map(s => s.name);
    assert.ok(namen.includes('Sam'), 'in het team: ' + namen.join(', '));

    // 5) de uitnodiging is op -- de link is geen tweede uitnodiging
    const nogmaals = await post(base, '/api/werving/kijk', { kassacode: code });
    assert.equal(nogmaals.status, 404, 'de code is verbruikt');
  } finally {
    await stop(child);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});

test('een bestaand lid verbindt met dezelfde link, zonder opnieuw in te loggen', async () => {
  const TMP = versDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  try {
    const mgr = await managerSessie(base);
    const email = versEmail();
    const reg = await post(base, '/api/auth/register', { name: 'Robin de Vries', email,
      password: 'geheim12345', geboortedatum: '1990-01-01' });
    assert.ok(reg.data.token, 'lid bestaat al');

    const inv = await post(base, '/api/supplier/staff/invite', { name: 'Robin', func: 'Keuken' }, mgr);
    const code = inv.data.invite.kassacode;

    // de sessie is het bewijs dat dit account van deze persoon is; de code dat
    // de werkgever hem verwacht. Geen wachtwoord, geen bedrijfsnaam overtypen.
    const v = await post(base, '/api/werving/verbind', { kassacode: code }, reg.data.token);
    assert.equal(v.status, 200, 'verbinden: ' + JSON.stringify(v.data).slice(0, 200));
    assert.ok(v.data.staffId, 'er is een personeelsrecord');
    assert.equal(v.data.identiteit.nodig, true,
      'en de app zegt dat de identiteit nog vastgesteld moet worden voor de loonadministratie');
  } finally {
    await stop(child);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});

test('een verzonnen, verlopen of al gebruikte code opent niets', async () => {
  const TMP = versDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  try {
    for (const code of ['ZZZZZZ', 'abc', '', '123456789']) {
      const r = await post(base, '/api/werving/kijk', { kassacode: code });
      assert.notEqual(r.status, 200, 'code ' + JSON.stringify(code) + ' hoort niets op te leveren');
    }
    // en registreren met een verzonnen code levert wel een account op, maar geen baan
    const reg = await post(base, '/api/auth/register', { name: 'Niemand', email: versEmail(),
      password: 'geheim12345', geboortedatum: '1990-01-01', wervingscode: 'ZZZZZZ' });
    assert.equal(reg.status, 200, 'het account komt er gewoon');
    assert.equal(reg.data.werk, undefined, 'maar zonder werkgever');
  } finally {
    await stop(child);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});

/* TWEE KLIKKEN GAVEN TWEE GELDIGE KASSACODES (TAKEN.md 4.61).

   Een uitnodiging is geen gewone creatie-route: een vergeten tweede code is een
   open deur naar personeelstoegang, en de manager ziet die tweede meestal niet
   -- hij moest hem zelf intrekken. Dezelfde sleutel geeft nu dezelfde
   uitnodiging terug; een VERSE sleutel is wel een echte tweede, want twee
   mensen met dezelfde voornaam uitnodigen mag gewoon. */
test('een herhaalde uitnodiging met dezelfde sleutel geeft EEN kassacode, geen twee', async () => {
  const TMP = versDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  try {
    const mgr = await managerSessie(base);
    const eerste = await post(base, '/api/supplier/staff/invite', { name: 'Noor', func: 'Bediening', idem: 'inv-vast' }, mgr);
    assert.equal(eerste.status, 200);
    const code = eerste.data.invite.kassacode;

    const nogmaals = await post(base, '/api/supplier/staff/invite', { name: 'Noor', func: 'Bediening', idem: 'inv-vast' }, mgr);
    assert.equal(nogmaals.status, 200);
    assert.equal(nogmaals.data.invite.kassacode, code, 'dezelfde code terug, geen tweede open deur');
    assert.equal(nogmaals.data.herhaald, true, 'de server merkt de herhaling zelf');

    // er staat er ook maar EEN open bij de werkgever
    const lijst = await post(base, '/api/supplier/staff/invites', {}, mgr);
    const voorNoor = (lijst.data.invites || []).filter(i => i.naam === 'Noor');
    assert.equal(voorNoor.length, 1, 'de werkgever ziet een openstaande uitnodiging, niet twee');

    // een verse sleutel is een echte tweede uitnodiging
    const tweede = await post(base, '/api/supplier/staff/invite', { name: 'Noor', func: 'Bediening', idem: 'inv-vers' }, mgr);
    assert.notEqual(tweede.data.invite.kassacode, code, 'met een andere sleutel mag het wel');

    // dezelfde sleutel met een andere ROL is een fout, geen stille echo
    const anders = await post(base, '/api/supplier/staff/invite',
      { name: 'Noor', func: 'Bediening', role: 'manager', idem: 'inv-vast' }, mgr);
    assert.equal(anders.status, 409, 'dezelfde sleutel voor een andere rol wordt geweigerd');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
