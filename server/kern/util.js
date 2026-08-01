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

/* EEN COORDINAAT, OF NIETS.

   Number(null) is 0, en JSON maakt van een NaN, een undefined of een
   ontbrekend veld precies null. Een controle met alleen Number.isFinite() --
   of met een bereikcontrole, want 0 ligt netjes binnen elk bereik -- liet een
   half verstuurde positie er dus als 0,0 doorheen: Null Island in de Golf van
   Guinee. Op een SOS-route betekent dat iemand in nood met een positie aan de
   andere kant van de wereld.

   Vandaar deze ene plek. coord() geeft NaN terug voor alles wat geen echt
   getal is, en controleert meteen of het op aarde ligt. 0,0 blijft gewoon
   geldig: wie daar echt vaart mag zijn positie delen.

   Keuringsregel 24 bewaakt dat niemand het opnieuw met de hand doet. */
function coord(v, max) {
  if (typeof v !== 'number' && !(typeof v === 'string' && v.trim() !== '')) return NaN;
  const n = Number(v);
  if (!Number.isFinite(n) || Math.abs(n) > (max || 180)) return NaN;
  return n;
}
const coordPaar = (a, b) => {
  const lat = coord(a, 90), lng = coord(b, 180);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

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


/* De foutmelding die NAAR BUITEN gaat, zonder ons bestandssysteem erin.

   Verschillende routes geven `e.message` rechtstreeks terug. Voor de eigen
   validatiemeldingen van een module ("Schrijf iets, of kies een foto") is dat
   precies goed: dat is de tekst die de gebruiker moet lezen. Maar zodra er een
   ONVERWACHTE fout doorheen glipt, staat er iets als
   "ENOENT: no such file or directory, open '/home/rtg/app/server/data/db.json'",
   en dan vertelt de foutmelding een buitenstaander waar onze server draait, hoe
   hij is uitgerold en hoe de mappen heten. Dat is geen ramp op zichzelf, maar
   het is gratis verkenning voor wie verder wil.

   Deze functie laat de tekst intact en haalt er alleen de paden uit. Zo blijft
   een nette melding een nette melding, en wordt een gelekt pad een <pad>. */
const PAD_RE = /(?:[A-Za-z]:)?[\/\\][\w.@ +-]+(?:[\/\\][\w.@ +-]+){2,}/g;
function veiligeFout(e, standaard) {
  const ruw = (e && e.message) || '';
  const schoongemaakt = String(ruw).replace(PAD_RE, '<pad>').trim();
  return schoongemaakt || standaard || 'Er ging iets mis.';
}

module.exports = { schoon, veiligeFout, coord, coordPaar, ledenPrijs, centen, entreeCode, pickupCode, codeUit, LEESBAAR, veiligGelijk, eigenVeld };
