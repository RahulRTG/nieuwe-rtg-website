/* Centrale redactie voor console, foutbord en externe fouttracker. */
'use strict';

/* WAT HIER BEWUST BIJ STAAT, en waarom. De eerste versie ving hex-sleutels,
   query-tokens en Bearer, maar liet de waardevolste geheimen ongemoeid: het
   wachtwoord IN een verbindings-URL (redis://u:WW@, postgresql://u:WW@), een
   betaalsleutel (sk_live_, whsec_), een private key in PEM, en `password=` of
   een Cookie-kop. Elke aanroeper hoefde die toen zelf te vermijden -- wat ze
   toevallig allemaal deden. Een vangnet dat de duurste gevallen niet vangt, is
   geen vangnet; test/geheimkanarie.test.js start de echte server met nep-
   geheimen en zakt zodra er een in de uitvoer staat. */
function geheimVrij(waarde) {
  return String(waarde == null ? '' : waarde)
    .replace(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g, '[GEHEIM]')
    .replace(/\b([a-z][a-z0-9+.-]{1,20}:\/\/)[^\s/:@?#]*:[^\s@/?#]*@/gi, '$1[GEHEIM]@')
    .replace(/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{6,}/g, '[GEHEIM]')
    .replace(/\bwhsec_[A-Za-z0-9+/=]{6,}/g, '[GEHEIM]')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[GEHEIM]')
    .replace(/(^|\s)Basic\s+[A-Za-z0-9+/=]{6,}/g, '$1Basic [GEHEIM]')
    .replace(/(\bcookie\s*:\s*)[^\r\n]+/gi, '$1[GEHEIM]')
    .replace(/(["']?\b(?:password|passwd|pwd|wachtwoord|secret|geheim|api[_-]?key|apikey|client[_-]?secret|private[_-]?key|authorization)["']?\s*[:=]\s*["']?)[^"'\s,;&}]+/gi,
      '$1[GEHEIM]')
    .replace(/\b(?:[A-Z0-9_-]{1,12}(?:\.|%2e))?[A-F0-9]{32,}\b/gi, '[GEHEIM]')
    .replace(/([?&#](?:code|token|secret|key|kassacode)=)[^&#\s]+/gi, '$1[GEHEIM]')
    .replace(/\b((?:kassa|kamer|groep|reis|deel|toegang|uitnodigings?)?code)\s*[:=]\s*([^\s,;]+)/gi,
      '$1=[GEHEIM]')
    .replace(/(^|\s)Bearer\s+[^\s,;]+/gi, '$1Bearer [GEHEIM]')
    .replace(/\/werken\/[^/\s?#]+/gi, '/werken/:code')
    .replace(/\/api\/projectie\/[^/\s?#]+/gi, '/api/projectie/:credential');
}

/* Een verbindings-URL (redis://, postgres://, ...) zonder gebruikersnaam en
   wachtwoord, om te loggen. Alleen schema, host en poort blijven over. Een
   onleesbare waarde wordt NIET teruggegeven zoals ze is: dan kon het geheim er
   alsnog in zitten. */
function urlZonderGeheim(url) {
  try {
    const u = new URL(String(url));
    return u.protocol + '//' + u.host + (u.pathname && u.pathname !== '/' ? u.pathname : '');
  } catch (e) { return '[onleesbare url]'; }
}

const GEHEIME_NAAM = /^(?:password|passwd|pwd|wachtwoord|huidig|nieuw(?:wachtwoord)?|secret|geheim|token|bearer|cookie|authorization|api[_-]?key|apikey|client[_-]?secret|private[_-]?key|privesleutel|pin|totp|otp|herstelcode)$/i;

function veiligeWaarde(waarde, diepte = 0) {
  if (typeof waarde === 'string') return geheimVrij(waarde);
  if (waarde == null || typeof waarde !== 'object' || diepte > 3) return waarde;
  if (Array.isArray(waarde)) return waarde.slice(0, 100).map(v => veiligeWaarde(v, diepte + 1));
  const uit = {};
  /* Een waarde onder een geheime NAAM is geheim, welke vorm hij ook heeft:
     { wachtwoord: 'zomer2026' } heeft geen hexvorm of voorvoegsel om op te
     herkennen. */
  for (const [k, v] of Object.entries(waarde))
    uit[k] = GEHEIME_NAAM.test(k) && typeof v === 'string' && v !== '' ? '[GEHEIM]' : veiligeWaarde(v, diepte + 1);
  return uit;
}

function veiligeFout(err) {
  const bron = err instanceof Error ? err : new Error(String(err));
  const veilig = new Error(geheimVrij(bron.message));
  veilig.name = bron.name || 'Error';
  veilig.stack = geheimVrij(bron.stack || veilig.stack);
  if (bron.code != null) veilig.code = geheimVrij(bron.code);
  return veilig;
}

/* De console van het SERVERPROCES gaat ook door de redactie. Er staan honderden
   console-aanroepen in server/ die langs log.js heen schrijven; elk van hen is
   vandaag veilig omdat de aanroeper toevallig geen geheim meegeeft. Dit maakt
   dat een eigenschap van het proces in plaats van van elke aanroeper.
   Alleen server/server.js zet hem aan, zodat scripts en toetsen die een
   servermodule laden hun eigen uitvoer houden. */
let consoleBewaakt = false;
function bewaakConsole(doel = console) {
  if (consoleBewaakt) return false;
  consoleBewaakt = true;
  for (const naam of ['log', 'info', 'warn', 'error', 'debug', 'trace']) {
    const origineel = typeof doel[naam] === 'function' ? doel[naam].bind(doel) : null;
    if (!origineel) continue;
    doel[naam] = (...args) => origineel(...args.map(a => a instanceof Error ? veiligeFout(a) : veiligeWaarde(a)));
  }
  return true;
}

module.exports = { geheimVrij, veiligeWaarde, veiligeFout, urlZonderGeheim, bewaakConsole };
