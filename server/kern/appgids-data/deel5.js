/* App-gids data, deel5. Zie ../appgids.js voor de uitleg;
   nieuwe pagina's krijgen hier (of in het passende deel) een eigen entry. */
const G = (wat, doe, tip) => ({ wat, doe, tip });

module.exports = {
  '/apps/foundation/kantoor.html': G('Het RTF-kantoor: het eigen kantoor van de RTFoundation, gebouwd op dezelfde plattegrond als het RTG-kantoor.',
    ['Loop de kamers langs met hun cijfers en werklijsten', 'Zet taken per kamer en vink ze af', 'Zie de 30%-stroom, de clubs en het lab in een oogopslag'],
    'Dezelfde structuur als het RTG-kantoor: wie het ene huis kent, kan meteen in het andere werken.'),
  '/apps/foundation/clubswerk.html': G('Clubs & steden: de RTF-afdeling die met grote (sport)clubs in elke stad samenwerkt.',
    ['Meld een club aan en geef de clubcode door', 'Hang programma\'s en afspraken aan de samenwerking', 'Koppel RTF-teamleden en schrijf in het gedeelde log'],
    'Een club met een vast RTF-gezicht en een gedeeld logboek werkt sneller dan tien losse mailtjes.'),
  '/apps/foundation/club.html': G('Het clubportaal: uw club en de RTFoundation, samen op een scherm.',
    ['Meld aan met uw clubcode', 'Bekijk de programma\'s, afspraken en uw vaste RTF-team', 'Schrijf in het gedeelde samenwerkingslog'],
    'U ziet hier alleen het dossier van uw eigen club; zo hoort het.'),
  '/apps/lab.html': G('Het RTG Onderzoekslab: onderzoek en ontwikkeling voor RTG en de RTFoundation samen.',
    ['Start een project in een veld (hardware, software, dorpshulp, landbouw, meta-onderzoek)', 'Doorloop de vaste keten: idee, onderzoek, prototype, proef, uitrol', 'Laat een mens de veiligheids- en ethiektoets tekenen en bouw de kennisbank'],
    'Een kleine eerlijke proef verslaat een groot vaag plan; en de kennisbank vergeet nooit iets.'),
  '/apps/pakketten.html': G('RTG Bedrijfspakketten: kies je bedrijfstype en krijg de juiste indeling voor je eigen zaak.',
    ['Kies je type (tech, horeca, retail, hotel, zorg, creatief)', 'Zie de werkplekken, werk-apps en technieken die je nodig hebt, met een 3D-plattegrond en QR-codes', 'Vertel je situatie en laat Rahul het pakket op maat bijkleuren'],
    'Dit gaat over jouw zaak; hoe de RTG-kantoren zelf werken blijft bedrijfsgeheim.')
};
