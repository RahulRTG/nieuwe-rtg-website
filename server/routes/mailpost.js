/* Routes voor de MAILINFRASTRUCTUUR: de verzendwachtrij en de buitenpoort die
   een echt RFC 5322-bericht aanneemt.

   TWEE SOORTEN INGANG, en ze horen streng gescheiden te blijven:

   - /api/office/mail/... : het BEHEER van de wachtrij. Achter de backoffice-
     inlog, want hier staat wie wat wanneer gestuurd heeft en waarom het
     misging.
   - /api/mail/ses : de productiepoort voor AWS SES. Alleen de Lambda-brug met
     het gedeelde HMAC-geheim komt binnen. /api/mail/binnen blijft een lokale
     proefpoort en wordt in de SES-stand hard gesloten.

   De buitenpoort neemt bewust NIET zelf een postvak aan uit de body: hij leest
   de To-kop van het bericht zelf. Een poort die de ontvanger uit een parameter
   haalt, is een open relay met extra stappen. */
module.exports = (kern) => {
  const { app, express, officeAuth, auth, supplierAuth, db, save, mailQ, mailIn,
    mailBijlage, mailAanname, rtmail, rtmailRecht, codenaamVan } = kern;
  const wie = require('../kern/rtmail-wie')({ db, rtmail, codenaamVan });
  const ses = require('../kern/ses-ontvangst')({ db, save });
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
     hieronder en de baan is altijd de onbetrouwde.

     DE KETEN ZELF STAAT HIER NIET MEER. Ontleden, stempelen, het origineel
     bewaren, de ontvanger toetsen, bezorgen en de bijlagen scannen doet
     kern/mailaanname.js -- want sinds server/smtp-in.js bestaat, zijn er TWEE
     deuren naar dezelfde kamer, en twee kopieen van die keten lopen uiteen op
     de plek waar het het meest kost (regel 4 van de lat). Wat hier blijft is
     wat ALLEEN over deze deur gaat: de rem per minuut, en het antwoord in JSON.

     WAT ER WEL IS VERANDERD voor deze poort: een bericht aan een adres dat hier
     geen postvak is, wordt nu geweigerd (550) in plaats van bezorgd. Dat was
     eerder een berg post voor niemand, in een postvak dat vanzelf ontstond. */
  let venster = 0, teller = 0;
  app.post('/api/mail/binnen', async (req, res) => {
    if (String(process.env.MAIL_INBOUND_PROVIDER || '').toLowerCase() === 'aws-ses')
      return res.status(404).json({ error:'Deze lokale proefpoort staat in de SES-stand dicht.' });
    const min = Math.floor(Date.now() / 60000);
    if (min !== venster) { venster = min; teller = 0; }
    if (++teller > 120) return res.status(429).json({ error: 'De buitenpoort staat even dicht; probeer het over een minuut.' });

    const b = body(req);
    const r = await mailAanname.neemAan({ ruw: String(b.bericht || ''),
      ip: String(b.ip || '') || req.ip, envelopeVan: b.envelopeVan, helo: b.helo,
      publiekeSleutel: b.publiekeSleutel });
    if (r.error) {
      /* 550 is een SMTP-code en geen HTTP-code; over deze deur wordt dat een
         404 -- het adres bestaat niet. De rest blijft 400. */
      const status = r.status === 550 ? 404 : (r.status || 400);
      return res.status(status).json({ error: r.error, ...(r.origineel ? { origineel: r.origineel } : {}) });
    }
    res.json(r);
  });

  /* SES -> S3 -> Lambda -> deze poort. De body blijft het originele RFC
     5322-bericht; metadata zit in kleine, ondertekende koppen. message/rfc822
     is niet door de globale JSON-parser gelezen, dus deze parser ziet exact
     dezelfde bytes als waarmee Lambda de HMAC maakte. */
  app.post('/api/mail/ses', express.raw({ type:'message/rfc822', limit:'26mb' }), async (req, res) => {
    const v=ses.controleer({
      tijd:req.get('x-rtg-ses-timestamp'),
      berichtId:req.get('x-rtg-ses-message-id'),
      ontvanger:req.get('x-rtg-ses-recipient'),
      handtekening:req.get('x-rtg-ses-signature'),
      controles:{ spf:req.get('x-rtg-ses-spf'), dkim:req.get('x-rtg-ses-dkim'),
        dmarc:req.get('x-rtg-ses-dmarc'), spam:req.get('x-rtg-ses-spam'),
        virus:req.get('x-rtg-ses-virus') },
      bytes:req.body
    });
    if (!v.ok) return res.status(v.status || 400).json({ error:v.error });
    if (v.controles.virus === 'FAIL')
      return res.status(422).json({ error:'SES heeft malware in dit bericht gevonden; het is niet afgeleverd.' });
    const c=ses.claim(v);
    if (c.dubbel) return res.json({ ok:true, dubbel:true });
    if (c.bezig) return res.status(409).json({ error:'Deze SES-bezorging wordt al verwerkt.' });
    try {
      const r=await mailAanname.neemAan({ ruw:v.bytes.toString('utf8'),
        envelopeNaar:v.ontvanger, envelopeVan:req.get('x-rtg-ses-mail-from') || '',
        providerControles:v.controles });
      if (r.error) { ses.vrij(c.sleutel); return res.status(r.status === 550 ? 404 : (r.status || 400)).json(r); }
      ses.klaar(c.sleutel);
      return res.json(r);
    } catch (e) {
      ses.vrij(c.sleutel);
      throw e;
    }
  });

  /* EEN BIJLAGE OPENEN. Twee ingangen (lid en zaak), en beide toetsen eerst of
     deze inlog het BERICHT mag lezen -- de bijlage hoort bij het bericht, niet
     bij de gebruiker. kern/mailbijlage.js kent de post niet en oordeelt daar
     dus ook niet over; die scheiding is met opzet. */
  for (const p of [{ pad: '/api/member/rtmail', poort: auth, adres: (req) => wie.lidAdres(req) },
                   { pad: '/api/supplier/rtmail', poort: supplierAuth, adres: (req) => wie.zaakAdres(req) }]) {
    app.post(p.pad + '/bijlagen', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return res.status(404).json({ error: 'Geen postvak voor deze inlog.' });
      const m = ((db.data.rtmail || {}).berichten || []).find(x => x.id === String(body(req).id || ''));
      if (!m) return res.status(404).json({ error: 'Dat bericht bestaat niet.' });
      const g = rtmailRecht.poort(a, m.naar, 'lezen');
      if (!g.ok) return res.status(403).json({ error: g.waarom });
      res.json({ ok: true, bijlagen: mailBijlage.bij(m.id) });
    });

    app.post(p.pad + '/bijlage', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return res.status(404).json({ error: 'Geen postvak voor deze inlog.' });
      const b = mailBijlage.open(String(body(req).id || ''));
      if (b.error) return res.status(404).json(b);
      const m = ((db.data.rtmail || {}).berichten || []).find(x => x.id === b.bericht);
      if (!m) return res.status(404).json({ error: 'Het bericht van deze bijlage bestaat niet meer.' });
      const g = rtmailRecht.poort(a, m.naar, 'lezen');
      if (!g.ok) return res.status(403).json({ error: g.waarom });
      res.json({ ok: true, naam: b.naam, soort: b.soort, bytes: b.bytes,
        inhoud: 'data:' + b.soort + ';base64,' + b.inhoud.toString('base64') });
    });
  }

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
