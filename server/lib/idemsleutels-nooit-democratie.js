/* DEMOCRATIEOS bij ./idemsleutels-nooit-routes.js -- twaalf routes die het ZELF
   al weten. De meeste weigeren een herhaling met 409 en zeggen waarom, en
   precies die reden mag een duplicaatlaag niet opslikken (MUTATIECONTRACT.md
   par. 5o). Vier van de Political Connector doen iets anders en ook dat met
   opzet: een tweede voorstel, toelichting of sleutel IS een tweede gebeurtenis,
   en een duplicaatlaag zou er een verbergen. De partijdeur heeft bovendien geen
   sessie, dus een duplicaatlaag zou hem op het lijf alleen herkennen -- en dan
   krijgt de ene partij het afgespeelde antwoord van de andere. Dat is gemeten
   en niet bedacht: met de aanname als `zelfdeVerzoek` kreeg een herhaling het
   eerste antwoord terug in plaats van de eigen `herhaling` van de route, want
   ./idem-sleutelbepaling.js kent een afzender alleen aan Authorization of de
   cookie, en zonder die twee aan het ip-adres. */
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
    'weigert met 409 als de actie al gestopt is; er komt geen tweede tijdlijnregel',
  'POST /api/office/democratie/partij/registreer':
    'weigert met 409 als dezelfde aanduiding al op dat niveau staat; een afgespeeld succes zou een tweede ' +
    'sleutel tonen die niet bestaat',
  'POST /api/office/democratie/partij/sleutel':
    'geeft elke keer een NIEUWE sleutel en maakt de vorige ongeldig: een afgespeeld antwoord zou een sleutel ' +
    'tonen die al niet meer werkt',
  'POST /api/democratie/partij/voorstel/plaats':
    'een tweede voorstel met dezelfde tekst is een tweede voorstel en telt mee voor de daglimiet; wie dubbel ' +
    'plaatst hoort dat te zien en niet een afgespeeld eerste antwoord',
  'POST /api/democratie/partij/voorstel/aanname':
    'herkent een herhaling zelf (dezelfde waarde met dezelfde bron geeft herhaling en geen nieuwe ketenregel); ' +
    'de partijdeur heeft geen sessie, dus een duplicaatlaag zou partijen achter hetzelfde adres door elkaar halen',
  'POST /api/democratie/partij/voorstel/toelicht':
    'een tweede toelichting is een nieuwe regel op de keten (DO-10); een afgespeeld succes zou er een verbergen'
});
