/* Domein "rtfos", deel "portalen": de drie deuren die opengaan op een CODE.

   EEN ACCOUNT EN EEN CODE (eigenaarsbesluit 19 oktober 2026; dit vervangt
   "geen RTG-account en er ook geen horen te krijgen"). De medewerker van de
   partnerstichting, de gemeente of de lokale ondernemer maakt een gratis
   account -- de accountdeur staat in het scherm (foundation/os-portaal.html).
   De code koppelt dat account de eerste keer aan het dossier en is daarna een
   EXTRA sleutel naast de sessie, nooit in plaats ervan: voor elk ander account
   bestaat hij niet (kern/codekoppel.js, die ook vastlegt welk account welk
   dossier opende). Elk portaal toont nog steeds uitsluitend het dossier dat
   bij die ene code hoort.

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
   vervaldatum en geen intrekknop. */
const rem = require('../../rem');

module.exports = ({ app, auth, officeAuth, rtfos, veilig, genootschapDrager }) => {
  const koppel = rtfos.codekoppeling;
  const codeVan = req => String((req.body && req.body.code) || '').trim().slice(0, 40).toUpperCase();
  const ipRem = rem({ windowMs: 60000, limit: 20, key: req => 'rtfoscode-ip|' + String(req.ip) });
  const codeRem = rem({ windowMs: 60000, limit: 60, key: req => 'rtfoscode|' + codeVan(req) });

  // de lokale stichting: het eigen dossier, de eigen afspraken, de eigen projecten
  app.post('/api/rtfos/portaal/partner', auth, ipRem, codeRem, (req, res) =>
    veilig(res, () => koppel.met(req, 'partner', codeVan(req), () => rtfos.partners.portaal(codeVan(req)))));

  /* de genootschappen die de stichting vroegen haar DRAGER te zijn (B1,
     GEMEENSCHAP-FASE0.md par. 4.1): naam en stand, nooit leden of een aantal --
     en erkennen, alleen een vraag die op deze stichting staat. Of de stichting
     erkend is, beslist het partnerregister (partners.erkend). */
  app.post('/api/rtfos/portaal/partner/genootschap', auth, ipRem, codeRem, (req, res) =>
    veilig(res, () => koppel.met(req, 'partner', codeVan(req), () => genootschapDrager.voorPartner(codeVan(req)))));
  app.post('/api/rtfos/portaal/partner/genootschap/erken', auth, ipRem, codeRem, (req, res) =>
    veilig(res, () => koppel.met(req, 'partner', codeVan(req), () => genootschapDrager.erken(codeVan(req), (req.body || {}).groep))));

  // de gemeente: uitsluitend getelde cijfers, nooit een dossier (kern/rtfos/gemeente.js)
  app.post('/api/rtfos/portaal/gemeente', auth, ipRem, codeRem, (req, res) =>
    veilig(res, () => koppel.met(req, 'gemeente', codeVan(req), () => rtfos.gemeente.portaal(codeVan(req)))));

  // de lokale ondernemer: het eigen aanbod en waar het terecht is gekomen
  app.post('/api/rtfos/portaal/ondernemer', auth, ipRem, codeRem, (req, res) =>
    veilig(res, () => koppel.met(req, 'ondernemer', codeVan(req), () => rtfos.ondernemers.portaal(codeVan(req)))));

  /* ROTEREN (eigenaarsbesluit 19 oktober 2026): een kantoormens op naam, door de
     poort van de stad, geeft een nieuwe code. De oude gaat dicht voor iedereen,
     en de koppeling die eraan hing vervalt (kern/rtfos/coderoteer.js). */
  const roteer = (soort) => (req, res) => veilig(res, () => {
    const b = req.body || {};
    const oud = rtfos.codeRoteren.codeVan(soort, b.id);
    const r = rtfos.codeRoteren.roteer(req, soort, b.id, b.reden);
    if (r && r.ok) koppel.vervalt(soort, oud);
    return r;
  });
  app.post('/api/rtfos/partner/code/roteren', officeAuth, roteer('partner'));
  app.post('/api/rtfos/gemeente/code/roteren', officeAuth, roteer('gemeente'));
  app.post('/api/rtfos/ondernemer/code/roteren', officeAuth, roteer('ondernemer'));
};
