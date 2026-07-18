/* De RTG-kantoren: elke afdeling een eigen kamer met de cijfers en werklijsten
   die er voor die afdeling toe doen, plus een eigen takenlijst. De boardroom
   staat erboven: die ziet alle kamers in een oogopslag, bedient het volledige
   functieschakelbord (elke functie van het platform aan/uit, ook per
   doelgroep) en houdt een verbeterkamer bij met voorstellen.

   Eerlijk over "zichzelf verbeteren": instellingen (schakelaars, standen)
   past de boardroom zelf aan, met een knop of automatisch via een voorstel.
   Voorstellen die code raken blijven voorstellen voor de ontwikkelstraat;
   een systeem dat zijn eigen productiecode herschrijft bouwen we bewust niet. */

const functies = require('../functies');

module.exports = ({ db, save, crypto, anthropic, ledenAantal }) => {
  // Het ledental komt uit de onderhouden O(1)-teller (die met Postgres ook de
  // leden buiten het geheugen meetelt); Object.keys(memberDir) zou daar 0 geven
  // en is bovendien O(N) over de hele gids.
  const ledenGeteld = () => (typeof ledenAantal === 'function' ? ledenAantal() : Object.keys(d().memberDir || {}).length);

  const nu = () => Date.now();
  const DAG = 86400000;
  // collecties zijn soms een array en soms een map (id -> item); dit vlakt dat uit
  const lijst = x => Array.isArray(x) ? x : (x && typeof x === 'object' ? Object.values(x) : []);
  const tel = x => lijst(x).length;
  const recent = (x, veld, dagen) => lijst(x).filter(i => i && i[veld] && (nu() - new Date(i[veld]).getTime()) < dagen * DAG).length;
  const d = () => db.data;

  /* ---- het afdelingsregister (de twaalf kamers) woont in afdelingen/register.js ---- */
  const AFDELINGEN = require('./afdelingen/register')({ d, lijst, tel, recent, ledenGeteld, functies });
  const KAMER_IDS = Object.keys(AFDELINGEN);


  /* De boardroom-, kantoorleven- en bewakingslaag draaien als submodules
     op een gedeelde context, een keer opgebouwd bij het opstarten; de
     boardroomlaag bindt audit/paniekRij laat (per aanroep), de
     bewakingslaag krijgt schakel via de context. */
  const ctx = { db, save, crypto, anthropic, ledenGeteld, nu, DAG, lijst, tel, recent, d, AFDELINGEN, KAMER_IDS, functies };
  const deelBoardroom = require('./afdelingen/boardroom')(ctx);
  Object.assign(ctx, deelBoardroom);
  const deelKantoor = require('./afdelingen/kantoorleven')(ctx);
  Object.assign(ctx, deelKantoor);
  const deelBewaking = require('./afdelingen/bewaking')(ctx);
  Object.assign(ctx, deelBewaking);
  const { taken, taakMaak, taakZet, kamer, kamers, functiesStand, schakel, schakelAlles, bouwVoorstellen, voorstellen, boardroom, platformStats } = deelBoardroom;
  const { chatRij, chatLijst, chatStuur, HUISREGELS, ONBOARDING_EXTRA, onboarding, dienstRij, dienstIn, dienstUit, dienstNu } = deelKantoor;
  const { paniekRij, paniekStel, paniekBesluit, paniekBericht, paniekLijst, auditRij, audit, laatstePerDoos, opdrachtRij, wereld, wereldActie, opdrachtVoorDoos } = deelBewaking;

  return { afdelingen: { kamers, kamer, taakMaak, taakZet, boardroom, schakel, schakelAlles, voorstellen, paniekStel, paniekBesluit, paniekBericht, paniekLijst, platformStats, chatLijst, chatStuur, onboarding, dienstIn, dienstUit, dienstNu, wereld, wereldActie, opdrachtVoorDoos, audit, KAMER_IDS } };
};
