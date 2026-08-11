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

   Onderaan staan sindsdien ook geldbeleid en geldgraaf (GELD.md): de geldgraaf
   is de financiele evenknie van de levensgraaf en hoort bij deze motorlaag;
   kernlaag3.js zelf zat tegen de omvangregel aan. Zie het commentaar daar.

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
/* Geldbeleid (kern/geldbeleid/): het beleid van het LID over zijn eigen geld --
   regels, potten en het append-only actielog (GELD.md par. 3-5). Aan db/save
   zoals geldregie in kernlaag4, want dit is een schrijvende opslaglaag en geen
   projectie. Ze staan in DIT bestand omdat kernlaag3.js tegen de omvangregel
   aan zit, en bij de levensgraaf hierboven horen ze inhoudelijk thuis: de
   geldgraaf is daar de financiele evenknie van. VOOR de graaf gemount, want
   de graaf krijgt deze laag als argument mee -- een thunk zou die echte
   afhankelijkheid alleen maar verstoppen. */
Object.assign(kern, require('../kern/geldbeleid').maakGeldbeleid({ db, save }));
/* De geldgraaf (kern/geldgraaf/): de alleen-lezen projectielaag over de
   gelddomeinen, met de vooruitblik (GELD.md par. 1). Leest de kern LAAT zoals
   kern/geldwereld.js, zodat de mountvolgorde van de bronnen er niet toe doet;
   alleen het geldbeleid gaat expliciet mee, omdat het hierboven net is
   gemonteerd en de graaf er zichtbaar van afhangt (potten trekken van het
   vrij besteedbare af). */
Object.assign(kern, require('../kern/geldgraaf')({ kern, geldbeleid: kern.geldbeleid }));
/* De levenslijn (kern/levenslijn/): EEN lijn door een leven in plaats van vijf
   leeftijdshokjes (LEVEN.md par. 1.1). Hoort bij deze motorlaag om dezelfde
   reden als de geldgraaf: hij projecteert alleen-lezen over domeinen die de
   waarheid beheren, en hij leest de LEVENSGRAAF hierboven voor zijn termijnen.

   Leest de kern LAAT (in de functies), dus de mountvolgorde doet er niet toe;
   dat moet ook, want zijn bronnen wonen verspreid over kernlaag3 (rechterhand
   /entourage), kernlaag4 (metier) en server.js zelf (onderwijs, paspoort,
   rtf). SCHRIJFT NOOIT: deze laag opent, hij handelt niet. */
Object.assign(kern, require('../kern/levenslijn')({ kern }));
/* De levensbanden (kern/levensband/): rechten per relatie -- wie mag wat van
   wie zien (LEVEN.md par. 2.8, fase 2). Staat NA de levenslijn omdat hij bij
   dezelfde wereld hoort, maar hij hangt er niet van af: hij kent geen enkele
   bron en beheert alleen zijn eigen opslag.

   ALS ENIGE VAN DEZE DRIE SCHRIJFT HIJ WEL, en daarom krijgt hij db EN save
   mee waar de levenslijn en de geldgraaf alleen kern krijgen. Wat hij schrijft
   is geen levensgegeven maar een TOESTEMMING; het leven zelf blijft in de
   domeinen die het beheren. */
Object.assign(kern, require('../kern/levensband')({ db, save }));
};
