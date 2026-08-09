/* Driftbewaking: twee spelregels bestaan bewust in tweevoud (server keurt,
   client geeft directe feedback): de Woordduel-premievelden en de
   Rummi-setregels. Deze test haalt de CLIENT-kopie uit spelen.html en houdt
   hem tegen de SERVER-kopie. Lopen ze uiteen, dan faalt dit hier, in plaats
   van als raadselachtige fout midden in een potje.
   Draai los: node --experimental-sqlite --test test/spelregels-drift.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// de serverkant: de spellenkern met lege stubs (we raken alleen de regels aan)
const kern = require('../server/kern/spellen')({
  db: { data: {} }, save() {}, crypto: require('crypto'),
  zijnVrienden: () => true, codenaamVan: x => x, sseToCustomer() {},
  isGeblokkeerd: () => false, socialZoek: async () => [], sociaalRate: () => true, volwassen: () => true
});
const { rummiSet, W_PREMIE, SPEL, ARCADE } = kern._spelregels;

// de clientkant: de stukken broncode uit spelen.html knippen en uitvoeren
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'spelen.html'), 'utf8');
function knip(van, tot) {
  const a = html.indexOf(van), b = html.indexOf(tot, a);
  assert.ok(a >= 0 && b > a, 'bron niet gevonden: ' + van);
  return html.slice(a, b);
}

test('de premievelden van Woordduel zijn op client en server identiek', () => {
  const bron = knip('const W_PREMIE', 'let wGelegd');
  const clientPremie = new Function(bron + '; return W_PREMIE;')();
  assert.deepEqual(clientPremie, W_PREMIE, 'de borden lopen uiteen: premies zouden ergens anders kleuren dan ze scoren');
});

test('de rummi-setregels van client en server keuren dezelfde setjes goed', () => {
  const bron = knip('function rGeldigSet', 'function rMaakSet');
  const rGeldigSet = new Function(bron + '; return rGeldigSet;')();
  const setjes = [
    ['r1', 'r2', 'r3'], ['r1', 'r2', 'r4'], ['r13', 'r1', 'r2'],
    ['r5', 'b5', 'g5'], ['r5', 'b5', 'g5', 'z5'], ['r5', 'b5', 'r5'],
    ['r5', 'b5', 'g5', 'z5', 'r5'], ['b7', '*', 'b9'], ['*', '*', 'b9'],
    ['b12', 'b13', '*'], ['*', 'b1', 'b2'], ['g1', '*', 'g3', 'g4'],
    ['r1', 'r2'], ['*', '*'], ['z5', '*', 'g5'], ['*', '*', '*'],
    ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11', 'b12', 'b13'],
    ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11', 'b12', 'b13', '*']
  ];
  for (const set of setjes) {
    assert.equal(rGeldigSet(set) === true, rummiSet(set) != null,
      'client en server oordelen verschillend over: ' + JSON.stringify(set));
  }
});

/* De spelnamen bestaan ook in tweevoud: de server heeft ze in de descriptors
   (via het register), de lobby in spelen.html heeft een eigen SPELNAAM/MAXG om
   een potje al te kunnen tonen voordat de server antwoordt. Loopt dat uiteen,
   dan heet hetzelfde spel op twee plekken anders of laat de client een
   spelersaantal toe dat de server weigert. */
test('de spelnamen en spelersaantallen van de lobby komen overeen met de server', () => {
  const bron = knip('const SPELNAAM', 'async function laadLobby');
  const { SPELNAAM, MAXG } = new Function(bron + '; return { SPELNAAM, MAXG };')();
  for (const [sleutel, naam] of Object.entries(SPELNAAM)) {
    assert.ok(SPEL[sleutel], 'de lobby kent spel "' + sleutel + '" dat de server niet heeft');
    // de client mag de 18+-poort in de naam zetten ("Proost (18+)"); de rest moet gelijk zijn
    assert.ok(naam.startsWith(SPEL[sleutel].naam), 'spel ' + sleutel + ' heet op de client "' + naam +
      '" en op de server "' + SPEL[sleutel].naam + '"');
    if (MAXG[sleutel] !== undefined) assert.equal(MAXG[sleutel], SPEL[sleutel].max,
      'de lobby laat een ander aantal spelers toe dan de server voor ' + sleutel);
  }
});

/* De client beslist per app welke tegels hij toont (`MIJN_SPELLEN`); de server
   zegt in de descriptor van elk arcadespel in welke apps het hoort. Lopen die
   uiteen, dan staat er een tegel die de speler niet mag hebben, of ontbreekt
   er een die hij wel mag. */
test('de arcadetegels van beide apps komen overeen met de werelden uit de server', () => {
  const bron = knip('const MIJN_SPELLEN', 'document.querySelectorAll');
  const rtg = new Function('const memberTok = true; ' + bron + '; return MIJN_SPELLEN;')();
  const rtf = new Function('const memberTok = false; ' + bron + '; return MIJN_SPELLEN;')();
  for (const [sleutel, spel] of Object.entries(ARCADE)) {
    assert.equal(rtg.includes(sleutel), spel.werelden.includes('rtg'),
      'arcadespel ' + sleutel + ' staat in de RTG-app anders dan de server zegt');
    assert.equal(rtf.includes(sleutel), spel.werelden.includes('rtf'),
      'arcadespel ' + sleutel + ' staat in de RTF-app anders dan de server zegt');
  }
});

/* De progressiegrens staat op de SERVER, maar de client moet er wel naar
   luisteren. Doet hij dat niet, dan krijgt een tiener geen leeg bord maar
   "Nog geen scores. Wees de eerste!" -- een uitnodiging tot iets dat voor hem
   niet bestaat. Deze toets draait de echte clientfunctie met een nagemaakte
   api en nagemaakte elementen. */
test('de client verbergt kop en lijst zodra de server zegt dat er geen ranglijst is', async () => {
  const bron = knip('async function laadRanglijst', 'const laadTetrisBord');
  const maak = () => ({ hidden: false, innerHTML: '', classList: { contains: () => true } });

  async function draai(antwoord) {
    const lijst = maak(), kop = maak();
    lijst.previousElementSibling = kop;
    const laad = new Function('api', '$', 'esc', bron + '; return laadRanglijst;')(
      async () => antwoord, () => lijst, (x) => String(x));
    await laad('sneek', '#snBordLijst');
    return { lijst, kop };
  }

  const uit = await draai({ bord: [], ranglijst: false, reden: 'geen progressie' });
  assert.equal(uit.lijst.hidden, true, 'de lijst hoort weg te zijn');
  assert.equal(uit.kop.hidden, true, 'en de kop "Ranglijst onder vrienden" ook');
  assert.equal(uit.lijst.innerHTML, '', 'er hoort geen "wees de eerste" te staan');

  const aan = await draai({ bord: [{ codenaam: 'Zilveren Reiger', ik: true, punten: 120 }], ranglijst: true });
  assert.equal(aan.lijst.hidden, false, 'met een ranglijst staat de lijst er gewoon');
  assert.equal(aan.kop.hidden, false);
  assert.ok(/Zilveren Reiger/.test(aan.lijst.innerHTML), 'en de scores staan erin');
});
