/* Handelingen binnen een bestaande FoundationOS Samen-kamer. Afgesplitst van
   de credentialuitgifte zodat beide browsermodules onder de 10 KiB-grens
   blijven. Alle functies lopen via het aangeleverde collectieslot. */
'use strict';

module.exports = ({ schoon, tijd, iso, veiligPad, lidVan, actiefVoor, kamer,
  toegang, publiek, handel, relatieGeldig, idempotentie }) => {
  function zet(sess, id, pad, titel, idem) {
    return handel(kamers => {
      const k = actiefVoor(kamers, id, sess);
      if (!k) return { status: 404, error: 'Deze kamer bestaat niet (meer).' };
      const p = veiligPad(pad);
      if (!p) return { status: 400,
        error: 'Dat is geen plek binnen de gezinsapps.' };
      const t = schoon(titel, 80) || null;
      const poging = idempotentie(k, 'zet', sess, idem,
        JSON.stringify([p, t]));
      if (poging.fout) return poging.fout;
      if (poging.herhaald) return { status: 200, ok: true,
        herhaald: true, kamer: publiek(k, sess) };
      k.pad = p; k.titel = t;
      k.door = (lidVan(k, sess.handle) || {}).codenaam || sess.codenaam;
      k.volg = (k.volg || 0) + 1; k.at = tijd();
      return { status: 200, ok: true, kamer: publiek(k, sess) };
    });
  }

  function chat(sess, id, tekst, idem) {
    return handel(kamers => {
      const k = actiefVoor(kamers, id, sess);
      if (!k) return { status: 404, error: 'Deze kamer bestaat niet (meer).' };
      const t = schoon(tekst, 300);
      if (!t) return { status: 400, error: 'Zeg iets.' };
      const poging = idempotentie(k, 'chat', sess, idem, t);
      if (poging.fout) return poging.fout;
      if (poging.herhaald) return { status: 200, ok: true,
        herhaald: true };
      const lid = lidVan(k, sess.handle);
      k.chat.push({ van: lid.codenaam, tekst: t, at: tijd() });
      if (k.chat.length > 100) k.chat.shift();
      k.volg = (k.volg || 0) + 1; k.at = tijd();
      return { status: 200, ok: true };
    });
  }

  function weg(sess, id) {
    return handel(kamers => {
      const k = kamer(kamers, id);
      if (!k || k.gesloten_at) return { status: 200, ok: true };
      const lid = lidVan(k, sess.handle);
      if (!lid || !relatieGeldig(k, sess)) return { status: 200, ok: true };
      k.leden = k.leden.filter(l => l.handle !== sess.handle);
      if (!k.leden.length) {
        k.gesloten_at = iso();
        toegang.intrekken(k, lid.codenaam, 'laatste lid vertrok');
      } else if (k.gastheer === sess.handle) {
        const nieuw = k.leden[0];
        k.gastheer = nieuw.handle; k.gastheerNaam = nieuw.codenaam;
        k.gastheerGezinHash = nieuw.gezin_hash;
        toegang.intrekken(k, lid.codenaam, 'gastheer droeg kamer over');
        k.volg = (k.volg || 0) + 1; k.at = tijd();
      } else {
        k.volg = (k.volg || 0) + 1; k.at = tijd();
      }
      return { status: 200, ok: true };
    });
  }

  function sluit(sess, id) {
    return handel(kamers => {
      const k = actiefVoor(kamers, id, sess);
      if (!k) return { status: 404, error: 'Deze kamer bestaat niet (meer).' };
      if (k.gastheer !== sess.handle)
        return { status: 403, error: 'Alleen de gastheer sluit de kamer.' };
      k.gesloten_at = iso();
      toegang.intrekken(k, sess.codenaam || sess.handle, 'kamer gesloten');
      return { status: 200, ok: true };
    });
  }

  function staat(sess, id) {
    return handel(kamers => {
      const k = actiefVoor(kamers, id, sess);
      return k ? { status: 200, ok: true, kamer: publiek(k, sess) }
        : { status: 404, error: 'Deze kamer bestaat niet (meer).' };
    });
  }

  return { zet, chat, weg, sluit, staat };
};
