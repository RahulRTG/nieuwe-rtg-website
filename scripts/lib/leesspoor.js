/* HET LEESSPOOR -- welke bestanden RAAKT een toets werkelijk?

   WAAROM DIT ER IS. scripts/lib/bewijsgraaf.js leidt de afhankelijkheden van een
   toets af uit zijn requires. Dat is exact voor code die wordt geimporteerd en
   BLIND voor code die wordt gelezen. test/ast-grens.test.js is daar het
   duidelijkste voorbeeld: de graaf ziet vier afhankelijkheden (de eigen
   AST-modules) terwijl die toets alle 90+ bestanden onder server/routes/ inleest
   en er de beveiligingsregel op stelt. Een wijziging in een route zou die toets
   dus NIET selecteren -- een planner die te weinig kiest, en dat is geen
   traagheid maar een gat.

   Vijfenvijftig toetsbestanden lopen een map af. Ze allemaal met de hand
   opschrijven is een lijst die veroudert; ze allemaal "onbekend" noemen maakt de
   planner waardeloos. Dus meten we het: deze module haakt in de leesfuncties van
   fs en schrijft op welk bestand ONDER DE REPOWORTEL er is gelezen, en door
   welke toets.

   WAT DIT WEL EN NIET BEWEERT, en dat is de kern.

   Een waarneming is een ONDERGRENS. Wat deze ronde is gelezen, kan een volgende
   ronde ook worden gelezen; wat NIET is gelezen, kan de volgende ronde alsnog
   worden gelezen (een tak die deze keer niet werd genomen). Daarom voegt het
   spoor alleen KANTEN TOE aan de graaf en haalt het er nooit een weg. De planner
   kiest daardoor MEER toetsen, nooit minder -- en dat is precies de goede kant om
   fout te zitten. Een toets wordt hier ook niet "volledig" van: dat blijft de
   statische vraag.

   HET KOST BIJNA NIETS, en dat is gemeten: elk pad gaat een keer door een Set en
   wordt daarna nooit meer bekeken. Zonder RTG_LEESSPOOR in de omgeving gebeurt
   er helemaal niets -- dan wordt fs niet eens aangeraakt.

   Gebruik (de toetsloper doet dit zelf):
     RTG_LEESSPOOR=/pad/naar/spoor.jsonl node --require scripts/lib/leesspoor.js ...
*/
'use strict';

const SPOOR = process.env.RTG_LEESSPOOR;
if (SPOOR) haakIn();

function haakIn() {
  const fs = require('fs');
  const path = require('path');
  const WORTEL = path.join(__dirname, '..', '..');
  const VOOR = WORTEL + path.sep;

  /* WIE LEEST ER. RTG_TOETS zet de helper al op elke kindserver; in het
     toetsproces zelf is het het bestand dat node draait. Zo komt het spoor van
     een server op naam van de toets die hem startte -- en dat is precies wat de
     graaf wil weten. */
  const eigen = path.basename(String(process.argv[1] || ''));
  const TOETS = process.env.RTG_TOETS || (/\.(test|e2e)\.js$/.test(eigen) ? eigen : (eigen || 'onbekend'));
  /* EN DOORGEVEN AAN DE KINDEREN. Een toets die zijn server ZELF start (niet via
     test/helper.js, dat RTG_TOETS al meegeeft) leverde een spoor op naam van
     "server.js": 3515 gelezen bestanden die bij geen enkele toets hoorden. Door
     de naam hier in de omgeving te zetten erft elk kindproces hem, en komt het
     spoor van die server op naam van de toets die hem startte -- wat de graaf
     nou juist wil weten. */
  if (/\.(test|e2e)\.js$/.test(eigen)) process.env.RTG_TOETS = TOETS;

  const gezien = new Set();
  const nieuw = [];
  /* Wat NIET in het spoor hoort. node_modules is geen eigen code, .git is geen
     code, en server/data is de runtime-map van een installatie: die verandert
     bij elke rit en zou elke toets van elke andere afhankelijk maken. */
  const NEGEER = /^(node_modules|\.git)\/|^server\/data\//;

  function noteer(p) {
    if (typeof p !== 'string' || !p) return;
    /* Een RELATIEF pad hoort er ook bij. De eerste versie sloeg die over, en dat
       is precies de meerderheid: de toetsloper draait met de repowortel als
       werkmap, dus `readFileSync('package.json')` is een lezing van deze repo.
       De resolve gebeurt alleen als het pad niet met een schuine streep begint,
       zodat het hete geval (absolute paden uit module-resolutie) er niets van
       merkt. */
    const vol = p.charCodeAt(0) === 47 ? p : path.resolve(p);
    if (vol.length < VOOR.length || !vol.startsWith(VOOR)) return;
    const rel = vol.slice(VOOR.length).split(path.sep).join('/');
    if (NEGEER.test(rel) || gezien.has(rel)) return;
    gezien.add(rel);
    nieuw.push(rel);
    if (nieuw.length >= 200) spoel();
  }

  /* Alleen de functies die ECHT inhoud of een maplijst opleveren. existsSync en
     statSync staan er met opzet NIET bij: die worden duizenden keren per boot
     aangeroepen (module-resolutie) en zeggen niets over gebruikte inhoud. Wie
     een bestand alleen op bestaan checkt, hangt er ook van af -- maar die kant
     komt bijna altijd uit een require, en dat weet de graaf al. */
  const WRAP = ['readFileSync', 'readdirSync', 'createReadStream', 'opendirSync'];
  for (const naam of WRAP) {
    const echt = fs[naam];
    if (typeof echt !== 'function') continue;
    fs[naam] = function (p, ...rest) {
      try { noteer(typeof p === 'string' ? p : (p && p.path)); } catch (e) { /* nooit de aanroep breken */ }
      return echt.call(this, p, ...rest);
    };
  }
  if (fs.promises) {
    for (const naam of ['readFile', 'readdir', 'opendir']) {
      const echt = fs.promises[naam];
      if (typeof echt !== 'function') continue;
      fs.promises[naam] = function (p, ...rest) {
        try { noteer(typeof p === 'string' ? p : (p && p.path)); } catch (e) {}
        return echt.call(this, p, ...rest);
      };
    }
  }

  /* SCHRIJVEN MET APPEND, en met de ECHTE appendFileSync die we hierboven niet
     hebben ingepakt. Vier werkers plus hun kindservers schrijven in hetzelfde
     bestand; een append onder de PIPE_BUF-grens (4 kB op Linux) komt heel aan.
     Daarom een regel per pad en niet een blok per proces. */
  const appendEcht = fs.appendFileSync;
  function spoel() {
    if (!nieuw.length) return;
    const blok = nieuw.splice(0, nieuw.length)
      .map(rel => JSON.stringify({ t: TOETS, p: rel })).join('\n') + '\n';
    try { appendEcht.call(fs, SPOOR, blok); } catch (e) { /* geen spoor is geen fout */ }
  }
  process.on('exit', spoel);
}
