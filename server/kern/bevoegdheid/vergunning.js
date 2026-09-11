/* DE PAPIEREN KANT: wat ligt er aan vergunning, en is dat genoeg voor deze
   handeling?

   Afgesplitst van ./index.js langs hetzelfde soort naad als ./bord.js: daar
   loopt hij tussen een OORDEEL en een BEELD, hier tussen het oordeel en het
   PAPIER waar dat oordeel op rust. Wat hier staat, weet niets van rails,
   schakelaars of gezichten -- het leest wat de boardroom heeft vastgelegd en
   vergelijkt dat met wat een handeling vraagt. Dat is een eigen onderwerp, en
   het is het onderwerp dat een jurist naleest.

   TWEE DINGEN DIE HIER NIET GEBEUREN, en allebei met opzet. Er wordt niets
   gevalideerd bij een toezichthouder -- wij bellen geen register en doen niet
   alsof. En er wordt niets GERADEN: staat er geen vergunning, dan is het
   antwoord nee met de reden, nooit "waarschijnlijk wel". Een lege
   vergunningsvelden-lijst die "ja" betekent, is de enige leegstand die dit huis
   zich niet kan veroorloven. */
'use strict';

const { RANG, zinnen } = require('./lijst');

module.exports = ({ vergunning, nu }) => {

  /* Wat er LIGT. `er: false` zegt dat er niets bruikbaars is vastgelegd -- ook
     als er wel een rij staat met een soort die deze lijst niet kent, want een
     onbekende vergunningsoort is geen vergunning. */
  function vergunningStand() {
    const v = vergunning();
    if (!v || !v.soort || !RANG[v.soort]) return { er: false };
    const verlopen = Number.isFinite(v.tot) && v.tot < nu();
    return { er: true, soort: v.soort, rang: RANG[v.soort], verlopen,
      landen: Array.isArray(v.landen) ? v.landen : [], entiteit: v.entiteit || '', nummer: v.nummer || '', tot: v.tot || null };
  }

  /* De toets zelf, gedeeld door de eigen rail en het eigen boek. De volgorde van
     de weigeringen is niet willekeurig: eerst of er iets ligt, dan of het nog
     geldt, dan of het zwaar genoeg is, en pas daarna het land. Zo leest de mens
     die hem krijgt de eerste stap die hij moet zetten, en niet de laatste. */
  function toetsVergunning(nodig, id, land, via) {
    const v = vergunningStand();
    if (!v.er) return { mag: false, reden: 'geen', uitleg: zinnen.geen, vermogen: id, nodig };
    if (v.verlopen) return { mag: false, reden: 'verlopen', uitleg: zinnen.verlopen, vermogen: id, tot: v.tot };
    if (v.rang < RANG[nodig]) return { mag: false, reden: 'rang', uitleg: zinnen.rang, vermogen: id, nodig, heeft: v.soort };
    if (land && v.landen.length && !v.landen.includes('*') && !v.landen.includes(land))
      return { mag: false, reden: 'land', uitleg: zinnen.land, vermogen: id, land };
    return { mag: true, vermogen: id, via, vergunning: v.soort };
  }

  return { vergunningStand, toetsVergunning };
};
