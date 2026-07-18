/* Retail (deelmodule): collecties, artikelen met varianten, voorraad en drops.
   Krijgt de gedeelde context een keer bij het opstarten vanuit kern/retail.js. */
module.exports = (ctx) => {
  const { db, save, crypto, findSupplier, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice,
    ledenPrijs, gidsHaal, meldWachtlijst, MATEN, SEIZOENEN,
    id, nu, vandaag, rond, schoon, isRetail, artikelVan, variantVan, totaleVoorraad } = ctx;
  function zetCollectie(s, body) {
    if (!Array.isArray(s.collecties)) s.collecties = [];
    const actie = String(body.action || 'add');
    if (actie === 'remove') { s.collecties = s.collecties.filter(c => c.id !== body.id); save(); return { ok: true }; }
    const naam = schoon(body.naam, 60);
    if (!naam) return { status: 400, error: 'Geef de collectie een naam.' };
    const seizoen = SEIZOENEN.includes(body.seizoen) ? body.seizoen : 'SS';
    const jaar = Math.min(2100, Math.max(2020, parseInt(body.jaar, 10) || new Date().getFullYear()));
    if (body.id) {
      const c = s.collecties.find(x => x.id === body.id);
      if (c) { c.naam = naam; c.seizoen = seizoen; c.jaar = jaar; c.actief = body.actief !== false; save(); return { ok: true, collectie: c }; }
    }
    const c = { id: id(), naam, seizoen, jaar, actief: body.actief !== false, at: nu() };
    s.collecties.unshift(c);
    save();
    return { ok: true, collectie: c };
  }

  /* ---- artikelen met varianten (maat x kleur x SKU) ---- */
  function normaliseerVarianten(lijst, baseSku) {
    const uit = [];
    for (const v of (Array.isArray(lijst) ? lijst : []).slice(0, 120)) {
      const kleur = schoon(v.kleur, 30) || 'Zwart';
      const maat = schoon(v.maat, 12) || 'M';
      const voorraad = Math.max(0, Math.min(99999, parseInt(v.voorraad, 10) || 0));
      const vsku = schoon(v.vsku, 40) || (baseSku + '-' + kleur.slice(0, 3).toUpperCase() + '-' + maat);
      if (!uit.some(x => x.vsku === vsku)) uit.push({ vsku, kleur, maat, voorraad });
    }
    return uit;
  }
  function zetArtikel(s, body) {
    if (!Array.isArray(s.artikelen)) s.artikelen = [];
    const actie = String(body.action || 'add');
    if (actie === 'remove') { s.artikelen = s.artikelen.filter(a => a.id !== body.id); save(); return { ok: true }; }
    const a = body.artikel || {};
    const naam = schoon(a.naam, 80);
    if (!naam) return { status: 400, error: 'Geef het artikel een naam.' };
    const publiek = Math.max(0, Number(a.publiekePrijs != null ? a.publiekePrijs : a.price) || 0);
    const baseSku = (schoon(a.sku, 30) || (naam.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() + crypto.randomBytes(2).toString('hex'))).toUpperCase();
    const bestaand = body.id ? s.artikelen.find(x => x.id === body.id) : null;
    const artikel = bestaand || { id: id(), at: nu() };
    Object.assign(artikel, {
      sku: baseSku,
      naam,
      collectieId: a.collectieId || (s.collecties && s.collecties[0] && s.collecties[0].id) || null,
      categorie: schoon(a.categorie, 40) || 'Kleding',
      materiaal: schoon(a.materiaal, 60),
      omschrijving: schoon(a.omschrijving, 400),
      foto: typeof a.foto === 'string' && a.foto.length < 500000 ? a.foto : (artikel.foto || null),
      publiekePrijs: publiek,
      price: ledenPrijs(publiek, a.price),
      drop: a.drop && a.drop.datum ? { datum: schoon(a.drop.datum, 10), tijd: schoon(a.drop.tijd, 5) || '10:00', gereleased: !!(bestaand && bestaand.drop && bestaand.drop.gereleased) } : null,
      varianten: normaliseerVarianten(a.varianten, baseSku)
    });
    if (!bestaand) s.artikelen.unshift(artikel);
    s.artikelen = s.artikelen.slice(0, 5000);
    save();
    return { ok: true, artikel };
  }
  // voorraad van een variant bijstellen (ontvangst, correctie, breuk)
  function pasVoorraad(s, vsku, delta, absoluut) {
    const hit = variantVan(s, vsku);
    if (!hit) return { status: 404, error: 'Variant niet gevonden.' };
    if (absoluut != null) hit.variant.voorraad = Math.max(0, Math.min(99999, parseInt(absoluut, 10) || 0));
    else hit.variant.voorraad = Math.max(0, hit.variant.voorraad + (parseInt(delta, 10) || 0));
    save();
    sseToSupplier(s.code, 'sync', { scope: 'retail' });
    return { ok: true, voorraad: hit.variant.voorraad, vsku };
  }

  /* ---- drops: getimede release; de wachtlijst gaat af zodra hij live is ---- */
  function releaseDrop(s, artikelId) {
    const a = artikelVan(s, artikelId);
    if (!a || !a.drop) return { status: 404, error: 'Geen drop op dit artikel.' };
    a.drop.gereleased = true;
    save();
    // iedereen op de wachtlijst voor deze drop krijgt bericht (via de ervaring-laag)
    let bericht = 0;
    while (meldWachtlijst && meldWachtlijst('drop:' + s.code + ':' + a.id)) bericht++;
    sseToSupplier(s.code, 'sync', { scope: 'retail' });
    return { ok: true, bericht };
  }

  /* ---- clienteling: het klantprofiel van een modehuis ---- */
  return { zetCollectie, zetArtikel, pasVoorraad, releaseDrop };
};
