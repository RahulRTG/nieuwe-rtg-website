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
  /* GEVONDEN DOOR DE IDEMPROEF, en de tegenhanger van de export hierboven: hier
     is een tweede oproep WEL een dubbeltik. kern/bank/rekeningen.js maakt bij
     elke oproep een verse IBAN aan; twee identieke verzoeken binnen het venster
     leveren twee rekeningen op dezelfde naam met dezelfde soort. Er is een dak
     van twaalf rekeningen per lid, dus het loopt niet weg -- maar een rekening
     die je niet hebt aangevraagd is er een te veel, en dit is de geldkant. */
  'POST /api/bank/rekening/open': { zelfdeVerzoek: true },        // codenaam + soort + naam
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

  /* De twee groepen hieronder staan in ./idemsleutels-deel2.js: handelingen die
     met opzet een tweede effect hebben, en POSTs die niets veranderen. Zie de
     kop van dat bestand voor waar de snede loopt en waarom. */
  ...require('./idemsleutels-deel2')
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
  require('./idemsleutels-restbak'));

/* De verklaring nakijken bij het laden: een `nietIdempotent` zonder reden is
   geen verklaring maar een ontsnapping, en een lege veldenlijst zegt niets. */
for (const [sleutel, v] of Object.entries(SLEUTELS)) {
  if (v.nietIdempotent && !v.waarom)
    throw new Error('idemsleutels: "' + sleutel + '" is nietIdempotent zonder waarom');
  if (v.velden && (!Array.isArray(v.velden) || !v.velden.length))
    throw new Error('idemsleutels: "' + sleutel + '" heeft een lege veldenlijst');
  if (!v.nietIdempotent && !v.zelfdeVerzoek && !v.velden && !v.leest)
    throw new Error('idemsleutels: "' + sleutel + '" verklaart niets');
}

module.exports = { SLEUTELS, sleutelVoor, VENSTER_MS };
