/* RTG Klankwerk (deelmodule van de uitgave): WAT HET PUBLIEK DOET.

   "Mooi" vinden en reageren. Gesplitst van ./muziek-uitgave.js toen dat bestand
   over de 10 kB-keuringsgrens ging, en de naad die de keuring aanwees was ook
   de juiste: daar staat wat een uitgave IS en hoe hij ontstaat, hier staat wat
   luisteraars ermee doen.

   Wat hier NIET komt, en dat is dezelfde weigering als in ./muziek-uitgave.js:
   geen hitlijst, geen teller "meest beluisterd van de week", geen volgorde op
   populariteit. "Mooi" is een getal naast een stuk en nooit een rangschikking
   eroverheen. */
'use strict';

const MAX_REACTIES = 200;

module.exports = ({ U, save, schoon, nu, uitgaveMet, codenaamVan }) => {
  function mooi(sess, id, aan) {
    const u = uitgaveMet(id);
    if (!u) return { status: 404, error: 'Deze uitgave bestaat niet.' };
    if (!u.mooi || typeof u.mooi !== 'object') u.mooi = {};
    if (aan === false) delete u.mooi[sess.key]; else u.mooi[sess.key] = true;
    save();
    return { status: 200, ok: true, mooi: Object.keys(u.mooi).length, ikVindHem: !!u.mooi[sess.key] };
  }

  function reageer(sess, id, tekst) {
    const u = uitgaveMet(id);
    if (!u) return { status: 404, error: 'Deze uitgave bestaat niet.' };
    const t = schoon(tekst, 300);
    if (!t) return { status: 400, error: 'Schrijf eerst iets.' };
    const rij = U().reacties[u.id] = U().reacties[u.id] || [];
    const r = { codenaam: codenaamVan(sess.key), tekst: t, at: nu() };
    rij.push(r);
    if (rij.length > MAX_REACTIES) U().reacties[u.id] = rij.slice(-MAX_REACTIES);
    save();
    return { status: 200, ok: true, reactie: r };
  }
  const reacties = (id) => ({ status: 200, reacties: (U().reacties[String(id || '')] || []).slice(-60) });

  return { mooi, reageer, reacties };
};
