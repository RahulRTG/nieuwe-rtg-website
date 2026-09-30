/* DE GEMIGREERDE CODES bij ./idemsleutels-nooit-routes.js -- de routes die een
   128-bit credential tonen, roteren of intrekken (RELEASEKANDIDAAT.md B9).
   Tonen is roteren: een antwoordcache zou een code heronthullen die al is
   ingetrokken, dus alleen de domeinkern beoordeelt een herhaling. Eigen
   bestand, omdat de hoofdlijst anders over de 10 kB gaat. */
'use strict';

module.exports = Object.freeze({
  'POST /api/arrival/request':
    'de aanvraag toont de Arrival Pass eenmaal; een herhaling met dezelfde aanvraagcode roteert in kern/arrivalpas.js en een antwoordcache zou de eerste pass heronthullen',
  'POST /api/arrival/pass/roteer':
    'roteren geeft een nieuwe pass en trekt de vorige in; een herhaald antwoord zou een ingetrokken pass tonen',
  'POST /api/arrival/pass/intrek':
    'intrekken leest de actuele stand in kern/arrivalpas.js; een tweede keer is een toestandscontrole, geen gecachet antwoord',
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
  'POST /api/office/doos/sleutel':
    'uitgeven is roteren: elk antwoord draagt een nieuwe 128-bit doossleutel en trekt de vorige van die doos in (kern/zaakdoos/sleutels.js); een herhaald antwoord zou een ingetrokken sleutel tonen',
  'POST /api/supplier/doos/sleutel':
    'zelfde reden aan de zaakkant: de manager roteert de sleutel van zijn eigen doos, en een antwoordcache zou de vorige heronthullen',
  'POST /api/office/doos/sleutel/weg':
    'intrekken leest de actuele stand in de collectietransactie van kern/zaakdoos/sleutels.js; een tweede keer is een toestandscontrole, geen gecachet antwoord',
  'POST /api/supplier/doos/sleutel/weg':
    'zelfde reden als de kantoorkant: intrekken beslist op de actuele stand, en een gecachet antwoord mag geen intrekking overslaan',
  'POST /api/office/partnerkanaal/personeelscode':
    'uitgeven maakt elke keer een nieuwe medewerkerplek met een eigen 128-bit personeelscode (kern/partnerpersoneelscode.js); een herhaald antwoord zou een kale code heronthullen',
  'POST /api/office/partnerkanaal/personeelscode/roteer':
    'roteren geeft een nieuwe personeelscode en trekt de vorige van die plek in; een antwoordcache mag de nieuwe code nooit bewaren of herhalen',
  'POST /api/office/partnerkanaal/personeelscode/intrek':
    'intrekken leest de actuele stand in de collectietransactie van kern/partnerpersoneelscode.js; een tweede keer is een toestandscontrole, geen gecachet antwoord',
  'POST /api/order/afhaalcode/intrek':
    'intrekken leest de actuele stand in kern/afhaalcode.js; een tweede keer is een toestandscontrole, geen gecachet antwoord',
  'POST /api/ov/code':
    'tonen is roteren: elk antwoord draagt een nieuwe OV-incheckcode en trekt de vorige in (kern/ov/incheckcode.js); een herhaald antwoord zou een ingetrokken code tonen',
  'POST /api/ov/code/intrek':
    'intrekken leest de actuele stand in kern/ov/incheckcode.js; een tweede keer is een toestandscontrole, geen gecachet antwoord',
  'POST /api/mode/bezorg/code':
    'een nieuwe bezorgcode trekt de vorige in en begint een nieuw pogingenbudget (kern/modebezorg/bezorgcode.js); het plafond van tien telt elke echte uitgifte, dus een cache mag hem niet overslaan of heronthullen',
  'POST /api/festival/pas':
    'de uitgifte toont de pascode eenmaal; dezelfde sleutel of een dubbeltik krijgt in kern/festival/rechten.js 409 zonder code, zodat er geen tweede pas ontstaat',
  'POST /api/festival/pas/intrek':
    'intrekken leest de actuele stand in de festivaltransactie; een tweede keer laat de ingetrokken pas ingetrokken, geen gecachet antwoord',
  'POST /api/festival/gast/pas/toon':
    'tonen is roteren: elk antwoord draagt een nieuwe pascode en trekt de vorige in (kern/festival/pas-toegang.js)',
  'POST /api/festival/verkoop/rond':
    'rondmaken geeft de pascode eenmaal; een herhaling vindt de verkoop op betaald en krijgt 409 zonder code, dus een cache zou alleen een code heronthullen',
  'POST /api/rtfos/activiteit/inschrijven':
    'het inschrijfantwoord toont de incheckcode eenmaal; dezelfde codenaam opnieuw inschrijven weigert de kern zelf (400), zonder code',
  'POST /api/rtfos/activiteit/incheckcode':
    'een nieuwe incheckcode trekt de vorige in (kern/rtfos/activiteiten-deur.js); een herhaald antwoord zou een ingetrokken code tonen',
  'POST /api/supplier/horeca/bon/maak':
    'uitgifte toont een 128-bit boncode eenmaal; een herhaling met dezelfde sleutel geeft in kern/horeca/bon.js dezelfde bon zonder code, en een antwoordcache zou de code heronthullen',
  'POST /api/supplier/horeca/club/band':
    'de eerste opwaardering maakt de band en toont zijn 128-bit code eenmaal; een herhaald antwoord zou die code heronthullen, en opwaarderen is een geldhandeling die de bontransactie zelf beoordeelt',
  'POST /api/supplier/horeca/bon/roteer':
    'roteren toont een nieuwe boncode eenmaal en trekt de vorige in; de kern weigert dezelfde sleutel daarna met 409 zonder code',
  'POST /api/supplier/horeca/bon/intrek':
    'intrekken leest de actuele stand in kern/horeca/bon-beheer.js; een tweede keer is een toestandscontrole, geen gecachet antwoord'
});
