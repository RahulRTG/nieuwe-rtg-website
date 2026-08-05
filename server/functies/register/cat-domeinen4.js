/* Functiecatalogus, deel "domeinen 4": boeken, geld en de laatste losse
   diensten.

   Zelfde bedoeling en zelfde regels als ./cat-domeinen.js -- zie de kop daar.
   Dit is het sluitstuk: hiermee staat elke API-route van het platform onder
   een schakelaar, op de bestuurslaag na (het techniekbord, de kast zelf, de
   gezondheidschecks, de monitoring, de clusterlaag en de AVG-rechten). Die
   staan met reden buiten en die redenen zijn opgeschreven in
   scripts/schakelbaar.js.

   MEERDERE PADEN PER FUNCTIE, EN DAT IS EXPRES. Een reis boeken raakt
   /api/book, /api/booking, /api/bookings, /api/hotels en /api/partnertrips.
   Dat zijn vijf paden en EEN dienst; wie ze los zou schakelen kan een halve
   dienst overhouden, en daar heeft niemand iets aan. */
const { DOELGROEPEN, LEDEN, LEDEN_RTF } = require('./doelgroepen');
const ALLE = DOELGROEPEN.map(d => d.id).filter(d => d !== 'intern');
const LEDEN_GAST = ['rtg', 'lifestyle', 'business', 'gast'];

module.exports = [
  // ---------- boeken, reizen en verblijf ----------
  { id: 'bk-reizen', categorie: 'Diensten (leden)', naam: 'Reizen boeken', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'Het boeken zelf: aanbod, slots, betalen en de eigen boekingen, inclusief het partnerkanaal voor niet-leden.', paden: ['/api/book', '/api/booking', '/api/bookings', '/api/hotels', '/api/partnertrips'] },
  { id: 'bk-verblijf', categorie: 'Diensten (leden)', naam: 'Verblijf en reserveringen', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Verblijf, de deur van een kamer, reserveren en het annuleren daarvan.', paden: ['/api/verblijf', '/api/reserveer', '/api/reservering', '/api/reserveringen', '/api/annuleer'] },
  { id: 'bk-reiswijzer', categorie: 'Diensten (leden)', naam: 'Reiswijzer en landeninfo', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'De wijzer met landen, regels en wat je moet weten voor je gaat.', paden: ['/api/reis'] },
  { id: 'bk-ritten', categorie: 'Diensten (leden)', naam: 'Ritten en transfers', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Een rit aanvragen en betalen, en de transfer die bij een ticket hoort.', paden: ['/api/ride', '/api/transfer'] },
  { id: 'bk-tickets', categorie: 'Diensten (leden)', naam: 'Tickets en evenementen', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Kaarten kopen, uitgaan, aanmelden voor een evenement en de wachtlijst.', paden: ['/api/ticket', '/api/event', '/api/uitgaan', '/api/wachtlijst'] },
  { id: 'bk-bezorgen', categorie: 'Diensten (leden)', naam: 'Bezorgen en vracht', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Bezorging van mode en goederen, pakketten en het volgen van vracht.', paden: ['/api/mode', '/api/pakket', '/api/pakketten', '/api/vracht'] },
  { id: 'bk-eten', categorie: 'Diensten (leden)', naam: 'Foodcourt', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'Het foodcourt met de vrije tijdsloten van de zaken.', paden: ['/api/foodcourt'] },

  // ---------- geld ----------
  { id: 'gld-munt', categorie: 'Geld', naam: 'Betalen en betaalverzoeken', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'Rechtstreeks betalen aan een partner, betaalverzoeken en de betaalopties.', paden: ['/api/munt'] },
  { id: 'gld-rekening', categorie: 'Geld', naam: 'Rekening en facturen', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De openstaande rekening, het afrekenen daarvan en losse facturen.', paden: ['/api/rekening', '/api/factuur'] },
  { id: 'gld-splitsen', categorie: 'Geld', naam: 'Rekening splitsen', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Een rekening samen delen en ieders deel betalen.', paden: ['/api/splits', '/api/splitsen'] },
  { id: 'gld-cadeau', categorie: 'Geld', naam: 'Cadeaukaarten', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Cadeaukaarten kopen en de eigen kaarten bekijken.', paden: ['/api/giftcard', '/api/giftcards'] },
  { id: 'gld-punten', categorie: 'Geld', naam: 'Punten en verzilveren', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Gespaarde punten en het verzilveren daarvan.', paden: ['/api/punten'] },
  { id: 'gld-prijzen', categorie: 'Geld', naam: 'Pasprijzen en balans', standaard: true, doelgroepen: ALLE,
    uitleg: 'De publieke prijslijst van de passen en het balansoverzicht van een lid.', paden: ['/api/pasprijzen', '/api/balans'] },

  // ---------- de rest, met naam ----------
  { id: 'ov-stad', categorie: 'Diensten (leden)', naam: 'Stad en zaakdoos', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De stadslaag met bewoners, en de hartslag en metingen van een zaakdoos ter plaatse.', paden: ['/api/stad'] },
  { id: 'ov-suppliers', categorie: 'Diensten (leden)', naam: 'Partneroverzicht', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'De lijst met aangesloten partners die een lid kan zien.', paden: ['/api/suppliers'] },
  { id: 'ov-media', categorie: 'Winkel en media', naam: 'Media uitleveren', standaard: true, doelgroepen: ALLE,
    uitleg: 'Het uitleveren van geuploade afbeeldingen en bestanden aan de app.', paden: ['/api/assets'] },
  { id: 'ov-krant', categorie: 'Cultuur en gezelschap', naam: 'De krant', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'De openbare krant: de gids, een uitgave openen en een artikel lezen.', paden: ['/api/krant'] },
  { id: 'ov-browser', categorie: 'Winkel en media', naam: 'Browser', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De ingebouwde browser met zijn gids.', paden: ['/api/browser'] },
  { id: 'ov-zorgprofiel', categorie: 'Diensten (leden)', naam: 'Zorgprofiel', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Het zorgprofiel van een lid: allergieen en wat een zaak moet weten.', paden: ['/api/zorgprofiel'] },
  { id: 'ov-aandacht', categorie: 'Diensten (leden)', naam: 'Aandacht en voorspellen', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De aandachtslaag en de vooruitblik op wat een lid waarschijnlijk nodig heeft.', paden: ['/api/aandacht', '/api/voorspel'] },
  { id: 'ov-spar', categorie: 'Diensten (leden)', naam: 'Sparren en parkeren', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De sparlijst: iets parkeren om er later op terug te komen.', paden: ['/api/spar'] },
  { id: 'ov-bijles', categorie: 'RTFoundation', naam: 'Bijles', standaard: true, doelgroepen: ['foundation'],
    uitleg: 'Het bijlesgesprek met de begeleider.', paden: ['/api/bijles'] },
  { id: 'ov-kantoorgesprek', categorie: 'Werk (zaken en personeel)', naam: 'Kantoorgesprek', standaard: true, doelgroepen: ['leverancier', 'personeel'],
    uitleg: 'Het gesprek waarmee een zaak zijn kantoor inricht.', paden: ['/api/kantoor'] },
  { id: 'ov-werkmail', categorie: 'Werk (zaken en personeel)', naam: 'Werkmail bezorgen', standaard: true, doelgroepen: ['leverancier', 'personeel'],
    uitleg: 'De bezorging van interne werkmail.', paden: ['/api/werkmail'] },
  /* De buitenpoort van RTG Mail. Deze hoort NAAR ZIJN AARD in de kast: hij is
     publiek (een vreemde mailserver heeft geen inlog bij ons), en als er ooit
     iets misgaat -- een stroom rommel, een lek in de ontleding -- moet hij
     vanuit de boardroom dicht kunnen zonder dat er iemand bij de code hoeft.
     Dat is precies waar de schakelkast voor bestaat. */
  { id: 'ov-mail-binnen', categorie: 'Werk (zaken en personeel)', naam: 'RTG Mail: post van buiten aannemen',
    standaard: true, doelgroepen: ['leverancier', 'personeel'],
    uitleg: 'De buitenpoort die echte e-mail van een vreemde mailserver aanneemt, uitpakt en in het juiste postvak aflevert. Uit betekent: post van buiten komt niet meer binnen.',
    paden: ['/api/mail/binnen'] }
];
