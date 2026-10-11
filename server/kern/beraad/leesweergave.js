/* Beraad (deelmodule): de leesweergave voor Rahul.

   Dezelfde vorm als kern/genootschap/leesweergave.js, met een stap meer: hier
   gaan niet de functies van de module door maar een PROJECTIE van een ronde,
   opgebouwd uit een positieve lijst velden (AI-CONTEXT-01: nooit een object waar
   daarna iets uit wordt gehaald). Er gaat geen sleutel en geen codenaam door,
   geen stem en geen telling -- alleen wat er gezegd is, met het id waarmee de
   server de bron er later weer aan hangt.

   Bevroren, tot op de regels, zodat er onderweg niemand iets aan kan hangen. Een
   SCHRIJFfunctie hoort hier nooit bij: Rahul stelt voor, een lid plaatst. */
'use strict';

const BERAADVELDEN = Object.freeze(['id', 'tekst']);
const SOORTLIJSTEN = Object.freeze([['inbreng', 'inbreng'], ['bezwaar', 'bezwaren'], ['open-punt', 'openPunten']]);

function leesweergave({ beraad }) {
  /* Is deze sessie lid, en zo ja: wat staat er in de lopende (of laatste)
     ronde. Null voor wie er niet bij hoort -- dezelfde stilte als de 404. */
  function ronde(sess, id) {
    const p = beraad.poort(sess, id);
    if (p.error) return null;
    const r = beraad.huidige(p.b);
    const regels = [];
    for (const [soort, veld] of SOORTLIJSTEN) {
      for (const x of r[veld]) {
        if (x.ingetrokken) continue;
        const rij = { soort };
        for (const v of BERAADVELDEN) rij[v] = x[v];
        regels.push(Object.freeze(rij));
      }
    }
    return Object.freeze({
      vraag: p.b.vraag,
      ronde: r.nr,
      voorstel: r.voorstel ? r.voorstel.tekst : null,
      regels: Object.freeze(regels)
    });
  }
  return Object.freeze({ ronde });
}

module.exports = { leesweergave, BERAADVELDEN };
