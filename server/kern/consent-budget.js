/* HET CONSENT CENTER, lezer voor de budgettoets (kern/geldbeleid/budgettoets.js,
   besluit B2 van 11 oktober 2026). Een eigen bestand omdat ./consent-lezers.js
   op de 10 kB-grens zat; het is dezelfde lezer in dezelfde rijvorm
   ({ laag, id, wie, partij, wat, tot, richting, intrekbaar }), en een storing
   meldt zich langs dezelfde `pak` als bij de andere negen lagen.

   Het geldbeleid draait op de CODENAAM en niet op de sessiesleutel; die
   vertaling gebeurt hier, een keer. Alleen een LOPENDE toestemming komt op de
   lijst: een verlopen of ingetrokken toestemming staat niets meer toe. */
'use strict';

module.exports = ({ kern, key, pak }) => {
  const gb = kern.geldbeleid;
  const lijst = pak('Budgettoets', gb && gb.budgettoetsen && typeof kern.codenaamVan === 'function'
    && (() => gb.budgettoetsen(kern.codenaamVan(key))));
  return (lijst || []).filter(t => t.stand === 'actief').map(t => ({
    laag: 'budgettoets', id: t.id, wie: 'Rahul', partij: 'rtg',
    wat: 'Mag zeggen of een voorstel aan u past binnen pot ' + (t.pot || '(weg)') +
      '; alleen u ziet de uitkomst, en nooit een bedrag',
    tot: t.tot, richting: 'ziet', intrekbaar: true }));
};
