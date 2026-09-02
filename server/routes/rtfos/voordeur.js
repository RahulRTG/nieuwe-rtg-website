/* Domein "rtfos", deel "voordeur": de vier routes zonder inlog waarlangs een
   mens zelf een beschermzaak kan beginnen (HDI.md par. 7 regel 4).

   WAAROM DEZE VIER PUBLIEK ZIJN, en dat is een besluit en geen vergetelheid.
   Elke andere schrijfroute van deze klasse staat achter officeAuth. Deze niet,
   want de mens om wie het gaat heeft per definitie geen kantoorinlog -- en heel
   vaak ook geen RTG-account. Een deur die eerst een account vraagt, is voor de
   mens uit de missie geen deur. Alle vier staan met hun reden in
   scripts/lib/publiekeroutes.js (keuringsregel 28).

   DE REMMEN. Twee stuks, en ze doen iets anders:
     - per BRON tegen het dreunen: iemand die het formulier honderd keer afvuurt;
     - per CODE tegen het afgrazen: iemand die codes probeert tot er een past.
   Dezelfde vorm en dezelfde redenering als de code-deuren in ./doelgroepen.js;
   de volledige uitleg (en waarom de sleutel NIET ip+code mag zijn) staat in
   routes/rtfkantoor/codedeuren.js en wordt hier niet herhaald.

   /start IS RUIMER GEREMD DAN JE ZOU DENKEN, en dat is met opzet. Een strakke
   rem op het aanmaken beschermt onze database en raakt de verkeerde: iemand die
   in paniek twee keer op verzenden drukt, of een buurthuis waar drie mensen op
   hetzelfde wifi zitten. Een dubbele zaak is hinderlijk; een geweigerde melding
   is erger (zie ook het contract van deze route in
   lib/mutatiecontracten-beschermzaak.js: een tweede melding is een tweede zorg
   en wordt nooit stil samengevoegd). */
const rem = require('../../rem');

module.exports = ({ app, rtfos, veilig }) => {
  const codeVan = req => String((req.body && req.body.code) || '').trim().slice(0, 40).toUpperCase();
  const bronRem = rem({ windowMs: 60000, limit: 30, key: req => 'bzdeur-ip|' + String(req.ip) });
  const codeRem = rem({ windowMs: 60000, limit: 60, key: req => 'bzdeur|' + codeVan(req) });
  const leesRem = rem({ windowMs: 60000, limit: 120, key: req => 'bzdeur-lees|' + String(req.ip) });

  // welke plaatsen dit kunnen oppakken -- namen, verder niets
  app.post('/api/bescherming/deur/steden', leesRem, (req, res) =>
    veilig(res, () => rtfos.beschermzaak.voordeur.steden()));

  // de deur zelf
  app.post('/api/bescherming/deur/start', bronRem, (req, res) =>
    veilig(res, () => rtfos.beschermzaak.voordeur.start(req.body || {})));

  // terugkomen op de eigen code; geeft met opzet het minimum
  app.post('/api/bescherming/deur/stand', bronRem, codeRem, (req, res) =>
    veilig(res, () => rtfos.beschermzaak.voordeur.stand(codeVan(req))));

  // wie ja zei mag nee zeggen, zonder eerst te bellen
  app.post('/api/bescherming/deur/intrekken', bronRem, codeRem, (req, res) =>
    veilig(res, () => rtfos.beschermzaak.voordeur.trekIn(codeVan(req), (req.body || {}).reden)));
};
