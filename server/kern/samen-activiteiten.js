/* Activiteiten binnen een al geautoriseerde Samen-kamer. */
'use strict';
const { veiligSamenPad } = require('./samen-pad');

module.exports = ({ schoon, lidVan, publiek, antwoord, seinen, actiefVoor, handel }) => {
  function zet(key, id, pad, titel) {
    return handel(kamers => {
      const k = actiefVoor(kamers, id, key);
      if (!k) return antwoord({ status: 404, error: 'Deze kamer bestaat niet (meer).' });
      const p = veiligSamenPad(pad);
      if (!p) return antwoord({ status: 400, error: 'Dat is geen plek binnen RTG.' });
      const lid = lidVan(k, key);
      k.pad = p; k.titel = schoon(titel, 80) || null; k.at = Date.now();
      return antwoord({ status: 200, ok: true, kamer: publiek(k, key) },
        seinen(k, 'kijk', { pad: k.pad, titel: k.titel, door: lid.codenaam }, key));
    });
  }

  function chat(key, id, tekst) {
    return handel(kamers => {
      const k = actiefVoor(kamers, id, key);
      if (!k) return antwoord({ status: 404, error: 'Deze kamer bestaat niet (meer).' });
      const lid = lidVan(k, key), t = schoon(tekst, 300);
      if (!t) return antwoord({ status: 400, error: 'Zeg iets.' });
      const regel = { van: lid.codenaam, tekst: t, at: Date.now() };
      k.chat.push(regel);
      if (k.chat.length > 100) k.chat.shift();
      k.at = Date.now();
      return antwoord({ status: 200, ok: true, regel }, seinen(k, 'chat', regel, key));
    });
  }

  function muziek(key, id, media) {
    return handel(kamers => {
      const k = actiefVoor(kamers, id, key);
      if (!k) return antwoord({ status: 404, error: 'Deze kamer bestaat niet (meer).' });
      const lid = lidVan(k, key);
      if (k.gastheerKey !== key)
        return antwoord({ status: 403, error: 'De gastheer bepaalt de muziek.' });
      media = media || {};
      const sid = String(media.stationId || '').slice(0, 40);
      if (!sid) {
        k.muziek = null; k.at = Date.now();
        return antwoord({ status: 200, ok: true, kamer: publiek(k, key) },
          seinen(k, 'muziek', { muziek: null, door: lid.codenaam }, key));
      }
      const seed = Math.max(0,
        Math.min(Math.floor(Number(media.seed) || 0), Number.MAX_SAFE_INTEGER));
      const offset = Math.max(0,
        Math.min(Number(media.startOffsetMs) || 0, 24 * 3600000));
      const m = { stationId: sid, seed, start: Date.now() - offset,
        speelt: media.speelt !== false, door: lid.codenaam };
      k.muziek = m; k.at = Date.now();
      return antwoord({ status: 200, ok: true, kamer: publiek(k, key) },
        seinen(k, 'muziek', { muziek: m }, key));
    });
  }

  return { zet, chat, muziek };
};
