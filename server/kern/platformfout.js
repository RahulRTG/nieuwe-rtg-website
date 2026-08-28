/* ============================================================================
   DE FOUTENTAAL VAN HET PLATFORM -- één vorm voor elke weigering aan een derde.

   WAAROM DIT ER IS. `kern/appstore/brug.js` schreef al een weigering die vier
   dingen zegt: welke machtiging nodig was, wat dit lid WEL gaf, wat het manifest
   vroeg, en hoe het op te lossen is. Dat is beter dan wat de meeste platforms
   teruggeven -- en het bereikte niemand. De celpagina maakte er
   `new Error(d.error)` van, stuurde alleen `err.message` de cel in, en de
   brugklant maakte daar opnieuw een kale tekenreeks van. Drie regels, en het
   antwoord waar de moeite in zat was weg.

   Dit bestand is de reparatie van de OORZAAK en niet van het symptoom
   (LAT-regel 1): er komt één vorm, en die reist ongeschonden tot in de cel.

   DE VORM:

     {
       code:        RTG_MACHTIGING_NIET_VERLEEND   -- stabiel, machineleesbaar
       error:       'de zin voor een mens'          -- blijft, want alles leest hem
       methode:     'bericht.zet'
       herhaalbaar: false                           -- mag een taakloper dit opnieuw?
       ...           velden die bij deze code horen
     }

   `error` heet `error` en niet `bericht`, en dat is geen slordigheid: elke
   bestaande route in dit huis geeft `{ error }` terug en elk bestaand scherm
   leest dat veld. Een tweede naam ernaast zou betekenen dat elk scherm moet gaan
   kiezen (LAT-regel 4). De code komt ERBIJ; hij vervangt niets.

   WAT HIER NIET IN STAAT, en met opzet: een code die nergens wordt uitgezonden.
   Een foutcode in een tabel die geen enkele regel code kan produceren, is een
   belofte in tekst zonder belofte in code (LAT-regel 6). `RTG_DOEL_KOMT_NIET_OVEREEN`
   hoort hier bijvoorbeeld thuis zodra de brug het doel van een AANROEP kent --
   vandaag kent hij alleen het doel van een MACHTIGING, en dat wordt bij het
   verlenen en bij de vergunningsdiff gerekend en niet bij elke aanroep. Zie
   `NOG_GEEN_CODE` onderaan.
   ========================================================================== */
'use strict';

/* De codes. Per code: welke status erbij hoort, of een taakloper het opnieuw mag
   proberen, en waar hij vandaan komt. Dat laatste is er zodat niemand een code
   toevoegt zonder de plek te noemen die hem uitzendt. */
const CODES = {
  RTG_METHODE_ONBEKEND: {
    status: 400, herhaalbaar: false,
    uitleg: 'De aangeroepen methode bestaat niet op de brug.',
    uitgezondenDoor: 'server/kern/appstore/brug.js'
  },
  RTG_MACHTIGING_NIET_VERLEEND: {
    status: 403, herhaalbaar: false,
    uitleg: 'De app vraagt deze machtiging in zijn manifest, maar dit lid heeft hem niet verleend of weer ingetrokken.',
    uitgezondenDoor: 'server/kern/appstore/brug.js'
  },
  RTG_MACHTIGING_NIET_GEVRAAGD: {
    status: 403, herhaalbaar: false,
    uitleg: 'De app vraagt deze machtiging niet in zijn manifest, dus het lid heeft hem ook nooit kunnen geven.',
    uitgezondenDoor: 'server/kern/appstore/brug.js'
  },
  RTG_ARGUMENT_ONGELDIG: {
    status: 400, herhaalbaar: false,
    uitleg: 'De methode bestaat en mag, maar de meegegeven waarden passen niet binnen de grenzen.',
    uitgezondenDoor: 'server/kern/appstore/brug.js'
  },
  RTG_TE_VEEL_AANROEPEN: {
    status: 429, herhaalbaar: true,
    uitleg: 'De rem op de brug is geraakt. Dit is de enige weigering die vanzelf overgaat.',
    uitgezondenDoor: 'server/kern/appstore/brug.js'
  },
  RTG_GEEN_ANTWOORD: {
    status: 504, herhaalbaar: true,
    uitleg: 'De brug antwoordde niet binnen vijftien seconden. Deze wordt in de CEL gemaakt en niet op de server: als de celpagina zwijgt, is er niemand die een status kan sturen.',
    uitgezondenDoor: 'server/kern/appstore/brugklant.js'
  },
  RTG_BRUG_FOUT: {
    status: 500, herhaalbaar: true,
    uitleg: 'De brug kon deze aanroep niet uitvoeren. Dit ligt niet aan de app.',
    uitgezondenDoor: 'server/kern/appstore/brug.js'
  }
};

/* Codes die er nog NIET zijn, met de reden. Zelfde afspraak als
   machtigingen.NIET_GEBOUWD: een ontwikkelaar hoort te lezen waarom iets
   ontbreekt in plaats van te denken dat hij het over het hoofd ziet. */
const NOG_GEEN_CODE = {
  RTG_DOEL_KOMT_NIET_OVEREEN: 'De brug kent het doel van een MACHTIGING (uit het manifest, gerekend bij het verlenen en in de vergunningsdiff), niet het doel van een losse AANROEP. Zolang een aanroep zijn eigen doel niet meestuurt, valt er niets te vergelijken en zou deze code nooit worden uitgezonden.',
  RTG_TEGOED_OP: 'Een app van derden beweegt geen geld (GELD.md par. 3), dus er is geen tegoed dat op kan raken.',
  RTG_NETWERK_GEWEIGERD: 'Een cel heeft geen netwerk (connect-src none). Een geweigerd verzoek bestaat niet, want er wordt er geen gedaan.'
};

const isCode = (c) => Object.prototype.hasOwnProperty.call(CODES, String(c == null ? '' : c));

/* Een fout maken. `extra` draagt de velden die bij deze code horen -- machtiging,
   verleend, gevraagd, hoe. Ze worden niet gecontroleerd: welke velden zinnig zijn
   weet de laag die de fout uitzendt, en een controle hier zou betekenen dat deze
   module weet wat een machtiging is. */
function maak(code, error, extra) {
  if (!isCode(code)) {
    throw new Error('Onbekende platformfoutcode "' + code + '". De codes zijn: ' + Object.keys(CODES).join(', ') + '.');
  }
  const d = CODES[code];
  return Object.assign({ status: d.status, code, error: String(error || d.uitleg), herhaalbaar: d.herhaalbaar }, extra || {});
}

/* Wat een SDK-generator en de documentatie hiervan moeten weten. Eén vorm, zodat
   de tabel in de documentatie niet met de hand wordt bijgehouden. */
function overzicht() {
  return Object.entries(CODES).map(([code, d]) => ({
    code, status: d.status, herhaalbaar: d.herhaalbaar, uitleg: d.uitleg, uitgezondenDoor: d.uitgezondenDoor
  }));
}

module.exports = { CODES, NOG_GEEN_CODE, isCode, maak, overzicht };
