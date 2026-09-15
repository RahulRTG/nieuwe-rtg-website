/* ============================================================================
   DE MUTATIESEMANTIEK -- wat gebeurt er als dezelfde aanroep twee keer komt?

   DE MEETING DIE HIERONDER LIGT. `IDEMPROEF.json` roept routes twee keer aan met
   dezelfde sleutel en een keer met een verse, en vergelijkt. De stand vandaag:

     3074 routes met een rol
      115 beoordeeld
       15 beschermd
      100 onbeschermd
     2959 ONGEMETEN

   Dat laatste getal is het enige dat ertoe doet, en het is de reden dat cron,
   achtergrondtaken en functies voor derden in dit huis nog niet bestaan: een
   taakloper die herhaalt bovenop een laag waarvan de herhaalbaarheid onbekend
   is, vermenigvuldigt een gat in plaats van een functie te leveren.

   HET DOEL IS NIET 3074 VAN 3074 IDEMPOTENT. Dat is jarenlang werk en het is ook
   niet wat je wilt: een betaling hoort NIET stilletjes herhaalbaar te zijn. Het
   doel is 3074 van 3074 GECLASSIFICEERD. Een mutatie mag met opzet onherhaalbaar
   zijn -- als het maar is uitgesproken, want dan weten de SDK, de taakloper, de
   client en een werkstroommotor wat ze ermee moeten.

   EN DE POORT STAAT AAN DE RAND, NIET OVERAL. Met terugwerkende kracht 2959
   routes classificeren is een megaproject dat vooraf moet slagen; dit huis doet
   het andersom. Alles wat NIEUW publiek aanroepbaar wordt -- en dat begint bij de
   brug van de App Store -- moet zijn klasse noemen. `onbekend` is daar geen
   waarde maar een weigering. Zo groeit de dekking mee met wat er naar buiten
   gaat.

   WAAROM DIT GEEN LIJST IN EEN JSON IS. Een register naast de code loopt achter
   op de dag dat iemand een methode toevoegt. Daarom noemt elke opdracht zijn
   klasse OP DE PLEK waar hij wordt gedefinieerd, en weigert deze module een
   opdracht zonder klasse bij het opbouwen -- dus bij het starten, en niet bij het
   eerste verzoek van een lid.
   ========================================================================== */
'use strict';

/* De zes klassen. Ze staan op volgorde van "herhalen kost niets" naar "herhalen
   is een tweede gebeurtenis", en die volgorde is de hele boodschap. */
const KLASSEN = {
  idempotent: {
    uitleg: 'Twee keer dezelfde aanroep laat dezelfde stand achter als een keer.',
    herhaalbaar: true,
    sleutelNodig: false,
    voorbeeld: 'een waarde zetten, een waarde wissen, iets lezen'
  },
  sleutelVereist: {
    uitleg: 'Herhalen mag, maar alleen met dezelfde idempotentiesleutel; zonder sleutel is het een tweede handeling.',
    herhaalbaar: true,
    sleutelNodig: true,
    voorbeeld: 'een bestelling plaatsen, een betaling starten'
  },
  hooguitEens: {
    uitleg: 'Nooit automatisch herhalen. Bij twijfel eerst navragen wat er is gebeurd.',
    herhaalbaar: false,
    sleutelNodig: false,
    voorbeeld: 'een onomkeerbare handeling zonder sleutel'
  },
  compenseerbaar: {
    uitleg: 'Herhalen levert een tweede handeling op, maar er bestaat een tegenboeking om het recht te zetten.',
    herhaalbaar: false,
    sleutelNodig: false,
    voorbeeld: 'een boeking die geannuleerd kan worden'
  },
  nietHerhaalbaar: {
    uitleg: 'Herhalen IS een tweede gebeurtenis, en dat is de bedoeling. Er is niets recht te zetten omdat er niets fout ging.',
    herhaalbaar: false,
    sleutelNodig: false,
    voorbeeld: 'een bericht klaarzetten, een regel aan een journaal toevoegen'
  },
  onbekend: {
    uitleg: 'Niet vastgesteld. Geen enkele automatische herhaling, en aan de rand van het platform een weigering.',
    herhaalbaar: false,
    sleutelNodig: false,
    voorbeeld: 'alles wat nog niet is beproefd'
  }
};

const NAMEN = Object.keys(KLASSEN);
const isKlasse = (k) => Object.prototype.hasOwnProperty.call(KLASSEN, String(k == null ? '' : k));
const klasse = (k) => (isKlasse(k) ? KLASSEN[k] : null);

/* Mag een taakloper deze opdracht uit zichzelf opnieuw doen? Eén plek waar die
   vraag wordt beantwoord, zodat een taakloper, de SDK en een werkstroommotor
   hem niet elk anders beantwoorden (LAT-regel 4). */
function magHerhalen(k, metSleutel) {
  const d = klasse(k);
  if (!d) return false;
  if (d.sleutelNodig) return metSleutel === true;
  return d.herhaalbaar;
}

/* DE POORT. Roep hem aan bij het OPBOUWEN van een verzameling publiek
   aanroepbare opdrachten, niet bij een verzoek: een opdracht zonder klasse hoort
   de server niet te laten starten, want anders komt hij er pas uit wanneer een
   lid hem aanroept -- en dan is het een storing in plaats van een bouwfout.

   `waar` staat erbij zodat de melding zegt WELKE verzameling het betreft; met
   twintig opdrachten in drie lagen is "een opdracht mist zijn klasse" geen
   bruikbaar bericht. */
function poort(opdrachten, waar) {
  const plek = String(waar || 'een publieke laag');
  const fouten = [];
  for (const [naam, d] of Object.entries(opdrachten || {})) {
    const k = d && d.mutatie;
    if (!k) {
      fouten.push(naam + ' noemt geen mutatieklasse. Zet `mutatie: \'<klasse>\'` erbij; de klassen zijn: ' + NAMEN.join(', ') + '.');
    } else if (!isKlasse(k)) {
      fouten.push(naam + ' noemt de klasse "' + k + '", en die bestaat niet. De klassen zijn: ' + NAMEN.join(', ') + '.');
    } else if (k === 'onbekend') {
      fouten.push(naam + ' staat op `onbekend`. Aan de rand van het platform is dat een weigering en geen waarde: '
        + 'beproef wat er gebeurt bij een tweede aanroep en noem de uitkomst. Zie de kop van kern/mutatie.js.');
    }
  }
  if (fouten.length) {
    throw new Error('Mutatiesemantiek ontbreekt in ' + plek + ':\n  - ' + fouten.join('\n  - '));
  }
  return true;
}

/* HETZELFDE ANTWOORD, OPZOEKBAAR OP NAAM. `overzicht()` geeft een lijst om te
   tonen; dit geeft per opdracht het ene antwoord dat een taakloper nodig heeft.

   Het woont hier en niet bij de aanroeper, omdat dit de module is die bepaalt
   wat een tweede aanroep doet. Wie de kaart naast de tabel opschrijft, heeft
   twee plekken die allebei "mag dit twee keer" beweren -- en de eerste keer dat
   ze uiteenlopen, geeft de verste lezer het oude antwoord (LAT-regel 4).

   HIJ ANTWOORDT VOOR EEN AANROEPER ZONDER IDEMPOTENTIESLEUTEL, en dat staat
   vast in plaats van in een parameter. Er stond eerst `metSleutel`, en die was
   met geen enkele echte tabel te beproeven: geen enkele opdracht die vandaag
   door deze kaart gaat is `sleutelVereist`, dus beide standen gaven exact
   hetzelfde antwoord. Een mutatie die `false` in `true` veranderde, gleed
   daardoor langs alle toetsen heen.

   Een vrijheidsgraad in een veiligheidsantwoord die niemand kan beproeven, is
   gevaarlijker dan geen vrijheidsgraad (LAT-regel 2, en CLAUDE.md over de tak
   die groen bleef omdat een toets hem met verzonnen invoer voedde).

   Hij is er daarom uit, en de klasse waar hij over ging WEIGERT hier. Dat is
   het verschil tussen "de twee standen geven toevallig hetzelfde antwoord" en
   "ze kunnen niet verschillen": voor elke klasse die deze regel haalt, is
   `magHerhalen(k, false)` gelijk aan `magHerhalen(k, true)` -- `sleutelVereist`
   is de enige waarbij dat niet zo is, en die komt er niet langs. Komt er ooit
   een aanroeper die WEL sleutels kent, dan valt deze kaart hardop om in plaats
   van stil het verkeerde antwoord te geven. */
function herhaalKaartVan(opdrachten) {
  const kaart = {};
  for (const { naam, mutatie, sleutelNodig } of overzicht(opdrachten)) {
    if (sleutelNodig) {
      throw new Error('"' + naam + '" is ' + mutatie + ', en deze kaart antwoordt voor een aanroeper'
        + ' ZONDER idempotentiesleutel. Of herhalen mag, hangt daar juist van die sleutel af.'
        + ' Geef herhaalKaartVan() die kennis mee voor je deze klasse erdoorheen stuurt.');
    }
    kaart[naam] = magHerhalen(mutatie, false);
  }
  return kaart;
}

/* Wat de SDK, de documentatie en een taakloper hiervan moeten weten. Eén vorm,
   zodat er geen tweede manier ontstaat om hetzelfde op te schrijven. */
function overzicht(opdrachten) {
  return Object.entries(opdrachten || {}).map(([naam, d]) => ({
    naam,
    mutatie: d && d.mutatie ? d.mutatie : 'onbekend',
    herhaalbaar: magHerhalen(d && d.mutatie, false),
    sleutelNodig: !!(klasse(d && d.mutatie) || {}).sleutelNodig,
    uitleg: (klasse(d && d.mutatie) || KLASSEN.onbekend).uitleg
  })).sort((a, b) => a.naam.localeCompare(b.naam));
}

module.exports = { KLASSEN, NAMEN, isKlasse, klasse, magHerhalen, herhaalKaartVan, poort, overzicht };
