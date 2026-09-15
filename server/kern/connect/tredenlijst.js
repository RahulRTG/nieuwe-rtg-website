/* ============================================================================
   DE TIEN TREDEN -- de tabel, apart van de motor die hem afdwingt.

   Uit ./leerdossier.js geknipt op de 10 kB-grens (keuringsregel 13), op dezelfde
   naad als ./werkwoordlijst.js tegenover ./lus.js: hier staat WAT een trede is,
   daar wat ermee gebeurt. Wie iets aan dit dossier verandert, verandert bijna
   altijd deze tabel.

   ============================ DE TWEE HELFTEN VAN DE LADDER =================

   De eerste vijf gaan over wat een mens met iets van een ANDER doet: gezien,
   uitgelezen, begrepen, geoefend, toegepast. De laatste vijf gaan over wat er
   gebeurt met iets dat hij ZELF maakte, en die vijf zijn op 15 september 2026
   uit elkaar getrokken op besluit van de eigenaar:

     gemaakt      er bestaat iets van jou
     aangeboden   jij hebt toegestaan dat een ander het kan ontvangen
     bereikt      het kwam daadwerkelijk bij iemand anders
     gebruikt     die ander deed er aantoonbaar iets mee
     doorgegeven  het leidde aantoonbaar tot iets verderop

   Hier stond eerst EEN trede (`onderwezen`) voor dat hele traject, en dat maakte
   publiceren en betekenen hetzelfde ding.

   ================== DE REGEL DIE DEZE TABEL DRAAGT ==========================

   WIJ TELLEN GEEN AANDACHT ALS ONTWIKKELING. Dat is de klassieke
   social-mediafout in een zin -- publiceren = impact -- en hij wordt hier
   tegengehouden door een veld en niet door een voornemen:

     aanspraak: 'geen'        dit zegt niets over ontwikkeling. gezien, gelezen
                              en BEREIKT. Die laatste is de scherpe: dat je werk
                              bij iemand aankwam is bereik, en bereik is
                              aandacht. Het staat er wel -- het is het eerlijke
                              verschil tussen "aangeboden" en "er is echt iemand
                              geweest" -- maar het telt nergens mee.
     aanspraak: 'eigenDoen'   dit gaat over wat deze mens zelf deed.
     aanspraak: 'overdracht'  het stak de grens naar een ander mens over. Alleen
                              deze twee treden dragen een sterkere aanspraak.

   `leerdossier.js` bouwt zijn portfolio uitsluitend uit de laatste twee
   soorten; een regel met `aanspraak: 'geen'` komt er niet in en verlaat dit
   huis nooit.

   ALLE VIJF DE OVERDRACHTSTREDEN ZIJN `eenmalig`, en dat is geen zuinigheid.
   Een trede die per gebeurtenis een regel bijschrijft, wordt een TELLER: dan
   staat er in het dossier van de maker hoe vaak zijn werk is geopend, en dat is
   een populariteitscijfer met een ander etiket. Deze ladder legt OVERGANGEN
   vast en nooit volumes -- "dit werk is door iemand gebruikt" is een feit, "door
   veertien mensen" is een score. Het heeft een tweede gevolg dat er hard bij
   hoort: niemand kan andermans dossier laten groeien door te blijven drukken.

   ============================== DRIE VELDEN DIE CODE ZIJN ===================

     doorWie    `zelf`, `hetSysteem` of `eenAnder`. `noteer()` WEIGERT een regel
                die door de verkeerde partij wordt aangeboden. Zonder die
                grendel vult iedereen zijn eigen dossier met de treden die
                bewijskracht hebben.
     graad      volgt uit `doorWie` en is niet te kiezen: wat de mens over
                zichzelf zegt is `vermoed`, wat het systeem zag `gemeten`, wat
                een ander bevestigde `bewezen`. De huisgraden van BESTUUR.md,
                geen eigen schaal.
     bronNodig  deze trede bestaat niet zonder een verwijzing naar het ding
                waar hij over gaat. Een bewering zonder onderwerp is precies wat
                een portfolio waardeloos maakt.

   `stelt` en `nietZegt` komen uit kern/carriereledger/regels.js en zijn met
   opzet dezelfde woorden: dat ledger heeft deze vraag al beantwoord, en een
   tweede vocabulaire voor "wat zegt dit bewijs niet" is de botsing die
   SEMANTIEK.json meet. Het blok `nietZegt` is even groot als `stelt`, en dat is
   daar ook geen slag om de arm maar de helft van de betekenis.
   ========================================================================== */
'use strict';

const TREDEN = [
  { id: 'gezien', trap: 1, naam: 'Gezien', doorWie: 'hetSysteem', graad: 'gemeten',
    eenmalig: true, bronNodig: false, aanspraak: 'geen',
    stelt: 'dat deze mens dit heeft geopend, een keer',
    nietZegt: 'dat hij het heeft gelezen, begrepen of er iets mee heeft gedaan. Een kijkcijfer is geen leerbewijs, en daarom telt deze trede nergens mee.' },

  { id: 'gelezen', trap: 2, naam: 'Uitgelezen', doorWie: 'hetSysteem', graad: 'gemeten',
    eenmalig: true, bronNodig: false, aanspraak: 'geen',
    stelt: 'dat deze mens tot het einde is gekomen',
    nietZegt: 'dat hij het snapte. Aandacht is geen begrip.' },

  { id: 'begrepen', trap: 3, naam: 'Begrepen', doorWie: 'zelf', graad: 'vermoed',
    eenmalig: true, bronNodig: false, aanspraak: 'eigenDoen',
    stelt: 'dat deze mens ZEGT dat hij het snapt',
    nietZegt: 'dat het zo is. Niemand anders heeft hier iets van gezien; met een teruguitleg erbij wordt de regel sterker, maar hij blijft van hemzelf.' },

  { id: 'geoefend', trap: 4, naam: 'Geoefend', doorWie: 'hetSysteem', graad: 'gemeten',
    eenmalig: false, bronNodig: false, aanspraak: 'eigenDoen',
    stelt: 'dat er een oefening is gedaan',
    nietZegt: 'hoe die ging. Er staat geen uitslag bij, want dat zou een cijfer op een mens zijn.' },

  { id: 'toegepast', trap: 5, naam: 'Toegepast', doorWie: 'zelf', graad: 'vermoed',
    eenmalig: false, bronNodig: false, aanspraak: 'eigenDoen',
    stelt: 'dat deze mens zegt het buiten de app te hebben gebruikt',
    nietZegt: 'dat het gebeurd is. Dit is niet na te gaan, en dat hoort het antwoord ook te zeggen.' },

  /* ---- vanaf hier gaat het over iets dat deze mens ZELF maakte ---- */

  { id: 'gemaakt', trap: 6, naam: 'Gemaakt', doorWie: 'hetSysteem', graad: 'gemeten',
    eenmalig: true, bronNodig: true, aanspraak: 'eigenDoen',
    stelt: 'dat er iets is ontstaan dat er nog is, en waar deze regel naar verwijst',
    nietZegt: 'dat het goed is, af is of iemand heeft bereikt. Alleen dat het bestaat.' },

  { id: 'aangeboden', trap: 7, naam: 'Aangeboden', doorWie: 'hetSysteem', graad: 'gemeten',
    eenmalig: true, bronNodig: true, aanspraak: 'eigenDoen',
    stelt: 'dat deze mens heeft toegestaan dat een ander dit kan ontvangen -- hij heeft de kring verruimd',
    nietZegt: 'dat iemand het heeft gezien. Dit is een besluit van de maker en geen gebeurtenis in de wereld; wie dit voor impact aanziet, telt zijn eigen knop.' },

  { id: 'bereikt', trap: 8, naam: 'Bereikt', doorWie: 'hetSysteem', graad: 'gemeten',
    eenmalig: true, bronNodig: true, aanspraak: 'geen',
    stelt: 'dat dit werk daadwerkelijk bij ten minste een ander mens is aangekomen',
    nietZegt: 'bij hoeveel mensen, wie dat waren, of dat zij er iets mee deden. Dit IS bereik, en bereik is aandacht -- het staat hier als het eerlijke verschil met "aangeboden" en het telt nergens mee.' },

  { id: 'gebruikt', trap: 9, naam: 'Gebruikt', doorWie: 'eenAnder', graad: 'bewezen',
    eenmalig: true, bronNodig: true, aanspraak: 'overdracht',
    stelt: 'dat een ANDER mens aantoonbaar iets met dit werk heeft gedaan -- geprobeerd, afgemaakt, ervan geleerd of erdoor geholpen',
    nietZegt: 'wie dat was of hoe vaak. Een naam zou twee mensen aan elkaar knopen in het dossier van de een, en een aantal zou hier een populariteitscijfer maken.' },

  { id: 'doorgegeven', trap: 10, naam: 'Doorgegeven', doorWie: 'eenAnder', graad: 'bewezen',
    eenmalig: true, bronNodig: true, aanspraak: 'overdracht',
    stelt: 'dat dit werk aantoonbaar tot iets verderop heeft geleid: een ander heeft het aan weer iemand anders laten zien',
    nietZegt: 'hoe ver het is gekomen. De keten wordt niet gevolgd -- dit legt een overgang vast en geen bereik.' }
];

/* De drie aanspraken, met per stuk wat een LEZER ermee mag. Ze staan hier en
   niet in leerdossier.js, zodat wie een trede toevoegt de gevolgen ziet. */
const AANSPRAKEN = {
  geen: { portfolio: false, buitenFoundation: false,
    wat: 'Aandacht. Telt niet als ontwikkeling en verlaat dit huis nooit.' },
  eigenDoen: { portfolio: true, buitenFoundation: true,
    wat: 'Wat deze mens zelf deed. Mag hij tonen; niemand anders heeft het bevestigd.' },
  overdracht: { portfolio: true, buitenFoundation: true,
    wat: 'Het stak de grens naar een ander mens over. De enige soort die buiten Foundation werkelijk iets betekent.' }
};

module.exports = { TREDEN, AANSPRAKEN };
