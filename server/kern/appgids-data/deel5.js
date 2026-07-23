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
  '/apps/foundation/magazine.html': G('Het RTFoundation-magazine: wat de foundation doet, waarom en hoe.',
    ['Lees hoe 30% van elke bijdrage naar goede doelen gaat', 'Zie de verdeling: 20% lokaal, 10% de foundation zelf', 'Volg de ingangen naar het Lab-fonds, de clubs en de gezinsapp'],
    'Empowering journeys, building futures: reizen die vooruit brengen, dichtbij en verder weg.'),
  '/apps/labfonds.html': G('Het Lab-fonds: leden zamelen samen in voor het RTF Onderzoekslab, per locatie verdeeld.',
    ['Zamel in voor de omgeving die jij kent; het geld gaat naar de pot van die plek', 'Doe een voorstel wat de pot in de omgeving kan betekenen', 'Beslis samen: de leden stemmen, de AI-scheidsrechter bewaakt de eerlijkheid'],
    'Het fonds is er voor de omgeving, nooit voor prive gewin; daarom kijkt een scheidsrechter mee en beslis je samen.'),
  '/apps/rtgcode.html': G('De RTG-code: een gesloten, levende code die alleen onze app maakt en leest, in RTG-stijl.',
    ['Toon je levende code; hij ververst zichzelf en vervalt binnen tientallen seconden', 'Kies het merkteken in het hart: de lippen of het horloge', 'Scan of plak een code; de app verifieert hem en weigert verlopen of vreemde codes'],
    'Geen gewone QR: alleen de RTG-app kan de code duiden, en een foto veroudert vanzelf.'),
  '/apps/pakketten.html': G('RTG Bedrijfspakketten: kies je bedrijfstype en krijg de juiste indeling voor je eigen zaak.',
    ['Kies je type (tech, horeca, retail, hotel, zorg, creatief)', 'Zie de werkplekken, werk-apps en technieken die je nodig hebt, met een 3D-plattegrond en QR-codes', 'Vertel je situatie en laat Rahul het pakket op maat bijkleuren'],
    'Dit gaat over jouw zaak; hoe de RTG-kantoren zelf werken blijft bedrijfsgeheim.')
};
