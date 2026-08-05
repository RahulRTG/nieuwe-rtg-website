/* Routes voor de MAILINFRASTRUCTUUR: de verzendwachtrij en de buitenpoort die
   een echt RFC 5322-bericht aanneemt.

   TWEE SOORTEN INGANG, en ze horen streng gescheiden te blijven:

   - /api/office/mail/... : het BEHEER van de wachtrij. Achter de backoffice-
     inlog, want hier staat wie wat wanneer gestuurd heeft en waarom het
     misging.
   - /api/mail/binnen : de BUITENPOORT. Die is publiek, want een vreemde
     mailserver heeft geen inlog bij ons. Daarom staat er een rem op (aantal
     per minuut) en gaat alles wat hier binnenkomt in de ONBETROUWDE baan --
     wat de afzender ook beweert. Het origineel wordt bewaard, de afgeleide
     gaat naar RTMAIL.

   De buitenpoort neemt bewust NIET zelf een postvak aan uit de body: hij leest
   de To-kop van het bericht zelf. Een poort die de ontvanger uit een parameter
   haalt, is een open relay met extra stappen. */
module.exports = (kern) => {
  const { app, officeAuth, mailQ, mailIn, mailAuth, rtmail, werkmail } = kern;
  const body = (req) => (req && req.body) || {};

  /* ---- beheer van de wachtrij (backoffice) ---- */
  app.post('/api/office/mail/wachtrij', officeAuth, (req, res) => {
    res.json(Object.assign({ ok: true }, mailQ.stand()));
  });

  app.post('/api/office/mail/werk', officeAuth, async (req, res) => {
    const uit = await mailQ.werk({ maxPerRonde: body(req).maxPerRonde });
    res.json({ ok: true, ronde: uit, stand: mailQ.stand(),
      let: 'Er loopt geen wekker: een ronde draait wanneer iemand hem aanroept. Zo haalt de wachtrij zijn achterstand vanzelf in en kan hij niet stil uitvallen.' });
  });

  app.post('/api/office/mail/opnieuw', officeAuth, (req, res) => {
    const b = body(req);
    const r = mailQ.opnieuw(String(b.id || ''), { ookPermanent: !!b.ookPermanent });
    if (r.error) return res.status(400).json(r);
    res.json(r);
  });

  /* ---- de buitenpoort ----
     PUBLIEK met opzet: een vreemde mailserver heeft geen inlog. De rem staat
     hieronder en de baan is altijd de onbetrouwde. */
  let venster = 0, teller = 0;
  app.post('/api/mail/binnen', async (req, res) => {
    const min = Math.floor(Date.now() / 60000);
    if (min !== venster) { venster = min; teller = 0; }
    if (++teller > 120) return res.status(429).json({ error: 'De buitenpoort staat even dicht; probeer het over een minuut.' });

    const ruw = String(body(req).bericht || '');
    const ip = String(body(req).ip || '') || req.ip;
    const d = mailIn.ontleed(ruw, { publiekeSleutel: body(req).publiekeSleutel, ip });
    if (d.error) return res.status(400).json({ error: d.error });

    /* SPF en DMARC ECHT opzoeken. Dit is de enige plek waar de buitenpoort het
       netwerk op gaat, en een storing daar mag de bezorging niet tegenhouden:
       de uitslag valt dan terug op wat er zonder DNS te zeggen valt. Post die
       binnen is, hoort bezorgd te worden -- de uitslag is een STEMPEL, geen
       poortwachter. */
    try {
      d.controles = await mailIn.stempelVol(d.koppen, ruw.slice(ruw.search(/\r?\n\r?\n/)).replace(/^\r?\n\r?\n/, ''),
        { publiekeSleutel: body(req).publiekeSleutel, ip, envelopeVan: body(req).envelopeVan, helo: body(req).helo, auth: mailAuth });
    } catch (e) {
      d.controles.let = 'De SPF- en DMARC-controle liep vast (' + (e && e.message) + '); het bericht is wel bezorgd.';
    }

    /* Het origineel eerst, de afgeleide daarna. In die volgorde: gaat de
       bezorging mis, dan hebben we de bytes nog steeds. */
    const bewaard = mailIn.bewaarOrigineel(ruw, null);
    const naar = d.naar || '';
    if (!naar) return res.status(400).json({ error: 'Dit bericht heeft geen ontvanger in de To-kop.', origineel: bewaard.id });

    /* Alles van buiten valt in de onbetrouwde baan -- links onklikbaar, geen
       bijlagen. De bijlagen die er WEL in zaten worden benoemd, niet bewaard:
       er is geen malwarelaag, dus wordt er niets opgeslagen dat te openen valt. */
    const bijlagenLijst = d.bijlagen.length
      ? '\n\n[Dit bericht had ' + d.bijlagen.length + ' bijlage(n): ' +
        d.bijlagen.map(b => b.naam).join(', ') + '. RTG Mail bewaart nooit een te openen bijlage.]'
      : '';
    const controles = '\n\n[Controles: DKIM ' + d.controles.dkim + '; SPF ' + d.controles.spf + '; DMARC ' + d.controles.dmarc + '.]';
    const m = rtmail.stuur({ van: d.van, naar, onderwerp: d.onderwerp,
      tekst: d.tekst + bijlagenLijst + controles, soort: 'extern', bron: 'extern' });
    if (m && m.error) return res.status(400).json({ error: m.error, origineel: bewaard.id });

    res.json({ ok: true, id: m.id, origineel: bewaard.id, controles: d.controles,
      bijlagen: d.bijlagen.map(b => ({ naam: b.naam, soort: b.soort, bytes: b.bytes })),
      let: 'Het originele bericht is onveranderd bewaard; wat in het postvak staat is een afgeleide.' });
  });

  /* Het origineel terugvragen. Achter de backoffice-inlog, want dit is de ruwe
     post van iemand anders. */
  app.post('/api/office/mail/origineel', officeAuth, (req, res) => {
    const o = mailIn.origineel(String(body(req).id || ''));
    if (!o) return res.status(404).json({ error: 'Dat origineel is er niet.' });
    res.json({ ok: true, id: o.id, bytes: o.bytes, at: o.at, ruw: o.ruw });
  });

  /* De buitenpost EN de wachtrij in een: een bericht dat het huis verlaat gaat
     niet meer rechtstreeks weg maar in de lade. Zie kern/mailwachtrij.js voor
     waarom dat bij post het enige juiste is. */
  app.post('/api/office/mail/uit', officeAuth, (req, res) => {
    const b = body(req);
    const r = mailQ.zet({ naar: b.naar, onderwerp: b.onderwerp, tekst: b.tekst,
      sleutel: b.sleutel, bron: 'backoffice' });
    if (r.error) return res.status(400).json(r);
    res.json(r);
  });
};
