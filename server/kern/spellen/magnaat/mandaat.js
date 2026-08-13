/* Magnaat: MANDATEN -- wat iemand mag beslissen, en tot welk bedrag.

   Dit is de laag die van "de wereld gaat door zonder jou" een SPEL maakt in
   plaats van een straf (VERHAAL.md hoofdstuk 13). De vraag is daar niet meer
   *mag er iets gebeuren zonder de speler* maar:

     **Welke bevoegdheden had je gedelegeerd voordat je vertrok?**

   ================== WAT ER AL WAS, EN WAT ERBIJ KOMT ==================

   Bevoegdheid bestond al, twee keer, en allebei als JA of NEE:

     ./dienst-rollen.js   een rol draagt een lijst velden die hij mag zetten
                          (een bedrijfsleider mag `prijs`, een hulpkracht niets)
     ./beheer.js          de AI-manager draagt `mag: { prijs: false, lenen:
                          false, ... }`

   Wat ontbrak is de GRENS. "Mag onderhoud goedkeuren" is geen bevoegdheid maar
   een categorie; "mag onderhoud goedkeuren tot 7.500" is er een. Dat verschil is
   het hele onderscheid tussen een vinkje en governance -- en het is de reden dat
   een concern maanden zonder jou kan draaien terwijl een eenmanszaak dat niet
   kan.

   ER KOMT GEEN DERDE RECHTENMODEL BIJ, en dat is de belangrijkste regel van dit
   bestand. `magAan` in ./dienst.js blijft de enige plek waar "mag deze speler
   aan deze zaak zitten" wordt beantwoord; dit bestand beantwoordt de VOLGENDE
   vraag: *en tot hoe ver?* Wie ze door elkaar haalt, krijgt een gat -- zie
   CONCERN.md: toegang verlenen gebeurt waar de rol woont.

   ================== VIER NIVEAUS (hoofdstuk 13) ==================

     persoonlijk   niemand handelt hierin namens een mens. Nooit.
     lopend        gaat altijd door, mandaat of niet: huur, loon, rente,
                   polissen, lopende contracten. Dat is de wereld en geen besluit
     gedelegeerd   mag binnen een grens: onderhoud, personeel, prijs, spoedwerk
     strategisch   alleen met een expliciet mandaat: lenen, uitbreiden, openen,
                   sluiten, overnemen

   `LOPEND` STAAT HIER MET OPZET IN, ook al doet dit bestand er niets mee. Een
   lijst waarop staat wat GEEN besluit is, is precies zo belangrijk als de lijst
   met wat het wel is: zonder die eerste is "de huur is afgeschreven terwijl ik
   weg was" een bug die iemand komt melden.

   ================== EN DE HARDE KANT ==================

   EEN MANDAAT IS EEN PLAFOND EN NOOIT EEN OPDRACHT. Wie 7.500 mag uitgeven,
   hoeft niets uit te geven. Zou een mandaat ook een verplichting zijn, dan is
   het geen delegatie maar een automaat -- en dan bepaalt de speler niet meer wat
   voor bedrijf hij heeft.

   EN HIJ MAAKT GEEN GELD. Een mandaat staat iets TOE; het bedrag komt uit de
   kas zoals altijd, en scripts/magnaat-pomp.js hoort er niets van te merken. */
'use strict';

const rond = (n) => Math.round(n);

/* WAT ER TE DELEGEREN VALT, per niveau. De sleutels zijn dezelfde woorden die
   ./dienst-rollen.js en ./beheer.js al gebruiken -- een derde vocabulaire zou
   betekenen dat dezelfde bevoegdheid twee namen heeft. */
const LOPEND = ['huur', 'loon', 'rente', 'premie', 'contract', 'inkoop'];

const SOORTEN = {
  /* GEDELEGEERD: de huishouding van een zaak. Een grens in EURO'S waar er geld
     omgaat, en in niets waar dat niet zo is. */
  onderhoud: { niveau: 'gedelegeerd', eenheid: 'euro',
    uitleg: 'onderhoud en spoedwerk goedkeuren' },
  personeel: { niveau: 'gedelegeerd', eenheid: 'mensen',
    uitleg: 'mensen aannemen of laten gaan binnen de formatie' },
  prijs: { niveau: 'gedelegeerd', eenheid: 'geen',
    uitleg: 'de prijsstand van een zaak verzetten' },
  marketing: { niveau: 'gedelegeerd', eenheid: 'euro',
    uitleg: 'marketingbudget vaststellen' },
  /* STRATEGISCH: alles wat de OMVANG van het bedrijf verandert. Standaard uit,
     en dat is dezelfde voorzichtigheid als ./beheer.js `STANDAARD`. */
  lenen: { niveau: 'strategisch', eenheid: 'euro', uitleg: 'krediet opnemen' },
  /* DE NAMEN KOMEN UIT ./beheer.js EN NIET UIT DIT BESTAND. `uitbreiden`,
     `onderzoek` en `verzekeren` heetten daar al zo, en de eerste versie hiervan
     zette er `investeren` naast -- twee woorden voor dezelfde bevoegdheid, en
     precies het derde vocabulaire waar de kop hierboven voor waarschuwt. De
     bestaande naam wint, altijd. */
  uitbreiden: { niveau: 'strategisch', eenheid: 'euro', uitleg: 'uitbreiden of een zaak openen' },
  contracten: { niveau: 'strategisch', eenheid: 'euro', uitleg: 'leveringscontracten tekenen' },
  onderzoek: { niveau: 'strategisch', eenheid: 'euro', uitleg: 'onderzoek starten en uitrollen' },
  verzekeren: { niveau: 'strategisch', eenheid: 'euro', uitleg: 'polissen sluiten' },
  /* EN WAT NOOIT GEDELEGEERD WORDT. Ze staan in de tabel omdat de lijst dan
     compleet is en niemand hoeft te raden -- maar `magVoor` weigert ze altijd. */
  sluiten: { niveau: 'persoonlijk', eenheid: 'geen', uitleg: 'een zaak sluiten' },
  uitstappen: { niveau: 'persoonlijk', eenheid: 'geen', uitleg: 'met de partij stoppen' }
};
const SOORTLIJST = Object.keys(SOORTEN);
const GEDELEGEERD = SOORTLIJST.filter(k => SOORTEN[k].niveau === 'gedelegeerd');
const STRATEGISCH = SOORTLIJST.filter(k => SOORTEN[k].niveau === 'strategisch');
const PERSOONLIJK = SOORTLIJST.filter(k => SOORTEN[k].niveau === 'persoonlijk');

/* EEN LEEG MANDAAT: niemand mag iets. Dat is de goede stand om vanuit te
   beginnen -- delegeren is een handeling, geen beginwaarde. */
const LEEG = {};

/* WAT IEMAND MAG, EN TOT HOEVER. Het enige antwoord in dit bestand, en met
   opzet een REDEN erbij in plaats van alleen `false`: een manager die iets niet
   doet zonder te zeggen waarom, is een manager die je niet kunt bijsturen. */
function magVoor(mandaat, wat, bedrag) {
  const soort = SOORTEN[wat];
  if (!soort) return { mag: false, reden: 'onbekende bevoegdheid: ' + wat };
  if (soort.niveau === 'persoonlijk')
    return { mag: false, reden: 'dat beslist de eigenaar zelf' };
  const grens = (mandaat || LEEG)[wat];
  if (grens === undefined || grens === null || grens === false)
    return { mag: false, reden: 'geen mandaat voor ' + wat };
  /* EEN BEVOEGDHEID ZONDER BEDRAG is `true`: hij mag het, en er valt geen grens
     te stellen (een prijsstand verzetten kost niets). */
  if (soort.eenheid === 'geen' || grens === true) return { mag: true, grens: null };
  const n = Number(bedrag) || 0;
  if (n > grens)
    return { mag: false, grens,
      reden: 'boven zijn mandaat van ' + rond(grens) + ' (' + rond(n) + ' gevraagd)' };
  return { mag: true, grens };
}

/* Een mandaat schoonmaken: alleen bekende bevoegdheden, en geen negatieve
   grenzen. Wie -1 invult bedoelt niet "min een euro" maar "niet". */
function schoon(wens) {
  const uit = {};
  for (const [wat, waarde] of Object.entries(wens || {})) {
    const soort = SOORTEN[wat];
    if (!soort || soort.niveau === 'persoonlijk') continue;
    if (waarde === false || waarde === null) continue;
    /* `true` BLIJFT ONBEGRENSD, ook bij een bevoegdheid die in euro's telt. Dat
       is niet alleen achterwaartse compatibiliteit maar de goede lezing: wie
       "mag lenen" zegt zonder bedrag, heeft geen plafond gesteld. Zonder deze
       regel maakte `Number(true)` er een grens van EEN EURO van, en dan viel een
       manager stil die van zijn eigenaar juist alles mocht. */
    if (waarde === true) { uit[wat] = true; continue; }
    if (soort.eenheid === 'geen') { if (waarde) uit[wat] = true; continue; }
    const n = Math.max(0, Math.round(Number(waarde) || 0));
    if (n > 0) uit[wat] = n;
  }
  return uit;
}

/* HOE VER EEN ORGANISATIE ZONDER JOU KOMT. Geen score en geen niveau: een
   opsomming van wat er gedelegeerd IS, zodat een scherm kan zeggen "je zaak in
   Rotterdam kan onderhoud tot 7.500 zelf afhandelen en verder niets".

   HIJ TELT NIET OP TOT EEN CIJFER, en dat is met opzet. Een getal dat "hoe goed
   is mijn governance" heet, wordt een ding om te maximaliseren -- en dan is de
   progressiemaat uit hoofdstuk 13 (kan het bedrijf zonder mij?) een balk
   geworden in plaats van een vraag. */
function beeld(mandaat) {
  const m = mandaat || LEEG;
  return SOORTLIJST
    .filter(wat => SOORTEN[wat].niveau !== 'persoonlijk')
    .map(wat => ({ wat, niveau: SOORTEN[wat].niveau, uitleg: SOORTEN[wat].uitleg,
      eenheid: SOORTEN[wat].eenheid,
      grens: m[wat] === undefined ? null : m[wat] }));
}

module.exports = { SOORTEN, SOORTLIJST, LOPEND, GEDELEGEERD, STRATEGISCH, PERSOONLIJK,
  LEEG, magVoor, schoon, beeld };
