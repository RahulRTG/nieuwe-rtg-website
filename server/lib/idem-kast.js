/* ============================================================================
   DE BEWAARKAST VAN DE IDEM-POORT -- wat er onthouden wordt, en hoe lang.

   WAAROM DIT EEN EIGEN BESTAND IS. ./idem-poort.js deed twee dingen tegelijk:
   hij besliste of een binnenkomend verzoek een herhaling was (http), en hij
   HIELD DE ANTWOORDEN VAST (een ring met een vervaltijd). Dat tweede is een
   gegevensstructuur zonder een enkel begrip uit het web erin -- geen verzoek,
   geen antwoord, geen kop. Zo'n stuk hoort apart te kunnen staan, en dan kun je
   het ook los beproeven zonder een server te bouwen.

   DRIE REGELS DIE HIER WONEN EN NERGENS ANDERS:

   1. ALLEEN EEN GESLAAGD ANTWOORD GAAT ERIN. Een 4xx of 5xx heeft niets
      veranderd, dus een herhaling hoort het gewoon opnieuw te proberen. En een
      200 met `ok:false` telt hier als MISLUKKING: dat is de vorm waarmee de
      kern zegt "het ging niet door". Zou je die bewaren, dan krijgt iemand een
      dag lang dezelfde weigering terug op een verzoek dat inmiddels zou
      slagen.

   2. HET IS EEN RING EN GEEN ARCHIEF. Boven `max` sleutels valt de oudste
      eruit. Een Map bewaart invoegvolgorde, dus de oudste staat vooraan; dat
      is de hele implementatie van "oudste eruit".

   3. SNOEIEN GEBEURT NA HET OPSLAAN. Doe je het alleen bij binnenkomst, dan
      staat de kast tussen twee verzoeken door altijd EEN over zijn grens, en
      op een stille server blijft hij daar staan. Zo gevonden, door de toets op
      de omvang.
   ========================================================================== */
'use strict';

const crypto = require('crypto');
const klok = require('./klok');

const MAX = 20000;                   // ring: zoveel sleutels houden we vast
const TTL_MS = 24 * 60 * 60 * 1000;  // een dag, zoals de gangbare betaalrails

/* De velden die NIET meetellen in de afdruk van het verzoek. De sleutel zelf is
   geen inhoud, en vrije tekst maakt van twee gelijke handelingen twee
   verschillende -- dan botst een dubbeltik op een 409 in plaats van dat hij
   wordt opgevangen. */
const BUITEN_AFDRUK = new Set(['idem', 'idempotentieSleutel', 'notitie', 'omschrijving', 'oms', 'toelichting']);

/* De afdruk van een verzoek: waaraan zie je dat twee oproepen dezelfde opdracht
   dragen. Sleutels alfabetisch, zodat de volgorde van de velden er niet toe
   doet. Een lijf dat niet te serialiseren is (cyclisch) levert een lege afdruk
   op -- dan is er geen binding en dus ook geen 409, en dat is beter dan een
   uitzondering in een laag die alleen maar hoort te helpen. */
function afdrukVan(body) {
  if (!body || typeof body !== 'object') return '';
  const uit = {};
  for (const k of Object.keys(body).sort()) {
    if (BUITEN_AFDRUK.has(k)) continue;
    uit[k] = body[k];
  }
  try { return crypto.createHash('sha256').update(JSON.stringify(uit)).digest('hex'); }
  catch (e) { return ''; }
}

/* Regel 1 uit de kop, en de enige plek waar hij staat. */
function magBewaren(status, lijf) {
  if (!(status >= 200 && status < 300)) return false;
  if (lijf && typeof lijf === 'object' && lijf.ok === false) return false;
  return true;
}

/* De kast. `nu` is injecteerbaar zodat een verlooptoets niet hoeft te wachten;
   standaard is het de huisklok en niet Date.now(). */
function maakKast(opties) {
  const nu = (opties && opties.nu) || klok.nu;
  const max = (opties && opties.max) || MAX;

  const bewaard = new Map();  // opslagsleutel -> { status, lijf, afdruk, tot }

  function opruimen() {
    const t = nu();
    for (const [k, v] of bewaard) if (v.tot <= t) bewaard.delete(k);
    while (bewaard.size > max) bewaard.delete(bewaard.keys().next().value);
  }

  function haal(id) {
    opruimen();
    return bewaard.get(id) || null;
  }

  /* Geeft terug OF er iets is bewaard. False betekent: de volgende poging mag
     het werk echt opnieuw doen. */
  function zet(id, { status, lijf, afdruk }, vensterMs) {
    if (!magBewaren(status, lijf)) return false;
    bewaard.set(id, { status, lijf, afdruk, tot: nu() + vensterMs });
    opruimen();   // regel 3: NA het opslaan
    return true;
  }

  return { haal, zet, opruimen, omvang: () => bewaard.size, magBewaren };
}

module.exports = { maakKast, afdrukVan, magBewaren, MAX, TTL_MS, BUITEN_AFDRUK };
