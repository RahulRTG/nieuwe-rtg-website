/* Het afdelingsregister, deel 2 (kern/afdelingen): de veertien jongere kamers van
   het RTG-kantoor. Opgeknipt in kamergroepen op dezelfde ctx en hier tot
   een vlak register aan elkaar gezet, net zoals de oorspronkelijke register2.js:
   - ./kantoorkamers : Support team, Ingenieurs, Consumenten- en Partner-
                       abonnementen, de Integratiekamer, het Controleregister en de Kantine
   - ./reisbalie     : het Reisbureau (de kamer die reisaanvragen bevestigt)
   - ./ontwerpbureaus: RTG Atelier, Ontwerpstudio, Hardwarelab en Architectenbureau
   Kamers met naamInzage: true mogen via de identiteitskluis de echte naam bij
   een codenaam opvragen (elke opvraging komt in het auditlog). */
module.exports = (ctx) => Object.assign({},
  require('./kantoorkamers')(ctx),
  require('./reisbalie')(ctx),
  require('./ontwerpbureaus')(ctx),
  // de staatskamers: het Regeringskantoor en Opvang & migratie (AZC/COA)
  require('./staatskamers')(ctx));
