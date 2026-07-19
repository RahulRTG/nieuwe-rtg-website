/* Het afdelingsregister, deel 2 (kern/afdelingen): de negen jongere kamers van
   het RTG-kantoor. Opgeknipt in twee kamergroepen op dezelfde ctx en hier tot
   een vlak register aan elkaar gezet, net zoals de oorspronkelijke register2.js:
   - ./kantoorkamers : Support team, Ingenieurs, Consumenten- en Partner-
                       abonnementen, en de Kantine
   - ./ontwerpbureaus: RTG Atelier, Ontwerpstudio, Hardwarelab en Architectenbureau
   Kamers met naamInzage: true mogen via de identiteitskluis de echte naam bij
   een codenaam opvragen (elke opvraging komt in het auditlog). */
module.exports = (ctx) => Object.assign({},
  require('./kantoorkamers')(ctx),
  require('./ontwerpbureaus')(ctx));
