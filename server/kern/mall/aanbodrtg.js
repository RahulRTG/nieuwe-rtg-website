/* RTG Mall, deelbestand "aanbodrtg": DE RTG-BREDE BRONNEN.

   Aanbod dat niet aan een enkele leverancier hangt: de samengestelde reizen
   van het reisbureau, de verblijven, de Marktplaats van de leden onderling en
   de commerciele verhuur van RTG Thuis. Twee ervan lenen de projectie van hun
   eigen domein (reisAanbod, advertentieOpenbaar) in plaats van hem over te
   schrijven; zie de kop van ./aanbod.js.

   Krijgt de gedeelde ctx en de normalisator van ./aanbod.js. */

module.exports = (ctx, hulp) => {
  const { db, plek } = ctx;
  const { plekVan, MARKT_BEREIK } = plek;
  const { aanbod, prijs, status, zaakPlek } = hulp;

  /* ---------------------------------------------------------------------
     De RTG-brede bronnen: aanbod dat niet aan een enkele zaak hangt.
     --------------------------------------------------------------------- */

  /* Samengestelde reizen van het RTG-reisbureau (nettoprijs, mens bevestigt).

     Het bereik van een reis is zijn BESTEMMING en niet heel Europa, ook al kun
     je hem overal vandaan aanvragen. Met een Europees bereik dook "Gstaad,
     alpien weekend" op in Mall Ibiza, en dan betekent de plek niets meer: waar
     de Mall op staat is waar je KIJKT, en een reis speelt zich af waar hij
     naartoe gaat. "Reizen vanuit hier" is een andere vraag dan "wat is hier te
     doen", en die verdient zijn eigen ingang in plaats van dit filter stuk te
     maken. */
  function bronReizen() {
    const { reisAanbod } = require('../reisbureau');
    return reisAanbod(db).map(r => aanbod({
      id: 'reis:' + r.id, bron: 'reisbureau', type: 'reis',
      titel: r.titel, uitleg: r.omschrijving,
      aanbieder: { soort: 'rtg', code: null, naam: 'RTG Reisbureau', status: 'RTG Partner' },
      plek: plekVan({ stad: r.bestemming }),
      bereik: { soort: 'adres', km: 0, label: 'Op bestemming', aangenomen: false },
      prijs: prijs(r.prijs, 'per persoon', true),
      beschikbaar: r.dates ? { tekst: r.dates, hard: false } : null,
      pagina: '/apps/reisbureau.html', verdieping: 'reizen',
      kenmerken: (r.inbegrepen || []).slice(0, 4)
    })).filter(Boolean);
  }

  // verblijven: hotels, appartementen en villa's met vrije kamers
  function bronVerblijven() {
    const { maakLogies } = require('../logies');
    const d = maakLogies({ db }).logies.overzicht();
    return (d.huizen || []).map(h => {
      const s = (db.data.suppliers || []).find(x => x.code === h.code);
      return aanbod({
        id: 'verblijf:' + h.code, bron: 'logies', type: 'verblijf',
        titel: h.naam, uitleg: h.tagline,
        aanbieder: { soort: 'zaak', code: h.code, naam: h.naam, status: status(s) },
        plek: s ? zaakPlek(s) : plekVan({ stad: h.stad }), bereik: { soort: 'adres', km: 0 },
        prijs: h.vanaf != null ? prijs(h.vanaf, 'per nacht', true) : null,
        beschikbaar: h.kamers.length ? { tekst: h.kamers.length + (h.kamers.length === 1 ? ' kamer vrij' : ' kamers vrij'), hard: true } : null,
        pagina: '/apps/hotels.html', genre: h.soort, genreLabel: h.soortLabel, verdieping: 'reizen',
        kenmerken: h.kamers.slice(0, 3).map(k => k.naam)
      });
    }).filter(Boolean);
  }

  /* De Marktplaats, tussen het gewone aanbod in plaats van weggestopt in een
     eigen app. Wat een particulier aanbiedt staat naast wat een zaak aanbiedt
     -- met een eigen aanbieder-soort, zodat het verschil altijd zichtbaar is
     en nooit uit te leggen valt als "RTG verkoopt dit". */
  function bronMarkt() {
    const { advertentieOpenbaar } = require('../markt/openbaar');
    const ads = ((db.data.markt || {}).ads || []).filter(advertentieOpenbaar);
    return ads.map(a => aanbod({
      id: 'markt:' + a.id, bron: 'marktplaats', type: 'marktplaats',
      titel: a.titel, uitleg: a.beschrijving,
      aanbieder: {
        soort: a.verkoper.soort === 'supplier' ? 'zaak' : 'particulier',
        code: a.verkoper.soort === 'supplier' ? a.verkoper.id : null,
        naam: a.verkoper.naam,
        status: a.verkoper.soort === 'supplier' ? 'RTG Verified' : 'Marktplaats-lid'
      },
      plek: plekVan({ stad: a.plaats }), bereik: MARKT_BEREIK,
      prijs: a.prijs ? prijs(a.prijs, 'totaal') : null,
      beschikbaar: a.status === 'te-koop' ? { tekst: 'Te koop', hard: true } : null,
      pagina: '/apps/handel.html', genre: a.categorie, genreLabel: a.categorie,
      verdieping: 'winkelen',
      kenmerken: [a.staat, ...(a.levering || [])].filter(Boolean)
    })).filter(Boolean);
  }

  /* RTG Thuis: het commerciele verblijfsaanbod van zaken die beroepsmatig
     verhuren. Komt via de late binding uit kern/thuis (haalThuis), omdat Thuis
     na de Mall wordt gebouwd; staat Thuis uit, dan is deze bron leeg. */
  function bronThuis() {
    const t = ctx.thuisplein();
    const out = [];
    for (const stad of (t.steden || [])) {
      for (const h of (stad.huizen || [])) {
        out.push(aanbod({
          id: 'thuis:' + h.id, bron: 'thuis', type: 'verblijf',
          titel: h.titel, uitleg: h.doelgroep || h.typeLabel || null,
          aanbieder: { soort: 'zaak', code: h.zaakCode || null, naam: h.zaak, status: 'RTG Verified' },
          plek: plekVan({ stad: stad.stad }), bereik: { soort: 'adres', km: 0 },
          prijs: prijs(h.prijs, 'per nacht'),
          beschikbaar: { tekst: 'Tot ' + h.maxGasten + ' gasten', hard: false },
          /* RTG Thuis houdt reviews per HUIS bij, niet per zaak: een zaak met
             vier huizen heeft vier cijfers. Daarom geeft deze bron zijn eigen
             waardering mee in plaats van die van de zaak te lenen. */
          waardering: (h.rating && h.rating.sterren)
            ? { score: h.rating.sterren, aantal: h.rating.aantal } : null,
          pagina: '/apps/thuis.html?huis=' + encodeURIComponent(h.id),
          genre: 'vastgoed', genreLabel: 'Verblijf', verdieping: 'wonen'
        }));
      }
    }
    return out.filter(Boolean);
  }

  /* De groothandel: dezelfde producten voor een lid (consumentprijs) en voor
     een zaak (inkoopprijs). De prijs komt uit prijsVoor() van kern/groothandel
     zelf -- twee prijstabellen naast elkaar is precies waar LAT-regel 4 over
     gaat. Welke van de twee je ziet, hangt aan je rol en wordt in zoek.js
     bepaald; hier gaan ze allebei mee. */
  function bronGroothandel() {
    const gh = typeof ctx.haalGroothandel === 'function' ? ctx.haalGroothandel() : null;
    if (!gh) return [];
    const out = [];
    for (const s of (db.data.suppliers || [])) {
      if (!gh.ghIsGroothandel(s) || (s.mall && s.mall.verborgen)) continue;
      for (const p of ((s.groothandel && s.groothandel.producten) || [])) {
        const consument = gh.prijsVoor(p, 'lid');
        const zakelijk = gh.prijsVoor(p, 'partner');
        out.push(aanbod({
          id: 'gh:' + s.code + ':' + p.id, bron: 'groothandel', type: 'product',
          titel: p.naam, uitleg: p.omschrijving || null,
          aanbieder: { soort: 'zaak', code: s.code, naam: s.name, status: status(s) },
          plek: zaakPlek(s), bereik: hulp.bereikVan(s),
          prijs: consument ? prijs(consument, p.eenheid || 'per stuk') : null,
          zakelijkePrijs: zakelijk ? prijs(zakelijk, p.eenheid || 'per stuk') : null,
          beschikbaar: (p.voorraad || 0) > 0 ? { tekst: 'Op voorraad', hard: true } : { tekst: 'Uitverkocht', hard: false, uit: true },
          pagina: '/apps/handel.html', genre: 'groothandel', genreLabel: 'Groothandel',
          verdieping: 'winkelen'
        }));
      }
    }
    return out.filter(Boolean);
  }

  return { bronReizen, bronVerblijven, bronMarkt, bronThuis, bronGroothandel };
};
