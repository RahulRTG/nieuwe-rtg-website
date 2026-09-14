/* Functiecatalogus, deel "domeinen 5": de eigen ingangen van de RTFoundation.

   Zelfde bedoeling en zelfde regels als ./cat-domeinen.js -- zie de kop daar.

   WAAROM EEN VIJFDE BESTAND. ./cat-domeinen2.js draagt het RTFoundation-blok en
   zat op 9969 van de 10240 bytes van keuringsregel 13. Die grens staat er niet
   voor de sier: een bestand dat je niet meer in een keer kunt lezen, wordt ook
   niet meer in een keer nagekeken. Splitsen is hier dus de bedoelde uitweg en
   geen omweg -- deel 2, 3 en 4 bestaan om precies dezelfde reden.

   WAT HIER IN HOORT. Paden waarop de FOUNDATION zelf binnenkomt, en niet de
   leden-paden van een domein dat de foundation ook gebruikt. Dat onderscheid
   is de hele aanleiding van dit bestand, en het is gemeten (14 september 2026,
   DOELGROEPBEREIK.json): dom-onderwijs, dom-leerstof en ov-bijles verklaarden
   uitsluitend `foundation`, terwijl op /api/onderwijs, /api/leerstof en
   /api/bijles alleen LEDEN binnenkomen en een gezinssessie 401 krijgt. De
   foundation komt daar wel, maar langs een heel andere deur -- en die deur
   stond in geen enkele functie. */
const { DOELGROEPEN } = require('./doelgroepen');

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
    paden: ['/api/rtf/leerling'] }
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
