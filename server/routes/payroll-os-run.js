/* Payroll OS, routes (deelbestand): DE LOONRUN.

   Openen doet het kantoor: het draait de administratie. Apart van
   ./payroll-os.js om dezelfde reden waarom ./payroll-os-zaak.js dat al is -- de
   regelpakketten en de contracten zijn INRICHTING (wat geldt er), en een run is
   UITVOERING (wat gebeurt er deze maand). Die twee lezen elkaars code niet.

   DE INVOER BEGINT BIJ HET CONTRACT EN NIET BIJ DE KLOK, en dat is de regel die
   hier het duurst is geweest: deze route liep over de geklokte feiten heen, dus
   wie niet prikte kwam niet in de run -- iedereen met een maandsalaris viel er
   stil uit. Het samenstellen staat daarom in kern/payroll/samenstellen.js, waar
   het los te toetsen is.

   En de uren komen uit de klok van de zaak zelf: de client levert ze NIET aan.
   Anders is de invoer van een loonrun iets wat je kunt meesturen.

   Krijgt dezelfde kern als ./payroll-os.js. */
'use strict';

module.exports = (kern) => {
  const { app, officeAuth, payrollOS, findSupplier, accounts, schoon } = kern;
  if (!payrollOS) return;
  // dezelfde regel als in ./payroll-os.js: wie de handeling deed, voor het spoor
  const wie = (req) => (req.actor && req.actor.name) || 'onbekend';
  /* Een fout uit de kern draagt zijn eigen status; die niet doorgeven zou een
     geweigerde handeling als 200 laten terugkomen. */
  const antwoord = (res, r) => (r && r.error) ? res.status(r.status || 400).json(r) : res.json(r);

  /* ---------- de loonrun ---------- */
  /* Openen doet het kantoor: het draait de administratie. De uren komen uit de
     klok van de zaak zelf, dus de client levert ze NIET aan -- anders is de
     invoer van een loonrun iets wat je kunt meesturen.

     DE INVOER BEGINT BIJ HET CONTRACT EN NIET BIJ DE KLOK, en die regel stond
     hier niet. Deze route liep over de geklokte feiten heen, dus wie niet
     prikte kwam niet in de run: iedereen met een maandsalaris viel er stil uit.
     Het samenstellen staat nu in kern/payroll/samenstellen.js -- daar is het te
     toetsen zonder server, en daar staat ook waarom ziekte doorbetaald hoort te
     worden in plaats van het loon te verlagen. */
  app.post('/api/office/payroll/run/open', officeAuth, (req, res) => {
    const b = req.body || {};
    const s = findSupplier(b.code);
    if (!s) return res.status(404).json({ error: 'Zaak niet gevonden.' });
    const periode = String(b.periode || '');
    if (!/^\d{4}-\d{2}$/.test(periode)) return res.status(400).json({ error: 'Kies een periode als 2026-07.' });

    const personeel = accounts.listStaff(s.code).map(m => ({ id: m.id, naam: m.name }));
    const opzet = payrollOS.samenstellen.stel({ code: s.code, periode, personeel,
      toeslagen: b.toeslagen, leeftijdsgroep: b.leeftijdsgroep });

    const r = payrollOS.run.open({ code: s.code, zaak: s.name, periode,
      land: (s.settings && s.settings.land) || 'NL', regels: opzet.regels, door: wie(req) });
    if (r.error) return res.status(r.status || 400).json(r);

    /* Meteen nalopen: een run zonder bevindingenlijst nodigt uit om hem over te
       slaan. De contracten gaan mee, zodat "loon zonder contract" echt gemeten
       wordt en niet als vals alarm afgaat (zie kern/payroll/controles.js). */
    const vorige = payrollOS.run.lijst(s.code).find(x => x.periode !== periode && x.stand === 'definitief');
    const bev = payrollOS.controles.loop(payrollOS.run.haal(r.run.id), {
      urenBevindingen: opzet.bevindingen, contracten: opzet.contracten,
      vorigeRun: vorige ? payrollOS.run.haal(vorige.id) : null });
    res.json(Object.assign(r, { bevindingen: bev.bevindingen, hoogOpen: bev.hoogOpen }));
  });

  app.post('/api/office/payroll/run/lijst', officeAuth, (req, res) =>
    res.json({ ok: true, runs: payrollOS.run.lijst((req.body || {}).code) }));

  app.post('/api/office/payroll/run/een', officeAuth, (req, res) => {
    const r = payrollOS.run.haal(String((req.body || {}).runId || ''));
    if (!r) return res.status(404).json({ error: 'Deze loonrun kennen we niet.' });
    res.json({ ok: true, run: r, bevindingen: payrollOS.controles.van(r.id) });
  });

  /* Goedkeuren: de administrateur tekent hier, de manager aan de zaakkant. */
  app.post('/api/office/payroll/run/keur', officeAuth, (req, res) => {
    const b = req.body || {};
    antwoord(res, payrollOS.run.keurGoed(String(b.runId || ''), 'administrateur', wie(req), null));
  });

  /* Definitief: pas als de bevindingen zijn afgehandeld EN beide handtekeningen
     staan. De controle op de bevindingen staat hier en niet in run.js, omdat
     run.js niets van de controlelaag hoort te weten -- maar hij hoort wel te
     gelden, dus staat hij op de enige plek waar definitief wordt gemaakt. */
  app.post('/api/office/payroll/run/definitief', officeAuth, (req, res) => {
    const runId = String((req.body || {}).runId || '');
    const mag = payrollOS.controles.magDefinitief(runId);
    if (mag.error) return res.status(mag.status).json(mag);
    antwoord(res, payrollOS.run.maakDefinitief(runId, wie(req)));
  });

  app.post('/api/office/payroll/run/verklaar', officeAuth, (req, res) => {
    const b = req.body || {};
    antwoord(res, payrollOS.controles.verklaar(String(b.runId || ''), String(b.soort || ''),
      b.staffId != null ? Number(b.staffId) : null, schoon(b.verklaring, 400), wie(req)));
  });

  app.post('/api/office/payroll/run/corrigeer', officeAuth, (req, res) => {
    const b = req.body || {};
    antwoord(res, payrollOS.run.corrigeer({ runId: String(b.runId || ''), regels: b.regels,
      door: wie(req), reden: schoon(b.reden, 300) }));
  });

  /* De DRIE UITGANGEN uit een definitieve run -- de boeking, het betaalbestand
     en de loonaangifte -- staan in ./payroll-os-uitgang.js. Ze horen bij elkaar
     (ze moeten alle drie hetzelfde zeggen) en dit bestand ging over de 10 KB. */
  require('./payroll-os-uitgang')(kern);

};
