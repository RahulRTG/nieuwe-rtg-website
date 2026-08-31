/* ============================================================================
   WAT IS "HETZELFDE VERZOEK"? -- de verklaring per schrijfroute.

   HET PROBLEEM, en waarom de voor de hand liggende oplossing fout is.

   De idemproef vond 94 schrijfroutes waar een herhaling het werk gewoon nog een
   keer deed: dubbeltik op /api/concern/nieuw, twee concerns. De verleiding is om
   dat generiek op te lossen -- dedupliceer elk verzoek dat binnen een paar
   seconden identiek terugkomt van dezelfde afzender, en geen enkele route hoeft
   iets te doen.

   Dat breekt op EEN voorbeeld, en dat voorbeeld is genoeg: `{}` twee keer naar
   een dobbelworp is TWEE LEGITIEME WORPEN. Hetzelfde geldt voor elke teller en
   elke "voeg er nog een toe". Een laag die op inhoud dedupliceert slikt die
   tweede handeling stil op, en dat is erger dan het probleem dat hij oplost --
   want een dubbele boeking valt op en een verdwenen worp niet.

   Idempotentie is dus een eigenschap van de HANDELING, en die valt niet te
   raden. Ze moet verklaard worden. Dit bestand is die verklaring.

   ------------------------------------------------------------------------
   DE DRIE VORMEN

     { zelfdeVerzoek: true }
       Een woordelijk gelijk verzoek binnen het venster is een HERHALING en geen
       tweede handeling. Dit past op vrijwel elke "maak"-route: twee keer
       hetzelfde concern oprichten met dezelfde naam, binnen vijf seconden, is
       een dubbeltik. Vrije tekst telt niet mee in de vergelijking (zie
       BUITEN_AFDRUK in ./idem-poort.js): een andere notitie maakt er geen ander
       verzoek van.

     { velden: ['naam', 'datum'] }
       Fijner: alleen DEZE velden bepalen de identiteit. Voor een route waar de
       rest van de body meelift (een tijdstempel van de client, een teller) en
       twee verzoeken toch dezelfde handeling zijn.

     { leest: true }
       Een POST die niets verandert. Herhalen is per definitie veilig en er valt
       niets te dedupliceren; de poort doet hier niets. Apart van "geen
       verklaring", want dat is een gat en dit is een besluit.

     { nietIdempotent: true, waarom: '...' }
       Een herhaling is een ECHTE tweede handeling. De worp, de teller, het
       trekken van een kaart. `waarom` is verplicht: zonder reden is dit veld
       een plek om onder de verklaring uit te komen.

   ------------------------------------------------------------------------
   WAT DEZE LIJST NIET IS

   Geen dekking. Er zijn 3650 schrijfroutes en hieronder staan er een fractie
   van. Wat hier NIET in staat is niet "veilig" maar ONVERKLAARD, en dat is
   precies wat scripts/idemschuld.js telt en wat IDEMSCHULD.json vasthoudt: een
   getal dat alleen mag krimpen. Zonder die teller zou deze lijst een goed
   gevoel geven over 94 routes en zwijgen over de rest.

   EN LET OP DE VOLGORDE BIJ EEN NIEUWE ROUTE: eerst de verklaring, dan de
   route. Een schrijfroute zonder verklaring laat de keuring zakken, en dat is
   de bedoeling -- zo kan het gat niet stil weer groeien.
   ========================================================================== */
'use strict';

/* Het venster: hoe lang een woordelijk gelijk verzoek als herhaling telt.

   Vijf seconden is de maat van een dubbeltik, een haperend netwerk en een
   ongeduldige gebruiker -- niet de maat van iemand die bewust twee keer
   hetzelfde aanmaakt. Langer maken slikt echte tweede handelingen op; korter
   laat de trage retry er doorheen. Dit is bewust GEEN uur: dat is het domein
   van een expliciete Idempotency-Key, en die heeft zijn eigen venster. */
const VENSTER_MS = 5000;

/* De wereld-routes van de samenvoegronde staan in ./idemsleutels-werelden.js
   en de kostprijslaag in ./idemsleutels-kosten.js (zelfde register, eigen
   bestand -- zie de kop daar); hieronder komen ze er via Object.assign bij,
   zodat er maar EEN opzoekweg bestaat. */
const SLEUTELS = {
  /* ---- geverifieerd: de body draagt de identiteit van wat er gemaakt wordt ----

     Van elk van deze routes is de handler nagelezen: er staat een veld in de
     body dat bepaalt WAT er ontstaat (een naam, een titel, een datum). Twee
     woordelijk gelijke verzoeken binnen vijf seconden zijn dan een dubbeltik en
     geen tweede bedoeling. */
  'POST /api/concern/nieuw': { zelfdeVerzoek: true },              // naam
  'POST /api/concern/entiteit/nieuw': { zelfdeVerzoek: true },     // naam + rechtsvorm
  'POST /api/gewoonten/maak': { zelfdeVerzoek: true },             // naam
  'POST /api/genootschap/richt-op': { zelfdeVerzoek: true },       // naam + soort
  'POST /api/agenda/toevoegen': { zelfdeVerzoek: true },           // titel + datum + tijd
  'POST /api/gemeente/meld': { zelfdeVerzoek: true },              // de melding zelf
  'POST /api/member/leren/project-maak': { zelfdeVerzoek: true },  // titel
  'POST /api/mall/lijst/nieuw': { zelfdeVerzoek: true },           // naam, verplicht (kern/mall/lijsten.js)
  'POST /api/mediaos/lijst/maak': { zelfdeVerzoek: true },         // naam, verplicht (kern/mediaos/lijsten.js)
  'POST /api/office/architect/maak': { zelfdeVerzoek: true },      // naam, verplicht (kern/architect/index.js)
  'POST /api/office/atelier/maak': { zelfdeVerzoek: true },        // naam, verplicht (kern/atelier/index.js)
  'POST /api/office/hardware/maak': { zelfdeVerzoek: true },       // naam, verplicht (kern/hardwarelab/index.js)
  'POST /api/office/ideeen/maak': { zelfdeVerzoek: true },         // titel, verplicht (kern/ideeen.js)

  /* De werkruimte bewaart één actuele compositie per lid en het auditspoor
     noteert één brokerhandeling. Een netwerkretry met exact dezelfde inhoud
     mag daarom noch een tweede schrijfbeweging, noch een dubbele auditregel
     veroorzaken. */
  'POST /api/ik/workspace/zet': { zelfdeVerzoek: true },
  'POST /api/ik/workspace/audit/noteer': { zelfdeVerzoek: true },

  /* ---- bewust NIET idempotent, met de reden erbij ----

     /api/muziek/maak stond hier eerst als "zelfde verzoek is een herhaling", en
     dat was fout. Hij maakt uit een LEGE body elke keer een nieuw stuk; twee
     oproepen zijn twee stukken. test/mediaos.test.js ving het meteen.

     Dat is precies de fout waar de kop van dit bestand voor waarschuwt, en ik
     liep er zelf in: de verklaring was op de NAAM van de route gebaseerd ("maak"
     klinkt als aanmaken met inhoud) en niet op de handler. Een verklaring die je
     niet hebt nagelezen, is een gok met een net gezicht. */
  'POST /api/muziek/maak': { nietIdempotent: true,
    waarom: 'maakt uit een lege body elke keer een NIEUW stuk; twee oproepen zijn twee stukken, ' +
      'en een laag die de tweede opslikt laat werk verdwijnen zonder dat iemand het merkt' },
  'POST /api/command/sonde/draai': { nietIdempotent: true,
    waarom: 'een sonde draaien is een MEETHANDELING: twee keer draaien hoort twee metingen op te leveren, ' +
      'anders meet de tweede ronde de eerste' },
  'POST /api/command/puls': { nietIdempotent: true,
    waarom: 'de puls is een momentopname; twee keer vragen hoort twee momenten te geven' },
  'POST /api/live/start': { nietIdempotent: true,
    waarom: 'een tweede start is een nieuwe uitzending, niet dezelfde nog eens' },

  /* Dezelfde toets als hierboven, andere uitkomst: bij deze vier staat er GEEN
     verplicht veld in de body dat bepaalt wat er ontstaat. Wie zonder inhoud
     een tweede maakt, krijgt met recht een tweede -- en een laag die dat
     opslikt, laat werk verdwijnen. */
  'POST /api/office/kantoorpakket/maak': { nietIdempotent: true,
    waarom: 'de titel is optioneel en valt terug op "Nieuw document"; twee lege oproepen zijn ' +
      'twee verse documenten, niet dezelfde nog eens (kern/office/docs.js)' },
  'POST /api/meet/maak': { nietIdempotent: true,
    waarom: 'zonder agendaId ontstaat er elke keer een verse kamer met een eigen toegangscode; ' +
      'MET agendaId dedupliceert de route zelf al (kern/meet.js geeft dan bestond:true terug), ' +
      'dus er valt hier niets te winnen en wel iets te verliezen' },
  'POST /api/concern/opname/maak': { nietIdempotent: true,
    waarom: 'een opname is een momentopname van het concern; twee keer vragen hoort met recht ' +
      'twee momenten op te leveren, anders is de tweede opname stil de eerste' },

  /* ---- routes die niets veranderen ----

     Een POST die alleen leest. Herhalen is per definitie veilig, en er valt
     niets te dedupliceren: de poort doet hier dan ook niets. Ze staan hier
     omdat "geen verklaring" en "verklaard als leesroute" twee verschillende
     dingen zijn, en de schuldteller dat verschil hoort te zien. */
  'POST /api/office/anker': { leest: true },
  'POST /api/office/anker/reken': { leest: true },
  'POST /api/office/handelingen': { leest: true },
  'POST /api/ik/workspace': { leest: true },
  'POST /api/ik/workspace/audit': { leest: true }
};

function sleutelVoor(methode, pad) {
  return SLEUTELS[String(methode || '').toUpperCase() + ' ' + String(pad || '')] || null;
}

/* EERST SAMENVOEGEN, DAN PAS NAKIJKEN -- en die volgorde was fout. De lus
   hieronder stond VOOR deze regel, dus hij liep alleen over de lijst in dit
   bestand: het werelden-deel werd nooit gecontroleerd, en een `nietIdempotent`
   zonder reden was daar dus gewoon toegestaan. Een controle die niet over alles
   loopt is geen controle. */
Object.assign(SLEUTELS,
  require('./idemsleutels-werelden').SLEUTELS,
  require('./idemsleutels-geld').SLEUTELS,
  require('./idemsleutels-kosten').SLEUTELS,
  require('./idemsleutels-commerce').SLEUTELS,
  /* De kale ronde van 30 augustus 2026, met per regel het identiteitsveld. */
  require('./idemsleutels-kaleronde').SLEUTELS,
  /* En de andere kant van diezelfde ronde: wat je met opzet NIET dedupliceert,
     elk met een reden. Zie de kop van dat bestand. */
  require('./idemsleutels-kaleronde-b').SLEUTELS,
  /* De zesentwintig die de uitgebreide proefopstelling zichtbaar maakte. */
  require('./idemsleutels-proefronde').SLEUTELS,
  /* De tien uit de objectronde: het werkdossier van een onderzoek en drie erbuiten. */
  require('./idemsleutels-objectronde').SLEUTELS);

/* Drie keuringen bij het laden, en ze staan bij elkaar in ./idemsleutels-nooit.js:
   geen route in twee zijbestanden, elke verklaring compleet, en vier routes die
   hier NOOIT een regel mogen hebben. Alle drie gooien ze. */
require('./idemsleutels-nooit')(SLEUTELS);

module.exports = { SLEUTELS, sleutelVoor, VENSTER_MS };
