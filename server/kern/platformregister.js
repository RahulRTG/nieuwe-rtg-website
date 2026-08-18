/* ============================================================================
   HET PLATFORMREGISTER -- VAN ELK DING: WAT HET IS, WAT HET DOET, AAN OF UIT,
   EN WAT WE ERVAN WETEN.

   WAAROM DIT ER IS. Die vier vragen waren alle vier al beantwoord, en geen
   enkele op dezelfde plek:

     wat het is / wat het doet   server/functies/register (189 functies) en
                                 kern/appgids.js (262 schermen)
     aan of uit                  de schakelkast (functies/toegang.js)
     status                      BEWIJSMATRIX.json, per ROUTE

   Die laatste is het probleem. Het bewijs staat op routeniveau en niemand denkt
   in routes. Niemand vraagt zich af hoe het met POST /api/bank/spaardoel staat;
   men vraagt zich af hoe het met SPAARDOELEN staat. Zolang die vertaling
   ontbreekt, is een matrix van 46.024 cellen wel navraagbaar en niet leesbaar.

   DIT IS GEEN NIEUWE BRON. Het is een SAMENVOEGING, en dat verschil is het hele
   ontwerp. Elk veld hieronder komt ergens vandaan waar het al stond:

     functies    server/functies/register  -> naam, uitleg, paden
     schakelaar  server/functies/toegang   -> functieStatus(): aan/uit/storing
     bewijs      scripts/bewijsmatrix      -> dezelfde bouw() als de ratel
     schermen    scripts/schermen          -> alleSchermen/geopendeSchermen
     controls    de CONTROL-objecten van de bewijsinstrumenten zelf

   Er komt hier geen tweede lijst bij (LAT.md regel 4, en keuringsregel 49 voor
   routes). Wie een functie toevoegt, doet dat in de catalogus; hier verschijnt
   hij vanzelf.

   DE ENE ONTWERPREGEL: ELK DING DRAAGT EEN STATUS.

   Zonder die regel wordt dit een catalogus -- een lijst van 477 dingen die je
   kunt doorbladeren en waar je niets aan hebt. Een ding zonder status hoort er
   dus niet in, en waar de status "ongemeten" is, staat dat er met zoveel
   woorden. Dat is een uitspraak over ONS en niet over het ding.

   EN WAT HET NIET ZEGT: "in orde". Geen enkele functie staat op alle elf
   schakels bewezen; de bewijsdekking van dit huis is 36%. Een register dat
   daarvan "in orde" maakt, stelt gerust in plaats van te meten. De staat draagt
   daarom het percentage en het woord "deels bewezen", en dat blijft ongemakkelijk
   tot het klopt.
   ========================================================================== */
'use strict';

/* De vier soorten, met wat ze zijn en of ze te schakelen vallen. Bewust een
   tabel en geen if-keten: wie een vijfde soort toevoegt, moet hier antwoord
   geven op dezelfde vragen. */
const SOORTEN = [
  { id: 'functie', naam: 'Functie',
    wat: 'een capability van het platform zoals een mens hem noemt, met een schakelaar' },
  { id: 'bediening', naam: 'Bediening',
    wat: 'de besturing van het platform zelf (boardroom, techniek, koppelingen, gezondheid)' },
  { id: 'scherm', naam: 'Scherm',
    wat: 'een pagina die een lid, medewerker of partner opent' },
  { id: 'control', naam: 'Control',
    wat: 'een beheersmaatregel met een eigen instrument en een eigen register' }
];

/* De bedieningstabel woont in ./platformregister/bediening.js -- een tabel, en
   dit bestand ging er met die tabel erin over de 10 KB heen. */
const BEDIENING = require('./platformregister/bediening');

/* ---- DE STATUS VAN EEN VERZAMELING ROUTES ----

   Telt de cellen van de bewijsmatrix op over de routes van een ding. Geeft
   ALTIJD alle vier de getallen terug, ook als ze nul zijn: een status die alleen
   het goede nieuws draagt, is geen status.

   De volgorde van de oordelen is niet willekeurig. GEZAKT wint van alles -- een
   ding waarvan een schakel is gezakt, is geen "deels bewezen ding met een
   detail". Daarna komt ZONDER ROUTES: een schakelaar die niets schakelt is een
   knop die niets doet, en dat is een bevinding en geen leegte. */
function statusUitCellen(rijen) {
  let bewezen = 0, ongemeten = 0, gezakt = 0, nvt = 0, verklaard = 0, cellen = 0;
  for (const r of rijen) {
    for (const c of Object.values(r.cellen || {})) {
      cellen++;
      if (c.staat === 'bewezen') bewezen++;
      else if (c.staat === 'gezakt') gezakt++;
      else if (c.staat === 'nvt') nvt++;
      else if (c.staat === 'verklaard') verklaard++;
      else ongemeten++;
    }
  }
  const meetbaar = cellen - nvt;
  const pct = meetbaar ? Math.floor(bewezen / meetbaar * 100) : 0;
  const staat = gezakt ? 'gezakt'
    : !rijen.length ? 'zonder routes'
      : bewezen === 0 ? 'ongemeten'
        : 'deels bewezen';
  return { staat, pct, routes: rijen.length, cellen, bewezen, ongemeten, gezakt, nvt, verklaard };
}

/* De uitleg bij een staat, in woorden en niet in een kleur. Hij zegt er ook bij
   wat het NIET betekent, want dat is precies waar een statuslampje mensen
   misleidt. */
const UITLEG = {
  'gezakt': 'een schakel is GEZAKT: er is iets gemeten dat niet in orde was.',
  'zonder routes': 'dit ding heeft geen enkele route. Een schakelaar die niets schakelt is een knop die niets doet.',
  'ongemeten': 'geen enkele schakel is bewezen. Dat is een uitspraak over ons meetwerk, niet over dit ding.',
  'deels bewezen': 'een deel van de schakels is bewezen; de rest is niet nagevraagd.',
  'beproefd': 'een toets heeft dit scherm echt afgelegd, en niet alleen in het voorbijgaan.',
  'alleen geveegd': 'alleen een veegtoets kwam langs. Die bewijst dat de pagina laadt, niet dat hij werkt.',
  'alleen opgehaald': 'de pagina is wel opgehaald maar nergens naartoe genavigeerd; een cache die hem ophaalt is geen toets die hem aflegt.',
  'nooit geopend': 'geen enkele toets heeft dit scherm geopend.',
  'levert bewijs': 'het instrument draait en zijn register hoort bij deze commit.',
  'verouderd bewijs': 'het register ligt er, maar is gemeten op andere code. Getallen uit een ander tijdperk lezen als getallen van nu.',
  'register ontbreekt': 'het instrument bestaat, maar zijn register is er niet; er is dus niets gemeten.',
  'geen register': 'deze control houdt geen eigen register bij en leunt op een ander instrument.'
};

module.exports = { SOORTEN, BEDIENING, statusUitCellen, UITLEG };
