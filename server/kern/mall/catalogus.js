/* RTG Mall, deelbestand "catalogus": de producten en het bestellen. Het RTG
   eigen-merk (de winkelcatalogus plus de Hardwarelab-ontwerpen) en de boerderijen
   "Van het land" met hun te-koop-producten, elk als boutique, plus de twee
   besteldrempels voor leden (eigen-merk en boerderij). De retail-boutiekweergave
   (boutiek/eigenBoutiek/farmBoutieks) zet dit deel als gedeelde helper in de ctx,
   zodat de etalage die kan tonen. Krijgt de gedeelde ctx van kern/mall/index.js. */
module.exports = (ctx) => {
  const { db, save, crypto, nu, winkelCatalogus, ETAGE_IDS, isBoer, farmTeKoop } = ctx;

  function vanafPrijs(s) {
    const prijzen = (s.artikelen || []).map(a => Math.max(0, Number(a.publiekePrijs || a.price) || 0)).filter(Boolean);
    return prijzen.length ? Math.min(...prijzen) : null;
  }
  function boutiek(s) {
    const cats = [...new Set((s.artikelen || []).map(a => a.categorie).filter(Boolean))];
    return {
      code: s.code, naam: s.name, stad: s.city || null,
      etage: (s.mall && ETAGE_IDS.includes(s.mall.etage)) ? s.mall.etage : 'mode',
      tagline: (s.mall && s.mall.tagline) || 'Een huis binnen de RTG Mall.',
      categorieen: cats.slice(0, 4), aantal: (s.artikelen || []).length, vanaf: vanafPrijs(s)
    };
  }

  /* Het RTG eigen-merk: de vaste winkelcatalogus plus de door het Hardwarelab
     gepubliceerde ontwerpen. Genormaliseerd tot producten met een eenmalige en
     een maandprijs (euro, ex btw). */
  function eigenProducten() {
    const cat = winkelCatalogus(db);
    return Object.entries(cat).map(([slug, p]) => ({
      slug,
      naam: p.naam,
      beschrijving: p.beschrijving || null,
      discipline: p.disciplineLabel || null,
      eigen: p.bron === 'hardwarelab',
      eenmalig: Math.max(0, Number(p.eenmalig) || 0),
      perMaand: Math.max(0, Number(p.perMaand) || 0),
      eenheid: p.eenheid || 'per stuk',
      kleuren: Array.isArray(p.kleuren) ? p.kleuren.slice(0, 3) : []
    }));
  }
  function eigenCatalogus() {
    const producten = eigenProducten();
    return { ok: true, naam: 'RTG Maison', producten, aantal: producten.length, valuta: 'EUR' };
  }
  function eigenBoutiek() {
    const p = eigenProducten();
    if (!p.length) return null;
    const prijzen = p.map(x => x.eenmalig).filter(Boolean);
    return {
      code: '__eigen', kind: 'eigen', naam: 'RTG Maison', stad: 'RTG', etage: 'eigen',
      tagline: 'Het eigen merk van RTG: hardware, wearables en de ontwerpen uit het Hardwarelab.',
      categorieen: [...new Set(p.map(x => x.discipline).filter(Boolean))].slice(0, 4),
      aantal: p.length, vanaf: prijzen.length ? Math.min(...prijzen) : null
    };
  }

  /* Van het land: de boerderijen en tuinderijen met producten die te koop staan
     (prijs en voorraad). Elke boerderij is een boutique; leden bestellen een
     product direct en de voorraad daalt. */
  function farmBoutiek(s) {
    const p = farmTeKoop(s);
    if (!p.length) return null;
    const prijzen = p.map(x => x.prijs).filter(Boolean);
    return {
      code: s.code, kind: 'farm', naam: s.name, stad: s.city || null, etage: 'land',
      tagline: (s.mall && s.mall.tagline) || 'Vers van het erf.',
      categorieen: [], aantal: p.length, vanaf: prijzen.length ? Math.min(...prijzen) : null
    };
  }
  function farmBoutieks() {
    return (db.data.suppliers || []).filter(s => isBoer(s) && !(s.mall && s.mall.verborgen)).map(farmBoutiek).filter(Boolean);
  }
  function farmCatalogus(code) {
    const s = (db.data.suppliers || []).find(x => x.code === String(code || '') && isBoer(x));
    if (!s) return { status: 404, error: 'Boerderij niet gevonden.' };
    return {
      ok: true, naam: s.name, stad: s.city || null,
      producten: farmTeKoop(s).map(p => ({ id: p.id, naam: p.naam, eenheid: p.eenheid, prijs: Math.max(0, Number(p.prijs) || 0), voorraad: p.voorraad })),
      valuta: 'EUR'
    };
  }
  function memberBestelFarm(data) {
    data = data || {};
    const s = (db.data.suppliers || []).find(x => x.code === String(data.code || '') && isBoer(x));
    if (!s) return { status: 404, error: 'Boerderij niet gevonden.' };
    const p = (s.boerderij.producten || []).find(x => x.id === String(data.productId || ''));
    if (!p || !((p.prijs || 0) > 0)) return { status: 400, error: 'Kies een geldig product.' };
    const naam = String(data.naam || '').replace(/[<>]/g, '').trim().slice(0, 60);
    const email = String(data.email || '').trim().toLowerCase().slice(0, 80);
    const aantal = Math.min(100, Math.max(1, Math.round(Number(data.aantal) || 1)));
    if (!naam) return { status: 400, error: 'Vul je naam in voor de levering.' };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { status: 400, error: 'Vul een geldig e-mailadres in.' };
    if ((p.voorraad || 0) < aantal) return { status: 409, error: 'Niet genoeg voorraad. Nog ' + (p.voorraad || 0) + ' beschikbaar.' };
    p.voorraad -= aantal;
    if (!Array.isArray(db.data.winkelBestellingen)) db.data.winkelBestellingen = [];
    const entry = {
      id: crypto.randomBytes(4).toString('hex'),
      product: p.id, productNaam: p.naam, aantal,
      prijs: { stuk: Math.max(0, Number(p.prijs) || 0), totaal: Math.round((p.prijs || 0) * aantal * 100) / 100, valuta: 'EUR' },
      leverancier: s.code, leverancierNaam: s.name,
      contactName: naam, email, kanaal: 'lid', status: 'nieuw', at: nu()
    };
    db.data.winkelBestellingen.unshift(entry);
    db.data.winkelBestellingen = db.data.winkelBestellingen.slice(0, 500);
    save();
    return { ok: true, bestelling: { id: entry.id, product: entry.productNaam, aantal, prijs: entry.prijs, restVoorraad: p.voorraad } };
  }

  /* Een lid bestelt een eigen-merk-product rechtstreeks in de app. De
     bestelling landt bij het kantoor (winkelBestellingen, kanaal "lid"); de
     prijs wordt vastgelegd zoals die op dat moment gold. */
  function memberBestel(data) {
    data = data || {};
    const cat = winkelCatalogus(db);
    const product = cat[String(data.slug || data.product || '')];
    if (!product) return { status: 400, error: 'Kies een geldig product.' };
    const naam = String(data.naam || '').replace(/[<>]/g, '').trim().slice(0, 60);
    const email = String(data.email || '').trim().toLowerCase().slice(0, 80);
    const note = String(data.note || '').replace(/[<>]/g, '').trim().slice(0, 500);
    const aantal = Math.min(50, Math.max(1, Math.round(Number(data.aantal) || 1)));
    if (!naam) return { status: 400, error: 'Vul je naam in voor de levering.' };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { status: 400, error: 'Vul een geldig e-mailadres in.' };
    if (!Array.isArray(db.data.winkelBestellingen)) db.data.winkelBestellingen = [];
    if (db.data.winkelBestellingen.some(o => o.status === 'nieuw' && o.kanaal === 'lid' && o.email === email && o.product === String(data.slug || data.product)))
      return { status: 409, error: 'Deze bestelling staat al open. We nemen contact met je op.' };
    const entry = {
      id: crypto.randomBytes(4).toString('hex'),
      product: String(data.slug || data.product), productNaam: product.naam, aantal,
      prijs: { eenmalig: product.eenmalig, perMaand: product.perMaand, valuta: 'EUR', exBtw: true },
      contactName: naam, email, note, kanaal: 'lid',
      akkoord: { prijs: true, at: nu() }, status: 'nieuw', at: nu()
    };
    db.data.winkelBestellingen.unshift(entry);
    db.data.winkelBestellingen = db.data.winkelBestellingen.slice(0, 500);
    save();
    return { ok: true, bestelling: { id: entry.id, product: entry.productNaam, aantal, prijs: entry.prijs } };
  }

  // de boutiekweergaven delen met de etalage (overzicht toont ze per etage)
  ctx.boutiek = boutiek;
  ctx.eigenBoutiek = eigenBoutiek;
  ctx.farmBoutieks = farmBoutieks;

  return { eigenCatalogus, memberBestel, farmCatalogus, memberBestelFarm };
};
