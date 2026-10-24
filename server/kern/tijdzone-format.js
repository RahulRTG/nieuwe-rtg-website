/* ICU-omzetting en begrensde memoïsering. Domeinbeleid (zaak, land,
   terugval en huis-klok) blijft in tijdzone.js. De cache geldt uitsluitend
   voor exact dezelfde zone en milliseconde: geen afronding rond DST of
   historische offsets. Elke lezer krijgt een eigen bewerkbaar antwoord. */
'use strict';

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

const DAGEN = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const MOMENTEN = new Map();
const MOMENT_MAX = 256;
function formatteerLokaal(z, d) {
  const sleutel = z + '\0' + d.getTime();
  const eerder = MOMENTEN.get(sleutel);
  if (eerder) return { ...eerder };
  const delen = formatterVoor(z).formatToParts(d);
  const op = {};
  for (const p of delen) op[p.type] = p.value;
  const uur = Number(op.hour) === 24 ? 0 : Number(op.hour); // sommige ICU's geven 24:00
  const uit = {
    zone: z,
    datum: op.year + '-' + op.month + '-' + op.day,
    dag: DAGEN[op.weekday] != null ? DAGEN[op.weekday] : d.getUTCDay(),
    minuten: uur * 60 + Number(op.minute),
    jaar: Number(op.year), maand: Number(op.month), dagVanMaand: Number(op.day),
    uur, minuut: Number(op.minute),
    hhmm: String(uur).padStart(2, '0') + ':' + op.minute
  };
  if (MOMENTEN.size >= MOMENT_MAX) MOMENTEN.delete(MOMENTEN.keys().next().value);
  MOMENTEN.set(sleutel, Object.freeze(uit));
  return { ...uit };
}

module.exports = { geldigeZone, formatteerLokaal };
