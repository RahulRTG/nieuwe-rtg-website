/* DE POORT DIE OM EEN NAAM VRAAGT -- twee gebruikers, een implementatie.

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
   die sessie MAG; hij verandert niets aan wie er binnenkomt.

   DE TWEEDE GEBRUIKER: DE DOCUMENTENUITGIFTE (TAKEN.md 4.73). Daar speelde
   exact hetzelfde, en scherper. `server/routes/uitgifte.js` tekent met vier
   ogen, en de naam onder die handtekening kwam uit `req.body.wie` -- een
   tekenreeks die de aanroeper zelf typt. Twee "verschillende" ondertekenaars
   waren dus twee verschillende woorden uit dezelfde sessie, en het vier-ogen-
   principe was daarmee een vormvereiste in plaats van een grens.

   Dat is dezelfde vraag als hierboven -- draagt deze sessie een mens? -- dus
   het is dezelfde poort en geen tweede. Alleen de REDEN verschilt (een
   inzagejournaal tegenover een handtekening), en die staat in de opties. Een
   tweede kopie van deze controle zou binnen een half jaar uiteenlopen met de
   eerste; dat is LAT.md regel 4 op een poort, en dat is de duurste plek. */
'use strict';

/* De standaardreden is die van de kluis: dat was de eerste gebruiker, en zo
   verandert er niets voor wie hem al aanriep. */
const KLUIS = Object.freeze({
  naam: 'kluisAuth',
  poort: 'kluis',
  error: 'Hiervoor is een kantoorsessie op naam nodig. De gedeelde backoffice-code komt hier niet door: ' +
    'wat hier gebeurt, komt in het inzagejournaal te staan, en daar hoort een mens bij en geen gedeelde code. ' +
    'Log in met uw eigen RTG-account en koppel daarin de kantoorrol.'
});

/* ELKE INSTANTIE DRAAGT ZIJN EIGEN NAAM, en dat is geen cosmetica. De
   registers van dit huis herkennen een poortwachter aan de NAAM van de functie:
   test/bewakersketen.test.js noemt per domein welke sloten er mogen hangen, en
   test/scheiding.test.js doet hetzelfde. Toen deze functie eenmalig
   `opNaamAuth` heette, vielen de kluisdeuren en de handtekeningdeur in die
   registers samen tot een naam -- acht routes gingen rood, en de twee deuren
   waren niet meer uit elkaar te houden. Een gedeelde implementatie mag geen
   gedeelde identiteit worden. */
module.exports = ({ officeAuth, sessionFor }, opties) => {
  const reden = opties || KLUIS;
  const poort = function (req, res, next) {
    officeAuth(req, res, () => {
      if (req.eigenaar) return next();
      const header = req.get('authorization') || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      const sess = token && sessionFor(token);
      if (sess && sess.role === 'office' && sess.lidKey) {
        req.kantoorKey = sess.lidKey;
        return next();
      }
      /* Geen "geen toegang" maar de WEG erheen -- dat is het verschil tussen een
         grens en een muur, en het staat hierboven als de reden dat deze poort
         zo is gebouwd. */
      return res.status(403).json({
        error: reden.error, watNu: 'inloggen-op-naam', poort: reden.poort });
    });
  };
  Object.defineProperty(poort, 'name', { value: reden.naam || 'kluisAuth' });
  return poort;
};

module.exports.KLUIS = KLUIS;
