/* RTFoundation (deelmodule): DE ACCOUNTPLICHT VAN HET GEZIN.

   Besluit van de eigenaar, 5 oktober 2026: een minderjarige komt alleen binnen
   via het account van een ouder. Deze regel hangt in gezinshulp.js profielVan(),
   de ene plek waar elk gezinstoken langskomt, en niet in de vijftig routes
   erachter.

   In productie opent een token alleen nog iets in een gezin met een EIGENAAR
   (een RTG-account, ./gezinseigenaar.js). Een beschermd profiel (kind, of 15
   jaar en jonger) opent alleen als RTG het paspoort van die eigenaar heeft
   gezien: volwassen() uit kern/volwassen.js, laat gebonden als
   ctx.volwassenSleutel. Is die binding er niet, dan is het antwoord nee. Een
   ontbrekende poort mag nooit als een open poort lezen.

   Sinds het eigenaarsbesluit van 19 oktober 2026 (AGENTS.md: gebruiken vraagt
   een account) geldt de plicht overal BUITEN DE DEMO, en niet alleen bij
   NODE_ENV=production: een echte server zonder NODE_ENV is geen demo. Alleen
   de afgezonderde testomgeving (server/testomgeving.js) kent nog anonieme
   gezinnen, voor de toetsen en Magnaat. RTF_GEZIN_ACCOUNTPLICHT=1 zet hem
   ook daar aan (test/gezinseigenaar.test.js).

   poort(): zes /api/rtf-families staan niet onder de vrijgavepoort en leunden
   alleen op deze plicht (connect, labfonds, beroepen, bieb, geloof,
   knelpunt). Hun eigen handlers zeggen bij elk geweigerd token "log opnieuw
   in bij je gezin" (403); voor een GELDIG token in een gezin zonder
   eigenaar-account is dat de verkeerde raad. Daar antwoordt de poort 401 met
   `accountNodig`, zodat het scherm naar de inlog kan sturen
   (test/toegang-gezin.test.js).

   Dit vervangt de vrijgavepoort NIET: zonder extern dossier blijven de
   beschermde routes in productie 503 (middleware/foundation-productiepoort.js).

   Daarnaast bewaak(): twee wachters voor de oude ingangen met code en PIN
   (zie hieronder). */
'use strict';

const testomgeving = require('../testomgeving');
// losSessie IS de centrale resolveSession (gemonteerd in kern/isolatie/sessiedragers.js)
const { losSessie: resolveSession } = require('../kern/isolatie/sessiedragers');

const VOLWASSEN_ROLLEN = ['beheerder', 'ouder', 'gezinslid', 'gast'];

function maak({ ctx, isBeschermd }) {
  function accountplicht() {
    return process.env.NODE_ENV === 'production' || process.env.RTF_GEZIN_ACCOUNTPLICHT === '1' ||
      !testomgeving.actief(process.env);
  }
  function volwassenAccount(userId) {
    if (userId == null || typeof ctx.volwassenSleutel !== 'function') return false;
    try { return ctx.volwassenSleutel('user-' + userId) === true; } catch (e) { return false; }
  }
  function magDoor(g, p) {
    if (!accountplicht()) return true;
    if (!g || !g.eigenaar || g.eigenaar.userId == null) return false;
    return isBeschermd(p) ? volwassenAccount(g.eigenaar.userId) : true;
  }
  /* De twee oude ingangen die onder de plicht doodlopen, als wachters VÓÓR de
     routes in gezin.js (router.use, dus geen tweede route op hetzelfde pad):
     - /gezin/maak: een anoniem gezin opent onder de plicht niets, dus wie hem
       maakt zou daarna bij elke stap "log opnieuw in" lezen. Hij hoort de weg.
     - /gezin/profiel/maak: geen kind via de beheerderspincode, anders was dit
       de omweg om de paspoorttrede heen. gezin.js maakt van elke onbekende rol
       een kind, dus dit weigert alles wat geen volwassen rol is. */
  function bewaak(router) {
    router.use('/gezin/maak', (req, res, next) => {
      if (!accountplicht()) return next();
      res.status(409).json({ error: 'Maak je gezin via Mijn gezin in je RTG-account. Een gratis account is genoeg.' });
    });
    router.use('/gezin/profiel/maak', (req, res, next) => {
      if (!accountplicht() || VOLWASSEN_ROLLEN.includes(req.body && req.body.rol)) return next();
      res.status(409).json({ error: 'Voeg je kind toe via Mijn gezin in je RTG-account.' });
    });
  }
  /* HET GEDEELDE TOESTEL (gevonden door FoundationOS, af89167b). Een verzoek
     met een gezinstoken in het lijf EN de ledensessie van een account dat dat
     token niet uitgaf, wordt geweigerd -- in de demo net zo goed, want dit is
     geen accountplicht maar een bevoegdheid. Alleen het gezinstoken blijft
     werken: dat is het toestel van het kind. Een token zonder uitgever (van
     voor deze regel, of van gezinscode en pincode): de veilige kant, dus alleen
     een account dat aantoonbaar aan dit gezin hangt (eigenaar, een profiel met
     dat account, of een gekoppelde oppas). Een gezin ZONDER eigenaar laat deze
     regel aan magDoor() over: buiten de demo opent zo'n token toch niets. */
  const hangtAan = (g, uid) => !!(g.eigenaar && g.eigenaar.userId === uid) ||
    Object.values(g.profielen || {}).some(p => (p.account && p.account.userId === uid) || (p.koppel && p.koppel.userId === uid));
  function vreemdAccount(req, G, gezinstoken) {
    const b = req.body || {}, raw = String(b.token || b.gezinToken || '');
    const kop = (req.get && req.get('authorization')) || '';
    if (!/^GZ\./i.test(raw) || !kop.startsWith('Bearer ') || /^GZ\./i.test(kop.slice(7))) return false;
    let lid = null;
    try { lid = resolveSession(kop.slice(7)); } catch (e) { lid = null; }
    const uid = lid && lid.account && Number(lid.account.id);
    const g = uid != null && G()[String(b.code || b.gezinCode || '').toUpperCase()];
    const h = g && gezinstoken.zoek(g, raw);
    if (!h) return false;
    const door = h.t && h.t.onderwerp && h.t.onderwerp.door;
    if (Number.isSafeInteger(door)) return door !== uid;
    return !!g.eigenaar && !hangtAan(g, uid);
  }
  function poort({ G, gezinstoken }) {
    return function gezinAccountPoort(req, res, next) {
      if (vreemdAccount(req, G, gezinstoken)) return res.status(403).json({ gezinssessieVanAnder: true,
        error: 'Deze gezinssessie hoort bij een ander account. Log uit bij het gezin en log in met je eigen account.' });
      if (!accountplicht() || !ACCOUNT_FAMILIES.some(f => req.path === f || req.path.startsWith(f + '/'))) return next();
      const b = req.body || {};
      const g = G()[String(b.code || '').toUpperCase()];
      const p = g && gezinstoken.vind(g, b.token);
      if (!p || (g.eigenaar && g.eigenaar.userId != null)) return next();
      res.status(401).json({ accountNodig: true,
        error: 'Dit gezin hangt nog niet aan een RTG-account. Log in met het account van een ouder; een gratis account is genoeg.' });
    };
  }
  return { accountplicht, volwassenAccount, magDoor, bewaak, poort };
}

const ACCOUNT_FAMILIES = Object.freeze(['/api/rtf/connect', '/api/rtf/labfonds', '/api/rtf/beroepen',
  '/api/rtf/bieb', '/api/rtf/geloof', '/api/rtf/knelpunt']);

module.exports = { maak, ACCOUNT_FAMILIES };
