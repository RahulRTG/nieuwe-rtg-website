/* DE KLUISPOORT -- wie mag er in de identiteitskluis kijken?

   WAAROM DEZE POORT NAAST officeAuth STAAT. De backoffice-code is GEDEELD
   (routes/office/toegang.js maakt met een enkele code een sessie zonder
   lidKey), en officeAuth kent maar een rang. Daardoor droeg diezelfde
   anonieme sessie de zwaarste handelingen die dit huis kent: een paspoortscan
   beoordelen, nationaliteit en geboortedatum vastleggen, het nummer van een
   BIG-registratie openen.

   Het inzagejournaal was daar eerlijk over -- routes/office/wiekijkt.js
   schrijft met zoveel woorden "backoffice (gedeelde code)" -- en die
   eerlijkheid is beter dan een verzonnen naam. Maar er ligt een hashketen
   onder dat journaal, en dan staat er straks onwijzigbaar "iemand van
   kantoor" bij een besluit waar een mens naar een document heeft gekeken.
   Een spoor dat niet naar een mens leidt, is geen spoor.

   DE POORT VRAAGT DUS IDENTITEIT EN GEEN EXTRA RECHT. Wie via zijn eigen
   RTG-account de kantoordeur binnenkomt (kern/eenaccount/starten.js zet dan
   lidKey op de sessie) of als eigenaar, komt er gewoon door. Alleen de
   naamloze gedeelde sessie niet -- en die krijgt geen "geen toegang" te zien
   maar de weg erheen, want dat is precies het verschil tussen een grens en
   een muur.

   WAT HIER NIET GEBEURT: de gedeelde code afsluiten. Het kantoor doet er het
   dagelijkse werk mee (orders, ritten, meldingen) en dat werk hoort niet stil
   te vallen voor een reparatie aan een andere deur. Deze poort verkleint wat
   die sessie MAG; hij verandert niets aan wie er binnenkomt. */
'use strict';

module.exports = ({ officeAuth, sessionFor }) =>
function kluisAuth(req, res, next) {
  officeAuth(req, res, () => {
    if (req.eigenaar) return next();
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const sess = token && sessionFor(token);
    if (sess && sess.role === 'office' && sess.lidKey) {
      req.kantoorKey = sess.lidKey;
      return next();
    }
    return res.status(403).json({
      error: 'Hiervoor is een kantoorsessie op naam nodig. De gedeelde backoffice-code komt hier niet door: ' +
        'wat hier gebeurt, komt in het inzagejournaal te staan, en daar hoort een mens bij en geen gedeelde code. ' +
        'Log in met uw eigen RTG-account en koppel daarin de kantoorrol.',
      watNu: 'inloggen-op-naam', poort: 'kluis' });
  });
}
