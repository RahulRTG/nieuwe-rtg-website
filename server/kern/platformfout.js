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

   `herhaalbaar` IN DE TABEL IS IETS ANDERS DAN `herhaalbaar` OP EEN FOUT, en dat
   verschil draagt de hele reparatie van 14 september 2026. Op een UITGEZONDEN
   fout is het altijd een boolean: de app krijgt een antwoord. In de TABEL mag
   het `null` zijn, en dat betekent niet "onbekend" maar iets preciezers -- deze
   CODE kan het niet alleen beantwoorden, want of de handeling werd uitgevoerd
   hangt af van de methode en niet van de fout. Zie `herhaalbaarVan` verderop.

   `uitvoeringBekend` is daarom een BOOLEAN en geen nieuwe woordenlijst: er is
   maar een vraag ("staat vast of deze aanroep nog is uitgevoerd?"), en dit huis
   heeft al meer gezagsladders dan het nodig heeft (AFSPRAAK.md, MACHINE.md).

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
    uitgezondenDoor: 'server/kern/appstore/brugweigering.js'
  },
  /* Het derde geval; waarom het er een eigen code is en niet een variant van de
     twee eromheen, staat op één plek en dat is de kop van brugweigering.js. */
  RTG_MACHTIGING_VERSMALD: {
    status: 403, herhaalbaar: false,
    uitleg: 'Het lid heeft deze machtiging aangevinkt, maar mag hem zelf niet weggeven; hij is daarom niet verleend. Noch het lid noch de uitgever lost dit met een knop op.',
    uitgezondenDoor: 'server/kern/appstore/brugweigering.js'
  },
  RTG_MACHTIGING_NIET_GEVRAAGD: {
    status: 403, herhaalbaar: false,
    uitleg: 'De app vraagt deze machtiging niet in zijn manifest, dus het lid heeft hem ook nooit kunnen geven.',
    uitgezondenDoor: 'server/kern/appstore/brugweigering.js'
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
    status: 504, herhaalbaar: null,
    uitleg: 'De brug antwoordde niet binnen vijftien seconden. Deze wordt in de CEL gemaakt en niet op de server: als de celpagina zwijgt, is er niemand die een status kan sturen.',
    uitvoeringBekend: false,
    uitgezondenDoor: 'server/kern/appstore/brugklant.js'
  },
  RTG_BRUG_FOUT: {
    status: 500, herhaalbaar: null,
    uitleg: 'De brug kon deze aanroep niet uitvoeren. Dit ligt niet aan de app.',
    uitvoeringBekend: false,
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
   module weet wat een machtiging is.

   EEN UITZONDERING, en die is er met opzet: `herhaalbaar` komt NOOIT uit `extra`
   langs de tabel heen. Stond het veld in de eerste helft van de Object.assign,
   dan kon een uitzender er een eigen antwoord overheen zetten -- een 403 die
   zichzelf herhaalbaar noemt, en niemand die het merkt. Het staat daarom in de
   LAATSTE helft, waar het altijd wint. */
function maak(code, error, extra) {
  if (!isCode(code)) {
    throw new Error('Onbekende platformfoutcode "' + code + '". De codes zijn: ' + Object.keys(CODES).join(', ') + '.');
  }
  const d = CODES[code];
  const e = extra || {};
  return Object.assign({ status: d.status, code, error: String(error || d.uitleg) }, e,
    { herhaalbaar: herhaalbaarVan(code, e) });
}

/* WIE HET ANTWOORD GEEFT OP "MAG EEN TAAKLOPER DIT OPNIEUW?".

   Voor vijf codes is dat de tabel zelf: bij een onbekende methode, een
   ontbrekende machtiging en een ongeldig argument is er NIETS uitgevoerd en
   verandert een tweede poging daar niets aan; bij de rem is er ook niets
   uitgevoerd, maar gaat hij vanzelf over.

   Voor twee codes kan de tabel het NIET weten, en dat is het gebrek dat deze
   laag repareert. `RTG_BRUG_FOUT` betekent dat `doe()` halverwege omviel en
   `RTG_GEEN_ANTWOORD` dat de cel binnen vijftien seconden niets hoorde -- in
   beide gevallen is onbekend of de handeling LANDDE. Of herhalen dan mag, hangt
   niet van de fout af maar van de HANDELING: `opslag.zet` twee keer laat
   dezelfde stand achter, `bericht.zet` twee keer zet twee berichten klaar.

   Die twee stonden allebei hard op `true`. Een taakloper die na een time-out
   netjes opnieuw probeerde, zette dus een tweede bericht klaar en een tweede
   arena-inzending -- terwijl de klasse in `brugmethodes.js` dat voorspelde.

   De uitzender levert het antwoord daarom zelf, uit die klasse. Doet hij dat
   niet, dan is dat een bouwfout in RTG en geen toestand van een derde, dus
   gooit deze functie in plaats van stil op `false` of `true` terug te vallen:
   een stille terugval zou precies de fout herhalen die hier wordt weggehaald. */
function herhaalbaarVan(code, extra) {
  const d = CODES[code];
  if (d.herhaalbaar !== null) return d.herhaalbaar;
  if (typeof extra.herhaalbaar !== 'boolean') {
    throw new Error('De code "' + code + '" weet zelf niet of herhalen mag (uitvoeringBekend: false)'
      + ': of de handeling landde, staat niet vast. De uitzender hoort `herhaalbaar` mee te geven,'
      + ' afgeleid uit de mutatieklasse van de methode (kern/mutatie.js, magHerhalen).');
  }
  return extra.herhaalbaar;
}

/* Wat een SDK-generator en de documentatie hiervan moeten weten. Eén vorm, zodat
   de tabel in de documentatie niet met de hand wordt bijgehouden. */
function overzicht() {
  return Object.entries(CODES).map(([code, d]) => ({
    code, status: d.status, herhaalbaar: d.herhaalbaar, uitvoeringBekend: d.uitvoeringBekend !== false,
    /* De ZIN staat hier en niet bij de lezers. Twee schermen renderden
       `f.herhaalbaar ? 'ja' : 'nee'`, en met een derde stand zouden ze allebei
       "nee" tonen waar "hangt af van de methode" hoort te staan -- twee keer
       dezelfde stille fout, op twee plekken (LAT-regel 4). */
    herhaalbaarTekst: d.herhaalbaar === null ? 'hangt af van de methode' : (d.herhaalbaar ? 'ja' : 'nee'),
    uitleg: d.uitleg, uitgezondenDoor: d.uitgezondenDoor
  }));
}

module.exports = { CODES, NOG_GEEN_CODE, isCode, maak, overzicht };
