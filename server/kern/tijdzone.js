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

/* EEN FORMATTER PER ZONE, NIET PER VRAAG. `new Intl.DateTimeFormat` laadt
   ICU-gegevens en is met tientallen microseconden de duurste regel van dit
   bestand; hij werd twee keer per vraag gemaakt (een om de zone te keuren en
   een om te formatteren), en de Mall stelt de vraag per zaak per verzoek. In
   De Beproeving van 18 oktober 2026 was dat 0,9 s op de lus per minuut storm.
   Een formatter is onveranderlijk en geeft voor dezelfde zone altijd dezelfde
   delen, dus hij wordt een keer gemaakt en onthouden. De zonenaam komt uit de
   instelling van een zaak, dus de kaarten zijn begrensd: geldige zones zijn er
   een paar honderd, en de uitslag voor een ONGELDIGE naam wordt alleen bewaard
   zolang de kaart klein blijft. */
const ZONE_UITSLAG = new Map();   // zonenaam -> bestaat hij (true/false)
const ZONE_FORMATTER = new Map(); // zonenaam -> de formatter van lokaal()
const KAART_MAX = 2048;

// bestaat deze zonenaam echt? Intl weigert een onbekende zone met een RangeError
function geldigeZone(naam) {
  if (!naam || typeof naam !== 'string') return false;
  let uitslag = ZONE_UITSLAG.get(naam);
  if (uitslag === undefined) {
    try { new Intl.DateTimeFormat('en-CA', { timeZone: naam }); uitslag = true; }
    catch (e) { uitslag = false; }
    if (ZONE_UITSLAG.size < KAART_MAX) ZONE_UITSLAG.set(naam, uitslag);
  }
  return uitslag;
}
function formatterVoor(zone) {
  let f = ZONE_FORMATTER.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    if (ZONE_FORMATTER.size < KAART_MAX) ZONE_FORMATTER.set(zone, f);
  }
  return f;
}

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

const DAGEN = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/* Hoe laat is het in deze zone: de kalenderdatum, de weekdag (0 = zondag,
   zoals Date#getDay) en het aantal minuten sinds middernacht. Alle drie in de
   zone zelf, want een zaak die om 23:00 lokaal nog open is, is dat op een
   andere kalenderdag dan de server denkt. */
function lokaal(zone, wanneer) {
  const d = alsDatum(wanneer);
  const z = geldigeZone(zone) ? zone : TERUGVAL;
  const delen = formatterVoor(z).formatToParts(d);
  const op = {};
  for (const p of delen) op[p.type] = p.value;
  const uur = Number(op.hour) === 24 ? 0 : Number(op.hour); // sommige ICU's geven 24:00
  return {
    zone: z,
    datum: op.year + '-' + op.month + '-' + op.day,
    dag: DAGEN[op.weekday] != null ? DAGEN[op.weekday] : d.getUTCDay(),
    minuten: uur * 60 + Number(op.minute),
    jaar: Number(op.year), maand: Number(op.month), dagVanMaand: Number(op.day),
    uur, minuut: Number(op.minute),
    hhmm: String(uur).padStart(2, '0') + ':' + op.minute
  };
}

// een Date, ms of ISO-tekst; anders NU, van lib/klok (dus ook RTG_KLOK)
function alsDatum(wanneer) {
  const d = wanneer instanceof Date || wanneer == null ? wanneer : new Date(wanneer);
  return d && Number.isFinite(d.getTime()) ? d : klok.datum();
}

/* DE ZONE VAN HET HUIS. In de UTC-container lezen `getHours()` en zijn broers
   UTC. Een lid heeft geen eigen tijdzone in zijn profiel; zonder zaak met een
   eigen zone is dat Amsterdam. Wie een andere zone kent, geeft hem mee. */
const HUIS_ZONE = 'Europe/Amsterdam';
const zoneOf = zone => (zone || HUIS_ZONE);

// het hele lokaal()-antwoord in het huis (of `zone`), en de losse delen
const huis = (wanneer, zone) => lokaal(zoneOf(zone), wanneer);
const uurIn = (wanneer, zone) => huis(wanneer, zone).uur;
const weekdagIn = (wanneer, zone) => huis(wanneer, zone).dag;
const datumIn = (wanneer, zone) => huis(wanneer, zone).datum;
const jaarIn = (wanneer, zone) => huis(wanneer, zone).jaar;
const maandIn = (wanneer, zone) => huis(wanneer, zone).maand;
const hhmmIn = (wanneer, zone) => huis(wanneer, zone).hhmm;

/* De zone van een zaak, en zonder eigen zone of bekend land het huis: voor
   een rooster of kassa in Nederland is UTC een uur ernaast. */
function zaakZoneOfHuis(s) {
  const z = zaakZone(s);
  return z.bron === 'terugval' ? HUIS_ZONE : z.zone;
}

/* Kalenderrekenen op 'YYYY-MM-DD', in UTC op de kalender zelf: een dag is
   door de zomertijd niet altijd 24 uur. */
const kalender = (datum, plus) => {
  const [j, m, d] = String(datum).slice(0, 10).split('-').map(Number);
  return Date.UTC(j, m - 1, d + (plus || 0));
};
const plusDagen = (datum, n) => new Date(kalender(datum, n)).toISOString().slice(0, 10);
const weekdagVan = datum => new Date(kalender(datum)).getUTCDay();

/* Het moment waarop het in `zone` `datum` is, `minuten` na middernacht: wat
   `new Date(j, m, d, u, mi)` deed, maar in de zone van het lid. Twee rondes
   voor de zomertijd; 02:30 op de voorjaarsdag wordt 03:30, zoals de wandklok. */
function moment(datum, minuten, zone) {
  const z = zoneOf(zone);
  const wens = kalender(datum) + (Number(minuten) || 0) * 60000;
  let t = wens;
  for (let i = 0; i < 2; i++) {
    const l = lokaal(z, new Date(t));
    t += wens - (kalender(l.datum) + l.minuten * 60000);
  }
  return new Date(t);
}
const middernacht = (datum, zone) => moment(datum, 0, zone);

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
  HUIS_ZONE, huis, uurIn, weekdagIn, datumIn, jaarIn, maandIn, hhmmIn, plusDagen, weekdagVan, middernacht, moment, zaakZoneOfHuis };
