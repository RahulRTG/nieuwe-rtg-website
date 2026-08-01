/* Member (deelmodule): de MUNTKANT van betalen -- welke munten en tegen welke
   koers, een ontvangstverzoek maken voor een factuur, en rechtstreeks met munten
   betalen aan een partner.

   De euro-kant (kaart, facturen) staat in ./betalen.js. Afgesplitst toen dat
   bestand de 10 KB passeerde; het zijn ook echt twee onderwerpen, met elk een
   eigen aanbieder en een eigen webhook. */
const { veiligeFout } = require('../../kern/util');
module.exports = (mctx) => {
  const { app, auth, db, save, accounts, memberTemplate, betaal, fonds, munten, factuur,
    broadcastSync, stateFor, findSupplier, liveCodename, ledenStaat } = mctx;

  app.post('/api/munt/opties', (req, res) => res.json(munten.opties()));

  app.post('/api/munt/verzoek', auth, async (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    if (!munten.aan()) return res.status(503).json({ error: 'Betalen met munten is niet beschikbaar.' });
    const own = !!req.session.account;
    const md = ledenStaat(req);
    const inv = (md.invoices || []).find(i => i.id === req.body.invoiceId);
    if (!inv) return res.status(404).json({ error: 'Factuur niet gevonden.' });
    if (inv.status === 'paid') return res.status(409).json({ error: 'Deze factuur is al betaald.' });
    const euroCenten = Math.max(1, Math.round((inv.bijdrage || 0) * 100));
    const wie = own ? ('acc:' + req.session.account.id) : ('sess:' + req.session.tier);
    try {
      const verzoek = await munten.maakVerzoek({
        euroCenten, munt: req.body.munt, referentie: String(inv.id),
        idempotentieSleutel: wie + ':muntinv:' + inv.id + ':' + String(req.body.munt || '').toLowerCase(),
        context: { soort: 'factuur', wie, invoiceId: inv.id, own, accountId: own ? req.session.account.id : null }
      });
      res.json({ ok: true, verzoek });
    } catch (e) { res.status(400).json({ error: veiligeFout(e, 'Kon geen munt-adres maken.') }); }
  });

  /* Rechtstreeks een partner betalen met munten. Zelfde afhandeling als een gewone
     directe betaling, maar het geld komt via de munt-aanbieder binnen (omgezet naar
     euro); de webhook crediteert dan de leverancier. */
  app.post('/api/munt/direct', auth, async (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    if (!munten.aan()) return res.status(503).json({ error: 'Betalen met munten is niet beschikbaar.' });
    const s = findSupplier(req.body.supplierCode);
    if (!s) return res.status(404).json({ error: 'Leverancier niet gevonden.' });
    const euroCenten = Math.round(Number(req.body.bedrag) * 100);
    if (!(euroCenten >= 50)) return res.status(400).json({ error: 'Kies een bedrag van minstens € 0,50.' });
    const key = req.session.key;
    const codename = liveCodename(req.session);
    try {
      const verzoek = await munten.maakVerzoek({
        euroCenten, munt: req.body.munt, referentie: 'DP-' + s.code,
        idempotentieSleutel: key + ':muntdirect:' + s.code + ':' + euroCenten + ':' + String(req.body.munt || '').toLowerCase() + ':' + Date.now(),
        context: { soort: 'direct', key, codename, supplierCode: s.code, omschrijving: String(req.body.omschrijving || '').slice(0, 120) }
      });
      res.json({ ok: true, verzoek, supplier: { code: s.code, name: s.name } });
    } catch (e) { res.status(400).json({ error: veiligeFout(e, 'Kon geen munt-adres maken.') }); }
  });

};
