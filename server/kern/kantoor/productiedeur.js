/* DE KANTOORDEUR IN PRODUCTIE: OP NAAM, MET EEN PASSKEY (besluit B10, genomen).

   In productie opent de gedeelde kantoorcode (OFFICE_CODE) het kantoor niet
   meer. Een kantoorsessie ontstaat daar op een plek: /api/account/start met de
   kantoorrol (kern/eenaccount/starten.js), met het eigen RTG-account EN een
   verse passkeyceremonie die aan dat account en die lid-sessie gebonden is
   (kern/zwaarbewijs.js, actie `kantoor-binnen`, zonder terugval). De sessie
   draagt daarna `kantoorBewijs`, en een kantoorsessie zonder dat bewijs opent
   in productie geen enkele kantoorroute -- ook een sessie die van voor dit
   besluit nog openstaat niet.

   Buiten productie verandert er niets: de gedeelde code blijft werken voor de
   toetsen en de demo, zoals bij de andere productiepoorten van dit huis
   (middleware/*-productiepoort.js).

   Drie regels die niet mogen sneuvelen:
   - FAIL-CLOSED. Ontbreekt de passkeylaag of het vaste adres (APP_URL) waar de
     ceremonie aan gebonden wordt, dan is er geen toegang, met de reden -- en
     nooit een terugval op de code.
   - DE CODE WORDT NIET EENS VERGELEKEN. De weigering komt voor de vergelijking,
     zodat de oude deur in productie geen orakel is voor wie de code raadt.
   - GEEN TWEEDE RECHTENMODEL. Deze module zegt alleen of een sessie in
     productie een bewezen mens met een passkey is. WIE de kantoorrol mag
     hebben, blijft bij de sleutelbos (kern/eenaccount.js) en de uitnodiging op
     naam (./uitnodiging.js); wat hij daarna mag, bij de poorten erachter. */
'use strict';

const ACTIE = 'kantoor-binnen';
/* B24: het KOPPELEN van de kantoorrol met een uitnodiging (kern/eenaccount/
   koppelen.js) is een eigen handeling met een eigen naam, zodat een ceremonie
   voor het koppelen nooit het kantoor opent en omgekeerd. */
const KOPPEL_ACTIE = 'kantoor-koppel';
const CODE_DICHT = 'KANTOORCODE_NIET_IN_PRODUCTIE';
const WEG = 'Log in met uw eigen RTG-account, kies de kantoorrol (/api/account/start met rol "kantoor") ' +
  'en bevestig met uw passkey. Hebt u de kantoorrol nog niet, vraag de eigenaar dan om een uitnodiging op naam.';

/* "Productie" is hier breder dan NODE_ENV. Een AANTOONBAAR OPENBAAR adres
   (APP_URL op een publiek domein) telt net zo goed: de gedeelde kantoorcode mag
   daar nooit open, ook niet als iemand NODE_ENV=production vergeet te zetten
   (RTG-V1-RELEASE blocker 3). 'onbekend'/'lokaal' blijven buiten productie, dus
   de toetsen en de demo veranderen niet. */
const { installatieSoort } = require('../../config/openbaar');
const isProductie = (env) => {
  const e = env || process.env;
  if (String(e.NODE_ENV || '') === 'production') return true;
  try { return installatieSoort(e).soort === 'openbaar'; } catch (x) { return false; }
};

/* De oude deur: /api/office/login en het kantoorgesprek. */
function codeDicht(env) {
  if (!isProductie(env)) return null;
  return { status: 403, code: CODE_DICHT, watNu: 'inloggen-op-naam', weg: WEG,
    error: 'In productie opent de gedeelde kantoorcode het kantoor niet meer. Het kantoor gaat alleen open op naam, met een passkey.' };
}

/* Is dit bewijs een passkeyceremonie van deze deur? Een vorm die er alleen op
   lijkt (een boolean, een andere methode) telt niet. */
function bewijsGeldig(b) {
  return !!(b && b.type === 'passkey' && b.methode === 'cryptografisch' && b.actie === ACTIE && b.op);
}

/* Mag deze kantoorsessie in productie een kantoorroute openen? */
function sessieMag(sess, env) {
  if (!isProductie(env)) return { ok: true };
  if (!sess || !sess.lidKey) return { ok: false, status: 401, body: { code: CODE_DICHT, watNu: 'inloggen-op-naam', weg: WEG,
    error: 'Deze kantoorsessie staat niet op naam. In productie opent alleen een kantoorsessie op naam, met een passkey, het kantoor.' } };
  if (!bewijsGeldig(sess.kantoorBewijs)) return { ok: false, status: 401, body: { code: 'KANTOOR_PASSKEY_ONTBREEKT',
    watNu: 'inloggen-op-naam', weg: WEG,
    error: 'Deze kantoorsessie is niet met een passkey geopend. Open het kantoor opnieuw via uw eigen RTG-account, met uw passkey.' } };
  return { ok: true };
}

/* De eigenaar met zijn kale lid-token: buiten productie mag dat (officeAuth),
   in productie niet -- ook hij opent het kantoor op naam met een passkey. Een
   lid-token zegt niet waarmee er is ingelogd, en een tweede, soepeler deur
   voor een mens is precies wat dit besluit sluit. */
function eigenaarDirect(env) {
  if (!isProductie(env)) return { ok: true };
  return { ok: false, status: 401, body: { code: 'KANTOOR_PASSKEY_ONTBREEKT', watNu: 'inloggen-op-naam', weg: WEG,
    error: 'In productie opent ook de eigenaar het kantoor via zijn eigen RTG-account met een passkey, niet met het kale lid-token.' } };
}

/* Het passkeybewijs bij het openen van het kantoor (accStart, rol kantoor).
   Geeft { ok:true, bewijs } (buiten productie: bewijs null), of een weigering
   in de vorm die /api/account/start doorgeeft. `zwaarVan` is een getter: de
   zware poort wordt later in de montage gemaakt dan de sleutelbos. */
async function startBewijs({ zwaarVan, accounts, key, req, env, actie, omschrijving }) {
  const naam = actie || ACTIE;
  const omgeving = env || process.env;
  if (!isProductie(omgeving)) return { ok: true, bewijs: null };
  let zwaar = null;
  try { zwaar = typeof zwaarVan === 'function' ? zwaarVan() : null; } catch (e) { zwaar = null; }
  if (!zwaar || typeof zwaar.eis !== 'function' || typeof zwaar.opties !== 'function' || !omgeving.APP_URL)
    return { status: 503, code: 'KANTOOR_PASSKEY_NIET_INGERICHT', watNu: 'melden-bij-rtg',
      error: 'De passkeycontrole voor het kantoor is op deze server niet ingericht. Het kantoor blijft dicht; er is geen terugval op de kantoorcode.' };
  const m = /^user-(\d+)$/.exec(String(key || ''));
  let user = null;
  try { user = m ? accounts.getUserById(Number(m[1])) : null; } catch (e) { user = null; }
  if (!user) return { status: 403, error: 'Het kantoor opent alleen met een eigen RTG-account.' };
  const sleutel = zwaar.sessieSleutel(req);
  const r = await zwaar.eis(user, naam, sleutel, req, omschrijving || 'Het openen van het kantoor', { zonderTerugval: true });
  if (r.ok && r.bewezen === true) {
    return { ok: true, bewijs: { type: 'passkey', methode: 'cryptografisch', graad: 'bewezen', actie: naam,
      op: new Date().toISOString() } };
  }
  if (r.ok) return { status: 403, watNu: 'passkey-zetten', error: 'Het kantoor opent in productie alleen met een passkey.' };
  /* Vraagt de poort om de ceremonie, geef hem dan meteen mee: zo heeft deze
     deur geen eigen optiesroute nodig, en is de challenge aan precies deze
     lid-sessie en deze handeling gebonden. */
  if (r.bevestigingNodig) {
    const o = await zwaar.opties(user, naam, sleutel, req);
    if (o && o.error) return { status: o.status || 400, error: o.error };
    return { status: 401, bevestigingNodig: true, actie: naam, error: r.error,
      bevestiging: { ceremonie: o.ceremonie, opties: o.opties } };
  }
  return r;
}

module.exports = { ACTIE, KOPPEL_ACTIE, CODE_DICHT, WEG, isProductie, codeDicht, bewijsGeldig, sessieMag, eigenaarDirect, startBewijs };
