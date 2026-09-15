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
      includes: ['Vlucht & transfers', 'Chalet, 3 nachten', 'Skipas & privélift', 'Diner in de bergen']
    },
    {
      id: 'monaco-glamour', dest: 'Monaco', visual: 'v-monaco',
      title: 'Monaco, haven & glamour', dates: '4 dagen · doorlopend', netto: 1950,
      desc: 'Suite met zicht op de jachthaven, een avond in het casino en een tafel langs het circuit, ingekocht zoals wij dat voor leden doen.',
      includes: ['Vlucht & privétransfers', 'Suite met havenzicht, 3 nachten', 'Avond in het casino', 'Tafel langs het circuit']
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
