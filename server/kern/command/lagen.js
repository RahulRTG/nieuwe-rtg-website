/* RTG COMMAND, de lagen op de ruggengraat.

   ./index.js bouwt de ruggengraat: het register, het journaal, het beleid, de
   risicomotor, de recepten, de operator en de puls. Dit bestand bouwt wat
   daarop staat -- master data, landpakketten, de API-poort, de overname, de
   zandbak en de canary. Ze zijn hierheen gehaald toen index.js over de
   10 kB-grens ging, maar de naad lag er al: dit zijn allemaal lagen die de
   ruggengraat GEBRUIKEN en die de ruggengraat zelf niet nodig heeft.

   WAT HIER STAAT EN NIET IN DE MODULES ZELF: de aangegeven tabellen. Welke
   collecties een partij dragen, welk veld de naam is, welke zaaiset de zandbak
   krijgt. Dat is configuratie en geen meting, en configuratie hoort op één
   plek te staan waar je hem kunt zien -- niet verstopt in de module die hem
   gebruikt. */
'use strict';

function maakLagen({ db, save, crypto, journaal, register, kern }) {
  /* Master data voor bedrijven en locaties. Welke collecties een partij dragen
     en welk veld de naam en de plaats is, staat HIER en niet in de module: dat
     is aangegeven en geen meting, en het hoort op één plek te staan. De
     plaatsnormalisatie komt uit de schakelkast, want die bepaalt al of een
     functie in jouw woonplaats openstaat -- twee normalisaties zouden betekenen
     dat die twee schermen het over een andere stad hebben. */
  const mdm = require('./mdm').maakMdm({ db, save, journaal,
    plaatsNorm: require('../../functies/toegang').plaatsNorm,
    partijen: [
      { type: 'zaak', collectie: 'suppliers', sleutel: 'code', naam: 'name', plaats: 'city', loc: 'loc' },
      { type: 'partner', collectie: 'partners', sleutel: 'code', naam: 'name', plaats: 'city' }
    ] });
  /* Landpakketten: een land aanzetten als configuratiebundel. LANDEN.json draagt
     ALLEEN wat nergens anders staat (munt, voertaal, schakelkaststand,
     mensenwerk); de fiscale kennis, de muntschaal en de talen komen uit wat het
     huis al heeft. Een tweede kopie zou binnen een jaar iets anders beweren. */
  const landpakket = require('./landpakket').maakLandpakket({ db, save, journaal,
    fiscaal: require('../fiscaal/landen'), valuta: require('../payroll/valuta'),
    talen: () => db.data.talen || { actief: [] }, functies: require('../../functies/register') });
  /* De API-poort: sleutels, scopes, quota en contractregels voor koppelingen.
     De toelating begint LEEG, dus er staat niets achter deze poort tot iemand
     er een pad in zet. Dat is een besluit; zie de kop van ./apipoort.js. */
  const apipoort = require('./apipoort').maakApiPoort({ db, save, crypto, journaal });
  /* Overnamemodus: de administratie van een overgenomen bedrijf inlezen, in
     vier stappen waarvan de volgorde de veiligheid is. Uitvoeren kan alleen met
     het zegel van precies de droogloop die is bekeken. */
  const overname = require('./overname').maakOvername({ db, save, crypto, journaal, register });
  /* De zandbak: dezelfde motoren op een DB-VENSTER met zaaigegevens. Er is geen
     aanroep waarlangs een handeling daarbinnen bij een productiecollectie komt,
     want het object dat die motoren zien heeft die collecties niet. */
  const zandbak = require('./zandbak').maakZandbak({ db, save, crypto, register,
    zaai: require('../../seed') });
  /* De canary: een functie uit de schakelkast stap voor stap openzetten, met
     een terugroldrempel die op DEZELFDE tellers rekent als de servicedoelen.
     De verdeling zelf woont niet hier maar in server/functies/toegang.js, bij
     de code die al beslist of een pad open is -- één beslisser, geen tweede. */
  const canary = require('./canary').maakCanary({ db, save, journaal,
    meting: require('../../meting'), functies: require('../../functies/register') });
  canary.tikker();

  /* Stadsstart: een stad inrichten. Hij krijgt het landpakket mee omdat een
     stad zonder ingericht land een stad zonder munt en zonder tarieven is, en
     het weefsel omdat hij eerlijk moet kunnen melden dat die laag vandaag EEN
     geografie draagt. */
  const stadstart = require('./stadstart').maakStadstart({ db, save, journaal, landpakket,
    functies: require('../../functies/register'),
    plaatsNorm: require('../../functies/toegang').plaatsNorm,
    /* Het weefsel gaat er nu ECHT in: sinds kern/stadsweefsel/steden.js draagt
       de boom meerdere steden, dus kan deze laag er een bouwen in plaats van
       hem als openstaande stap te melden. Late binding, want kern.weefsel hangt
       er pas na de aanbouw. */
    weefsel: () => (kern && kern.weefsel) || null });

  return { mdm, landpakket, apipoort, overname, zandbak, canary, stadstart };
}

module.exports = { maakLagen };
