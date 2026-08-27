/* ============================================================================
   DE AFREKENING -- een mand in, EEN AFREKENING PER VERKOPER uit.

   DE GRENS DIE DIT BESTAND DRAAGT staat in COMMERCE.md par. 5 en komt uit
   kern/mall/bestellingen.js, waar hij al jaren stond: er is bewust geen knop
   "betaal alles", want achter die regels zitten verschillende partijen met
   verschillende bevestigingen, en een enkele knop zou een belofte doen die
   niemand van hen heeft gegeven.

   Een universele mand mag dus bestaan -- vier verkopers in een lijst is voor de
   koper een verbetering -- maar hij valt hier uiteen in een afrekening PER
   verkoper, elk met zijn eigen bevestigbaarheid en zijn eigen blokkades. Wat er
   nooit uitkomt is een samengesteld "totaal te bevestigen". Het totaal dat hier
   wel uit komt is een OPTELSOM OM TE TONEN, en het draagt zijn eigen waarschuwing
   mee (`samenBevestigen: false` met de reden). Dat is het verschil tussen
   informeren en beloven.

   DE PRIJS KOMT NOOIT UIT DE BROWSER. De invoer is (koopbaarId, aantal) en
   niets anders. Stuurt een client toch een bedrag mee, dan wordt dat niet
   genegeerd maar GEMELD: stille negatie leert een integrator nooit dat hij iets
   doet wat niet werkt, en die komt er dan pas achter als het bedrag een keer
   afwijkt (LAT-regel 5). Dit is ook precies wat routes/gast/checkout-buiten.js
   al deed -- "gelooft geen prijs uit de browser" -- nu voor alle verkopers.

   HET TARIEF KOMT UIT kern/fiscaal/tarief.js EN NERGENS ANDERS. Dat bestand
   bestaat omdat er ooit twee plekken waren die het btw-tarief vasthielden en het
   oneens waren: dezelfde maaltijd op Ibiza kostte in de boekhouding 10% en op de
   bon 9%, jarenlang, zonder dat iemand wist welke klopte. Een derde plek zou
   dezelfde fout een derde keer maken.

   BRUTO IS INCLUSIEF, en de splitsing gaat zoals kern/fiscaal/digitaal.js hem
   doet: de btw wordt eruit gerekend en niet erbij opgeteld. Een getoonde prijs
   is wat de koper betaalt.
   ========================================================================== */
'use strict';

/* HET BEDRAG WORDT HIER NIET OPNIEUW GELEZEN. `bedrag` staat in EURO'S en
   `vanaf` is een vlag en geen bedrag -- twee dingen die deze laag allebei een
   keer verkeerd om heeft gehad, en een tweede lezer zou ze een tweede keer
   verkeerd om kunnen krijgen (LAT-regel 4). De uitleg staat bij de bron in
   ./koopbaar.js. */

module.exports = ({ tariefVan, basisCat, zaakVan, capsVan }) => {
  /* Een regel wordt een afrekenregel in ./afrekenregel.js -- daar staat de
     hele afweging per regel; hier het optellen per verkoper. */
  const { regelVan } = require('./afrekenregel')();

  /* De btw uit een BRUTO bedrag, met het tarief van deze zaak en deze categorie.
     Onbekend tarief geeft null en geen nul: nul procent is een tarief, onbekend
     is een weigering. Zie splitsBruto in kern/fiscaal/digitaal.js, dat om
     dezelfde reden weigert in plaats van terug te vallen. */
  function btwUit(brutoCenten, zaak) {
    if (!zaak) return null;
    let procent = null;
    try { procent = tariefVan(zaak, basisCat(zaak, capsVan ? capsVan(zaak) : [])); } catch (e) { procent = null; }
    if (!Number.isFinite(Number(procent))) return null;
    const p = Number(procent);
    const btw = Math.floor(brutoCenten - (brutoCenten / (1 + p / 100)));
    return { tariefProcent: p, btwCenten: btw, nettoCenten: brutoCenten - btw };
  }

  /* De hoofdingang. `regels` is [{koopbaarId, aantal}]; `koopbaarVan` levert het
     koopbaar bij een id (de graaf doet dat, zie ./graaf.js). */
  function reken(regels, koopbaarVan) {
    const wensen = Array.isArray(regels) ? regels.slice(0, 200) : [];
    const geweigerd = [];
    /* Een meegestuurd bedrag is geen invoer maar een misverstand, en het wordt
       benoemd. Zie de kop: stil negeren laat een integrator in de waan. */
    const genegeerd = wensen.some(w => w && (w.centen != null || w.prijs != null || w.totaalCenten != null))
      ? 'Er zijn bedragen meegestuurd. Die zijn niet gebruikt: de prijs komt van de server.' : null;

    const perVerkoper = new Map();
    for (const w of wensen) {
      const uit = regelVan(w, koopbaarVan);
      if (uit.fout) { geweigerd.push(uit.fout); continue; }
      const code = (uit.aanbieder && uit.aanbieder.code) || '__rtg';
      if (!perVerkoper.has(code)) {
        perVerkoper.set(code, { aanbiederCode: uit.aanbieder ? uit.aanbieder.code : null,
          aanbiederNaam: (uit.aanbieder && uit.aanbieder.naam) || 'RTG', regels: [] });
      }
      perVerkoper.get(code).regels.push(uit.regel);
    }

    const afrekeningen = [...perVerkoper.values()].map(a => {
      const bruto = a.regels.reduce((n, r) => n + r.totaalCenten, 0);
      const zaak = a.aanbiederCode && zaakVan ? zaakVan(a.aanbiederCode) : null;
      const btw = btwUit(bruto, zaak);
      const blokkades = a.regels.filter(r => r.blokkade).map(r => ({ titel: r.titel, reden: r.blokkade }));
      return Object.assign(a, {
        brutoCenten: bruto,
        /* Geen tarief betekent geen btw-regel en geen verzonnen nul. De
           afrekening blijft bevestigbaar: de zaak weet zelf wat ze afdraagt, en
           een onbekend tarief is geen reden om een koper tegen te houden. Wel
           staat het er, zodat een boekhouding het ziet. */
        btw: btw ? { tariefProcent: btw.tariefProcent, btwCenten: btw.btwCenten, nettoCenten: btw.nettoCenten } : null,
        btwOnbekend: btw ? null : 'Voor deze verkoper is geen btw-tarief vast te stellen; het bedrag staat bruto.',
        totaalCenten: bruto,
        bevestigbaar: blokkades.length === 0,
        /* Gebundeld per pagina en niet als een enkele link: de regels van EEN
           verkoper kunnen op twee plekken worden bevestigd (een tafel in de
           foodcourt, een artikel in de Mall). Dat zijn dan twee deuren, en die
           verzwijgen zou hier een derde soort belofte maken. */
        bevestigBij: [...new Set(a.regels.map(r => r.pagina).filter(Boolean))],
        blokkades
      });
    });

    return {
      ok: true,
      valuta: 'EUR',
      afrekeningen,
      /* Een optelsom OM TE TONEN. Zie de kop: dit is geen bedrag dat iemand in
         een keer kan bevestigen, en het zegt dat zelf. */
      toonTotaalCenten: afrekeningen.reduce((n, a) => n + a.totaalCenten, 0),
      samenBevestigen: false,
      samenReden: afrekeningen.length > 1
        ? 'Deze mand loopt over ' + afrekeningen.length + ' verkopers. Elk bevestigt zijn eigen deel; RTG bevestigt niets namens hen.'
        : null,
      geweigerd,
      genegeerd
    };
  }

  return { reken, btwUit };
};
