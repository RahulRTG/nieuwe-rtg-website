/* Hoteldorp (deelmodule): de dorpen van ALLE overige genres. Zelfde motor,
   zelfde lichte gereedschap ("waar + wat + wie" met een korte keten) --
   alleen de afdelingsindeling verschilt per genre. Bestaande afdelingen
   (kantoor, promo, inkoop, security, klussen, it, sales, events...) worden
   hergebruikt; hier staan alleen de genre-eigen afdelingen en de sets.
   Pure data, geen logica. Het VANGNET_SET zorgt dat elke zaak een dorp
   heeft, ook een genre zonder eigen indeling. */

const EXTRA_AFDELINGEN = {
  // retail en modehuizen
  winkelvloer: { label: 'Winkelvloer', icon: 'winkel', waar: 'Afdeling of rek', wat: 'Signaal, bijv. maat 38 bijvullen bij de jurken', keten: ['gemeld', 'bezig', 'klaar'] },
  paskamers: { label: 'Paskamers', icon: 'garderobe', waar: 'Paskamer, bijv. 3', wat: 'Wens, bijv. andere maat brengen', keten: ['gevraagd', 'onderweg', 'gebracht'] },
  etalage: { label: 'Etalage & presentatie', icon: 'atelier', waar: 'Etalage of tafel', wat: 'Wissel, bijv. nieuwe collectie in de etalage', keten: ['idee', 'gepland', 'staat'] },
  kassa: { label: 'Kassa & retour', icon: 'kassa', waar: 'Kassa', wat: 'Melding, bijv. retour zonder bon, wisselgeld bijvullen', keten: ['open', 'bezig', 'afgehandeld'] },
  // vervoer, verhuur en vloot
  planning: { label: 'Planning & ritten', icon: 'agenda', waar: 'Rit of tijd', wat: 'Wijziging, bijv. transfer 14:00 verschuift naar 15:00', keten: ['open', 'ingepland', 'gereden'] },
  garage: { label: 'Garage & onderhoud', icon: 'gereedschap', waar: 'Voertuig of vaartuig', wat: 'Klus, bijv. APK Defender volgende week', keten: ['gemeld', 'ingepland', 'bezig', 'klaar'] },
  chauffeurs: { label: 'Chauffeurs & bemanning', icon: 'auto', waar: 'Wie of dienst', wat: 'Overdracht, bijv. avonddienst zoekt vervanging', keten: ['open', 'geregeld'] },
  schouw: { label: 'Schouw & teruggave', icon: 'camera', waar: 'Voertuig', wat: 'Inname of uitgifte, bijv. foto-schouw bij teruggave', keten: ['gepland', 'geschouwd', 'afgerond'] },
  // vastgoed en bouw
  panden: { label: 'Panden & dossiers', icon: 'huis', waar: 'Pand', wat: 'Actie, bijv. energielabel opvragen', keten: ['open', 'bezig', 'afgehandeld'] },
  bezichtigingen: { label: 'Bezichtigingen', icon: 'sleutel', waar: 'Pand en tijd', wat: 'Afspraak, bijv. vrijdag 11:00, met keyless-code', keten: ['gepland', 'gelopen', 'nagebeld'] },
  // zorg en welzijn
  behandelkamers: { label: 'Behandelkamers', icon: 'zorg', waar: 'Kamer', wat: 'Gereedmaken, bijv. kamer 2 klaarzetten voor massage', keten: ['gevraagd', 'bezig', 'klaar'] },
  // boerderij en land
  land: { label: 'Stal & land', icon: 'boerderij', waar: 'Perceel of stal', wat: 'Werk, bijv. kas 2 water geven, hek nalopen', keten: ['open', 'bezig', 'klaar'] },
  oogst: { label: 'Oogst & voorraad', icon: 'mand', waar: 'Product', wat: 'Melding, bijv. tomaten klaar voor de kraam', keten: ['gemeld', 'geoogst', 'in de schappen'] },
  bezorging: { label: 'Bezorging & ophalen', icon: 'bezorging', waar: 'Adres of bestelling', wat: 'Rit, bijv. drie manden naar de haven', keten: ['open', 'onderweg', 'bezorgd'] },
  // creators en studio's
  studio: { label: 'Studio & opnames', icon: 'camera', waar: 'Set of moment', wat: 'Opname, bijv. shoot golden hour bij de rotsen', keten: ['idee', 'gepland', 'opgenomen', 'gepubliceerd'] },
  // activiteiten en gidsen
  gidsen: { label: 'Gidsen & begeleiding', icon: 'kompas', waar: 'Programma of groep', wat: 'Inzet, bijv. tweede gids voor de zonsondergangstocht', keten: ['open', 'geregeld'] },
  materiaal: { label: 'Materiaal & uitrusting', icon: 'gereedschap', waar: 'Wat en waar', wat: 'Check, bijv. reddingsvesten tellen voor morgen', keten: ['gemeld', 'bezig', 'in orde'] },
  // vakwerk en diensten
  agenda2: { label: 'Agenda & afspraken', icon: 'agenda', waar: 'Dag en tijd', wat: 'Afspraak of wijziging, bijv. dinsdag ochtend vrijhouden', keten: ['open', 'ingepland', 'gedaan'] },
  offertes: { label: 'Offertes & aanvragen', icon: 'document', waar: 'Klant of klus', wat: 'Aanvraag, bijv. offerte terrasoverkapping', keten: ['aanvraag', 'offerte', 'akkoord', 'gefactureerd'] }
};

/* De gedeelde staart die (bijna) elk bedrijf heeft: het kantoorwerk,
   promotie, inkoop en de vaste klussen. */
const BASIS = ['kantoor', 'promo', 'inkoop', 'security', 'klussen', 'it', 'sales', 'events'];

const GENRE_SETS = {
  retail: ['winkelvloer', 'paskamers', 'etalage', 'kassa', ...BASIS],
  modehuis: ['winkelvloer', 'paskamers', 'etalage', 'kassa', ...BASIS],
  vervoer: ['planning', 'chauffeurs', 'garage', 'kassa', 'kantoor', 'promo', 'inkoop', 'security', 'klussen', 'it', 'sales'],
  charter: ['planning', 'chauffeurs', 'garage', 'materiaal', 'kantoor', 'promo', 'inkoop', 'security', 'klussen', 'it', 'sales'],
  verhuur: ['schouw', 'garage', 'planning', 'kassa', ...BASIS],
  vastgoed: ['panden', 'bezichtigingen', 'kantoor', 'promo', 'sales', 'klussen', 'it', 'security'],
  care: ['behandelkamers', 'spa', 'amenities', 'agenda2', ...BASIS],
  boerderij: ['land', 'oogst', 'bezorging', 'winkelvloer', 'kantoor', 'promo', 'inkoop', 'klussen', 'it', 'sales'],
  creator: ['studio', 'planning', 'promo', 'sales', 'kantoor', 'it'],
  activiteiten: ['entree', 'gidsen', 'materiaal', 'planning', ...BASIS],
  zzp: ['agenda2', 'offertes', 'materiaal', 'kantoor', 'promo', 'inkoop', 'it'],
  vakwerk: ['agenda2', 'offertes', 'materiaal', 'kantoor', 'promo', 'inkoop', 'it']
};

/* Elke andere zaak (nieuw genre, niches) krijgt in elk geval het
   gedeelde bedrijfsdorp: kantoorwerk, promotie, inkoop en de klussen. */
const VANGNET_SET = ['agenda2', ...BASIS];

module.exports = { EXTRA_AFDELINGEN, GENRE_SETS, VANGNET_SET };
