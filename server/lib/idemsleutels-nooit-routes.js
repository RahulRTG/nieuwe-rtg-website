/* De gesloten lijst bij idemsleutels-nooit.js. Afzonderlijk gehouden zodat de
   keurder klein blijft; dit bestand bevat alleen beleid, geen uitvoerlogica. */
'use strict';

module.exports = Object.freeze({
  'POST /api/office/bank/nood':
    'een noodknop met een optionele reden: twee keer drukken is twee keer menen',
  'POST /api/office/bank/herstel':
    'een herstelknop met een leeg lijf: een opgeslikte tweede druk laat de bank in nood staan en zegt "ok"',
  'POST /api/office/bank/mislukking':
    'een leeg lijf per melding, en de route telt zelf op de sleutel van de mislukte clearing',
  'POST /api/bedrijf/lid/aanmeld':
    'twee mensen met dezelfde naam in dezelfde werkruimte zijn twee mensen; de tweede kreeg het ' +
    'lidmaatschap van de eerste terug',
  'POST /api/member/spel/sudoku-nieuw':
    'wie twee keer op "nieuwe puzzel" drukt, wil een nieuwe puzzel',
  'POST /api/kantoorpakket/deel':
    'delen weigert op een strikt document; die weigering mag geen cache overschrijven',
  'POST /api/office/kantoorpakket/deel':
    'zelfde reden als de ledenkant: het antwoord op een herhaling is een besluit',
  'POST /api/supplier/kantoorpakket/deel':
    'zelfde reden als de ledenkant: het antwoord op een herhaling is een besluit',
  'POST /api/kantoorpakket/beheer':
    'beheren weigert zolang er toegang openstaat; die weigering mag geen cache overschrijven',
  'POST /api/office/kantoorpakket/beheer':
    'zelfde reden als de ledenkant',
  'POST /api/supplier/kantoorpakket/beheer':
    'zelfde reden als de ledenkant',
  'POST /api/rtf/samen/maak':
    'uitgifte toont een kale deelcode eenmaal; de domeinkern bindt de retry zonder haar te herhalen',
  'POST /api/rtf/samen/code':
    'rotatie toont een kale deelcode eenmaal; de generieke cache mag haar nooit heronthullen',
  'POST /api/supplier/staff/invite':
    'het antwoord bevat een eenmalige kale personeelscode; een HTTP-cache mag dat geheim nooit opnieuw onthullen',
  'POST /api/supplier/staff/invite/roteer':
    'rotatie geeft een nieuw eenmalig geheim; antwoordherhaling zou dat geheim opnieuw onthullen',
  'POST /api/supplier/apply/decide':
    'aannemen kan een eenmalige personeelscode uitgeven; die mag niet uit een antwoordcache terugkomen',
  'POST /api/office/reisbureau/klaarzetten':
    'klaarzetten geeft een eenmalige reislink; de domeinkern beslist over een retry zonder het geheim te herhalen',
  'POST /api/office/reisbureau/uitnodiging-roteer':
    'rotatie geeft een nieuwe eenmalige reislink en mag nooit een bewaard geheim heronthullen',
  'POST /api/reis/uitnodiging/nodig-uit':
    'uitnodigen geeft een eenmalige reislink; de generieke cache mag die niet bewaren',
  'POST /api/reis/uitnodiging/roteer':
    'rotatie geeft een nieuwe eenmalige reislink en mag nooit een bewaard geheim heronthullen',
  'POST /api/rtgid/start':
    'uitgifte bevat twee eenmalige identiteitscredentials; de RTG-iD-kern bindt retry en verzoek zelf',
  'POST /api/rtgid/roteer':
    'rotatie vervangt beide identiteitscredentials en mag geen bewaard geheim heronthullen',
  'POST /api/salon/deal/claim':
    'uitgifte bevat een eenmalige Salon-claimcode; alleen de domeinkern beoordeelt een retry zonder heronthulling',
  'POST /api/salon/deal/claim/roteer':
    'rotatie bevat een nieuwe eenmalige Salon-claimcode; een antwoordcache mag haar nooit bewaren',
  'POST /api/supplier/vracht/maak':
    'uitgifte bevat een eenmalige vrachtvolgcode; alleen de domeinkern mag een retry beoordelen',
  'POST /api/supplier/vracht/volgcode/roteer':
    'rotatie bevat een nieuwe eenmalige vrachtvolgcode; een antwoordcache mag haar niet heronthullen',
  'POST /api/member/vluchten/incheck':
    'check-in geeft de kale boarding-passcode eenmaal; een generieke antwoordcache mag haar nooit heronthullen',
  'POST /api/member/vluchten/pass/roteer':
    'rotatie geeft een nieuwe boarding-passcode eenmaal; alleen de domeinkern bewaakt de verwachte rotatie',
  'POST /api/member/vluchten/pass/intrek':
    'intrekking bewaakt de verwachte rotatie in de luchthavenkern; een generiek bewaard succes mag een latere of afwijkende passtand niet verhullen',
  'POST /api/projectie/koppel':
    'koppelen wisselt de eenmalige schermcode in voor een geheim schermtoken; dat token mag nooit in een generieke antwoordcache worden bewaard of heronthuld',
  'POST /api/projectie/kijk':
    'polling ruimt verlopen en legacy projecties op en moet iedere keer actuele intrekking zien; een antwoordcache zou een gesloten scherm ten onrechte open kunnen houden',
  'POST /api/festival/groep':
    'uitgifte bevat een eenmalige groepscode; de domeinkern beslist atomair over een retry',
  'POST /api/festival/groep/code':
    'rotatie bevat een nieuwe eenmalige groepscode; een antwoordcache zou het geheim heronthullen',
  'POST /api/meet/maak':
    'uitgifte bevat een eenmalige Meet-code; een antwoordcache mag die niet bewaren',
  'POST /api/meet/code':
    'rotatie bevat een eenmalige Meet-code; de domeinkern antwoordt op retry zonder geheim',
  'POST /api/samen/maak':
    'uitgifte bevat een eenmalige Samen-code; de domeinkern ontdubbelt zonder heronthulling',
  'POST /api/samen/code':
    'rotatie bevat een eenmalige Samen-code; een antwoordcache mag die nooit bewaren',
  'POST /api/samen/sluit':
    'de Samen-kern sluit en trekt toegang zelf atomair in; een herhaling moet de actuele eigenaars- en sluitstand opnieuw beoordelen en geen oud succes afspelen',
  'POST /api/rtf/samen/sluit':
    'de gezinskern sluit en trekt toegang onder haar eigen collectieslot in; een generieke cache mag een gewijzigde profiel- of sluitstand niet verhullen',
  'POST /api/supplier/horeca/folio/nacht':
    'de nachtrun weet zelf welke nachten al geboekt zijn en zegt dat ook; een cache maakt van dat antwoord een leugen'
});
