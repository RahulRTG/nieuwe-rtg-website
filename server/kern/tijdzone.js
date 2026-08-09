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

// bestaat deze zonenaam echt? Intl weigert een onbekende zone met een RangeError
function geldigeZone(naam) {
  if (!naam || typeof naam !== 'string') return false;
  try { new Intl.DateTimeFormat('en-CA', { timeZone: naam }); return true; }
  catch (e) { return false; }
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
  const d = wanneer instanceof Date ? wanneer : new Date();
  const z = geldigeZone(zone) ? zone : TERUGVAL;
  const delen = new Intl.DateTimeFormat('en-CA', {
    timeZone: z, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(d);
  const op = {};
  for (const p of delen) op[p.type] = p.value;
  const uur = Number(op.hour) === 24 ? 0 : Number(op.hour); // sommige ICU's geven 24:00
  return {
    zone: z,
    datum: op.year + '-' + op.month + '-' + op.day,
    dag: DAGEN[op.weekday] != null ? DAGEN[op.weekday] : d.getUTCDay(),
    minuten: uur * 60 + Number(op.minute)
  };
}

module.exports = { LAND_ZONE, TERUGVAL, geldigeZone, zoneVan, lokaal };
