/* Domein "rtfos", deel "doelgroepen": de vrijwilliger, de hulpvrager en de buurt.

   DRIE INGANGEN VOOR MENSEN ZONDER RTG-ACCOUNT, en ze staan hier bij elkaar
   omdat ze dezelfde vraag stellen: wat mag iemand zien die geen inlog heeft?

   1. DE VRIJWILLIGER opent op zijn eigen code (RTFV-...): zijn planning, zijn
      uren, zijn VOG-datum. Hij werkt zijn beschikbaarheid zelf bij -- en niet
      zijn VOG, want dan is de VOG-controle een formaliteit.
   2. DE HULPVRAGER opent op zijn eigen code (RTFD-...): de stand van ZIJN
      vraag, en de knop om zijn toestemming in te trekken. Dat laatste is de
      reden dat dit portaal bestaat.
   3. DE BUURT opent zonder code. Daar staat alleen wat je ook op een poster in
      het buurthuis zou hangen; geen enkel getal over hulpvragen.

   DE REMMEN. De code-deuren dragen dezelfde twee remmen als de partner- en
   gemeentecodes: per bron tegen het afgrazen, per code tegen veel bronnen op
   een code. De volledige redenering (en waarom de sleutel NIET ip+code mag
   zijn) staat in routes/rtfkantoor/codedeuren.js.

   DE PUBLIEKE ROUTES hebben geen code om op te remmen, dus daar staat alleen de
   bron-rem, en ruimer: dit zijn leesroutes die een buurtbewoner op zijn telefoon
   opent. Ze geven per constructie niets terug wat de moeite van het afgrazen
   waard is (kern/rtfos/publiek.js) -- de rem staat er tegen het dreunen, niet
   tegen het lekken.

   Alle acht staan met een reden op de publieke lijst van check.js regel 28. */
const rem = require('../../rem');

module.exports = ({ app, officeAuth, rtfos, veilig, H }) => {
  const codeVan = req => String((req.body && req.body.code) || '').trim().slice(0, 40).toUpperCase();
  const ipRem = rem({ windowMs: 60000, limit: 20, key: req => 'rtfoscode-ip|' + String(req.ip) });
  const codeRem = rem({ windowMs: 60000, limit: 60, key: req => 'rtfoscode|' + codeVan(req) });
  const leesRem = rem({ windowMs: 60000, limit: 120, key: req => 'rtfpubliek|' + String(req.ip) });

  // ---------- de vrijwilliger, op zijn eigen code ----------
  app.post('/api/rtfos/portaal/vrijwilliger', ipRem, codeRem, (req, res) =>
    veilig(res, () => rtfos.vrijwilligerportaal.portaal(codeVan(req))));
  app.post('/api/rtfos/portaal/vrijwilliger/zet', ipRem, codeRem, (req, res) =>
    veilig(res, () => rtfos.vrijwilligerportaal.zetEigen(codeVan(req), req.body || {})));
  app.post('/api/rtfos/portaal/vrijwilliger/uren', ipRem, codeRem, (req, res) =>
    veilig(res, () => rtfos.vrijwilligerportaal.meldUren(codeVan(req), req.body || {})));

  // ---------- de hulpvrager, op zijn eigen code ----------
  app.post('/api/rtfos/portaal/deelnemer', ipRem, codeRem, (req, res) =>
    veilig(res, () => rtfos.deelnemerportaal.portaal(codeVan(req))));
  // wie ja zei, mag nee zeggen -- zonder eerst te bellen naar de organisatie
  // die hij juist wilde stoppen
  app.post('/api/rtfos/portaal/deelnemer/intrekken', ipRem, codeRem, (req, res) =>
    veilig(res, () => rtfos.deelnemerportaal.trekIn(codeVan(req), (req.body || {}).reden)));

  // ---------- de buurt, zonder code ----------
  app.post('/api/rtfos/publiek/steden', leesRem, (req, res) => veilig(res, () => rtfos.publiek.steden()));
  app.post('/api/rtfos/publiek/stad', leesRem, (req, res) => veilig(res, () => rtfos.publiek.stad((req.body || {}).id)));
  app.post('/api/rtfos/publiek/campagnes', leesRem, (req, res) => veilig(res, () => rtfos.publiek.campagnes()));

  /* ---------- de kantoorkant ----------
     Een code uitgeven is een besluit en geen bijvangst: er kijkt daarna iemand
     van buiten in een dossier. Beide routes laten een auditregel achter. */
  app.post('/api/rtfos/vrijwilliger/code', officeAuth, H((req, b) => rtfos.vrijwilligerportaal.codeVoor(req, b.id, b)));
  app.post('/api/rtfos/vrijwilliger/code/intrekken', officeAuth,
    H((req, b) => rtfos.vrijwilligerportaal.codeIntrekken(req, b.id, b.reden)));
  app.post('/api/rtfos/vrijwilliger/code/roteren', officeAuth,
    H((req, b) => rtfos.vrijwilligerportaal.codeRoteren(req, b.id, b)));
  app.post('/api/rtfos/vrijwilliger/uren-bevestig', officeAuth, H((req, b) => rtfos.vrijwilligerportaal.bevestigUren(req, b.id, b.meldingId)));
  app.post('/api/rtfos/casus/code', officeAuth, H((req, b) => rtfos.deelnemerportaal.codeVoor(req, b.id, b)));
  app.post('/api/rtfos/casus/code/intrekken', officeAuth,
    H((req, b) => rtfos.deelnemerportaal.codeIntrekken(req, b.id, b.reden)));
  app.post('/api/rtfos/casus/code/roteren', officeAuth,
    H((req, b) => rtfos.deelnemerportaal.codeRoteren(req, b.id, b)));
};
