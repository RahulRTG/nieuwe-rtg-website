/* DEMOCRATIEOS bij ./idemsleutels-nooit-routes.js -- zeven routes die het ZELF
   al weten. Elk weigert een herhaling met 409 en zegt waarom, en precies die
   reden mag een duplicaatlaag niet opslikken (MUTATIECONTRACT.md par. 5o). */
'use strict';

module.exports = Object.freeze({
  'POST /api/office/democratie/kwestie/eindstand':
    'weigert met 409 als de ronde al is afgesloten: een eindstand verandert niet achteraf, en wie een ' +
    'besluit zet hoort te weten dat een ander hem voor was',
  'POST /api/office/democratie/kwestie/heropen':
    'weigert met 409 zolang de kwestie loopt; een afgespeeld succes laat een tweede behandelaar denken ' +
    'dat HIJ de nieuwe ronde opende',
  'POST /api/member/democratie/kwestie/intrek':
    'weigert met 409 als de ronde al is afgesloten; wie intrekt hoort te zien of er al een uitkomst was',
  'POST /api/member/democratie/actie/start':
    'weigert met 409 en noemt de actie die al loopt; een afgespeeld succes zou verbergen dat er al een was',
  'POST /api/member/democratie/actie/verlaat':
    'weigert met 403 als hij al vertrokken is; wie vertrekt hoort te zien dat hij er al niet meer bij was',
  'POST /api/member/democratie/actie/resultaat':
    'weigert met 409 als de actie al klaar is: een resultaat verandert niet achteraf',
  'POST /api/member/democratie/actie/stop':
    'weigert met 409 als de actie al gestopt is; er komt geen tweede tijdlijnregel'
});
