/* HET GEZAG (scripts/gezag.js + GEZAG.json).

   WAT HIER OP HET SPEL STAAT. RTG beantwoordt op vijf plekken dezelfde vraag --
   mag de machine dit zelf -- met vijf verschillende schalen, en geen van de vijf
   kan de andere vier lezen. Dat is LAT.md regel 4 op de plek waar hij het duurst
   is. De meter houdt dat getal een kant op.

   MAAR EEN METER DIE JE NIET HEBT ZIEN UITSLAAN, MEET NIETS (LAT.md regel 10),
   en dat geldt dubbel voor een meter die zijn eigen invoer met een tekstpatroon
   bij elkaar zoekt. Deze toets voert hem daarom vier keer iets bekend-fouts:

     1 een module die een trede overschrijft zonder de schaal te importeren
       -> het getal MOET stijgen en de ratel MOET zakken;
     2 een hernoemde trede in een geregistreerde schaal
       -> de meter MOET zichzelf stuk verklaren en niet netjes 0 melden;
     3 een tegenspraak waarvan een kant is weggehaald
       -> hij MOET 'veranderd' melden in plaats van hem te blijven opdreunen;
     4 EN DE NEGATIEVE CONTROLE, die er is omdat hij bij het bouwen echt raak
       sloeg: een module die de schaal WEL importeert en er netjes tegen
       vergelijkt mag NIET meetellen. De eerste versie van deze meter keek per
       schaal in plaats van per woord, en beschuldigde daardoor
       server/kern/stuur.js -- dat keurig `require('./stuur/beleid')` doet -- van
       een kopie uit stadsweefsel/ainiveau.js, omdat 'verboden' toevallig in
       beide schalen staat. Een meter die correcte code aanwijst wordt weggeklikt
       en daarna genegeerd; die val hoort dus een toets te hebben en geen
       opmerking.

   Draai los: node --test test/gezag.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const gezag = require('../scripts/gezag');

const WORTEL = path.join(__dirname, '..');
const SCRIPT = path.join(WORTEL, 'scripts', 'gezag.js');

/* Draai de meter en geef exitcode plus uitvoer terug. Hij zakt met opzet
   (exit 1 en 2 zijn zijn werk), dus een fout is hier geen uitzondering. */
function draai(args) {
  try {
    const uit = execFileSync(process.execPath, [SCRIPT, ...(args || [])],
      { encoding: 'utf8', cwd: WORTEL });
    return { code: 0, uit };
  } catch (e) {
    return { code: e.status == null ? 2 : e.status, uit: String(e.stdout || '') + String(e.stderr || '') };
  }
}

const getal = (uit, label) => {
  const m = new RegExp(label + '\\s*:\\s*(\\d+)').exec(uit);
  assert.ok(m, 'de uitvoer noemt "' + label + '" niet:\n' + uit);
  return Number(m[1]);
};

/* Een mutatie doet drie dingen: iets kapots neerzetten, meten, opruimen. Het
   opruimen staat in een finally -- een ijking die rommel achterlaat is erger dan
   geen ijking. */
function metNieuwBestand(relPad, inhoud, doe) {
  const vol = path.join(WORTEL, relPad);
  assert.equal(fs.existsSync(vol), false, 'de mutatie overschrijft nooit een bestaand bestand: ' + relPad);
  fs.writeFileSync(vol, inhoud);
  try { return doe(); } finally { try { fs.unlinkSync(vol); } catch (e) {} }
}

function metVervangen(relPad, van, naar, doe) {
  const vol = path.join(WORTEL, relPad);
  const oud = fs.readFileSync(vol, 'utf8');
  assert.ok(oud.includes(van), 'de mutatie vindt zijn aangrijpingspunt niet in ' + relPad + ': ' + van);
  try { fs.writeFileSync(vol, oud.split(van).join(naar)); return doe(); }
  finally { fs.writeFileSync(vol, oud); }
}

/* ---------- de grondstand ---------- */

test('de meter vindt de vijf geregistreerde vocabulaires en staat gelijk aan GEZAG.json', () => {
  const r = draai();
  assert.equal(r.code, 0, 'de grondstand hoort groen te zijn:\n' + r.uit);
  assert.equal(getal(r.uit, 'gezagsvocabulaires'), 5);
  const vast = JSON.parse(fs.readFileSync(path.join(WORTEL, 'GEZAG.json'), 'utf8'));
  assert.equal(getal(r.uit, 'losse niveaunamen'), vast.gemeten.losseNiveaunamen,
    'de gemeten stand loopt uit de pas met GEZAG.json');
  assert.equal(vast.gemeten.vocabulaires, 5);
});

test('de meting is in proces te doen, en geeft dezelfde getallen als de opdrachtregel', () => {
  /* Niet alleen gemak: zolang deze module alleen als script bestond, kon de
     mutatiemotor er niet bij en telde deze toets als "niet gemeten" -- een toets
     met elf beweringen die in de boekhouding als ongemeten stond. */
  const nu = gezag.meet();
  assert.equal(nu.stuk.length, 0, 'de meter hoort heel te zijn: ' + nu.stuk.join('; '));
  assert.equal(nu.vocabulaires, gezag.REGISTER.length);
  const r = draai();
  assert.equal(getal(r.uit, 'gezagsvocabulaires'), nu.vocabulaires);
  assert.equal(getal(r.uit, 'losse niveaunamen'), nu.losseNiveaunamen);
});

test('elke schaal heeft minstens drie treden en geen twee vocabulaires zijn hetzelfde', () => {
  /* Een "schaal" van een of twee treden is een vlaggetje en geen schaal, en twee
     identieke schalen zouden geen vijf vocabulaires zijn maar een met een kopie
     -- dan telt de meter iets anders dan hij zegt. */
  const gezien = new Set();
  for (const v of gezag.REGISTER) {
    assert.ok(v.schaal.length >= 3, v.bestand + ' heeft maar ' + v.schaal.length + ' treden');
    assert.equal(new Set(v.schaal).size, v.schaal.length, v.bestand + ' noemt een trede twee keer');
    const sleutel = v.schaal.join('|');
    assert.equal(gezien.has(sleutel), false, 'twee vocabulaires met dezelfde schaal: ' + v.bestand);
    gezien.add(sleutel);
  }
});

test('elke geregistreerde schaal staat echt in zijn eigen bestand', () => {
  /* Anders is het register een belofte in tekst zonder belofte in code
     (LAT.md regel 6) -- en dan meet alles erna niets meer. */
  const vast = JSON.parse(fs.readFileSync(path.join(WORTEL, 'GEZAG.json'), 'utf8'));
  for (const v of vast.vocabulaires) {
    const bron = fs.readFileSync(path.join(WORTEL, v.bestand), 'utf8');
    for (const trede of v.schaal) {
      assert.ok(bron.includes("'" + trede + "'"),
        v.bestand + ' mist de trede ' + trede + ' uit zijn eigen schaal');
    }
    assert.ok(bron.includes(v.beslisser), v.bestand + ' mist zijn beslisser ' + v.beslisser);
  }
});

/* ---------- mutatie 1: een nieuwe losse niveaunaam ---------- */

test('MUTATIE: een module die een trede overschrijft zonder de schaal te importeren laat de ratel zakken', () => {
  const voor = getal(draai().uit, 'losse niveaunamen');
  const bron = "'use strict';\n" +
    '// een module die het oordeel van risico.js overschrijft in plaats van ophaalt\n' +
    'module.exports = function zzIjk(zaak) {\n' +
    "  return { niveau: 'assist', reden: 'verzonnen voor de ijking' };\n" +
    '};\n';
  metNieuwBestand('server/kern/zz-gezag-ijk.js', bron, () => {
    const r = draai();
    assert.equal(getal(r.uit, 'losse niveaunamen'), voor + 1,
      'de meter ziet de nieuwe losse niveaunaam niet -- dan meet hij niets');
    assert.equal(r.code, 1, 'de ratel hoort te zakken bij een verslechtering:\n' + r.uit);
    assert.match(r.uit, /ZAKT/);
  });
  assert.equal(getal(draai().uit, 'losse niveaunamen'), voor, 'na opruimen staat de stand terug');
});

/* HET REGISTER MAG DEZE TOETS NOOIT OVERLEVEN IN GEWIJZIGDE VORM, en dat is een
   les die geld heeft gekost. De eerste versie riep --vastleggen aan tegen het
   ECHTE GEZAG.json en controleerde achteraf dat het niet was veranderd. Dat gaat
   goed zolang de code klopt -- maar de mutatiemotor draait deze toets met een
   omgedraaide vergelijking IN scripts/gezag.js, en toen sloeg de ratel om en
   schreef hij een verzonnen stand (losseNiveaunamen: 0) naar schijf. De
   controle-achteraf zag dat wel, maar de schade stond er al: de volgende ronde
   meldde "ZAKT: 0 -> 22" over code waar niets mis mee was.

   Een toets die het bestand kan slopen dat hij bewaakt, is een toets die je maar
   een keer vertrouwt. Dus: eerst een kopie opzij, en terugzetten in een finally,
   wat er ook gebeurt -- ook als de code onder de toets is gemuteerd. */
function metBewaardRegister(doe) {
  const pad = path.join(WORTEL, 'GEZAG.json');
  const voor = fs.readFileSync(pad, 'utf8');
  try { return doe(voor); } finally { fs.writeFileSync(pad, voor); }
}

test('MUTATIE: --vastleggen weigert een verslechtering vast te leggen', () => {
  const bron = "'use strict';\nmodule.exports = () => ({ niveau: 'klaarzetten' });\n";
  metBewaardRegister((vastVoor) => {
    metNieuwBestand('server/kern/zz-gezag-ijk2.js', bron, () => {
      const r = draai(['--vastleggen']);
      assert.equal(r.code, 1, 'de ratel legt geen verslechtering vast:\n' + r.uit);
      assert.match(r.uit, /GEWEIGERD/);
    });
    assert.equal(fs.readFileSync(path.join(WORTEL, 'GEZAG.json'), 'utf8'), vastVoor,
      'GEZAG.json is niet aangeraakt door de geweigerde poging');
  });
});

/* ---------- mutatie 2: de meter zelf stukmaken ---------- */

test('MUTATIE: een hernoemde trede maakt de meter STUK, en dan zakt hij in plaats van 0 te melden', () => {
  /* LAT.md regel 3: stilvallen is geen uitkomst. Zonder deze zelfijking zou een
     hernoemde schaal alle losse niveaunamen laten verdampen en zou de meter
     juist GROENER worden naarmate hij minder ziet. */
  metVervangen('server/kern/geldbeleid/regels.js', "'klaarzetten'", "'zzklaarzetten'", () => {
    const r = draai();
    assert.equal(r.code, 2, 'een onvindbare schaal hoort de meter stuk te verklaren:\n' + r.uit);
    assert.match(r.uit, /DE METER IS STUK/);
    assert.match(r.uit, /geldbeleid\/regels\.js/);
  });
  assert.equal(draai().code, 0, 'na herstel meet hij weer gewoon');
});

test('MUTATIE: een verdwenen beslisser maakt de meter ook stuk', () => {
  metVervangen('server/kern/stadsweefsel/ainiveau.js', 'function magAutomatisch', 'function zzWeg', () => {
    const r = draai();
    assert.equal(r.code, 2);
    assert.match(r.uit, /magAutomatisch/);
  });
});

/* ---------- mutatie 3: de tegenspraak ---------- */

test('de vastgelegde tegenspraak wordt bij elke ronde opnieuw nagetrokken', () => {
  const r = draai();
  assert.match(r.uit, /tegenspraken\s*:\s*1/);
  assert.match(r.uit, /\[staat nog\] vergunning-of-aanvraag-afwijzen/,
    'de tegenspraak hoort nog te staan; is hij opgelost, werk dan GEZAG.json bij');
});

test('MUTATIE: verdwijnt een kant van de tegenspraak, dan meldt hij "veranderd" en niet stilzwijgend hetzelfde', () => {
  metVervangen('server/kern/stadsweefsel/ainiveau.js',
    "'vergunning-weigeren': { niveau: 4", "'vergunning-weigeren': { niveau: 2", () => {
      const r = draai();
      assert.match(r.uit, /\[veranderd\] vergunning-of-aanvraag-afwijzen/,
        'een tegenspraak waarvan een kant wijzigt mag niet ongewijzigd blijven staan');
      assert.match(r.uit, /werk GEZAG\.json bij/);
    });
});

/* ---------- de negatieve controle ---------- */

test('een module die de schaal WEL importeert telt niet mee als losse niveaunaam', () => {
  const voor = getal(draai().uit, 'losse niveaunamen');
  const bron = "'use strict';\n" +
    "const { beleidVoor } = require('./stuur/beleid');\n" +
    'module.exports = function zzIjk(pad, wereld) {\n' +
    '  const beleid = beleidVoor(pad, wereld);\n' +
    "  return beleid.niveau === 'verboden' ? null : beleid;\n" +
    '};\n';
  metNieuwBestand('server/kern/zz-gezag-ijk3.js', bron, () => {
    assert.equal(getal(draai().uit, 'losse niveaunamen'), voor,
      'een module die zijn schaal ophaalt houdt geen kopie vast en hoort niet beschuldigd te worden');
  });
});

test('server/kern/stuur.js blijft ongemoeid: hij leest zijn eigen, geimporteerde schaal', () => {
  /* Dit is de valse positieve die de eerste versie van de meter maakte, met naam
     vastgelegd zodat hij niet terugkomt. 'verboden' staat in twee schalen. */
  const r = draai(['--lijst']);
  assert.doesNotMatch(r.uit, /server\/kern\/stuur\.js\s+stadsweefsel/,
    'stuur.js importeert stuur/beleid.js en mag niet aan ainiveau.js worden toegeschreven');
  const bron = fs.readFileSync(path.join(WORTEL, 'server/kern/stuur.js'), 'utf8');
  assert.ok(bron.includes("require('./stuur/beleid')"), 'de aanname onder deze toets: stuur.js haalt zijn schaal op');
  assert.ok(bron.includes("niveau === 'verboden'"), 'en vergelijkt er ook echt tegen');
});

/* ---------- wat de meter NIET beweert ---------- */

test('de meter telt geen Nederlands: "auto" als voertuig en "hand" als lichaamsdeel tellen niet mee', () => {
  /* De eerste versie zocht de woorden overal en vond 36 gevallen, waarvan de
     meeste over auto's gingen. Nu moet het woord aan een veld hangen dat
     letterlijk `niveau` heet. Een census die je moet wegstrepen wordt binnen een
     week genegeerd. */
  const voor = getal(draai().uit, 'losse niveaunamen');
  const bron = "'use strict';\n" +
    'module.exports = {\n' +
    "  vervoer: 'auto',\n" +
    "  bediening: 'hand',\n" +
    "  toestand: 'verboden',\n" +
    "  soort: 'direct'\n" +
    '};\n';
  metNieuwBestand('server/kern/zz-gezag-ijk4.js', bron, () => {
    assert.equal(getal(draai().uit, 'losse niveaunamen'), voor,
      'vier gezagswoorden zonder niveau-veld: dit is taal, geen gezag');
  });
});
