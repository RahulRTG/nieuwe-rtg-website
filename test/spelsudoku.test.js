/* Sudoku: het eerste arcadespel waarvan de score NIET uit de client komt.

   Bij Sneek en Tetris rekent de browser de punten uit en stuurt een getal op;
   de server kan daar niets van narekenen en kapt hem alleen af op de grens uit
   de descriptor. Bij Sudoku kan dat wel, want de regels zijn narekenbaar: de
   server geeft de puzzel uit, houdt de oplossing voor zichzelf, klokt op zijn
   eigen klok en rekent de punten.

   Deze toets bewaakt de drie beweringen die dat waarmaken, want ze zijn alle
   drie stil terug te draaien:
     1. De oplossing verlaat de server niet.
     2. Een score bestaat alleen na een puzzel die bij DEZE speler hoort en die
        correct is opgelost -- getallen uit de client tellen nergens mee.
     3. `arcade-score` WEIGERT sudoku, zodat er geen tweede pad naar het bord is.

   En wat het NIET bewijst staat er ook als toets bij: dat een MENS het heeft
   opgelost. Deze toets lost de puzzels op met een oplosser van vijftien regels
   en krijgt gewoon punten. Dat is geen gat dat we hier dichten, dat is de
   eerlijke grens van de maatregel (zie de kop van spellen/sudoku.js).

   Draai los: node --test test/spelsudoku.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

const motor = require('../server/kern/spellen/sudoku')({ crypto: require('crypto') });
const { NIVEAUS, MIN_PUNTEN, maakPuzzel, aantalOplossingen, isRooster, punten, spel } = motor;

/* ================= de motor, zonder server ================= */

// een eigen oplosser: de toets mag de code onder toets niet gebruiken om zichzelf
// gelijk te geven, dus deze staat hier los van aantalOplossingen()
function los(puzzel) {
  const g = puzzel.slice();
  const mag = (i, v) => {
    const r = Math.floor(i / 9), k = i % 9;
    for (let j = 0; j < 9; j++) if (g[r * 9 + j] === v || g[j * 9 + k] === v) return false;
    const br = r - r % 3, bk = k - k % 3;
    for (let rr = 0; rr < 3; rr++) for (let kk = 0; kk < 3; kk++) if (g[(br + rr) * 9 + bk + kk] === v) return false;
    return true;
  };
  const zoek = () => {
    const i = g.indexOf(0);
    if (i === -1) return true;
    for (let v = 1; v <= 9; v++) if (mag(i, v)) { g[i] = v; if (zoek()) return true; g[i] = 0; }
    return false;
  };
  return zoek() ? g : null;
}
// klopt dit rooster als sudoku: elke rij, kolom en blok precies 1 t/m 9
function heelRooster(g) {
  const compleet = (a) => new Set(a).size === 9 && a.every(v => v >= 1 && v <= 9);
  for (let r = 0; r < 9; r++) if (!compleet(g.slice(r * 9, r * 9 + 9))) return false;
  for (let k = 0; k < 9; k++) if (!compleet(Array.from({ length: 9 }, (_, r) => g[r * 9 + k]))) return false;
  for (let b = 0; b < 9; b++) {
    const br = Math.floor(b / 3) * 3, bk = (b % 3) * 3;
    const blok = [];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) blok.push(g[(br + r) * 9 + bk + k]);
    if (!compleet(blok)) return false;
  }
  return true;
}

test('een uitgegeven puzzel heeft precies EEN oplossing', () => {
  /* Zonder die eis kan een puzzel meerdere goede antwoorden hebben, en dan
     keurt de server een juist ingevuld rooster af omdat het niet het zijne is:
     de speler krijgt ongelijk terwijl hij gelijk heeft. Dat is de duurste fout
     die dit spel kan maken, want hij is vanaf de bank niet te zien. */
  for (const niveau of Object.keys(NIVEAUS)) {
    const { op, puzzel } = maakPuzzel(niveau);
    assert.ok(heelRooster(op), niveau + ': de oplossing is zelf een geldig rooster');
    assert.equal(aantalOplossingen(puzzel), 1, niveau + ': meer dan een oplossing');
    const eigen = los(puzzel);
    assert.deepEqual(eigen, op, niveau + ': een losse oplosser komt op hetzelfde uit');
  }
});

test('de gegeven cijfers van een puzzel horen bij zijn oplossing', () => {
  const { op, puzzel } = maakPuzzel('normaal');
  for (let i = 0; i < 81; i++) if (puzzel[i]) assert.equal(puzzel[i], op[i], 'cel ' + i);
});

test('een moeilijker niveau heeft echt meer gaten, tot aan zijn eigen maat', () => {
  for (const [niveau, n] of Object.entries(NIVEAUS)) {
    const { puzzel, weg } = maakPuzzel(niveau);
    assert.equal(puzzel.filter(v => v === 0).length, weg, niveau + ': gemelde gaten kloppen met de puzzel');
    assert.ok(weg <= n.weg, niveau + ': niet meer gaten dan gevraagd');
    assert.ok(weg >= n.weg - 5, niveau + ': ' + weg + ' gaten van de gevraagde ' + n.weg + ' is te ver eronder');
  }
  assert.ok(NIVEAUS.makkelijk.weg < NIVEAUS.normaal.weg && NIVEAUS.normaal.weg < NIVEAUS.moeilijk.weg);
});

test('twee puzzels achter elkaar zijn niet dezelfde puzzel', () => {
  // een vaste puzzel zou betekenen dat je hem een keer oplost en daarna
  // eindeloos hetzelfde rooster kunt insturen
  const a = maakPuzzel('makkelijk'), b = maakPuzzel('makkelijk');
  assert.notDeepEqual(a.op, b.op);
});

test('de punten lopen op de tijd terug, maar nooit onder de bodem', () => {
  assert.equal(punten('normaal', 0), NIVEAUS.normaal.basis, 'meteen klaar is de volle basis');
  assert.equal(punten('normaal', 10), NIVEAUS.normaal.basis - 10, 'elke seconde kost er een');
  assert.equal(punten('normaal', 99999), MIN_PUNTEN, 'opgelost is opgelost, ook na een uur');
  assert.ok(punten('moeilijk', 60) > punten('makkelijk', 60), 'moeilijker levert meer op bij dezelfde tijd');
});

test('de puntengrens van de descriptor is de hoogste score die echt kan vallen', () => {
  /* Sneek en Tetris hebben een fantasiegrens (999999) omdat de server hun score
     niet kan narekenen. Hier kan dat wel, dus hoort de grens de werkelijke
     bovenkant te zijn -- anders is hij een dood getal dat niets meer tegenhoudt. */
  const hoogste = Math.max(...Object.keys(NIVEAUS).map(n => punten(n, 0)));
  assert.equal(spel.maxPunten, hoogste);
  assert.equal(spel.serverScore, true, 'de vlag die arcade-score laat weigeren');
});

test('een rooster dat geen rooster is wordt niet aangenomen', () => {
  assert.equal(isRooster(Array(81).fill(1)), true);
  assert.equal(isRooster(Array(81).fill(0)), true, 'leeg mag ingestuurd worden; het is alleen niet goed');
  assert.equal(isRooster(Array(80).fill(1)), false, 'te kort');
  assert.equal(isRooster(Array(82).fill(1)), false, 'te lang');
  assert.equal(isRooster('123'), false);
  assert.equal(isRooster(null), false);
  assert.equal(isRooster(Array(81).fill(10)), false, 'tien bestaat niet');
  assert.equal(isRooster(Array(81).fill(-1)), false);
  assert.equal(isRooster(Array(81).fill(1.5)), false);
});

/* ================= over de route, met een echte server ================= */

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sudoku-'));
let child, teller = 0;

function raw(pad, body, token) {
  return fetch(BASE + '/api' + pad, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  });
}
const json = r => r.json();
const su = (actie, body, token) => raw('/member/spel/' + actie, body, token);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

// een geverifieerd volwassen RTG-lid (de progressiegrens laat alleen die door)
async function nieuwLid(geboren = '1990-01-01') {
  const t = Date.now() + '' + (teller++);
  const r = await json(await raw('/auth/register', { name: 'Sudoku ' + t, email: 'su' + t + '@v.test',
    phone: '0633' + String(t).slice(-6), password: 'geheim123', geboortedatum: geboren, tier: 'rtg' }));
  assert.ok(r.token, 'aanmelden lukte niet: ' + JSON.stringify(r).slice(0, 200));
  return { tok: r.token, cn: r.state.user.codename };
}
const lid = async (geboren) => (await nieuwLid(geboren)).tok;

test('de twee sudoku-ingangen zitten achter de ledenpoort', async () => {
  /* De toetsen hieronder roepen de routes aan via een hulpje dat het pad
     samenplakt (`'/member/spel/' + actie`). Dat werkt, maar het laat het
     volledige pad nergens staan -- en de dekkingsmeter (scripts/keuring.js)
     zoekt letterlijke paden in de toetstekst. Hier staan ze dus voluit, met de
     poort erbij: zonder token komt er niemand langs, ook niet met een geldig
     rooster. Dat is geen dekking die we hier verzinnen; het is dekking die al
     bestond en niet te zien was. */
  for (const pad of ['/api/member/spel/sudoku-nieuw', '/api/member/spel/sudoku-klaar']) {
    const r = await fetch(BASE + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niveau: 'makkelijk', rooster: maakPuzzel('makkelijk').op })
    });
    assert.equal(r.status, 401, pad + ' hoort een token te vragen');
  }
});

test('de oplossing verlaat de server niet: je krijgt de puzzel en verder niets', async () => {
  const tok = await lid();
  const r = await json(await su('sudoku-nieuw', { niveau: 'makkelijk' }, tok));
  assert.equal(r.ok, true);
  assert.equal(r.niveau, 'makkelijk');
  assert.equal(r.puzzel.length, 81);
  assert.ok(r.puzzel.some(v => v === 0), 'er zitten gaten in');

  const opgelost = los(r.puzzel);
  /* De hele opbrengst hangt hieraan: staat de oplossing ergens in het antwoord
     -- ook onder een andere naam, ook als losse velden -- dan is alle
     narekening theater. Daarom niet op veldnaam kijken maar op INHOUD. */
  const plat = JSON.stringify(r);
  assert.equal(plat.includes(JSON.stringify(opgelost)), false, 'de oplossing zit in het antwoord: ' + plat.slice(0, 200));
  for (const v of Object.values(r))
    if (Array.isArray(v) && v.length === 81) assert.deepEqual(v, r.puzzel, 'er reist een tweede rooster mee');
});

test('een correct opgeloste puzzel levert punten, en die punten komen van de server', async () => {
  const tok = await lid();
  const nieuw = await json(await su('sudoku-nieuw', { niveau: 'normaal' }, tok));
  const opgelost = los(nieuw.puzzel);

  /* Even wachten, en dat is het hele punt van deze toets. Een oplosser is er in
     milliseconden doorheen, dus zonder pauze zijn "de klok van de server" en
     "de nul die de client meestuurt" niet uit elkaar te houden: allebei de
     volle basis. Met anderhalve seconde ertussen wel. */
  await new Promise(r => setTimeout(r, 1500));

  /* Meegestuurde getallen: een tijd van nul en een score van een miljoen. Als
     de server ook maar een van de twee aanneemt, valt deze toets om. */
  const r = await json(await su('sudoku-klaar', { rooster: opgelost, seconden: 0, punten: 1000000 }, tok));
  assert.equal(r.goed, true);
  assert.equal(r.bewaard, true);
  assert.ok(r.seconden >= 1, 'de tijd is die van de server, niet de nul uit de client: ' + r.seconden);
  assert.ok(r.punten < NIVEAUS.normaal.basis && r.punten >= MIN_PUNTEN,
    'de punten horen onder de basis te liggen omdat er tijd overheen ging, niet ' + r.punten);
  assert.equal(r.punten, NIVEAUS.normaal.basis - r.seconden, 'en precies de basis min de gemeten seconden');
  assert.equal(r.beste, r.punten);

  const bord = await json(await su('arcade-bord', { spel: 'sudoku' }, tok));
  assert.equal(bord.ranglijst, true);
  assert.equal((bord.bord.find(x => x.ik) || {}).punten, r.punten, 'en het bord toont de gerekende score');
});

test('een fout rooster levert niets op, en de puzzel blijft gewoon staan', async () => {
  const tok = await lid();
  const nieuw = await json(await su('sudoku-nieuw', { niveau: 'makkelijk' }, tok));
  const opgelost = los(nieuw.puzzel);
  // een leeg vakje verkeerd invullen; de gegeven cijfers blijven staan
  const fout = opgelost.slice();
  const leeg = nieuw.puzzel.indexOf(0);
  fout[leeg] = (opgelost[leeg] % 9) + 1;

  const r = await json(await su('sudoku-klaar', { rooster: fout }, tok));
  assert.equal(r.goed, false);
  assert.equal(r.punten, undefined, 'een fout rooster levert geen punten');
  const bord = await json(await su('arcade-bord', { spel: 'sudoku' }, tok));
  assert.deepEqual(bord.bord, [], 'en niets op het bord');

  // fout invullen is geen straf: dezelfde puzzel is daarna gewoon af te maken
  const goed = await json(await su('sudoku-klaar', { rooster: opgelost }, tok));
  assert.equal(goed.goed, true, 'de puzzel liep nog');
});

test('een gegeven cijfer wegvegen is een andere fout dan fout invullen', async () => {
  /* Anders lever je een ander (op zichzelf geldig) rooster in dan de puzzel die
     je kreeg, en dat hoort niet als "niet goed opgelost" te klinken. */
  const tok = await lid();
  const nieuw = await json(await su('sudoku-nieuw', { niveau: 'makkelijk' }, tok));
  const opgelost = los(nieuw.puzzel);
  const gegeven = nieuw.puzzel.findIndex(v => v !== 0);
  const gesloopt = opgelost.slice();
  gesloopt[gegeven] = (opgelost[gegeven] % 9) + 1;

  const r = await su('sudoku-klaar', { rooster: gesloopt }, tok);
  assert.equal(r.status, 400);
  assert.match((await json(r)).error, /gegeven cijfers/i);
});

test('zonder lopende puzzel bestaat er geen score, ook niet met een perfect rooster', async () => {
  const tok = await lid();
  const uit_de_lucht = maakPuzzel('makkelijk').op;   // een geldig rooster, maar niet van ons
  const r = await su('sudoku-klaar', { rooster: uit_de_lucht }, tok);
  assert.equal(r.status, 409);

  // en na een oplossing is de puzzel op: je kunt hem niet nog eens inleveren
  const nieuw = await json(await su('sudoku-nieuw', { niveau: 'makkelijk' }, tok));
  const opgelost = los(nieuw.puzzel);
  assert.equal((await json(await su('sudoku-klaar', { rooster: opgelost }, tok))).goed, true);
  assert.equal((await su('sudoku-klaar', { rooster: opgelost }, tok)).status, 409, 'een tweede keer inleveren');
});

test('een nieuwe puzzel vervangt de vorige: je kunt er geen voorraad van aanleggen', async () => {
  const tok = await lid();
  const een = await json(await su('sudoku-nieuw', { niveau: 'makkelijk' }, tok));
  const twee = await json(await su('sudoku-nieuw', { niveau: 'makkelijk' }, tok));
  assert.notDeepEqual(een.puzzel, twee.puzzel);
  /* De oplossing van de EERSTE hoort nu nergens meer bij. Welke van de twee
     afwijzingen je krijgt hangt ervan af of hij toevallig de gegeven cijfers
     van de tweede puzzel respecteert; wat vaststaat is dat er geen score uit
     komt, en dat is waar het hier om gaat. */
  const r = await su('sudoku-klaar', { rooster: los(een.puzzel) }, tok);
  const b = await json(r);
  assert.notEqual(b.goed, true, 'de vorige puzzel telt niet meer mee');
  assert.equal(b.punten, undefined, 'en levert dus ook geen punten op');
  assert.equal((await json(await su('sudoku-klaar', { rooster: los(twee.puzzel) }, tok))).goed, true);
});

test('een onbekend niveau valt terug op normaal in plaats van te breken', async () => {
  const tok = await lid();
  const r = await json(await su('sudoku-nieuw', { niveau: 'onmogelijk' }, tok));
  assert.equal(r.niveau, 'normaal');
  assert.equal(r.puzzel.length, 81);
});

test('arcade-score weigert sudoku, en laat de spellen die het wel mogen met rust', async () => {
  /* De tweede deur. Zonder deze weigering was alle narekening voor niets: je
     stuurt gewoon een getal langs de motor heen. */
  const tok = await lid();
  const r = await su('arcade-score', { spel: 'sudoku', punten: 999999 }, tok);
  assert.equal(r.status, 400);
  assert.match((await json(r)).error, /server bepaald/i);
  const bord = await json(await su('arcade-bord', { spel: 'sudoku' }, tok));
  assert.deepEqual(bord.bord, [], 'er is langs die weg niets binnengekomen');

  const t2 = await json(await su('arcade-score', { spel: 'tetris', punten: 1234 }, tok));
  assert.equal(t2.bewaard, true, 'Tetris rekent de server niet na en blijft dus gewoon werken');
});

test('onder de 18+-grens: je speelt en je hoort je tijd, er wordt alleen niets bewaard', async () => {
  const tok = await lid('2010-01-01');
  const nieuw = await json(await su('sudoku-nieuw', { niveau: 'makkelijk' }, tok));
  assert.equal(nieuw.puzzel.length, 81, 'puzzelen mag gewoon');

  const r = await json(await su('sudoku-klaar', { rooster: los(nieuw.puzzel) }, tok));
  assert.equal(r.goed, true, 'goed is goed, ook onder de grens');
  assert.ok(r.punten > 0, 'en je hoort hoe snel je was');
  assert.equal(r.bewaard, false, 'maar er wordt niets bewaard');
  assert.equal(r.beste, undefined, 'en er komt geen record terug');
  assert.match(r.reden, /geverifieerde volwassen leeftijd/);

  const bord = await json(await su('arcade-bord', { spel: 'sudoku' }, tok));
  assert.equal(bord.ranglijst, false, 'het bord bestaat niet, en is niet "leeg"');
  assert.deepEqual(bord.bord, []);
});

/* ================= de pagina =================
   De server kan nog zo netjes narekenen: zolang de pagina zelf een puzzel maakt
   en een getal opstuurt, loopt er een tweede weg naast. Deze toets kijkt in
   public/apps/spelen.html of die weg echt dicht is. Dat is geen stijlcontrole
   maar de andere helft van dezelfde maatregel. */
test('de pagina maakt geen eigen puzzel meer en stuurt geen eigen score op', () => {
  const pagina = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'spelen.html'), 'utf8');
  assert.ok(pagina.includes("api('sudoku-nieuw'"), 'de pagina vraagt de puzzel op bij de server');
  assert.ok(pagina.includes("api('sudoku-klaar'"), 'en levert het rooster daar in');
  assert.equal(/arcade-score'\s*,\s*\{\s*spel\s*:\s*'sudoku'/.test(pagina), false,
    'de pagina stuurt nog een eigen sudoku-score op');
  assert.equal(/function suVol\b/.test(pagina), false, 'de puzzelmaker staat nog in de pagina');
  assert.equal(/SU\.op\b/.test(pagina), false, 'de oplossing staat nog in de pagina');
});

/* ================= het vergeten, met de kern zelf in de hand =================
   Een uitslag is van MEER dan een en wordt daarom anoniem gemaakt in plaats van
   weggegooid (zie vergeten/anoniem.js). Een arcadescore en een lopende puzzel
   zijn dat niet: daar hangt niemand anders aan, dus die horen gewoon te
   verdwijnen. Dat laat zich niet aan de buitenkant zien -- na verwijdering is
   de vriendschap ook weg, dus een leeg bord bij de vriend bewijst niets -- en
   staat hier daarom met de kern rechtstreeks in de hand. */
function kernMet() {
  const db = { data: {} };
  const kern = require('../server/kern/spellen')({
    db, save() {}, crypto: require('crypto'), zijnVrienden: () => true, codenaamVan: (h) => 'CN-' + h,
    sseToCustomer() {}, isGeblokkeerd: () => false, socialZoek: () => [], sociaalRate: () => true,
    volwassen: () => true, anthropic: null, sseClients: [], lidBoardUit: () => false
  });
  return { db, kern };
}

test('een verwijderd lid laat geen arcadescore en geen lopende puzzel achter', () => {
  const { db, kern } = kernMet();
  kern.sudokuNieuw('anna', 'makkelijk');
  kern.sudokuNieuw('boris', 'makkelijk');
  kern.arcadeScore('anna', 'tetris', 500);
  kern.arcadeScore('boris', 'tetris', 300);
  assert.ok(db.data.spellen.sudoku.anna, 'anna heeft een puzzel open staan');
  assert.equal(db.data.spellen.arcade.tetris.anna.punten, 500);

  kern.spelVergeet('anna');
  assert.equal(db.data.spellen.sudoku.anna, undefined, 'de lopende puzzel is weg');
  assert.equal(db.data.spellen.arcade.tetris.anna, undefined, 'de arcadescore is weg');
  // en die van een ander blijft staan: vergeten is niet leegvegen
  assert.ok(db.data.spellen.sudoku.boris, 'boris puzzelt gewoon door');
  assert.equal(db.data.spellen.arcade.tetris.boris.punten, 300);
});

test('een sudoku die je laat staan verdwijnt vanzelf', () => {
  /* Lopende puzzels zijn tijdelijke toestand met een eigen opruiming en geen
     tak met een bewaartermijn. Blijft die opruiming weg, dan groeit hij
     ongebonden -- precies de fout die de verlaten potjes eerder maakten. */
  const { db, kern } = kernMet();
  kern.sudokuNieuw('anna', 'makkelijk');
  kern.sudokuNieuw('boris', 'makkelijk');
  db.data.spellen.sudoku.anna.start = Date.now() - (motor.OUD_MS + 60000);
  kern.mijnSpellen('boris');   // elke lobby-poll ruimt op
  assert.equal(db.data.spellen.sudoku.anna, undefined, 'de vergeten puzzel is opgeruimd');
  assert.ok(db.data.spellen.sudoku.boris, 'de verse niet');
});
