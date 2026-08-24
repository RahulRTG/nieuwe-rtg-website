/* HET ZAAD MOET EEN RONDE HERHAALBAAR MAKEN, EN NIET MEER DAN DAT.

   server/lib/toeval.js zet het toeval vast met RTG_ZAAD, zodat een toets die om
   de dertig rondes zakt te ONDERZOEKEN is in plaats van te negeren. Deze toets
   bewaakt drie dingen, en het derde is het belangrijkste:

     1. met een zaad geeft dezelfde reeks dezelfde getallen, en een ander zaad
        andere -- anders is het geen zaad maar een decoratie
     2. zonder zaad is er GEEN omweg: kans() is letterlijk Math.random, dus de
        voorziening kost niets in een echte rit
     3. in productie weigert de module te laden, hard en bij het laden

   Die derde is geen netheid. Elke keuze die op deze module leunt wordt
   voorspelbaar voor wie het zaad kent, en de grens tussen "welke tip krijg ik"
   en "welke code hoort bij deze deur" is een grens die code verschuift.

   En de schuld: scripts/toeval.js telt hoeveel code nog zijn EIGEN munt opgooit.
   Zolang dat getal niet nul is, herhaalt een ronde zich maar gedeeltelijk -- en
   dan is "het zaad stond vast" geen bewijs. Vandaar dat TOEVAL.json hier ook
   bewaakt wordt: een voorziening zonder teller is een aanname. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const WORTEL = path.join(__dirname, '..');
const MODULE = JSON.stringify(path.join(WORTEL, 'server', 'lib', 'toeval.js'));

/* Het toeval in een EIGEN proces vragen, want de module leest RTG_ZAAD bij het
   laden. Dat is met opzet zo (een zaad dat halverwege verandert is geen zaad) en
   het betekent dat deze toets zijn stroom niet in dit proces kan wisselen. */
function reeks(zaad, hoeveel, env) {
  const uit = execFileSync(process.execPath, ['-e', `
    const t = require(${MODULE});
    const uit = [];
    for (let i = 0; i < ${Number(hoeveel) || 5}; i++) uit.push(t.kans());
    process.stdout.write(JSON.stringify({ reeks: uit, gezaaid: t.gezaaid(), zaad: t.zaad(), trekkingen: t.trekkingen() }));
  `], { encoding: 'utf8', env: Object.assign({}, process.env, { RTG_ZAAD: zaad }, env || {}) });
  return JSON.parse(uit);
}

test('hetzelfde zaad geeft dezelfde reeks, een ander zaad een andere', () => {
  const a = reeks('ronde-473', 8);
  const b = reeks('ronde-473', 8);
  const c = reeks('ronde-474', 8);
  assert.deepEqual(a.reeks, b.reeks, 'twee processen met hetzelfde zaad horen dezelfde getallen te trekken');
  assert.notDeepEqual(a.reeks, c.reeks, 'een ander zaad hoort een andere reeks te geven; ' +
    'gaven ze hetzelfde, dan wordt het zaad niet gelezen en is de hele voorziening decoratie');
  assert.equal(a.gezaaid, true);
  assert.equal(a.zaad, 'ronde-473');
  assert.equal(a.trekkingen, 8, 'de teller hoort te tellen wat er getrokken is');
  /* Een zaad dat als GETAL zou worden gelezen, zou van elke niet-numerieke
     tekenreeks 0 maken en alle zaden gelijk. Dat is de vorm van stilte waar
     LAT-regel 5 over gaat, dus hij staat hier als bewering. */
  assert.notDeepEqual(reeks('appel', 5).reeks, reeks('peer', 5).reeks,
    'twee niet-numerieke zaden horen niet op dezelfde reeks uit te komen');
});

test('zonder zaad is er geen omweg: kans() IS Math.random', () => {
  const uit = execFileSync(process.execPath, ['-e', `
    const t = require(${MODULE});
    process.stdout.write(JSON.stringify({ zelfde: t.kans === Math.random, gezaaid: t.gezaaid(),
      zaad: t.zaad(), trekkingen: t.trekkingen(), uitleg: t.uitleg() }));
  `], { encoding: 'utf8', env: Object.assign({}, process.env, { RTG_ZAAD: '' }) });
  const r = JSON.parse(uit);
  assert.equal(r.zelfde, true,
    'zonder zaad hoort kans() letterlijk Math.random te ZIJN -- geen wikkel, geen teller. ' +
    'Een voorziening die in een echte rit iets kost, wordt uitgezet.');
  assert.equal(r.gezaaid, false);
  assert.equal(r.zaad, null);
  assert.match(r.uitleg, /echt toeval/);
});

test('terugNaarVers() zet de STROOM terug, niet alleen de teller', () => {
  const uit = execFileSync(process.execPath, ['-e', `
    const t = require(${MODULE});
    const voor = [t.kans(), t.kans(), t.kans()];
    t.terugNaarVers();
    const na = [t.kans(), t.kans(), t.kans()];
    process.stdout.write(JSON.stringify({ voor, na, trekkingen: t.trekkingen() }));
  `], { encoding: 'utf8', env: Object.assign({}, process.env, { RTG_ZAAD: 'reset-proef' }) });
  const r = JSON.parse(uit);
  assert.deepEqual(r.na, r.voor,
    'na terugNaarVers() hoort dezelfde reeks opnieuw te beginnen. Zet de reset alleen de TELLER ' +
    'terug, dan krijgt een tweede toets op dezelfde server de trekkingen die de eerste had ' +
    'overgelaten -- het zaad staat dan vast en de uitkomst verschilt alsnog.');
  assert.equal(r.trekkingen, 3, 'en de teller telt vanaf de reset opnieuw');
});

test('in productie weigert de module te laden', () => {
  let fout = null;
  try {
    execFileSync(process.execPath, ['-e', 'require(' + MODULE + ');'],
      { encoding: 'utf8', stdio: 'pipe',
        env: Object.assign({}, process.env, { RTG_ZAAD: 'x', NODE_ENV: 'production' }) });
  } catch (e) { fout = String(e.stderr || e.message); }
  assert.ok(fout, 'met RTG_ZAAD en NODE_ENV=production hoort het laden te MISLUKKEN');
  assert.match(fout, /RTG_ZAAD/, 'en de melding hoort te zeggen waarom');
  /* DE TEGENPROEF. Zonder deze bewering zou een module die ALTIJD gooit deze
     toets ook halen, en dan meet hij niets (LAT-regel 9). */
  const goed = execFileSync(process.execPath, ['-e', 'require(' + MODULE + '); process.stdout.write("ok");'],
    { encoding: 'utf8', env: Object.assign({}, process.env, { RTG_ZAAD: 'x', NODE_ENV: 'test' }) });
  assert.equal(goed, 'ok', 'buiten productie hoort hij gewoon te laden');
});

test('de toevalschuld staat op nul en TOEVAL.json weet dat', () => {
  const stand = JSON.parse(fs.readFileSync(path.join(WORTEL, 'TOEVAL.json'), 'utf8'));
  assert.equal(typeof stand.gemeten.totaal, 'number');
  const uit = execFileSync(process.execPath, [path.join(WORTEL, 'scripts', 'toeval.js')],
    { cwd: WORTEL, encoding: 'utf8' });
  const m = uit.match(/directe Math\.random-aanroepen\s*:\s*(\d+)/);
  assert.ok(m, 'scripts/toeval.js hoort een getal te melden, niet niets:\n' + uit);
  const nu = Number(m[1]);
  assert.ok(nu <= stand.gemeten.totaal,
    'er staat nieuwe code buiten het zaad (' + nu + ' tegen ' + stand.gemeten.totaal + '). ' +
    'Een module die Math.random zelf aanroept doet niet mee aan RTG_ZAAD, en dan herhaalt een ' +
    'ronde zich maar gedeeltelijk. Hoort het juist ONvoorspelbaar te zijn, gebruik crypto.');
  assert.ok(stand.gemeten.modulesOpHetZaad > 0,
    'als er nul modules op het zaad zitten, bewaakt deze ratel een voorziening die niemand gebruikt');
});

test('crypto-toeval telt met OPZET niet mee in de schuld', () => {
  /* Een sessietoken, een pincode of een entreecode hoort onvoorspelbaar te zijn,
     ook als je het zaad kent. Wie crypto zou meetellen maakt een schuld die nooit
     nul mag worden -- en een ratel die zijn nul niet kan halen, wordt uitgezet.
     Deze bewering legt die grens vast, zodat niemand hem per ongeluk verschuift. */
  const { scanBestand } = require('../scripts/lib/staatscan.js');
  const proef = "const crypto = require('crypto');\n" +
    "const pin = crypto.randomInt(1000, 10000);\n" +
    "const id = crypto.randomBytes(6).toString('hex');\n";
  const w = scanBestand(proef, 'proef.js').willekeur;
  assert.equal(w.math, 0, 'hier staat geen Math.random');
  assert.equal(w.crypto, 2, 'en wel twee crypto-trekkingen; die horen apart geteld te worden');
  const stand = JSON.parse(fs.readFileSync(path.join(WORTEL, 'TOEVAL.json'), 'utf8'));
  assert.ok(stand.gemeten.bestandenMetCryptoToeval > 100,
    'er horen honderden bestanden met crypto-toeval te zijn; staat dat op nul, dan telt de scan ' +
    'ze niet en is de grens tussen "keuze" en "sleutel" niet meer te zien');
});
