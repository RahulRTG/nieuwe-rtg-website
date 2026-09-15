/* ============================================================================
   DE SNEDE VAN DE APP STORE -- wat het lid zelf mag, en wat daarvan overblijft.

   Dit is de helft van REP-03 die per DOMEIN verschilt. De wet zelf
   (effectief = gevraagd ∩ geverEffectief ∩ beleid ∩ context) woont in
   kern/namens/versmalling.js en weet niets van apps; wat een lid van de App
   Store zelf mag, weet alleen deze laag. Die scheiding is met opzet: zou de
   gedeelde laag machtiging-id's gaan kennen, dan is hij geen invariant meer
   maar het begin van een supermandaat-object.

   WAAROM HET EEN EIGEN BESTAND IS EN GEEN REGEL IN ./winkel.js. Twee routes
   verlenen (`installeer` en `verleen`) en ze moeten aantoonbaar dezelfde snede
   maken. Staat de berekening in allebei, dan is de tweede die iemand later
   aanpast de plek waar ze uiteenlopen -- dezelfde reden waarom
   kern/spellen/grens.js een bestand van twee regels is.

   ----------------------------------------------------------------------------
   WAT HET LID ZELF MOET KUNNEN, VOORDAT HIJ HET KAN WEGGEVEN.

   Een machtiging is een stuk van het vermogen van het lid dat hij aan een app
   uitleent. Kan hij het zelf niet, dan kan hij het ook niet uitlenen. Dat is
   geen nieuwe regel maar een oude die hier niet werd toegepast.

   HET GAT DAT DIT DICHT, EN HET WAS ER EEN VAN EERLIJKHEID EN NIET VAN LEKKAGE.
   `arena.meedoen` werd aan iedereen verleend, ook aan een lid dat de 18+-poort
   niet haalt. Er lekte niets -- alle drie de arena-methodes toetsen
   `progressieMag` bij de UITVOERING en geven `ranglijst: false` terug -- maar
   het toestemmingsscherm vroeg zo'n lid wél om ja te zeggen tegen "andere
   spelers zien uw codenaam en uw score op het bord", en ./bereik.js rekende zijn
   app op de ZWAARSTE klasse (`op-een-bord`). Toestemming voor iets dat
   structureel niet kan gebeuren, en een risicolabel dat niet klopt.

   DE UITKOMST IS DUS NIET "MINDER MAG", MAAR "ER WORDT NIET MEER GEVRAAGD DAN
   ER KAN". Onder de grens speelt het spel door -- dat blijft grens 3 van
   ./arena.js -- alleen wordt de machtiging niet meer verleend, en zegt de brug
   voortaan de ECHTE reden in plaats van het lid naar een knop te sturen die
   niets voor hem oplost.

   FAIL-CLOSED OP EEN ONBEKENDE EIS, en dat is de enige keuze die hier veilig
   is. Zet iemand in ./machtigingen.js een `eistVanLid` neer waarvoor hier geen
   toets staat, dan valt die machtiging WEG in plaats van door te glippen. Een
   onbekende eis die als "geen eis" wordt gelezen, is precies het gat waar zo'n
   verklaring doorheen lekt -- dezelfde bodem als in ./bereik.js, waar een
   onbekende machtiging naar de ZWAARSTE klasse valt en niet naar de lichtste.
   ========================================================================== */
'use strict';

const { MACHTIGINGEN, isMachtiging, ALLE_IDS, GEEN_CONTEXTBEPERKING } = require('./machtigingen');
const { versmalNamens } = require('../namens/versmalling');

/* Wat een eissleutel BETEKENT, in de woorden van het lid. Hij staat hier en
   niet bij de machtiging, omdat hij op de EIS hangt en niet op de machtiging:
   twee machtigingen kunnen dezelfde eis dragen, en dan hoort de zin één keer te
   bestaan (LAT-regel 4). Het is dus geen tweede lijst van machtiging-id's. */
const LIDEISEN = Object.freeze({
  progressie: 'Scores en ranglijsten bewaart RTG alleen voor leden van wie het identiteitsbewijs is ' +
    'gezien en die 18 of ouder zijn. Het spel zelf speel je gewoon door; er wordt alleen niets bewaard.'
});

const lidEis = (sleutel) => (Object.prototype.hasOwnProperty.call(LIDEISEN, String(sleutel || ''))
  ? LIDEISEN[String(sleutel)] : null);

function maakGeverMacht({ progressieMag }) {
  /* De toetsen, op sleutel. Er is er vandaag één; de vorm is die van een map
     zodat een tweede eis erbij een regel is en geen if-ladder. */
  const TOETSEN = {
    progressie: (key) => !!(typeof progressieMag === 'function' && progressieMag(key))
  };

  /* Wat dit lid op DIT moment zelf kan, en wat niet -- met per weggevallen
     machtiging de SLEUTEL van de eis en niet de zin erbij. De zin hoort bij de
     eis; hem hier meegeven en straks opslaan zou dezelfde tekst op twee plekken
     zetten, en de opgeslagen kopie loopt achter zodra iemand de uitleg
     verbetert. */
  function geverEffectief(key) {
    const lijst = [], weg = [];
    for (const m of MACHTIGINGEN) {
      if (!m.eistVanLid) { lijst.push(m.id); continue; }
      const toets = Object.prototype.hasOwnProperty.call(TOETSEN, m.eistVanLid) ? TOETSEN[m.eistVanLid] : null;
      if (!toets) { weg.push({ id: m.id, eis: m.eistVanLid, onbekendeEis: true }); continue; }
      if (toets(key)) lijst.push(m.id);
      else weg.push({ id: m.id, eis: m.eistVanLid, onbekendeEis: false });
    }
    return { lijst, weg };
  }

  /* --------------------------------------------------------------------------
     DE SNEDE ZELF. De wet komt uit kern/namens/versmalling.js en wordt hier NIET
     nagebouwd; wat deze functie doet is de VIER BRONNEN vullen met wat de App
     Store erover weet.

     ALLE VIER WORDEN OPGEGEVEN, ook `context` die hier niets tegenhoudt. Een
     weggelaten bron telt in die laag als LEEG en niet als alles, en het verschil
     tussen "gemeten en er is niets" en "niemand heeft gekeken" is daar het hele
     punt. Weglaten zou hier dus alles dichtzetten; stilzwijgend als "alles"
     lezen zou de wet slopen. Dus staat hij er, uitgesproken.
     ------------------------------------------------------------------------ */
  function snijd(key, getikt, manifestVraagt) {
    const gm = geverEffectief(key);
    const uit = versmalNamens({
      gevraagd: getikt,
      geverEffectief: gm.lijst,
      beleid: (Array.isArray(manifestVraagt) ? manifestVraagt : []).filter(isMachtiging),
      context: ALLE_IDS
    });
    return { uit, gm, contextGrond: GEEN_CONTEXTBEPERKING };
  }

  /* Een onbepaalbare snede is een STORING en geen weigering: er is niets mis met
     dit lid of deze app -- er is een bron niet aangesloten. 503 met de reden, en
     met opzet geen 403, want dat zou de gebruiker laten denken dat hij iets fout
     doet (CONTROLPLANE.md: `ONBEKEND` is geen `WEIGEREN`). */
  const storing = (uit) => ({ status: 503, error: uit.weigering.reden,
    code: uit.weigering.code, onbekend: uit.weigering.onbekend, stuk: uit.weigering.stuk,
    hoe: 'Dit is een gebrek aan onze kant. Probeer het later opnieuw; er is niets verleend en niets ingetrokken.' });

  /* De opgeslagen vorm: machtiging -> eissleutel, en alleen voor wat het lid
     werkelijk PROBEERDE te geven. Wat hij niet aanvinkte is niet versmald maar
     gewoon niet gevraagd, en die twee door elkaar halen maakt van deze kaart
     een lijst van alles wat een lid niet mag. */
  function versmaldeVan(weg, getikt) {
    const uit = {};
    const g = new Set(Array.isArray(getikt) ? getikt : []);
    for (const w of weg) if (g.has(w.id)) uit[w.id] = w.eis;
    return uit;
  }

  /* Wat een scherm of de brug erover zegt. Geeft `null` bij een eis die deze
     laag niet kent -- liever geen zin dan een verzonnen zin. */
  const uitleg = (eis) => lidEis(eis);

  /* De opgeslagen kaart terug naar iets wat een mens leest. De zin komt hier
     pas bij en nooit uit de opslag -- dat is de andere helft van waarom er een
     sleutel wordt bewaard en geen tekst. */
  function toonVersmald(kaart) {
    const uit = [];
    for (const [id, eis] of Object.entries(kaart || {})) {
      const m = MACHTIGINGEN.find(x => x.id === id);
      uit.push({ id, label: m ? m.label : id, eis, waarom: uitleg(eis) });
    }
    return uit;
  }

  return { geverEffectief, snijd, storing, versmaldeVan, toonVersmald, uitleg,
    TOETSEN: Object.keys(TOETSEN) };
}

module.exports = { maakGeverMacht, LIDEISEN, lidEis };
