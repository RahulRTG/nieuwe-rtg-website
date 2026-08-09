/* De persoonlijke AI-agenda: dezelfde motor voor leden (in de backoffice van hun
   pas) en leveranciers (in de boardroom). Eigenaar-sleutel: 'lid:<key>' of
   'sup:<code>'. Altijd-aan gemount. */
module.exports = (kern) => {
  const { app, agenda, auth, geenGast, supplierAuth, managerOnly } = kern;

  // ---------- lid ----------
  // de sleutelregel staat in kern/agenda.js, naast de opslag die hem gebruikt
  const { agendaLidSleutel, agendaZaakSleutel } = require('../kern/agenda');
  const lidKey = (req) => agendaLidSleutel(req.session.key);

  /* WAT EEN CLIENT MAG MEEGEVEN, en niets meer. Een agenda-item draagt sinds de
     postvoorstellen ook een `bron` ("dit komt uit uw post, bericht X"), en die
     hoort door de SERVER gezet te worden en niet door de pagina. Zou het lijf
     rechtstreeks doorgaan, dan kon iedereen een zelfgetypte afspraak het etiket
     "uit uw post" geven -- en dan zegt kern/postdatum.js dat er over een bericht
     al besloten is terwijl niemand het heeft gezien. */
  const invoer = (b) => ({ titel: b.titel, datum: b.datum, tijd: b.tijd, notitie: b.notitie });
  app.post('/api/agenda/mijn-lijst', auth, (req, res) => {
    res.json({ items: agenda.lijst(lidKey(req)), telling: agenda.telling(lidKey(req)) });
  });
  app.post('/api/agenda/toevoegen', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const r = agenda.voegToe(lidKey(req), invoer(req.body || {}));
    if (r.error) return res.status(400).json(r);
    res.json({ ok: true, items: agenda.lijst(lidKey(req)), telling: agenda.telling(lidKey(req)) });
  });
  app.post('/api/agenda/wijzig', auth, (req, res) => {
    const r = agenda.wijzig(lidKey(req), req.body || {});
    if (r.error) return res.status(400).json(r);
    res.json({ ok: true, items: agenda.lijst(lidKey(req)), telling: agenda.telling(lidKey(req)) });
  });
  app.post('/api/agenda/verwijder', auth, (req, res) => {
    agenda.verwijder(lidKey(req), String(req.body.id || ''));
    res.json({ ok: true, items: agenda.lijst(lidKey(req)), telling: agenda.telling(lidKey(req)) });
  });
  app.post('/api/agenda/ai', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    const r = await agenda.aiVoegToe(lidKey(req), String(req.body.opdracht || ''), true);
    res.json({ antwoord: r.antwoord, gedaan: !!r.gedaan, items: agenda.lijst(lidKey(req)), telling: agenda.telling(lidKey(req)) });
  });

  /* ---------- de pro-laag: kalender, uitnodigen, ICS (kern/agenda-pro.js) ---------- */
  app.post('/api/agenda/bereik', auth, (req, res) => {
    const van = String(req.body.van || ''), tot = String(req.body.tot || '');
    const r = agenda.bereik(lidKey(req), van, tot);
    if (r.error) return res.status(400).json(r);
    // de laag uit het ecosysteem: eigen RTG-boekingen, alleen-lezen, met bronlabel
    r.ecosysteem = agenda.ecosysteem(req.session.key, van, tot);
    res.json(r);
  });
  app.post('/api/agenda/bewaar', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const r = agenda.bewaarAfspraak(lidKey(req), req.body || {});
    if (r.error) return res.status(400).json(r);
    res.json(r);
  });
  app.post('/api/agenda/uitnodig', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    const r = await agenda.nodigUit(lidKey(req), String(req.body.id || ''), String(req.body.codenaam || ''));
    if (r.error) return res.status(400).json(r);
    res.json(r);
  });
  app.post('/api/agenda/antwoord', auth, (req, res) => {
    const r = agenda.antwoordUitnodiging(lidKey(req), String(req.body.id || ''), req.body.ja !== false);
    if (r.error) return res.status(400).json(r);
    res.json(r);
  });
  app.post('/api/agenda/ics', auth, (req, res) => {
    res.json({ ics: agenda.ics(lidKey(req)) });
  });

  // ---------- leverancier ----------
  /* Ook hier de sleutelregel uit kern/agenda.js en niet nog een keer met de hand:
     de levensgraaf leest deze agenda (kern/levensgraaf/bronnen-zaak.js), en twee
     plekken die 'sup:' zeggen lopen vroeg of laat uiteen. */
  const supKey = (req) => agendaZaakSleutel(req.supplier.code);
  app.post('/api/supplier/agenda/lijst', supplierAuth, (req, res) => {
    res.json({ items: agenda.lijst(supKey(req)), telling: agenda.telling(supKey(req)) });
  });
  app.post('/api/supplier/agenda/toevoegen', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = agenda.voegToe(supKey(req), invoer(req.body || {}));
    if (r.error) return res.status(400).json(r);
    res.json({ ok: true, items: agenda.lijst(supKey(req)), telling: agenda.telling(supKey(req)) });
  });
  app.post('/api/supplier/agenda/wijzig', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = agenda.wijzig(supKey(req), req.body || {});
    if (r.error) return res.status(400).json(r);
    res.json({ ok: true, items: agenda.lijst(supKey(req)), telling: agenda.telling(supKey(req)) });
  });
  app.post('/api/supplier/agenda/verwijder', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    agenda.verwijder(supKey(req), String(req.body.id || ''));
    res.json({ ok: true, items: agenda.lijst(supKey(req)), telling: agenda.telling(supKey(req)) });
  });
  app.post('/api/supplier/agenda/ai', supplierAuth, async (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = await agenda.aiVoegToe(supKey(req), String(req.body.opdracht || ''), true);
    res.json({ antwoord: r.antwoord, gedaan: !!r.gedaan, items: agenda.lijst(supKey(req)), telling: agenda.telling(supKey(req)) });
  });
};
