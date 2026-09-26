/* Legacy metadata edits must not overwrite a lifecycle change while waiting for storage. */
'use strict';
const { versie, fout } = require('./document-contracten');
module.exports = ({ bord, bewerkCollectie, schoonNaam, nu }) => async function wijzig(key, bid, wat) {
  const before = bord(key).items.find(x => x.id === String(bid || ''));
  if (!before) return fout(404, 'not_found', 'Dat bestand staat niet in uw kluis.');
  const expected = wat.expectedVersion || versie(before);
  try {
    return await bewerkCollectie('bestanden', all => {
      const board = all['lid:' + key], item = board && board.items.find(x => x.id === bid);
      if (!item) return fout(404, 'not_found', 'Dat bestand staat niet in uw kluis.');
      if (item.weg || versie(item) !== expected)
        return fout(409, 'version_conflict', 'Dit bestand is intussen veranderd. Open de actuele versie opnieuw.');
      if (wat.naam !== undefined) {
        const name = schoonNaam(wat.naam);
        if (!name) return fout(400, 'invalid_input', 'Geef het bestand een naam.');
        item.naam = name;
      }
      if (wat.map !== undefined) {
        const target = String(wat.map || '') || null;
        item.map = target && board.mappen.find(x => x.id === target) ? target : null;
      }
      if (wat.ster !== undefined) item.ster = !!wat.ster;
      item.gewijzigd = nu();
      return { ok: true };
    });
  } catch (e) { return fout(503, 'outcome_unknown', 'De wijziging is niet bevestigd. Controleer het bestand opnieuw.'); }
};
