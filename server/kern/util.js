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
   !== lekt via de reactietijd hoeveel tekens al kloppen. We hashen beide
   kanten naar vaste lengte en vergelijken in constante tijd, zoals banken
   dat doen. */
function veiligGelijk(a, b) {
  const ha = crypto.createHash('sha256').update(String(a == null ? '' : a)).digest();
  const hb = crypto.createHash('sha256').update(String(b == null ? '' : b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

module.exports = { schoon, ledenPrijs, centen, entreeCode, pickupCode, codeUit, LEESBAAR, veiligGelijk };
