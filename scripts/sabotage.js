#!/usr/bin/env node
/* ============================================================================
   DE SABOTAGEMOTOR -- zet de handhaver van een wet ECHT uit, en kijk wie er
   rood wordt.

   WAAROM DIT BESTAAT, EN WAAROM HET IETS ANDERS IS DAN scripts/mutatie.js.

   De mutatiemotor is mechanisch: hij pakt een module die een toets laadt, brengt
   daar de eerste de beste verandering in aan (`===` wordt `!==`, een return
   verdwijnt) en kijkt of de toets omvalt. Dat is breed en goedkoop, en het meet
   iets echts. Maar hij richt niet: hij weet niet WAT een toets beweert, dus hij
   kan de verkeerde plek raken en dan groen melden waar niets gemeten is.

   Dat is geen theorie. In deze ronde stond loghygiene.test.js als "overleefd" in
   MUTATIES.json -- klinkt als een toets zonder tanden. De mutatie die de motor
   erop losliet was de liegpoort (alle endpoints geven een leeg antwoord), en
   deze toets kijkt helemaal niet naar endpoint-inhoud; hij kijkt naar wat de
   LOGGER opschrijft. Zet je in server/log.js `req.path` om naar
   `req.originalUrl` -- de echte fout waartegen hij beschermt, want dan staan de
   sessietokens uit de SSE-URL's in het log -- dan valt hij prompt om.

   Een toets die overleefde omdat de motor de verkeerde kant op schoot, is dus
   iets heel anders dan een toets die niet kan zakken. "Overleefd" verzwijgt dat
   verschil, en daarmee is het een meter die twee dingen op een hoop gooit.

   WAT DEZE MOTOR DOET. Hij leest de wetten uit INVARIANTS.json die een
   UITVOERBARE sabotage dragen: bestand, de tekst die eruit moet, de tekst die
   ervoor in de plaats komt, en welke toets daarvan rood hoort te worden. Per wet:

     1. lees het bestand en controleer dat `van` er precies EEN keer in staat
        (twee keer is dubbelzinnig, nul keer betekent dat de sabotage veroudert
        is -- allebei een harde fout, want een sabotage die niets raakt bewijst
        niets);
     2. schrijf de gesaboteerde versie;
     3. draai de genoemde toets en eis dat hij ZAKT;
     4. zet het bestand terug -- altijd, ook als er iets ontploft.

   DE UITSLAG, en de enige alarmerende stand staat vetgedrukt in je hoofd:

     BEWEZEN     de handhaver ging uit en de toets werd rood. Precies wat je wil.
     OVERLEEFD   de handhaver ging uit en alles bleef groen. DIT IS EEN GAT: de
                 wet heeft een toets die zijn eigen onderwerp niet vasthoudt.
     STUK        de sabotage past niet meer op de bron (`van` niet of meermaals
                 gevonden). De wet is niet weerlegd, maar dit bewijs is verlopen.
     GEEN        deze wet draagt geen uitvoerbare sabotage. Werkvoorraad.

   HERSTEL IS DE BELANGRIJKSTE EIGENSCHAP. Elk bestand wordt vooraf gelezen en in
   een finally byte voor byte teruggeschreven. Wordt het proces halverwege
   afgebroken, dan blijft er een gesaboteerd bestand staan; daarvoor is
   `--herstel`, dat de bewaarde originelen uit .sabotage-herstel/ terugzet. Die
   map staat in .gitignore-gebied en wordt na een geslaagde ronde opgeruimd.

   Draai:  node scripts/sabotage.js            (alle wetten met een sabotage)
           node scripts/sabotage.js RTG-014    (een wet)
           node scripts/sabotage.js --vastleggen  (uitslag naar SABOTAGE.json)
           node scripts/sabotage.js --herstel  (na een afgebroken ronde)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const BEWAAR = path.join(WORTEL, '.sabotage-herstel');
const { leesRegister } = require('./wetten.js');

/* Een toets draaien en zeggen of hij ZAKT. Een niet-nul afsluitcode is hier het
   gewenste antwoord, dus we vangen hem op in plaats van hem te laten opgooien. */
function toetsZakt(bestand) {
  try {
    execFileSync(process.execPath, ['--experimental-sqlite', '--test', 'test/' + bestand],
      { cwd: WORTEL, stdio: 'pipe', timeout: 300000 });
    return false; // afsluitcode 0: de toets bleef groen
  } catch (e) { return true; }
}

function bewaar(rel, tekst) {
  fs.mkdirSync(BEWAAR, { recursive: true });
  fs.writeFileSync(path.join(BEWAAR, rel.replace(/[\/\\]/g, '__')), tekst);
}
function vergeet(rel) {
  try { fs.unlinkSync(path.join(BEWAAR, rel.replace(/[\/\\]/g, '__'))); } catch (e) {}
}

/* Een wet saboteren. Geeft {stand, uitleg} terug en laat de boom achter zoals
   hij hem aantrof -- dat laatste is geen bijzaak maar de voorwaarde om dit
   gereedschap uberhaupt te mogen draaien. */
function saboteer(wet, draai) {
  const loop = draai || toetsZakt;
  const s = wet.sabotageProef;
  if (!s) return { stand: 'GEEN', uitleg: 'geen uitvoerbare sabotage opgegeven' };
  const vol = path.join(WORTEL, s.bestand);
  if (!fs.existsSync(vol)) return { stand: 'STUK', uitleg: 'bestand bestaat niet: ' + s.bestand };
  const origineel = fs.readFileSync(vol, 'utf8');
  const raak = origineel.split(s.van).length - 1;
  if (raak !== 1) {
    return { stand: 'STUK', uitleg: 'de tekst "' + s.van + '" komt ' + raak + 'x voor in ' +
      s.bestand + ' (moet precies 1x) -- deze sabotage is verlopen' };
  }
  const vuil = vuileBestanden();   // wat stond er AL open voor we begonnen
  bewaar(s.bestand, origineel);
  try {
    fs.writeFileSync(vol, origineel.replace(s.van, s.naar));
    const zakt = s.toets.some(t => loop(t));
    return zakt
      ? { stand: 'BEWEZEN', uitleg: s.bestand + ': ' + s.van + ' -> ' + s.naar + ' maakt ' + s.toets.join('/') + ' rood' }
      : { stand: 'OVERLEEFD', uitleg: 'de handhaver ging UIT en ' + s.toets.join('/') + ' bleef groen -- dit is een gat' };
  } finally {
    fs.writeFileSync(vol, origineel);
    vergeet(s.bestand);
    schoonAchteraf(s.bestand, vuil);
  }
}

/* WAT DE TOETS ZELF AANRAAKT, VALT BUITEN ONS VANGNET -- en dat is twee keer
   echt misgegaan.

   De motor zet een bestand terug in een finally, en `--herstel` vangt op wat er
   blijft staan als het proces wordt gekild. Maar een TOETS kan zelf bestanden
   muteren, en die kent de motor niet. test/meterijk.test.js doet dat: hij plakt
   tijdelijk een ijk-aanbouw achter server/routes/klok.js en haalt hem in een
   eigen finally weer weg. Zakt die toets (en bij een sabotage HOORT hij te
   zakken), dan blijkt dat opruimen niet altijd te gebeuren -- twee keer stond
   klok.js daarna met 106 regels aanbouw in de boom, een keer na een kill en een
   keer na een gewone ronde.

   Een gesaboteerd bestand dat blijft staan is het gevaarlijkste wat dit
   gereedschap kan doen: het zet stilletjes iets uit en niemand ziet het, want
   de uitslag zegt gewoon BEWEZEN. Daarom kijkt de motor nu zelf: welke
   getrackte bestanden waren voor de sabotage schoon en zijn daarna vuil? Alles
   wat wij niet zelf hebben aangeraakt, zetten we terug en melden we hardop.

   Wij gebruiken git alleen om te KIJKEN en om onze eigen rommel terug te
   draaien; een bestand dat de gebruiker zelf had openstaan (voor de sabotage al
   vuil) blijft ongemoeid. */
function vuileBestanden() {
  try {
    return new Set(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'],
      { cwd: WORTEL, encoding: 'utf8' })
      .split('\n').map(r => r.slice(3).trim()).filter(Boolean));
  } catch (e) { return null; }
}
function schoonAchteraf(eigen, voor) {
  if (!voor) return;
  const na = vuileBestanden();
  if (!na) return;
  for (const pad of na) {
    if (pad === eigen || voor.has(pad)) continue;
    try {
      execFileSync('git', ['checkout', '--', pad], { cwd: WORTEL, stdio: 'pipe' });
      console.log('       LET OP: ' + pad + ' was door de toets gewijzigd en is teruggezet.');
    } catch (e) {
      console.error('       LET OP: ' + pad + ' is gewijzigd en NIET terug te zetten -- kijk er zelf naar.');
    }
  }
}

function herstel() {
  if (!fs.existsSync(BEWAAR)) { console.log('Niets te herstellen.'); return 0; }
  let n = 0;
  for (const naam of fs.readdirSync(BEWAAR)) {
    const doel = path.join(WORTEL, naam.replace(/__/g, path.sep));
    fs.writeFileSync(doel, fs.readFileSync(path.join(BEWAAR, naam), 'utf8'));
    fs.unlinkSync(path.join(BEWAAR, naam));
    console.log('  hersteld: ' + naam.replace(/__/g, path.sep));
    n++;
  }
  try { fs.rmdirSync(BEWAAR); } catch (e) {}
  console.log(n ? n + ' bestand(en) teruggezet.' : 'Niets te herstellen.');
  return 0;
}

if (require.main === module) {
  if (process.argv.includes('--herstel')) process.exit(herstel());
  const alleen = process.argv.slice(2).filter(a => /^RTG-\d+$/.test(a));
  const wetten = leesRegister().wetten.filter(w => w.sabotageProef && (!alleen.length || alleen.includes(w.id)));
  if (!wetten.length) { console.error('Geen wetten met een uitvoerbare sabotage gevonden.'); process.exit(1); }
  console.log('\n  DE SABOTAGEMOTOR -- ' + wetten.length + ' wet(ten) met een uitvoerbare sabotage\n');
  const telling = { BEWEZEN: 0, OVERLEEFD: 0, STUK: 0, GEEN: 0 };
  const uitslagen = {};
  for (const w of wetten) {
    process.stdout.write('  ' + w.id + '  ' + w.wet.slice(0, 52).padEnd(54));
    const u = saboteer(w);
    telling[u.stand]++;
    uitslagen[w.id] = { stand: u.stand, uitleg: u.uitleg };
    console.log(u.stand);
    if (u.stand !== 'BEWEZEN') console.log('       ' + u.uitleg);
  }
  console.log('\n  ' + telling.BEWEZEN + ' bewezen door sabotage, ' + telling.OVERLEEFD +
    ' overleefd (gaten), ' + telling.STUK + ' verlopen\n');
  /* De uitslag vastleggen -- ALLEEN met --vastleggen, en dat is een reparatie.

     Eerst schreef deze ronde SABOTAGE.json vanzelf. Toen liet ik de mutatiemotor
     over test/sabotage.test.js lopen, en die zette in dit bestand `===` om naar
     `!==`. Daarmee werd `require.main === module` waar zodra de toets deze module
     IMPORTEERDE: de CLI draaide binnen het testproces, met de gemuteerde motor,
     en schreef een SABOTAGE.json vol OVERLEEFD. De mutatie werd keurig
     teruggedraaid, het meetbestand niet -- en daarna las scripts/wetten.js vier
     verzonnen gaten als feit.

     De les is niet "die mutatie is flauw" maar dat een meetbestand nooit als
     BIJWERKING geschreven mag worden. Meten en vastleggen zijn hier overal al
     twee dingen (norm.js --vastleggen, dekking.js --vastleggen); dit script
     wijkt daar nu niet meer van af. Draaien zonder vlag meet en zegt het; wie
     de historie wil verzetten, vraagt daarom. */
  if (!alleen.length && process.argv.includes('--vastleggen')) {
    fs.writeFileSync(path.join(WORTEL, 'SABOTAGE.json'),
      JSON.stringify({ uitleg: 'Uitslag van scripts/sabotage.js: per wet of het uitzetten van zijn ' +
        'handhaver een genoemde toets rood maakt. Gegenereerd, niet met de hand bij te werken.',
        wetten: uitslagen }, null, 2) + '\n');
  }
  if (telling.OVERLEEFD || telling.STUK) {
    console.error('  Een wet waarvan de handhaver uit kan zonder dat er iets rood wordt,');
    console.error('  is geen wet maar een gewoonte.\n');
    process.exit(1);
  }
  process.exit(0);
}

module.exports = { saboteer, herstel, toetsZakt, BEWAAR };
