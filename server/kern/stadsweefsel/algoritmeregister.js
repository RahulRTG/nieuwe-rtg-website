/* RTG Stadsweefsel, deel "algoritmeregister": wat rekent er mee over mij?

   Een stad die met algoritmes werkt, hoort te kunnen uitleggen welke dat zijn.
   Niet in een jaarverslag maar op een plek die meebeweegt met de code, want een
   register dat met de hand wordt bijgehouden, loopt binnen een half jaar achter
   op wat er draait -- en dan is het misleidender dan geen register.

   Vandaar: dit register beschrijft de rekenregels van het weefsel, en het is
   OPENBAAR (geen kantoorinlog). Per regel staat wat hij doet, welke gegevens
   hij gebruikt, hoeveel beslisruimte hij heeft (de vijf niveaus uit
   ./ainiveau.js), wat de bekende beperkingen zijn, en waar een inwoner terecht
   kan als hij het er niet mee eens is.

   TWEE DINGEN DIE DIT REGISTER EERLIJK HOUDEN.

   1. HET NIVEAU KOMT UIT DE CODE, NIET UIT DE TEKST. Elke regel hieronder
      verwijst naar een handeling uit ainiveau.js, en het niveau wordt daar
      opgehaald. Wie in de code een handeling zwaarder of lichter maakt, ziet
      dat hier meteen terug in plaats van dat de twee uit elkaar lopen.
   2. DE BEPERKING STAAT ERBIJ. Elke regel noemt wat hij NIET kan. Een register
      dat alleen opsomt wat een systeem goed doet, is reclame.

   Wat hier met opzet NIET in staat: profilering van personen. Dat is geen
   nederigheid maar een feit -- het weefsel kent objecten, plaatsen en
   codenamen, en er is geen regel die een oordeel over een persoon vormt. Zou
   die er ooit komen, dan hoort hij hier als eerste te staan, met een
   grondslag. */
const { HANDELINGEN, NIVEAUS } = require('./ainiveau');

const REGELS = [
  {
    id: 'duplicaat', naam: 'Meldingen samenvoegen tot een zaak',
    doel: 'Voorkomen dat tien meldingen over dezelfde kapotte lantaarn tien losse klussen worden.',
    handeling: 'melding-samenvoegen',
    gegevens: ['categorie van de melding', 'positie of gebied', 'het geregistreerde object', 'tijdstip'],
    persoonsgegevens: 'de codenaam van de melder; nooit een naam, adres of profiel',
    werking: 'Zelfde categorie, zelfde object of binnen 75 meter, binnen 72 uur, en de zaak nog open: dan is het dezelfde zaak.',
    beperking: 'Twee echte problemen vlak bij elkaar op hetzelfde soort object worden als een zaak gezien. De veldploeg ziet dat ter plaatse en kan de zaak splitsen door een tweede zaak te openen; automatisch splitsen kan het systeem niet.',
    bezwaar: 'Een melder ziet zijn eigen melding en de stand ervan in Mijn Stad, en kan altijd opnieuw melden als hij vindt dat het niet is opgelost.'
  },
  {
    id: 'oorzaak', naam: 'Gedeelde oorzaak aanwijzen',
    doel: 'Drie donkere lantaarns op dezelfde voedingsgroep als een storing zien in plaats van als drie klussen.',
    handeling: 'oorzaak-aanwijzen',
    gegevens: ['open zaken per categorie', 'de relaties tussen objecten (voedt, voert af naar)'],
    persoonsgegevens: 'geen',
    werking: 'Zoekt de dichtstbijzijnde bovenstroomse bron die boven alle betrokken objecten hangt.',
    beperking: 'Rekent op het GEREGISTREERDE net. Klopt een relatie niet of ontbreekt hij, dan wijst de hint de verkeerde kant op. Het is een aanwijzing voor een monteur, geen diagnose.',
    bezwaar: 'De hint verandert niets; een mens beslist wat er wordt onderzocht.'
  },
  {
    id: 'prioriteit', naam: 'Prioriteit van een zaak bepalen',
    doel: 'Urgent werk eerst, en niet wie het hardst roept.',
    handeling: 'werkorder-uit-zaak',
    gegevens: ['categorie', 'risicoklasse van het object', 'aantal waarnemingen op de zaak'],
    persoonsgegevens: 'het AANTAL melders telt mee, hun identiteit niet',
    werking: 'De categorie zet de bodem; een kritiek object en meerdere melders trekken hem op. Nooit omlaag.',
    beperking: 'Meer melders betekent niet altijd urgenter: een drukke straat meldt sneller dan een stille. Een behandelaar kan de prioriteit met de hand verzetten, en dat staat in het journaal.',
    bezwaar: 'De prioriteit is zichtbaar op de zaak en met een reden te wijzigen door de behandelende ploeg.'
  },
  {
    id: 'onderhoudssignaal', naam: 'Onderhoudssignaal per object',
    doel: 'Zien waar je als eerste zou gaan kijken, voordat iets stukgaat.',
    handeling: 'onderhoud-plannen',
    gegevens: ['conditie', 'bouwjaar en technische levensduur', 'werk in het afgelopen jaar', 'inspectie-interval', 'huidige status'],
    persoonsgegevens: 'geen',
    werking: 'Een score van 0 tot 100 als optelsom van vijf zichtbare factoren; de redenen staan altijd bij het getal.',
    beperking: 'Dit is een rangschikking, geen voorspelling van uitval. Er zit geen model onder en het weet niets van weer, gebruik of fabrikant.',
    bezwaar: 'Er ontstaat geen werk uit; een mens gunt de ronde, en bij veiligheidskritieke objecten twee mensen.'
  },
  {
    id: 'energieadvies', naam: 'Energiemaatregel voorstellen',
    doel: 'Netdrukte opvangen door verbruik te verschuiven in plaats van uit te breiden.',
    handeling: 'energie-advies',
    gegevens: ['gemeten en geschat verbruik per voedingsgebied', 'wat er aan een transformator hangt'],
    persoonsgegevens: 'geen; er wordt niet naar individuele aansluitingen of huishoudens gekeken',
    werking: 'Boven 70% bezetting komen maatregelen in beeld, met hun verwachte winst en hun terugvalstand.',
    beperking: 'De capaciteit is een modelwaarde en geen meting van de netbeheerder. Het systeem schakelt niets: een opdracht is een vastgelegd voornemen dat vanzelf vervalt.',
    bezwaar: 'Elke opdracht draagt een naam, een reden en een vervaltijd, en is in te trekken.'
  },
  {
    id: 'klimaatscenario', naam: 'Klimaatscenario doorrekenen',
    doel: 'Vooraf weten welke objecten bij extreme regen, hitte, droogte of hoogwater als eerste onder druk staan.',
    handeling: 'scenario-voorstellen',
    gegevens: ['vastgelegde risicokenmerken per zone', 'objecten en hun conditie', 'de afhankelijkheidsgraaf'],
    persoonsgegevens: 'geen',
    werking: 'Combineert risicozone, objectsoort en conditie tot een lijst waar je als eerste zou kijken.',
    beperking: 'Geen hydrologisch of meteorologisch model en geen weersverwachting. De risicokenmerken zijn met de hand vastgelegd; ontbreken ze, dan rekent het scenario over een lege stad -- dat staat dan ook in het antwoord.',
    bezwaar: 'Verandert niets aan de stad; het is invoer voor een mens en voor het rampbeeld.'
  }
];

module.exports = () => {
  function register() {
    return {
      status: 200,
      wat: 'De rekenregels die in RTG Stad meedraaien, met hun beslisruimte, hun gegevens en hun bekende beperkingen.',
      niveaus: NIVEAUS,
      regels: REGELS.map(r => {
        const h = HANDELINGEN[r.handeling] || {};
        return { ...r, niveau: h.niveau, niveauNaam: (NIVEAUS.find(n => n.n === h.niveau) || {}).naam,
          beslisruimte: (NIVEAUS.find(n => n.n === h.niveau) || {}).uitleg, omkeerbaar: !!h.omkeerbaar };
      }),
      geenProfilering: 'Geen enkele regel in dit register vormt een oordeel over een persoon. Het weefsel kent objecten, plaatsen en codenamen.',
      menselijkToezicht: 'Alles op niveau 2 of hoger vraagt een mens; op niveau 4 kan geen enkele automatische route iets in gang zetten.',
      bijwerken: 'Het niveau van elke regel komt rechtstreeks uit de code (kern/stadsweefsel/ainiveau.js), zodat register en werkelijkheid niet uit elkaar kunnen lopen.'
    };
  }
  return { REGELS, api: { weefselAlgoritmes: register } };
};
