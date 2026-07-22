/* Het aanmeldgesprek: Rahul vervangt het formulier met een menselijk gesprek.
   Getoetst: het hele gesprek van "hoe gaat het" tot bruikbare velden voor de
   ene registratieroute; de "waarom?"-uitleg per stap; de woonplaats die
   vanzelf komt (nooit uitgevraagd); de werkgever-herkenning met de eerlijke
   PIN-boodschap; en dat Business-interesse genoteerd maar NOOIT beloofd
   wordt. Plus de echte keten: gespreksvelden -> /api/auth/register -> token.
   Draai los: node --experimental-sqlite --test test/aanmeldgesprek.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json() };
}

test('het gesprek verzamelt alles menselijk, legt uit waarom, en registreert echt', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ag-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const s = await api(base, '/api/aanmeld/start', {});
    assert.equal(s.status, 200);
    assert.match(s.body.tekst, /Rahul/, 'Rahul stelt zich voor als Rahul');
    assert.doesNotMatch(s.body.tekst, /[Bb]utler/, 'nooit als butler');
    assert.match(s.body.tekst, /hoe gaat het/i, 'eerst gewoon: hoe gaat het');
    const id = s.body.id;
    const zeg = async (tekst) => (await api(base, '/api/aanmeld/zeg', { id, tekst })).body;

    // klein persoonlijk begin; de woonplaats komt vanzelf mee (niet gevraagd)
    let r = await zeg('Gaat goed hoor, druk maar goed. Ik kom uit Rotterdam trouwens.');
    assert.match(r.tekst, /naam/i, 'daarna vloeit het naar de naam');
    r = await zeg('Ik heet Test de Gesprekstester');
    assert.match(r.tekst, /Test/, 'hij noemt je bij je voornaam');
    assert.match(r.tekst, /Rotterdam/, 'de terloops genoemde woonplaats komt natuurlijk terug');

    // de waarom-vraag krijgt een eerlijke uitleg en het gesprek loopt door
    r = await zeg('Waarom wil je mijn e-mailadres weten?');
    assert.match(r.tekst, /bevestigingslink|wachtwoord kwijt/i, 'eerlijke uitleg waarom');
    r = await zeg('gesprek@test.nl');
    assert.match(r.tekst, /nummer/i);
    r = await zeg('0612345678');
    assert.match(r.tekst, /geboren/i);
    r = await zeg('14-03-1992');
    assert.match(r.tekst, /wachtwoord/i);

    // interesse in business is eerder genoemd? Nee; test de nooit-beloven-regel apart hieronder.
    r = await zeg('gespreksgeheim123');
    assert.equal(r.klaar, true, 'het gesprek is rond');
    assert.equal(r.woonplaats, 'Rotterdam');
    assert.equal(r.velden.geboortedatum, '1992-03-14');
    assert.equal(r.velden.tier, 'rtg', 'het accounttype is voor je bepaald');

    // en de velden werken op de ENE registratieroute (geen tweede pad)
    const reg = await api(base, '/api/auth/register', { ...r.velden, pasApp: 'rtg' });
    assert.equal(reg.status, 200, 'registreren met de gespreksvelden lukt');
    assert.ok(reg.body.token, 'er is een echte sessie');

    // tweede gesprek: business-interesse en werkgever komen vanzelf boven
    const s2 = await api(base, '/api/aanmeld/start', {});
    const id2 = s2.body.id;
    const zeg2 = async (tekst) => (await api(base, '/api/aanmeld/zeg', { id: id2, tekst })).body;
    await zeg2('Prima. Ik run mijn bedrijf en ik werk bij Sal de Mar in de bediening.');
    await zeg2('Zakelijke Ondernemer');
    await zeg2('onder@nemer.nl');
    await zeg2('0687654321');
    await zeg2('01-01-1990');
    const eind = await zeg2('zakelijkgeheim1');
    assert.equal(eind.klaar, true);
    assert.match(eind.tekst, /kan en wil ik je niet beloven|beloven kan ik niets/i, 'Business wordt nooit beloofd');
    assert.ok(eind.werkgever && eind.werkgever.code === 'KIKUNOI', 'de werkgever is herkend');
    assert.match(eind.tekst, /pincode/i, 'koppelen blijft met het eigen PIN-bewijs');
  } finally {
    await stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
