/* De live-stroom van een zaak (SSE), uit ../supplier.js gelicht.

   Bij het OPENEN keurt hij de personeelssessie, de zaak en het personeelslid,
   zoals altijd. Sinds AUTHORITY.md fase 3 geeft hij ook een `geldig()` mee, die
   kern/sse.js vlak voor ELK bericht vraagt: een ingetrokken sessie of een
   geschorste zaak blijft niet meelezen tot de verbinding vanzelf valt. */
/* `ongelezen` komt van ../supplier.js, dat de meldingen van de zaak al leest:
   zo raakt dit bestand db.data niet zelf aan. */
/* SINDS DE SESSIESTROOM (../../kern/sessiestroom.js) staat de sessie niet meer
   in het adres: het scherm ruilt hem via POST /api/stroom/ticket (stroom
   `zaak`) voor een eenmalig ticket. `zaakSessieMag` is de ENE toets, voor de
   uitgifte, het openen en elk bericht -- dezelfde vragen als de deur altijd
   stelde. Een volledig token in ?token= krijgt 401. */
module.exports = (kern, ongelezen) => {
  const { accounts, app, findSupplier, sessionFor, sseClients, sseSend, sessiestroom } = kern;

function zaakSessieMag(tok) {
  const sess = sessionFor(tok);
  if (!accounts.controleerStaffSessie(sess).ok) return null;
  const supplier = findSupplier(sess.code);
  if (!supplier || supplier.partnerStatus === 'geschorst' || supplier.partnerStatus === 'beeindigd') return null;
  if (sess.staffId != null) {
    const staff = accounts.getStaffById(Number(sess.staffId));
    if (!staff || String(staff.supplier_code).toUpperCase() !== String(sess.code).toUpperCase()) return null;
  }
  return sess;
}
sessiestroom.soort('zaak', { geldig: raw => !!zaakSessieMag(raw) });

app.get('/api/supplier/stream', async (req, res) => {
  if (req.query.token !== undefined) return res.status(401).end();
  const uit = await sessiestroom.open('zaak', req.query.ticket);
  if (!uit.ok) return res.status(uit.status || 401).end();
  const tok = uit.token;
  const sess = zaakSessieMag(tok);
  if (!sess) return res.status(401).end();
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' });
  res.write('retry: 3000\n\n');
  const client = { sup: sess.code, staffId: sess.staffId != null ? sess.staffId : null, res,
    /* per bericht dezelfde lichte vraag als voorheen (sessie en zaak, geen
       personeelsopzoeking per bericht) */
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
