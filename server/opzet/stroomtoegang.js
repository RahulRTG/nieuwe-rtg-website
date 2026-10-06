/* DE STROOMTOEGANG: de ene ruilplek van sessie naar stroomticket, en de
   live-verbinding van een lid (/api/stream), uit server.js gelicht.

   POST /api/stroom/ticket neemt de sessie UITSLUITEND uit de kop
   `Authorization: Bearer`, nooit uit het lijf of het adres -- anders was de
   ruil zelf het lek. Het lijf zegt alleen WELKE stroom (`stroom`) en, waar een
   soort dat vraagt, voor welk onderwerp (`id`). De soorten zelf worden
   geregistreerd door de domeinen die de deur bezitten (../kern/sessiestroom.js):
   `lid` hieronder, `zaak` in ../routes/supplier/stroom.js, `kantoor` in
   ../routes/office/toegang.js en `theater-kijk` in ../routes/theater.js.

   /api/stream neemt sinds deze stap alleen nog `?ticket=`. Een volledig token
   in `?token=` krijgt 401, ook als het geldig is: een deur die beide aanneemt
   houdt het lek open voor elke client die nog de oude vorm stuurt. */
'use strict';

module.exports = function stroomtoegang({ app, db, crypto, bewerkCollectie, accounts, resolveSession,
  sseClients, sseSend, speelOpnieuw, meldingenVan }) {
  const sessiestroom = require('../kern/sessiestroom').maak({ db, crypto, bewerkCollectie,
    zegelSleutel: () => (accounts && typeof accounts.sleutelVoor === 'function'
      ? accounts.sleutelVoor('sessiestroom-zegel-v1') : null) });

  /* De ledenstroom stelt dezelfde vraag als altijd: kent resolveSession dit
     token. */
  sessiestroom.soort('lid', { geldig: raw => !!resolveSession(raw) });

  app.post('/api/stroom/ticket', async (req, res) => {
    const kop = req.get('authorization') || '';
    const raw = kop.startsWith('Bearer ') ? kop.slice(7).trim() : '';
    if (!raw) return res.status(401).json({ error: 'Stuur de sessie in de kop Authorization: Bearer.' });
    const b = req.body || {};
    const uit = await sessiestroom.geef(String(b.stroom || 'lid'), raw, b.id);
    if (!uit.ok) return res.status(uit.status || 401).json({ error: uit.error || 'Geen toegang.' });
    res.set('Cache-Control', 'no-store');
    res.json({ ticket: uit.ticket, geldigTot: uit.geldigTot });
  });

  /* Live-verbinding. EventSource kan geen Authorization-kop sturen, dus het
     scherm ruilt zijn sessie eerst voor een ticket (hierboven) en alleen dat
     ticket staat in het adres. Verbindt de browser vanzelf opnieuw met dezelfde
     URL, dan is het ticket op: 401, en shared/stroom.js haalt een nieuw. */
  app.get('/api/stream', async (req, res) => {
    if (req.query.token !== undefined) return res.status(401).json({
      error: 'Een sessie hoort niet in een adres.',
      hoe: 'Vraag een stroomticket met POST /api/stroom/ticket (sessie in de kop) en open de stroom met ?ticket=.' });
    const uit = await sessiestroom.open('lid', req.query.ticket);
    if (!uit.ok) return res.status(uit.status || 401).end();
    const token = uit.token;
    const sess = resolveSession(token);
    if (!sess) return res.status(401).end();
    const isolatieRealtime = require('../middleware/isolatiepoort-realtime');
    const bewaakt = isolatieRealtime.registreer({ res, token, sessie: sess });
    if (!bewaakt.toegestaan) return res.status(bewaakt.status || 503).json(bewaakt.antwoord);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    });
    /* Open de SSE-handshake nu. De PostgreSQL-antwoordgrens buffert gewone
       antwoorden tot COMMIT; voor deze read-only stroom is flushHeaders het
       expliciete teken dat de stream veilig mag beginnen. */
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    res.write('retry: 3000\n\n');
    const client = { tier: sess.tier, key: sess.key, res };
    sseClients.push(client);
    // gemiste persoonlijke events opnieuw afspelen (na een korte verbroken verbinding)
    const sinds = Number(req.headers['last-event-id'] || req.query.since || 0);
    if (sinds) speelOpnieuw(res, sess.key, sinds);
    // onopgehaalde notificaties meteen meesturen -- uit dezelfde twee bakken als
    // /api/notifications, anders mist de handshake juist de persoonlijke berichten
    const unread = meldingenVan(sess).filter(n => !n.read);
    sseSend(res, 'hello', { unread });
    const ping = setInterval(() => {
      if (!isolatieRealtime.magSchrijven(res)) return clearInterval(ping);
      res.write(': ping\n\n');
    }, 25000);
    req.on('close', () => {
      clearInterval(ping);
      isolatieRealtime.vergeet(res);
      const i = sseClients.indexOf(client);
      if (i >= 0) sseClients.splice(i, 1);
    });
  });

  return { sessiestroom };
};
