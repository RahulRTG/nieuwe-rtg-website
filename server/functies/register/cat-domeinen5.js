/* Functiecatalogus, deel "domeinen 5": de eigen ingangen van de RTFoundation.

   Zelfde bedoeling en zelfde regels als ./cat-domeinen.js -- zie de kop daar.

   WAAROM EEN VIJFDE BESTAND. ./cat-domeinen2.js draagt het RTFoundation-blok en
   zat op 9969 van de 10240 bytes van keuringsregel 13. Die grens staat er niet
   voor de sier: een bestand dat je niet meer in een keer kunt lezen, wordt ook
   niet meer in een keer nagekeken. Splitsen is hier dus de bedoelde uitweg en
   geen omweg -- deel 2, 3 en 4 bestaan om precies dezelfde reden.

   WAT HIER IN HOORT: het RTFoundation-blok dat niet meer in deel 2 paste, en
   dat is geen toeval -- het zijn de functies waar de gezinsdeur bij is gekomen.
   De aanleiding is gemeten (14 september 2026, DOELGROEPBEREIK.json) en niet
   vermoed: vijf functies verklaarden uitsluitend `foundation`, terwijl op hun
   paden alleen LEDEN binnenkwamen en een gezinssessie 401 kreeg.

   EN ER LOPEN TWEE ANTWOORDEN DOOR ELKAAR, dus ze staan hier uit elkaar:

   - dom-labfonds en dom-samen krijgen er een DEUR bij, in hetzelfde
     routebestand en met dezelfde afhandeling. Twee paden, EEN functie: het
     bord zou anders de ene helft van dezelfde dienst kunnen sluiten en de
     andere niet (de `social`-fout).
   - rtf-leerpaspoort is juist een EIGEN functie, want daar bestond de deur al
     en hij heeft een andere POORT dan de ledenkant. Zie de noot erbij. */
const { DOELGROEPEN, LEDEN } = require('./doelgroepen');

module.exports = [
  /* DE LEERLINGKANT VAN HET ONDERWIJS. routes/rtfleerling.js: achttien routes
     op een EIGEN poort, en die poort is strenger dan een gezinssessie -- hij
     eist een bevestigde geboortedatum en een leerlingprofiel, en versmalt
     daarna de ladder en de leerdoelen op leeftijd (trappen/faseMag/doelMag).

     DAAROM IS HET EEN EIGEN FUNCTIE EN GEEN PAD ERBIJ. Wie /api/rtf/leerling
     onder dom-onderwijs zou hangen, zet EEN schakelaar op twee deuren met
     verschillende poorten: het bord kan dan de leerlingkant niet sluiten
     zonder de ledenkant, en andersom ook niet. En wie er een tweede,
     losse gezinsdeur naast zou bouwen, komt langs de leeftijdspoort heen --
     precies wat die poort moet tegenhouden.

     De bijles-, examen- en adviesroutes van de leerling staan hier bewust ook
     onder: ze hangen alle drie aan dezelfde poort in hetzelfde bestand, en
     een halve dienst schakelen helpt niemand (zie de kop van ./cat-domeinen4.js). */
  { id: 'rtf-leerpaspoort', categorie: 'RTFoundation', naam: 'Leerpaspoort (leerling)', standaard: true,
    doelgroepen: ['foundation'],
    uitleg: 'De leerlingkant van onderwijs, leerstof, examen en bijles, achter de leeftijdspas.',
    paden: ['/api/rtf/leerling'] },

  /* HET LABFONDS, met een gezinsdeur erbij (routes/labfonds.js). `intern` staat
     erbij omdat het kantoor gemeten binnenkomt op /api/labfonds/boardroom, en
     `gast` omdat een gratis app-sessie het overzicht opent -- geen van beide
     stond verklaard. Toezeggen, voorstellen, stemmen en beslissen eist aan de
     gezinsdeur een volwassen profiel; kijken mag het hele gezin. */
  { id: 'dom-labfonds', categorie: 'RTFoundation', naam: 'Het labfonds', standaard: true,
    doelgroepen: ['rtg', 'lifestyle', 'business', 'gast', 'foundation', 'intern'],
    uitleg: 'De financiering van onderzoeksprojecten.',
    paden: ['/api/labfonds', '/api/rtf/labfonds'] },

  /* SAMEN VOOR LEDEN. Geen `gast` en geen `foundation`: een gratis app-sessie
     wordt aan deze deur met zoveel woorden geweigerd ("Samen-sessies zijn voor
     leden"), en de gezinskant is een EIGEN dienst -- zie hieronder. */
  { id: 'dom-samen', categorie: 'RTFoundation', naam: 'Samen (stadsraad)', standaard: true,
    doelgroepen: LEDEN,
    uitleg: 'De gezamenlijke uitslagen en besluiten met stadspartners.',
    paden: ['/api/samen'] },

  /* SAMEN VOOR EEN GEZIN -- acht routes die AL BESTONDEN (routes/rtfschool.js op
     kern/samenrtf.js) en die door geen enkele functie werden genoemd. Ze vielen
     daardoor onder het vangnetpad `/api/rtf` van rtf-contacten, en dat is de
     `social`-fout: het bord zette dan de ene helft van die functie uit en de
     andere niet.

     EN HET IS EEN EIGEN FUNCTIE, geen pad bij dom-samen. Anders dan bij het
     labfonds is dit een ANDERE dienst met een eigen kern (samenrtf.js), een
     eigen kamermodel, een eigen duurzame herhaalbinding en een eigen poort. Een
     schakelaar over allebei zou de huiskamer van een gezin sluiten omdat de
     ledenkant dicht moet, of andersom. */
  { id: 'rtf-samen', categorie: 'RTFoundation', naam: 'Samen (gezin)', standaard: true,
    doelgroepen: ['foundation'],
    uitleg: 'De gedeelde kamer van een gezin: plek, chat en muziek achter de gezinsdeur.',
    paden: ['/api/rtf/samen'] }
];

/* De lijst hierboven gebruikt DOELGROEPEN niet, maar de zeef eronder wel: hij
   houdt vast dat elke doelgroep die hier wordt verklaard ook werkelijk bestaat.
   Zonder die controle is een typefout in een doelgroepnaam een functie die
   niemand kan bereiken en die nergens over klaagt. */
for (const f of module.exports) {
  for (const dg of f.doelgroepen) {
    if (!DOELGROEPEN.some(d => d.id === dg)) {
      throw new Error('cat-domeinen5: onbekende doelgroep "' + dg + '" op ' + f.id);
    }
  }
}
