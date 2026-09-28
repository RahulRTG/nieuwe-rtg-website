/* Member-submodule: de AFHAALCODE van een eigen bestelling tonen of intrekken.

   De code zelf woont in server/kern/afhaalcode.js. Deze twee routes zijn de
   enige ingang voor het lid, en de eerste is de enige plek in het huis waar
   de kale code ooit in een antwoord staat: uitgeven IS roteren, dus elke tik
   op "Toon afhaal-QR" maakt een nieuwe code en trekt de vorige in. Het
   antwoord staat daarom in server/lib/eenmalig-geheim-routes.js: geen
   generieke retrycache mag hem bewaren of herhalen, en de browser krijgt
   no-store.

   Waarom de code niet al bij het bestellen meekomt. /api/order en
   /api/bezorg/bestel worden door de dubbeltik-laag beschermd, en een antwoord
   met een geheim erin mag daar niet in. Door de uitgifte hier te houden blijven
   bestellen en betalen herhaalbaar, en bestaat het geheim pas als het lid het
   wil tonen -- met een vervaltijd van uren in plaats van de levensduur van de
   order. */
module.exports = (kern) => {
  const { app, auth, orderMetRef, afhaalcode } = kern;

  const eigen = (req) => {
    const o = orderMetRef(String(req.body.ref || '').slice(0, 40));
    return o && (o.customerKey || o.customerTier) === req.session.key ? o : null;
  };

  app.post('/api/order/afhaalcode', auth, async (req, res) => {
    const o = eigen(req);
    if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
    let r;
    try { r = await afhaalcode.uitgeven({ order: o, key: req.session.key }); }
    catch (e) { return res.status(503).json({ error: 'De afhaalcode kon nu niet veilig worden gemaakt. Probeer het zo opnieuw.' }); }
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true, eenmalig: true, code: r.code, bon: o.pickup || null, afhaal: r.afhaal });
  });

  app.post('/api/order/afhaalcode/intrek', auth, async (req, res) => {
    const o = eigen(req);
    if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
    let r;
    try { r = await afhaalcode.sluit({ order: o, key: req.session.key, reden: 'lid heeft de afhaalcode ingetrokken' }); }
    catch (e) { return res.status(503).json({ error: 'De afhaalcode kon nu niet veilig worden ingetrokken. Probeer het zo opnieuw.' }); }
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ok: true, afhaal: r.afhaal });
  });
};
