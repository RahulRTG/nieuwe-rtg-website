/* Tijdzones: hoe laat is het BIJ DE ZAAK.

   De Mall loopt van Haarlem tot Ibiza. Zolang alles op servertijd rekende was
   "Nu open" in Ibiza een uur mis, en dat is precies het soort fout dat niemand
   meldt: de klant staat voor een dichte deur en denkt dat de zaak gesloten is,
   niet dat de app het mis had.

   Twee lagen, in deze volgorde:
     1. wat de zaak zelf heeft ingesteld (`s.tijdzone`, een IANA-naam)
     2. de hoofdzone van haar land

   De tweede is een AANNAME en zegt dat ook. Een land met meer dan een zone
   (Spanje heeft de Canarische Eilanden, Frankrijk zijn overzeese gebieden)
   krijgt hier zijn vastelandszone; wie daarbuiten zit stelt hem zelf in. Dat
   is eerlijker dan doen alsof een landcode een tijdzone is.

   Er wordt niets zelf uitgerekend: `Intl.DateTimeFormat` heeft de volledige
   zonedatabase aan boord, inclusief zomertijd, en die is per definitie beter
   bijgehouden dan een tabel van ons. Wel zonder dependency, zoals de rest van
   dit huis. */

/* De hoofdzone per land, voor de landen waar RTG werkelijk zaken heeft plus de
   buren. Een land dat hier niet staat valt terug op UTC, en dat is zichtbaar
   (`aangenomen: true, bron: 'terugval'`) in plaats van stil. */
const LAND_ZONE = {
  NL: 'Europe/Amsterdam', BE: 'Europe/Brussels', DE: 'Europe/Berlin', LU: 'Europe/Luxembourg',
  FR: 'Europe/Paris', MC: 'Europe/Monaco', ES: 'Europe/Madrid', PT: 'Europe/Lisbon',
  IT: 'Europe/Rome', CH: 'Europe/Zurich', AT: 'Europe/Vienna', GB: 'Europe/London',
  IE: 'Europe/Dublin', DK: 'Europe/Copenhagen', SE: 'Europe/Stockholm', NO: 'Europe/Oslo',
  FI: 'Europe/Helsinki', PL: 'Europe/Warsaw', CZ: 'Europe/Prague', GR: 'Europe/Athens',
  TR: 'Europe/Istanbul', MA: 'Africa/Casablanca', EG: 'Africa/Cairo', ZA: 'Africa/Johannesburg',
  AE: 'Asia/Dubai', QA: 'Asia/Qatar', IL: 'Asia/Jerusalem', TZ: 'Africa/Dar_es_Salaam',
  US: 'America/New_York', MX: 'America/Mexico_City', BR: 'America/Sao_Paulo', PE: 'America/Lima',
  JP: 'Asia/Tokyo', TH: 'Asia/Bangkok', ID: 'Asia/Jakarta', SG: 'Asia/Singapore',
  IN: 'Asia/Kolkata', HK: 'Asia/Hong_Kong', AU: 'Australia/Sydney', NZ: 'Pacific/Auckland'
};
const TERUGVAL = 'UTC';
const klok = require('../lib/klok');

const { geldigeZone, formatteerLokaal } = require('./tijdzone-format');

/* De zone van een zaak, met waar hij vandaan komt. `aangenomen` is waar zodra
   het niet de eigen instelling van de zaak is; een scherm kan dat tonen als
   "tijdzone nog niet ingesteld" in plaats van hem als feit te verkopen. */
function zoneVan(s, landCode) {
  const eigen = s && s.tijdzone;
  if (geldigeZone(eigen)) return { zone: eigen, bron: 'zaak', aangenomen: false };
  const land = String((s && s.country) || landCode || '').toUpperCase();
  if (LAND_ZONE[land]) return { zone: LAND_ZONE[land], bron: 'land', aangenomen: true };
  return { zone: TERUGVAL, bron: 'terugval', aangenomen: true };
}


/* Hoe laat is het in deze zone: de kalenderdatum, de weekdag (0 = zondag,
   zoals Date#getDay) en het aantal minuten sinds middernacht. Alle drie in de
   zone zelf, want een zaak die om 23:00 lokaal nog open is, is dat op een
   andere kalenderdag dan de server denkt. */
function lokaal(zone, wanneer) {
  return formatteerLokaal(geldigeZone(zone) ? zone : TERUGVAL, alsDatum(wanneer));
}

// een Date, ms of ISO-tekst; anders NU, van lib/klok (dus ook RTG_KLOK)
function alsDatum(wanneer) {
  const d = wanneer instanceof Date || wanneer == null ? wanneer : new Date(wanneer);
  return d && Number.isFinite(d.getTime()) ? d : klok.datum();
}

/* DE ZONE VAN HET HUIS: een lid heeft geen eigen zone in zijn profiel, dus
   Amsterdam. Wie een andere zone kent, geeft hem mee. */
const HUIS_ZONE = 'Europe/Amsterdam';
const zoneOf = zone => (zone || HUIS_ZONE);

const huis = (wanneer, zone) => lokaal(zoneOf(zone), wanneer);
const uurIn = (wanneer, zone) => huis(wanneer, zone).uur;
const weekdagIn = (wanneer, zone) => huis(wanneer, zone).dag;
const datumIn = (wanneer, zone) => huis(wanneer, zone).datum;
const jaarIn = (wanneer, zone) => huis(wanneer, zone).jaar;
const maandIn = (wanneer, zone) => huis(wanneer, zone).maand;
const hhmmIn = (wanneer, zone) => huis(wanneer, zone).hhmm;
// de dag van een OPGESLAGEN tijdstip; leeg of rommel is null, nooit vandaag
const datumVan = (t, zone) => {
  const d = t == null || t === '' ? null : new Date(t);
  return d && Number.isFinite(d.getTime()) ? huis(d, zone).datum : null;
};

// de zone van een zaak, en zonder eigen zone of bekend land het huis (niet UTC)
function zaakZoneOfHuis(s) {
  const z = zaakZone(s);
  return z.bron === 'terugval' ? HUIS_ZONE : z.zone;
}

// rekenen op de kalender zelf ('YYYY-MM-DD'): een dag is niet altijd 24 uur
const kalender = (datum, plus) => {
  const [j, m, d] = String(datum).slice(0, 10).split('-').map(Number);
  return Date.UTC(j, m - 1, d + (plus || 0));
};
const plusDagen = (datum, n) => new Date(kalender(datum, n)).toISOString().slice(0, 10);
const weekdagVan = datum => new Date(kalender(datum)).getUTCDay();

/* Het moment van `datum` + `minuten` in `zone` (wat new Date(j, m, d, u, mi)
   deed). Twee rondes voor de zomertijd; 02:30 in maart wordt 03:30. */
function moment(datum, minuten, zone) {
  return new Date(require('./tijdzone-instant').uitLokaleMinuten(
    kalender(datum) + (Number(minuten) || 0) * 60000, zoneOf(zone)));
}

const middernacht = (datum, zone) => moment(datum, 0, zone);

/* DE OMZETDAG van een zaak loopt tot 05:00 lokaal (eigenaarsbesluit 19 oktober
   2026, HORECA.md): een kasopmaak om 00:30 telt de hele avond. */
const OMZETDAG_GRENS = 5 * 60;
function omzetdag(s, wanneer) { // zonder moment: nu
  const h = huis(wanneer, zaakZoneOfHuis(s));
  return h.minuten < OMZETDAG_GRENS ? plusDagen(h.datum, -1) : h.datum;
}
const omzetdagVan = (s, t) => (datumVan(t) ? omzetdag(s, t) : null); // leeg: null

/* EEN antwoord op "in welke zone staat deze zaak", voor het hele huis.

   De Mall, de vakwerk-agenda en de Food Court stellen alle drie dezelfde vraag,
   en het zou een stille ramp zijn als ze er verschillend op antwoorden: dan
   biedt de Mall een tijdvak aan dat het boekscherm niet kent. Vandaar een
   gedeelde functie in plaats van drie keer `zoneVan(s, ergensLand)`.

   De landbepaling komt uit de Reiswijzer (kern/reis.js), die van een plaats
   weet in welk land hij ligt. Die tabel wordt later in de opbouw gemaakt dan de
   modules die hem hier nodig hebben, dus hij wordt bij het opstarten EEN keer
   geregistreerd -- dezelfde overlay-gedachte als waarmee de reisrijen op de
   LANDEN-tabel worden gezet. Is hij er niet, dan valt de zone terug op het
   land van de zaak en anders op UTC; `aangenomen` zegt dat dan ook. */
let landVindReg = null;
function zetLandVind(fn) { landVindReg = (typeof fn === 'function') ? fn : null; }
const landVindAan = () => !!landVindReg;

function zaakZone(s) {
  if (!s) return { zone: TERUGVAL, bron: 'terugval', aangenomen: true };
  const eigen = s.tijdzone;
  if (geldigeZone(eigen)) return { zone: eigen, bron: 'zaak', aangenomen: false };
  let land = s.country || null;
  if (!land && landVindReg && s.city) { try { land = landVindReg(s.city); } catch (e) { land = null; } }
  return zoneVan({ country: land }, land);
}
// hoe laat het is BIJ DE ZAAK; de vorm die de bellers werkelijk gebruiken
const nuBijZaak = (s, wanneer) => lokaal(zaakZone(s).zone, wanneer);

// een lokale dag en een uur als tijdstip in een zone: ./tijdzone-instant.js
const instantIn = (...a) => require('./tijdzone-instant')(...a);

module.exports = { LAND_ZONE, TERUGVAL, geldigeZone, zoneVan, lokaal, zetLandVind, landVindAan, zaakZone, nuBijZaak, instantIn,
  HUIS_ZONE, huis, uurIn, weekdagIn, datumIn, datumVan, jaarIn, maandIn, hhmmIn, plusDagen, weekdagVan, middernacht, moment, zaakZoneOfHuis, OMZETDAG_GRENS, omzetdag, omzetdagVan };
