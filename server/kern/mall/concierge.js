/* RTG Mall, deelbestand "concierge": EEN ZIN IN, EEN ZOEKOPDRACHT UIT.

   "Ik zoek morgenavond een tafel voor vier op Ibiza, iets rustigs." Dat is geen
   zoekopdracht maar een zin, en de zoekbalk maakt er hoogstens vier losse
   woorden van.

   ================== DE ENIGE VEILIGE VORM ==================

   Het model doet HIER precies een ding: het vertaalt de zin naar FILTERS. Geen
   antwoordtekst, geen aanbevelingen, geen samenvatting van wat er te koop is.
   De filters gaan daarna door de gewone zoeklaag, en het antwoord wordt
   opgebouwd uit de ECHTE treffers.

   Dat is geen omslachtigheid, het is de hele beveiliging. Een model dat mag
   antwoorden over aanbod, verzint vroeg of laat een restaurant, een prijs of
   een beschikbaarheid; en juist bij de drie dingen die dit huis niet mag doen
   -- een boeking bevestigen, een echt hotelmerk als partner opvoeren, of
   toegang tot een pas beloven -- is de schade niet terug te draaien. Door het
   model geen zinnen te laten produceren die de gebruiker leest, kan het die
   fouten niet maken. De regel staat dus in de VORM en niet in de prompt
   (LAT-regel 6: een belofte in tekst is een belofte in code).

   ================== WAT ER NOG MEER IN CODE STAAT ==================

   1. ELK FILTER WORDT GECONTROLEERD. Een verdieping of type dat niet bestaat
      wordt weggegooid EN gemeld in `genegeerd` -- niet stil overgeslagen, want
      dan lijkt een half begrepen vraag op een goed begrepen vraag.
   2. VRAGEN OVER EEN PAS GAAN NIET NAAR HET MODEL. Wie vraagt hoe hij aan een
      Lifestyle of Business Pass komt, krijgt een vast antwoord dat naar een
      mens verwijst. De AI mag zulke toegang nooit beloven of verlenen
      (CLAUDE.md), en de veiligste manier om dat te garanderen is de vraag niet
      stellen.
   3. ZONDER SLEUTEL GEEN VERZONNEN ANTWOORD. Is er geen AI beschikbaar, dan
      valt de concierge terug op de gewone zoeklaag met de zin als zoektekst --
      en zegt dat erbij. Doen alsof er iemand meedacht is erger dan het niet
      hebben. */

const { VERDIEPINGEN, TYPEN } = require('./aanbodvorm');

/* Vragen die nooit naar het model gaan. Bewust ruim: liever een keer te vaak
   naar een mens verwijzen dan een keer een pas beloven. */
const PASVRAAG = new RegExp([
  '\\b(lifestyle|business)\\s*pass\\b',
  '\\bpas\\s+(krijgen|aanvragen|kopen)\\b',
  '\\bballotage\\b', '\\buitnodiging\\b',
  '\\bde\\s+salon\\b',
  /* "toegang" alleen als het in dezelfde adem over een pas, de Salon of het
     lidmaatschap gaat. Kaal zou het ook "beachclub met toegang tot het strand"
     wegvangen, en dan verwijst de concierge een gewone zoekvraag naar een mens. */
  '\\btoegang\\b[^.]{0,40}\\b(pas|salon|lid|lidmaatschap|rtg)\\b'
].join('|'), 'i');
const PAS_ANTWOORD = 'Over de Lifestyle Pass en de Business Pass beslist RTG zelf, in een gesprek. Ik kan er niets over toezeggen en ook niets in gang zetten. Wat ik wel kan: u helpen vinden wat er met uw huidige pas te doen is.';

const SYSTEEM = [
  'U vertaalt een Nederlandse zin naar zoekfilters voor een marktplaats.',
  'Antwoord met UITSLUITEND JSON, zonder uitleg en zonder opmaak.',
  'Velden (laat weg wat niet in de zin staat, raad nooit):',
  '  woorden   string, de kern van wat gezocht wordt',
  '  plek      string, alleen als er een plaatsnaam in staat',
  '  verdieping  een van: ' + VERDIEPINGEN.map(v => v.id).join(', '),
  '  type      een van: ' + Object.keys(TYPEN).join(', '),
  '  van, tot  datum als JJJJ-MM-DD, alleen bij een concrete datum',
  '  openNu    true als er "nu" of "op dit moment" staat',
  '  binnenKm  getal, alleen bij "in de buurt" of een afstand',
  'Verzin geen zaken, prijzen of beschikbaarheid. U levert alleen filters.'
].join('\n');

// wat er uit het model komt is invoer, geen waarheid: alles wordt nagelopen
function schoonFilters(rauw) {
  const uit = {}, genegeerd = [];
  const o = (rauw && typeof rauw === 'object') ? rauw : {};
  const str = (v, n) => (typeof v === 'string' && v.trim()) ? v.replace(/[<>]/g, '').trim().slice(0, n) : null;

  if (str(o.woorden, 120)) uit.q = str(o.woorden, 120);
  if (str(o.plek, 40)) uit.plek = str(o.plek, 40);
  if (o.verdieping != null) {
    if (VERDIEPINGEN.some(v => v.id === o.verdieping)) uit.verdieping = o.verdieping;
    else genegeerd.push({ veld: 'verdieping', waarde: String(o.verdieping).slice(0, 40), reden: 'bestaat niet' });
  }
  if (o.type != null) {
    if (TYPEN[o.type]) uit.type = o.type;
    else genegeerd.push({ veld: 'type', waarde: String(o.type).slice(0, 40), reden: 'bestaat niet' });
  }
  for (const veld of ['van', 'tot']) {
    if (o[veld] == null) continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(o[veld]))) uit[veld] = String(o[veld]);
    else genegeerd.push({ veld, waarde: String(o[veld]).slice(0, 40), reden: 'geen datum' });
  }
  if (o.openNu === true) uit.openNu = true;
  const km = Number(o.binnenKm);
  if (Number.isFinite(km) && km > 0 && km <= 200) uit.binnenKm = km;
  else if (o.binnenKm != null) genegeerd.push({ veld: 'binnenKm', waarde: String(o.binnenKm).slice(0, 20), reden: 'geen bruikbare afstand' });
  return { filters: uit, genegeerd };
}

// JSON uit een antwoord peuteren zonder te struikelen over ```-omhulsels
function leesJson(t) {
  if (!t) return null;
  const s = String(t);
  const i = s.indexOf('{'), j = s.lastIndexOf('}');
  if (i < 0 || j <= i) return null;
  try { return JSON.parse(s.slice(i, j + 1)); } catch (e) { return null; }
}

module.exports = (ctx) => {
  const { anthropic } = ctx;

  /* Het antwoord wordt OPGEBOUWD uit de treffers, niet geschreven door het
     model. Daarom kan er geen bevestiging, geen prijs en geen merknaam in staan
     die niet uit de Mall zelf komt. */
  function trefferZin(d, gebruikteAI) {
    if (!d.totaal) {
      return 'Hier vind ik niets voor. Dat kan aan de plek of de periode liggen; u kunt de vraag ook als aanvraag plaatsen, dan zien de zaken hem.';
    }
    const waar = d.plek ? ' in en om ' + d.plek.stad : '';
    const vakken = (d.perVerdieping || []).slice(0, 3).map(v => v.label.toLowerCase()).join(', ');
    return d.totaal + (d.totaal === 1 ? ' resultaat' : ' resultaten') + waar
      + (vakken ? ', vooral in ' + vakken : '') + '.'
      + (gebruikteAI ? '' : ' (Ik heb uw zin als gewone zoekopdracht gelezen.)');
  }

  async function vraag(zin, sessieContext) {
    const tekstIn = String(zin || '').replace(/[<>]/g, '').trim().slice(0, 300);
    if (tekstIn.length < 3) return { status: 400, error: 'Stel uw vraag in een korte zin.' };

    /* De pasvraag gaat niet naar het model. Dit staat VOOR de AI-aanroep, zodat
       er geen enkele weg is waarlangs een model hier iets over kan zeggen. */
    if (PASVRAAG.test(tekstIn)) {
      return { ok: true, soort: 'doorverwijzing', antwoord: PAS_ANTWOORD,
        naarMens: true, treffers: null, filters: null, gebruikteAI: false };
    }

    let filters = null, genegeerd = [], gebruikteAI = false;
    if (anthropic) {
      const { tekst } = require('../../ai');
      const rauw = await tekst(anthropic, SYSTEEM, tekstIn, { max: 300 });
      const gelezen = leesJson(rauw);
      if (gelezen) {
        const s = schoonFilters(gelezen);
        filters = s.filters; genegeerd = s.genegeerd; gebruikteAI = true;
      }
    }
    /* Geen sleutel, geen antwoord, of onleesbare JSON: de zin gaat als gewone
       zoektekst door dezelfde zoeklaag. Dat werkt, en het is eerlijk. */
    if (!filters) filters = { q: tekstIn };

    // de plek van het lid geldt alleen als de zin er zelf geen noemt
    const c = sessieContext || {};
    const opdracht = Object.assign({}, filters, {
      plek: filters.plek || c.plek || null,
      punt: c.punt || null,
      zakelijk: c.tier === 'business',
      per: 12, pagina: 1,
      // dit is een mens die zoekt; het vraagbeeld telt de woorden mee
      noteer: true
    });
    const d = ctx.mallZoek(opdracht);

    return {
      ok: true, soort: 'zoekopdracht',
      vraag: tekstIn,
      filters: opdracht,
      genegeerd,
      gebruikteAI,
      antwoord: trefferZin(d, gebruikteAI),
      treffers: d.items,
      totaal: d.totaal,
      perVerdieping: d.perVerdieping,
      plek: d.plek,
      /* Twee regels die er altijd bij horen. De eerste omdat een concierge die
         een lijst toont, makkelijk voor een boeking wordt aangezien; de tweede
         omdat de gebruiker hoort te weten dat de tekst hierboven uit de
         resultaten is opgeteld en niet door een model is geschreven. */
      opmerking: 'Ik zoek alleen; boeken en betalen doet u bij de partij zelf, met haar eigen bevestiging.',
      hoe: 'De zin is vertaald naar zoekfilters; wat u ziet komt uit de Mall en niet uit een tekstmodel.'
    };
  }

  const api = { vraag, schoonFilters, PAS_ANTWOORD };
  ctx.concierge = api;
  return { mallConcierge: api };
};

module.exports.PASVRAAG = PASVRAAG;
module.exports.schoonFilters = schoonFilters;
module.exports.leesJson = leesJson;
