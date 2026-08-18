/* SLUITDAGEN VOOR ACTIVITEITEN -- REIZEN.md fase 4: een kleine ondernemer kan
   op zijn telefoon een dag sluiten, en vanaf dat moment is er op die dag niets
   meer te boeken.

   WAAROM DIT EEN EIGEN BESTANDJE IS. De vraag "is deze dag dicht?" wordt op
   twee plekken gesteld: bij het KOPEN (kern/lidacties.js weigert de boeking)
   en in het AANBOD (het lid ziet de dag als gesloten voordat hij het probeert).
   Twee eigen kopieen van die regel lopen uiteen zonder dat iets klaagt
   (LAT-regel 4), dus staat hij hier een keer.

   WAT SLUITEN BEWUST NIET DOET: bestaande boekingen aanraken. Op een gesloten
   dag kunnen al betaalde gasten staan, en die stil annuleren zou geld van
   mensen afpakken zonder dat iemand erop drukte. Sluiten blokkeert NIEUWE
   boekingen; het antwoord zegt erbij hoeveel boekingen er al staan, zodat de
   zaak weet dat daar nog werk ligt -- afbellen of gewoon door laten gaan is
   een besluit van een mens (dezelfde lijn als overal: samenstellen en
   klaarzetten, bevestigen doet de mens).

   De lijst leeft op de zaak zelf (s.activiteitenDicht), net als de
   activiteiten: een sluitdag is aanbodsbeheer, geen aparte administratie. */
'use strict';

const MAX = 200;
const isDatum = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

function lijst(s) {
  if (!Array.isArray(s.activiteitenDicht)) s.activiteitenDicht = [];
  return s.activiteitenDicht;
}

/* Is deze dag dicht voor deze activiteit? Een regel zonder activiteitId sluit
   de hele zaak die dag; een regel met id alleen die activiteit. */
function dichtOp(s, datum, activiteitId) {
  return lijst(s).find(r => r.datum === datum && (!r.activiteitId || r.activiteitId === String(activiteitId || ''))) || null;
}

/* Sluiten. Idempotent: dezelfde dag nog eens sluiten verandert niets. Geeft
   terug hoeveel boekingen er al op die dag staan (zie de kop). */
function sluit(s, { datum, activiteitId, reden }, boekingenOpDag) {
  if (!isDatum(datum)) return { status: 400, error: 'Geef een dag op (jjjj-mm-dd).' };
  const rij = lijst(s);
  const actId = String(activiteitId || '') || null;
  if (actId && !(s.activiteiten || []).some(a => a.id === actId))
    return { status: 404, error: 'Deze activiteit bestaat niet (meer).' };
  if (rij.length >= MAX) return { status: 400, error: 'Er staan al ' + MAX + ' sluitdagen; ruim eerst oude op.' };
  if (!rij.some(r => r.datum === datum && (r.activiteitId || null) === actId)) {
    rij.push({ datum, activiteitId: actId,
      reden: String(reden || '').replace(/[<>]/g, '').trim().slice(0, 120) || null,
      at: new Date().toISOString() });
  }
  const bestaand = (boekingenOpDag || []).length;
  return { ok: true, dicht: rij,
    bestaandeBoekingen: bestaand,
    opmerking: bestaand
      ? 'Let op: er ' + (bestaand === 1 ? 'staat al 1 boeking' : 'staan al ' + bestaand + ' boekingen') +
        ' op deze dag. Die blijven staan; neem zelf contact op met deze gasten.'
      : null };
}

function open(s, { datum, activiteitId }) {
  if (!isDatum(datum)) return { status: 400, error: 'Geef een dag op (jjjj-mm-dd).' };
  const actId = String(activiteitId || '') || null;
  const rij = lijst(s);
  const voor = rij.length;
  s.activiteitenDicht = rij.filter(r => !(r.datum === datum && (r.activiteitId || null) === actId));
  if (s.activiteitenDicht.length === voor) return { status: 404, error: 'Deze dag stond niet dicht.' };
  return { ok: true, dicht: s.activiteitenDicht };
}

module.exports = { dichtOp, sluit, open, lijst };
