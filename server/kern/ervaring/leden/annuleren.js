/* Leden-deel "annuleren" (kern/ervaring/leden): annuleren door het lid.
   Verbatim afgesplitst uit leden.js.

   De WACHTLIJST stond hier ook en woont sinds 13 september 2026 in
   ./wachtlijst.js -- dit bestand stond op drie bytes van de 10 KB-grens van
   keuringsregel 13. De band blijft: bij een geannuleerde plek (ticket, event)
   krijgt de eerste op de wachtlijst meteen bericht, dus annuleerItem roept
   meldWachtlijst() daar aan. */
module.exports = (ctx) => {
  const { db, save, findSupplier, notify, notifySupplier, sseToSupplier, sseToOffice, sseToCustomer,
    ticketsVoorSlot, orderMetRef, boekingMetRef, id, nu, payVan } = ctx;

  /* GELD TERUG, EN ALLEEN VOOR WAT ECHT IS BETAALD.

     Deze functie zette `paid = false, refunded = true` en meldde "€ x retour" --
     zonder dat er ooit iets was overgemaakt. Dat kon, want de betaalpaden
     verplaatsten zelf ook geen geld. Nu ze dat wel doen, zou dezelfde regel het
     omgekeerde betekenen: de zaak houdt het geld en het lid krijgt een bericht
     dat het terug is.

     De marker `payBetaaldCenten` bepaalt of er iets te boeken valt. Dat is met
     opzet en niet `paid`: transacties van VOOR deze ronde en paden die nog niet
     via RTG Pay lopen (een ticket, een boeking) dragen hem niet, en die horen
     zich precies te gedragen zoals ze deden. Wie zo'n pad omzet, zet de marker
     en krijgt de terugweg cadeau.

     De codenaam komt van de TRANSACTIE en niet uit de sessie: het geld hoort
     terug naar de wallet waar het vandaan kwam, ook als het lid inmiddels een
     andere codenaam draagt. */
  async function geldTerug(item, oms) {
    if (item.payBetaaldCenten == null) return { ok: true, overgeslagen: true };
    const pay = typeof payVan === 'function' ? payVan() : null;
    if (!pay || !pay.terugZaak) return { ok: true, overgeslagen: true };
    const r = await pay.terugZaak({
      codenaam: item.customerCodename, supplierCode: item.supplierCode,
      centen: item.payBetaaldCenten, bijlageCenten: item.payBijgelegdCenten || 0,
      oms, ref: item.ref, idem: 'terug:' + item.ref
    });
    if (r.error) return r;
    item.payTerugCenten = r.terugCenten;
    item.payBetaaldCenten = null;   // een bon gaat maar een keer retour
    item.payBijgelegdCenten = null;
    return r;
  }

  /* ---- 2. annuleren door het lid ----
     Terugbetaalregels: een betaalde annulering spiegelt de refund-flow van de
     zaak. Voor een ORDER is dat sinds 13 september een tegenboeking (paid blijft
     staan, refunded erbij); rides en boekingen wissen nog. Orders kunnen tot de
     bereiding begint;
     ritten tot er een chauffeur op zit; tickets tot 24 uur voor het tijdslot;
     overige boekingen zolang ze niet afgerond zijn. */
  async function annuleerItem(sess, soort, ref) {
    const key = sess.key;
    if (soort === 'order') {
      const o = orderMetRef(ref);
      if (!o || (o.customerKey || o.customerTier) !== key) return { status: 404, error: 'Bestelling niet gevonden.' };
      if (!['wacht-op-betaling', 'nieuw'].includes(o.status)) return { status: 409, error: 'Deze bestelling is al in behandeling (' + o.status + ') en kan niet meer geannuleerd worden.' };
      const wasBetaald = o.paid;
      if (wasBetaald) {
        const terug = await geldTerug(o, 'Bestelling geannuleerd');
        if (terug.error) return terug;
      }
      // tegenboeking, niet wissen
      if (o.paid) { o.refunded = true; o.refundedAt = nu(); }
      o.status = wasBetaald ? 'terugbetaald' : 'geweigerd';
      o.geannuleerdDoor = 'lid';
      save();
      if (wasBetaald || o.status !== 'wacht-op-betaling') {
        notifySupplier(o.supplierCode, { icon: 'betalen', title: 'Bestelling geannuleerd', body: o.customerCodename + ' annuleerde ' + o.ref + (wasBetaald ? ' (€ ' + o.total + ' retour)' : '') });
        sseToSupplier(o.supplierCode, 'sync', { scope: 'orders' });
      }
      sseToOffice('sync', { scope: 'orders' });
      return { ok: true, terugbetaald: wasBetaald ? o.total : 0 };
    }
    if (soort === 'ride') {
      const r = db.data.rides.find(x => x.ref === ref && (x.customerKey || x.customerTier) === key);
      if (!r) return { status: 404, error: 'Rit niet gevonden.' };
      if (!['wacht-op-betaling', 'aangevraagd'].includes(r.status) || r.driver)
        return { status: 409, error: 'Deze rit is al toegewezen en kan niet meer geannuleerd worden. Bel de vervoerder.' };
      const wasBetaald = r.paid && r.quote > 0;
      if (wasBetaald) {
        const terug = await geldTerug(r, 'Rit geannuleerd');
        if (terug.error) return terug;
        r.paid = false; r.refunded = true; r.refundedAt = nu();
      }
      r.status = 'geweigerd';
      r.geannuleerdDoor = 'lid';
      save();
      notifySupplier(r.supplierCode, { icon: 'betalen', title: 'Rit geannuleerd', body: r.customerCodename + ' annuleerde ' + r.ref + (wasBetaald ? ' (€ ' + r.quote + ' retour)' : '') });
      sseToSupplier(r.supplierCode, 'sync', { scope: 'orders' });
      sseToOffice('sync', { scope: 'orders' });
      return { ok: true, terugbetaald: wasBetaald ? r.quote : 0 };
    }
    if (soort === 'boeking') {
      const b = (x => x && (x.customerKey || x.customerTier) === key ? x : undefined)(boekingMetRef(ref));
      if (!b) return { status: 404, error: 'Boeking niet gevonden.' };
      if (['afgerond', 'geweigerd'].includes(b.status)) return { status: 409, error: 'Deze boeking is al ' + b.status + '.' };
      if (b.kind === 'ticket') {
        const slotIso = b.datum + 'T' + (b.tijd || '23:59') + ':00';
        if (new Date(slotIso) - Date.now() < 24 * 3600000)
          return { status: 409, error: 'Tickets annuleert u tot 24 uur voor het tijdslot.' };
      }
      const wasBetaald = b.paid && (b.price || 0) > 0;
      if (wasBetaald) {
        const terug = await geldTerug(b, 'Boeking geannuleerd');
        if (terug.error) return terug;
        b.paid = false; b.refunded = true; b.refundedAt = nu();
      }
      b.status = 'geweigerd';
      b.geannuleerdDoor = 'lid';
      save();
      notifySupplier(b.supplierCode, { icon: 'betalen', title: (b.kind === 'ticket' ? 'Ticket' : 'Boeking') + ' geannuleerd', body: b.customerCodename + ' annuleerde ' + b.ref + (wasBetaald ? ' (€ ' + b.price + ' retour)' : '') });
      sseToSupplier(b.supplierCode, 'sync', { scope: 'orders' });
      sseToOffice('sync', { scope: 'orders' });
      // vrijgekomen plek: de eerste op de wachtlijst hoort het meteen
      if (b.kind === 'ticket') meldWachtlijst('slot:' + b.supplierCode + ':' + b.activiteitId + ':' + b.datum + ':' + b.tijd);
      return { ok: true, terugbetaald: wasBetaald ? b.price : 0 };
    }
    return { status: 400, error: 'Onbekend soort (order, ride of boeking).' };
  }

  /* De wachtlijst woont sinds 13 september in ./wachtlijst.js. De band blijft:
     een geannuleerde plek bericht de eerste op de lijst, dus annuleerItem roept
     meldWachtlijst() aan. Naar buiten toe verandert er niets -- de aanroepers
     krijgen dezelfde vijf namen uit dezelfde tas. */
  const wachtlijstOpslag = {
    lees() {
      if (!Array.isArray(db.data.wachtlijsten)) db.data.wachtlijsten = [];
      return db.data.wachtlijsten;
    },
    vervang(lijst) { db.data.wachtlijsten = lijst; }
  };
  const wachtlijst = require('./wachtlijst')(Object.assign({}, ctx, { wachtlijstOpslag }));
  const { zetOpWachtlijst, mijnWachtlijst, meldWachtlijst, rsvpAnnuleer } = wachtlijst;

  return { annuleerItem, zetOpWachtlijst, mijnWachtlijst, meldWachtlijst, rsvpAnnuleer };
};
