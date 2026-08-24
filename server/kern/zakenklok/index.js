/* ============================================================================
   DE ZAKENKLOK -- wanneer begint een dag voor DIT bedrijf?

   WAAROM DIT ER IS. Er staan 195 plekken in de kern die "vandaag" uitrekenen
   als `toISOString().slice(0, 10)`. Dat is de KALENDERdag, en voor bijna elk
   bedrijf is dat het verkeerde antwoord:

     een strandclub sluit om 03:00; de omzet van 01:30 hoort bij gisteravond
     een boekhouding telt per maand, per kwartaal of per vier weken
     een loonronde loopt per maand, per vier weken of per week vanaf een anker
     een school telt per schooldag en per schooljaar, niet per kalenderjaar

   Zolang de kalenderdag de enige eenheid is, staat de dagomzet van elke horeca
   in dit huis verkeerd geteld -- en niet een beetje: alles tussen middernacht en
   sluitingstijd valt op de verkeerde dag.

   WAT DIT WEL EN NIET IS. Dit is GEEN tweede klok. Hoe laat het is blijft de
   vraag van server/lib/klok.js (verzetbaar met RTG_KLOK, en dus toetsbaar). Dit
   beantwoordt de vraag daarna: bij WELKE PERIODE hoort dat moment, gegeven wat
   dit bedrijf daarover heeft ingesteld.

   HET IS EEN REGISTER EN GEEN LIJST VAN VIER. De vier soorten zijn AANGEMELD,
   met dezelfde meld() die iedereen kan gebruiken; een vaarseizoen of een
   ploegendienst komt er zo bij zonder dat hier iets verandert.
   test/zakenklok.test.js meldt een verzonnen soort aan en eist dat de hele keten
   hem kent.

   WIE HET KIEST. RTG stelt iets voor per genre -- een strandclub 05:00, een
   winkel 00:00 -- en de zaak overschrijft dat in zijn eigen instellingen. Nooit
   een leeg veld voordat er iets werkt, en nooit een keuze die RTG maakt en niet
   terugneemt. Een voorstel, geen wet.

   DE TIJDZONE IS GEEN DETAIL. "Vier uur 's nachts" is LOKALE tijd, en twee keer
   per jaar verschuift die. Daarom Intl.DateTimeFormat met een echte zone en geen
   getal aan uren: dat laatste klopt precies tot de eerste zomertijd.
   ========================================================================== */
'use strict';
const klok = require('../../lib/klok');

/* Het register. Een Map en geen object: de volgorde van aanmelden blijft dan
   zichtbaar, en dat is de volgorde waarin ze in een scherm horen te staan. */
const SOORTEN = new Map();

/* Elk veld verplicht, met opzet streng: een half aangemelde soort zou pas
   opvallen als iemand er een periode uit vraagt, en dan staat er een verkeerd
   getal op een scherm in plaats van een fout in de log (LAT-regel 5). */
function meld(soort) {
  const nodig = ['sleutel', 'naam', 'uitleg', 'standaard', 'periodeVan'];
  for (const veld of nodig) {
    if (soort && soort[veld] !== undefined && soort[veld] !== null) continue;
    throw new Error('een klokperiode heeft "' + veld + '" nodig; zonder dat kan hij niet worden gebruikt');
  }
  if (typeof soort.periodeVan !== 'function') throw new Error('periodeVan moet een functie zijn');
  if (SOORTEN.has(soort.sleutel)) throw new Error('de klokperiode "' + soort.sleutel + '" bestaat al');
  SOORTEN.set(soort.sleutel, soort);
  return soort;
}

const soorten = () => [...SOORTEN.values()].map(s => ({
  sleutel: s.sleutel, naam: s.naam, uitleg: s.uitleg, standaard: s.standaard, keuzes: s.keuzes || null
}));
const soortVan = (sleutel) => SOORTEN.get(String(sleutel || '')) || null;

/* De zone komt uit het LAND dat de zaak al heeft (supplierdefaults zet het). Een
   tweede veld "tijdzone" zou dezelfde waarheid op twee plekken zetten
   (LAT-regel 4). Wie echt afwijkt, zet hem in de klokinstelling; die wint. */
const ZONE_PER_LAND = { NL: 'Europe/Amsterdam', BE: 'Europe/Brussels', DE: 'Europe/Berlin',
  ES: 'Europe/Madrid', FR: 'Europe/Paris', PT: 'Europe/Lisbon', IT: 'Europe/Rome', GB: 'Europe/London' };

function zoneVan(zaak, instelling) {
  if (instelling && instelling.tijdzone) return instelling.tijdzone;
  const land = (zaak && zaak.settings && zaak.settings.land) || 'NL';
  return ZONE_PER_LAND[land] || 'Europe/Amsterdam';
}

/* De wandklokdelen van een moment IN een tijdzone. Via Intl, want dat is de
   enige manier die over zomertijd heen klopt: een vaste offset van +1 of +2 uur
   is precies twee dagen per jaar fout, en dat zijn de twee dagen waarop iemand
   het merkt. */
/* Formatters BEWAREN per zone: er een maken kost veel meer dan hem gebruiken en
   het dagrapport loopt over duizenden bonnen. 14,5 us per lezing. */
const FORMATTERS = new Map();
function delenIn(datum, zone) {
  let f = FORMATTERS.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    FORMATTERS.set(zone, f);
  }
  const d = {};
  for (const p of f.formatToParts(datum)) if (p.type !== 'literal') d[p.type] = p.value;
  return { jaar: Number(d.year), maand: Number(d.month), dag: Number(d.day),
    uur: Number(d.hour === '24' ? '0' : d.hour), minuut: Number(d.minute) };
}

/* "04:00" -> 240 minuten. Een onleesbare waarde is GEEN nul: dan zou een tikfout
   in een instelling stilletjes de kalenderdag terugzetten, en dat is precies de
   fout die deze laag moet wegnemen. */
function naarMinuten(tekst, standaard) {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(tekst == null ? '' : tekst).trim());
  if (!m) return standaard;
  return Number(m[1]) * 60 + Number(m[2]);
}

/* n dagen verschoven op de KALENDER en niet op milliseconden: over een
   zomertijdgrens is een dag niet altijd 24 uur. */
function dagPlus(jaar, maand, dag, n) {
  const d = new Date(Date.UTC(jaar, maand - 1, dag));
  d.setUTCDate(d.getUTCDate() + n);
  return { jaar: d.getUTCFullYear(), maand: d.getUTCMonth() + 1, dag: d.getUTCDate() };
}
const isoDag = (j, m, d) => String(j).padStart(4, '0') + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');

/* ---------- de vraag zelf ----------

   instellingVan() geeft wat DEZE zaak heeft gekozen, aangevuld met de standaard
   van de soort. Nooit een lege instelling: een zaak die nooit iets heeft
   ingesteld hoort gewoon een werkend antwoord te krijgen. */
function eigenVan(zaak, sleutel) {
  return (zaak && zaak.settings && zaak.settings.klok && zaak.settings.klok[sleutel]) || {};
}

/* EEN ONLEESBARE INSTELLING WORDT GENEGEERD, NIET GERADEN.

   Een tikfout ("vier uur", "25:00") mag niet stilletjes tot 00:00 leiden: dan
   telt een zaak maandenlang op de kalenderdag zonder dat iemand het merkt, en
   dat is precies de fout die deze laag moest wegnemen (LAT-regel 5). Hij valt
   dus terug op wat er zonder die instelling zou gelden -- alsof hij niet is
   ingevuld -- en keuzeVan() meldt WELK veld werd genegeerd, zodat een scherm het
   kan laten zien in plaats van het te verzwijgen. */
function ongeldigeVelden(soort, eigen) {
  if (typeof soort.keur !== 'function') return [];
  try { return soort.keur(eigen) || []; } catch (e) { return Object.keys(eigen); }
}

function instellingVan(zaak, sleutel) {
  const soort = soortVan(sleutel);
  if (!soort) return null;
  const eigen = Object.assign({}, eigenVan(zaak, sleutel));
  for (const veld of ongeldigeVelden(soort, eigen)) delete eigen[veld];
  const perGenre = (typeof soort.standaardVoor === 'function' && zaak) ? (soort.standaardVoor(zaak) || {}) : {};
  return Object.assign({}, soort.standaard, perGenre, eigen);
}

/* Bij welke periode hoort dit moment? `moment` mag weg -- dan is het nu, en dat
   NU komt van server/lib/klok.js zodat deze laag met RTG_KLOK te beproeven is.
   Een onbekende soort geeft null en geen gok. */
function periode(zaak, sleutel, moment) {
  const soort = soortVan(sleutel);
  if (!soort) return null;
  const instelling = instellingVan(zaak, sleutel);
  const datum = moment ? new Date(moment) : klok.datum();
  if (isNaN(datum.getTime())) return null;
  const zone = zoneVan(zaak, instelling);
  const uit = soort.periodeVan(datum, instelling, { zone, delenIn, naarMinuten, dagPlus, isoDag });
  return uit ? Object.assign({ soort: sleutel, tijdzone: zone }, uit) : null;
}

/* Wat een zaak zelf heeft ingesteld, en wat de standaard zou zijn. Voor een
   scherm dat de keuze toont: daar hoort te staan of iets een KEUZE is of een
   voorstel van RTG, want dat verschil bepaalt of iemand hem durft aan te raken. */
function keuzeVan(zaak, sleutel) {
  const soort = soortVan(sleutel);
  if (!soort) return null;
  const eigen = eigenVan(zaak, sleutel);
  const heeft = Object.keys(eigen).length > 0;
  const zonder = Object.assign({}, zaak, { settings: Object.assign({}, zaak && zaak.settings, { klok: {} }) });
  return { soort: sleutel, naam: soort.naam, uitleg: soort.uitleg,
    ingesteld: heeft ? Object.assign({}, eigen) : null,
    ongeldig: ongeldigeVelden(soort, eigen),
    standaard: instellingVan(zonder, sleutel),
    geldt: instellingVan(zaak, sleutel),
    eigenKeuze: heeft, keuzes: soort.keuzes || null };
}

module.exports = { meld, soorten, soortVan, instellingVan, periode, keuzeVan,
  // gereedschap dat de soorten en de toetsen delen
  _hulp: { delenIn, naarMinuten, dagPlus, isoDag, zoneVan, ZONE_PER_LAND } };

/* De vier soorten die er vandaag zijn. Ze staan APART en worden hier alleen
   aangemeld -- met dezelfde meld() die een vijfde soort ook gebruikt. Onderaan,
   want ze hebben de module hierboven nodig. */
require('./soorten')(module.exports);
