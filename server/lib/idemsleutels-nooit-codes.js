/* DE GEMIGREERDE CODES bij ./idemsleutels-nooit-routes.js -- de routes die een
   128-bit credential tonen, roteren of intrekken (RELEASEKANDIDAAT.md B9).
   Tonen is roteren: een antwoordcache zou een code heronthullen die al is
   ingetrokken, dus alleen de domeinkern beoordeelt een herhaling. Eigen
   bestand, omdat de hoofdlijst anders over de 10 kB gaat. */
'use strict';

module.exports = Object.freeze({
  'POST /api/giftcard/roteer':
    'rotatie toont een nieuwe cadeaukaartcode eenmaal; de kern weigert dezelfde sleutel daarna met 409 zonder code',
  'POST /api/supplier/giftcard/roteer':
    'zelfde reden als de ledenkant: geen antwoordcache mag de code van een kaart met saldo heronthullen',
  'POST /api/supplier/giftcard/intrek':
    'intrekken leest de actuele stand in kern/cadeaukaart.js; een tweede keer is een toestandscontrole, geen gecachet antwoord',
  'POST /api/pay/kascode':
    'uitgifte toont een 128-bit kascode eenmaal en trekt de vorige in; de bak weigert dezelfde sleutel daarna met 409',
  'POST /api/pay/tikcode':
    'zelfde reden als de kascode: geen antwoordcache mag een tikcode heronthullen',
  'POST /api/pay/tegoed/roteer':
    'rotatie toont een nieuwe geldwaardige tegoedcode eenmaal; de bon weigert de sleutel daarna met 409',
  'POST /api/supplier/pay/tegoed/roteer':
    'zelfde reden als de ledenkant: geen antwoordcache mag de code heronthullen',
  'POST /api/order/afhaalcode':
    'tonen is roteren: elk antwoord draagt een nieuwe afhaalcode en trekt de vorige in; een herhaald antwoord zou een ingetrokken code tonen',
  'POST /api/ticket/toon':
    'tonen is roteren: elk antwoord draagt een nieuwe entreecode en trekt de vorige in (kern/tickettoegang.js); een herhaald antwoord zou een ingetrokken code tonen',
  'POST /api/supplier/ticket/toon':
    'zelfde reden als de ledenkant: het vernieuwen van een deurticket geeft een nieuwe code en trekt de vorige in',
  'POST /api/mob/kaart/toon':
    'tonen is roteren: elk antwoord draagt een nieuwe code van het vervoerbewijs en trekt de vorige in (kern/mobiliteit/kaarttoegang.js)',
  'POST /api/order/afhaalcode/intrek':
    'intrekken leest de actuele stand in kern/afhaalcode.js; een tweede keer is een toestandscontrole, geen gecachet antwoord'
});
