/* Routes voor het POSTVAK: mappen, etiketten, favorieten, sluimeren, zoeken en
   gesprekken. Voor leden en voor zaken, want een postvak is een postvak.

   HET ADRES KOMT UIT DE INLOG, NOOIT UIT DE BODY -- kern/rtmail-wie.js leidt
   het af uit de sessie of de leverancier. Er is dus geen enkele parameter
   waarmee een client in het postvak van een ander kan kijken; de laag eronder
   (kern/rtmail-vak.js) filtert daar bovendien nog een keer op.

   Alle antwoorden gaan door dezelfde vorm: { ok, ... } of { error } met een
   uitleg die een mens verder helpt. */
module.exports = (kern) => {
  const { app, auth, supplierAuth, db, rtmail, rtmailVak, rtmailDraad, rtmailAi, codenaamVan } = kern;
  const wie = require('../kern/rtmail-wie')({ db, rtmail, codenaamVan });

  const lid = (req) => wie.lidAdres(req);
  const zaak = (req) => wie.zaakAdres(req);
  const body = (req) => (req && req.body) || {};

  /* Twee ingangen per handeling (lid en zaak) die exact hetzelfde doen op een
     ander adres. Dat scheelt geen regels als je ze uitschrijft, dus staat hier
     een lus: dezelfde code, twee poorten. Zou ik ze los schrijven, dan is het
     een kwestie van tijd voor de ene een controle krijgt die de andere mist. */
  const paren = [
    { pad: '/api/member/rtmail', poort: auth, adres: lid },
    { pad: '/api/supplier/rtmail', poort: supplierAuth, adres: zaak }
  ];

  for (const p of paren) {
    const geenPostvak = (res) => res.status(404).json({ error: 'Geen postvak voor deze inlog.' });

    // de lijst van een map, met de tellingen ernaast
    app.post(p.pad + '/vak', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geenPostvak(res);
      const b = body(req);
      res.json({ ok: true, adres: a, mappen: rtmailVak.MAPPEN, tellingen: rtmailVak.tellingen(a),
        map: b.map || 'in',
        berichten: rtmailVak.lijst(a, { map: b.map, label: b.label, limit: b.limit }) });
    });

    // hetzelfde postvak, maar als GESPREKKEN in plaats van losse berichten
    app.post(p.pad + '/gesprekken', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geenPostvak(res);
      const b = body(req);
      res.json({ ok: true, adres: a, gesprekken: rtmailDraad.lijst(a, { map: b.map, label: b.label }) });
    });

    // een heel gesprek, oudste eerst; wat er buiten beeld blijft wordt geteld
    app.post(p.pad + '/draad', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geenPostvak(res);
      const r = rtmailDraad.draad(a, String(body(req).id || ''));
      if (r.error) return res.status(404).json(r);
      res.json(r);
    });

    app.post(p.pad + '/verplaats', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geenPostvak(res);
      const b = body(req);
      const r = rtmailVak.verplaats(a, String(b.id || ''), String(b.map || ''));
      if (r.error) return res.status(400).json(r);
      res.json(r);
    });

    app.post(p.pad + '/etiket', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geenPostvak(res);
      const b = body(req);
      const r = rtmailVak.etiket(a, String(b.id || ''), String(b.label || ''), b.aan !== false);
      if (r.error) return res.status(400).json(r);
      res.json(r);
    });

    app.post(p.pad + '/ster', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geenPostvak(res);
      const b = body(req);
      const r = rtmailVak.ster(a, String(b.id || ''), b.aan !== false);
      if (r.error) return res.status(400).json(r);
      res.json(r);
    });

    app.post(p.pad + '/sluimer', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geenPostvak(res);
      const b = body(req);
      const r = rtmailVak.sluimer(a, String(b.id || ''), b.tot);
      if (r.error) return res.status(400).json(r);
      res.json(r);
    });

    app.post(p.pad + '/zoek', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geenPostvak(res);
      const b = body(req);
      const r = rtmailVak.zoek(a, String(b.vraag || ''), { map: b.map, limit: b.limit });
      if (r.error) return res.status(400).json(r);
      res.json(r);
    });

    /* De AI-hulp op EEN gesprek. Drie vragen, en alle drie geven ze het
       bericht-id mee waar het antwoord vandaan komt -- zonder die verwijzing
       is een samenvatting een tweede versie van de waarheid.

       Deze ingang LEEST alleen. Hij verstuurt niets, verplaatst niets en
       besluit niets; dat blijft bij de gewone poorten hierboven. */
    app.post(p.pad + '/hulp', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geenPostvak(res);
      const b = body(req);
      const d = rtmailDraad.draad(a, String(b.id || ''));
      if (d.error) return res.status(404).json(d);
      const wat = String(b.wat || 'samenvatting');
      if (wat === 'acties') return res.json(rtmailAi.acties(d.berichten, a));
      if (wat === 'risico') {
        const m = d.berichten.find(x => x.id === String(b.id));
        return res.json(rtmailAi.risico(m));
      }
      const s = rtmailAi.samenvatting(d.berichten, a);
      if (s.error) return res.status(400).json(s);
      res.json(Object.assign(s, { buitenBeeld: d.buitenBeeld }));
    });

    // antwoorden binnen een gesprek: de ontvanger volgt uit het bericht
    app.post(p.pad + '/antwoord', p.poort, (req, res) => {
      const a = p.adres(req);
      if (!a) return geenPostvak(res);
      const b = body(req);
      /* Het vertrouwensstempel wordt HIER gezet, bij de geverifieerde inlog, en
         komt nooit uit de body -- precies zoals bij /stuur. Een lid schrijft als
         'lid', een zaak als 'zaak'. */
      const r = rtmailDraad.beantwoord(a, String(b.id || ''),
        { tekst: String(b.tekst || ''), bron: p.pad.includes('supplier') ? 'zaak' : 'lid' });
      if (r.error) return res.status(400).json(r);
      res.json({ ok: true, bericht: r });
    });
  }
};
