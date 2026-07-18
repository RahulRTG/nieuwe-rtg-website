/* Groothandel (deelmodule): het assortiment: functieschakelaars, producten
   met prijzen per klantsoort, voorraad en de marktweergave. Krijgt de
   gedeelde context een keer bij het opstarten vanuit kern/groothandel.js. */
module.exports = (ctx) => {
  const { db, save, crypto, findSupplier, notify, notifySupplier, sseToSupplier, sseToCustomer, sseToOffice, anthropic, bijGeleverd,
    GH_FUNCTIES, GH_KETEN, GH_KLAAR, CATEGORIEEN,
    id, nu, schoon, getal, isGroothandel, defaults, functieAan, klantSoortVan, functieVoorKlant, prijsVoor } = ctx;
  function functieLijst(s) {
    const g = defaults(s);
    return GH_FUNCTIES.map(f => ({ id: f.id, naam: f.naam, aan: g.functies[f.id] !== false }));
  }
  function zetFunctie(s, fid, aan) {
    if (!GH_FUNCTIES.some(f => f.id === fid)) return { status: 400, error: 'Onbekende functie.' };
    defaults(s).functies[fid] = aan !== false;
    save();
    return { status: 200, ok: true, functies: functieLijst(s) };
  }
  function zetProduct(s, data) {
    const g = defaults(s);
    const naam = schoon(data.naam, 80);
    if (!naam) return { status: 400, error: 'Geef een productnaam.' };
    let p = data.id ? g.producten.find(x => x.id === data.id) : null;
    if (!p) { p = { id: id('p') }; g.producten.push(p); }
    p.naam = naam;
    p.categorie = CATEGORIEEN.includes(data.categorie) ? data.categorie : (p.categorie || 'Droog & houdbaar');
    p.eenheid = schoon(data.eenheid, 20) || p.eenheid || 'stuk';
    p.inkoopPrijs = getal(data.inkoopPrijs, 0, 1e6, p.inkoopPrijs || 0);
    p.consumentPrijs = getal(data.consumentPrijs, 0, 1e6, p.consumentPrijs != null ? p.consumentPrijs : Math.round((p.inkoopPrijs || 0) * 1.35 * 100) / 100);
    p.voorraad = getal(data.voorraad, 0, 1e9, p.voorraad || 0);
    p.minBestel = getal(data.minBestel, 1, 1e6, p.minBestel || 1);
    p.btw = getal(data.btw, 0, 27, p.btw != null ? p.btw : 9);
    p.herkomst = schoon(data.herkomst, 60) || p.herkomst || '';
    p.allergenen = schoon(data.allergenen, 120) || p.allergenen || '';
    p.actief = data.actief !== false;
    save();
    return { status: 200, ok: true, product: p };
  }
  function zetVoorraad(s, pid, voorraad) {
    const p = defaults(s).producten.find(x => x.id === pid);
    if (!p) return { status: 404, error: 'Product niet gevonden.' };
    p.voorraad = getal(voorraad, 0, 1e9, p.voorraad);
    save();
    return { status: 200, ok: true, voorraad: p.voorraad };
  }

  /* ---- de marktplaats: wat een klant van een klanttype kan bestellen ---- */
  function orders() { if (!Array.isArray(db.data.groothandelOrders)) db.data.groothandelOrders = []; return db.data.groothandelOrders; }
  function actieveGroothandels() { return db.data.suppliers.filter(isGroothandel); }
  function publiekProduct(p, soort) {
    return { id: p.id, naam: p.naam, categorie: p.categorie, eenheid: p.eenheid, prijs: prijsVoor(p, soort),
      btw: p.btw, voorraad: p.voorraad, minBestel: p.minBestel, herkomst: p.herkomst, allergenen: p.allergenen };
  }
  function markt(soort, opts) {
    opts = opts || {};
    const fnodig = functieVoorKlant(soort);
    const zoek = String(opts.zoek || '').toLowerCase();
    return actieveGroothandels()
      .filter(s => functieAan(s, fnodig))
      .map(s => {
        const g = defaults(s);
        let prod = g.producten.filter(p => p.actief);
        if (opts.categorie) prod = prod.filter(p => p.categorie === opts.categorie);
        if (zoek) prod = prod.filter(p => (p.naam + ' ' + p.categorie).toLowerCase().includes(zoek));
        return {
          code: s.code, naam: s.name, city: s.city,
          bezorgt: functieAan(s, 'bezorgen'), afhalen: functieAan(s, 'afhalen'),
          spoed: functieAan(s, 'spoed'), factuur: functieAan(s, 'facturatie'),
          producten: prod.slice(0, 400).map(p => publiekProduct(p, soort))
        };
      })
      .filter(s => s.producten.length || !zoek);
  }

  /* ---- een bestelling plaatsen (B2B, boodschappen of doorverkoop) ---- */
  return { functieLijst, zetFunctie, zetProduct, zetVoorraad, orders, actieveGroothandels, publiekProduct, markt };
};
