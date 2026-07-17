/* Zuivere kern-hulpjes: geen gedeelde staat, alleen invoer -> uitvoer. Zo staan
   ze los-testbaar buiten de grote server.js en kunnen andere modules ze delen. */
const crypto = require('crypto');

// Ontsmet vrije invoer: verwijder < en > (geen HTML), knip af en trim.
// Alleen echte primitieven (string/getal/bool) worden tekst; een array of
// object is nooit geldige invoer en wordt leeg. Dat is ook een schild: een
// diep geneste array via String() coercen laat de stack overlopen (Array.
// toString -> join -> recursie), en dat mag geen enkel veld kunnen.
function schoon(v, n) {
  if (v == null) return '';
  const t = typeof v;
  if (t !== 'string' && t !== 'number' && t !== 'boolean') return '';
  return String(v).replace(/[<>]/g, '').slice(0, n || 120).trim();
}

// Ledenprijsgarantie: reken nooit meer dan de publieke prijs.
function ledenPrijs(publiek, ledenprijs) {
  const p = Math.max(0, Number(publiek) || 0);
  const l = Math.max(0, Number(ledenprijs != null ? ledenprijs : publiek) || 0);
  return Math.min(l, p);
}

// Bedrag netjes op centen afronden.
function centen(n) { return Math.round(n * 100) / 100; }

// Codes zonder verwarrende tekens (0/O/1/I), makkelijk voor te lezen.
const LEESBAAR = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function codeUit(lengte) { let c = ''; for (let i = 0; i < lengte; i++) c += LEESBAAR[crypto.randomInt(LEESBAAR.length)]; return c; }
function entreeCode() { return codeUit(6); }
function pickupCode() { return codeUit(4); }

/* Tijd-veilige vergelijking van geheimen (codes, wachtwoorden): een gewone
   !== lekt via de reactietijd hoeveel tekens al kloppen. We brengen beide
   kanten met een HMAC onder een verse, willekeurige sleutel naar vaste lengte
   en vergelijken in constante tijd (de bekende "double HMAC"-truc). De
   willekeurige sleutel maakt de uitkomst onvoorspelbaar; dit is geen
   wachtwoord-opslag (dat gebeurt met scrypt in accounts.js), alleen een
   constante-tijd-vergelijking. */
function veiligGelijk(a, b) {
  const sleutel = crypto.randomBytes(32);
  const ha = crypto.createHmac('sha256', sleutel).update(String(a == null ? '' : a)).digest();
  const hb = crypto.createHmac('sha256', sleutel).update(String(b == null ? '' : b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/* Veilige objecttoegang met een sleutel uit gebruikersinvoer. Zonder deze
   check zou een sleutel als "__proto__", "constructor" of "prototype" het
   prototype teruggeven; muteer je dat object daarna, dan vervuil je
   Object.prototype voor de hele server (prototype-pollution). We geven daarom
   alleen echte eigen velden terug, en nooit die drie magische sleutels. */
function eigenVeld(obj, sleutel) {
  if (obj == null) return undefined;
  const k = String(sleutel == null ? '' : sleutel);
  if (k === '__proto__' || k === 'constructor' || k === 'prototype') return undefined;
  return Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : undefined;
}

module.exports = { schoon, ledenPrijs, centen, entreeCode, pickupCode, codeUit, LEESBAAR, veiligGelijk, eigenVeld };
