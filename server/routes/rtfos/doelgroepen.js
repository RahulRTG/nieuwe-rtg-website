/* Domein "rtfos", deel "doelgroepen": de vrijwilliger, de hulpvrager en de buurt.

   DRIE INGANGEN VOOR MENSEN BUITEN HET KANTOOR, en ze staan hier bij elkaar
   omdat ze dezelfde vraag stellen: wat mag iemand zien die geen kantoor is?
   Sinds het eigenaarsbesluit van 19 oktober 2026 vragen ze alle drie een
   account (een gratis account is genoeg). Bij de twee codedeuren koppelt de
   code dat account de eerste keer aan het dossier en is hij daarna een extra
   sleutel naast de sessie (kern/codekoppel.js). Een hulpvrager in acute nood
   hoeft niets: de beschermingsdeur blijft open (HDI.md par. 7).

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
   tegen het lekken. */
const rem = require('../../rem');

module.exports = ({ app, auth, db, save, officeAuth, rtfos, veilig, H, rtf, resolveSession }) => {
  const koppel = require('../../kern/codekoppel')({ db, save });
  /* DE BUURT VRAAGT EEN SESSIE (eigenaarsbesluit 19 oktober 2026: gebruiken
     vraagt een account). Een lid, een zaak of het kantoor met zijn sessie; een
     gezinsprofiel met code en token in het lijf, en dan alleen uit een gezin
     dat aan het account van een ouder hangt (foundation/accountplicht.js). De
     vraag staat in kern/elkesessie.js; zonder sessie 401. */
  const { magSessie, NIET_INGELOGD } = require('../../kern/elkesessie');
  const codeVan = req => String((req.body && req.body.code) || '').trim().slice(0, 40).toUpperCase();
  const ipRem = rem({ windowMs: 60000, limit: 20, key: req => 'rtfoscode-ip|' + String(req.ip) });
  const codeRem = rem({ windowMs: 60000, limit: 60, key: req => 'rtfoscode|' + codeVan(req) });
  const leesRem = rem({ windowMs: 60000, limit: 120, key: req => 'rtfpubliek|' + String(req.ip) });

  // ---------- de vrijwilliger, op zijn eigen code ----------
  app.post('/api/rtfos/portaal/vrijwilliger', auth, ipRem, codeRem, (req, res) =>
    veilig(res, () => koppel.met(req, 'vrijwilliger', codeVan(req), () => rtfos.vrijwilligerportaal.portaal(codeVan(req)))));
  app.post('/api/rtfos/portaal/vrijwilliger/zet', auth, ipRem, codeRem, (req, res) =>
    veilig(res, () => koppel.met(req, 'vrijwilliger', codeVan(req), () => rtfos.vrijwilligerportaal.zetEigen(codeVan(req), req.body || {}))));
  app.post('/api/rtfos/portaal/vrijwilliger/uren', auth, ipRem, codeRem, (req, res) =>
    veilig(res, () => koppel.met(req, 'vrijwilliger', codeVan(req), () => rtfos.vrijwilligerportaal.meldUren(codeVan(req), req.body || {}))));

  /* Zijn dossier aan zijn EIGEN account koppelen: ingelogd EN met zijn code,
     allebei tegelijk (kern/rtfos/vrijwilligeraccount.js). Het account komt uit
     de sessie, nooit uit het lijf. Loskoppelen kan zonder code. */
  app.post('/api/rtfos/portaal/vrijwilliger/koppel', auth, ipRem, codeRem, (req, res) =>
    veilig(res, () => rtfos.vrijwilligerportaal.account.koppel(codeVan(req), req.session && req.session.key)));
  app.post('/api/rtfos/portaal/vrijwilliger/ontkoppel', auth, (req, res) =>
    veilig(res, () => rtfos.vrijwilligerportaal.account.ontkoppel(req.session && req.session.key)));

  // ---------- de hulpvrager, op zijn eigen code ----------
  app.post('/api/rtfos/portaal/deelnemer', auth, ipRem, codeRem, (req, res) =>
    veilig(res, () => koppel.met(req, 'deelnemer', codeVan(req), () => rtfos.deelnemerportaal.portaal(codeVan(req)))));
  // wie ja zei, mag nee zeggen -- zonder eerst te bellen naar de organisatie
  // die hij juist wilde stoppen
  app.post('/api/rtfos/portaal/deelnemer/intrekken', auth, ipRem, codeRem, (req, res) =>
    veilig(res, () => koppel.met(req, 'deelnemer', codeVan(req), () => rtfos.deelnemerportaal.trekIn(codeVan(req), (req.body || {}).reden))));

  // ---------- de buurt, zonder code maar met een account of een gezinsprofiel ----------
  app.post('/api/rtfos/publiek/steden', leesRem, (req, res) => {
    if (!magSessie(req, { resolveSession, rtf })) return res.status(401).json(NIET_INGELOGD);
    veilig(res, () => rtfos.publiek.steden());
  });
  app.post('/api/rtfos/publiek/stad', leesRem, (req, res) => {
    if (!magSessie(req, { resolveSession, rtf })) return res.status(401).json(NIET_INGELOGD);
    veilig(res, () => rtfos.publiek.stad((req.body || {}).id));
  });
  app.post('/api/rtfos/publiek/campagnes', leesRem, (req, res) => {
    if (!magSessie(req, { resolveSession, rtf })) return res.status(401).json(NIET_INGELOGD);
    veilig(res, () => rtfos.publiek.campagnes());
  });

  /* ---------- de kantoorkant ----------
     Een code uitgeven is een besluit en geen bijvangst: er kijkt daarna iemand
     van buiten in een dossier. Beide routes laten een auditregel achter. */
  app.post('/api/rtfos/vrijwilliger/code', officeAuth, H((req, b) => rtfos.vrijwilligerportaal.codeVoor(req, b.id, b)));
  app.post('/api/rtfos/vrijwilliger/code/intrekken', officeAuth,
    H((req, b) => rtfos.vrijwilligerportaal.codeIntrekken(req, b.id, b.reden)));
  app.post('/api/rtfos/vrijwilliger/code/roteren', officeAuth,
    H((req, b) => rtfos.vrijwilligerportaal.codeRoteren(req, b.id, b)));
  app.post('/api/rtfos/vrijwilliger/account-los', officeAuth,
    H((req, b) => rtfos.vrijwilligerportaal.account.kantoorLos(req, b.id, b.reden)));
  app.post('/api/rtfos/vrijwilliger/uren-bevestig', officeAuth, H((req, b) => rtfos.vrijwilligerportaal.bevestigUren(req, b.id, b.meldingId)));
  app.post('/api/rtfos/casus/code', officeAuth, H((req, b) => rtfos.deelnemerportaal.codeVoor(req, b.id, b)));
  app.post('/api/rtfos/casus/code/intrekken', officeAuth,
    H((req, b) => rtfos.deelnemerportaal.codeIntrekken(req, b.id, b.reden)));
  app.post('/api/rtfos/casus/code/roteren', officeAuth,
    H((req, b) => rtfos.deelnemerportaal.codeRoteren(req, b.id, b)));
};
