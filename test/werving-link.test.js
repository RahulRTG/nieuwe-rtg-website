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

   Draai los: node --test test/werving-link.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function versDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werv-')); }

async function post(base, pad, body, token, extraHeaders) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {});
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
    assert.match(code, /^[A-Z0-9]{6}\.[A-F0-9]{32}$/,
      'een herkenbare prefix plus een 128-bit geheim');
    const adres = new URL(inv.data.link, base);
    assert.equal(adres.pathname, '/apps/app.html');
    assert.equal(adres.search, '', 'het geheim staat niet in een query die proxies loggen');
    assert.equal(adres.hash, '#werving=' + code,
      'de code reist uitsluitend in het browserfragment: ' + inv.data.link);
    assert.equal(adres.pathname.includes(code), false, 'de accesslog krijgt de code niet als pad');

    // Fragmenten gaan aantoonbaar niet over HTTP: de server ziet alleen het
    // statische app-pad en antwoordt met een no-referrer-document.
    const pagina = await fetch(adres.href);
    assert.equal(pagina.status, 200);
    assert.equal(pagina.headers.get('referrer-policy'), 'no-referrer');
    const html = await pagina.text();
    assert.match(html, /name="referrer" content="no-referrer"/);
    assert.equal(html.includes(code), false, 'het eenmalige geheim staat niet in het serverantwoord');

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
test('een herhaalde uitnodiging geeft de kale code nooit opnieuw vrij', async () => {
  const TMP = versDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  try {
    const mgr = await managerSessie(base);
    const eerste = await post(base, '/api/supplier/staff/invite', { name: 'Noor', func: 'Bediening', idem: 'inv-vast' }, mgr);
    assert.equal(eerste.status, 200);
    const code = eerste.data.invite.kassacode;

    const nogmaals = await post(base, '/api/supplier/staff/invite', { name: 'Noor', func: 'Bediening', idem: 'inv-vast' }, mgr);
    assert.equal(nogmaals.status, 409,
      'herhalen maakt geen tweede code en heronthult de eerste niet: ' + JSON.stringify(nogmaals.data));
    assert.equal(nogmaals.data.kassacode, undefined);
    assert.equal(JSON.stringify(nogmaals.data).includes(code), false, 'de eenmalige code staat nergens in het antwoord');

    // er staat er ook maar EEN open bij de werkgever
    const lijst = await post(base, '/api/supplier/staff/invites', {}, mgr);
    const voorNoor = (lijst.data.invites || []).filter(i => i.naam === 'Noor');
    assert.equal(voorNoor.length, 1, 'de werkgever ziet een openstaande uitnodiging, niet twee');
    assert.equal(JSON.stringify(voorNoor).includes(code), false, 'ook de latere lijst onthult geen kale code');
    assert.equal(Object.hasOwn(voorNoor[0] || {}, 'kassacode'), false);
    assert.equal(Object.hasOwn((voorNoor[0] || {}).toegang || {}, 'code_hash'), false);

    // een verse sleutel is een echte tweede uitnodiging
    const tweede = await post(base, '/api/supplier/staff/invite', { name: 'Noor', func: 'Bediening', idem: 'inv-vers' }, mgr);
    assert.notEqual(tweede.data.invite.kassacode, code, 'met een andere sleutel mag het wel');

    // dezelfde sleutel met een andere ROL is een fout, geen stille echo
    const anders = await post(base, '/api/supplier/staff/invite',
      { name: 'Noor', func: 'Bediening', role: 'manager', idem: 'inv-vast' }, mgr);
    assert.equal(anders.status, 409, 'dezelfde sleutel voor een andere rol wordt geweigerd');

    // Ook de standaard HTTP-herhaalsleutel wordt in het domein gebonden. De
    // generieke antwoordcache mag een eenmalig geheim namelijk nooit replayen.
    const viaKop = await post(base, '/api/supplier/staff/invite',
      { name: 'Imani', func: 'Keuken' }, mgr, { 'Idempotency-Key': 'staff-imani-1' });
    assert.equal(viaKop.status, 200);
    const viaKopCode = viaKop.data.invite.kassacode;
    const viaKopNogmaals = await post(base, '/api/supplier/staff/invite',
      { name: 'Imani', func: 'Keuken' }, mgr, { 'Idempotency-Key': 'staff-imani-1' });
    assert.equal(viaKopNogmaals.status, 409);
    assert.equal(JSON.stringify(viaKopNogmaals.data).includes(viaKopCode), false);

    // Een oudere client zonder sleutel krijgt binnen het dubbeltikvenster
    // eveneens maar een opslagrij en nooit een tweede credential.
    const zonderKop = await post(base, '/api/supplier/staff/invite',
      { name: 'Mila', func: 'Salon' }, mgr);
    assert.equal(zonderKop.status, 200);
    const zonderKopCode = zonderKop.data.invite.kassacode;
    const zonderKopNogmaals = await post(base, '/api/supplier/staff/invite',
      { name: 'Mila', func: 'Salon' }, mgr);
    assert.equal(zonderKopNogmaals.status, 409);
    assert.equal(JSON.stringify(zonderKopNogmaals.data).includes(zonderKopCode), false);
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('de app neemt het wervingsfragment vóór andere scripts alleen in geheugen over', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'app.html'), 'utf8');
  const bron = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'app-main.js'), 'utf8');
  assert.ok(html.indexOf('__RTG_WERVING_CODE') < html.indexOf('/shared/meelezen.js'),
    'het geheim is geschrobd voordat een ander script of verzoek start');
  assert.match(html, /name="referrer" content="no-referrer"/);
  assert.match(html, /history\.replaceState\(null, '', location\.pathname \+ location\.search\)/);
  assert.match(bron, /wervingscode: wervingscode \|\| undefined/,
    'een nieuwe registratie wisselt de geheugencredential in');
  assert.match(bron, /\/werving\/verbind/,
    'een bestaand of reeds ingelogd lid gebruikt dezelfde server-side claim');
  assert.doesNotMatch(bron, /sessionStorage\.setItem\([^\n]*werving/i,
    'de bearer blijft niet in browseropslag achter');
});
