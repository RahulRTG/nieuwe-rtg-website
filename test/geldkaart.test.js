/* DE ZELFIJKING VAN DE GELDKAART.

   Deze meter beweert iets dat een mens niet kan nakijken: dat elke waardemutatie
   op de vier kernbakken door haar eigen poort ging. Zo'n bewering is alleen wat
   waard als de meter aantoonbaar OOK het tegenovergestelde kan zeggen -- LAT.md
   regel 2, een toets die je niet hebt zien zakken is geen toets. Een groene
   geldkaart naast een wacht die niets ziet, is precies de gevaarlijkste uitkomst
   die dit huis kent.

   Draai los: node --test test/geldkaart.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const WACHT = path.join(WORTEL, 'scripts/lib/geldwacht.js');

/* Draai een benoemd scenario uit scripts/lib/geldijk.js met de wacht ervoor, en
   geef terug wat zij opschreef. De scenario's staan DAAR en niet hier: een toets
   die de te ijken code zelf genereert, ijkt zijn eigen generator mee. */
const IJK = path.join(WORTEL, 'scripts/lib/geldijk.js');
function draai(scenario) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-geldijk-'));
  const uit = path.join(map, 'wacht.jsonl');
  const r = spawnSync(process.execPath, ['--require', WACHT, IJK, scenario],
    { encoding: 'utf8', env: { ...process.env, RTG_GELDWACHT_UIT: uit }, timeout: 60000 });
  let regels = [];
  try {
    regels = fs.readFileSync(uit, 'utf8').trim().split('\n')
      .map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
  } catch (e) { /* niets geschreven */ }
  fs.rmSync(map, { recursive: true, force: true });
  return { regels, stderr: r.stderr, code: r.status };
}

test('de wacht ziet een waardemutatie die om elke poort heen gaat', () => {
  const { regels } = draai('buitenPoort');
  const mutatie = regels.find(r => r.collectie === 'paySaldi' && r.sleutel === 'lid:STIEKEM');
  assert.ok(mutatie, 'de wacht zag de schrijfactie op paySaldi helemaal niet');
  assert.equal(mutatie.stand, 'buiten-kern',
    'een schrijfactie buiten elke poort hoort buiten-kern te heten, niet ' + mutatie.stand);
  assert.ok(/geldijk\.js:\d+/.test(mutatie.door),
    'de schrijver hoort met bestand en regelnummer genoemd te worden, anders is de ' +
    'triagelijst onbruikbaar: ' + mutatie.door);
});

test('de hele bak vervangen is een EIGEN stand en geen vrijbrief', () => {
  const { regels } = draai('container');
  const r = regels.find(x => x.collectie === 'bankSaldi');
  assert.ok(r, 'een containerschrijfactie hoort ook genoteerd te worden');
  assert.equal(r.stand, 'container');
  /* De reden dat dit een eigen stand is en geen uitzondering: kern/pay/opladen.js
     vervangt bij een herstart in motor-modus de complete saldostand, en dat
     VERANDERT geld. Zou `container` als onschuldig gelden, dan verdween precies
     die schrijfactie uit beeld. */
});

test('een geldcollectie die het register niet kent, wordt niet bewaakt (en dat hoort zichtbaar te zijn)', () => {
  const { regels } = draai('onbekendeBak');
  assert.equal(regels.filter(r => r.collectie === 'verzonnenBak').length, 0,
    'de wacht kijkt alleen naar collecties uit effectcollecties.js; een nieuwe geldbak ' +
    'moet DAAR worden aangemeld, en deze toets legt vast dat dat de enige weg is');
});

test('de poorten die de wacht noemt, bestaan ook echt', () => {
  const { POORTEN } = require('../scripts/lib/geldwacht.js');
  const namen = Object.keys(POORTEN);
  assert.ok(namen.length >= 2, 'er horen minstens twee poorten te zijn: RTG Pay en RTG Bank');
  for (const [sleutel, p] of Object.entries(POORTEN))
    assert.ok(fs.existsSync(path.join(WORTEL, p.bestand)),
      'poort ' + sleutel + ' wijst naar ' + p.bestand + ', en dat bestand bestaat niet. ' +
      'Hernoem je een guard zonder deze lijst bij te werken, dan heet ALLES ineens buiten-kern ' +
      'en leest de geldkaart als een ramp die er niet is.');
});

test('elke uitzondering is smal, benoemd en beredeneerd', () => {
  const { UITZONDERINGEN } = require('../scripts/lib/geldwacht.js');
  for (const u of UITZONDERINGEN) {
    assert.ok(u.bestand && u.bestand.startsWith('server/'), 'een uitzondering noemt een bestand');
    assert.ok(Array.isArray(u.collecties) && u.collecties.length,
      'een uitzondering noemt de collecties waarvoor zij geldt -- nooit "alles van deze module"');
    assert.ok(u.reden && u.reden.length > 40,
      'een uitzondering draagt een reden die een tweede lezer kan betwisten');
    assert.ok(fs.existsSync(path.join(WORTEL, u.bestand)),
      'de uitzondering wijst naar ' + u.bestand + ', dat niet bestaat; een uitzondering die ' +
      'nergens meer op slaat hoort weg, niet te blijven staan');
  }
});

test('de kernbakken van de geldkaart dekken beide grootboeken', () => {
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts/geldkaart.js'), 'utf8');
  for (const bak of ['paySaldi', 'payBoekingen', 'bankSaldi', 'bankBoekingen'])
    assert.ok(new RegExp('\\b' + bak + '\\b').test(bron),
      bak + ' hoort een kernbak te zijn. Er zijn TWEE grootboeken in dit huis en de eerste ' +
      'versie van deze meter kende alleen dat van RTG Pay -- waardoor 984 bankschrijfacties ' +
      'ten onrechte buiten-kern heetten.');
});

/* ================== DE RATEL OP GELDKAART.json ==================
   Hierboven staat of de WACHT deugt. Dit gaat over de UITSLAG: wat er in het
   register staat mag niet stilletjes slechter worden.

   Waarom dit hier hangt en niet in scripts/norm.js: de norm ratelt getallen die
   een meter oplevert, maar de scherpe bewering van deze kaart is geen getal dat
   mag stijgen of dalen -- hij is een NUL die nul moet blijven. scripts/lib/
   metingen.js wijst daarom dit bestand aan als de eigen ratel van GELDKAART.json. */
test('GELDKAART.json: geen kernbak wordt buiten zijn eigen poort geschreven', () => {
  const pad = path.join(WORTEL, 'GELDKAART.json');
  assert.ok(fs.existsSync(pad), 'GELDKAART.json ontbreekt -- draai npm run geldkaart');
  const r = JSON.parse(fs.readFileSync(pad, 'utf8'));
  const as2 = r.as2Poort || {};

  /* EERST DE NOEMER, en dat is geen formaliteit. Een register waarin de
     poortproef niet gedraaid heeft, meldt overal nul -- en die nul zou deze
     toets groen houden terwijl er niets gemeten is. Een nul zonder noemer is
     een geruststelling zonder grond, en precies de faalvorm die deze hele
     meter moet uitsluiten. */
  assert.ok(as2.gedraaid, 'de poortproef heeft niet gedraaid; de nullen hieronder betekenen niets');
  assert.ok(as2.schrijfacties > 500,
    'er zijn maar ' + as2.schrijfacties + ' schrijfacties waargenomen. Zakt dat sterk, ' +
    'dan meet de kaart minder dan hij deed en zeggen zijn nullen minder -- kijk of ' +
    'de aandrijvende toetsen in scripts/geldkaart.js nog bestaan.');
  assert.equal(as2.toetsen && as2.toetsen.gezakt, 0,
    'de poortproef draaide op een huis met gezakte toetsen; die uitslag telt niet');

  for (const [bak, hoort] of Object.entries({ paySaldi: 'pay', payBoekingen: 'pay',
    bankSaldi: 'bank', bankBoekingen: 'bank' })) {
    const c = (as2.perCollectie || {})[bak];
    assert.ok(c, bak + ' is niet waargenomen; dan bewijst deze kaart niets over ' + hoort);
    assert.equal(c.buitenKern, 0,
      bak + ' werd ' + c.buitenKern + 'x buiten de ' + hoort + '-poort geschreven. ' +
      'Dat is de bevinding waarvoor deze meter bestaat: zie GELDKAART.json -> ' +
      'as2Poort.kernBuitenPoort voor bestand en regelnummer.');
  }

  assert.deepEqual(as2.verkeerdePoort || [], [],
    'een kernbak is via de VERKEERDE poort geschreven. Beheerst is dan niet genoeg: ' +
    'de betaalpoort en de bankpoort toetsen niet hetzelfde beleid (kern/bank/grootboek.js ' +
    'raadpleegt kern/waarde nul keer), dus zo raakt een oormerk stil zijn werking kwijt.');
});
