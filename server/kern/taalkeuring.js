/* ============================================================================
   DE TAALKEURING -- mag dit modelantwoord een vertaling heten?

   WAAROM. De vertaalweg keurde alleen de VORM van het antwoord: een JSON-lijst
   van de juiste lengte met strings erin. Een proef met een nagebootst model
   liet zien dat zes faalvormen daar ongehinderd doorheen komen -- antwoorden in
   de verkeerde taal, een weigering van het model als vertaling, een weggevallen
   plaatshouder, een veranderd bedrag, een vertaalde merknaam. Sinds de
   vertaalkast landt zoiets bovendien op schijf en krijgt iedere volgende
   bezoeker hetzelfde foute antwoord.

   DRIE UITKOMSTEN, want twee zijn er te weinig:

     goed        tonen en bewaren.
     verdacht    tonen, NIET op schijf bewaren. Het is waarschijnlijk goed maar
                 het is niet vast te stellen, en wat je niet kunt vaststellen
                 maak je niet permanent.
     afgewezen   niet tonen. De aanroeper valt terug op het woordenboek en
                 anders op de brontaal -- onvertaalde tekst is beter dan tekst
                 die iets anders zegt dan er stond.

   WAT HIJ NIET IS. Geen taalherkenning en geen kwaliteitsoordeel. Hij vindt
   geen kromme zin, geen verkeerd register en geen vertaling die net het
   verkeerde woord kiest. Hij vindt de fouten die MECHANISCH vast te stellen
   zijn, en zegt bij elk oordeel of het bewijs beslissend was. Een groen vinkje
   hier betekent "geen aantoonbare fout", nooit "goed vertaald" -- dat verschil
   is precies waar kern/taaldekking.js ook op staat.

   ALLEEN OP DE MODELWEG. Het huiswoordenboek gaat hier NIET langs, en dat is
   geen slordigheid: die tabel is met de hand geschreven en nagerekend, en zij
   bevat cellen die legitiem gelijk zijn aan het Nederlands (Afrikaans "les" is
   werkelijk "les"). Een poort die zulke cellen afwijst, verslechtert de app.
   ========================================================================== */
'use strict';
const { draagtSchrift, heeftLetters, beslissend } = require('../taalschrift');

/* Wat er in een vertaling ONGEWIJZIGD hoort terug te komen. */
const PLAATSHOUDERS = [
  /\{\{[^{}]{1,40}\}\}/g,        // {{naam}}
  /\{[^{}\s][^{}]{0,39}\}/g,     // {naam}, {0}
  /%(?:\d+\$)?[sdif]/g,          // %s, %d, %1$s
  /\$\d{1,2}\b/g,                // $1
  /<\/?[a-zA-Z][^<>]{0,60}>/g    // <b>, </b>, <br>
];

/* Merken die nooit vertaald worden. Bewust kort: elke naam hier moet
   ondubbelzinnig zijn, anders wijst de poort een goede vertaling af. */
const MERKEN = ['Rahul Travel Group', 'RTFoundation', 'RTG'];

/* Een model dat niet wil, antwoordt met een zin in plaats van een vertaling.
   Alleen in het Latijnse schrift te herkennen, dus dit is een ONDERgrens. */
const WEIGERING = /^(?:i (?:cannot|can't|am unable|won't)|i'm (?:sorry|unable)|as an ai|sorry,|unfortunately, i)/i;

/* Cijfers uit andere talstelsels terug naar 0-9, zodat "65" en "٦٥" hetzelfde
   bedrag zijn. Een vertaling MAG lokale cijfers gebruiken; zij mag het bedrag
   niet veranderen. */
const CIJFERBLOKKEN = [
  [0x0660, 'Arabisch-Indisch'], [0x06F0, 'Perzisch'], [0x0966, 'Devanagari'],
  [0x09E6, 'Bengaals'], [0x0A66, 'Gurmukhi'], [0x0AE6, 'Gujarati'],
  [0x0B66, 'Oriya'], [0x0BE6, 'Tamil'], [0x0C66, 'Telugu'], [0x0CE6, 'Kannada'],
  [0x0D66, 'Malayalam'], [0x0E50, 'Thai'], [0x0ED0, 'Lao'], [0x0F20, 'Tibetaans'],
  [0x1040, 'Birmaans'], [0x17E0, 'Khmer'], [0xFF10, 'volle breedte']
];
function cijfersNormaal(s) {
  let uit = '';
  for (const ch of String(s == null ? '' : s)) {
    const c = ch.codePointAt(0);
    let vervangen = null;
    for (const [basis] of CIJFERBLOKKEN) if (c >= basis && c <= basis + 9) { vervangen = String(c - basis); break; }
    uit += vervangen == null ? ch : vervangen;
  }
  return uit;
}
function getallenIn(s) { return (cijfersNormaal(s).match(/\d+/g) || []).sort(); }

function plaatshoudersIn(s) {
  const uit = [];
  for (const re of PLAATSHOUDERS) { const m = String(s).match(re); if (m) uit.push(...m); }
  return uit.sort();
}

/* De tekst zonder wat in elke taal hetzelfde blijft. Blijft daar geen letter
   van over, dan valt er niets te vertalen en zegt de schriftcontrole niets. */
function teVertalenRest(s) {
  let r = String(s == null ? '' : s);
  for (const re of PLAATSHOUDERS) r = r.replace(re, ' ');
  for (const m of MERKEN) r = r.split(m).join(' ');
  return r.replace(/https?:\/\/\S+|\S+@\S+\.\S+/g, ' ');
}

/* Een vertaling mag flink korter of langer zijn dan de bron -- Japans is
   compact, Duits lang. Deze band is daarom ruim en levert nooit een afwijzing
   op, alleen een `verdacht`: een getal dat je niet per taal hebt gemeten, mag
   geen vertaling tegenhouden. Hij geldt pas vanaf acht tekens, want op "Ja" of
   "Nee" zegt een verhouding niets -- een beleefde vorm is daar zo vier keer
   zo lang. Boven die grens vangt hij waar hij voor bedoeld is: een model dat
   begint uit te leggen in plaats van te vertalen. */
const KORT = 0.15, LANG = 4;

function keur(bron, vertaling, naar) {
  const b = String(bron == null ? '' : bron);
  const v = String(vertaling == null ? '' : vertaling).trim();
  const redenen = [];
  const hard = (code, uitleg) => { redenen.push({ code, uitleg, ernst: 'afgewezen' }); };
  const zacht = (code, uitleg) => { redenen.push({ code, uitleg, ernst: 'verdacht' }); };

  if (!v) hard('leeg', 'het model gaf niets terug');
  else if (v === b.trim()) hard('onvertaald', 'het antwoord is letterlijk de bron');

  if (v) {
    /* 1. Plaatshouders. Verdwijnt {naam}, dan staat er straks een zin met een
       gat erin op het scherm van een lid. */
    const inB = plaatshoudersIn(b), inV = plaatshoudersIn(v);
    const kwijt = inB.filter(p => !inV.includes(p));
    if (kwijt.length) hard('plaatshouder-weg', 'ontbreekt in de vertaling: ' + kwijt.join(' '));

    /* 2. Getallen. Een veranderd bedrag is erger dan geen vertaling. */
    const gB = getallenIn(b), gV = getallenIn(v);
    const gKwijt = gB.filter(g => !gV.includes(g));
    if (gKwijt.length) hard('getal-weg', 'getal uit de bron ontbreekt of veranderde: ' + gKwijt.join(' '));

    /* 3. Merknamen blijven staan zoals ze staan. */
    const mKwijt = MERKEN.filter(m => b.includes(m) && !v.includes(m));
    if (mKwijt.length) hard('merk-vertaald', 'merknaam niet overgenomen: ' + mKwijt.join(', '));

    /* 4. Een weigering van het model is geen vertaling. */
    if (WEIGERING.test(v) && !WEIGERING.test(b)) hard('weigering', 'het antwoord leest als een weigering van het model');

    /* 5. Het schrift. Alleen beslissend waar de doeltaal het Latijnse schrift
       niet aanvaardt; daar sluit het uit dat er Engels is teruggekomen. */
    const rest = teVertalenRest(b);
    if (beslissend(naar) && heeftLetters(rest) && heeftLetters(v) && !draagtSchrift(v, naar))
      hard('verkeerd-schrift', 'geen enkel teken uit het schrift van deze taal');

    /* 6. Lengte, en met opzet nooit hard. */
    if (b.trim().length >= 8) {
      const ratio = v.length / b.trim().length;
      if (ratio < KORT) zacht('erg-kort', 'de vertaling is ' + ratio.toFixed(2) + 'x de bron');
      else if (ratio > LANG) zacht('erg-lang', 'de vertaling is ' + ratio.toFixed(1) + 'x de bron');
    }
  }

  const afgewezen = redenen.some(r => r.ernst === 'afgewezen');
  return {
    oordeel: afgewezen ? 'afgewezen' : (redenen.length ? 'verdacht' : 'goed'),
    redenen,
    /* Was het bewijs beslissend? Bij een Latijns-schriftige doeltaal kan deze
       laag "verkeerde taal" niet zien, en dat hoort een lezer te weten. */
    schriftBeslissend: beslissend(naar)
  };
}

module.exports = { keur, cijfersNormaal, getallenIn, plaatshoudersIn, MERKEN, KORT, LANG };
