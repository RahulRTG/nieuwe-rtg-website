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

    let res = aanbod;
    const totaalVoorFilter = res.length;
    if (gekozen) res = res.filter(a => bedient(a, gekozen));
    if (opt.verdieping) res = res.filter(a => a.verdieping === String(opt.verdieping));
    if (opt.type) res = res.filter(a => a.type === String(opt.type));
    if (opt.aanbieder) res = res.filter(a => a.aanbieder.soort === String(opt.aanbieder));
    if (Number(opt.maxPrijs) > 0) res = res.filter(a => a.prijs && a.prijs.bedrag <= Number(opt.maxPrijs));
    /* "Nu open": alleen wat de zaak zelf als open opgeeft. Een zaak zonder
       vastgelegde openingstijden (open === null) valt hier weg en wordt NIET
       als open meegeteld -- iemand voor niets door de regen sturen is erger
       dan een treffer missen. */
    if (opt.openNu) res = res.filter(a => a.open && a.open.open === true);
    // en "uitverkocht" hoort niet in een lijst waar je iets wilt kopen
    if (opt.opVoorraad) res = res.filter(a => a.beschikbaar && !a.beschikbaar.uit);

    // hyperlocal: alleen wat binnen zoveel kilometer van het punt ligt
    const binnen = Number(opt.binnenKm) > 0 ? Number(opt.binnenKm) : null;
    let uit = res.map(a => ({ ...a, afstand: afstandTot(a, punt) }));
    if (binnen && punt) uit = uit.filter(a => a.afstand != null && a.afstand <= binnen * 1000);

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
    const bladzijde = stand.verrijk(uit.slice((pagina - 1) * per, (pagina - 1) * per + per));

    return {
      ok: true,
      items: bladzijde,
      totaal, pagina, paginas: Math.max(1, Math.ceil(totaal / per)),
      plek: gekozen, punt, zoekend,
      gelezen: { woorden: gelezen.woorden, typen: gelezen.typen },
      // per verdieping tellen, zodat het scherm "ook gevonden in" kan tonen
      perVerdieping: VERDIEPINGEN.map(v => ({ ...v, aantal: uit.filter(a => a.verdieping === v.id).length }))
        .filter(v => v.aantal > 0),
      totaalVoorFilter, stuk, geweigerd, standbron: stand.bronnen(), valuta: 'EUR'
    };
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

  /* "Zo staat u in de Mall" -- de andere kant van de koppeling.

     Een ondernemer werkt in zijn eigen systeem en ziet nooit wat daar aan de
     Mall-kant van terechtkomt. Dat is precies waar stille drift ontstaat: een
     zaak die denkt dat ze vindbaar is terwijl haar artikelen op nul staan, of
     die nooit in "Nu open" verschijnt omdat er geen openingstijden zijn
     ingevuld. Deze weergave is dus geen dashboard met cijfers maar een
     spiegel: wat toont de Mall van u, en wat mist er nog.

     Bewust GEEN zoekvragen, bezoekersaantallen of conversie: die horen bij een
     leverancierdashboard en dat is een eigen beslissing met een eigen
     privacyvraag. Dit toont alleen wat er van deze zaak zelf al bekend is. */
  function voorZaak(code) {
    const s = (ctx.db.data.suppliers || []).find(x => x.code === String(code || ''));
    if (!s) return { status: 404, error: 'Zaak niet gevonden.' };
    const { aanbod } = aanbodAlles();
    const mijn = aanbod.filter(a => a.aanbieder.code === s.code);
    const st = stand.openNu(s);
    const uren = stand.vakUrenVan(s);
    const uit = mijn.filter(a => a.beschikbaar && a.beschikbaar.uit);

    /* Wat er ontbreekt, met de reden erbij. Elke regel is iets dat de
       ondernemer zelf in zijn eigen systeem kan oplossen; een lijst met
       verwijten zonder handeling erachter hoort hier niet. */
    const ontbreekt = [];
    if (st.open === null) ontbreekt.push({ wat: 'openingstijden', gevolg: 'U verschijnt niet in het filter "Nu open".', waar: 'uw agenda' });
    if (!mijn.length) ontbreekt.push({ wat: 'aanbod', gevolg: 'U staat wel in de Mall, maar zonder iets dat te vinden is.', waar: 'uw kaart, artikelen of diensten' });
    if (uit.length) ontbreekt.push({ wat: 'voorraad', gevolg: uit.length + (uit.length === 1 ? ' artikel staat' : ' artikelen staan') + ' als uitverkocht in de Mall.', waar: 'uw voorraad' });
    if (!(s.mall && s.mall.bereik)) ontbreekt.push({ wat: 'werkgebied', gevolg: 'De Mall neemt aan wat uw genre meebrengt; u staat mogelijk in te weinig of te veel plaatsen.', waar: 'uw Mall-instellingen' });

    return {
      ok: true,
      zaak: { code: s.code, naam: s.name, stad: s.city || null, genre: s.type },
      aanbod: mijn.map(a => ({ id: a.id, titel: a.titel, type: a.type, typeLabel: a.typeLabel,
        verdieping: a.verdieping, prijs: a.prijs, beschikbaar: a.beschikbaar, pagina: a.pagina })),
      aantal: mijn.length,
      stand: { open: st, uren: uren || null, neemtBestellingen: stand.neemtAan(s, 'orders'), neemtReserveringen: stand.neemtAan(s, 'reserveren') },
      bereik: P.bereikVan(s),
      ontbreekt,
      bron: stand.bronnen(),
      opmerking: 'Wat u in uw eigen systeem verandert, verandert hier mee: de Mall leest dezelfde rijen. Er is geen tweede administratie.'
    };
  }

  ctx.mallZoek = zoek;
  return { mallZoek: zoek, mallPlekken: plekken, mallHome: home, mallVoorZaak: voorZaak };
};
