/* Genootschap (deelmodule van ./bijeenkomst.js): het VENSTER dat een lid zelf
   opgeeft rond een bijeenkomst. Romeproef schakel 7.

   Een antwoord is ja/misschien/nee op EEN datum, maar "ik kan drie dagen in die
   week" is een ander soort antwoord. Daarom staat naast `antwoorden` een eigen
   bak op de bijeenkomst: `vensters[key]` = de dagen die het lid ZELF noemt,
   binnen een week voor of na de voorgestelde datum. Drie grenzen (LIFE.md par.
   4.3):
   - alleen wat iemand zelf opgaf: niets wordt afgeleid uit zijn agenda, zijn
     rooster of zijn werkgever -- dit bestand kent geen andere bron dan het
     verzoek van het lid;
   - wisbaar door hem: een lege lijst haalt zijn venster weg, en alleen het
     zijne -- de sleutel komt uit de sessie;
   - een venster is geen antwoord: het verandert `antwoorden` niet en telt dus
     niet als ja. Wie kan, zegt dat zelf.
   De groep ziet per dag HOEVEEL leden kunnen (de overlap) en niet wie: dat is
   wat een organisator nodig heeft om een dag te kiezen.

   Apart van ./bijeenkomst.js omdat dat bestand anders over de 10 kB ging; de
   bijeenkomst geeft zijn poort, opzoeker en weergave mee, zodat er geen tweede
   manier ontstaat om een bijeenkomst te vinden of te tonen. */
'use strict';

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const VENSTER_DAGEN = 7, VENSTER_MAX = 15, DAG_MS = 86400000;
const alsDag = (d) => { const t = Date.parse(d + 'T00:00:00Z'); return Number.isFinite(t) ? t : null; };

/* De overlap: per dag hoeveel leden hem zelf noemden. Aantallen, geen namen. */
function vensterTelling(b) {
  const v = (b && b.vensters) || {};
  const perDag = {};
  for (const k of Object.keys(v)) for (const d of (v[k] || [])) perDag[d] = (perDag[d] || 0) + 1;
  return {
    opgegeven: Object.keys(v).length,
    perDag: Object.keys(perDag).sort().map(dag => ({ dag, aantal: perDag[dag] }))
  };
}

function maakVenster({ save, poort, kijkVan, publiek }) {
  function zetVenster(sess, groepId, id, dagen) {
    const p = poort(sess, groepId);
    if (p.error) return p;
    const b = kijkVan(groepId).find(x => String(x.id) === String(id));
    if (!b) return { error: 'Deze bijeenkomst bestaat niet.' };
    if (b.afgelast) return { error: 'Deze bijeenkomst is afgelast.' };
    if (!Array.isArray(dagen)) return { error: 'Geef de dagen waarop je kunt als lijst, zoals ["2026-11-17", "2026-11-18"].' };
    const uniek = [...new Set(dagen.map(d => String(d || '').trim()))];
    if (uniek.length > VENSTER_MAX) return { error: 'Noem hooguit ' + VENSTER_MAX + ' dagen.' };
    const basis = alsDag(b.datum);
    for (const d of uniek) {
      const t = DATUM.test(d) ? alsDag(d) : null;
      if (t == null) return { error: 'Geef een dag als 2026-08-14.' };
      if (basis != null && Math.abs(t - basis) > VENSTER_DAGEN * DAG_MS)
        return { error: 'Noem dagen binnen een week voor of na ' + b.datum + '.' };
    }
    if (!b.vensters || typeof b.vensters !== 'object') b.vensters = {};
    if (uniek.length) b.vensters[sess.key] = uniek.sort();
    else delete b.vensters[sess.key];
    save();
    return { ok: true, bijeenkomst: publiek(b, sess) };
  }
  return { zetVenster };
}

module.exports = { maakVenster, vensterTelling };
