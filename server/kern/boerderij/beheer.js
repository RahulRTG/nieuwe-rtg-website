/* Boerderij (deelmodule): producten, percelen (zaaien/water/oogst), dieren en taken.
   Krijgt de gedeelde context een keer bij het opstarten vanuit kern/boerderij.js. */
module.exports = (ctx) => {
  const { db, save, crypto, findSupplier, anthropic, schoon,
    BTYPES, GEWASSEN, DIEREN,
    isBoer, ensure, voegAanVoorraad, seizoen, SEIZOEN_LABEL, id, nu, vandaag, scho, getal } = ctx;
  const { gewasFase, perceelPubliek, dierPubliek, briefing, stats, overzicht } = ctx;
  function zetProduct(s, data) {
    const b = ensure(s);
    if (data.weg) { b.producten = b.producten.filter(p => p.id !== data.id); save(); return { ok: true }; }
    const naam = scho(data.naam, 60);
    if (data.id) {
      const p = b.producten.find(x => x.id === data.id);
      if (!p) return { error: 'Product niet gevonden.' };
      if (naam) p.naam = naam;
      if (data.prijs != null) p.prijs = Math.round(getal(data.prijs, 1000000) * 100) / 100;
      if (data.voorraad != null) p.voorraad = getal(data.voorraad, 100000000);
      if (data.eenheid != null) p.eenheid = scho(data.eenheid, 12) || 'kg';
      save(); return { ok: true };
    }
    if (!naam) return { error: 'Geef het product een naam.' };
    if (b.producten.length >= 500) return { error: 'Tot 500 producten per bedrijf.' };
    b.producten.push({ id: id('pr'), naam, eenheid: scho(data.eenheid, 12) || 'kg', prijs: Math.round(getal(data.prijs, 1000000) * 100) / 100, voorraad: getal(data.voorraad, 100000000), bron: 'handmatig' });
    save(); return { ok: true };
  }
  function productVan(s, productId) { return ensure(s).producten.find(p => p.id === productId) || null; }
  function markeerInSalon(s, productId) { const p = productVan(s, productId); if (p) { p.inSalon = true; save(); } return p; }

  /* ---- muterende acties (boer/manager) ---- */
  function kiesType(s, typeId) {
    const b = ensure(s);
    if (!BTYPES[typeId]) return { error: 'Onbekend boerderijtype.' };
    b.type = typeId; b.opgezet = true; save();
    return { ok: true };
  }
  function zetPerceel(s, data) {
    const b = ensure(s);
    if (data.weg) { b.percelen = b.percelen.filter(p => p.id !== data.id); save(); return { ok: true }; }
    const naam = scho(data.naam, 60);
    if (!naam) return { error: 'Geef het perceel een naam.' };
    const ha = getal(data.ha, 100000);
    if (data.id) {
      const p = b.percelen.find(x => x.id === data.id);
      if (!p) return { error: 'Perceel niet gevonden.' };
      p.naam = naam; if (data.ha != null) p.ha = ha;
      save(); return { ok: true };
    }
    if (b.percelen.length >= 2000) return { error: 'Tot 2000 percelen per bedrijf.' };
    b.percelen.push({ id: id('pc'), naam, ha, gewas: null, gezaaidOp: null, oogstVerwacht: null, geoogstOp: null, opbrengst: 0 });
    save(); return { ok: true };
  }
  function zaaiPerceel(s, perceelId, gewas) {
    const b = ensure(s);
    const p = b.percelen.find(x => x.id === perceelId);
    if (!p) return { error: 'Perceel niet gevonden.' };
    if (!GEWASSEN[gewas]) return { error: 'Onbekend gewas.' };
    p.gewas = gewas; p.gezaaidOp = nu(); p.geoogstOp = null; p.opbrengst = 0;
    p.oogstVerwacht = new Date(Date.now() + GEWASSEN[gewas].groeidagen * 86400000).toISOString().slice(0, 10);
    save(); return { ok: true, oogstVerwacht: p.oogstVerwacht };
  }
  function waterPerceel(s, perceelId) {
    const b = ensure(s);
    const p = b.percelen.find(x => x.id === perceelId);
    if (!p) return { error: 'Perceel niet gevonden.' };
    p.laatsteWater = nu(); save(); return { ok: true };
  }
  function oogstPerceel(s, perceelId, kg) {
    const b = ensure(s);
    const p = b.percelen.find(x => x.id === perceelId);
    if (!p) return { error: 'Perceel niet gevonden.' };
    if (!p.gewas) return { error: 'Op dit perceel staat geen gewas.' };
    const g = GEWASSEN[p.gewas];
    const opbrengst = kg != null && Number(kg) > 0 ? getal(kg, 100000000) : Math.round((p.ha || 0) * g.perHa);
    p.opbrengst = opbrengst; p.geoogstOp = nu();
    voegAanVoorraad(b, g.label, g.eenheid, opbrengst); // oogst gaat de winkelvoorraad in
    save(); return { ok: true, opbrengst, eenheid: g.eenheid };
  }
  function zetDier(s, data) {
    const b = ensure(s);
    if (data.weg) { b.dieren = b.dieren.filter(d => d.id !== data.id); save(); return { ok: true }; }
    if (!DIEREN[data.soort] && !data.id) return { error: 'Onbekende diersoort.' };
    if (data.id) {
      const d = b.dieren.find(x => x.id === data.id);
      if (!d) return { error: 'Diergroep niet gevonden.' };
      if (data.aantal != null) d.aantal = getal(data.aantal, 1000000);
      if (data.stal != null) d.stal = scho(data.stal, 40);
      if (data.gezondheid && ['goed', 'aandacht', 'ziek'].includes(data.gezondheid)) d.gezondheid = data.gezondheid;
      save(); return { ok: true };
    }
    if (b.dieren.length >= 500) return { error: 'Tot 500 diergroepen per bedrijf.' };
    b.dieren.push({ id: id('dr'), soort: data.soort, aantal: getal(data.aantal, 1000000), stal: scho(data.stal, 40), gezondheid: 'goed' });
    save(); return { ok: true };
  }
  function voerDier(s, dierId) {
    const b = ensure(s);
    const d = b.dieren.find(x => x.id === dierId);
    if (!d) return { error: 'Diergroep niet gevonden.' };
    d.laatsteVoer = nu(); save();
    return { ok: true, voerKg: dierPubliek(d).voerKgPerDag };
  }
  function opbrengstDier(s, dierId, waarde) {
    const b = ensure(s);
    const d = b.dieren.find(x => x.id === dierId);
    if (!d) return { error: 'Diergroep niet gevonden.' };
    d.dagopbrengst = getal(waarde, 10000000); save();
    return { ok: true };
  }
  function zetTaak(s, data) {
    const b = ensure(s);
    if (data.weg) { b.taken = b.taken.filter(t => t.id !== data.id); save(); return { ok: true }; }
    const wat = scho(data.wat, 120);
    if (!wat) return { error: 'Beschrijf de taak.' };
    if (b.taken.length >= 1000) b.taken = b.taken.filter(t => !t.klaar).slice(-900);
    b.taken.push({ id: id('tk'), wat, waar: scho(data.waar, 60) || null, voor: /^\d{4}-\d{2}-\d{2}$/.test(data.voor || '') ? data.voor : null, klaar: false, at: nu() });
    save(); return { ok: true };
  }
  function rondTaak(s, taakId, door) {
    const b = ensure(s);
    const t = b.taken.find(x => x.id === taakId);
    if (!t) return { error: 'Taak niet gevonden.' };
    t.klaar = true; t.klaarOp = nu(); t.door = scho(door, 40) || null;
    save(); return { ok: true };
  }

  /* ---- de AI-adviseur: beantwoordt vragen en DOET dingen ---- */
  // Ingebouwde kennisbank (werkt zonder Claude-sleutel).
  return { zetProduct, productVan, markeerInSalon, kiesType, zetPerceel, zaaiPerceel, waterPerceel, oogstPerceel, zetDier, voerDier, opbrengstDier, zetTaak, rondTaak };
};
