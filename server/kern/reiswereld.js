/* RTG Reizen: de samenhanglaag over de reiswereld (laag 2 uit PLATFORM.md).

   Wat dit WEL is: één plek waar uw komende reis bij elkaar staat -- de vlucht,
   het verblijf, de aangevraagde reis, de charter -- ongeacht in welke app u hem
   geboekt heeft.

   Wat dit NIET is, en niet mag worden: een eigen reisadministratie. Deze module
   heeft geen eigen collectie, schrijft nooit, en bewaart niets. Elke regel wordt
   bij het opvragen uit het domein zelf gehaald, via de functie die dat domein
   al had (LAT.md regel 4, en de super-app-regel in PLATFORM.md: een super app
   orkestreert domeinsoftware, hij vervangt haar niet). Boeken, wijzigen en
   annuleren blijft daarom in de gespecialiseerde app; hier staat een link
   erheen en verder niets.

   De kern wordt LAAT gelezen (kern.reisbureau, kern.lucht, ...) en niet bij het
   opzetten uitgepakt: deze module wordt samengesteld in dezelfde ronde als de
   domeinen die hij leest, en welke laag als eerste klaar is, is geen eigenschap
   waar je op wilt bouwen. */
module.exports.maakReiswereld = ({ kern }) => {

  /* De grammatica van een wereld staat op EEN plek (kern/wereldkern.js): de
     vier signalen, hun volgorde, en het vangnet dat een stukke bron meldt
     zonder de rest mee te nemen. Die stonden hier als eigen kopie -- in alle
     vier de werelden letterlijk hetzelfde -- en dan bedoelt de eerste die er
     een verandert iets anders met hetzelfde woord (LAT.md regel 4).

     Het WOORDENBOEK blijft hier: welke statussen deze wereld kent, weet
     alleen deze wereld. En het sorteren en tellen ook, want die VERSCHILLEN
     per wereld met reden; ze samenvoegen zou van vier werelden een grijze
     middelmaat maken (zie het waarom in wereldkern.js). */
  const { RANG, bron, betekenisVan, standVan } = require('./wereldkern');
  const bronnen = require('./reiswereld-bronnen');

  /* Laag 0 van het Command Canvas: het woord waarmee deze wereld opent
     (CANVAS.md). Bij Reizen betekent 'aandacht' bijna altijd hetzelfde ding --
     er vertrekt vandaag iets -- en dan is 'Op vertrek' meer waard dan 'Druk'.
     Dat is waarom de woorden bij de wereld horen en niet bij de kern. */
  const meetStand = standVan({ verstoord: 'Verstoord', aandacht: 'Op vertrek', gezond: 'Rustig' });

  const vandaag = () => new Date().toISOString().slice(0, 10);
  /* Het woordenboek en de regelvorm staan in ./reiswereld-regel.js: hoe een rij
     eruitziet is iets anders dan wat deze wereld ermee doet. */
  const { regel } = require('./reiswereld-regel')({ betekenisVan });

  /* Een bron die stukgaat mag de andere niet meenemen, en mag ook niet stil
     verdwijnen. Een reiswereld die na een storing drie in plaats van vier
     reizen toont, is erger dan een die zegt dat hij het niet weet: de eerste
     lijkt compleet. Vandaar per bron een eigen uitkomst, en een lijst `stil`
     met wat er niet opgehaald kon worden. */

  function komend(key) {
    const uit = [], stil = [];
    /* De bronnen zelf staan in ./reiswereld-bronnen.js: welk domein welke rij
       levert, is iets anders dan wat deze wereld met die rijen DOET (sorteren,
       oordelen, tellen). Ze stonden hier samen tot de invoerbalie erbij kwam en
       het bestand over de grens van tien kilobyte ging; het is geen slechte
       plek om die twee uit elkaar te halen. */
    bronnen({ kern, regel, bron }, key, uit, stil);

    /* Alleen wat nog komt, en wat vandaag speelt. Een verblijf loopt door tot
       de vertrekdatum, dus dat telt zolang `tot` niet gepasseerd is; een vlucht
       is één dag. */
    const nu = vandaag();
    const komendeReizen = uit
      .filter(r => (r.tot || r.van) >= nu)
      .sort((a, b) => (a.van || '').localeCompare(b.van || ''));

    /* Uitzonderingsgestuurd (ONTWERP.md par. 3): het scherm hoort niet te
       roepen hoeveel het weet, maar of er iets aan de hand is. Deze telling
       maakt dat mogelijk zonder dat het scherm er zelf overheen hoeft te lopen
       -- en zonder dat de twee ooit uit elkaar lopen. */
    const telling = {
      komend: komendeReizen.length,
      aandacht: komendeReizen.filter(r => r.sig === 'aandacht' || r.sig === 'incident').length,
      wachtend: komendeReizen.filter(r => !!r.wacht).length,
      /* Onbekende toestanden apart tellen en apart noemen. Ze verstoppen tussen
         "in orde" zou een raadsel als geruststelling verkopen. */
      onbekend: komendeReizen.filter(r => !r.sig).length
    };

    return {
      ok: true,
      komend: komendeReizen,
      /* Laag 0: het oordeel in EEN woord, hier berekend en niet op het scherm
         (CANVAS.md). Let op WELKE rij eronder ligt: de stand oordeelt over de
         komende reizen, want dat is ook wat het scherm toont. Hem over `uit`
         laten lopen zou hem laten schrikken van een reis van vorig jaar. */
      stand: meetStand(komendeReizen, stil),
      telling,
      /* Eerlijk over wat er niet gemeten is: niet nul melden wat onbekend is.
         Het scherm zegt dit hardop, want een lege reiswereld die eigenlijk een
         storing is, laat iemand een vlucht missen. */
      stil,
      bronnen: ['verblijven', 'reisbureau', 'vluchten', 'activiteiten', 'ingevoerd']
    };
  }

  return { reiswereld: { komend } };
};
