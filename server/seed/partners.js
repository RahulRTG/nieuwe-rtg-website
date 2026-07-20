/* Startdata, deel "partners": het partnerkanaal (boeken zonder pas) met demo-
   partners en -reizen, plus de lege grootboeken (fonds, munten), de bookings en
   de wereldtalen-stand. Afgesplitst uit seed.js; puur data. */
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
      includes: ['Vlucht of privéjet vanaf Schiphol', 'Aguamarina Ibiza, 3 nachten', 'Villa Bahia Ibiza, 4 nachten', 'Privéboot & transfers']
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
  // Wereldtalen: welke talen staan aan (Boardroom-schakelaars; server/talen.js).
  // Nederlands en Engels zijn de basis en staan altijd aan.
  talen: { actief: ['nl', 'en'] }
};
