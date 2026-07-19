/* Ervaring-deel "leden" (kern/ervaring/leden): alles wat het lid zelf met een
   afgeronde of lopende transactie doet. Opgeknipt in drie deelbestanden op
   dezelfde gedeelde ctx:
   - ./annuleren : annuleren (order/rit/boeking) en de wachtlijst (een
                   vrijgekomen plek meldt zich meteen bij de eerste in de rij)
   - ./waardering: reviews (met de zaakreactie), favorieten en de fooi-helper
   - ./spaarpot  : de reisagenda, rekening splitsen, RTG-punten en de
                   meldingsvoorkeuren
   Dit is de orkestrator; hij rijgt de drie tot een vlak object aan elkaar, net
   zoals de oorspronkelijke leden.js dat exporteerde. */
module.exports = (ctx) => Object.assign({},
  require('./annuleren')(ctx),
  require('./waardering')(ctx),
  require('./spaarpot')(ctx));
