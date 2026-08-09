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
const { rummiSet, W_PREMIE, SPEL } = kern._spelregels;

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
