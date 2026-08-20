/* RTG Link: WIE ER SCANT -- van een Bearer-token naar de rol die de scanner
   heeft. Meer niet: geen rechten, geen intenties, geen mens.

   Dit stond in server/routes/code.js en is hier komen te staan toen er een
   tweede deur bij kwam (/api/link/los). Twee deuren die allebei zelf uitrekenen
   wie er aanklopt, zijn twee antwoorden op dezelfde vraag -- en dan is de vraag
   welke van de twee klopt (LAT.md regel 4).

   HET IS EEN ECHTE CONTROLE EN GEEN VORMCONTROLE. Het token gaat door
   sessionFor of resolveSession heen; de kop wordt niet alleen betast (LAT.md
   regel 8). Wie geen geldige sessie heeft, krijgt null en niet "misschien".

   DE ROLLEN STAAN HIER, EN OP EEN PLEK. Een sessie met een rol die we hier niet
   kennen, telt als lid -- precies zoals het altijd deed, want de rollen van de
   werkvloer (manager, assistent) zijn geen scan-rollen. Wie hier een rol
   toevoegt zonder hem in de uitgiftelijst van routes/code.js te zetten (of
   andersom), wordt door test/link.test.js aangewezen. */
'use strict';

const ROLLEN = ['supplier', 'staff', 'office'];

module.exports = ({ sessionFor, resolveSession }) => {

/* Geeft { soort, code?, tier?, key? } of null. `soort` is 'lid' of een rol uit
   ROLLEN; `key` staat er alleen bij een echt account, want alleen dan is er een
   handle waarmee een mens iets met een ander mens kan. */
return function wieScant(req) {
  const header = (req && typeof req.get === 'function' ? req.get('authorization') : '') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  /* Eerst de in-memory sessie (demo-pas, zaak, personeel, kantoor): heeft die een
     bekende scan-rol, dan telt die rol; anders is het een lid (een demo-pas met
     een tier). */
  const s = sessionFor(token);
  if (s) {
    if (s.role && ROLLEN.includes(s.role)) return { soort: s.role, code: s.code || null };
    return { soort: 'lid', tier: s.tier || null };
  }
  // geen in-memory sessie: een echt account-token -> een lid, met zijn sleutel
  const lid = resolveSession(token);
  if (lid) return { soort: 'lid', tier: lid.tier, key: lid.key };
  return null;
};

};
module.exports.ROLLEN = ROLLEN;
