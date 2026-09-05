/* Domein "rtfos", deel "afmaak": de laatste twee van de tien ingangen.

   DE VELD-APP van de medewerker en HET DONATEURSPORTAAL van de gever. Ze staan
   hier bij elkaar omdat ze allebei een engere blik zijn op iets dat al bestaat:
   de een ziet alleen wat aan hem is TOEGEWEZEN, de ander alleen zijn EIGEN
   giften.

   TWEE SOORTEN DEUR IN EEN BESTAND, en dat verschil is de moeite van het lezen
   waard. De veld-app draait op een gewone kantoorsessie -- de medewerker heeft
   een RTG-account, want hij werkt hier. Het donateursportaal draait op een code
   (RTFS-), want een gever heeft geen account en hoort er ook geen te moeten
   maken om te zien waar zijn geld heen ging. Vandaar dezelfde twee remmen als
   bij de andere code-deuren: per bron tegen het afgrazen, per code tegen veel
   bronnen op een code (routes/rtfkantoor/codedeuren.js legt uit waarom de
   sleutel niet ip+code mag zijn).

   ELK PAD STAAT LETTERLIJK -- zie de kop van ./index.js. */
const rem = require('../../rem');

module.exports = ({ app, officeAuth, rtfos, veilig, H }) => {
  const codeVan = req => String((req.body && req.body.code) || '').trim().slice(0, 40).toUpperCase();
  const ipRem = rem({ windowMs: 60000, limit: 20, key: req => 'rtfoscode-ip|' + String(req.ip) });
  const codeRem = rem({ windowMs: 60000, limit: 60, key: req => 'rtfoscode|' + codeVan(req) });

  // ---------- de veld-app: alleen wat aan mij is toegewezen ----------
  app.post('/api/rtfos/veld/lijst', officeAuth, H(req => rtfos.veld.mijnLijst(req)));
  app.post('/api/rtfos/veld/hulpvraag', officeAuth, H((req, b) => rtfos.veld.een(req, b.id)));
  // Het adres opent apart, met een auditregel -- dezelfde als op kantoor.
  app.post('/api/rtfos/veld/adres', officeAuth, H((req, b) => rtfos.veld.adres(req, b.id)));
  app.post('/api/rtfos/veld/rapport', officeAuth, H((req, b) => rtfos.veld.rapport(req, b.id, b)));
  /* Afronden bestaat hier WEL als route en weigert altijd. Dat is met opzet: de
     knop die er niet is leest als een gebrek, en een medewerker die niet weet
     waarom hij het niet kan, belt de coordinator of doet het ergens anders. */
  app.post('/api/rtfos/veld/afronden', officeAuth, H(() => rtfos.veld.afronden()));
  // de kantoorkant: toewijzen en intrekken
  app.post('/api/rtfos/casus/toewijzen', officeAuth, H((req, b) => rtfos.veld.wijsToe(req, b.id, b.key, b.weg === true)));

  // ---------- het donateursportaal, op code ----------
  app.post('/api/rtfos/portaal/donateur', ipRem, codeRem, (req, res) =>
    veilig(res, () => rtfos.donateur.portaal(codeVan(req))));
  app.post('/api/rtfos/portaal/donateur/bewijs', ipRem, codeRem, (req, res) =>
    veilig(res, () => rtfos.donateur.bewijs(codeVan(req), (req.body || {}).giftId)));
  // de kantoorkant: de code uitgeven en de periodieke overeenkomst vastleggen
  app.post('/api/rtfos/donateur/code', officeAuth, H((req, b) => rtfos.donateur.codeVoor(req, b.bronId, b)));
  app.post('/api/rtfos/donateur/code/intrekken', officeAuth,
    H((req, b) => rtfos.donateur.codeIntrekken(req, b.bronId, b.reden)));
  app.post('/api/rtfos/donateur/code/roteren', officeAuth,
    H((req, b) => rtfos.donateur.codeRoteren(req, b.bronId, b)));
  app.post('/api/rtfos/donateur/periodiek', officeAuth, H((req, b) => rtfos.donateur.periodiekVast(req, b.bronId, b)));
};
