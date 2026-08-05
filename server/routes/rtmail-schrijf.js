/* Routes voor de SCHRIJFKANT: concepten, uitgesteld verzenden, handtekening,
   afwezigheid, aliassen en de regels van een postvak.

   Net als bij het postvak komt het adres uit de INLOG (kern/rtmail-wie.js) en
   nooit uit de body. Twee ingangen (lid en zaak) die hetzelfde doen op een
   ander adres, uit dezelfde lus -- schreef ik ze los, dan krijgt de ene ooit
   een controle die de andere mist.

   EEN DING DAT HIER OPVALT EN MET OPZET ZO IS: /concepten haalt eerst
   `losMaken()` langs. Uitgesteld verzenden heeft geen wekker; wat aan de beurt
   is, gaat de deur uit zodra iemand zijn concepten opvraagt of zijn postvak
   opent. Een wekker die een keer niet loopt, verstuurt niets en zegt niets. */
module.exports = (kern) => {
  const { app, auth, supplierAuth, db, rtmail, rtmailSchrijf, rtmailRegels, codenaamVan } = kern;
  const wie = require('../kern/rtmail-wie')({ db, rtmail, codenaamVan });
  const body = (req) => (req && req.body) || {};

  const paren = [
    { pad: '/api/member/rtmail', poort: auth, adres: wie.lidAdres, bron: 'lid' },
    { pad: '/api/supplier/rtmail', poort: supplierAuth, adres: wie.zaakAdres, bron: 'zaak' }
  ];

  for (const p of paren) {
    const geen = (res) => res.status(404).json({ error: 'Geen postvak voor deze inlog.' });
    const fout = (res, r) => res.status(400).json(r);

    app.post(p.pad + '/concepten', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geen(res);
      // wat gepland stond en aan de beurt is, gaat nu weg -- en wordt gemeld
      const verstuurd = rtmailSchrijf.losMaken(a, p.bron);
      res.json({ ok: true, concepten: rtmailSchrijf.concepten(a), zojuistVerstuurd: verstuurd.map(m => m.id) });
    });

    app.post(p.pad + '/concept/bewaar', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geen(res);
      const b = body(req);
      const r = rtmailSchrijf.bewaar(a, { id: b.id, naar: b.naar, onderwerp: b.onderwerp,
        tekst: b.tekst, antwoordOp: b.antwoordOp, plan: b.plan });
      if (r.error) return fout(res, r);
      res.json(r);
    });

    app.post(p.pad + '/concept/weg', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geen(res);
      const r = rtmailSchrijf.gooiWeg(a, String(body(req).id || ''));
      if (r.error) return fout(res, r);
      res.json(r);
    });

    app.post(p.pad + '/concept/verstuur', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geen(res);
      // het vertrouwensstempel volgt uit de geverifieerde inlog, niet uit de body
      const r = rtmailSchrijf.verstuur(a, String(body(req).id || ''), p.bron);
      if (r.error) return fout(res, r);
      res.json(r);
    });

    app.post(p.pad + '/instellingen', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geen(res);
      res.json({ ok: true, adres: a, instellingen: rtmailSchrijf.instellingen(a) });
    });

    app.post(p.pad + '/handtekening', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geen(res);
      const r = rtmailSchrijf.zetHandtekening(a, String(body(req).tekst || ''));
      if (r.error) return fout(res, r);
      res.json(r);
    });

    app.post(p.pad + '/afwezig', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geen(res);
      const b = body(req);
      const r = rtmailSchrijf.zetAfwezig(a, { aan: b.aan, tekst: b.tekst, van: b.van, tot: b.tot });
      if (r.error) return fout(res, r);
      res.json(r);
    });

    app.post(p.pad + '/alias', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geen(res);
      const b = body(req);
      const r = rtmailSchrijf.zetAlias(a, String(b.naam || ''), b.aan !== false);
      if (r.error) return fout(res, r);
      res.json(r);
    });

    app.post(p.pad + '/regels', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geen(res);
      res.json({ ok: true, velden: rtmailRegels.VELDEN, acties: rtmailRegels.ACTIES,
        regels: rtmailRegels.lijst(a) });
    });

    app.post(p.pad + '/regel/maak', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geen(res);
      const b = body(req);
      const r = rtmailRegels.maak(a, { naam: b.naam, veld: b.veld, bevat: b.bevat,
        actie: b.actie, waarde: b.waarde, alleenOnvertrouwd: b.alleenOnvertrouwd });
      if (r.error) return fout(res, r);
      res.json(r);
    });

    app.post(p.pad + '/regel/zet', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geen(res);
      const b = body(req);
      const r = rtmailRegels.zet(a, String(b.id || ''), b.aan !== false);
      if (r.error) return fout(res, r);
      res.json(r);
    });

    app.post(p.pad + '/regel/weg', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geen(res);
      const r = rtmailRegels.weg(a, String(body(req).id || ''));
      if (r.error) return fout(res, r);
      res.json(r);
    });
  }
};
