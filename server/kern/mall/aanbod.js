/* RTG Mall, deelbestand "aanbod": HET UNIVERSELE AANBOD-OBJECT.

   De Mall was een winkel met spullen. Dit bestand maakt er de commerciele
   voorkant van heel RTG van: alles wat een lid kan kopen, boeken, huren,
   reserveren, aanvragen of ontdekken krijgt hier EEN vorm, zodat er EEN
   zoekmachine overheen kan.

   Wat dit bestand met opzet NIET doet: de domeinen vervangen. Het reisbureau
   blijft reizen beheren, logies blijft verblijven beheren, de markt blijft
   advertenties beheren. Dit is een LEESLAAG die hun rijen projecteert op een
   gedeelde vorm. Er wordt hier niets geschreven, niets besteld en niets
   bevestigd -- de knop wijst naar de plek waar dat al gebeurt (`pagina`).

   Waarom de bronnen db.data lezen en niet de kernmodules aanroepen: de Mall
   wordt in kernlaag2 gebouwd en het reisbureau, logies, de foodcourt en de
   markt komen daarna. Late binding voor acht bronnen zou acht kansen op een
   stille lege lijst geven (LAT-regel 3). Waar een domein een eigen projectie
   heeft die MEER is dan de rijen zelf, wordt die projectie gedeeld als pure
   functie en hier aangeroepen -- nooit overgeschreven (LAT-regel 4):
     - reizen        kern/reisbureau.js  -> reisAanbod(db)
     - marktplaats   kern/markt/openbaar -> advertentieOpenbaar(ad)
   De overige bronnen lezen rijen die ze zelf al zo in de database zetten.

   De vorm (typen, verdiepingen) staat in ./aanbodvorm.js, de bronnen uit de
   zaken zelf in ./aanbodzaken.js en de RTG-brede bronnen (reizen, verblijven,
   marktplaats, thuis) in ./aanbodrtg.js. Hier staan de normalisator, de
   gedeelde hulp voor de bronnen, en de orkestratie. */

const { TYPEN, VERDIEPING_IDS, verdiepingVan } = require('./aanbodvorm');

module.exports = (ctx) => {
  const { db, verborgen, plek } = ctx;
  const { plekVan, bereikVan, MARKT_BEREIK, RTG_BEREIK } = plek;

  const getal = (v) => Math.max(0, Number(v) || 0);
  const tekst = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 200);

  /* De normalisator. Elk aanbod-object komt hier langs, zodat een bron nooit
     stilletjes een half object kan afleveren. Een aanbod zonder id, titel of
     type is een fout in de bron en wordt geweigerd -- niet stil overgeslagen:
     de weigeringen komen als `geweigerd` mee terug (LAT-regel 5). */
  const geweigerd = [];
  function aanbod(o) {
    const type = TYPEN[o.type] ? o.type : null;
    const id = tekst(o.id, 80);
    const titel = tekst(o.titel, 140);
    if (!type || !id || !titel) {
      geweigerd.push({ bron: o.bron || '?', reden: !type ? 'type' : (!id ? 'id' : 'titel') });
      return null;
    }
    const genre = tekst(o.genre, 40) || null;
    return {
      id, bron: tekst(o.bron, 30), type, typeLabel: TYPEN[type].label,
      titel, uitleg: o.uitleg ? tekst(o.uitleg, 220) : null,
      aanbieder: {
        soort: o.aanbieder.soort, code: o.aanbieder.code || null,
        naam: tekst(o.aanbieder.naam, 80), status: o.aanbieder.status || null
      },
      plek: o.plek, bereik: o.bereik,
      prijs: o.prijs || null,
      // de zakelijke prijs reist mee; zoek.js kiest welke er getoond wordt
      zakelijkePrijs: o.zakelijkePrijs || null,
      /* `open` is de stand uit de Supplier OS: true, false of null. Null is met
         opzet geen "open" -- zie de kop van ./stand.js. */
      open: o.open || null,
      beschikbaar: o.beschikbaar || null,
      cta: o.cta || TYPEN[type].cta,
      pagina: o.pagina,
      verdieping: VERDIEPING_IDS.includes(o.verdieping) ? o.verdieping : verdiepingVan(genre, type),
      genre, genreLabel: o.genreLabel || null,
      kenmerken: (o.kenmerken || []).filter(Boolean).map(k => tekst(k, 40)).slice(0, 6)
    };
  }
  const prijs = (bedrag, eenheid, vanaf) => ({ bedrag: getal(bedrag), eenheid: eenheid || 'per stuk', valuta: 'EUR', vanaf: !!vanaf });

  /* De verificatiestand van een aanbieder. Deze labels zeggen wat RTG over de
     aanbieder WEET, en met opzet niets over de kwaliteit van het aanbod --
     "RTG Partner" is een contract, geen keurmerk, en mag dus ook nooit als
     keurmerk worden gepresenteerd (zie de tekst in de Mall zelf). */
  function verificatieStand(s) {
    if (!s) return null;
    if (s.mall && s.mall.partner) return 'RTG Partner';
    if (s.settings && s.settings.ondernemerOs) return 'RTG Business';
    return 'RTG Verified';
  }

  const zaakPlek = (s) => plekVan({ stad: s.city, land: s.country, punt: s.loc, label: (s.loc || {}).label });
  const zichtbareZaken = () => (db.data.suppliers || []).filter(s => s && !verborgen(s));
  const genreLabel = (g) => ((db.data.supplierTypes || {})[g] || {}).label || g;

  const hulp = { aanbod, prijs, getal, tekst, status: verificatieStand, zaakPlek, zichtbareZaken, genreLabel, bereikVan, plekVan, RTG_BEREIK };
  const zaken = require('./aanbodzaken')(ctx, hulp);
  const breed = require('./aanbodrtg')(ctx, hulp);

  /* Alle bronnen op een rij, zodat te zien is wat de Mall WEL en NIET kent;
     een domein dat hier niet staat is in de Mall niet vindbaar, en dat is dan
     een gat met een naam in plaats van een stilte. */
  const BRONNEN = [
    ['reisbureau', breed.bronReizen], ['logies', breed.bronVerblijven], ['foodcourt', zaken.bronEten],
    ['retail', zaken.bronRetail], ['eigen-merk', zaken.bronEigenMerk], ['boerderij', zaken.bronBoerderij],
    ['dienstenplein', zaken.bronDiensten], ['mobiliteit', zaken.bronVervoer], ['marktplaats', breed.bronMarkt],
    ['thuis', breed.bronThuis], ['groothandel', breed.bronGroothandel]
  ];

  /* Een bron die omvalt mag de Mall niet meenemen, maar ook niet stil
     verdwijnen: de fout komt als `stuk` mee terug en de Mall toont hem. */
  function alles() {
    geweigerd.length = 0;
    const out = [], stuk = [];
    for (const [naam, fn] of BRONNEN) {
      try { out.push(...fn()); }
      catch (e) { stuk.push({ bron: naam, fout: String((e && e.message) || e).slice(0, 200) }); }
    }
    return { aanbod: out, stuk, geweigerd: geweigerd.slice(0, 50) };
  }

  ctx.aanbodAlles = alles;
  return { aanbodAlles: alles, MALL_BRONNEN: BRONNEN.map(b => b[0]) };
};
