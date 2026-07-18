/* Functieschakelaars (deelmodule): het register zelf: de categorieen, de
   doelgroepen en de volledige functiecatalogus met pad-prefixen. De logica
   (welke functie past op een pad, wie mag wat) staat in server/functies.js. */
const CATEGORIEEN = [
  'Leden (RTG-app)',
  'Genres & diensten',
  'Sociaal (De Salon)',
  'Eigen apps',
  'Partners (leveranciers)',
  'RTG-Backoffice',
  'RTFoundation',
  'Betalen & verificatie',
  'Personeel & integraties'
];

/* De doelgroepen: wie een functie kan gebruiken. Klein en helder gehouden zodat
   de controlekamer niet overweldigt. synoniemen dienen de AI-hulp (vrije taal). */
const DOELGROEPEN = [
  { id: 'rtg',         naam: 'RTG-leden',    emoji: '🟢', kleur: '#3BA55D', uitleg: 'Leden met de RTG Pass.',                              synoniemen: ['rtg', 'rtg-leden', 'rtg leden', 'gewone leden'] },
  { id: 'lifestyle',   naam: 'Lifestyle',    emoji: '🟣', kleur: '#A46BD6', uitleg: 'Leden met de Lifestyle Pass.',                       synoniemen: ['lifestyle', 'lifestyle-leden', 'lifestyle mensen'] },
  { id: 'business',    naam: 'Business',     emoji: '🔵', kleur: '#4B8DC9', uitleg: 'Leden met de Business Pass (zakelijk).',             synoniemen: ['business', 'zakelijk', 'business pass'] },
  { id: 'gast',        naam: 'Gratis app',   emoji: '⚪', kleur: '#8A8680', uitleg: 'De gratis RTG-app, zonder pas (rondkijken en bij partners bestellen).', synoniemen: ['gast', 'gasten', 'gratis', 'gratis app', 'zonder pas', 'free'] },
  { id: 'leverancier', naam: 'Leveranciers', emoji: '🟠', kleur: '#D6A32E', uitleg: 'Partners en hun personeel in de partner-app.',       synoniemen: ['leverancier', 'leveranciers', 'partner', 'partners', 'zaak', 'zaken'] },
  { id: 'personeel',   naam: 'Personeel',    emoji: '🟤', kleur: '#B07B4E', uitleg: 'Medewerkers in de personeels-app (PDA).',            synoniemen: ['personeel', 'medewerker', 'medewerkers', 'pda', 'staff'] },
  { id: 'foundation',  naam: 'Foundation',   emoji: '🎓', kleur: '#5AB4C9', uitleg: 'Gezinnen, leerlingen en scholen in de RTF-app.',     synoniemen: ['foundation', 'rtf', 'rtfoundation', 'school', 'scholen', 'onderwijs', 'gezin', 'gezinnen', 'leerling'] },
  { id: 'intern',      naam: 'RTG intern',   emoji: '⚫', kleur: '#8A8681', uitleg: 'De RTG-backoffice en integraties (intern).',         synoniemen: ['intern', 'backoffice', 'kantoor', 'rtg zelf'] }
];
const DOELGROEP_IDS = DOELGROEPEN.map(d => d.id);
const DOELGROEP_OP_ID = Object.fromEntries(DOELGROEPEN.map(d => [d.id, d]));

// Handige groepen doelgroepen om herhaling te vermijden.
const LEDEN = ['rtg', 'lifestyle', 'business'];
const LEDEN_RTF = ['rtg', 'lifestyle', 'business', 'foundation'];
// mét de gratis app: de functies die ook zonder pas bereikbaar zijn
const LEDEN_GAST = ['rtg', 'lifestyle', 'business', 'gast'];

// De catalogus. standaard: true = de functie staat normaal aan. doelgroepen:
// welke doelgroepen deze functie bedient (en dus apart te schakelen zijn).
const FUNCTIES = [
  // ---- Leden (RTG-app) ----
  { id: 'member', categorie: 'Leden (RTG-app)', naam: 'Leden-app (algemeen)', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'Alle ledenfuncties in de RTG-app. Zet je dit uit, dan valt de hele ledenkant stil (behalve wat hieronder apart aan staat).', paden: ['/api/member'] },
  { id: 'member-dm', categorie: 'Leden (RTG-app)', naam: 'Directe berichten (DM)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Privéberichten tussen leden onderling.', paden: ['/api/member/dm'] },
  { id: 'member-snaps', categorie: 'Leden (RTG-app)', naam: 'Snaps & 24-uurs verhalen', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Foto-snaps en verhalen die na 24 uur verdwijnen.', paden: ['/api/member/snap', '/api/member/story'] },
  { id: 'member-connect', categorie: 'Leden (RTG-app)', naam: 'Vrienden verbinden', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Vriendschapsverzoeken en de vriendengraaf tussen leden.', paden: ['/api/member/connect'] },
  { id: 'member-werk', categorie: 'Leden (RTG-app)', naam: 'Vacatures & solliciteren (leden)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Leden solliciteren met hun cv op vacatures bij partners.', paden: ['/api/member/apply'] },
  { id: 'zakelijk', categorie: 'Leden (RTG-app)', naam: 'RTG Zakelijk (professioneel netwerk)', standaard: true, doelgroepen: ['lifestyle', 'business'],
    uitleg: 'De LinkedIn-laag van de Lifestyle en Business Pass: zakelijk profiel, gids, verbinden, feed, aanbevelingen en het kansenbord.', paden: ['/api/zakelijk'] },

  // ---- Genres & diensten (leden boeken/kopen per sector) ----
  { id: 'bestellen', categorie: 'Genres & diensten', naam: 'Bestellen & bezorgen', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'Bestellen bij een zaak (ophalen of laten bezorgen) met live volgen.', paden: ['/api/order', '/api/orders', '/api/bezorg'] },
  { id: 'tickets', categorie: 'Genres & diensten', naam: 'Tickets & activiteiten', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'Tickets kopen met tijdslot en een oplichtende entreecode.', paden: ['/api/tickets'] },
  { id: 'verhuur', categorie: 'Genres & diensten', naam: 'Autoverhuur', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Auto huren met foto\'s voor/na, borg, SOS-knop en live locatie.', paden: ['/api/huur', '/api/verhuur'] },
  { id: 'charter', categorie: 'Genres & diensten', naam: 'Boten & jachten (charter)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Vaartuigen charteren met schipper, borg, SOS op zee en live positie.', paden: ['/api/charter'] },
  { id: 'vastgoed', categorie: 'Genres & diensten', naam: 'Vastgoed', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Panden bekijken, interesse tonen of bieden en keyless bezichtigen.', paden: ['/api/vastgoed'] },
  { id: 'retail', categorie: 'Genres & diensten', naam: 'Mode & retail', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De modecatalogus: wishlist, apart leggen en de paskamer.', paden: ['/api/retail'] },
  { id: 'onderweg', categorie: 'Genres & diensten', naam: 'Onderweg (live locatie)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Het live onderweg-scherm: positie, ETA en verbonden partners.', paden: ['/api/live'] },
  { id: 'contracten', categorie: 'Genres & diensten', naam: 'Contracten (leden tekenen)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Digitale contracten die een lid in de app ondertekent.', paden: ['/api/contract', '/api/contracten'] },
  { id: 'groothandel', categorie: 'Genres & diensten', naam: 'Groothandel & markt', standaard: true, doelgroepen: ['rtg', 'lifestyle', 'business', 'leverancier'],
    uitleg: 'De brede B2B/B2C-marktplaats: horeca koopt in, leden bestellen boodschappen, met AI-bijbestellen. Elke groothandel zet zijn eigen functies aan/uit.', paden: ['/api/groothandel', '/api/supplier/groothandel', '/api/supplier/inkoop'] },

  // ---- Sociaal (De Salon) ----
  { id: 'salon', categorie: 'Sociaal (De Salon)', naam: 'De Salon (feed, volgen, deals)', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'De Salon-tijdlijn: partner-posts volgen, aanbiedingen claimen, polls en de etalage.', paden: ['/api/salon'] },
  { id: 'ontmoetingen', categorie: 'Sociaal (De Salon)', naam: 'Salon-ontmoetingen (in de buurt)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Wederzijdse connecties die vlakbij zijn spreken veilig af (18+, geverifieerd), met contract, live-locatie naar RTG en SOS.', paden: ['/api/ontmoeten'] },
  { id: 'social', categorie: 'Sociaal (De Salon)', naam: 'Sociale laag (RTG + RTF)', standaard: true, doelgroepen: LEDEN_RTF,
    uitleg: 'De gedeelde sociale laag: zoeken, verbinden, DM, snaps, verhalen en bellen op codenaam. De kinderbescherming (t/m 15 gesloten) blijft altijd gelden.', paden: ['/api/rtf/social'] },
  { id: 'rtf-contacten', categorie: 'Sociaal (De Salon)', naam: 'RTF contacten & familiekoppeling', standaard: true, doelgroepen: LEDEN_RTF,
    uitleg: 'De contactenlaag van de RTFoundation: gezinnen koppelen, kanalen en meldingen tussen leden.', paden: ['/api/rtf'] },

  // ---- Eigen apps: elke RTG-app als eigen schakelaar. De standaardindeling
  // is bewust ALLES AAN voor IEDEREEN (premium, ook aan de onderkant); de
  // boardroom stuurt per pas of doelgroep bij. Vaste veiligheidsregels (18+,
  // verificatie, kinderbescherming) blijven altijd gelden, ook als een app aan staat.
  { id: 'spellen', categorie: 'Eigen apps', naam: 'Spelen (spellen met vrienden)', standaard: true, doelgroepen: LEDEN_RTF,
    uitleg: 'Alle spellen: schaken, dammen, rummi, Magnaat, sudoku en de partyspellen.', paden: ['/api/member/spel', '/api/rtf/spel'] },
  { id: 'podium', categorie: 'Eigen apps', naam: 'RTG Podium (livestreams, 18+)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Het eigen livekanaal met chat, RTG Pay-cadeaus en abonnementen. De 18+/verificatie-eis blijft altijd gelden.', paden: ['/api/podium'] },
  { id: 'theater', categorie: 'Eigen apps', naam: 'RTG Theater (video)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De videobibliotheek op bioscoopniveau, inclusief het Thuisarchief (P2P).', paden: ['/api/theater'] },
  { id: 'flits', categorie: 'Eigen apps', naam: 'RTG Flits (rijscherm)', standaard: true, doelgroepen: ['rtg', 'lifestyle', 'business', 'personeel'],
    uitleg: 'Het rijscherm met meldingen uit het eigen netwerk (flitser, file, ongeval) en de vooruitblik. Op de PDA standaard alleen voor rijdende genres.',
    paden: ['/api/flits', '/api/staff/flits'],
    // de PDA-kant: alleen genres die echt de weg op gaan (leden merken hier niets van)
    alleenGenres: ['taxi', 'jet', 'helikopter', 'ov', 'verhuur', 'charter', 'boerderij', 'groothandel'] },
  { id: 'ov', categorie: 'Eigen apps', naam: 'RTG OV (reizen)', standaard: true, doelgroepen: ['rtg', 'lifestyle', 'business', 'leverancier', 'personeel'],
    uitleg: 'Alle vervoer in een app: de kaart, twee snelle check-ins, de dienst-PDA en de routetekenaar. De zaak-kant is alleen voor OV-zaken.',
    paden: ['/api/ov', '/api/staff/ov', '/api/supplier/ov'],
    alleenGenres: ['ov'] },
  { id: 'wbw', categorie: 'Eigen apps', naam: 'Wie betaalt wat', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Groepsuitgaven met een live balans en verrekenen via RTG Pay.', paden: ['/api/wbw'] },
  // Let op: NIET 'office' als id; die naam is al van de RTG-Backoffice hieronder.
  { id: 'kantoorpakket', categorie: 'Eigen apps', naam: 'RTG Office (kantoorpakket)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Het eigen kantoorpakket: tekstdocumenten en rekenbladen op uw account, alleen-lezen te delen op codenaam.', paden: ['/api/kantoorpakket'] },
  { id: 'clips', categorie: 'Eigen apps', naam: 'RTG Clips (korte video’s)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Korte verticale video’s die alleen op het toestel van de maker staan (OPFS); kijken is rechtstreeks P2P. De feed is een eindige dagselectie, bewust zonder oneindige scroll.', paden: ['/api/clips'] },
  { id: 'oog', categorie: 'Eigen apps', naam: 'RTG Eye (werkvloer-camera)', standaard: true, doelgroepen: ['leverancier', 'personeel'],
    uitleg: 'De camerablik van de werkvloer: voertuigschouw en het handsfree uitgifteregister. Standaard voor genres met voertuigen of voorraad; de boardroom kan per genre bijsturen.',
    paden: ['/api/staff/oog', '/api/supplier/oog'],
    alleenGenres: ['taxi', 'jet', 'helikopter', 'ov', 'verhuur', 'charter', 'boerderij', 'retail', 'groothandel', 'hotel', 'activiteit', 'beveiliging'] },
  { id: 'ghost', categorie: 'Eigen apps', naam: 'Ghost Driver (simulatie)', standaard: true, doelgroepen: ['leverancier', 'intern'],
    uitleg: 'De voorspellende verkeers- en logistieksimulatie. Standaard alleen voor vervoerders; de verkeersleiding (kantoor) ziet altijd alles.',
    paden: ['/api/supplier/ghost', '/api/office/ghost'],
    alleenGenres: ['taxi', 'jet', 'helikopter', 'ov', 'charter'] },

  // ---- Partners (leveranciers) ----
  { id: 'supplier', categorie: 'Partners (leveranciers)', naam: 'Partner-app (algemeen)', standaard: true, doelgroepen: ['leverancier'],
    uitleg: 'Alle leveranciersfuncties. Uit = partners kunnen niets meer doen (behalve wat hieronder apart aan staat).', paden: ['/api/supplier', '/api/partner'] },
  { id: 'supplier-pos', categorie: 'Partners (leveranciers)', naam: 'Kassa (POS)', standaard: true, doelgroepen: ['leverancier'],
    uitleg: 'Het kassascherm per sector: afrekenen en RTG-code innen.', paden: ['/api/supplier/pos'] },
  { id: 'supplier-salon', categorie: 'Partners (leveranciers)', naam: 'Partner-Salon (marketing)', standaard: true, doelgroepen: ['leverancier'],
    uitleg: 'Het bedrijfsprofiel op De Salon: posts, aanbiedingen, polls en volgers.', paden: ['/api/supplier/salon'] },
  { id: 'supplier-events', categorie: 'Partners (leveranciers)', naam: 'Events & mise-en-place', standaard: true, doelgroepen: ['leverancier'],
    uitleg: 'Eventkeuken, menukeuze met allergenen en de mise-en-place-planner.', paden: ['/api/supplier/event', '/api/supplier/mep'] },
  { id: 'supplier-finance', categorie: 'Partners (leveranciers)', naam: 'Financiën & AI-boekhouder', standaard: true, doelgroepen: ['leverancier'],
    uitleg: 'Dagcijfers, btw per genre/land en de AI-boekhouder van de zaak.', paden: ['/api/supplier/finance', '/api/supplier/accountant'] },
  { id: 'supplier-rooms', categorie: 'Partners (leveranciers)', naam: 'Kamers & slimme deuren (hotel)', standaard: true, doelgroepen: ['leverancier'],
    uitleg: 'Hotelkamers, housekeeping en de app-bediende deuren.', paden: ['/api/supplier/room', '/api/supplier/door'] },
  { id: 'supplier-ride', categorie: 'Partners (leveranciers)', naam: 'Ritten & vloot (vervoer)', standaard: true, doelgroepen: ['leverancier'],
    uitleg: 'Taxi- en jetritten accepteren en de vloot beheren.', paden: ['/api/supplier/ride', '/api/supplier/rides', '/api/supplier/fleet'] },
  { id: 'supplier-apply', categorie: 'Partners (leveranciers)', naam: 'Sollicitaties bij partners', standaard: true, doelgroepen: ['leverancier'],
    uitleg: 'Vacatures uitzetten en sollicitaties ontvangen bij de partner.', paden: ['/api/supplier/apply', '/api/supplier/vacature'] },

  // ---- RTG-Backoffice ----
  { id: 'office', categorie: 'RTG-Backoffice', naam: 'Backoffice (algemeen)', standaard: true, doelgroepen: ['intern'],
    uitleg: 'Het RTG-actiecentrum: orders, ritten, prestaties, verificaties en partneraanvragen.', paden: ['/api/office'] },
  { id: 'office-school', categorie: 'RTG-Backoffice', naam: 'Schoolgoedkeuring (RTF School)', standaard: true, doelgroepen: ['intern'],
    uitleg: 'Scholen goedkeuren of afwijzen voordat ze personeel en klassen kunnen aanmaken.', paden: ['/api/office/school'] },

  // ---- RTFoundation ----
  { id: 'foundation', categorie: 'RTFoundation', naam: 'RTFoundation-app (onderwijs)', standaard: true, doelgroepen: ['foundation'],
    uitleg: 'De gratis onderwijs-app: live schoolbord, leerling-schrift en de AI-bijleshulp.', paden: ['/api/foundation'] },
  { id: 'foundation-school', categorie: 'RTFoundation', naam: 'RTF School (scholen & leraren)', standaard: true, doelgroepen: ['foundation'],
    uitleg: 'Het schoolkanaal: klassen, rooster, huiswerk, cijfers, ziekmelden en berichten met de leraar.', paden: ['/api/foundation/school'] },
  { id: 'werk-rtf', categorie: 'RTFoundation', naam: 'Vacatures & solliciteren (RTF)', standaard: true, doelgroepen: ['foundation'],
    uitleg: 'De vacature- en sollicitatielaag binnen de RTFoundation-app.', paden: ['/api/rtf/apply', '/api/rtf/vacatures', '/api/rtf/solliciteer'] },

  // ---- Betalen & verificatie ----
  { id: 'betalen', categorie: 'Betalen & verificatie', naam: 'Betaalverkeer', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'Betalingen (demo of Stripe) en de RTG Pay-wallet. Uit = er kan tijdelijk niet betaald worden.', paden: ['/api/betaal', '/api/pay'] },
  { id: 'webauthn', categorie: 'Betalen & verificatie', naam: 'Passkeys (WebAuthn)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Inloggen met vingerafdruk, gezicht of beveiligingssleutel. Wachtwoord-inloggen blijft altijd werken.', paden: ['/api/webauthn'] },
  { id: 'verificatie', categorie: 'Betalen & verificatie', naam: 'Identiteitsverificatie (KYC)', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'Leden uploaden hun identiteitsbewijs en RTG beoordeelt het.', paden: ['/api/verify'] },
  { id: 'paspoort', categorie: 'Betalen & verificatie', naam: 'Paspoort delen (gecontroleerd)', standaard: true, doelgroepen: ['rtg', 'lifestyle', 'business', 'leverancier'],
    uitleg: 'Het toestemmingsgestuurde kanaal waarlangs een partner een identiteit opvraagt (ja/nee, ID-kaart of scan), met melding en weigering voor het lid.', paden: ['/api/paspoort', '/api/supplier/paspoort'] },

  // ---- Personeel & integraties ----
  { id: 'staff', categorie: 'Personeel & integraties', naam: 'Personeels-app (PDA)', standaard: true, doelgroepen: ['personeel'],
    uitleg: 'De personeels-app: rooster, klokken, verlof/ziek, taken, team en de vertrouwenspersoon.', paden: ['/api/staff'] }
];

const OP_ID = Object.fromEntries(FUNCTIES.map(f => [f.id, f]));
// fail-fast: een dubbele id zou stil de laatste laten winnen in OP_ID en de
// schakelkast op de verkeerde functie laten werken; dat is eerder misgegaan
if (Object.keys(OP_ID).length !== FUNCTIES.length) {
  const gezien = new Set();
  const dubbel = FUNCTIES.map(f => f.id).filter(id => gezien.has(id) || !gezien.add(id));
  throw new Error('functie-catalogus: dubbele id(s): ' + dubbel.join(', '));
}

/* Tegenhangers: twee functies die samen EEN dienst vormen (de leden-kant en de
   werk-kant). Zet de boardroom de ene kant om, dan volgt de andere kant
   automatisch, zodat er nooit een halve dienst overblijft (vacatures zonder
   sollicitanten, een Salon-feed zonder partner-marketing). De regel is de
   "nog publiek?"-vraag: de tegenhanger volgt of de bron nog ergens aan staat.
   Alleen directe partners volgen (geen kettingreacties), en per-doelgroep
   fijnregeling op de tegenhanger zelf blijft gerespecteerd. */
const KOPPELS = [
  { a: 'salon', b: 'supplier-salon',
    uitleg: 'De ledenfeed en de partner-marketing zijn twee kanten van dezelfde Salon.' },
  { a: 'member-werk', b: 'supplier-apply',
    uitleg: 'Solliciteren zonder vacatures werkt niet, en andersom.' },
  { a: 'werk-rtf', b: 'supplier-apply',
    uitleg: 'RTF-sollicitaties lopen op dezelfde partner-vacatures.' },
  { a: 'foundation-school', b: 'office-school',
    uitleg: 'Het schoolkanaal en de schoolgoedkeuring horen bij elkaar.' },
  { a: 'verificatie', b: 'paspoort',
    uitleg: 'Paspoort delen leunt op de identiteitsverificatie.' },
  { a: 'social', b: 'rtf-contacten',
    uitleg: 'De familiekoppeling draait op de sociale laag.' }
];
for (const k of KOPPELS) if (!OP_ID[k.a] || !OP_ID[k.b])
  throw new Error('functie-catalogus: koppel verwijst naar onbekende functie: ' + k.a + ' <-> ' + k.b);

module.exports = { CATEGORIEEN, DOELGROEPEN, DOELGROEP_IDS, DOELGROEP_OP_ID, LEDEN, LEDEN_RTF, FUNCTIES, OP_ID, KOPPELS };
