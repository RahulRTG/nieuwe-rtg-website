/* De twee schrijfroutes van de Project Room. Bewijs is inhoudelijk beschermd
   tegen een dubbele tik; opleveren sluit het project en kan daarna niet nog
   eens schrijven. Beide vragen bovendien een persoonlijke projecteigenaar. */
'use strict';

const AFGETEKEND = { door: 'Codex, op grond van kern en gerichte projectproef; niet door een mens nagelezen', op: '2026-09-08' };

const CONTRACTEN = {
  'POST /api/rtgone/project/bewijs': {
    mutatieId: 'rtgone.project.bewijs', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'officeAuth + persoonlijk personeelsaccount + projecteigenaar' },
    stand: 'PROTECTED',
    nagekeken: 'De kern vergelijkt actor, titel, uitleg, bron, document en taak met bestaand projectbewijs. Een identieke herhaling geeft hetzelfde bewijs terug zonder tweede tijdlijnregel of save.',
    bewijs: { gemeten: 'test/rtgone.test.js herhaalt hetzelfde bewijs en houdt precies één bewijsstuk in het project.', op: '2026-09-08' },
    afgetekend: AFGETEKEND
  },
  'POST /api/rtgone/project/oplever': {
    mutatieId: 'rtgone.project.oplever', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'officeAuth + persoonlijk personeelsaccount + projecteigenaar' },
    stand: 'PROTECTED',
    nagekeken: 'De kern controleert eerst status, goedgekeurde besluitroute, alle taken en minstens één bewijsstuk. Na de eerste geslaagde oplevering staat status op afgerond; iedere herhaling stopt vóór een schrijfhandeling.',
    bewijs: { gemeten: 'test/rtgone.test.js bewijst de blokkades, levert eenmaal op en krijgt bij herhaling 400 zonder tweede oplevering.', op: '2026-09-08' },
    afgetekend: AFGETEKEND
  }
};

module.exports = { CONTRACTEN };
