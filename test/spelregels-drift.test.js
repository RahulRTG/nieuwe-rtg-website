/* Driftbewaking: twee spelregels bestaan bewust in tweevoud (server keurt,
   client geeft directe feedback): de Woordduel-premievelden en de
   Rummi-setregels. Deze test haalt de CLIENT-kopie uit spelen.html en houdt
   hem tegen de SERVER-kopie. Lopen ze uiteen, dan faalt dit hier, in plaats
   van als raadselachtige fout midden in een potje.
   Draai los: node --test test/spelregels-drift.test.js */
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

/* Welke app welk spel START staat twee keer: in de descriptor van elk spel
   (`wereld`) en in `MIJN_SPELLEN` in de lobby. Voor de arcade werd dat hierboven
   al bewaakt; dit doet hetzelfde voor de potjes.

   Bewust EEN kant op. "Elk spel van deze wereld hoort in de lijst" zou niet
   kloppen: de zes duels van De Arena en De Societeit zijn ook wereld 'rtf',
   maar wonen in arena.html en societeit.html en horen niet in deze lobby. Wat
   wel moet kloppen: elk spel dat de lobby TOONT staat aan de goede kant. */
test('de spellen van de lobby staan in de app die ze mag starten', () => {
  const namen = new Function(knip('const SPELNAAM', '/* ---------- wie er nu is') + '; return SPELNAAM;')();
  const bron = knip('const MIJN_SPELLEN', 'document.querySelectorAll');
  const rtg = new Function('const memberTok = true; ' + bron + '; return MIJN_SPELLEN;')();
  const rtf = new Function('const memberTok = false; ' + bron + '; return MIJN_SPELLEN;')();

  for (const sleutel of Object.keys(namen)) {
    const inRtg = rtg.includes(sleutel), inRtf = rtf.includes(sleutel);
    assert.ok(inRtg || inRtf, 'spel "' + sleutel + '" hoort in minstens een app te staan');
    const toegestaan = SPEL[sleutel].werelden || [SPEL[sleutel].wereld];
    if (inRtg) assert.ok(toegestaan.includes('rtg'), 'de lobby zet "' + sleutel + '" in RTG terwijl de server dat niet toestaat');
    if (inRtf) assert.ok(toegestaan.includes('rtf'), 'de lobby zet "' + sleutel + '" in RTF terwijl de server dat niet toestaat');
  }
});

/* De stand in de lobby. Twee regels die anders stil wegvallen: het VENSTER
   staat er altijd bij (een getal zonder tijdsaanduiding leest als een
   totaal-voor-altijd), en onder de progressiegrens blijft het hele blok weg in
   plaats van dat er een lege kop met nul partijen staat. */
test('de lobby toont de stand met zijn venster, en zwijgt onder de grens', async () => {
  const bron = knip('async function laadStand()', 'async function laadLobby');
  const maak = () => ({ hidden: false, innerHTML: '' });

  async function draai(antwoord) {
    const el = { '#standKop': maak(), '#stand': maak() };
    const laad = new Function('api', '$', 'esc', 'SPELNAAM',
      bron + '; return laadStand;')(async () => antwoord, (sel) => el[sel], (x) => String(x), { schaak: 'Schaken' });
    await laad();
    return el;
  }

  const uit = await draai({ progressie: false, stand: [], totaal: null });
  assert.equal(uit['#stand'].hidden, true, 'onder de grens hoort het blok weg te zijn');
  assert.equal(uit['#standKop'].hidden, true, 'kop en al');

  const leeg = await draai({ progressie: true, stand: [], vensterDagen: 365 });
  assert.equal(leeg['#stand'].hidden, true, 'nul partijen is ook geen blok waard');

  const vol = await draai({ progressie: true, vensterDagen: 365,
    stand: [{ soort: 'schaak', gespeeld: 3, gewonnen: 1, gelijk: 1, verloren: 1 }] });
  assert.equal(vol['#stand'].hidden, false);
  assert.match(vol['#stand'].innerHTML, /Schaken/, 'het spel staat er op naam');
  assert.match(vol['#stand'].innerHTML, /3 gespeeld/);
  assert.match(vol['#stand'].innerHTML, /afgelopen jaar/, 'het venster hoort erbij te staan');
});

/* De laatste partijen in de lobby. Het punt dat anders wegvalt: een
   tegenstander zonder codenaam (buiten de progressiegrens, of iemand die zich
   heeft laten verwijderen) hoort "een medespeler" te worden en geen leeg
   vakje -- een naam die ontbreekt zonder uitleg leest als een storing. */
test('de lobby toont recente partijen, met een naamloze tegenstander als medespeler', async () => {
  const bron = knip('function tegenTekst(tegen)', 'async function laadLobby');
  const maak = () => ({ hidden: false, innerHTML: '' });

  async function draai(antwoord) {
    const el = maak();
    const laad = new Function('api', '$', 'esc', 'SPELNAAM', bron + '; return laadRecent;')(
      async () => antwoord, () => el, (x) => String(x), { schaak: 'Schaken', mejn: 'Mens erger je niet' });
    await laad();
    return el;
  }

  const uit = await draai({ progressie: false, uitslagen: [] });
  assert.equal(uit.hidden, true, 'onder de grens hoort het blok weg te zijn');

  const vol = await draai({ progressie: true, uitslagen: [
    { soort: 'schaak', ik: true, gelijk: false, tegen: [{ codenaam: 'Zilveren Reiger', won: false }] },
    { soort: 'schaak', ik: false, gelijk: false, tegen: [{ codenaam: null, won: true }] },
    { soort: 'mejn', ik: false, gelijk: true, tegen: [{ codenaam: 'Gouden Vos', won: false }] }
  ] });
  assert.equal(vol.hidden, false);
  assert.match(vol.innerHTML, /gewonnen · tegen Zilveren Reiger/, 'een gewonnen partij op codenaam');
  assert.match(vol.innerHTML, /verloren · tegen een medespeler/, 'een naamloze tegenstander krijgt woorden');
  assert.match(vol.innerHTML, /gelijkspel/, 'en een gelijkspel heet geen winst of verlies');
  assert.doesNotMatch(vol.innerHTML, /tegen\s*<\/small>/, 'nooit "tegen" met niets erachter');
});

/* Behaalde prestaties in de lobby. Het punt dat anders wegvalt: deze pagina
   mag er GEEN voortgang bij verzinnen. De server stuurt alleen wat behaald is;
   een teller of een balk zou het patroon terugbrengen dat er bewust uit is. */
test('de lobby toont alleen behaalde prestaties, zonder teller of voortgang', async () => {
  const bron = knip('async function laadPrestaties()', 'async function laadLobby');
  const maak = () => ({ hidden: false, innerHTML: '' });

  async function draai(antwoord) {
    const el = maak();
    const laad = new Function('api', '$', 'esc', bron + '; return laadPrestaties;')(
      async () => antwoord, () => el, (x) => String(x));
    await laad();
    return el;
  }

  assert.equal((await draai({ progressie: false, prestaties: [] })).hidden, true, 'onder de grens: weg');
  assert.equal((await draai({ progressie: true, prestaties: [] })).hidden, true, 'niets behaald: ook weg');

  const vol = await draai({ progressie: true, vensterDagen: 365, prestaties: [
    { sleutel: 'eerste-winst:schaak', naam: 'Eerste overwinning', spel: 'Schaken', uitleg: 'Je eerste gewonnen partij in dit spel.' }
  ] });
  assert.equal(vol.hidden, false);
  assert.match(vol.innerHTML, /Eerste overwinning/);
  assert.match(vol.innerHTML, /Schaken/);
  assert.equal(/van de|nog\b|te gaan|\d+\s*\/\s*\d+/i.test(vol.innerHTML), false,
    'geen teller en geen voortgang: ' + vol.innerHTML);
});

/* ---------- de klok: twee kopieën die niet mogen schuiven ----------

   De client kiest zelf welke spellen hij een tempo-vraag stelt en welke tempi
   in de lijst staan. Dat is dezelfde afweging als bij MIJN_SPELLEN: de server
   keurt en weigert, de client geeft alleen de keuze -- en een rondje naar de
   server vóór de eerste tekening zou een flits geven voor een lijst die eens
   per jaar verandert. De duplicatie mag dus blijven, maar niet stil uiteenlopen. */

test('de tempo-keuze van de lobby staat bij spellen die async ook echt kunnen', () => {
  const bron = knip('const ASYNC_SPELLEN', 'const TEMPI');
  const clientAsync = new Function(bron + '; return ASYNC_SPELLEN;')();
  const serverAsync = Object.keys(SPEL).filter(k => (SPEL[k].vormen || []).includes('async'));
  assert.deepEqual(clientAsync.slice().sort(), serverAsync.slice().sort(),
    'de lobby vraagt om een tempo bij een ander stel spellen dan de server toestaat');
});

test('elk tempo dat de lobby aanbiedt bestaat ook op de server', () => {
  /* Andersom hoeft niet: de lobby toont met opzet een SELECTIE (vijf van de
     zeven) om de keuze klein te houden. Wat hij aanbiedt moet wel bestaan --
     anders krijgt de speler een weigering op een knop die wij hem gaven. */
  const bron = knip('const TEMPI', 'function klokTekst');
  const clientTempi = new Function(bron + '; return TEMPI;')().map(r => r[0]).filter(Boolean);
  const { TEMPO } = require('../server/kern/spellen/klok');
  for (const t of clientTempi)
    assert.ok(TEMPO[t], 'de lobby biedt tempo "' + t + '" aan, maar de server kent hem niet');
});

test('de klokttekst telt niet zichtbaar af, en zwijgt zonder klok', () => {
  /* CLAUDE.md verbiedt kunstmatige urgentie. Een klok die in seconden wegtikt
     op een partij van drie dagen is precies dat, dus de tekst is grof: minuten,
     dan uren, dan dagen. */
  const bron = knip('function klokTekst', '/* ---------- wie er nu is');
  const klokTekst = new Function(bron + '; return klokTekst;')();
  assert.equal(klokTekst(null), '', 'een potje zonder klok zegt niets');
  assert.equal(klokTekst({ beurtTot: null }), '');
  assert.equal(klokTekst({ beurtTot: new Date(Date.now() + 1000).toISOString(), verlopen: true }), 'tijd om');
  assert.match(klokTekst({ beurtTot: new Date(Date.now() + 18 * 3600000).toISOString() }), /^nog 18 uur$/);
  assert.match(klokTekst({ beurtTot: new Date(Date.now() + 30 * 60000).toISOString() }), /^nog 30 min$/);
  assert.match(klokTekst({ beurtTot: new Date(Date.now() + 3 * 86400000).toISOString() }), /^nog 3 dagen$/);
  assert.equal(klokTekst({ beurtTot: new Date(Date.now() - 5000).toISOString() }), 'tijd om',
    'een klok die voorbij is zegt dat, ook zonder de vlag van de server');
});

test('de spellen die de lobby laat terugkijken zijn ook echt naspeelbaar', () => {
  /* Derde kopie van serverkennis in de client, en dezelfde afweging als bij de
     twee hierboven. Deze mag ABSOLUUT niet schuiven: een spel dat de client
     terugkijkbaar noemt terwijl de server het niet kan, geeft een foutmelding
     op een knop die wij zelf aanboden. Andersom -- de server kan het en de
     client biedt het niet aan -- is stiller en daarom net zo goed bewaakt. */
  const bron = knip('const NASPEELBAAR', 'const TEMPI');
  const client = new Function(bron + '; return NASPEELBAAR;')();
  const server = Object.keys(SPEL).filter(k => SPEL[k].naspeelbaar);
  assert.deepEqual(client.slice().sort(), server.slice().sort());
});

test('het schaakbord toont de laatste zet, en de server stuurt hem ook echt mee', () => {
  /* Bij een partij van uren per beurt kom je terug op een bord dat er anders
     uitziet. Zien WAT er veranderd is, is dan geen versiering maar de enige
     manier om de draad op te pakken. Twee kanten, dus twee kansen om het te
     vergeten: de weergave moet `laatste` sturen en de pagina moet hem tekenen. */
  const p = { id: 'x', soort: 'schaak', modus: 'vrij', spelers: ['a', 'b'], uitgenodigd: [],
    beurt: 0, teams: [0, 1], status: 'bezig', winnaar: null, at: '' };
  const { INITS, ZETTEN, ZICHT } = require('../server/kern/spellen/register')({
    save() {}, crypto: require('crypto'), schud: (a) => a, beurtDoor() {}, codenaamVan: (x) => x, nudge() {} });
  INITS.schaak(p);
  assert.equal(ZICHT.schaak.speler(p, p.staat, 'a').laatste, null, 'voor de eerste zet is er niets te markeren');
  ZETTEN.schaak(p, 'a', { van: 52, naar: 36 });
  assert.deepEqual(ZICHT.schaak.speler(p, p.staat, 'a').laatste, [52, 36], 'de server stuurt van-veld en naar-veld');
  // en de pagina gebruikt ze allebei
  const teken = knip('function tekenSchaak', 'function schKlik');
  assert.match(teken, /lz\[0\] === veld/, 'de pagina markeert het veld waar de zet vandaan kwam');
  assert.match(teken, /lz\[1\] === veld/, 'en het veld waar hij heen ging');
});

test('de spellen die de lobby op een scherm aanbiedt hebben ook echt een projectie', () => {
  /* Vierde kopie van serverkennis in de lobby. Zelfde afweging, zelfde bewaking:
     een spel dat de client projecteerbaar noemt terwijl de server het weigert,
     geeft een foutmelding op een knop die wij zelf aanboden. */
  const bron = knip('const PROJECTEERBAAR', 'const TEMPI');
  const client = new Function(bron + '; return PROJECTEERBAAR;')();
  const { ZICHT } = require('../server/kern/spellen/register')({
    save() {}, crypto: require('crypto'), schud: (a) => a, beurtDoor() {}, codenaamVan: (x) => x, nudge() {} });
  const server = Object.keys(ZICHT).filter(k => ZICHT[k].publiek);
  assert.deepEqual(client.slice().sort(), server.slice().sort());
});
