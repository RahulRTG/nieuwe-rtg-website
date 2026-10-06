/* DE VERTALING NAAR MENSGRONDEN -- van wat er al bestaat naar een woord uit de lijst.

   Vier bronnen, elk met een eigen eigenaar: de effecten (kern/isolatie/effecten.js),
   de bodem (kern/frictie/bodem.js), de deur uit de router en de paden waar geen
   mandaat ooit over gaat (kern/stuur/mandaat.js). Daarbij de vraag WIENS mens er
   staat. Deze module verzint geen tweede classificatie; hij vertaalt. */
'use strict';

/* VAN EFFECT NAAR GROND. Alleen effecten die over een MENS gaan staan hier. De rest is
   een veiligheidsvraag en geen mensvraag -- ze horen bij de isolatielaag, die er een
   eigen grens voor heeft -- en staat in GEEN_GROND met de reden, zodat een nieuw effect
   in effectwoorden.js hier zichtbaar onbeslist blijft in plaats van stil niets. */
const UIT_EFFECT = Object.freeze({
  GELD_BEWEGEN: 'geld',
  EXTERN_BEREIKEN: 'tweede-persoon',
  /* Een keuze met een prijs: andermans gegevens wijzigen BEREIKT die ander, ook als er
     geen bericht uitgaat. Dat maakt veel kantoorroutes tot mensenwerk; het is de
     strenge kant en daarmee de goede kant om te beginnen (AUTONOMIE.md par. 2.9). */
  SCHRIJVEN_ANDERMANS: 'tweede-persoon',
  VERTROUWENSRELATIE_AANGAAN: 'relatie',
  /* Een plafond verhogen doet zelf niets, maar bepaalt hoeveel risico er daarna mag
     lopen -- rood staan, een bestedingsgrens. Dat is een afweging en geen uitvoering. */
  PLAFOND_WIJZIGEN: 'oordeel',
  IDENTITEIT_WIJZIGEN: 'toestemming',
  RECHT_VERLENEN: 'oordeel',
  BEVEILIGING_VERZWAKKEN: 'oordeel'
});
const GEEN_GROND = Object.freeze({
  LEZEN_EIGEN: 'lezen verandert niets',
  SCHRIJVEN_EIGEN: 'de aanroeper wijzigt zijn eigen gegevens; hij IS de mens',
  LEZEN_ANDERMANS: 'een inzagevraag; die heeft een eigen poort met reden en journaal (kern/ledenbalie-inzage.js)',
  DERDENCODE_UITVOEREN: 'de cel isoleert derdencode (APPSTORE.md); dat is een veiligheidsgrens, geen mensmoment',
  ONVERTROUWDE_BYTES: 'een veiligheidsvraag, geen mensvraag',
  UITGAANDE_AANROEP: 'een veiligheidsvraag, geen mensvraag',
  CONFIGUREREN: 'een stand die zelf geen grens losser zet',
  VOORSTEL_MAKEN: 'klaarzetten IS wat de machine hoort te doen; de bevestiging erna draagt de grond',
  /* OPEN. Gegevens die het huis verlaten lijken op geld dat het huis verlaat, en de
     gesloten lijst kent die grond niet. Dat is een besluit van de eigenaar en geen
     afleiding -- tot dan staat hij hier, zichtbaar. */
  BULK_UITVOER: 'OPEN: is "gegevens verlaten het huis" een eigen mensgrond? Besluit van de eigenaar.'
});

/* VAN BODEM NAAR GROND. De bodem draagt al de reden in woorden; hier staat alleen welk
   woord uit de lijst daarbij hoort. */
const UIT_BODEM = Object.freeze({
  pasbesluit: 'oordeel',
  'kyc-besluit': 'oordeel',
  vakbewijs: 'oordeel',
  'geld-het-huis-uit': 'geld',
  'geld-in-bulk': 'geld',
  sleutelbos: 'toestemming',
  eigenaarskast: 'oordeel'
});

/* VAN DEUR NAAR GROND. Wat achter de deur van de eigenaar staat (de boardroom, het
   techniekbord) is per definitie een besluit over het platform: BESTUUR.md, en de bodem
   `eigenaarskast` zegt het al voor de paden onder /api/boardroom en /api/techniek. Maar
   die bodem leest het PAD, en de terugstortstand, de bankmodus en het intrekken van een
   streefbeeld wonen onder /api/office achter de boardroomdeur -- de eerste ronde van de
   meter noemde ze daarom "mens tot er bewijs is", alsof een bewezen terugweg van de
   juridische positie van RTG een machinehandeling maakt. De deur komt uit de ROUTER en
   is hard; de effecten van zo'n schakelaar heten vaak alleen CONFIGUREREN. */
const UIT_DEUR = Object.freeze({ boardroom: 'oordeel', techniek: 'oordeel' });

/* HET OORDEEL OP NAAM. Een besluit -- vrijgeven, tekenen, keuren, beslissen -- heeft
   vandaag zelden een effectverklaring, en dan valt de grond `oordeel` weg terwijl hij er
   aantoonbaar staat: KOSTEN.md zegt met zoveel woorden dat een mens in de boardroom een
   kostennota VRIJGEEFT. Een naam is zwak bewijs (HERSTEL.json: niets komt boven
   `vermoed` uit een naam), en daarom mag deze lijst alleen een grond TOEVOEGEN en
   nooit een weghalen. Dat is de veilige richting: een grond te veel maakt een mens
   zichtbaar die er misschien niet hoeft te staan; een grond te weinig laat de machine
   een besluit nemen. */
const OORDEEL_OP_NAAM = /\/(vrijgeven|teken|keur|goedkeur|afkeur|beslis|besluit|weiger|bevestig|accepteer|wijs-af|rechten)(\/|$)/;

/* DE PADEN WAAR GEEN MANDAAT OOIT OVER GAAT. De lijst zelf is van kern/stuur/mandaat.js
   en wordt hier GELEZEN, niet overgetypt: twee plekken die hetzelfde moeten beslissen,
   beslissen na een jaar iets anders (LAT.md regel 4). Hier staat alleen welke grond
   bij welk patroon hoort; een nieuw patroon in mandaat.js zonder grond hier laat
   test/mensgrond.test.js zakken in plaats van stil zonder grond te blijven. */
const { NOOIT_AUTONOOM } = require('../../server/kern/stuur/mandaat.js');
const GROND_PER_PATROON = Object.freeze({
  '^\\/api\\/(bank|pay)\\/': 'geld',
  '^\\/api\\/supplier\\/pay\\/': 'geld',
  '^\\/api\\/aanmelding\\/': 'oordeel',
  '^\\/api\\/auth\\/': 'toestemming',
  '^\\/api\\/account\\/': 'toestemming'
});
const UIT_NOOIT_AUTONOOM = Object.freeze(NOOIT_AUTONOOM.map(re =>
  Object.freeze({ patroon: re, grond: GROND_PER_PATROON[re.source] || null })));

/* WIENS MENS STAAT ER? Dat is de vraag vóór elke grond, en de eerste ronde van de meter
   stelde hem niet: hij noemde `/api/logout` en de instellingen van een zaak
   automatiseringsschuld. Maar daar staat geen medewerker van RTG -- daar beslist een
   lid of een zaak over zijn EIGEN zaken, en dat is geen werk dat RTG wegautomatiseert.
   Het is de grond toestemming in zijn zuiverste vorm: de betrokkene beslist zelf.

     `rtg`       de mens is een medewerker of de eigenaar van RTG; alleen hier bestaat
                 automatiseringsschuld, want alleen hier is het RTG's eigen handwerk
     `klant`     de mens is een lid, een zaak of een bezoeker die over zijn eigen zaken
                 beslist; zijn handeling draagt de grond `toestemming` van zichzelf
     `onbekend`  de rol van de route is niet vast te stellen; dan ook niet wiens mens er staat

   De lijst rollen komt uit scripts/lib/bewakers.js (via rolVan) en staat hier met opzet
   UITGESCHREVEN: een nieuwe rol valt in `onbekend` tot iemand hem indeelt, en wordt
   dus nooit stil RTG-werk of klantkeuze. */
const KANT = Object.freeze({
  office: 'rtg', 'kantoor-op-naam': 'rtg', boardroom: 'rtg', techniek: 'rtg',
  member: 'klant', supplier: 'klant', openbaar: 'klant', 'eigen-poort': 'klant',
  werkplekbaas: 'klant', scim: 'klant', omgeving: 'klant'
});
const kantVan = (rol) => KANT[rol] || 'onbekend';

module.exports = { UIT_EFFECT, GEEN_GROND, UIT_BODEM, UIT_DEUR, OORDEEL_OP_NAAM, UIT_NOOIT_AUTONOOM, KANT, kantVan };
