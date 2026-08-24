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

/* Bestaat deze zonenaam echt? Intl weigert een onbekende zone met een
   RangeError -- maar dat uitproberen betekent een formatter MAKEN, en dat is het
   dure deel. De uitslag wordt daarom onthouden: een zonenaam is onveranderlijk,
   dus een antwoord van net is nog steeds waar. Zonder deze kaart kostte de
   zakenklok 2567 ms per 20.000 lezingen in plaats van 290 -- negen keer, en
   volledig aan het opnieuw stellen van dezelfde vraag. */
const GEKEURD = new Map();
function geldigeZone(naam) {
  if (!naam || typeof naam !== 'string') return false;
  const bekend = GEKEURD.get(naam);
  if (bekend !== undefined) return bekend;
  let goed;
  try { new Intl.DateTimeFormat('en-CA', { timeZone: naam }); goed = true; }
  catch (e) { goed = false; }
  GEKEURD.set(naam, goed);
  return goed;
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
/* De formatters worden BEWAARD per zone. Er een maken kost ordes van grootte
   meer dan hem gebruiken, en sinds de zakenklok loopt het dagrapport van een
   zaak hier per bon langs -- dan is een formatter per bon het verschil tussen
   een rapport en een wachttijd. De sleutelruimte is de zonelijst hierboven plus
   wat zaken zelf instellen, dus deze kaart groeit niet onbeperkt. */
const FORMATTERS = new Map();
function formatterVoor(z) {
  let f = FORMATTERS.get(z);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: z, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    FORMATTERS.set(z, f);
  }
  return f;
}

function lokaal(zone, wanneer) {
  const d = wanneer instanceof Date ? wanneer : new Date();
  const z = geldigeZone(zone) ? zone : TERUGVAL;
  const delen = formatterVoor(z).formatToParts(d);
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

module.exports = { LAND_ZONE, TERUGVAL, geldigeZone, zoneVan, lokaal, zetLandVind, landVindAan, zaakZone, nuBijZaak };
