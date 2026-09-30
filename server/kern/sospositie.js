/* EEN SOS-POSITIE HOORT BIJ DE MELDING (NAVIGATIE.md N18).

   Vijf domeinen schrijven een positie bij een noodmelding: de huurauto, de
   charter, de date, het alarm van de veiligheidskring en het incident van een
   bewaker. Tot 29 september 2026 bleef die positie in alle vijf staan zolang de
   melding bestond, en dat was zonder einde. Het besluit is een regel en geen
   vijf regels, en daarom staat hij hier en niet vijf keer:

     - zolang de melding OPEN is, blijft de positie -- daar is hij voor;
     - na het sluiten nog 90 DAGEN (een klacht, de verzekeraar, de politie);
     - een PROEF, of een melding die de melder zelf binnen EEN MINUUT intrekt,
       verliest zijn positie meteen bij het sluiten: daar is niets om later op
       terug te komen.

   Wat deze module NIET doet: weten waar een melding woont, wanneer hij dicht is
   of wie hem sloot. Dat weet het domein; het geeft die antwoorden mee. Zo blijft
   de regel op een plek zonder dat hij vijf datavormen hoeft te kennen, en zonder
   dat de bewaarveger een domein hoeft te laden (NAVIGATIE.md N14: die koppeling
   was een keer een onverklaarde verstrengeling).

   Wissen is op null zetten en niet het veld weghalen: de lezers vragen al
   `!= null` of `Number.isFinite`, en een melding blijft een melding -- alleen de
   plek gaat eraf. `positieGewist` legt vast DAT hij weg is en wanneer, zodat een
   lege plek niet leest als een melding die nooit een plek had. */
'use strict';

const DAG = 86400000;
const BEWAAR_MS = 90 * DAG;
const INTREK_MS = 60 * 1000;

const ms = (v) => (typeof v === 'number' ? v : Date.parse(v || '')) || 0;

function heeftPositie(rec, velden) {
  return !!rec && velden.some(v => rec[v] != null);
}

/* Moet de positie METEEN bij het sluiten weg? Een proef altijd; een echte
   melding alleen als de MELDER hem zelf binnen een minuut introk. Wie een
   ander zijn melding afhandelt, trekt niets in -- die positie kan nog nodig
   zijn, en dan geldt de termijn. */
function directWeg({ at, dicht, proef, doorMelder }) {
  if (proef) return true;
  const a = ms(at), d = ms(dicht);
  return !!(doorMelder && a && d && d - a <= INTREK_MS);
}

// Is de bewaartermijn na het sluiten voorbij? Een open melding (geen dicht) nooit.
function verlopen(dicht, t) {
  const d = ms(dicht);
  return !!d && (t == null ? Date.now() : t) - d > BEWAAR_MS;
}

function wis(rec, velden, t) {
  if (!heeftPositie(rec, velden)) return false;
  for (const v of velden) if (rec[v] != null) rec[v] = null;
  rec.positieGewist = new Date(t == null ? Date.now() : t).toISOString();
  return true;
}

/* De regel over een lijst meldingen. `dicht(rec)` geeft het sluitmoment of
   niets (dan is hij open en blijft alles staan); `direct(rec)` zegt of dit een
   proef of snelle intrekking was -- als vangnet voor een sluiting die het
   domein niet zelf afving. Geeft het aantal gewiste posities terug. */
function veeg(lijst, { velden, dicht, direct, nu }) {
  const t = nu == null ? Date.now() : ms(nu);
  let n = 0;
  for (const rec of lijst || []) {
    if (!heeftPositie(rec, velden)) continue;
    const d = dicht(rec);
    if (!d) continue;
    if (verlopen(d, t) || (direct && direct(rec))) { wis(rec, velden, t); n++; }
  }
  return n;
}

module.exports = { BEWAAR_MS, INTREK_MS, directWeg, verlopen, wis, veeg, heeftPositie };
