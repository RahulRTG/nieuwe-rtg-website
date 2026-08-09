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
  const bron = knip('const SPELNAAM', '/* ---------- wie er nu is');
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

/* Aanwezigheid in de lobby. De server beslist WIE er in de stand staat; deze
   pagina beslist hoe dat oogt, en daar zitten twee regels in die anders stil
   wegvallen: bij nul vrienden staat er niets (een regel "0 vrienden zijn er
   nu" is een por, geen bericht), en er komt nooit een tijd in beeld. */
test('de lobby toont aanwezigheid zonder tijden, en zwijgt als er niemand is', async () => {
  const bron = knip('let ONLINE = new Set();', '/* De eigen opt-out');
  const maak = () => ({ hidden: false, innerHTML: '' });

  async function draai(antwoord) {
    const lijn = maak();
    const laad = new Function('api', '$', 'esc', bron + '; return { laadOnline, geefOnline: () => ONLINE };')(
      async () => antwoord, () => lijn, (x) => String(x));
    await laad.laadOnline();
    return { lijn, online: laad.geefOnline() };
  }

  const leeg = await draai({ online: [], aantal: 0, stand: 'nu' });
  assert.equal(leeg.lijn.hidden, true, 'bij niemand hoort de regel weg te zijn');
  assert.equal(leeg.lijn.innerHTML, '', 'en niet "0 spelers"');

  const een = await draai({ online: [{ codenaam: 'Zilveren Reiger', key: 'user-9' }], aantal: 1, stand: 'nu' });
  assert.equal(een.lijn.hidden, false);
  assert.match(een.lijn.innerHTML, /1 speler is er nu/, 'enkelvoud bij een');
  assert.ok(een.online.has('user-9'), 'de sleutel is onthouden, zodat de vriendenkiezer hem kan markeren');

  const drie = await draai({ online: [{ key: 'a' }, { key: 'b' }, { key: 'c' }], aantal: 3, stand: 'nu' });
  assert.match(drie.lijn.innerHTML, /3 spelers zijn er nu/, 'meervoud bij meer');
  assert.doesNotMatch(drie.lijn.innerHTML, /geleden|minuut|minuten|uur|sinds/,
    'er hoort geen tijd of "laatst gezien" in beeld te komen');

  /* Mislukt de vraag, dan blijft de vorige stand staan. Anders zou een
     hikje in het netwerk "iedereen is weg" tonen. */
  const lijn = maak();
  const laad = new Function('api', '$', 'esc',
    bron + '; return { laadOnline, zet: (s) => { ONLINE = s; }, geefOnline: () => ONLINE };')(
    async () => { throw new Error('netwerk'); }, () => lijn, (x) => String(x));
  laad.zet(new Set(['user-9']));
  await laad.laadOnline();
  assert.ok(laad.geefOnline().has('user-9'), 'een mislukte vraag hoort de stand niet leeg te maken');
});

/* De toets hierboven geeft `laadOnline` een nagemaakte `$`, dus een id dat in
   de pagina niet bestaat zou hij niet zien -- de functie zou pas in de browser
   klappen op `lijn.hidden`. Daarom apart: elk id dat deze functies opzoeken
   moet ook echt in de HTML staan. */
test('de ids die de lobby opzoekt bestaan ook in de pagina', () => {
  const bron = knip('let ONLINE = new Set();', 'async function laadLobby') +
    knip('async function tekenVrienden', '$(\'#nStart\').addEventListener');
  const ids = [...new Set([...bron.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map(m => m[1]))];
  assert.ok(ids.includes('onlineLijn'), 'de aanwezigheidsregel hoort opgezocht te worden');
  for (const id of ids)
    assert.ok(new RegExp('id="' + id + '"').test(html), 'de pagina mist een element met id="' + id + '"');
});
