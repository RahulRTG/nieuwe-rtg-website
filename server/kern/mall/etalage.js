/* RTG Mall, deelbestand "etalage": de mall-voorkant en het beheer. Het overzicht
   met de etages en hun boutieks, de gids van alle leveranciers per genre (met een
   diepe link naar waar je boekt), en het boardroom-beheer waarmee het kantoor een
   partner verbergt of zijn etage/tagline/actie bijstelt. De boutiekweergaven komen
   als gedeelde helper uit de catalogus. Krijgt de gedeelde ctx van kern/mall/index.js. */
module.exports = (ctx) => {
  const { db, save, seed, isRetail, isBoer, verborgen, boutiek, eigenBoutiek, farmBoutieks,
    ETAGES, ETAGE_IDS, GIDS_GENRES, GENRE_PAGINA } = ctx;

  /* De gids van alle leveranciers, per genre. Elk genre wijst naar de pagina waar
     je die partner boekt of reserveert; genres zonder eigen pagina landen op de
     leden-app. Verborgen partners en partners zonder compleet type slaan we over. */
  function gidsen() {
    const types = db.data.supplierTypes || {};
    const alle = (db.data.suppliers || []).filter(s => s && !verborgen(s));
    const genres = [];
    for (const g of GIDS_GENRES) {
      const def = types[g];
      if (!def) continue;
      const leden = alle.filter(s => s.type === g).map(s => ({
        code: s.code, naam: s.name, stad: s.city || null,
        tagline: (s.mall && s.mall.tagline) || null
      }));
      if (!leden.length) continue;
      genres.push({
        type: g, label: def.label || g, icon: def.icon || '•',
        pagina: GENRE_PAGINA[g] || '/apps/app.html',
        boekbaar: !!GENRE_PAGINA[g], leveranciers: leden, aantal: leden.length
      });
    }
    return { ok: true, genres, aantal: genres.reduce((n, x) => n + x.aantal, 0) };
  }

  function overzicht() {
    seed();
    const winkels = (db.data.suppliers || []).filter(s => isRetail(s) && !verborgen(s)).map(boutiek);
    const farms = farmBoutieks();
    const etages = ETAGES.map(e => {
      let boutieks = winkels.filter(b => b.etage === e.id);
      if (e.id === 'eigen') { const eb = eigenBoutiek(); boutieks = eb ? [eb] : []; }
      if (e.id === 'land') boutieks = farms;
      return { ...e, boutieks };
    }).filter(e => e.boutieks.length);
    return {
      ok: true,
      etages,
      gids: gidsen().genres,
      totaalBoutieks: winkels.length + farms.length + (eigenBoutiek() ? 1 : 0),
      valuta: 'EUR',
      opmerking: 'De enige plek waar je bij RTG koopt. Ledenprijzen in de boutique; het eigen-merk en de boerderij bestel je direct. Prijzen in euro, exclusief eventuele lokale btw.'
    };
  }

  /* Boardroom-beheer: het kantoor ziet elke mall-partner en kan hem verbergen of
     zijn etage, tagline en actie bijstellen. Alleen de gastvrije genres (de gids)
     plus de retail-etages en de boerderijen; het eigen-merk beheert RTG zelf. */
  function beheerLijst() {
    const types = db.data.supplierTypes || {};
    const inGids = new Set(GIDS_GENRES);
    return (db.data.suppliers || [])
      .filter(s => s && (inGids.has(s.type) || isRetail(s) || isBoer(s)))
      .map(s => ({
        code: s.code, naam: s.name, stad: s.city || null, type: s.type,
        typeLabel: (types[s.type] || {}).label || s.type,
        etage: (s.mall && s.mall.etage) || (isBoer(s) ? 'land' : (isRetail(s) ? 'mode' : null)),
        tagline: (s.mall && s.mall.tagline) || '',
        deal: (s.mall && s.mall.deal) || '',
        verborgen: verborgen(s),
        koopetage: isRetail(s) || isBoer(s),
        pagina: GENRE_PAGINA[s.type] || '/apps/app.html'
      }));
  }
  function beheer() {
    seed();
    return { ok: true, etages: ETAGES.filter(e => ETAGE_IDS.includes(e.id)), leveranciers: beheerLijst() };
  }
  function beheerZet(code, patch) {
    patch = patch || {};
    const s = (db.data.suppliers || []).find(x => x.code === String(code || ''));
    if (!s) return { status: 404, error: 'Leverancier niet gevonden.' };
    if (!s.mall) s.mall = {};
    if (typeof patch.verborgen === 'boolean') s.mall.verborgen = patch.verborgen;
    if (typeof patch.etage === 'string' && ETAGE_IDS.includes(patch.etage)) s.mall.etage = patch.etage;
    if (typeof patch.tagline === 'string') s.mall.tagline = patch.tagline.replace(/[<>]/g, '').trim().slice(0, 140);
    if (typeof patch.deal === 'string') s.mall.deal = patch.deal.replace(/[<>]/g, '').trim().slice(0, 120);
    save();
    return { ok: true, leverancier: beheerLijst().find(x => x.code === s.code) };
  }

  return { overzicht, gidsen, beheer, beheerZet };
};
