/* Gemeente-domein "vergunningen": pijler 3. Een inwoner of onderneming vraagt een
   vergunning aan (bouw, evenement, terras, horeca, kap, standplaats) en volgt hem;
   de gemeente-medewerker beoordeelt, stelt voorwaarden en een verleende vergunning
   wordt automatisch een openbare bekendmaking. Krijgt de gedeelde ctx van
   kern/gemeente/index.js. */
module.exports = (ctx) => {
  const { db, save, nu, id, ref, schoon, seed, deGemeente, notifySupplier, sseToSupplier, VERGUNNINGEN } = ctx;

  function vergunningAanvraag(aanvrager, data) {
    seed();
    data = data || {};
    const soort = VERGUNNINGEN[data.soort] ? data.soort : null;
    if (!soort) return { status: 400, error: 'Kies een geldige vergunningsoort.' };
    const omschrijving = schoon(data.omschrijving, 800);
    if (omschrijving.length < 6) return { status: 400, error: 'Omschrijf je aanvraag.' };
    const g = deGemeente();
    const v = {
      id: id(), ref: ref('G'), gemeente: g ? g.code : 'GEMEENTE', soort, soortLabel: VERGUNNINGEN[soort],
      omschrijving, locatie: schoon(data.locatie, 160) || null,
      aanvragerKey: aanvrager.key || null, aanvrager: aanvrager.codenaam || null,
      supplierCode: aanvrager.supplierCode || null, bedrijf: aanvrager.bedrijf || null,
      status: 'ingediend', voorwaarden: [], besluit: null, bekend: false, at: nu()
    };
    db.data.gemeenteVergunningen.unshift(v);
    db.data.gemeenteVergunningen = db.data.gemeenteVergunningen.slice(0, 20000);
    save();
    if (g && notifySupplier) notifySupplier(g.code, { icon: '\u{1F4DC}', title: 'Vergunningaanvraag: ' + VERGUNNINGEN[soort], body: (v.aanvrager || v.bedrijf || 'aanvrager') + ': ' + omschrijving.slice(0, 80) });
    if (g && sseToSupplier) sseToSupplier(g.code, 'sync', { scope: 'gemeente' });
    return { ok: true, vergunning: publiekeVerg(v) };
  }
  function publiekeVerg(v) {
    return { ref: v.ref, soort: v.soort, soortLabel: v.soortLabel, omschrijving: v.omschrijving, locatie: v.locatie,
      status: v.status, voorwaarden: v.voorwaarden || [], besluit: v.besluit, at: v.at };
  }
  function mijnVergunningen(key) {
    return (db.data.gemeenteVergunningen || []).filter(v => v.aanvragerKey === key).slice(0, 50).map(publiekeVerg);
  }
  function vergunningenVanPartner(code) {
    return (db.data.gemeenteVergunningen || []).filter(v => v.supplierCode === code).slice(0, 50).map(publiekeVerg);
  }

  /* ---- gemeente-medewerkers ---- */
  function vergunningenLijst(filter) {
    seed();
    filter = filter || {};
    let list = (db.data.gemeenteVergunningen || []);
    if (filter.status) list = list.filter(v => v.status === filter.status);
    else list = list.filter(v => ['ingediend', 'in behandeling'].includes(v.status));
    return { ok: true, vergunningen: list.slice(0, 200).map(v => ({ ...publiekeVerg(v), aanvrager: v.aanvrager || v.bedrijf || null })) };
  }
  function vergunningBeslis(actor, r, data) {
    data = data || {};
    const v = (db.data.gemeenteVergunningen || []).find(x => x.ref === String(r || ''));
    if (!v) return { status: 404, error: 'Vergunning niet gevonden.' };
    const besluit = data.besluit;
    if (!['verleend', 'geweigerd', 'in behandeling'].includes(besluit)) return { status: 400, error: 'Kies een geldig besluit.' };
    v.status = besluit;
    if (Array.isArray(data.voorwaarden)) v.voorwaarden = data.voorwaarden.map(x => schoon(x, 200)).filter(Boolean).slice(0, 12);
    v.besluit = { door: actor || 'gemeente', motivatie: schoon(data.motivatie, 400) || null, at: nu() };
    save();
    // een verleende vergunning wordt een openbare bekendmaking
    if (besluit === 'verleend' && data.bekend !== false && !v.bekend) {
      v.bekend = true;
      db.data.gemeenteBekend.unshift({ id: id(), gemeente: v.gemeente, titel: 'Verleend: ' + v.soortLabel + (v.locatie ? ' (' + v.locatie + ')' : ''),
        tekst: v.omschrijving.slice(0, 200), soort: 'vergunning', at: nu() });
      save();
    }
    const g = deGemeente(); if (g && sseToSupplier) sseToSupplier(g.code, 'sync', { scope: 'gemeente' });
    return { ok: true, vergunning: publiekeVerg(v) };
  }

  return { vergunningAanvraag, mijnVergunningen, vergunningenVanPartner, vergunningenLijst, vergunningBeslis };
};
