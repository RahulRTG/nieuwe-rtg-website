/* DE KERN SAMENSTELLEN -- deel 3b van 7.

   Afgesplitst van ./kernlaag3.js toen die in de waarschuwingsband onder de tien
   kilobyte kwam, en de knip loopt langs een echte grens: deze drie modules zijn
   EEN keten en horen daarom bij elkaar te staan.

     levensgraaf   de motor: alles met een datum, in vier vensters. Voor ELKE
                   pas, ook de gratis -- en sinds bronnen-zaak.js ook voor een
                   RTG-kantoor op zijn eigen code.
     bureau        Het Privekantoor: wat de Lifestyle Pass met die motor DOET
                   (mandaat, zaken, orkestratie, de twintig kamers).
     postdatum     de datums die per post binnenkomen, als voorstel. Voedt de
                   tower langs de AGENDA en niet als eigen opslag: een
                   aangenomen voorstel is een gewone afspraak.

   DE VOLGORDE IS GEDRAG. `bureau` krijgt de levensgraaf mee en bouwt hem niet
   zelf, dus die staat ervoor. Allebei staan ze NA kern/lifestyle en
   kern/rechterhand uit kernlaag3: de graaf projecteert op hun dossiers, en
   `bezitZet` komt daarvandaan.

   Gemount vanuit server.js, direct na ./kernlaag3.js. */
'use strict';

module.exports = (kern, hulp) => {
  const { DATA_DIR, anthropic, crypto, db, liveCodename, notify, rtmail, save } = hulp;

/* Het Privékantoor: de ENE app die de veertien premium-apps aan elkaar knoopt.
   Life Graph, Control Tower, delegatie en zaken. Staat NA de twee hierboven
   omdat hij op hun dossiers projecteert; hij schrijft er niets in terug. */
// De levensgraaf: de motor onder het Privekantoor, maar voor ELKE pas. Staat
// vóór kern/bureau, dat hem gebruikt; paspoortVervalt als thunk (andere laag).
Object.assign(kern, require('../kern/levensgraaf')({ db,
  paspoortVervalt: (key) => (kern.paspoortVervaldatumVan ? kern.paspoortVervaldatumVan(key) : null) }));
// bezitZet komt uit de lifestyle-mount hierboven: een geregelde inkoopzaak
// schrijft zichzelf in het register. Vandaar NA die twee.

Object.assign(kern, require('../kern/bureau')({ db, save, crypto, anthropic, liveCodename, notify,
  bezitZet: kern.bezitZet, levensgraaf: kern.levensgraaf }));
/* Postdatums (kern/postdatum.js): de datums die in de EIGEN post staan, als
   voorstel. Staat hier omdat hij de tower voedt langs de agenda -- niet als
   eigen opslag. Een aangenomen voorstel is een gewone afspraak. */
Object.assign(kern, { postdatum: require('../kern/postdatum')({ db, save, rtmail, agenda: kern.agenda }) });
};
