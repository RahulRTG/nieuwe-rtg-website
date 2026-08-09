/* RTG Mall, deelbestand "aanbodzaken": DE BRONNEN DIE UIT DE ZAKEN KOMEN.

   Alles wat een leverancier zelf in zijn eigen systeem zet en waarvan de Mall
   een aanbod-object maakt: de kaart van een restaurant, de artikelen van een
   boutique, het eigen-merk van RTG, de oogst van een boerderij, de diensten
   van het Dienstenplein en de vervoerzaken.

   Krijgt de gedeelde ctx en de normalisator van ./aanbod.js. Elke functie is
   een pure lezer over db.data: er wordt hier niets besteld en niets bevestigd,
   de knop wijst naar de plek waar dat al gebeurt. */

/* Waar je een vervoergenre werkelijk aanvraagt. Deze genres hadden tot nu toe
   GEEN plek in de Mall: ze stonden wel in de leveranciersgids maar wezen naar
   /apps/app.html, dus een privejet en een scooterverhuur waren zichtbaar en
   tegelijk doodlopend. */
const VERVOER_PAGINA = {
  taxi: '/apps/ov.html', jet: '/apps/hangar.html', helikopter: '/apps/hangar.html',
  charter: '/apps/hangar.html', verhuur: '/apps/mall.html', tweewielers: '/apps/mall.html'
};

module.exports = (ctx, hulp) => {
  const { db, isBoer, farmTeKoop, isRetail, winkelCatalogus } = ctx;
  const { aanbod, prijs, getal, status, zaakPlek, zichtbareZaken, genreLabel, bereikVan, plekVan, RTG_BEREIK } = hulp;

  // restaurants en andere eetgelegenheden
  function bronEten() {
    return zichtbareZaken()
      .filter(s => (db.capsVan(s) || []).includes('menu') && (s.menu || []).length)
      .map(s => {
        const prijzen = (s.menu || []).map(m => getal(m.price)).filter(Boolean);
        return aanbod({
          id: 'eten:' + s.code, bron: 'foodcourt', type: 'eten',
          titel: s.name, uitleg: (s.foodcourt || {}).keuken || (s.mall || {}).tagline || null,
          aanbieder: { soort: 'zaak', code: s.code, naam: s.name, status: status(s) },
          plek: zaakPlek(s), bereik: bereikVan(s),
          prijs: prijzen.length ? prijs(Math.min(...prijzen), 'per gerecht', true) : null,
          beschikbaar: (s.settings && s.settings.reservationsOpen === false) ? null : { tekst: 'Reserveren mogelijk', hard: false },
          pagina: '/apps/foodcourt.html', genre: s.type, genreLabel: genreLabel(s.type),
          kenmerken: [...new Set((s.menu || []).map(m => m.cat).filter(Boolean))].slice(0, 3)
        });
      }).filter(Boolean);
  }

  // de boutieks: mode, sieraden, leer, wonen, beauty -- per artikel
  function bronRetail() {
    const out = [];
    for (const s of zichtbareZaken().filter(isRetail)) {
      for (const a of (s.artikelen || [])) {
        const p = getal(a.publiekePrijs || a.price);
        out.push(aanbod({
          id: 'artikel:' + s.code + ':' + a.id, bron: 'retail', type: 'product',
          titel: a.naam, uitleg: a.omschrijving || a.materiaal || null,
          aanbieder: { soort: 'zaak', code: s.code, naam: s.name, status: status(s) },
          plek: zaakPlek(s), bereik: bereikVan(s),
          prijs: p ? prijs(p, 'per stuk') : null,
          beschikbaar: (a.varianten || []).some(v => (v.voorraad || 0) > 0) ? { tekst: 'Op voorraad', hard: true } : null,
          pagina: '/apps/mall.html', genre: s.type, genreLabel: genreLabel(s.type),
          verdieping: 'winkelen', kenmerken: [a.categorie].filter(Boolean)
        }));
      }
    }
    return out.filter(Boolean);
  }

  // het RTG eigen-merk (hardware + de ontwerpen uit het Hardwarelab)
  function bronEigenMerk() {
    const cat = winkelCatalogus(db);
    return Object.entries(cat).map(([slug, p]) => aanbod({
      id: 'eigen:' + slug, bron: 'eigen-merk', type: 'product',
      titel: p.naam, uitleg: p.beschrijving,
      aanbieder: { soort: 'rtg', code: null, naam: 'RTG Maison', status: 'RTG Partner' },
      // een webwinkel van RTG zelf: die levert door heel Europa
      plek: plekVan({}), bereik: RTG_BEREIK,
      prijs: getal(p.eenmalig) ? prijs(p.eenmalig, p.eenheid || 'per stuk')
        : (getal(p.perMaand) ? prijs(p.perMaand, 'per maand') : null),
      pagina: '/apps/mall.html', verdieping: 'winkelen',
      kenmerken: [p.disciplineLabel].filter(Boolean)
    })).filter(Boolean);
  }

  // van het land: de boerderijen met producten die te koop staan
  function bronBoerderij() {
    const out = [];
    for (const s of zichtbareZaken().filter(isBoer)) {
      for (const p of farmTeKoop(s)) {
        out.push(aanbod({
          id: 'oogst:' + s.code + ':' + p.id, bron: 'boerderij', type: 'product',
          titel: p.naam, uitleg: null,
          aanbieder: { soort: 'zaak', code: s.code, naam: s.name, status: status(s) },
          plek: zaakPlek(s), bereik: bereikVan(s),
          prijs: prijs(p.prijs, p.eenheid || 'per stuk'),
          beschikbaar: { tekst: p.voorraad + ' op voorraad', hard: true },
          pagina: '/apps/mall.html', genre: 'boerderij', genreLabel: genreLabel('boerderij'),
          verdieping: 'eten'
        }));
      }
    }
    return out.filter(Boolean);
  }

  // het Dienstenplein: elke zaak met een services-cap, per dienst
  function bronDiensten() {
    const types = db.data.supplierTypes || {};
    const out = [];
    for (const s of zichtbareZaken()) {
      if (!((types[s.type] || {}).caps || []).includes('services')) continue;
      for (const d of (s.services || [])) {
        out.push(aanbod({
          id: 'dienst:' + s.code + ':' + d.id, bron: 'dienstenplein',
          // zonder prijs is het geen dienst maar een offerte, en dat hoort de
          // knop ook te zeggen ("Offerte aanvragen", niet "Afspraak maken")
          type: getal(d.price) ? 'dienst' : 'offerte',
          titel: d.name, uitleg: d.desc || null,
          aanbieder: { soort: 'zaak', code: s.code, naam: s.name, status: status(s) },
          plek: zaakPlek(s), bereik: bereikVan(s),
          prijs: getal(d.price) ? prijs(d.price, d.duurMin ? 'per ' + d.duurMin + ' min' : 'per dienst') : null,
          pagina: '/apps/mall.html', genre: s.type, genreLabel: genreLabel(s.type),
          kenmerken: [s.vak].filter(Boolean)
        }));
      }
    }
    return out.filter(Boolean);
  }

  // vervoer en verhuur, elk naar de pagina waar je hem werkelijk aanvraagt
  function bronVervoer() {
    return zichtbareZaken()
      .filter(s => VERVOER_PAGINA[s.type])
      .map(s => aanbod({
        id: 'vervoer:' + s.code, bron: 'mobiliteit',
        type: ['verhuur', 'tweewielers', 'charter'].includes(s.type) ? 'huur' : 'vervoer',
        titel: s.name, uitleg: (s.mall || {}).tagline || null,
        aanbieder: { soort: 'zaak', code: s.code, naam: s.name, status: status(s) },
        plek: zaakPlek(s), bereik: bereikVan(s),
        prijs: null, pagina: VERVOER_PAGINA[s.type],
        genre: s.type, genreLabel: genreLabel(s.type)
      })).filter(Boolean);
  }

  return { bronEten, bronRetail, bronEigenMerk, bronBoerderij, bronDiensten, bronVervoer };
};

module.exports.VERVOER_PAGINA = VERVOER_PAGINA;
