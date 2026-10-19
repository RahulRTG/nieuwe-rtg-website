/* Vergeten, deelbestand "sporen": WAT ER NAAST HET LID OVER HEM WORDT BIJGEHOUDEN.

   Drie registers die niet over het lid GAAN maar wel zijn sleutel dragen: de
   context per sessie in Mijn RTG, de koppeling van een inbrengersnummer aan een
   mens in DemocratieOS, en de sessies die nog openstaan. Afgesplitst uit
   ../vergeten.js (18 oktober 2026); de volgorde daar blijft: dit gebeurt na het
   account en vóór de duurzame save. */
'use strict';

module.exports = ({ kern, sessions, forgetSession }) => {
  function wisSporen(key) {
    /* EN HET SESSIEREGISTER VAN MIJN RTG. Dat is iets anders dan de sessies die
       hieronder worden uitgelogd: forgetSession raakt de Map met tokens, dit
       register houdt de CONTEXT per sessie (waar, met welk toestel, hoe zeker)
       en overleeft het token met opzet. Zonder deze regel bleef de sleutel van
       het lid daar staan -- de bezem van test/vergeten-gezelschap.test.js vond
       hem terug als tak `sessiecontext (sleutel)`.

       De functie woont in het register zelf en niet hier, om twee redenen: die
       module BEZIT de collectie (kern/eigencollectie), en wissen moet kijken
       naar wat er staat in plaats van naar wat vanLid() nog toont -- die filtert
       op een TTL van dertig dagen, en juist de oudste rij is de rij die het
       langst blijft liggen. */
    if (kern.sessieregister && kern.sessieregister.wisLid) kern.sessieregister.wisLid(key);
    /* DemocratieOS: de kwesties blijven, de weg van het inbrengersnummer naar de mens niet. */
    if (kern.democratieVergeet) kern.democratieVergeet(key);
    // alle sessies van dit lid uitloggen
    for (const [h, sess] of sessions) if (sess.key === key) forgetSession(h);
  }

  return { wisSporen };
};
