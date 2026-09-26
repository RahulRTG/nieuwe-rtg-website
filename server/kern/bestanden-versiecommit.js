/* The scanner may yield. Commit against the current owner, access and version under the DB lock. */
'use strict';
const { versie, fout } = require('./document-contracten');
module.exports = basis => async function versieCommit({ key, eigenaar, id, verwacht, buf, mime }) {
  const { bewerkCollectie, codenaamVan, schrijfBytes, wisBytes, nu, MAX_VERSIES, QUOTUM } = basis;
  if (!bewerkCollectie) return fout(503, 'storage_unavailable', 'De opslag is nu niet beschikbaar.');
  const code = codenaamVan(key);
  let opruimen = [];
  try {
    const r = await bewerkCollectie('bestanden', alle => {
      const b = alle['lid:' + eigenaar], it = b && b.items.find(x => x.id === id);
      if (!it || (key !== eigenaar && (it.weg || !(it.gedeeldMet || []).includes(code))))
        return fout(404, 'not_found', 'Dat bestand is niet voor u beschikbaar.');
      if (it.weg || versie(it) !== verwacht)
        return fout(409, 'version_conflict', 'Dit bestand is intussen veranderd. Open de actuele versie opnieuw.');
      const gebruik = b.items.reduce((n, x) => n + (x.bytes || 0) + (x.versies || []).reduce((t, v) => t + (v.bytes || 0), 0), 0);
      if (gebruik + buf.length > QUOTUM) return { status: 413, error: 'De kluis van de eigenaar is vol.' };
      const ref = schrijfBytes(buf);
      it.versies = it.versies || [];
      it.versies.unshift({ ref: it.ref, bytes: it.bytes, op: it.gewijzigd || it.op, door: it.door || null });
      opruimen = it.versies.splice(MAX_VERSIES).map(v => v.ref);
      it.ref = ref; it.bytes = buf.length; it.mime = mime; it.gewijzigd = nu();
      it.door = key === eigenaar ? null : code;
      return { id: it.id, versies: it.versies.length };
    });
    if (!r.error) for (const ref of opruimen) wisBytes(ref);
    return r;
  } catch (e) {
    // An uncertain metadata commit may reference the prepared blob. Never delete it on an ambiguous outcome.
    return fout(503, 'outcome_unknown', 'De nieuwe versie is niet bevestigd. Controleer de actuele documentversies.');
  }
};
