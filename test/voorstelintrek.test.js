/* ============================================================================
   INTREKKEN -- een klaargezet voorstel laten vervallen voor het loopt.

   HET BESLUIT (eigenaar, 13 september 2026): wie iets kan laten klaarzetten,
   moet het conversationeel ook weer kunnen terugtrekken. Bevestigen niet.

   DIE ASYMMETRIE IS GEEN INCONSEQUENTIE MAAR REKENKUNDE: bevestigen GEEFT een
   handeling vrij, intrekken kan er alleen een WEGNEMEN. De ernstigste afloop van
   een verkeerde intrekking is dat een lid opnieuw moet vragen; de ernstigste
   afloop van een verkeerde bevestiging is dat er geld weg is.

   WAT HIER WORDT VASTGEHOUDEN, en waarom elk van de vijf iets anders is:

   1. HET WERKT. Bij precies EEN openstaand voorstel vervalt het, met 200.
      Zonder deze toets is elke andere toets hier groen omdat er niets gebeurt.
   2. BIJ TWEE GEBEURT ER NIETS. 409, en na twee pogingen staan er nog steeds
      twee. Dit is de gevaarlijkste faalvorm van het besluit: er verdwijnt een
      ANDER voorstel dan het lid bedoelde, zonder dat er zichtbaar iets misgaat.
   3. ER IS GEEN ID-INGANG. De eis "precies een eenduidig voorstel" is een VORM
      en geen regel: `trekEnige(req, wereld)` neemt er geen, dus bij twee
      voorstellen IS er niets om aan te wijzen. Een aanroeper kan hier niet
      ongehoorzaam zijn.
   4. HET TOKEN LEKT NIET. Het goedkeurings-id is de sleutel waarmee elders een
      handeling wordt vrijgegeven; het antwoord noemt het pad en een
      samenvatting, nooit het id.
   5. HET VOORSTEL VAN EEN ANDER BLIJFT STAAN. De lijst is per identiteit EN per
      wereld.

   EN DE BEVESTIGDEUR BLIJFT DICHT. Intrekken openzetten mag de andere kant niet
   meeopenen: /api/member/doe/bevestig hoort voor het stuur onbereikbaar te
   blijven.

   DE MUTATIES (scripts/mensmutatie.js 11 t/m 14) draaien deze beloftes ook
   werkelijk stuk; wat hier staat is de snelle wacht, die daar de trage.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const wegwerp = require('../scripts/lib/wegwerpserver');

let srv;
test.before(async () => {
  srv = await wegwerp.start({ naam: 'voorstelintrek', gereed: 'ready',
    env: { NODE_ENV: 'test', RTG_INTENT_RAIL: 'deterministisch' } });
});
test.after(() => { try { srv.klaar(); } catch (e) {} });

const post = async (pad, lijf, tok) => {
  const koppen = { 'Content-Type': 'application/json' };
  if (tok) koppen.Authorization = 'Bearer ' + tok;
  const r = await fetch(srv.basis + pad, { method: 'POST', headers: koppen,
    body: JSON.stringify(lijf || {}) });
  return { status: r.status, data: await r.json().catch(() => null) };
};

/* Een vers lid per toets: de voorstellenlijst is per identiteit, dus twee
   toetsen die hem delen meten elkaars rommel. */
let teller = 0;
async function versLid() {
  const u = String(Date.now()).slice(-7) + String(teller++).padStart(2, '0');
  const r = await post('/api/auth/register', { name: 'Intrek ' + u,
    email: 'intrek' + u + '@voorbeeld.nl', phone: '06' + u.slice(0, 8),
    password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
  assert.equal(r.status, 200, 'registreren mislukte; zonder lid meet deze toets niets');
  return r.data.token;
}

/* Een voorstel ONTSTAAT door een pad op niveau `voorstel` aan te roepen: de
   server geeft 428 terug en zet het vast. Die 428 IS het bewijs dat er iets
   klaarstaat -- zonder die controle toetst de rest op een lege lijst. */
async function zetKlaar(tok, titel) {
  const r = await post('/api/member/doe',
    { pad: '/api/agenda/toevoegen', body: { titel, wanneer: 'vrijdag 14:00' } }, tok);
  assert.equal(r.status, 428, 'de voorbereiding gaf geen voorstel; dan staat er niets klaar');
}

test('1. bij precies EEN openstaand voorstel vervalt het', async () => {
  const tok = await versLid();
  await zetKlaar(tok, 'Tandarts');
  const r = await post('/api/member/voorstel/intrek', {}, tok);
  assert.equal(r.status, 200, 'een eenduidig voorstel hoort te vervallen');
  assert.equal(r.data.aantal, 1);
  assert.equal(r.data.ingetrokken.pad, '/api/agenda/toevoegen',
    'het antwoord zegt niet WELK voorstel verviel');
});

test('2. bij TWEE gebeurt er niets, ook niet na twee pogingen', async () => {
  const tok = await versLid();
  await zetKlaar(tok, 'Tandarts');
  await zetKlaar(tok, 'Kapper');
  const a = await post('/api/member/voorstel/intrek', {}, tok);
  const b = await post('/api/member/voorstel/intrek', {}, tok);
  assert.equal(a.status, 409, 'bij twee kandidaten hoort de poort te weigeren');
  assert.equal(a.data.aantal, 2);
  /* DE TWEEDE POGING IS DE ECHTE TOETS. Zou de eerste er stilletjes een pakken,
     dan meldde de tweede er nog maar een. */
  assert.equal(b.status, 409, 'de tweede poging gaf een andere uitkomst');
  assert.equal(b.data.aantal, 2, 'er is er toch een verdwenen bij twee kandidaten');
});

test('3. er is geen id-ingang, en een meegestuurd id verandert niets', async () => {
  const tok = await versLid();
  await zetKlaar(tok, 'Tandarts');
  await zetKlaar(tok, 'Kapper');
  /* Een aanroeper die het toch probeert: het lijf wordt met opzet niet gelezen. */
  const r = await post('/api/member/voorstel/intrek',
    { id: 'wat-dan-ook', goedkeuringId: 'wat-dan-ook', pad: '/api/agenda/toevoegen' }, tok);
  assert.equal(r.status, 409, 'een meegestuurd id maakte de keuze alsnog');
  assert.equal(r.data.aantal, 2);
  /* En op de BRON: de handtekening draagt geen id. Komt hij ooit terug, dan is
     "precies een eenduidig voorstel" weer een regel in plaats van een vorm. */
  const bron = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'server/kern/stuur/goedkeuring.js'), 'utf8');
  assert.ok(/function trekEnige\(req, wereld\)/.test(bron),
    'trekEnige() heeft niet langer exact (req, wereld) als handtekening');
});

test('4. het goedkeurings-id komt nooit in een antwoord', async () => {
  const tok = await versLid();
  await zetKlaar(tok, 'Tandarts');
  const een = await post('/api/member/voorstel/intrek', {}, tok);
  await zetKlaar(tok, 'Kapper');
  await zetKlaar(tok, 'Tandarts');
  const twee = await post('/api/member/voorstel/intrek', {}, tok);
  for (const [naam, r] of [['200', een], ['409', twee]]) {
    const tekst = JSON.stringify(r.data);
    assert.ok(!/"id"\s*:/.test(tekst),
      'het ' + naam + '-antwoord draagt een id; dat token geeft elders een handeling vrij');
  }
});

test('5. het voorstel van een ander lid blijft staan', async () => {
  const mij = await versLid();
  const ander = await versLid();
  await zetKlaar(mij, 'Van mij');
  await zetKlaar(ander, 'Van de ander');
  const r = await post('/api/member/voorstel/intrek', {}, mij);
  assert.equal(r.status, 200, 'mijn eigen voorstel hoort gewoon te vervallen');
  /* En die van de ander staat er nog: hij kan hem zelf intrekken. */
  const r2 = await post('/api/member/voorstel/intrek', {}, ander);
  assert.equal(r2.status, 200, 'het voorstel van de ander is meegegaan met dat van mij');
});

test('6. de bevestigdeur blijft dicht voor het stuur', () => {
  /* Intrekken openzetten mag de andere kant niet meeopenen. Getoetst op de
     ECHTE route en op de verbodsregel zelf -- niet op een pad dat niet bestaat. */
  const { beleidVoor } = require('../server/kern/stuur/beleid');
  const { VERBODEN } = require('../server/kern/stuur/classificatie');
  for (const pad of ['/api/member/doe', '/api/member/doe/bevestig']) {
    assert.equal(beleidVoor(pad, 'member').niveau, 'verboden', pad + ' is bereikbaar voor het stuur');
    assert.ok(VERBODEN.some((re) => re.test(pad)), pad + ' staat niet in de verbodslijst');
  }
  assert.equal(beleidVoor('/api/member/voorstel/intrek', 'member').niveau, 'klein',
    'het intrekpad hoort `klein` te zijn: niet verboden, en geen voorstel om een voorstel te laten vervallen');
});
