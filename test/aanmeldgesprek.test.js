/* Het poortgesprek: Rahul neemt inloggen EN aanmelden over. Getoetst: hij
   opent met "Hi, ik ben Rahul.." en biedt aanmelden, inloggen of uitleg aan;
   het hele aanmeldgesprek van "hoe gaat het" tot bruikbare velden voor de ene
   registratieroute; de "waarom?"-uitleg per stap; de woonplaats die het liefst
   vanzelf komt en anders een keer subtiel gevraagd wordt (overslaan mag); de
   werkgever-herkenning met de eerlijke PIN-boodschap; dat Business-interesse
   genoteerd maar NOOIT beloofd wordt; het uitleg-pad; en het inlogpad dat via
   de sleutelwoorden loopt (drie van vier woorden in een gesprek, het wachtwoord
   gaat nooit door het gesprek).
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

// de posities die Rahul vraagt uit zijn tekst halen (net als de client)
const ORD = { eerste: 0, tweede: 1, derde: 2, vierde: 3 };
function posities(tekst) {
  const uit = [];
  for (const m of String(tekst).matchAll(/\b(eerste|tweede|derde|vierde)\b/gi)) uit.push(ORD[m[1].toLowerCase()]);
  return uit;
}

test('de poort is van Rahul: aanmelden en inloggen als gesprek', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ag-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const s = await api(base, '/api/aanmeld/start', {});
    assert.equal(s.status, 200);
    assert.match(s.body.tekst, /Rahul/, 'Rahul stelt zich voor als Rahul');
    assert.doesNotMatch(s.body.tekst, /[Bb]utler/, 'nooit als butler');
    assert.match(s.body.tekst, /aanmelden|inloggen|uitleg/i, 'hij biedt de drie wegen aan');
    const id = s.body.id;
    const zeg = async (tekst) => (await api(base, '/api/aanmeld/zeg', { id, tekst })).body;

    // nieuw lid; de woonplaats komt hier vanzelf mee (terloops genoemd)
    let r = await zeg('Eerste keer hier! Ik kom uit Rotterdam trouwens.');
    assert.match(r.tekst, /hoe gaat het/i, 'eerst gewoon: hoe gaat het');
    r = await zeg('Gaat goed hoor, druk maar goed.');
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
    assert.match(r.tekst, /geboren/i, 'woonplaats al bekend = niet alsnog vragen');
    r = await zeg('14-03-1992');
    assert.match(r.tekst, /wachtwoord/i);
    r = await zeg('gespreksgeheim123');
    assert.equal(r.klaar, true, 'het gesprek is rond');
    assert.equal(r.woonplaats, 'Rotterdam');
    assert.equal(r.velden.geboortedatum, '1992-03-14');
    assert.equal(r.velden.tier, 'rtg', 'het accounttype is voor je bepaald');

    // en de velden werken op de ENE registratieroute (geen tweede pad)
    const reg = await api(base, '/api/auth/register', { ...r.velden, pasApp: 'rtg' });
    assert.equal(reg.status, 200, 'registreren met de gespreksvelden lukt');
    assert.ok(reg.body.token, 'er is een echte sessie');
    const token = reg.body.token;

    // tweede gesprek: business-interesse en werkgever komen vanzelf boven,
    // en de woonplaats komt niet vanzelf, dus vraagt hij er subtiel naar
    const s2 = await api(base, '/api/aanmeld/start', {});
    const id2 = s2.body.id;
    const zeg2 = async (tekst) => (await api(base, '/api/aanmeld/zeg', { id: id2, tekst })).body;
    await zeg2('Ik ben nieuw en wil me aanmelden.');
    await zeg2('Prima. Ik run mijn bedrijf en ik werk bij Sal de Mar in de bediening.');
    await zeg2('Zakelijke Ondernemer');
    await zeg2('onder@nemer.nl');
    let w = await zeg2('0687654321');
    assert.match(w.tekst, /waar woon je/i, 'de woonplaats wordt een keer subtiel gevraagd');
    assert.match(w.tekst, /reistijden|aanraders/i, 'met de reden erbij');
    w = await zeg2('Ibiza');
    assert.match(w.tekst, /geboren/i);
    await zeg2('01-01-1990');
    const eind = await zeg2('zakelijkgeheim1');
    assert.equal(eind.klaar, true);
    assert.equal(eind.woonplaats, 'Ibiza', 'het antwoord op de subtiele vraag telt');
    assert.match(eind.tekst, /kan en wil ik je niet beloven|beloven kan ik niets/i, 'Business wordt nooit beloofd');
    assert.ok(eind.werkgever && eind.werkgever.code === 'KIKUNOI', 'de werkgever is herkend');
    assert.match(eind.tekst, /pincode/i, 'koppelen blijft met het eigen PIN-bewijs');

    // uitleg-pad: wie eerst wil weten wat RTG is, krijgt uitleg (en geen formulier)
    const su = await api(base, '/api/aanmeld/start', {});
    const uit = (await api(base, '/api/aanmeld/zeg', { id: su.body.id, tekst: 'Mag ik eerst wat uitleg over RTG?' })).body;
    assert.match(uit.tekst, /membership|reisbureau|drie passen/i, 'wie uitleg vraagt, krijgt uitleg');

    // het inlogpad loopt via de sleutelwoorden. Eerst zet het lid ze in (achter
    // de eigen inlog), daarna logt het in door een gesprek met Rahul.
    const woorden = ['lavendel', 'kompas', 'orkaan', 'veranda'];
    const zet = await api(base, '/api/sleutelwoorden/zet', { woorden }, token);
    assert.equal(zet.status, 200, 'sleutelwoorden instellen lukt achter de inlog');
    assert.equal(zet.body.gezet, true);

    const s3 = await api(base, '/api/aanmeld/start', {});
    const id3 = s3.body.id;
    const zeg3 = async (tekst) => (await api(base, '/api/aanmeld/zeg', { id: id3, tekst }));
    let l = (await zeg3('Ik wil inloggen.')).body;
    assert.match(l.tekst, /e-mailadres|gebruikersnaam/i, 'hij vraagt met wie hij praat');
    l = (await zeg3('gesprek@test.nl')).body;
    assert.match(l.tekst, /sleutelwoord/i, 'de inlog gaat via je sleutelwoorden, niet een wachtwoord');
    const p = posities(l.tekst);
    assert.equal(p.length, 2, 'hij vraagt de eerste twee van de drie posities');
    l = (await zeg3('Even denken hoor, ' + woorden[p[0]] + ' en ' + woorden[p[1]] + ' natuurlijk.')).body;
    assert.match(l.tekst, new RegExp(woorden[p[1]]), 'Rahul herkent en echoot je woord terug');
    const ps = posities(l.tekst);
    assert.equal(ps.length, 1, 'nu vraagt hij het laatste woord');
    const in3 = await zeg3(woorden[ps[0]]);
    assert.equal(in3.status, 200);
    assert.equal(in3.body.ingelogd, true, 'ingelogd via een gesprek met de sleutelwoorden');
    assert.ok(in3.body.token, 'met een echte sessie-token');
    assert.ok(in3.body.state, 'en de begintoestand komt mee');

    // wie liever het wachtwoord tikt, kan dat altijd zeggen (bestaande accounts
    // lopen nooit vast): dan wijst Rahul naar het aparte, versleutelde veld
    const s5 = await api(base, '/api/aanmeld/start', {});
    const id5 = s5.body.id;
    const zeg5 = async (tekst) => (await api(base, '/api/aanmeld/zeg', { id: id5, tekst })).body;
    await zeg5('inloggen graag');
    let pw = await zeg5('gesprek@test.nl');
    assert.match(pw.tekst, /sleutelwoord/i);
    pw = await zeg5('doe toch maar met mijn wachtwoord');
    assert.ok(pw.login && pw.login.u === 'gesprek@test.nl', 'de gebruikersnaam komt terug voor de ene inlogroute');
    assert.match(pw.tekst, /niet door dit gesprek/i, 'en het wachtwoord blijft buiten het gesprek');

    // een los e-mailadres als eerste zin = vrijwel zeker een terugkeerder,
    // en die valt meteen in het beveiligde sleutelwoorden-pad
    const s4 = await api(base, '/api/aanmeld/start', {});
    const kort = await api(base, '/api/aanmeld/zeg', { id: s4.body.id, tekst: 'gesprek@test.nl' });
    assert.match(kort.body.tekst, /sleutelwoord/i, 'e-mail als opening = meteen het beveiligde inlogpad');
  } finally {
    await stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
