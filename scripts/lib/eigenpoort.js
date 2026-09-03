/* ============================================================================
   DE POORT ZIT IN DE HANDLER -- en dat is iets anders dan openbaar.

   WAAROM DIT EEN EIGEN LIJST IS EN NIET DIE VAN ./publiek.js.

   Ik had deze routes eerst op de openbaar-lijst gezet, om ze meetbaar te maken.
   Keuringsregel 28 wees dat af, en terecht: die regel controleert ook de
   ANDERE kant op. Staat een pad op de uitzonderingslijst terwijl het inmiddels
   een eigen poort heeft, dan hoort de uitzondering weg -- want een overbodige
   uitzondering dekt straks een poort die iemand weghaalt. Tien routes gingen
   daarop af.

   De fout was niet de meting maar het middel: ik rekte een uitzonderingslijst
   op om een meetprobleem op te lossen. Dat is precies wat dit hele project
   moet voorkomen.

   WAT DEZE ROUTES WEL ZIJN. Ze hebben geen middleware, en de controle staat in
   de handler zelf: een inlogdeur die code en wachtwoord vergelijkt, een webhook
   die een handtekening natelt. Voor de bewakerskaart is dat niet van een gat te
   onderscheiden -- er staat immers niets voor de handler -- en toch is er wel
   degelijk een poort.

   WAT DAT BETEKENT VOOR EEN PROEF. Er hoort geen token mee: een inlogdeur die
   een sessie eist, zou niemand kunnen laten inloggen. De sleutel is dus leeg,
   net als bij `openbaar` en `omgeving`, en de NAAM verschilt omdat de reden
   verschilt. Drie keer dezelfde lege sleutel en drie verschillende woorden --
   dat is met opzet: `openbaar` staat voor iedereen open, `omgeving` alleen
   intern, en hier oordeelt de handler zelf.

   ELKE REGEL DRAAGT EEN REDEN, en die is nagelopen in de bron voor hij hier
   kwam te staan. Kun je die reden niet schrijven, dan is de route waarschijnlijk
   gewoon een gat. */
'use strict';

const EIGEN_POORT = new Map([
  // ---- de inlogdeuren: hier ontstaat de sessie, dus er kan er nog geen zijn ----
  ['/api/login', 'de pas-inlog vergelijkt zelf en geeft 401/403; een rem per adres ervoor'],
  ['/api/office/login', 'de backoffice-code wordt tijd-veilig vergeleken, met een rem per adres'],
  ['/api/supplier/login', 'de zaak logt in met code en wachtwoord, of een medewerker met een pincode'],
  ['/api/supplier/mijn/login', 'idem voor het persoonlijke deel van een medewerker'],
  ['/api/techniek/inloggen', 'eigen rem per adres en per login, en een gelijk antwoord op elke mislukking'],
  ['/api/staff', 'de personeelsdeur: een medewerker wisselt een code in voor een sessie'],

  /* ---- het bewijs komt uit een EERDERE stap en wordt hier nagerekend ----

     Deze drie stonden in ALLEEN_ANONIEM (de lijst van scripts/poortwacht.js) en
     daarmee wel op de anonieme-klop-lijst maar niet in de bewakerskaart -- die
     leest PUBLIEK. Toen ik ze uit PUBLIEK haalde na keuringsregel 28, vielen ze
     terug in "geen proefsleutel". De eindpoort ving dat binnen een minuut; ze
     horen hier, want alle drie rekenen ze zelf iets na. */
  ['/api/auth/reset', 'zoekt het lid op het hersteltoken en eist daarna een tweede code; ongeldig of verlopen geeft 400'],
  ['/api/sso/wissel', 'verifieert het overdrachtsbewijs en trekt het meteen in -- een bewijs is voor een keer'],
  ['/api/aanmeld/zeg', 'werkt op een gespreks-id uit een eerdere stap, met een rem per adres; een onbekend id komt niet verder'],

  // ---- machine naar machine: het bewijs zit in het verzoek zelf ----
  ['/api/betaal/webhook/adyen', 'de derde kaartwebhook; hij telt een handtekening na en weigert zonder secret'],

  /* /api/foundation/reis/aanvraag stond hier tot 3 september 2026 onder
     "bewust zonder account, met een eigen rem". Sinds de samenvoeging met #176
     staat hij op de openbaar-lijst (scripts/lib/publiek.js, PUBLIEK) met zijn
     rem erbij -- daar horen bewust open routes, en een pad mag niet op allebei
     staan (test/eigenpoort.test.js). Hier stond hij alleen omdat keuringsregel
     28 een gemonteerde route op PUBLIEK toen niet kon terugvinden. */
]);

module.exports = { EIGEN_POORT };
