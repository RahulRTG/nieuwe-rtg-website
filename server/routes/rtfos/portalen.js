/* Domein "rtfos", deel "portalen": de drie deuren die opengaan op een CODE.

   De partnerstichting, de gemeente en de lokale ondernemer hebben geen
   RTG-account en horen er ook geen te krijgen: ze zijn geen lid, ze werken
   samen. Hun code IS de geloofsbrief, en elk portaal toont uitsluitend het
   dossier dat bij die ene code hoort.

   DE REM IS DEZELFDE ALS BIJ DE CLUBCODES, EN OM DEZELFDE REDEN. Zonder rem
   hangt de sterkte volledig aan de lengte van de code, en raden gaat niet tegen
   EEN code: elke poging wordt getoetst aan ALLE partners tegelijk (vindCode
   zoekt in de lijst), dus bij honderd dossiers is de kans per poging honderd
   keer zo groot. Twee remmen, en ze doen niet hetzelfde:

     1. PER BRON (20/min) stopt het afgrazen: veel codes vanaf een adres. Deze
        sleutel mag NIET ip+code zijn -- dan krijgt een raadmachine die elke
        poging een andere code stuurt voor elke poging een verse bak, en dat is
        precies de aanvaller die je wilde vangen.
     2. PER CODE (60/min) stopt het omgekeerde: veel bronnen op een code.

   De volledige redenering staat in routes/rtfkantoor/codedeuren.js, met de
   mutatie die aantoont dat de eerste sleutel fout was (test/rtfcoderem.test.js).
   Wat ook hier blijft staan voor de externe toets: deze codes hebben nog geen
   vervaldatum en geen intrekknop.

   Deze drie paden staan met een reden op de publieke lijst van check.js regel
   28. Ze zijn publiek omdat er per definitie geen sessie kan zijn, en ze zijn
   veilig omdat de code het dossier bepaalt en niet de vraagsteller. */
const rem = require('../../rem');

module.exports = ({ app, rtfos, veilig }) => {
  const codeVan = req => String((req.body && req.body.code) || '').trim().slice(0, 40).toUpperCase();
  const ipRem = rem({ windowMs: 60000, limit: 20, key: req => 'rtfoscode-ip|' + String(req.ip) });
  const codeRem = rem({ windowMs: 60000, limit: 60, key: req => 'rtfoscode|' + codeVan(req) });

  // de lokale stichting: het eigen dossier, de eigen afspraken, de eigen projecten
  app.post('/api/rtfos/portaal/partner', ipRem, codeRem, (req, res) =>
    veilig(res, () => rtfos.partners.portaal(codeVan(req))));

  // de gemeente: uitsluitend getelde cijfers, nooit een dossier (kern/rtfos/gemeente.js)
  app.post('/api/rtfos/portaal/gemeente', ipRem, codeRem, (req, res) =>
    veilig(res, () => rtfos.gemeente.portaal(codeVan(req))));

  // de lokale ondernemer: het eigen aanbod en waar het terecht is gekomen
  app.post('/api/rtfos/portaal/ondernemer', ipRem, codeRem, (req, res) =>
    veilig(res, () => rtfos.ondernemers.portaal(codeVan(req))));
};
