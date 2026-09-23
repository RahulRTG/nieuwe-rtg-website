/* De live-stroom van een zaak (SSE), uit ../supplier.js gelicht.

   Bij het OPENEN keurt hij de personeelssessie, de zaak en het personeelslid,
   zoals altijd. Sinds AUTHORITY.md fase 3 geeft hij ook een `geldig()` mee, die
   kern/sse.js vlak voor ELK bericht vraagt: een ingetrokken sessie of een
   geschorste zaak blijft niet meelezen tot de verbinding vanzelf valt. */
/* `ongelezen` komt van ../supplier.js, dat de meldingen van de zaak al leest:
   zo raakt dit bestand db.data niet zelf aan. */
module.exports = (kern, ongelezen) => {
  const { accounts, app, findSupplier, sessionFor, sseClients, sseSend } = kern;

app.get('/api/supplier/stream', (req, res) => {
  const sess = sessionFor(req.query.token);
  if (!accounts.controleerStaffSessie(sess).ok) return res.status(401).end();
  const supplier = findSupplier(sess.code);
  if (!supplier || supplier.partnerStatus === 'geschorst' || supplier.partnerStatus === 'beeindigd')
    return res.status(401).end();
  if (sess.staffId != null) {
    const staff = accounts.getStaffById(Number(sess.staffId));
    if (!staff || String(staff.supplier_code).toUpperCase() !== String(sess.code).toUpperCase()) return res.status(401).end();
  }
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' });
  res.write('retry: 3000\n\n');
  const tok = req.query.token;
  const client = { sup: sess.code, staffId: sess.staffId != null ? sess.staffId : null, res,
    geldig: () => {
      const s = sessionFor(tok);
      if (!accounts.controleerStaffSessie(s).ok) return false;
      const z = findSupplier(s.code);
      return !!z && z.partnerStatus !== 'geschorst' && z.partnerStatus !== 'beeindigd';
    } };
  sseClients.push(client);
  sseSend(res, 'hello', { unread: ongelezen(sess.code) });
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); const i = sseClients.indexOf(client); if (i >= 0) sseClients.splice(i, 1); });
});

};
