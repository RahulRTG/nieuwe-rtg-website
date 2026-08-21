/* De eigenaarsregels: DE BREDE DOMEINEN (deel twee van de tabel).

   Deel een (./tabel.js) draagt de specialistische kamers; die gaan voor, want
   eerste match wint. Hier staan de brede bedrijfs- en ledendomeinen: geld,
   mensen en recht, platform en creatie, en de diensten voor leden.

   TWEE BESTANDEN, EEN VOLGORDE. De lijsten worden achter elkaar geplakt en niet
   apart doorzocht -- een regel hier verhuizen naar deel een verandert dus wel
   degelijk waar dingen terechtkomen. Gesplitst om keuringsregel 13 (10 KB), en
   dat is ook eerlijk: dit zijn twee soorten regels. */
'use strict';

const BREED = [
  /* Geld, handel en groei. */
  /* De commerciele kern hoort bij Financien, net als de pasprijzen: het gaat
     over wat RTG vraagt en waarvoor. `claims` en `sociaalbeleid` staan er
     expliciet bij -- zonder die twee vielen ze terug op "Onderzoek & data", en
     een terugval telt in het Controleregister als dekkingsgat. `sociaalbeleid`
     moet bovendien HIER matchen en niet verderop op `/sociaal`: de sociale
     afdracht is geld, geen klantenservice. */
  [/bank|pay|betaal|factuur|finance|krediet|rekening|wallet|munt|wbw|\/geld|\/pin\b|giftcard|pasprijzen|\/balans|\/facturen|\/claims|sociaalbeleid|commercie|prijsgarantie/, 'financien', 'Financiën'],
  [/marketing|campagne|analytics|\/merk/, 'marketing', 'Marketing'],
  [/\/pr\/|communicatie|persbericht/, 'pr', 'PR & communicatie'],
  [/\/sales|acquisitie|lead/, 'sales', 'Sales'],
  [/supplier\/(?:inkoop|groothandel|keten|vracht)|\/inkoop|\/groothandel|\/vracht/, 'inkoop', 'Inkoop'],
  [/supplier\/(?:verkoop|retail|order|menu|reserver)|\/verkoop|\/mall|\/retail|\/bestellen|\/kassa|\/handel/, 'verkoop', 'Verkoop'],
  [/\/foodcourt|\/spar\b|\/pakket|\/order|\/reserveer|\/reservering|\/verhuur/, 'verkoop', 'Verkoop'],

  /* Mensen, recht en de eigen organisatie. */
  [/staff|personeel|vacature|sollicit|\/werving|\/cv\b|\/werkvloer|\/training|\/werk\.html/, 'hr', 'HR'],
  [/contract|juridisch|paspoort|machtig|privacy|avg|toestemming|inzagekaart|rechtsvorm|\/drm\b/, 'juridisch', 'Juridisch'],
  [/ingenieur|engineering/, 'ingenieurs', 'Ingenieurs'],
  [/\/bedrijf|\/onderneming|\/concern|\/genootschap|\/zakelijk|\/metier/, 'support', 'Support team'],
  // de gastenkant van het festival is een ledenoppervlak, dus Klantenservice --
  // en VOOR de regel hieronder, die elk pad met "gast" naar Support stuurt.
  [/\/festival\/gast|festival-gast/, 'klantenservice', 'Klantenservice'],
  [/supplier|partner|\/gast/, 'support', 'Support team'],

  /* Platform, onderzoek en creatie. */
  [/asset|site|auth|webauthn|rtgid|verify|sleutel|passkeys|\/sso|\/account|\/bestanden|\/agenda|\/kantoorpakket|\/werkplek|\/browser|\/code\b|\/scanner|\/veilig\.html|\/rtgcode|\/table\.html|\/state\b|\/klok/, 'intern', 'Intern & IT'],
  /* `/plaats` staat bij zijn naaste buur `/nav`: de plaatslaag (PLAATS.md) is
     net als navigatie, comm en push een gedeelde platformvoorziening waar
     andere domeinen op leunen -- de prikklok, de arrival-pass en de voorspeller
     vragen hem alle drie iets. Hij hoort dus in de Integratiekamer en niet bij
     een van zijn afnemers. */
  [/\/rtgone|\/comm\b|\/gegevens|\/notifications|\/meldingen|\/push|\/stream|\/vertaal|\/translate|\/talen|\/nav\b|\/plaats\b|\/mail\b/, 'integraties', 'Integratiekamer'],
  [/foundation|rtf|labfonds|\/lab\b|\/onderzoek|\/onderwijs|\/leerstof|\/leren|\/meet\b|\/metrics|\/voorspel|\/projectie|\/sonde|\/sat\b/, 'onderzoek', 'Onderzoek & data'],
  [/podium|theater|clips|flits|creatief|\/mediaos|\/muziek|\/sport|\/avond|\/uitgaan|\/boeken|\/galerij/, 'creatief', 'Creatief'],

  /* Diensten voor leden en bezoekers. */
  [/salon|member|bericht|dm|ontmoet|vonk|care|zorg|reis|ticket|lucht|hotel|ov|rit|charter/, 'klantenservice', 'Klantenservice'],
  [/\/thuis|\/home|\/leven|\/life\b|\/ik\b|\/gemoed|\/gedachten|\/gewoonten|\/doelen|\/notities|\/memo|\/vitaal|\/voeding|\/medicatie|\/medicijnen|\/metingen|\/arrival|\/verblijf|\/booking|\/book\b|\/residentie|\/sociaal|\/samen|\/fluister|\/live\b|\/klets|\/chat\b|\/like\b|\/comment|\/tijdlijn|\/aandacht|\/attenties|\/favoriet|\/dag\b|\/locatie|\/adres|\/annuleer|\/gids\b|\/event\b|\/punten|\/vandaag|\/ice\b|\/rahul|\/ai\b|\/navigatie|\/reizen|\/vertaler/, 'klantenservice', 'Klantenservice'],
  [/\/cellier|\/cercle|\/concierge|\/zaal|\/entourage|\/garderobe|\/ghost|\/hangar|\/lifestyle|\/horloge|\/uitzicht|\/maison|\/mecenaat|\/pulse|\/rendezvous/, 'klantenservice', 'Klantenservice'],
  [/\/klankwerk|\/camera|\/oog\b|\/media\.html/, 'creatief', 'Creatief'],
  // de organisatiekant van het festival (poort, kassa, dienst): een zaak, net
  // als horeca hieronder. De gastenkant staat hierboven bij Klantenservice.
  [/\/festival/, 'verkoop', 'Verkoop'],
  [/\/horeca|\/mijnmall|\/review|\/splits/, 'verkoop', 'Verkoop'],
  [/\/zaakweb|\/leverancier\.html/, 'support', 'Support team'],
  [/\/marechaussee|\/meldkamer/, 'paniekkamer', 'De Paniekkamer'],
  [/\/toestel/, 'hardware', 'RTG Hardwarelab'],
  [/\/nalatenschap/, 'juridisch', 'Juridisch'],
  [/\/aanmeld\b/, 'balie', 'De Ledenbalie'],
  [/\/magnaat\.html|\/rtg\.html|\/logboek/, 'controleregister', 'RTG Controleregister']
];

module.exports = BREED;
