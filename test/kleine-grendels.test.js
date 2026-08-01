/* ============================================================================
   DE KLEINE GRENDELS.

   Vier losse bevindingen uit de laatste doorlichting die geen van alle een
   eigen testbestand rechtvaardigen, maar samen wel. Ze delen een vorm: geen
   ontbrekende controle, maar een controle die op het VERKEERDE ding kijkt.

   Draai los: node --experimental-sqlite --test test/kleine-grendels.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-grendels-'));
let srv, base, eigenaar;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  eigenaar = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(eigenaar, 'de eigenaar is ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* De zekeringen zijn een gewoon object en werden met een kale indexering
   opgezocht. Met id "__proto__" leverde dat het prototype van Object op --
   truthy, dus de "onbekende zekering"-controle liet hem door -- en de regels
   erna zetten .aan en .reden op Object.prototype. Vanaf dat moment heeft ELK
   object in het proces die velden, en code die ergens `if (x.aan === false)`
   doet verandert stil van gedrag. Alleen de eigenaar komt bij deze knop, maar
   een grendel die op vertrouwen leunt is geen grendel. */
test('1. de zekering-knop kent geen __proto__', async () => {
  const inlog = await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' });
  assert.equal(inlog.status, 200, 'de eigenaar komt op de technische pagina: ' + JSON.stringify(inlog.body).slice(0, 140));
  const tok = inlog.body.token;

  for (const id of ['__proto__', 'constructor', 'prototype']) {
    const r = await api('/api/techniek/zekering', { id, actie: 'spring', reden: 'test' }, tok);
    assert.equal(r.status, 404, '"' + id + '" is geen zekering (kreeg ' + r.status + ')');
  }

  // en het proces is niet vervuild: een vers, leeg object heeft nog steeds niets
  const status = await fetch(base + '/api/techniek/status', { headers: { Authorization: 'Bearer ' + tok } });
  assert.equal(status.status, 200, 'het bord doet het nog gewoon');

  // een echte zekering werkt wel; anders bewijst het bovenstaande niets
  const bord = await status.json();
  const echte = (bord.zekeringen || [])[0];
  assert.ok(echte && echte.id, 'er is minstens een echte zekering om mee te vergelijken');
  const uit = await api('/api/techniek/zekering', { id: echte.id, actie: 'spring', reden: 'test' }, tok);
  assert.equal(uit.status, 200, 'een echte zekering gaat gewoon uit');
  await api('/api/techniek/zekering', { id: echte.id, actie: 'reset' }, tok);
});

/* De clusterknoppen (promote/demote) zetten een server actief of op standby.
   De sleutel werd met !== vergeleken, en dat stopt bij het eerste verschillende
   teken. Overal elders in dit huis staat veiligGelijk; uitgerekend hier niet.
   Dat verschil is niet van buitenaf te meten in een test -- het is een
   eigenschap van de vergelijking, niet van het antwoord -- dus wat we hier
   vastleggen is het gedrag eromheen: zonder sleutel bestaat de route niet, en
   met een foute sleutel ook niet (zelfde 404, geen apart "verkeerde sleutel"). */
test('2. de clusterknoppen bestaan niet zonder de juiste sleutel', async () => {
  const zonder = await fetch(base + '/api/cluster/promote', { method: 'POST' });
  assert.equal(zonder.status, 404, 'zonder sleutel: onbekend');
  const fout = await fetch(base + '/api/cluster/promote', { method: 'POST', headers: { 'x-rtg-cluster': 'gokje' } });
  assert.equal(fout.status, 404, 'met een foute sleutel: precies hetzelfde antwoord');
  const body = await fout.json().catch(() => ({}));
  assert.doesNotMatch(String(body.error || ''), /sleutel|cluster/i,
    'en het antwoord verklapt niet eens dat er een sleutel bestaat');
});

/* Het adres in een herstelmail kwam uit de Origin-header van de AANVRAGER.
   Iemand vraagt herstel aan voor het adres van een ander met
   Origin: https://kwaadaardig.example, en het slachtoffer krijgt een ECHTE mail
   van RTG met een link naar de server van de aanvaller -- inclusief een geldig
   hersteltoken. Er is geen namaakpagina nodig; de mail is van ons.

   Buiten productie mag de header gewoon (daar draait alles op wisselende
   poorten en is dat precies wat je wilt), dus wat deze test vastlegt is dat
   APP_URL, als die gezet is, ALTIJD wint -- dat is de grendel die in productie
   het werk doet. */
test('3. een gezette APP_URL wint van de Origin van de aanvrager', async () => {
  const TMP2 = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appurl-'));
  const srv2 = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP2, APP_URL: 'https://mijn.rtg.example' } });
  try {
    const u = Date.now().toString().slice(-8);
    const email = 'grendel' + u + '@x.nl';
    const reg = await fetch(srv2.base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Grendellid', email, phone: '06' + u, password: 'geheim123',
        geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
    });
    const regBody = await reg.json();
    assert.equal(reg.status, 200, 'het lid is geregistreerd');
    assert.ok(String(regBody.devVerifyUrl || '').startsWith('https://mijn.rtg.example'),
      'de bevestigingslink draagt het ingestelde adres: ' + String(regBody.devVerifyUrl).slice(0, 60));

    // en nu met een vijandige Origin erbij
    const vergeten = await fetch(srv2.base + '/api/auth/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://kwaadaardig.example' },
      body: JSON.stringify({ email })
    });
    const vb = await vergeten.json();
    assert.equal(vergeten.status, 200);
    assert.ok(vb.devResetUrl, 'er is een herstellink gemaakt');
    assert.ok(String(vb.devResetUrl).startsWith('https://mijn.rtg.example'),
      'de herstellink gaat naar ONS adres, niet naar dat van de aanvrager: ' + String(vb.devResetUrl).slice(0, 70));
    assert.doesNotMatch(String(vb.devResetUrl), /kwaadaardig/,
      'de Origin van de aanvrager komt er niet in voor');
  } finally {
    stop(srv2 && srv2.child);
    try { fs.rmSync(TMP2, { recursive: true, force: true }); } catch (e) {}
  }
});

/* De echte naam achter een codenaam hoort in de kluis, niet in db.data. Twee
   meldingen op het veiligheidsbord haalden hem daar vandaan en zetten hem in
   een tekst die daarna gewoon in de gedeelde database blijft staan -- en de
   opvraging ging langs het inzagejournaal heen, terwijl elke andere weg naar
   die naam er wel in komt. */
test('4. het veiligheidsbord draagt de identiteitssleutel, niet de echte naam', async () => {
  const u = Date.now().toString().slice(-8);
  const NAAM = 'Nieuwsgierig Aagje';
  const reg = await api('/api/auth/register', { name: NAAM, email: 'aagje' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.equal(reg.status, 200);

  // een geldig account dat de technische pagina probeert te openen: kritieke melding
  const poging = await fetch(base + '/api/techniek/status', { headers: { Authorization: 'Bearer ' + reg.body.token } });
  assert.equal(poging.status, 403, 'dat mag niet');

  const inlog = await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' });
  const bord = await (await fetch(base + '/api/techniek/status', { headers: { Authorization: 'Bearer ' + inlog.body.token } })).json();
  const meldingen = JSON.stringify(bord.beveiliging || {});
  assert.match(meldingen, /tech-toegang-geweigerd/, 'de poging staat op het bord');
  assert.doesNotMatch(meldingen, new RegExp(NAAM),
    'maar zonder de echte naam erin -- die staat in de kluis en hoort daar te blijven');
  assert.match(meldingen, /user-\d+/, 'wel met de identiteitssleutel, zodat de eigenaar hem via /api/office/inzage kan opvragen');
});
