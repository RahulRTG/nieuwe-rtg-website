/* DE WOORDENLIJSTEN VAN DE ACTION-BOUND BEVESTIGING -- welke handelingen vragen
   dat de passkey opnieuw wordt getoond, en in welke poort horen ze.

   WAAROM DIT EEN EIGEN BESTAND IS. De PIN-lijst stond op twee plekken:
   ./webauthn-actie.js kende hem als ACTIES en ../routes/social/pin.js schreef
   hem nog een keer op als PIN_ACTIES. Dezelfde waarheid op twee plekken is
   LAT.md regel 4, en bij juist DEZE lijst is de fout stil: een handeling die
   maar in een van de twee staat, wordt door de ene helft bewaakt en door de
   andere doorgelaten -- en dan staat er op het scherm dat er bevestigd moet
   worden terwijl de route het niet eist, of andersom.

   TWEE LIJSTEN, GEEN OVERLAP, EN DAT IS DE GRENS ZELF. De poorten delen een
   implementatie en een challenge-opslag, maar niet hun woordenlijst: elke poort
   keurt een actienaam af die niet in ZIJN lijst staat (`actieSchoon`). Daardoor
   is een ceremonie die voor een PIN-handeling is uitgegeven niet in te wisselen
   voor een zware handeling, ook al liggen beide in dezelfde opslag. De
   disjunctie is dus geen nette naamgeving maar de scheiding waar de
   veiligheid op rust; test/eigenaarbevestiging.test.js speelt dat na.

   WAAROM DE ZWARE LIJST KORT IS. Dit is niet "alles wat de eigenaar kan" -- de
   technische pagina en de boardroom tellen samen tientallen routes, en die elke
   keer een vinger laten vragen leert een mens alleen maar wegklikken
   (GRAMMATICA.md: twintig "weet u het zeker?"-vragen leren mensen op ja
   drukken). Hier staat alleen wat een gestolen open sessie NOOIT zelfstandig
   mag doen. Elke naam hieronder is nagelopen tegen een route die echt bestaat;
   een naam zonder route is een belofte zonder handhaver.

   `passkey-weg` staat er bewust bij en geldt voor IEDEREEN met een passkey, niet
   alleen voor de eigenaar. Zonder die regel is de hele lijst leeg te maken: wie
   een open sessie steelt haalt eerst de passkeys weg, en daarna zegt `nodig()`
   keurig dat er niets te bevestigen valt. Een ratel die je van bovenaf kunt
   openzetten is geen ratel. */
'use strict';

/* De drie PIN-handelingen. Ongewijzigd overgenomen uit ./webauthn-actie.js en
   ../routes/social/pin.js; dit is de plek waar ze nu nog staan. */
const PIN_ACTIES = Object.freeze([
  'rtg-pin-vernieuw',
  'rtg-pin-noodslot-uit',
  'rtg-pin-vast-aan'
]);

/* De zware handelingen, met per stuk de route die hem afdwingt. Wie hier iets
   toevoegt zonder die route te bedraden, zet een woord in een lijst en verder
   niets -- test/eigenaarbevestiging.test.js zakt daarop. */
const ZWARE_ACTIES = Object.freeze([
  'eigenaar-overdracht',        // POST /api/techniek/eigenaar
  'eigenaar-techniektoegang',   // POST /api/techniek/toegang
  'eigenaar-boardroomtoegang',  // POST /api/office/boardroom/toegang/geef
  'eigenaar-bewaarveeg',        // POST /api/techniek/bewaren/veeg  (alleen bevestig:'WIS')
  'eigenaar-noodrem-uit',       // POST /api/techniek/beveiliging/auto  (alleen bij UIT)
  'eigenaar-terugstorting',     // POST /api/office/bank/terugstorting
  'passkey-weg'                 // POST /api/webauthn/weg
]);

/* De binding die met de ceremonie meereist. Hij bevat de actienaam en de
   sessiesleutel, zodat een assertie niet van de ene sessie naar de andere te
   verplaatsen is. Het voorvoegsel draagt een versienummer: verandert de vorm
   ooit, dan verlopen oude ceremonies vanzelf in plaats van half te passen. */
const ZWAAR_BINDING = 'rtg-zwaar-v1';

module.exports = { PIN_ACTIES, ZWARE_ACTIES, ZWAAR_BINDING };
