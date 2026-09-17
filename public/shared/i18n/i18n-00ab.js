/* Code-controlled shared UI copy. These words never select an action: Edge
   keeps its existing action IDs, handlers and server permissions. */
window.RTGUiBronnen = Object.freeze({
  'Hier':'Here','Heel RTG':'All RTG','Recent bezocht':'Recently visited','Uw ruimte':'Your space',
  'Relevant op deze plek':'Relevant here','Functies op deze plek':'Features for this context',
  'Uw vier werelden':'Your four worlds','Alles van Rahul Travel Group':'Everything from Rahul Travel Group',
  'Alle apps':'All apps','Profiel & veiligheid':'Profile and security','Menuweergave':'Menu view','Menu sluiten':'Close menu',
  'Home':'Home','HOME':'HOME','Menu':'Menu','MENU':'MENU','Werelden':'Worlds','WERELDEN':'WORLDS',
  'Acties':'Actions','ACTIES':'ACTIONS','Terug':'Back','Vooruit':'Forward','Sluiten':'Close',
  'Openen':'Open','Opslaan':'Save','Annuleren':'Cancel','Doorgaan':'Continue','Ga verder':'Continue',
  'Volgende stap':'Next step','Uw werelden':'Your worlds','Context en opties':'Context and options',
  'Veiligheid en status':'Security and status','Open Connect':'Open Connect','Bekijk actuele status':'View current status',
  'Rahul vragen':'Ask Rahul','Praat met Rahul':'Talk to Rahul','Vraag Rahul':'Ask Rahul','Vraag Rahul…':'Ask Rahul…',
  'Gesprek met Rahul':'Conversation with Rahul','Open gesprek met Rahul':'Open conversation with Rahul',
  'Geef Rahul context':'Give Rahul context','Gesprek':'Conversation','Versturen':'Send',
  'Acties van dit scherm':'Actions for this screen','Alle functies':'All features','ALLE FUNCTIES':'ALL FEATURES',
  'Context van deze pagina':'Context for this page','Context van dit scherm':'Context for this screen',
  'Dit scherm':'This screen','Hoofdactie':'Main action','Doen':'Act','Meer acties':'More actions','Meer':'More',
  'Connect openen':'Open Connect','Actuele activiteit':'Current activity','Actueel':'Current',
  'Wat wilt u doen?':'What would you like to do?','VEILIGE VOLGENDE STAP':'SAFE NEXT STEP',
  'Voor deze context zijn geen veilige acties beschikbaar.':'No safe actions are available for this context.',
  'Home, Context, Acties, Connect en Rahul':'Home, Context, Actions, Connect and Rahul',
  'Handelingen van dit scherm':'Actions for this screen','Hoofdnavigatie':'Main navigation',
  'Menu en alle functies':'Menu and all features','Naar home':'Go home','Werelden openen':'Open worlds',
  'Aantal schermen':'Number of screens','Functies van dit scherm':'Features for this screen',
  'Vier RTG werelden':'Four RTG worlds','Functies':'Features','Functies zoeken':'Search features',
  'Geen functie gevonden.':'No matching feature was found.','Werelden en werkbladen':'Worlds and workspaces',
  'Werelden en systeem':'Worlds and system','Slim menu':'Smart menu','Menu openen':'Open menu',
  'Bediening en weergave':'Controls and display','Taal kiezen':'Choose your language',
  'Mijn profiel':'My profile','Zoeken':'Search','Informatiedichtheid':'Information density',
  'Compact':'Compact','Ruim':'Comfortable','Weergavestand':'Display mode','Weergave':'Display',
  'Bediening tonen':'Show controls','Context sluiten':'Close context','Automatisch':'Automatic',
  'Overzicht':'Overview','Focus':'Focus','LIVE SYSTEEMSTATUS':'LIVE SYSTEM STATUS','Status ophalen…':'Loading status…',
  'Lokale controle':'Local check','Beveiligd':'Secure','Niet beveiligd':'Not secure','Netwerk':'Network',
  'Controleren…':'Checking…','Datalaag':'Data layer','Boeken, betalen en goedkeuren blijven menselijke handelingen.':'Booking, payment and approval remain human decisions.',
  'Magnaat Test gereed':'Magnaat Test ready','Systemen gereed':'Systems ready','Controle nodig':'Review needed',
  'Beperkt':'Limited','Gereed':'Ready','Niet gereed':'Not ready','Server niet bereikbaar':'Server unavailable',
  'Onbekend':'Unknown','Wacht op bron':'Waiting for source','niet beschikbaar':'unavailable',
  'Afgeschermde Magnaat-testomgeving. Geen klantdata of productieacties. Boeken, betalen en goedkeuren blijven menselijke handelingen.':'Isolated Magnaat test environment. No customer data or production actions. Booking, payment and approval remain human decisions.',
  'Dag & team':'Day and team','Vandaag':'Today','Morgen':'Tomorrow','Gisteren':'Yesterday',
  'Afdelingen':'Departments','Personeel':'Staff','Agenda':'Calendar','Mijn loon':'My pay',
  'Maken & delen':'Create and share','Presentaties & Office':'Presentations and Office','Bestanden':'Files',
  'Ondernemen':'Business','Onderneming':'Company','Regie':'Control','Plannen':'Planning',
  'Reizen & Veilig':'Travel and safety','Vluchten':'Flights','Verblijven':'Stays','Reisbureau':'Travel agency',
  'Onderweg':'On the move','Navigatie':'Navigation','Openbaar vervoer':'Public transport','Verkeer':'Traffic',
  'Ritstatus':'Ride status','Stad':'City','Residentie':'Residence','Reisboek':'Travel journal',
  'Leefmodel':'Life overview','Voornemen':'Intent','Routes vergelijken':'Compare routes',
  'Beslissingen':'Decisions','Terugkijken':'Review','Uw leven':'Your life','Mijn leven':'My life',
  'RTG Geld':'RTG Money','Wonen':'Home and living','Gezondheid':'Health','RTG Veilig':'RTG Safety',
  'Start & leren':'Start and learn','Leren & Groei':'Learning and growth','Presenteren & Office':'Presentations and Office',
  'Bibliotheek':'Library','Geloofsbibliotheek':'Faith library','Schoolbibliotheek':'School library','Beroepen':'Careers',
  'Overhoren':'Practice questions','Schrijven':'Writing','Projecten':'Projects','Toetsen':'Tests','Presenteren':'Presentations',
  'Klein beginnen':'Start small','De Speeltuin':'The playground','Tellen tot tien':'Count to ten',
  'Ondersteuning':'Support','Instellingen':'Settings','Meldingen':'Notifications','Berichten':'Messages',
  'Profiel':'Profile','Uitloggen':'Sign out','Inloggen':'Sign in','Aanmelden':'Sign up',
  'Alles':'All','Kies uw taal':'Choose your language','Hulp':'Help','Zoek':'Search',
  'Alle werelden':'All worlds','Verder ontdekken':'Keep exploring','Licht':'Light','Donker':'Dark',
  'Welkom':'Welcome','Welkom terug':'Welcome back','Opslaan gelukt':'Saved successfully'
});
/* Exact interface templates only. Values, identifiers and user input are never parsed as commands. */
window.RTGUiBronTekst = function(source){
  if(Object.hasOwn(window.RTGUiBronnen,source))return window.RTGUiBronnen[source];
  var count=/^Zoek in (\d+) functies$/.exec(source);
  if(count)return 'Search '+count[1]+' features';
  var world=/^(LIVING OS|TRAVEL OS|WORK OS|RTFOUNDATION) · ALLE FUNCTIES$/.exec(source);
  if(world)return world[1]+' · ALL FEATURES';
  var store=/^(sqlite|postgres|memory|opslag) · (schrijfbaar|alleen-lezen)$/.exec(source);
  if(store)return store[1]+' · '+(store[2]==='schrijfbaar'?'writable':'read only');
};
