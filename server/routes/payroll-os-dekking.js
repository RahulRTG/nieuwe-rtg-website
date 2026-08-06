/* Routes van Payroll OS: DE DEKKING -- waar kan er wereldwijd loon draaien?

   Dit is het overzicht waar de hele laag op staat of valt. De loonmotor is
   landneutraal: hij vraagt het regelpakket van het land van de zaak en rekent
   daarmee. Wat een land tegenhoudt is het ONTBREKEN van een tabel, en dat hoort
   een lijst te zijn en geen stilte -- anders ontdek je op de dag dat iemand om
   zijn loonstrook vraagt dat er in zijn land nooit iets lag.

   Een bron toevoegen is hier een https-adres neerzetten per land. Daarna haalt
   de dagelijkse ronde hem op, keurt hem, en zet hem klaar als ONGECONTROLEERD;
   er gaat nooit vanzelf een definitieve loonrun op een pakket dat geen mens
   heeft aangemerkt. Zo is een land erbij geen uitrol.

   De rekenkant staat in kern/payroll/dekking.js. Afgesplitst van
   ./payroll-os.js, dat over de 10 KB ging. */
'use strict';

module.exports = (kern) => {
  const { app, officeAuth, payrollOS, schoon } = kern;
  if (!payrollOS) return;

  const antwoord = (res, r) => (r && r.error) ? res.status(r.status || 400).json(r) : res.json(r);
  const wie = (req) => (req.actor && req.actor.name) || 'onbekend';

  /* ---------- dekking: waar kan er loon draaien, wereldwijd ----------
     Dit is het overzicht waar de hele laag op staat of valt. De motor is
     landneutraal; wat een land tegenhoudt is het ONTBREKEN van een tabel, en
     dat hoort een lijst te zijn en geen stilte. Zie kern/payroll/dekking.js.

     Een bron toevoegen is hier een https-adres neerzetten per land. Daarna
     haalt de dagelijkse ronde hem op, keurt hem, en zet hem klaar als
     ongecontroleerd -- er gaat nooit vanzelf een definitieve loonrun op. */
  app.post('/api/office/payroll/dekking', officeAuth, (req, res) =>
    res.json(Object.assign({ ok: true }, payrollOS.dekking.wereld((req.body || {}).peildatum))));

  app.post('/api/office/payroll/dekking/land', officeAuth, (req, res) => {
    const b = req.body || {};
    res.json({ ok: true, land: payrollOS.dekking.voorLand(String(b.land || 'NL'), b.peildatum) });
  });

  app.post('/api/office/payroll/bron', officeAuth, (req, res) => {
    const b = req.body || {};
    antwoord(res, payrollOS.dekking.zetBron(String(b.land || ''),
      { naam: schoon(b.naam, 80), url: String(b.url || '') }, wie(req)));
  });

  app.post('/api/office/payroll/bron/weg', officeAuth, (req, res) => {
    const b = req.body || {};
    antwoord(res, payrollOS.dekking.haalBronWeg(String(b.land || ''), String(b.url || '')));
  });

  app.post('/api/office/payroll/verval', officeAuth, (req, res) =>
    res.json({ ok: true, verloopt: payrollOS.dekking.verlooptBinnen((req.body || {}).dagen) }));

};
