/* DE BELEIDSTOETS: mag DEZE waarde voor DEZE handeling worden gebruikt?

   Gewone financiele software vraagt "is er genoeg saldo?". Dat is een vraag
   over een getal. Zodra waarde een uitgever en een bestemming heeft, is dat de
   verkeerde vraag: een werkgeversbudget van 500 euro met genoeg saldo mag nog
   steeds niet naar een slijterij om half drie 's nachts. De vraag is dus niet
   hoeveel er staat maar of dit mag.

   DE VOLGORDE IS DE HELE INHOUD. De toetsen staan van hard naar zacht:

     1. de KLASSE  -- wat de soort waarde nooit mag (bestedingsgebied,
                      overdraagbaarheid, verval). Dit is de grond onder de
                      klasse en staat niet ter beschikking van een instelling.
     2. het BELEID van de uitgever -- wat de werkgever, de gemeente of de zaak
                      erbovenop heeft gezet (genres, tijdvenster, dagmax).
     3. het BELEID van de houder   -- wat het lid ZELF heeft ingesteld. Zie
                      GELD.md par. 4: het lid stelt beleid, Rahul handelt
                      binnen beleid. Een eigen grens is hier een REGEL en geen
                      waarschuwing; anders is het geen grens.

   Een strengere laag kan een ruimere nooit openzetten -- daarom deze volgorde
   en geen scoring. Wie zakt, zakt, en het antwoord zegt op welke laag.

   WAT DEZE MODULE NIET DOET: hij kijkt niet naar saldo. Beschikbaarheid is een
   andere vraag dan toelaatbaarheid, en ze door elkaar halen levert de fout op
   waarbij een geweigerde handeling "onvoldoende saldo" zegt terwijl er geld
   genoeg staat. Het saldo is de zaak van ./index.js. */
'use strict';

const { KLASSEN, STANDAARD } = require('./klassen');

const zinnen = {
  klasse: 'Deze soort waarde kent deze handeling niet.',
  gebied: 'Dit tegoed is hier niet te besteden.',
  overdracht: 'Dit tegoed is niet overdraagbaar.',
  verlopen: 'Dit tegoed is verlopen.',
  genre: 'Dit tegoed geldt niet voor dit soort zaak.',
  tijd: 'Dit tegoed geldt op dit tijdstip niet.',
  dagmax: 'Hiermee komt u boven het dagmaximum van dit tegoed.',
  eigen: 'Dit gaat over een grens die u zelf heeft ingesteld.'
};

const nee = (reden, extra) => ({ mag: false, reden, uitleg: zinnen[reden], ...(extra || {}) });

/* Een tijdvenster is 'HH:MM-HH:MM'. Een venster dat over middernacht loopt
   (22:00-02:00) hoort gewoon te werken -- vandaar de tweedeling en niet een
   simpele vergelijking, die daar stilzwijgend altijd `false` op zou geven. */
function binnenVenster(venster, datum) {
  const m = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(String(venster || ''));
  if (!m) return true;
  const minuut = datum.getHours() * 60 + datum.getMinutes();
  const van = Number(m[1]) * 60 + Number(m[2]);
  const tot = Number(m[3]) * 60 + Number(m[4]);
  return van <= tot ? (minuut >= van && minuut <= tot) : (minuut >= van || minuut <= tot);
}

/* `positie`  { klasse, vervaltOp, beleid }   -- de waardepositie zelf
   `handeling` { centen, genre, ontvanger, soort, dagBesteed, nu }
   `eigenBeleid` de regels van de HOUDER (kern/geldbeleid), optioneel.

   `soort` is de aard van de handeling: 'besteden' (naar een zaak),
   'overdragen' (naar een ander lid) of 'uitbetalen' (het huis uit). */
function toets(positie, handeling, eigenBeleid) {
  const p = positie || {};
  const h = handeling || {};
  const k = KLASSEN[p.klasse] || KLASSEN[STANDAARD];
  const nu = h.nu instanceof Date ? h.nu : new Date(h.nu || Date.now());
  const centen = Math.round(Number(h.centen) || 0);

  // -- laag 1: de klasse. Hier staat wat de soort waarde nooit mag. --
  if (Number.isFinite(p.vervaltOp) && p.vervaltOp < nu.getTime()) return nee('verlopen', { vervaltOp: p.vervaltOp });
  if (h.soort === 'uitbetalen' && !k.uitbetaalbaar) return nee('klasse', { klasse: p.klasse });
  if (h.soort === 'overdragen' && k.overdraagbaar === 'nee') return nee('overdracht', { klasse: p.klasse });
  if (h.soort === 'besteden') {
    if (k.bestedingsgebied === 'uitgever' && h.ontvanger && p.uitgever && h.ontvanger !== p.uitgever)
      return nee('gebied', { alleenBij: p.uitgever });
  }

  // -- laag 2: het beleid van de uitgever. --
  const b = p.beleid || {};
  /* FAIL-CLOSED, en dit was de eerste versie niet. Er stond `h.genre &&` in de
     voorwaarde, waardoor een betaling zonder bekend genre langs elke
     genrebeperking glipte: een maaltijdbudget was dan overal te besteden zolang
     de aanroeper vergat te zeggen wáár. Een beleidslaag die bij twijfel
     goedkeurt, is geen beleidslaag. Weten we het genre niet, dan weten we ook
     niet dat deze zaak eronder valt, en dan geldt het tegoed hier niet. */
  if (Array.isArray(b.genres) && b.genres.length && !b.genres.includes(h.genre))
    return nee('genre', { toegestaan: b.genres, gevraagd: h.genre || null });
  if (b.venster && !binnenVenster(b.venster, nu)) return nee('tijd', { venster: b.venster });
  if (Number.isFinite(b.dagMaxCenten) && Math.round(Number(h.dagBesteed) || 0) + centen > b.dagMaxCenten)
    return nee('dagmax', { dagMaxCenten: b.dagMaxCenten, dagBesteed: Math.round(Number(h.dagBesteed) || 0) });

  /* -- laag 3: het beleid van de houder. --
     Bewust ALS LAATSTE en met een eigen reden: dit is de enige weigering die
     het lid zelf kan opheffen, en dan hoort het antwoord dat te zeggen in
     plaats van te klinken als een regel van RTG. */
  /* De grens van het lid telt over ALLES wat hij heeft, niet over dit ene
     potje. Vandaar `dagBestedTotaal` en niet `dagBesteed`: die eerste is een
     eigenschap van de persoon, de tweede van een positie. Ze op één veld laten
     samenvallen zou een persoonlijke maandgrens van 500 euro veranderen in
     "500 euro per potje", en dat is precies geen grens. */
  const e = eigenBeleid || {};
  const dagTot = Math.round(Number(h.dagBestedTotaal) || 0);
  const maandTot = Math.round(Number(h.maandBestedTotaal) || 0);
  const eigen = (grens, extra) => ({ mag: false, reden: 'eigen', uitleg: zinnen.eigen,
    eigenGrens: grens, opheffbaar: true, ...extra });
  if (Number.isFinite(e.dagMaxCenten) && dagTot + centen > e.dagMaxCenten)
    return eigen('dagmaximum', { dagMaxCenten: e.dagMaxCenten, besteed: dagTot });
  if (Number.isFinite(e.maandMaxCenten) && maandTot + centen > e.maandMaxCenten)
    return eigen('maandmaximum', { maandMaxCenten: e.maandMaxCenten, besteed: maandTot });
  if (e.venster && !binnenVenster(e.venster, nu))
    return eigen('tijdvenster', { venster: e.venster });

  return { mag: true, klasse: p.klasse || STANDAARD };
}

module.exports = { toets, binnenVenster, zinnen };
