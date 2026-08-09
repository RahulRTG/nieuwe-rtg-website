/* RTG Mall, deelbestand "zoek": DE DISCOVERY-LAAG.

   Een zoekbalk en een plek, en daarachter alles wat RTG te bieden heeft. De
   gebruiker hoeft niet te weten of "scooter huren Ibiza" bij een verhuurzaak,
   een leverancier of een particulier op de Marktplaats vandaan komt -- hij
   ziet ze naast elkaar, met een duidelijk verschil in wie de aanbieder is.

   Wat een zoekopdracht BETEKENT en hoe zwaar iets weegt staat in
   ./zoekweging.js; dit bestand filtert, sorteert en pagineert. Twee
   beslissingen die hier expres zo staan:

   1. LOCATIE FILTERT, MAAR DWINGT NIET. Wie in Ibiza staat en toch iets naar
      zijn huisadres wil laten sturen, moet dat kunnen. De plek is een filter
      dat de gebruiker zelf zet en altijd kan wissen.

   2. NIETS VALT STIL WEG. Een kapotte bron, een geweigerd aanbod-object en
      een filter dat alles wegvangt zijn alle drie zichtbaar in het antwoord
      (`stuk`, `geweigerd`, `totaalVoorFilter`). Een lege Mall die er kapot
      uitziet is beter dan een lege Mall die er rustig uitziet (LAT-regel 5). */

const { coordPaar } = require('../util');
const { lees, relevantie, boost } = require('./zoekweging');
const { filter } = require('./zoekfilters');
const { kaartVan } = require('./kaart');
const { VERDIEPINGEN } = require('./aanbodvorm');

module.exports = (ctx) => {
  const { aanbodAlles, plek: P, stand } = ctx;
  // ctx.db wordt in voorZaak gebruikt om de zaak zelf op te zoeken
  const { bedient, afstandTot, plekkenUit, slugVan } = P;

  /* Zoeken. Zonder zoekwoorden is dit een blader-lijst (alles op deze plek,
     dichtstbij eerst); met zoekwoorden een gerangschikte lijst. */
  function zoek(opt = {}) {
    const { aanbod, stuk, geweigerd } = aanbodAlles();
    const plekken = plekkenUit(aanbod);

    const gelezen = lees(opt.q, plekken, slugVan);
    // de plek: expliciet gekozen wint van de plek die in de zoekzin zat
    const gekozen = opt.plek ? plekken.find(p => p.slug === slugVan(opt.plek)) || null
      : (gelezen.plekSlug ? plekken.find(p => p.slug === gelezen.plekSlug) : null);
    /* Het punt om afstanden vanaf te rekenen: dat van de gebruiker, anders het
       middelpunt van de gekozen plek. Via coordPaar, want een kale Number()
       maakt van een ontbrekende positie stilletjes 0,0 -- en dat ligt in de
       Golf van Guinee, waardoor "in de buurt" iedereen even ver weg zet. */
    const punt = coordPaar((opt.punt || {}).lat, (opt.punt || {}).lng)
      || (gekozen ? gekozen.punt : null);

    /* Tijd als context: waar EN wanneer. Een zaak die pas na jouw vertrek weer
       plek heeft, hoort niet als "beschikbaar" te gelden. De periode stuurt de
       agenda-vraag aan (./stand-agenda.js) en niets anders: er wordt niets
       weggefilterd, want "in deze periode niets vrij" is een antwoord dat je
       wilt zien, geen reden om een zaak te verbergen. */
    const isDatum = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
    const periode = (isDatum(opt.van) || isDatum(opt.tot))
      ? { van: isDatum(opt.van) ? opt.van : null, tot: isDatum(opt.tot) ? opt.tot : null } : null;

    const totaalVoorFilter = aanbod.length;
    // alle filters staan bij elkaar in ./zoekfilters.js, met wat elk wegnam
    const gefilterd = filter(aanbod, opt, {
      bedient, gekozen,
      bewaardeIds: opt.bewaardeIds || null,
      collectieIds: opt.collectieIds || null
    });
    const res = gefilterd.res;

    // hyperlocal: alleen wat binnen zoveel kilometer van het punt ligt
    const binnen = Number(opt.binnenKm) > 0 ? Number(opt.binnenKm) : null;
    let uit = res.map(a => ({ ...a, afstand: afstandTot(a, punt) }));
    if (binnen && punt) {
      const voor = uit.length;
      uit = uit.filter(a => a.afstand != null && a.afstand <= binnen * 1000);
      if (uit.length !== voor) gefilterd.toegepast.push({ filter: 'binnenKm', weggevallen: voor - uit.length });
    }

    const dichtstbij = (a, b) => (a.afstand == null ? 1 : b.afstand == null ? -1 : a.afstand - b.afstand);
    const zoekend = gelezen.woorden.length > 0 || gelezen.typen.length > 0;
    if (zoekend) {
      uit = uit
        .map(a => ({ ...a, relevantie: relevantie(a, gelezen) }))
        .filter(a => a.relevantie > 0)
        .map(a => ({ ...a, score: a.relevantie + boost(a) }));
      uit.sort((a, b) => b.score - a.score || dichtstbij(a, b) || a.titel.localeCompare(b.titel));
    } else {
      uit.sort((a, b) => dichtstbij(a, b) || a.titel.localeCompare(b.titel));
    }

    const per = Math.max(1, Math.min(60, Number(opt.per) || 24));
    const pagina = Math.max(1, Math.min(500, Number(opt.pagina) || 1));
    const totaal = uit.length;

    /* De pagina krijgt er de dure stand bij: het eerstvolgende vrije tijdvak
       en de eerstvolgende tafel komen uit de agenda van de zaak zelf, en die
       vraag je niet duizend keer per zoekopdracht maar hoogstens zestig keer
       (zie de kostenafweging in ./stand.js). */
    /* De zakelijke weergave. Een Business Pass en een zaak kopen op inkoopprijs;
       die staat al in de groothandel en komt via prijsVoor() mee als
       `zakelijkePrijs`. Hier wordt alleen GEKOZEN welke van de twee je ziet --
       er wordt geen tweede prijs berekend (LAT-regel 4). Wie zakelijk kijkt
       ziet het er ook aan: `btw: 'ex'`, want een inkoopprijs zonder die
       vermelding is een verkeerd getal. */
    const zakelijk = !!opt.zakelijk;
    const metPrijs = (a) => (zakelijk && a.zakelijkePrijs)
      ? { ...a, prijs: { ...a.zakelijkePrijs, btw: 'ex' }, consumentPrijs: a.prijs, zakelijk: true }
      : a;

    const bladzijde = stand.verrijk(
      uit.slice((pagina - 1) * per, (pagina - 1) * per + per).map(metPrijs),
      periode
    );

    /* Het vraagbeeld. Alleen bij een ECHTE zoekopdracht van een mens (de route
       zet `noteer`), nooit bij een interne aanroep: anders telt de Mall zijn
       eigen verkeer mee en wijst het vraagbeeld naar binnen. Er gaat per WOORD
       een teller omhoog, zonder enige sleutel naar wie het zocht; zie de kop
       van ./vraagbeeld.js. */
    if (opt.noteer && zoekend && ctx.vraagbeeld) {
      ctx.vraagbeeld.noteer({
        woorden: gelezen.woorden,
        verdieping: opt.verdieping || (uit[0] && uit[0].verdieping) || null,
        plek: gekozen ? gekozen.slug : null,
        treffers: totaal
      });
    }

    return {
      ok: true,
      items: bladzijde,
      totaal, pagina, paginas: Math.max(1, Math.ceil(totaal / per)),
      plek: gekozen, punt, zoekend,
      gelezen: { woorden: gelezen.woorden, typen: gelezen.typen },
      // per verdieping tellen, zodat het scherm "ook gevonden in" kan tonen
      perVerdieping: VERDIEPINGEN.map(v => ({ ...v, aantal: uit.filter(a => a.verdieping === v.id).length }))
        .filter(v => v.aantal > 0),
      periode, zakelijk,
      /* De landen waarin deze treffers liggen. Dit is de stap van een stad
         naar een werelddeel: zonder deze lijst kan een scherm geen landkeuze
         tonen zonder er zelf een te verzinnen. */
      landen: landenUit(uit),
      /* De kaart hoort bij de HELE trefferlijst, niet bij de zichtbare pagina:
         je wilt zien waar de veertig treffers liggen, niet waar de eerste
         vierentwintig liggen. Het is een projectie zonder straatkaart -- zie
         de kop van ./kaart.js. */
      kaart: opt.kaart ? kaartVan(uit, punt) : null,
      // wat elk filter wegnam, zodat een lege Mall zichzelf verklaart
      filters: gefilterd.toegepast,
      totaalVoorFilter, stuk, geweigerd, standbron: stand.bronnen(), valuta: 'EUR'
    };
  }

  // de landen in een trefferlijst, met hun aantal; aanbod zonder land telt niet mee
  function landenUit(lijst) {
    const per = new Map();
    for (const a of lijst) {
      if (!a.plek.land) continue;
      per.set(a.plek.land, (per.get(a.plek.land) || 0) + 1);
    }
    return [...per.entries()].map(([land, aantal]) => ({ land, aantal }))
      .sort((a, b) => b.aantal - a.aantal || a.land.localeCompare(b.land));
  }

  // de plekken waar iets te doen is, met hun aantal
  function plekken() {
    const { aanbod, stuk } = aanbodAlles();
    return { ok: true, plekken: plekkenUit(aanbod), landbron: P.landbron(), stuk };
  }

  /* De Mall-home voor een plek. Bewust kort: de verdiepingen met wat er staat,
     een handvol dingen die vandaag kunnen, en wat er van leden zelf ligt.
     Geen oneindige lijst en geen kunstmatige urgentie -- "nog 1 beschikbaar!"
     staat er alleen als het waar is en uit de bron komt. */
  function home(opt = {}) {
    const d = zoek({ plek: opt.plek, punt: opt.punt, per: 60, pagina: 1 });
    const items = d.items;
    const partners = new Set(items.filter(a => a.aanbieder.code).map(a => a.aanbieder.code));
    return {
      ok: true,
      plek: d.plek, punt: d.punt,
      verdiepingen: d.perVerdieping,
      vandaag: items.filter(a => a.beschikbaar && a.beschikbaar.hard).slice(0, 6),
      marktplaats: items.filter(a => a.aanbieder.soort === 'particulier').slice(0, 4),
      reizen: items.filter(a => a.type === 'reis').slice(0, 4),
      partners: partners.size,
      totaal: d.totaal,
      stuk: d.stuk, geweigerd: d.geweigerd,
      opmerking: d.plek
        ? 'Alles van RTG in en om ' + d.plek.stad + '. Wie de aanbieder is staat bij elk aanbod; RTG staat niet garant voor wat een ander levert.'
        : 'Kies een plek om de Mall op jouw omgeving te zetten, of zoek meteen.'
    };
  }

  ctx.mallZoek = zoek;
  return { mallZoek: zoek, mallPlekken: plekken, mallHome: home };
};
