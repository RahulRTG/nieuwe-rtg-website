/* Routes van Payroll OS: DE DRIE UITGANGEN uit een definitieve loonrun.

   De boeking gaat naar het grootboek, het betaalbestand naar de bank, de
   aangifte naar de Belastingdienst. Ze staan hier bij elkaar omdat ze bij
   elkaar horen: ze komen uit dezelfde run en ze moeten alle drie hetzelfde
   zeggen. Zeggen ze dat niet, dan betaalt een werkgever iets anders dan hij
   aangeeft en boekt hij weer iets anders -- en dat komt pas boven bij een
   controle, jaren later.

   Alles achter officeAuth: RTG voert de administratie. De werkgever ziet zijn
   aangifte wel (./payroll-os-zaak.js) maar dient hem niet in; twee partijen die
   allebei kunnen indienen, is twee aangiftes over dezelfde periode.

   Afgesplitst van ./payroll-os.js, dat over de 10 KB ging. */
'use strict';

module.exports = (kern) => {
  const { app, officeAuth, payrollOS, schoon } = kern;
  if (!payrollOS) return;

  const antwoord = (res, r) => (r && r.error) ? res.status(r.status || 400).json(r) : res.json(r);
  const wie = (req) => (req.actor && req.actor.name) || 'onbekend';

  /* ---------- het dossier ----------
     De vier vragen op een plek. Niet omdat de antwoorden er niet waren -- ze
     stonden verspreid over vier schermen -- maar omdat verspreid niet hetzelfde
     is als beschikbaar. Wie bij een controle zelf moet optellen, verzint op een
     gegeven moment een antwoord. Zie kern/payroll/dossier.js. */
  app.post('/api/office/payroll/dossier', officeAuth, (req, res) => {
    const b = req.body || {};
    antwoord(res, b.staffId != null
      ? payrollOS.dossier.vanMedewerker(String(b.runId || ''), Number(b.staffId))
      : payrollOS.dossier.vanRun(String(b.runId || '')));
  });

  /* ---------- de bewijsketen van de aangifte ----------
     Het dossier hierboven gaat van een RUN naar een medewerker; dit gaat van de
     AANGIFTE omlaag naar de nominatieve regels, en verwijst voor het detail
     terug naar dat dossier. Twee ingangen op dezelfde keten, en met opzet geen
     twee ketens (kern/payroll/herkomst.js).

     Bij het KANTOOR en niet bij de zaak: dit legt de loonheffing per werknemer
     open, en de werkgever leest zijn aangifte al mee via ./payroll-os-zaak.js.
     Een tweede, ruimere ingang op dezelfde gegevens is geen extra dienst maar
     een tweede sleutel op dezelfde deur. */
  app.post('/api/office/payroll/verklaar', officeAuth, (req, res) =>
    antwoord(res, payrollOS.herkomst.verklaar(String((req.body || {}).id || ''))));

  app.post('/api/office/payroll/herbouw', officeAuth, (req, res) =>
    antwoord(res, payrollOS.herkomst.herbouw(String((req.body || {}).id || ''))));

  /* ---------- journaal en betaalbestand ---------- */
  app.post('/api/office/payroll/journaal', officeAuth, (req, res) => {
    const r = payrollOS.run.haal(String((req.body || {}).runId || ''));
    antwoord(res, payrollOS.journaal.boeking(r));
  });

  app.post('/api/office/payroll/betaalbestand', officeAuth, (req, res) => {
    const b = req.body || {};
    const r = payrollOS.run.haal(String(b.runId || ''));
    antwoord(res, payrollOS.journaal.betaalbestand(r, b.rekeningen || {}));
  });

  /* ---------- de loonaangifte ----------
     De derde uitgang uit dezelfde run, naast de boeking en het betaalbestand.
     Alleen bij het kantoor: RTG voert de administratie en doet de aangifte; de
     werkgever ziet hem wel (zie ./payroll-os-zaak.js) maar dient hem niet in.

     `indienen` legt alleen VAST dat het is gebeurd, met het kenmerk van de
     Belastingdienst erbij. Het echte verzenden loopt via een koppeling die er
     nog niet is, en dat staat in het antwoord met zoveel woorden -- anders gaat
     iemand ervan uit dat de aangifte de deur uit is omdat er 'ingediend' staat. */
  app.post('/api/office/payroll/aangifte', officeAuth, (req, res) => {
    const r = payrollOS.run.haal(String((req.body || {}).runId || ''));
    antwoord(res, payrollOS.aangifte.maak(r, wie(req)));
  });

  app.post('/api/office/payroll/aangifte/lijst', officeAuth, (req, res) => {
    const b = req.body || {};
    res.json({ ok: true, aangiftes: payrollOS.aangifte.vanZaak(b.code, b.periode || null) });
  });

  app.post('/api/office/payroll/aangifte/indienen', officeAuth, (req, res) => {
    const b = req.body || {};
    antwoord(res, payrollOS.aangifte.dienIn(String(b.id || ''), wie(req), schoon(b.kenmerk, 60)));
  });

  /* De aansluiting: zegt de aangifte hetzelfde als het loonjournaal? Twee wegen
     naar dezelfde loonheffing. Lopen ze uiteen, dan is er onderweg iets
     veranderd -- en dan hoort dat op het scherm te staan voordat er wordt
     ingediend, niet bij een controle over drie jaar. */
  app.post('/api/office/payroll/aangifte/aansluiting', officeAuth, (req, res) => {
    const a = payrollOS.aangifte.haal(String((req.body || {}).id || ''));
    if (!a) return res.status(404).json({ error: 'Deze aangifte kennen we niet.' });
    const b = payrollOS.journaal.boeking(payrollOS.run.haal(a.runId));
    if (b.error) return res.status(b.status || 400).json(b);
    antwoord(res, payrollOS.aangifte.sluitAanOpJournaal(a, b, payrollOS.journaal.TEGENREKENINGEN.loonheffing));
  });

};
