/* Een account voor alles: je logt in op je RTG-account en je werk-app staat er
   meteen. Geen tweede inlog, geen pincode, geen rol kiezen.

   De koppeling bestond al (werkgever nodigt uit met een kassacode, de medewerker
   meldt zich aan met zijn eigen RTG-inlog en het personeelsrecord krijgt het
   member_id). Wat deze test bewaakt is de laatste stap: bij het inloggen komt de
   werkplek mee, met een sessie die op de werk-endpoints werkt.

   En de werkgever houdt de zeggenschap. Het werkvenster is de knop:
     - venster aan  -> de werkplek komt mee maar is dicht, met de reden erbij
     - venster uit  -> altijd open zodra je bent ingelogd
   Allebei worden hier afgerekend, want de werkgever moet kunnen kiezen.

   Draai los: node --experimental-sqlite --test test/werk-bij-inloggen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

test('je logt in op je RTG-account en je werk-app werkt meteen', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werk-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    // 1) een gewoon RTG-lid (de nieuwe, korte aanmelding: vier velden)
    const email = 'werker@voorbeeld.test';
    const wachtwoord = 'werkgeheim12';
    const reg = await api(base, '/api/auth/register', {
      name: 'Wendy Werker', email, password: wachtwoord, geboortedatum: '1990-05-05', tier: 'rtg', pasApp: 'rtg'
    });
    assert.equal(reg.status, 200, 'aanmelden lukt met vier velden');

    // zonder werkplek komt er ook niets mee
    const kaal = await api(base, '/api/auth/login', { login: email, password: wachtwoord, pasApp: 'rtg' });
    assert.equal(kaal.status, 200);
    assert.equal(kaal.body.werk, undefined, 'wie nergens werkt krijgt geen werkplek mee');

    // 2) de werkgever nodigt haar uit (manager-inlog van de demo-zaak)
    const zaak = await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
    assert.equal(zaak.status, 200, 'de zaak logt in');
    const zaakToken = zaak.body.token;
    const zaakCode = zaak.body.state.supplier.code;
    const bedrijfNaam = zaak.body.state.supplier.name;
    const inv = await api(base, '/api/supplier/staff/invite', { name: 'Wendy Werker', role: 'staff', func: 'bediening' }, zaakToken);
    assert.equal(inv.status, 200, 'de werkgever maakt een uitnodiging');
    const kassacode = inv.body.invite.kassacode;

    // 3) zij meldt zich aan met haar EIGEN RTG-inlog (de koppeling)
    // let op: GEEN pincode. Die hoeft niet meer -- je logt in op je RTG-account.
    const join = await api(base, '/api/supplier/staff/join', {
      bedrijf: bedrijfNaam, kassacode, login: email, password: wachtwoord
    });
    assert.equal(join.status, 200, 'de koppeling lukt met de eigen RTG-inlog: ' + JSON.stringify(join.body));

    /* DE KERN: gewoon inloggen op het RTG-account. De werkplek komt mee met een
       token, en dat token werkt op de werk-endpoints. Nergens een pincode. */
    const in1 = await api(base, '/api/auth/login', { login: email, password: wachtwoord, pasApp: 'rtg' });
    assert.equal(in1.status, 200);
    assert.ok(Array.isArray(in1.body.werk) && in1.body.werk.length === 1, 'de werkplek komt mee bij het inloggen');
    const plek = in1.body.werk[0];
    assert.equal(plek.code, zaakCode);
    assert.equal(plek.naam, 'Wendy Werker');
    assert.equal(plek.open, true, 'zonder werkvenster staat de werkplek open');
    assert.ok(plek.token, 'en er is meteen een werk-sessie');

    // het werk-token werkt echt op een werk-endpoint, zonder ooit een pin te typen
    const proef = await api(base, '/api/supplier/werkvenster', {}, plek.token);
    assert.equal(proef.status, 200, 'de werk-app is direct bruikbaar, zonder ooit een pin te typen');

    // 4) DE WERKGEVER BEPAALT. Venster aan met vandaag dicht -> de plek komt mee,
    //    maar dicht en met de reden; en zonder token, want dicht is dicht.
    const dagen = {}; for (let d = 0; d < 7; d++) dagen[d] = { dicht: true };
    const zet = await api(base, '/api/supplier/werkvenster', { aan: true, dagen }, zaakToken);
    assert.equal(zet.status, 200, 'de werkgever zet het venster');

    const in2 = await api(base, '/api/auth/login', { login: email, password: wachtwoord, pasApp: 'rtg' });
    assert.equal(in2.status, 200, 'inloggen op je RTG-account lukt altijd');
    const dicht = in2.body.werk[0];
    assert.equal(dicht.open, false, 'buiten de dienst is de werkplek dicht');
    assert.equal(dicht.token, null, 'dicht = geen werk-sessie');
    assert.match(String(dicht.reden), /gesloten|werkvenster|dicht/i, 'met de reden erbij');

    // 5) en terug: venster uit -> altijd open zodra je bent ingelogd
    const uit = await api(base, '/api/supplier/werkvenster', { aan: false }, zaakToken);
    assert.equal(uit.status, 200);
    const in3 = await api(base, '/api/auth/login', { login: email, password: wachtwoord, pasApp: 'rtg' });
    assert.equal(in3.body.werk[0].open, true, 'met het venster uit is de werkplek altijd open');
    assert.ok(in3.body.werk[0].token, 'en er is weer meteen een sessie');
  } finally { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});
