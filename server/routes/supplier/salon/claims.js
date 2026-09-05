/* Kassakant van de Salon-claimcredential. De route logt alleen titel en
   codenaam; de kale bearer staat nooit in een log of een tweede antwoord. */
'use strict';

module.exports = (kern) => {
  const { app, supplierAuth, salonClaimcode, logActivity } = kern;
  const sleutel = (req, b) => String(b.idem || b.idempotentieSleutel ||
    (req.get && req.get('Idempotency-Key')) || '');
  const actor = req => String((req.actor && (req.actor.id || req.actor.memberId ||
    req.actor.name || req.actor.role)) || 'onbekend');

  app.post('/api/supplier/salon/deal/redeem', supplierAuth, async (req, res) => {
    const b = req.body || {};
    const r = await salonClaimcode.verzilver({ code: b.code,
      partnerCode: req.supplier.code, actor: actor(req),
      idempotentieSleutel: sleutel(req, { idem: b.idem,
        idempotentieSleutel: b.idempotentieSleutel }) });
    const { status, partnerCode, ...uit } = r;
    if (status === 200 && !r.herhaald) {
      try { logActivity(req.supplier.code, req.actor,
        'verzilverde aanbieding "' + r.titel + '" voor ' + r.codename); } catch (e) {}
    }
    res.status(status || (r.error ? 400 : 200)).json(uit);
  });
};
