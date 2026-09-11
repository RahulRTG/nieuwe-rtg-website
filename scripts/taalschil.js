/* ============================================================================
   DE TAALSCHIL BOUWEN -- de tekst van een offline start, per taal.

   WAT HET PROBLEEM WAS. De vertaallaag kan 114 talen, maar alleen MET netwerk:
   tekst wordt van het scherm geschraapt, langs /api/vertaal/ui gestuurd en in
   de kast bewaard. Wie voor het eerst zonder verbinding binnenkomt, krijgt
   Nederlands -- ook als hij zijn taal al had gekozen. Dit script legt die
   eerste ronde vast als bestand, zodat een offline start meteen goed staat.

   DRIE DINGEN DIE DIT SCRIPT MET OPZET NIET DOET:

   1. HET VERZINT GEEN LIJST. De schilteksten worden AFGELEID uit de SHELL van
      public/sw.js -- precies de bestanden die de service worker voorcachet, en
      dus precies wat offline te zien is. Een handlijst zou binnen een maand
      iets anders zeggen dan sw.js, en dan vertaal je schermen die offline
      helemaal niet bestaan.

   2. HET IS GEEN TWEEDE VERTAALMOTOR. Alles loopt langs server/translate.js,
      dezelfde weg als de live vertaling. De schil is een MOMENTOPNAME van die
      weg en geen alternatief ervoor; anders zeggen twee wegen op een dag iets
      anders over dezelfde zin.

   3. HET LEVERT ALLEEN `goed`. De keuring uit server/kern/taalkeuring.js kent
      drie uitkomsten, en de vorige ronde legde vast dat `verdacht` wel getoond
      maar nooit BEWAARD wordt. Een meegeleverd bestand is de meest permanente
      vorm die er is, dus hier komt alleen `goed` in. Een regel die de keuring
      niet haalt, wordt WEGGELATEN -- niet vervangen door de bron, want dan kan
      een lezer een onvertaalde regel niet onderscheiden van een gekeurde.

   WAT ER ZONDER PROVIDER GEBEURT, en waarom dat eerlijk moet blijven. Zonder
   LOCAL_AI_URL of een sleutel valt translate.js terug op het woordenboek, en
   dat dekt alleen hele zinnen die het kent. De uitslag is dan een LAGE dekking
   en geen lege belofte: het bestand zegt zelf hoeveel van de schilteksten
   gevuld zijn. Een dekking van 3% hoort er als 3% in te staan.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const WORTEL = path.join(__dirname, '..');

const { stempel } = require('./lib/stempel');
const oppervlak = require('./tekstoppervlak');
const { DOELTALEN, BRON, padVan } = require('../server/taalschil');
const { keur } = require('../server/kern/taalkeuring');

/* ---- 1. WELKE BESTANDEN STAAN OFFLINE? ---------------------------------- */

/* De SHELL uit sw.js, gelezen als tekst. Wie dit ooit vervangt door een eigen
   lijst, maakt de tweede waarheid die dit script juist vermijdt. */
function schilBestanden() {
  const sw = fs.readFileSync(path.join(WORTEL, 'public', 'sw.js'), 'utf8');
  const start = sw.indexOf('const SHELL');
  if (start < 0) throw new Error('taalschil: geen `const SHELL` in public/sw.js gevonden');
  const eind = sw.indexOf('];', start);
  if (eind < 0) throw new Error('taalschil: de SHELL-lijst in public/sw.js sluit niet');
  const blok = sw.slice(start, eind);
  const paden = [...blok.matchAll(/'([^']+)'/g)].map(m => m[1].split('?')[0]);
  const uit = [...new Set(paden.filter(p => p.endsWith('.html') || p.endsWith('.js')))];
  /* Een lege lijst zou hieronder een dekking van 0 op 0 opleveren, en dat leest
     als "alles gevuld". Liever hard stuk dan een gerustgesteld getal. */
  if (!uit.length) throw new Error('taalschil: de SHELL van sw.js leverde geen enkel scherm op');
  return uit;
}

/* De teksten in die bestanden, met dezelfde ontleder die het huis al gebruikt
   om gebruikerszichtbare tekst te tellen (scripts/tekstoppervlak.js). */
function schilTeksten() {
  const vangst = oppervlak.nieuweVangst();
  let gemist = [];
  for (const p of schilBestanden()) {
    /* De vertaallaag zelf blijft buiten beeld, om dezelfde reden als in
       scripts/tekstoppervlak.js: zijn tekst is machinerie en geen interface.
       Hij staat sinds kort WEL in de schil (anders vertaalt een offline start
       niets), en sleepte daarmee drie eigen regels mee naar de vertaalronde. */
    if (p.indexOf('/shared/i18n') === 0) continue;
    const f = path.join(WORTEL, 'public', p.replace(/^\//, ''));
    if (!fs.existsSync(f)) { gemist.push(p); continue; }
    const rel = path.relative(WORTEL, f);
    const inhoud = fs.readFileSync(f, 'utf8');
    if (p.endsWith('.html')) oppervlak.scanHtml(inhoud, rel, vangst);
    else oppervlak.scanJs(inhoud, rel, vangst);
  }
  return { teksten: [...vangst.teksten.keys()], gemist };
}

/* ---- 2. VERTALEN LANGS DE BESTAANDE WEG --------------------------------- */

async function vertaalSchil(teksten, naar, vertaalBatch) {
  /* translateBatch geeft een ARRAY terug met `keuring` eraan geplakt -- geen
     object met een teksten-veld. Dat is een keer misgegaan en leverde stil nul
     vertalingen op: elke regel las als `onvertaald`, en het bestand zag er
     keurig uit met dekking 0. */
  const rij = await vertaalBatch(teksten, naar, BRON, { leesKast: true, bewaar: false });
  if (!Array.isArray(rij)) throw new Error('taalschil: translateBatch gaf geen lijst terug');
  const regels = {};
  const tel = { goed: 0, afgewezen: 0, onvertaald: 0 };
  teksten.forEach((bron, i) => {
    const r = rij[i];
    const vertaling = r && r.text;
    if (!r || !r.translated || vertaling == null || vertaling === bron) { tel.onvertaald++; return; }
    /* De tweede keuring. translateBatch laat `verdacht` door omdat het getoond
       MAG worden; hier gaat het om meeleveren, en dat is permanent. */
    if (keur(bron, vertaling, naar).oordeel !== 'goed') { tel.afgewezen++; return; }
    regels[bron] = vertaling;
    tel.goed++;
  });
  return { regels, tel };
}

/* ---- 3. WEGSCHRIJVEN ---------------------------------------------------- */

/* HET MEEGELEVERDE BESTAND DRAAGT GEEN STEMPEL, en dat is geen slordigheid maar
   het omgekeerde. De cachenaam van sw.js is een sha256 OVER DE SCHILBESTANDEN;
   een tijdstempel erin zou bij elke herbouw een nieuwe vingerafdruk geven, ook
   als er geen letter veranderde -- en dan haalt elk toestel de complete app-schil
   opnieuw op voor niets. Een meegeleverd bestand hoort deterministisch te zijn.
   Wanneer er gemeten is, staat daarom in TAALSCHIL.json: een register in de
   wortel, dat niet wordt voorgecachet. */
function bestandVoor(code, teksten, uitslag, gemist) {
  const dekking = teksten.length ? uitslag.tel.goed / teksten.length : 0;
  return {
    taal: code,
    bron: BRON,
    uitleg: 'De tekst van de voorgecachete app-schil in deze taal, zodat een offline ' +
      'start niet in het Nederlands hoeft te blijven staan.',
    grens: 'Alleen de VORM is gekeurd (schrift, plaatshouders, bedragen, merknamen). Over de ' +
      'BETEKENIS doet dit bestand geen uitspraak; daarvoor is een spreker nodig (TAALOORDEEL.json). ' +
      'Wat hier niet in staat, valt in de app terug op het netwerk en anders op het Nederlands.',
    vorm: 'gemeten',
    betekenis: 'ongemeten',
    schilTeksten: teksten.length,
    gevuld: uitslag.tel.goed,
    dekking: Math.round(dekking * 1000) / 10,
    afgewezenDoorKeuring: uitslag.tel.afgewezen,
    zonderVertaling: uitslag.tel.onvertaald,
    bestandenNietGevonden: gemist,
    regels: uitslag.regels
  };
}

/* Het register in de wortel: WANNEER is deze schil gebouwd, en wat kwam eruit.
   Alles wat niet deterministisch is, woont hier en niet in het product. */
function registerVoor(schilTeksten, gemist, talen) {
  return {
    stempel: stempel(),
    hoe: 'npm run taalschil',
    uitleg: 'Wat er per taal offline klaarstaat: de tekst van de app-schil die sw.js voorcachet.',
    grens: 'Zegt alleen iets over de VORM (de keuring uit server/kern/taalkeuring.js) en niets over ' +
      'de betekenis. En alleen over de SCHIL: de overige schermen vullen zich nog altijd via het net.',
    schilTeksten,
    bestandenNietGevonden: gemist,
    talen
  };
}

/* HOEVEEL TALEN WERKEN ER WERKELIJK OFFLINE. Geteld op de BESTANDEN en niet op
   het register: een register dat een taal belooft die niet op schijf ligt, is
   precies de stilte die dit huis niet wil. De kijker is injecteerbaar zodat
   test/meterijk.test.js een fout kan planten zonder een bestand weg te halen --
   een meter die je niet hebt zien uitslaan, meet niets. */
function offlineTalen(bestaat) {
  const kijk = bestaat || (p => fs.existsSync(path.join(WORTEL, 'public', p.replace(/^\//, ''))));
  return DOELTALEN.filter(c => kijk(padVan(c))).length;
}

async function bouw(vertaalBatch) {
  const { teksten, gemist } = schilTeksten();
  const uit = [];
  for (const code of DOELTALEN) {
    const uitslag = await vertaalSchil(teksten, code, vertaalBatch);
    const bestand = bestandVoor(code, teksten, uitslag, gemist);
    const doel = path.join(WORTEL, 'public', padVan(code).replace(/^\//, ''));
    fs.mkdirSync(path.dirname(doel), { recursive: true });
    fs.writeFileSync(doel, JSON.stringify(bestand, null, 1) + '\n');
    uit.push({ taal: code, gevuld: bestand.gevuld, dekking: bestand.dekking,
      afgewezen: bestand.afgewezenDoorKeuring, bytes: fs.statSync(doel).size });
  }
  const register = registerVoor(teksten.length, gemist, uit);
  fs.writeFileSync(path.join(WORTEL, 'TAALSCHIL.json'), JSON.stringify(register, null, 1) + '\n');
  return { schilTeksten: teksten.length, gemist, talen: uit };
}

if (require.main === module) {
  const { translateBatch } = require('../server/translate');
  bouw(translateBatch).then(r => {
    console.log('\nDE TAALSCHIL\n');
    console.log('  ' + r.schilTeksten + ' teksten in de voorgecachete schil');
    if (r.gemist.length) console.log('  LET OP: ' + r.gemist.length + ' schilbestanden niet gevonden');
    for (const t of r.talen) {
      console.log('    ' + t.taal.padEnd(3) + ' ' + String(t.gevuld).padStart(5) + ' regels  ' +
        String(t.dekking).padStart(5) + '%  ' + (t.afgewezen ? t.afgewezen + ' afgewezen  ' : '') +
        (t.bytes / 1024).toFixed(0) + ' kB');
    }
    console.log('');
  }).catch(e => { console.error('taalschil: ' + e.message); process.exitCode = 1; });
}

module.exports = { bouw, schilBestanden, schilTeksten, vertaalSchil, bestandVoor, offlineTalen };
