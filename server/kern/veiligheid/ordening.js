/* DE ORDENING VAN DE BEVEILIGINGSSTANDEN -- wat is strenger dan wat, en wanneer
   is dat niet te zeggen.

   WAAROM DIT EEN EIGEN BESTAND IS. kern/incidentcontrole.js zegt met zoveel
   woorden dat zijn vijf standen GEEN ladder zijn: `beschermd` staat er dwars op,
   want hij houdt meer tegen dan `beperkt` en minder dan `isolatie`. Zolang die
   vijf een lijst tekenreeksen zijn, kan niemand die zin afdwingen -- en dan gaat
   iemand op een dag `max(niveau)` schrijven, `beschermd` overslaan omdat
   `isolatie` hoger klinkt, en precies de keuze maken die BESTUUR.md grens 6.10
   wil voorkomen.

   HET IS DUS EEN PARTIELE ORDENING EN GEEN GETAL. Een stand is een PAAR:

     trede       normaal < waakzaam < beperkt < isolatie   (een echte ladder)
     beschermd   waar of niet                              (een eigenschap)

   De legacy-modus `beschermd` vult alleen de tweede helft in; over zijn trede
   zegt hij NIETS, en dat is de eerlijke lezing en geen tekortkoming. Vergelijken
   levert daarom vier uitkomsten en niet drie: `strenger`, `zwakker`, `gelijk` en
   `onvergelijkbaar`. Wie die vierde niet apart afhandelt, heeft in de praktijk
   `zwakker` gekozen zonder het op te schrijven.

   HET SAMENVOEGEN OVER DRAGERS (huis, organisatie, identiteit, sessie,
   apparaat) is een JOIN per component en geen maximum over een getal: de trede
   wordt de hoogste BEKENDE trede, `beschermd` wordt waar zodra een van de
   dragers hem waar heeft, en of er een onbekende trede tussen zat blijft
   zichtbaar als `tredeOnbepaald`. Dat vlaggetje is het hele punt van
   SEC-LOCK-004: een onbekende toestand mag nooit als `normaal` doorlopen, maar
   hij mag het huis ook niet platleggen -- hij hoort de aanroeper te dwingen
   dicht te gaan op gevoelige mutaties, en dat kan alleen als hij zichtbaar is.

   DEZE MODULE BESLIST NIETS. Hij rekent. Wie hem laat beslissen, maakt hem tot
   de tweede plek waar de standen wonen. */
'use strict';

/* De echte ladder. Alleen deze vier zijn onderling te vergelijken. */
const LADDER = Object.freeze(['normaal', 'waakzaam', 'beperkt', 'isolatie']);

/* De vijf standen zoals kern/incidentcontrole.js ze op schijf zet, uit elkaar
   getrokken in het paar. `beschermd` heeft met opzet geen trede: hij zegt niets
   over de ladder, en een trede verzinnen zou de enige leugen in dit bestand zijn. */
const MODUS_ALS_PAAR = Object.freeze({
  normaal:   { trede: 'normaal',   beschermd: false },
  waakzaam:  { trede: 'waakzaam',  beschermd: false },
  beperkt:   { trede: 'beperkt',   beschermd: false },
  isolatie:  { trede: 'isolatie',  beschermd: false },
  beschermd: { trede: null,        beschermd: true  }
});

function tredeIndex(t) { return t === null || t === undefined ? -1 : LADDER.indexOf(t); }

/* Leest een opgeslagen modus. Een onbekende waarde wordt NIET stil `normaal`:
   hij komt terug als een paar met een onbekende trede en `beschermd: true`.
   Dat is de veilige kant om fout te gaan die grens 6.10 toelaat -- beschermd
   zet geen enkele schakelaar om, dus een corrupte waarde legt niets plat, maar
   hij loopt ook niet door alsof er niets aan de hand is. */
function ontleed(modus) {
  const paar = MODUS_ALS_PAAR[String(modus)];
  if (paar) return Object.assign({ bekend: true }, paar);
  return { bekend: false, trede: null, beschermd: true, waarom:
    'onbekende stand "' + String(modus).slice(0, 40) + '": hij is niet als normaal gelezen' };
}

/* Vier uitkomsten. `onvergelijkbaar` is geen storing maar een antwoord. */
function vergelijk(a, b) {
  const x = typeof a === 'string' ? ontleed(a) : a;
  const y = typeof b === 'string' ? ontleed(b) : b;
  const ix = tredeIndex(x.trede), iy = tredeIndex(y.trede);
  const tredeOnbekend = ix < 0 || iy < 0;
  const bx = x.beschermd === true, by = y.beschermd === true;
  if (tredeOnbekend) {
    /* Zonder trede valt er alleen over de eigenschap iets te zeggen, en dat is
       niet genoeg voor een oordeel zodra de tredes ook konden verschillen. */
    if (ix === iy && bx === by) return 'gelijk';
    return 'onvergelijkbaar';
  }
  if (ix === iy && bx === by) return 'gelijk';
  if (ix >= iy && bx >= by) return 'strenger';
  if (ix <= iy && bx <= by) return 'zwakker';
  return 'onvergelijkbaar';
}

/* SEC-LOCK-001 in een functie: is de overgang van `van` naar `naar` een
   verlaging? Drie antwoorden, want `onbepaald` mag niet als `nee` tellen. */
function verlaagt(van, naar) {
  const uitslag = vergelijk(naar, van);
  if (uitslag === 'zwakker') return { verlaagt: true, zeker: true, uitslag };
  if (uitslag === 'onvergelijkbaar') return { verlaagt: true, zeker: false, uitslag, waarom:
    'de twee standen zijn niet te ordenen; een niet te ordenen overgang telt als een verlaging ' +
    'tot iemand hem heeft ingedeeld' };
  return { verlaagt: false, zeker: true, uitslag };
}

/* De join over de dragers. Geen maximum over een getal, maar per component. */
function strengste(standen) {
  const paren = (standen || []).filter(s => s !== null && s !== undefined)
    .map(s => (typeof s === 'string' ? ontleed(s) : s));
  if (!paren.length) {
    /* Leeg is niet normaal: er is niets gemeten. Zie SEC-LOCK-004. */
    return { trede: null, beschermd: true, tredeOnbepaald: true, dragers: 0, waarom:
      'er is geen enkele stand aangeleverd; leeg is hier niet hetzelfde als normaal' };
  }
  let ix = -1;
  for (const p of paren) { const i = tredeIndex(p.trede); if (i > ix) ix = i; }
  const onbepaald = paren.some(p => tredeIndex(p.trede) < 0);
  return {
    trede: ix < 0 ? null : LADDER[ix],
    beschermd: paren.some(p => p.beschermd === true),
    /* Waar staat er een stand tussen waarvan de trede niet vaststaat. De trede
       hierboven is dan de hoogste BEKENDE en dus mogelijk te laag. */
    tredeOnbepaald: onbepaald,
    dragers: paren.length
  };
}

/* SEC-LOCK-003: een lagere drager mag een hogere beperking niet neutraliseren.
   Dat volgt uit de join en is hier geen tweede regel maar een controle: wie de
   join vervangt door "de fijnste drager wint", laat deze functie zakken. */
function neutraliseert(ouder, kind) {
  const samen = strengste([ouder, kind]);
  const alleenOuder = typeof ouder === 'string' ? ontleed(ouder) : ouder;
  return vergelijk(samen, alleenOuder) === 'zwakker';
}

module.exports = { LADDER, MODUS_ALS_PAAR, ontleed, vergelijk, verlaagt, strengste, neutraliseert };
