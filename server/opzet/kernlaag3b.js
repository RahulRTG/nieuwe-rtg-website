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
/* DE EIGEN GELDGRENS AANSLUITEN OP DE BETAALWEG. Zonder deze regel bestaat
   `grensVoor` wel en vraagt niemand hem, en dan is een grens die het lid stelt
   een instelling die nergens bijt -- precies de fout die het besluit
   WALLET_SALDO maakte met zijn plafond (zie WAARDE.md par. 3). Late binding,
   want geldbeleid wordt na pay gemount en pay hoeft niets van geldbeleid te
   weten om te bestaan. */
if (kern.pay && kern.pay.koppelGrens) kern.pay.koppelGrens(kern.geldbeleid.grensVoor);
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
/* Het levensbeleid (kern/levensbeleid/): de regels van de mens zelf -- de
   tweede laag van het wereldpatroon voor RTFoundation (LEVEN.md par. 3).

   VOOR levensband gemount, want ./delen.js raadpleegt hem. Net als bij RTG
   Sociaal kan dit beleid alleen VERSMALLEN: een stuk op nooit-delen zetten, of
   een kortere standaardtermijn voorstellen. Er is geen veld dat vooraf deelt --
   dat zou besluit 2 uit LEVEN.md par. 2.8 door de achterdeur ongedaan maken.

   De stukkenlijst komt uit levensband/delen.js zelf en wordt niet overgetikt. */
Object.assign(kern, require('../kern/levensbeleid')({ db, save,
  stukken: Object.keys(require('../kern/levensband/delen')({
    pak: () => ({ delingen: [] }), kijk: () => ({ delingen: [] }), save: () => {}
  }).deelStukken()) }));
Object.assign(kern, require('../kern/levensband')({ db, save, beleid: kern.levensbeleid }));
/* De sociale graaf (kern/socialegraaf/): dezelfde projectielaag over de sociale
   domeinen -- wat er tussen mensen speelt, en wat eraan komt (LIFE.md fase 1).

   ACHTERAAN, EN DAT IS GEEN WILLEKEUR. Hij leest de kern LAAT zoals de geldgraaf,
   dus de negen sociale domeinen mogen na hem komen. Wat NIET later mag komen is
   de levensgraaf: zijn vooruitblik vraagt de Control Tower daar de termijnen van
   Entourage en Attenties, in plaats van die datums zelf nog een keer uit te
   rekenen. Twee berekeningen van "over hoeveel dagen" lopen stil uiteen, en dan
   toont het ene scherm zeven dagen waar het andere er zes zegt (LAT.md regel 4).

   SCHRIJFT NOOIT, en heeft geen eigen opslag: krijgt daarom alleen kern mee, en
   met opzet geen db en geen save. */
Object.assign(kern, require('../kern/socialegraaf')({ kern }));
/* De objectlaag (kern/objectlaag/): niet apps maar objecten -- wat kan ik met
   deze persoon, deze groep, deze bijeenkomst (LIFE.md fase 2).

   Leest de kern LAAT, net als de twee lagen hierboven, dus de mountvolgorde van
   genootschap, comm, vonk, wbw en de rest doet er niet toe. SCHRIJFT NOOIT en
   heeft geen opslag: krijgt daarom alleen kern mee. Elke cap wijst naar de app
   die het echte werk doet; deze laag handelt zelf niets af. */
Object.assign(kern, require('../kern/objectlaag')({ kern }));
/* Life Command (kern/socialecommand/): de vijfde laag van deze wereld, en de
   eerste die iets MAG (LIFE.md fase 5). Staat NA de sociale graaf, want hij
   leest diens beeld en diens lijn.

   ALS ENIGE VAN DE VIJF SCHRIJFT HIJ, en daarom krijgt hij db EN save mee waar
   de graaf en de objectlaag alleen kern krijgen. Wat hij schrijft is geen
   sociaal gegeven maar het ACTIELOG: wat er gebeurde en waarom. Uitvoeren doet
   hij nooit zelf -- dat gaat via het domein dat de waarheid beheert. */
/* Het sociale beleid (kern/socialebeleid/): de regels van het LID over zijn
   eigen sociale wereld -- de tweede laag van het wereldpatroon.

   VOOR socialecommand gemount, want de voorstellen raadplegen hem. Hij krijgt de
   soortenlijst mee uit ./socialecommand/voorstellen.js in plaats van hem over te
   tikken: twee lijsten van wat een voorstel kan zijn, lopen uiteen zodra iemand
   er een toevoegt.

   Hij SCHRIJFT, en daarom db en save -- maar alleen de eigen regels van het lid,
   en die kunnen uitsluitend VERSMALLEN. Er is met opzet geen niveau-veld zoals
   bij geldbeleid: de grens van deze wereld is een ander mens, en die kent geen
   automatische stand. */
Object.assign(kern, require('../kern/socialebeleid')({ db, save,
  soorten: Object.keys(require('../kern/socialecommand/voorstellen')({ kern: {} }).SOORTEN) }));
Object.assign(kern, require('../kern/socialecommand')({ kern, db, save }));
};
