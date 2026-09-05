/* Lidkant van de Salon-claimcredential. Kale codes verlaten deze drie routes
   alleen bij een eerste uitgifte of rotatie; alle beslissingen zelf zitten in
   kern/salon-claimcode en lopen door het posts-collectieslot. */
'use strict';

module.exports = (kern) => {
  const { app, auth, notifySupplier, PERSONAS, salonClaimcode } = kern;
  const sleutel = (req, b) => String(b.idem || b.idempotentieSleutel ||
    (req.get && req.get('Idempotency-Key')) || '');
  const stuur = (res, r) => {
    const { status, partnerCode, titel, aantal, ...uit } = r;
    return res.status(status || (r.error ? 400 : 200)).json(uit);
  };
  const lid = (req, res) => {
    if (req.session.tier !== 'guest') return true;
    res.status(403).json({ error: 'Alleen voor leden.' });
    return false;
  };

  app.post('/api/salon/deal/claim', auth, async (req, res) => {
    if (!lid(req, res)) return;
    const b = req.body || {};
    const codename = req.session.account
      ? req.session.account.codename : PERSONAS[req.session.tier].codename;
    const r = await salonClaimcode.uitgeven({ postId: b.postId,
      key: req.session.key, codename,
      idempotentieSleutel: sleutel(req, { idem: b.idem,
        idempotentieSleutel: b.idempotentieSleutel }) });
    if (r.status === 200) {
      try { notifySupplier(r.partnerCode, { icon: 'attenties', title: 'Aanbieding geclaimd',
        body: codename + ' claimde "' + r.titel + '" (' + r.aantal + 'x totaal).' }); } catch (e) {}
    }
    stuur(res, r);
  });

  app.post('/api/salon/deal/claim/roteer', auth, async (req, res) => {
    if (!lid(req, res)) return;
    const b = req.body || {};
    stuur(res, await salonClaimcode.roteer({ postId: b.postId,
      key: req.session.key, idempotentieSleutel: sleutel(req, { idem: b.idem,
        idempotentieSleutel: b.idempotentieSleutel }) }));
  });

  app.post('/api/salon/deal/claim/intrek', auth, async (req, res) => {
    if (!lid(req, res)) return;
    const b = req.body || {};
    stuur(res, await salonClaimcode.intrekken({ postId: b.postId,
      key: req.session.key, idempotentieSleutel: sleutel(req, { idem: b.idem,
        idempotentieSleutel: b.idempotentieSleutel }) }));
  });
};
