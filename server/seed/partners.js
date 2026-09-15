/* Startdata, deel "partners": het partnerkanaal (boeken zonder pas) met demo-
   partners en -reizen, plus de lege grootboeken (fonds, munten), de bookings en
   de wereldtalen-stand. Afgesplitst uit seed.js; puur data. */
const { STANDAARD, STANDAARD_VERSIE } = require('../talen');

module.exports = {
  /* ---------- partnerkanaal (boeken zonder pas) ----------
     Niet-leden boeken via een partnerlink (boeken.html?via=CODE).
     Prijs = nettoprijs + service; de service wordt gedeeld tussen
     de partner (share van de service) en RTG. */
  partnerService: 0, // RTG rekent niets over boekingen; leden boeken tegen nettoprijs
  /* share = het deel van de service voor de partner, INTERN, wordt nooit
     aan de klant getoond. Bedrijfspartners kunnen een personeelskanaal
     hebben: eigen code, lager servicetarief (arbeidsvoorwaarde). */
  partners: [
    { code: 'NOVA',  name: 'Nova van Dijk',          type: 'influencer', handle: '@novatravels · 380k volgers', share: 0.40 },
    { code: 'ATLAS', name: 'Atlas Executive Travel', type: 'bedrijf',    handle: 'zakelijk reisbureau, Amsterdam', share: 0.35 }
  ],
  partnerTrips: [
    {
      id: 'ibiza-jetset', dest: 'Ibiza', visual: 'v-ibiza',
      title: 'Ibiza, jetset-week', dates: '7 dagen · zomer 2026', netto: 2200,
      desc: 'Vanaf Schiphol naar het eiland: deels hotel aan zee, deels een villa met eigen zwembad, boot naar Formentera en diners bij de beste adressen.',
      includes: ['Vlucht of privéjet vanaf Schiphol', 'Aguamarina Ibiza, 3 nachten', 'Villa Bahia Ibiza, 4 nachten', 'Privéboot & transfers'],
      /* DE SAMENSTELLING: waar de EUR 2.200 uit bestaat, per persoon en in
         CENTEN (kern/reisbureau-samenstelling.js). `includes` hierboven blijft
         staan en is marketingtekst; dit is wat het systeem WEET.

         MET OPZET MAAR OP EEN VAN DE DRIE REIZEN. De andere twee leveren
         `bekend: false` met de reden erbij, en dat is precies wat er te zien
         moet zijn: de doorbelastingsmeter hoort het verschil tussen een reis die
         te volgen is en een reis die dat niet is te TONEN in plaats van hem glad
         te strijken. Een zaaiset waarin alles klopt, meet de enige vraag niet
         die ertoe doet.

         De som is exact 220000 -- de laag schaalt niets bij en weigert een
         samenstelling die niet sluit. Geen echte lucht- of hotelmerken als
         bevestigde partner (CLAUDE.md): de vlucht draagt geen maatschappij. */
      samenstelling: [
        { soort: 'vervoer', herkomst: 'partner', eigenaar: 'derde', ppCenten: 52000,
          wat: 'Vlucht of privéjet vanaf Schiphol', leverancier: 'charter-ams' },
        { soort: 'verblijf', herkomst: 'partner', eigenaar: 'derde', ppCenten: 61000,
          wat: 'Aguamarina Ibiza, 3 nachten', leverancier: 'aguamarina-ibiza' },
        { soort: 'verblijf', herkomst: 'partner', eigenaar: 'derde', ppCenten: 58000,
          wat: 'Villa Bahia Ibiza, 4 nachten', leverancier: 'villa-bahia-ibiza' },
        { soort: 'activiteit', herkomst: 'partner', eigenaar: 'derde', ppCenten: 21000,
          wat: 'Privéboot en transfers', leverancier: 'formentera-boats' },
        { soort: 'dienst', herkomst: 'rtg', eigenaar: 'rtg', ppCenten: 24000,
          wat: 'Samenstellen en begeleiden door het RTG-reisbureau', leverancier: null },
        { soort: 'heffing', herkomst: 'extern', eigenaar: 'overheid', ppCenten: 4000,
          wat: 'Lokale verblijfsbelasting', leverancier: null }
      ]
    },
    {
      id: 'gstaad-alpien', dest: 'Gstaad', visual: 'v-gstaad',
      title: 'Gstaad, alpien weekend', dates: '4 dagen · doorlopend', netto: 1680,
      desc: 'Een chalet met open haard, privélift de piste op en diners in de bergen, hetzelfde adres waar onze leden over posten in De Salon.',
      includes: ['Vlucht & transfers', 'Chalet, 3 nachten', 'Skipas & privélift', 'Diner in de bergen'],
      /* REIS 2 -- DE GEMENGDE VORM, en met opzet de SPIEGEL van Ibiza. Daar is
         RTG's eigen aandeel 11% van de reissom; hier 32%, want een alpien
         weekend is voor een groot deel samenstellen, onderhandelen en een gastheer
         ter plaatse. Dat is de reden dat deze reis erbij komt: de doorbelasting
         beweegt van dominant naar ondergeschikt, en de bijdragebasis andersom.
         Twee reizen met dezelfde verhouding zouden dezelfde eigenschap twee keer
         toetsen. Som exact 168000. */
      samenstelling: [
        { soort: 'dienst', herkomst: 'rtg', eigenaar: 'rtg', ppCenten: 54000,
          wat: 'Samenstellen, onderhandelen en een gastheer ter plaatse', leverancier: null },
        { soort: 'verblijf', herkomst: 'partner', eigenaar: 'derde', ppCenten: 78000,
          wat: 'Chalet, 3 nachten', leverancier: 'chalet-gstaad' },
        { soort: 'vervoer', herkomst: 'partner', eigenaar: 'derde', ppCenten: 24000,
          wat: 'Vlucht en transfers', leverancier: 'alpen-transfer' },
        { soort: 'activiteit', herkomst: 'partner', eigenaar: 'derde', ppCenten: 8000,
          wat: 'Skipas en privélift', leverancier: 'bergbaan-gstaad' },
        { soort: 'heffing', herkomst: 'extern', eigenaar: 'overheid', ppCenten: 4000,
          wat: 'Kurtaxe', leverancier: null }
      ]
    },
    {
      id: 'monaco-glamour', dest: 'Monaco', visual: 'v-monaco',
      title: 'Monaco, haven & glamour', dates: '4 dagen · doorlopend', netto: 1950,
      desc: 'Suite met zicht op de jachthaven, een avond in het casino en een tafel langs het circuit, ingekocht zoals wij dat voor leden doen.',
      includes: ['Vlucht & privétransfers', 'Suite met havenzicht, 3 nachten', 'Avond in het casino', 'Tafel langs het circuit'],
      /* REIS 3 -- DE VERSTOORDE VORM. De samenstelling zelf is gewoon; wat deze
         reis toevoegt is de weg TERUG (kern/reisbureau-terugboeking.js): wat
         gebeurt er met de doorbelasting en de bijdragebasis als een betaalde reis
         geheel of deels wordt teruggedraaid? Twee onderdelen van dezelfde soort
         (`activiteit`) staan er met opzet in, zodat een gedeeltelijke terugboeking
         er EEN van kan raken en de andere niet. Som exact 195000. */
      samenstelling: [
        { soort: 'verblijf', herkomst: 'partner', eigenaar: 'derde', ppCenten: 96000,
          wat: 'Suite met havenzicht, 3 nachten', leverancier: 'haven-suites' },
        { soort: 'vervoer', herkomst: 'partner', eigenaar: 'derde', ppCenten: 42000,
          wat: 'Vlucht en privétransfers', leverancier: 'riviera-transfer' },
        { soort: 'activiteit', herkomst: 'partner', eigenaar: 'derde', ppCenten: 18000,
          wat: 'Avond in het casino', leverancier: 'cercle-monaco' },
        { soort: 'activiteit', herkomst: 'partner', eigenaar: 'derde', ppCenten: 24000,
          wat: 'Tafel langs het circuit', leverancier: 'circuit-tribune' },
        { soort: 'dienst', herkomst: 'rtg', eigenaar: 'rtg', ppCenten: 12000,
          wat: 'Samenstellen en begeleiden door het RTG-reisbureau', leverancier: null },
        { soort: 'heffing', herkomst: 'extern', eigenaar: 'overheid', ppCenten: 3000,
          wat: 'Lokale heffing', leverancier: null }
      ]
    },
    /* REIS 4 -- DE REIS DIE (NOG) NIET IS UITGESPLITST, en die staat er met
       opzet. Toen reis 1 t/m 3 een samenstelling kregen, verloren twee toetsen
       hun ONDERWERP: "een reis zonder samenstelling wordt geweigerd" en
       "onbekend is geen lege lijst" hadden niets meer om op te slaan. Een toets
       zonder onderwerp is groen om de verkeerde reden.

       Een vierde reis toevoegen is bovendien eerlijker dan de andere drie half
       laten: een echte catalogus HEEFT reizen die nog niet zijn uitgesplitst, en
       de weigering die daarbij hoort moet in de zaaiwereld zichtbaar blijven.
       Wie deze reis ooit uitsplitst, hoort er een andere onuitgesplitste voor
       terug te zetten -- anders verdwijnt de weigerweg stilletjes uit de proef. */
    {
      id: 'lissabon-nieuw', dest: 'Lissabon', visual: 'v-lissabon',
      title: 'Lissabon, nieuw in de catalogus', dates: '4 dagen · najaar 2026', netto: 1150,
      desc: 'Pas opgenomen: een stadsverblijf met tafels waar onze leden over posten. De inkoop is nog niet per onderdeel vastgelegd.',
      includes: ['Vlucht & transfers', 'Stadsverblijf, 3 nachten', 'Tafels en tips']
    }
  ],
  bookings: [],
  // Grootboek van de 30%-afdrachten aan de RTFoundation (kern/fonds.js boekt
  // hier per bevestigde maandbetaling; leeg tot de eerste betaling).
  fondsAfdrachten: [],
  // Grootboek van munt-ontvangsten (kern/munten.js; crypto meteen omgezet naar
  // euro via een vergunninghoudende aanbieder). Leeg tot de eerste ontvangst.
  muntOntvangsten: [],
  // Alle 114 talen staan standaard aan. De Boardroom kan niet-benodigde talen
  // bewust uitzetten; Nederlands en Engels blijven de niet-uitschakelbare basis.
  talen: { actief: STANDAARD.slice(), standaardVersie: STANDAARD_VERSIE }
};
