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

const SLEUTELS = {
  // ---- oprichten en aanmaken: dubbeltik maakt er nooit twee ----
  'POST /api/concern/nieuw': { zelfdeVerzoek: true },
  'POST /api/concern/entiteit/nieuw': { zelfdeVerzoek: true },
  'POST /api/concern/opname/maak': { zelfdeVerzoek: true },
  'POST /api/genootschap/richt-op': { zelfdeVerzoek: true },
  'POST /api/gewoonten/maak': { zelfdeVerzoek: true },
  'POST /api/meet/maak': { zelfdeVerzoek: true },
  'POST /api/mall/lijst/nieuw': { zelfdeVerzoek: true },
  'POST /api/mediaos/lijst/maak': { zelfdeVerzoek: true },
  'POST /api/muziek/maak': { zelfdeVerzoek: true },
  'POST /api/member/leren/project-maak': { zelfdeVerzoek: true },
  'POST /api/office/ideeen/maak': { zelfdeVerzoek: true },
  'POST /api/office/hardware/maak': { zelfdeVerzoek: true },
  'POST /api/office/atelier/maak': { zelfdeVerzoek: true },
  'POST /api/office/architect/maak': { zelfdeVerzoek: true },
  'POST /api/office/kantoorpakket/maak': { zelfdeVerzoek: true },

  /* De agenda draagt een datum en een tijd, en die maken de afspraak. Een
     tweede "Lunch" op dezelfde dag om dezelfde tijd is een dubbeltik; een
     tweede op een ander tijdstip is een echte tweede afspraak. */
  'POST /api/agenda/toevoegen': { zelfdeVerzoek: true },

  /* Een melding aan de gemeente: twee keer dezelfde melding binnen vijf
     seconden is een dubbeltik, en een dubbele melding kost een ambtenaar tijd. */
  'POST /api/gemeente/meld': { zelfdeVerzoek: true },

  // ---- bewust NIET idempotent, met de reden erbij ----
  'POST /api/command/sonde/draai': { nietIdempotent: true,
    waarom: 'een sonde draaien is een MEETHANDELING: twee keer draaien hoort twee metingen op te leveren, ' +
      'anders meet de tweede ronde de eerste' },
  'POST /api/command/puls': { nietIdempotent: true,
    waarom: 'de puls is een momentopname; twee keer vragen hoort twee momenten te geven' },
  'POST /api/live/start': { nietIdempotent: true,
    waarom: 'een tweede start is een nieuwe uitzending, niet dezelfde nog eens' }
};

function sleutelVoor(methode, pad) {
  return SLEUTELS[String(methode || '').toUpperCase() + ' ' + String(pad || '')] || null;
}

/* De verklaring nakijken bij het laden: een `nietIdempotent` zonder reden is
   geen verklaring maar een ontsnapping, en een lege veldenlijst zegt niets. */
for (const [sleutel, v] of Object.entries(SLEUTELS)) {
  if (v.nietIdempotent && !v.waarom)
    throw new Error('idemsleutels: "' + sleutel + '" is nietIdempotent zonder waarom');
  if (v.velden && (!Array.isArray(v.velden) || !v.velden.length))
    throw new Error('idemsleutels: "' + sleutel + '" heeft een lege veldenlijst');
  if (!v.nietIdempotent && !v.zelfdeVerzoek && !v.velden)
    throw new Error('idemsleutels: "' + sleutel + '" verklaart niets');
}

module.exports = { SLEUTELS, sleutelVoor, VENSTER_MS };
