/* Leren-overhoren (kern/leren): woordenlijsten en de duelsessies met vrienden.
   Opgeknipt in twee deelbestanden op dezelfde ctx en hier tot een vlak geheel
   aan elkaar gezet, zoals de oorspronkelijke overhoren.js exporteerde:
   - ./lijsten: de woordenlijsten (maken, AI-lijst, overhoren, beste score)
   - ./duel   : samen leren, het overhoorduel (uitnodigen, antwoorden, beurten)
   Krijgt de gedeelde context een keer bij het opstarten vanuit kern/leren.js. */
module.exports = (ctx) => Object.assign({},
  require('./lijsten')(ctx),
  require('./duel')(ctx));
