/* Supplier (deelmodule): de zaakinstellingen (manager). Open/dicht voor
   bestellingen en reserveringen, de genre-opties, land + uurloon voor de
   boekhouding, de luchtzijde-stand met toeslag en het vervoerderstarief. Bij
   het dichtzetten van de bestellingen valt de shift-samenvatting vanzelf als
   bericht naar het team. Afgesplitst uit toegang.js zodat elk deel klein
   blijft. */
module.exports = (kern) => {
  const { app, supplierAuth, managerOnly, ZAAK_OPTIES, LANDEN, save, logActivity,
    broadcastSync, sseToSupplier, shiftSamenvatting, notifySupplier } = kern;

  app.post('/api/supplier/settings', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const st = req.supplier.settings = req.supplier.settings || { ordersOpen: true, reservationsOpen: true };
    const changed = [];
    if (typeof req.body.ordersOpen === 'boolean' && st.ordersOpen !== req.body.ordersOpen) { st.ordersOpen = req.body.ordersOpen; changed.push('bestellingen ' + (st.ordersOpen ? 'open' : 'dicht')); }
    if (typeof req.body.reservationsOpen === 'boolean' && st.reservationsOpen !== req.body.reservationsOpen) { st.reservationsOpen = req.body.reservationsOpen; changed.push('reserveringen ' + (st.reservationsOpen ? 'open' : 'dicht')); }
    if (req.body.opties && typeof req.body.opties === 'object') {
      st.opties = st.opties || {};
      for (const k of Object.keys(ZAAK_OPTIES)) {
        if (typeof req.body.opties[k] === 'boolean' && st.opties[k] !== req.body.opties[k]) {
          st.opties[k] = req.body.opties[k];
          changed.push(ZAAK_OPTIES[k] + ' ' + (req.body.opties[k] ? 'aan' : 'uit'));
        }
      }
    }
    // boekhouding: het land bepaalt de tarieven en regels, het uurloon de personeelskosten
    if (typeof req.body.land === 'string' && LANDEN[req.body.land] && st.land !== req.body.land) {
      st.land = req.body.land;
      changed.push('het land op ' + LANDEN[req.body.land].naam);
    }
    if (req.body.uurloon != null) {
      const u = Number(req.body.uurloon);
      if (Number.isFinite(u) && u >= 0 && u <= 500) { st.uurloon = Math.round(u * 100) / 100; changed.push('het uurloon bij'); }
    }
    // luchtzijde: de zaak staat op een luchthaven (achter security). De kassa
    // toont dan dubbele prijzen (normaal + luchthaven, met deze toeslag) en de
    // deur vraagt om een boarding pass (/api/supplier/lucht/pass).
    if (typeof req.body.luchtzijde === 'boolean' && st.luchtzijde !== req.body.luchtzijde) {
      st.luchtzijde = req.body.luchtzijde;
      changed.push('de luchtzijde-stand ' + (st.luchtzijde ? 'aan' : 'uit'));
    }
    if (req.body.luchtToeslagPct != null) {
      const p = Math.round(Number(req.body.luchtToeslagPct));
      if (Number.isFinite(p) && p >= 0 && p <= 100) { st.luchtToeslagPct = p; changed.push('de luchthaventoeslag op ' + p + '%'); }
    }
    // vervoerders: het tarief dat elke nieuwe rit direct een vaste prijs geeft
    if (req.body.tarief && typeof req.body.tarief === 'object') {
      const t = st.tarief = st.tarief || {};
      for (const k of ['start', 'perKm', 'minimum']) {
        const v = Number(req.body.tarief[k]);
        if (Number.isFinite(v) && v >= 0 && v <= 100000) t[k] = Math.round(v * 100) / 100;
      }
      changed.push('het tarief bij');
    }
    save();
    if (changed.length) logActivity(req.supplier.code, req.actor, 'zette ' + changed.join(' en '));
    broadcastSync(['rtg', 'lifestyle', 'business'], 'orders');
    sseToSupplier(req.supplier.code, 'sync', { scope: 'settings' });
    // gaat de zaak dicht, dan komt de shift-samenvatting vanzelf als bericht
    // naar het team: het avondbriefing-moment zonder dat iemand erom vraagt
    if (changed.includes('bestellingen dicht')) {
      try {
        const sh = shiftSamenvatting(req.supplier);
        const delen = [
          '€ ' + sh.omzet.toFixed(2) + ' omzet, ' + sh.bonnen + ' bon(nen)',
          sh.gasten.personen ? sh.gasten.personen + ' gasten aan tafel' : null,
          sh.gasten.noShows ? sh.gasten.noShows + ' no-show(s)' : null,
          sh.toppers.length ? 'topper: ' + sh.toppers[0].aantal + 'x ' + sh.toppers[0].naam : null,
          sh.derving ? '€ ' + sh.derving.toFixed(2) + ' derving' : null
        ].filter(Boolean);
        notifySupplier(req.supplier.code, { icon: '🌙', title: 'Shift-samenvatting ' + sh.datum, body: delen.join(' · ') });
      } catch (e) {}
    }
    res.json({ ok: true, settings: st });
  });
};
