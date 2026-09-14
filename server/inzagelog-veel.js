'use strict';

/* DE MEERVOUDIGE JOURNAALREGEL -- afgesplitst van ./inzagelog.js.

   DE NAAD IS EEN ONDERWERP EN GEEN OMVANG. Een gerichte opzoeking van EEN
   persoon en een lijstscherm dat er vijftig toont zijn twee verschillende
   handelingen, met een ander signaal en een andere lezer. Ze deelden hier
   alleen een bestand.

   De aanleiding was wel de omvang: ./inzagelog.js kwam op 9803 byte en daarmee
   in de waarschuwingsband van keuringsregel omvang (> 9400, grens 10240). Die
   regel schrijft zijn eigen remedie voor -- "knip er een deelbestand af zolang
   het rustig kan" -- en dit is de naad die dan overblijft. */

module.exports = function maakVeel({ noteer }) {
  /* Meerdere accounts in een handeling (een lijstscherm dat namen toont) horen
     als EEN regel in het journaal, niet als vijftig. Anders verdrinkt het echte
     signaal -- de gerichte opzoeking van een persoon -- in de ruis van elke
     pagina die iemand opent. Het aantal en de id's blijven wel staan. */
  function noteerVeel(opdracht = {}) {
    const o = veelOpdracht(opdracht);
    return o ? noteer(o) : null;
  }

  /* De vorm van een meervoudige regel, los van wie hem vastlegt -- zodat
     noteerVeel() en noteerVeelVast() nooit twee verschillende regels schrijven.
     Dezelfde grond als schrijfRegel(): een hashketen die twee soorten regels
     dekt, bewijst over geen van beide iets.

     De drie extra velden gaan MEE in plaats van er achteraf op te worden gezet:
     sinds de keten eronder ligt, dekt de hash de regel zoals hij wordt
     weggeschreven. Zie de uitleg bij noteer(). */
  function veelOpdracht({ door, overIds, waarom, bron } = {}) {
    const ids = (Array.isArray(overIds) ? overIds : []).map(String);
    if (!ids.length) return null;
    return { door, over: { id: ids[0] }, waarom, bron, extra: {
      overId: null,                       // het is geen enkele persoon
      aantal: ids.length,
      overIds: ids.slice(0, 200)          // begrensd: een dump van 65M id's helpt niemand
    } };
  }

  return { noteerVeel, veelOpdracht };
};
