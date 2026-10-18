/* DE DEMO-INLOG: een inlog (Rahul / Imran) voor elk kanaal.

   Zo kunt u het klantportaal, de leverancier-app en het personeelskanaal met
   dezelfde gebruikersnaam en wachtwoord uitproberen. De gebruikersnaam is
   hoofdletterongevoelig, het wachtwoord niet.

   WAAROM EEN EIGEN BESTAND. Dit stond midden in server/server.js en ging van
   daaruit via de kern-tas naar de inlog van leden, personeel en verificatie.
   `hasCred` was daar een functie van zeventig tekens zonder herkomst, en
   scripts/activering.js kon dus niet zeggen wat er wakker wordt als een van
   die functies aangaat -- drie enveloppen bleven een ondergrens. Een require
   is wel te volgen, en de vraag "wat is de demo-inlog" heeft nu een adres. */
'use strict';
const { veiligGelijk } = require('../util');

const DEMO_USER = (process.env.DEMO_USER || 'rahul').trim().toLowerCase();
const DEMO_PASS = process.env.DEMO_PASS || 'Imran';
const DEMO_SUPPLIER = process.env.DEMO_SUPPLIER || 'KIKUNOI';

// draagt dit verzoek een demo-inlog (gebruikersnaam of wachtwoord)?
function hasCred(body) { return !!body && (body.username != null || body.password != null); }

// tijd-veilig vergeleken: een gewone !== lekt via de reactietijd hoeveel klopt
function checkCred(username, password) {
  const userOk = veiligGelijk(String(username || '').trim().toLowerCase(), DEMO_USER);
  const passOk = veiligGelijk(String(password || ''), DEMO_PASS);
  return userOk && passOk;
}

module.exports = { DEMO_USER, DEMO_PASS, DEMO_SUPPLIER, hasCred, checkCred };
