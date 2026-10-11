/* ============================================================================
   BEWIJS 8 (MENSELIJK) -- de ondergrens die zonder oordeel te meten is.

   WAAROM DIT BESTAAT. BETROUWBAARHEID.md rij 8 vraagt: krijgt de gebruiker
   nooit een kale 500, TypeError, lege pagina of dode knop? scripts/appwerkt.js
   leidde dat tot 11 oktober 2026 alleen AF: zag de proef een JS-fout of een 500,
   dan was het DEFECT, en anders NIET_GETEST "afgeleid: geen kale fout gezien".
   Daarmee stond bewijs 8 op alle 114 rijen op NIET_GETEST, want niets zien is
   geen bewijs.

   Dit bestand maakt er een ONDERGRENS van: een rij lijst eisen die een machine
   kan nagaan zonder te beoordelen of een tekst prettig leest. Haalt een scherm
   ze, dan is bewijs 8 BEWEZEN -- en dat woord betekent dan precies deze lijst en
   niets meer (zie NIET_GEMETEN). De eisen, en waar ze gemeten worden:

     1. geen kale JS-fout en geen 5xx bij laden of bedienen     appwerkt.js (luister)
     2. een weigering MET een zin staat op het scherm           appwerkt.js (beoordeelWeigeringen)
     3. geen kale techniek in beeld: een stacktrace, een        hier (kaleKlachten)
        foutklasse, een rauw JSON-antwoord, een fetch-melding,
        of rommel als undefined/NaN/[object Object]/null
     4. elke eigen knop draagt een toegankelijke naam           appwerkt.js (naamloos)
        (tekst, aria-label, aria-labelledby of title): zonder
        naam zegt een schermlezer alleen "knop"
     5. de proef heeft genoeg gezien: bedienbaar is BEWEZEN     menselijkOordeel hieronder
        (minstens de helft van de eigen knoppen aangetikt)

   EIS 3 IJKT ZICH AAN HET SCHERM ZELF, zoals scripts/lib/schermleugen.js dat
   voor zekerheidswoorden doet: een patroon is pas een klacht als het in de
   gerenderde tekst staat en NIET in de zichtbare tekst van het statische
   bestand. Een uitleg die het woord "null" gebruikt, of een codevoorbeeld in de
   bron, telt dus niet. Anders dan de liegronde vergelijkt dit met de TEKST van
   het bestand en niet met de hele bron: `undefined` staat in vrijwel elk
   inline script, en dan zou de ijking elke vondst wegpoetsen.

   WAT DIT NIET MEET, en dat staat in elke uitslag (NIET_GEMETEN):
     - of een melding een WEG biedt en niet alleen een reden: "wat kan ik nu
       doen" is een taalvraag, en die beoordeelt een mens;
     - of de taal begrijpelijk is;
     - toetsenbordbediening, schermlezergedrag en contrast (contrast en structuur
       zijn harde poorten van `npm run a11y`, hier niet herhaald);
     - de telefoonkant (TIKKEN.json, ADAPTIEF.md);
     - en het belangrijkste: er is nog nooit een mens met een handicap door dit
       huis gelopen (TOEGANKELIJK.md). Alles hier is gemeten met een browser.
   ========================================================================== */
'use strict';

const { ROMMEL } = require('./schermleugen');

/* Kale techniek. Elk patroon is iets wat een ontwikkelaar herkent en een lid
   niet hoort te zien. Met opzet smal: "Er ging iets mis" is geen klacht, dat is
   precies de vorm die wel mag. */
const TECHNIEK = [
  { naam: 'stacktrace', re: /\bat [\w$.<>[\]]+ \([^)\n]*:\d+:\d+\)/ },
  { naam: 'foutklasse', re: /\b(TypeError|ReferenceError|SyntaxError|RangeError|EvalError|URIError)\b/ },
  { naam: 'JS-foutzin', re: /Cannot read propert(y|ies) of|is not a function\b|is not defined\b|Unexpected token\b|Unexpected end of JSON/ },
  { naam: 'rauw JSON-antwoord', re: /\{\s*"(error|ok|status|message|code)"\s*:/ },
  { naam: 'kale netwerkmelding', re: /\b(Failed to fetch|NetworkError when attempting|Load failed|net::ERR_[A-Z_]+)\b/ },
  { naam: 'kale HTTP-status', re: /\b(Internal Server Error|Bad Gateway|Service Unavailable|Gateway Timeout)\b/ }
];

/* De zichtbare tekst van het statische bestand: zonder scripts, stijlen,
   commentaar en tags. Dat is de ijklijn -- wat de auteur zelf in beeld zette. */
function statischeTekst(html) {
  return String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ');
}

/* tekst: wat het lid ZIET (innerText). statisch: het .html-bestand. */
function kaleKlachten({ tekst, statisch }) {
  const ijk = statischeTekst(statisch);
  const uit = [];
  for (const p of TECHNIEK.concat(ROMMEL)) {
    const m = p.re.exec(tekst || '');
    if (!m) continue;
    if (p.re.test(ijk)) continue;
    const plek = Math.max(0, m.index - 30);
    uit.push('kale techniek in beeld (' + p.naam + '): "' + String(tekst).slice(plek, m.index + m[0].length + 30).replace(/\s+/g, ' ').trim().slice(0, 90) + '"');
  }
  return uit;
}

const NIET_GEMETEN = 'NIET gemeten: of een melding een weg biedt, of de taal begrijpelijk is, toetsenbord, ' +
  'schermlezergedrag en contrast (npm run a11y), de telefoonkant -- en er is nog nooit een mens met een ' +
  'handicap doorheen gelopen (TOEGANKELIJK.md)';

/* Het oordeel. `stuk` en `laadCrash` komen uit eisen 1 en 2 (en blijven, zoals
   voorheen, het eerste wat telt); `kaal` uit eis 3, `naamloos` uit eis 4, en
   `bedienbaar` is de stand van bewijs 2 voor eis 5. */
function menselijkOordeel({ stuk = [], laadCrash = [], kaal = [], naamloos = [], bedienbaar, eigenKnoppen = 0 }) {
  if (laadCrash.length || stuk.length) {
    return { status: 'GEBLOKKEERD_DOOR_DEFECT', reden: 'een kale JS-fout of 500 bereikt de gebruiker: ' + (laadCrash[0] || stuk[0]) };
  }
  if (kaal.length) return { status: 'GEBLOKKEERD_DOOR_DEFECT', reden: kaal[0] + (kaal.length > 1 ? ' (en ' + (kaal.length - 1) + ' meer)' : '') };
  if (naamloos.length) {
    return { status: 'GEBLOKKEERD_DOOR_DEFECT',
      reden: naamloos.length + ' eigen knop(pen) zonder toegankelijke naam (geen tekst, aria-label, aria-labelledby of title): een schermlezer zegt alleen "knop"' };
  }
  if (bedienbaar !== 'BEWEZEN') {
    return { status: 'NIET_GETEST',
      reden: 'geen kale fout, geen kale techniek en geen naamloze knop gezien, maar de bediening is niet beproefd (bedienbaar staat op ' + bedienbaar + '); wat de proef niet aantikte, is niet gezien' };
  }
  return { status: 'BEWEZEN',
    reden: 'ondergrens gehaald over ' + eigenKnoppen + ' eigen knop(pen): geen kale JS-fout of 5xx, elke weigering met haar zin op het scherm, geen kale techniek in beeld na laden en na elke tik, elke eigen knop met een toegankelijke naam. ' + NIET_GEMETEN };
}

module.exports = { TECHNIEK, statischeTekst, kaleKlachten, menselijkOordeel, NIET_GEMETEN };
