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

const { kan, waaromNiet } = require('./vermogens');
/* HET BEDRAG WORDT HIER NIET OPNIEUW GELEZEN. `bedrag` staat in EURO'S en
   `vanaf` is een vlag en geen bedrag -- twee dingen die deze laag allebei een
   keer verkeerd om heeft gehad, en een tweede lezer zou ze een tweede keer
   verkeerd om kunnen krijgen (LAT-regel 4). De uitleg staat bij de bron in
   ./koopbaar.js. */
const { vastBedragCenten: centenVan } = require('./koopbaar');

module.exports = ({ tariefVan, basisCat, zaakVan, capsVan }) => {

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

  /* Een regel wordt een afrekenregel, of hij wordt geweigerd met een reden. Er
     bestaat geen derde uitkomst: een regel die stilletjes uit de mand valt, is
     een mand die minder kost dan de koper dacht. */
  function regelVan(wens, koopbaarVan) {
    const id = String((wens && wens.koopbaarId) || '');
    const aantal = Math.max(1, Math.min(999, parseInt(wens && wens.aantal, 10) || 1));
    const k = id ? koopbaarVan(id) : null;
    if (!k) return { fout: { koopbaarId: id, reden: 'Dit aanbod bestaat niet (meer).' } };
    if (!kan(k, 'bevestig')) {
      const uitleg = (k.ontbreekt || []).find(o => o.vermogen === 'bevestig');
      return { fout: { koopbaarId: id, titel: k.titel, reden: uitleg ? uitleg.reden : waaromNiet(k, 'bevestig') } };
    }
    /* GEEN PRIJS IS NIET HETZELFDE ALS GEEN AFREKENING. Een koopbaar dat wel
       `bevestig` heeft maar geen `prijs`, is een gratis bevestiging -- een tafel,
       een bezichtiging, een afspraak. Dat is geen randgeval maar wat de meting
       afdwong: 25 domeinen bevestigen zonder prijs (COMMERCE.json), en daarom
       hangt `bevestig` in ./vermogenlijst.js niet meer aan `prijs`.

       Deze regel weigeren zou die correctie meteen weer ongedaan maken: dan valt
       een tafel alsnog uit de mand, nu een laag lager. Hij wordt dus een regel
       van nul.

       Wat WEL wordt geweigerd is de tegenstrijdigheid: een koopbaar dat `prijs`
       verklaart en er geen draagt. Dat is geen gratis ding maar een kapotte rij,
       en die hoort niet stil op nul te eindigen. */
    const stuk = kan(k, 'prijs') ? centenVan(k.prijs) : 0;
    if (stuk == null) return { fout: { koopbaarId: id, titel: k.titel, reden: 'Dit aanbod verklaart een prijs maar draagt geen bedrag; de server rekent niets uit dat er niet staat.' } };

    /* Beschikbaarheid weegt alleen mee als het koopbaar dat vermogen HEEFT. Een
       ding zonder gemeten voorraad tegenhouden zou stilte als "op" uitleggen, en
       dat is de spiegelbeeldige fout van stilte als "beschikbaar" uitleggen. */
    let blokkade = null;
    if (kan(k, 'beschikbaarheid') && k.beschikbaar && Number.isFinite(Number(k.beschikbaar.voorraad))) {
      const vrij = Number(k.beschikbaar.voorraad);
      if (vrij <= 0) blokkade = 'Dit is op.';
      else if (aantal > vrij) blokkade = 'Er zijn er nog ' + vrij + ' van.';
    }
    return {
      regel: {
        koopbaarId: k.id, titel: k.titel, type: k.type, bron: k.bron,
        aantal, stukCenten: stuk, totaalCenten: stuk * aantal,
        /* Uitdrukkelijk, zodat een scherm "gratis" kan zetten in plaats van
           "0,00" -- dat leest als een fout in de prijs. */
        gratis: !kan(k, 'prijs'),
        levert: kan(k, 'lever'), annuleerbaar: kan(k, 'annuleer'), retourneerbaar: kan(k, 'retour'),
        blokkade
      },
      aanbieder: k.aanbieder || null
    };
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
