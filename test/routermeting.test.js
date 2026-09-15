/* DE SCHADUWMETING VAN DE INTELLIGENTIEROUTER
   (server/kern/ai/routermeting.js, EXECUTIE.md blok 8).

   WAT DEZE TOETS BEWAAKT, en waarom elk stuk. De meter bestaat om EEN besluit
   te dragen: mag de goedkope laag vOOr het model komen? Alles hieronder is een
   manier waarop dat getal stil onwaar kan worden.

     1 SCHADUW BLIJFT SCHADUW -- meten verandert geen antwoord.
     2 SPOOR IS GEEN DEKKING -- de regex van router.kies() en de gemeten uitkomst
       worden apart geteld en nooit opgeteld. Dit is de reden dat deze laag
       bestaat: nagemeten zat de regex er in BEIDE richtingen naast.
     3 HET INSTRUMENT KAN UITSLAAN -- een besturingsproef, want een dekkingsmeter
       die altijd hetzelfde zegt ziet er precies zo uit als een die werkt.
     4 NUL IS NIET NUL PROCENT -- een ingang zonder verkeer heet NIET_GEMETEN.
     5 ER LANDT GEEN MENS IN DE TELLERS -- geen vraag, geen sessiesleutel.
     6 DE TELLERS OVERLEVEN EEN HERSTART -- anders draagt het getal geen besluit.
     7 DE DRIE INGANGEN TELLEN ELK APART. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const PAD = path.join(WORTEL, 'server/kern/ai/routermeting.js');
const RUW = fs.readFileSync(PAD, 'utf8');

/* Elke toets een VERSE module: de tellers zijn moduletoestand, dus zonder dit
   lekt de ene toets in de andere en bewijst de suite iets anders dan zij zegt. */
function vers() {
  delete require.cache[require.resolve('../server/kern/ai/routermeting')];
  return require('../server/kern/ai/routermeting');
}
function nepOpslag() {
  const db = { data: {} };
  let saves = 0;
  const maak = () => require('../server/kern/ai/routeropslag')({ db, save: () => saves++ });
  return { db, maak, saves: () => saves };
}

/* ---- 1. schaduw blijft schaduw ------------------------------------------- */

test('meten verandert het antwoord van de regellaag niet', () => {
  const m = vers();
  const { cannedAnswer } = require('../server/kern/ai/demoantwoorden');
  const vragen = ['Wat moet ik inpakken?', 'Wat kost de Business Pass?', 'Regel het maar'];
  for (const v of vragen) {
    const voor = cannedAnswer(v, 'rtg', null);
    m.meet(v, { ingang: 'chat', pas: 'rtg' });
    assert.strictEqual(cannedAnswer(v, 'rtg', null), voor,
      'de schaduwmeting mag het antwoord op "' + v + '" niet aanraken');
  }
});

test('de module heeft geen weg naar een effect: geen fetch, geen stuurRoep', () => {
  for (const verboden of ['fetch(', 'stuurRoep', 'messages.create', 'require(\'../pay']) {
    assert.ok(!RUW.includes(verboden),
      'routermeting.js mag niets uitvoeren; gevonden: ' + verboden);
  }
});

/* ---- 2. spoor is geen dekking -------------------------------------------- */

test('spoor en bewezenGedekt worden apart geteld en lopen aantoonbaar uiteen', () => {
  const m = vers();
  /* "wat kost" draagt een spoor van `regels` maar cannedAnswer heeft er geen bak
     voor; "inpakken" is precies andersom. Precies die twee fouten -- in beide
     richtingen -- zijn de reden dat deze laag bestaat. */
  m.meet('Wat kost de Business Pass?', { ingang: 'chat', pas: 'rtg' });
  m.meet('Wat moet ik inpakken?', { ingang: 'chat', pas: 'rtg' });
  const v = m.stand().per.chat;
  assert.strictEqual(v.gewogen, 2);
  assert.strictEqual(v.spoorZonderDekking, 1, 'router te optimistisch op "wat kost"');
  assert.strictEqual(v.dekkingZonderSpoor, 1, 'router miste de dekking op "inpakken"');
  /* NIET de totalen vergelijken: die kunnen per toeval gelijk zijn terwijl ze
     over verschillende vragen gaan -- dat is precies wat hier gebeurde. De
     dragende bewering is dat de router op GEEN van beide gelijk had. */
  assert.strictEqual(v.spoorZonderDekking + v.dekkingZonderSpoor, v.gewogen,
    'de router zat op beide vragen mis, elk in een andere richting');
});

test('de proef draait ook als de router `ai` zei', () => {
  const m = vers();
  const router = require('../server/kern/ai/router');
  assert.strictEqual(router.kies('Wat moet ik inpakken?').goedkoperMogelijk, false,
    'aanname van deze toets: de router ziet hier geen goedkopere techniek');
  m.meet('Wat moet ik inpakken?', { ingang: 'chat', pas: 'rtg' });
  assert.strictEqual(m.stand().per.chat.bewezenGedekt, 1,
    'de dekking moet gemeten worden ondanks dat de router `ai` koos -- anders ' +
    'meet de meter zijn eigen aanname');
});

/* ---- 3. besturingsproef: het instrument kan uitslaan ---------------------- */

test('de sentinel raakt geen antwoordbak, en een gewone vraag wel', () => {
  const m = vers();
  const { cannedAnswer } = require('../server/kern/ai/demoantwoorden');
  const leeg = cannedAnswer(m.RAAKT_NIETS, 'rtg', null);
  assert.ok(/vrije AI-verrijking is nu niet actief/.test(leeg),
    'de sentinel moet in de standaardzin vallen, anders vergelijkt de meter met een echt antwoord');
  assert.notStrictEqual(cannedAnswer('Wat moet ik inpakken?', 'rtg', null), leeg,
    'een instrument dat niet kan uitslaan, is geen instrument');
});

test('de dekkingsproef vergelijkt met de standaardzin van de JUISTE toonvorm', () => {
  const m = vers();
  /* DEZE TOETS WAS EERST BLIND, en dat is met een mutatie gevonden. Hij nam
     "wat moet ik inpakken" voor beide passen, en die valt in beide toonvormen
     in een bak -- dus gedekt=true, of de meter de toonvorm nu meewoog of niet.

     De faalvorm zit bij een vraag die GEEN bak raakt met een pas die de u-vorm
     krijgt: vergelijkt de meter dan met de je-standaardzin, dan zijn de twee
     zinnen verschillend en heet een onbeantwoorde vraag "gedekt". */
  m.meet('Wat kost de Business Pass?', { ingang: 'ai', pas: 'business' });
  assert.strictEqual(m.stand().per.ai.bewezenGedekt, 0,
    'een vraag zonder bak is niet gedekt -- ook niet voor een pas met de u-vorm');

  // en de besturingskant: wat wel in een bak valt, telt wel degelijk mee
  m.meet('Wat moet ik inpakken?', { ingang: 'ai', pas: 'business' });
  assert.strictEqual(m.stand().per.ai.bewezenGedekt, 1,
    'anders meet deze toets alleen maar nullen en kan hij niet uitslaan');
});

/* ---- 4. nul is niet nul procent ------------------------------------------ */

test('een ingang zonder verkeer levert geen percentage maar NIET_GEMETEN', () => {
  const m = vers();
  m.meet('iets', { ingang: 'chat', pas: 'rtg' });
  const script = require('../scripts/router.js');
  const leeg = script.beoordeel(m.stand().per.fluister, Date.now(), Date.now());
  assert.strictEqual(leeg.uitslag, 'NIET_GEMETEN');
  assert.ok(/geen 0%/.test(leeg.waarom), 'de reden moet zeggen dat dit geen nul procent is');
});

test('genoeg waarnemingen maar te kort is ONRIJP en niet GEMETEN', () => {
  const script = require('../scripts/router.js');
  const nu = Date.now();
  const veel = { gewogen: script.RIJP.minWaarnemingen + 1, spoor: 0, bewezenGedekt: 0,
    spoorZonderDekking: 0, dekkingZonderSpoor: 0, proefMislukt: 0, modelNodig: 0, nietsGafAntwoord: 0 };
  assert.strictEqual(script.beoordeel(veel, nu, nu).uitslag, 'ONRIJP',
    'duizend waarnemingen op een dag zeggen niets over een rustige week');
  const lang = nu - (script.RIJP.minDagen + 1) * 86400000;
  assert.strictEqual(script.beoordeel(veel, lang, nu).uitslag, 'GEMETEN');
});

/* ---- 5. er landt geen mens in de tellers --------------------------------- */

test('de tellers bevatten alleen getallen -- geen vraag, geen sleutel', () => {
  const m = vers();
  const geheim = 'cn-amberen-vos user-42 iemand@example.com';
  m.meet(geheim, { ingang: 'fluister', pas: 'rtg' });
  const plat = JSON.stringify(m.stand());
  for (const stuk of ['cn-', 'user-42', '@example.com', 'amberen']) {
    assert.ok(!plat.includes(stuk), 'de stand draagt "' + stuk + '" en dat hoort een teller niet te doen');
  }
  for (const v of Object.values(m.stand().per.fluister)) {
    assert.strictEqual(typeof v, 'number', 'elk veld van een vak is een getal');
  }
});

test('de module leest geen sessiesleutel uit de opties', () => {
  for (const verboden of ['o.key', 'o.sleutel', 'session']) {
    assert.ok(!RUW.includes(verboden),
      'routermeting.js raakt "' + verboden + '" aan; deze laag hoort geen mens te kennen');
  }
});

/* ---- 6. de tellers overleven een herstart -------------------------------- */

test('zonder bewaarplek zegt de stand duurzaam:false', () => {
  const m = vers();
  assert.strictEqual(m.stand().duurzaam, false);
  assert.ok(/geen besluit/.test(m.stand().grens),
    'een niet-duurzame teller moet zelf zeggen dat hij geen besluit draagt');
});

test('tellers en sinds overleven een herstart', () => {
  const opslag = nepOpslag();
  const m = vers();
  assert.strictEqual(m.onthoud(opslag.maak()), true);
  m.meet('Wat moet ik inpakken?', { ingang: 'chat', pas: 'rtg' });
  m.meet('Wat kost de Business Pass?', { ingang: 'chat', pas: 'rtg' });
  const voor = m.stand();

  const na = vers();                       // herstart: verse moduletoestand
  assert.strictEqual(na.stand().totaal.gewogen, 0, 'verse module begint leeg');
  na.onthoud(opslag.maak());
  assert.strictEqual(na.stand().totaal.gewogen, 2, 'de tellers zijn teruggelezen');
  assert.strictEqual(na.stand().totaal.bewezenGedekt, voor.totaal.bewezenGedekt);
  /* `sinds` is milliseconden en geen ISO-tekst. Toetste dit op string, dan viel
     hij stil terug op NU en loog "sinds" over de periode die het getal beslaat. */
  assert.strictEqual(na.stand().sinds, voor.sinds, 'sinds mag niet stil op NU terugvallen');
});

test('lezen bij het opstarten schept geen lege collectie', () => {
  const opslag = nepOpslag();
  vers().onthoud(opslag.maak());
  assert.strictEqual(opslag.db.data.routerschaduw, undefined,
    'een ontbrekende collectie is "nog nooit gemeten" en hoort niets in de opslag te leggen');
});

/* ---- 7. de drie ingangen ------------------------------------------------- */

test('elke verklaarde ingang telt apart, en een onbekende valt niet stil weg', () => {
  const m = vers();
  assert.deepStrictEqual(m.INGANGEN.slice().sort(), ['ai', 'chat', 'fluister']);
  for (const i of m.INGANGEN) m.meet('iets', { ingang: i, pas: 'rtg' });
  m.meet('iets', { ingang: 'verzonnen-ingang', pas: 'rtg' });
  const s = m.stand();
  for (const i of m.INGANGEN) assert.strictEqual(s.per[i].gewogen, 1, i + ' telt apart');
  assert.strictEqual(s.per.onbekend.gewogen, 1,
    'een niet-verklaarde ingang hoort op te vallen en niet stil bij een andere te worden opgeteld');
  assert.strictEqual(s.totaal.gewogen, 4);
});

test('de drie ingangen roepen de meter werkelijk aan', () => {
  const bronnen = {
    'server/kern/ai.js': "ingang: 'chat'",
    'server/routes/member/assistent.js': "ingang: 'ai'",
    'server/routes/member/persoonlijk-rahul.js': "ingang: 'fluister'"
  };
  for (const [bestand, merk] of Object.entries(bronnen)) {
    const tekst = fs.readFileSync(path.join(WORTEL, bestand), 'utf8');
    assert.ok(tekst.includes('routermeting'), bestand + ' laadt de schaduwmeting niet meer');
    assert.ok(tekst.includes(merk), bestand + ' telt niet meer onder ' + merk);
  }
});

/* ---- de derde uitkomst --------------------------------------------------- */

test('geen dekking en geen model is een eigen teller en geen aftreksom', () => {
  const m = vers();
  m.meet('a', { ingang: 'fluister', pas: 'rtg', gedekt: true, modelAntwoordde: false });
  m.meet('b', { ingang: 'fluister', pas: 'rtg', gedekt: false, modelAntwoordde: true });
  m.meet('c', { ingang: 'fluister', pas: 'rtg', gedekt: false, modelAntwoordde: false });
  const v = m.stand().per.fluister;
  assert.strictEqual(v.bewezenGedekt, 1);
  assert.strictEqual(v.modelNodig, 1);
  assert.strictEqual(v.nietsGafAntwoord, 1, 'hier viel het gesprek terug op een algemene zin');
  /* Allebei waar mag: `bewezenGedekt` is de tegenfeitelijke vraag ("had het
     gekund") en niet "wie antwoordde". Een aftreksom zou daar negatief worden. */
  m.meet('d', { ingang: 'fluister', pas: 'rtg', gedekt: true, modelAntwoordde: true });
  const w = m.stand().per.fluister;
  assert.strictEqual(w.nietsGafAntwoord, 1, 'een vraag die beide waar heeft, telt hier niet mee');
  assert.ok(w.bewezenGedekt + w.modelNodig > w.gewogen - w.nietsGafAntwoord,
    'de twee mogen overlappen; wie ze aftrekt van gewogen krijgt onzin');
});

/* ---- een kapotte bewaarplek mag de meting niet stuk maken ----------------
   Overgenomen uit test/ai-router.test.js toen de meethelft uit router.js naar
   deze module verhuisde. De bewering is niet verhuisd omdat hij mooi stond maar
   omdat hij dekt wat een schaduwlaag onderscheidt van een gewone laag: zij mag
   nooit in de weg lopen van het antwoord waar zij naast hangt. */

test('een onbruikbare bewaarplek wordt geweigerd en niet half aangenomen', () => {
  const m = vers();
  assert.strictEqual(m.onthoud({ lees: 1, schrijf: 2 }), false,
    'lees en schrijf moeten functies zijn; half aannemen levert een teller die stil niets bewaart');
  assert.strictEqual(m.onthoud(null), false);
  assert.strictEqual(m.stand().duurzaam, false, 'een geweigerde plek maakt de stand niet duurzaam');
});

test('een bewaarplek die gooit, laat de meting overeind', () => {
  const m = vers();
  m.onthoud({ lees: () => { throw new Error('stuk'); }, schrijf: () => { throw new Error('stuk'); } });
  assert.doesNotThrow(() => m.meet('wat kost de pas', { ingang: 'chat', pas: 'rtg' }),
    'een meting die de aanroeper kan laten klappen is erger dan geen meting');
  assert.strictEqual(m.stand().totaal.gewogen, 1, 'en hij telt gewoon door in het geheugen');
});

/* ---- een modelantwoord is geen goedkope dekking -------------------------
   GEVONDEN DOOR TE METEN EN NIET DOOR TE LEZEN. De eerste versie van deze laag
   telde op /api/fluister `r.pakte` als "de goedkope laag dekte het". Tegen een
   echte server met een nep-modelserver bleek dat fout: kern/fluister/gesprek.js
   antwoordt met een model AAN met een MODELantwoord en met een model UIT met
   haar eigen regels, en zet in allebei de gevallen pakte=true. Het getal dat
   het hele besluit moet dragen telde dus modelantwoorden als goedkoop.

   De vlag staat sindsdien op de plek die het weet (gesprek.js) en wordt in de
   route niet geraden. Nagemeten met een draaiende server: modelNodig 2,
   bewezenGedekt 0 op twee vragen die allebei door het model werden beantwoord. */

test('de fluister-ingang telt een modelantwoord niet als goedkope dekking', () => {
  const gesprek = fs.readFileSync(path.join(WORTEL, 'server/kern/fluister/gesprek.js'), 'utf8');
  assert.ok(/viaModel: true/.test(gesprek),
    'kern/fluister/gesprek.js markeert zijn modelantwoord niet meer; dan is van buitenaf ' +
    'niet te zien of pakte=true goedkoop of duur was');

  const route = fs.readFileSync(path.join(WORTEL, 'server/routes/member/persoonlijk-rahul.js'), 'utf8');
  assert.ok(/!r\.viaModel/.test(route),
    'de route telt dekking zonder viaModel uit te sluiten -- dan telt een modelantwoord als goedkoop');
  assert.ok(!/gedekt: !!\(r && r\.pakte\)/.test(route),
    'pakte alleen is niet genoeg; dat was precies de gemeten fout');
});

test('nulstel zet de tellers terug en schrijft dat door', () => {
  const opslag = nepOpslag();
  const m = vers();
  m.onthoud(opslag.maak());
  m.meet('Wat moet ik inpakken?', { ingang: 'chat', pas: 'rtg' });
  assert.strictEqual(m.stand().totaal.gewogen, 1);
  const eersteSinds = m.stand().sinds;

  m.nulstel(eersteSinds + 1000);
  assert.strictEqual(m.stand().totaal.gewogen, 0, 'de tellers staan weer op nul');
  assert.strictEqual(m.stand().sinds, eersteSinds + 1000, 'en de periode begint opnieuw');
  /* En het is DOORGESCHREVEN: een nulstelling die alleen in het geheugen staat,
     is na een herstart weer terug -- dan meet je over een periode die niemand
     heeft gekozen. */
  assert.strictEqual(opslag.db.data.routerschaduw.totaal.gewogen, 0);
});
