/* Public content only. These records never describe a member or grant a capability. */
(function(w){
 'use strict';
 w.I18N=w.I18N||{};w.I18N.en=w.I18N.en||{};
 var words={};
 function say(id,nl,en){words[id]=[nl,en];w.I18N.en["public."+id]=en;return id;}
 var common={
  home:say('home','Home','Home'),worlds:say('worlds','Werelden','Worlds'),actions:say('actions','Acties','Actions'),menu:say('menu','Menu','Menu'),
  company:say('company','Over RTG','About RTG'),app:say('app','Ontdek RTG','Explore RTG'),
  welcomeCompany:say('welcomeCompany','Welkom bij RTG.','Welcome to RTG.'),welcomeApp:say('welcomeApp','Welkom in uw eerste RTG-ervaring.','Welcome to your first RTG experience.'),
  subCompany:say('subCompany','Ontdek het bedrijf achter de werelden.','Discover the company behind the worlds.'),
  subApp:say('subApp','Demonstratie · zonder account','Demonstration · no account needed'),
  tagline:say('tagline','Eén omgeving. Uw eigen wereld.','One environment. Your own world.'),
  people:say('people','Uw mensen','Your people'),contact:say('contact','Contact met RTG','Contact RTG'),
  example:say('example','Voorbeeld','Example'),illustration:say('illustration','Sfeerbeeld','Illustrative image'),
  anonymous:say('anonymous','Uw eigen contacten verschijnen pas na aanmelden.','Your own contacts appear after you sign in.'),
  about:say('about','Leer RTG kennen.','Get to know RTG.'),support:say('support','Menselijke service','Human service'),
  supportBody:say('supportBody','Bekijk hoe contact werkt.','See how to get in touch.'),cooperate:say('cooperate','Samenwerken','Working together'),
  cooperateBody:say('cooperateBody','Ontdek de mogelijkheden.','Explore the possibilities.'),
  crew:say('crew','Uw gezelschap','Your companions'),crewBody:say('crewBody','Een voorbeeld voor samen.','An example of coming together.'),
  team:say('team','Uw team','Your team'),teamBody:say('teamBody','Een voorbeeld voor werk.','An example for work.'),
  rahulBody:say('rahulBody','Ontdek hoe ik help.','Explore how I can help.'),
  peopleQuote:say('peopleQuote','Wij bouwen rondom mensen.','We build around people.'),
  libraryCompany:say('libraryCompany','Ontdek het bedrijf achter RTG','Discover the company behind RTG'),
  libraryApp:say('libraryApp','Ontdek uw appbibliotheek','Explore your app library'),
  libraryIntro:say('libraryIntro','Open een onderwerp en ontdek hoe het samenhangt.','Open a topic and discover the connections.'),
  libraryDemo:say('libraryDemo','Probeer een voorbeeld en open een widget.','Try an example and open a widget.'),
  search:say('search','Zoek een app of onderwerp','Search for an app or topic'),all:say('all','Alle onderwerpen','All topics'),
  grid:say('grid','Toon kaarten','Show cards'),list:say('list','Toon een lijst','Show a list'),
  noResults:say('noResults','Er zijn geen onderwerpen gevonden. Probeer een andere zoekterm.','No topics found. Try another search.'),
  back:say('back','Terug naar het overzicht','Back to the overview'),open:say('open','Open dit onderwerp','Open this topic'),
  more:say('more','Meer','More'),begin:say('begin','Begin hier','Start here'),language:say('language','Taal kiezen','Choose language'),
  profile:say('profile','Aanmelden bij RTG','Sign in to RTG'),next:say('next','Volgend hoofdstuk','Next chapter'),
  previous:say('previous','Vorig hoofdstuk','Previous chapter'),reset:say('reset','Wis mijn demokeuzes','Clear my demo choices'),
  demo:say('demo','Demonstratie','Demonstration'),demoBoundary:say('demoBoundary','Simulatie. Er wordt niets geboekt, betaald of gedeeld.','Simulation. Nothing is booked, paid or shared.'),
  free:say('free','Altijd 100% gratis.','Always 100% free.'),freeFull:say('freeFull','FoundationOS is en blijft altijd 100% gratis.','FoundationOS is and always will be 100% free.'),
  calendar:say('calendar','Uw voorbeeldagenda','Your example calendar'),calendarUse:say('calendarUse','Gebruik de voorbeeldagenda','Use the example calendar'),
  unknown:say('unknown','Uw beschikbaarheid is onbekend.','Your availability is unknown.'),
  calendarOn:say('calendarOn','Het voorstel gebruikt de vaste voorbeeldagenda.','The proposal uses the fixed example calendar.'),
  clarify:say('clarify','Bekijk de toelichting','Read the explanation'),regie:say('regie','Uw regie','Your control'),
  nothing:say('nothing','Er is nog niets gewijzigd.','Nothing has been changed.'),
  inspect:say('inspect','Bekijk uw keuzes','Review your choices'),plan:say('plan','Reis bekijken','Explore the trip'),
  effects:say('effects','Gevolgen begrijpen','Understand the consequences'),decide:say('decide','Zelf beslissen','Make your own decision'),
  why:say('why','Waarom zie ik dit?','Why am I seeing this?'),
  whyBody:say('whyBody','Dit voorstel gebruikt alleen de keuzes uit deze demonstratie.','This proposal uses only your choices in this demonstration.'),
  architecture:say('architecture','Zo bouwen wij RTG','How we build RTG'),
  wish:say('wish','Uw bedoeling','Your intention'),proposal:say('proposal','Een voorstel','A proposal'),decision:say('decision','Uw beslissing','Your decision'),
  architectureOpen:say('architectureOpen','Bekijk de architectuur','Explore the architecture'),
  storyOpen:say('storyOpen','Open ons verhaal','Open our story'),proposalOpen:say('proposalOpen','Bekijk het voorstel','View the proposal'),
  fallback:say('fallback','Sommige nieuwe teksten worden in het Engels getoond zolang de vertaling ontbreekt. Uw keuzes blijven behouden.','Some new text is shown in English while its translation is unavailable. Your choices are preserved.'),
  footer:say('footer','Een omgeving rondom mensen.','An environment built around people.'),
  faq:say('faq','Wat wilt u weten?','What would you like to know?'),
  privacy:say('privacy','Privacy','Privacy'),terms:say('terms','Voorwaarden','Terms'),
  consent:say('consent','Uw toestemming','Your permission'),depart:say('depart','Vertrek in dit voorbeeld','Departure in this example'),
  optional:say('optional','U kiest zelf welke interesses u wilt meenemen.','You decide which interests to take with you.')
 };
 function story(id,title,nl,en,body,bodyEn,photo,world,target){
  return {id:id,label:say(id+'Label',title[0],title[1]),title:say(id+'Title',nl,en),body:say(id+'Body',body,bodyEn),photo:photo,world:world,target:target};
 }
 function card(id,title,en,body,bodyEn,action,actionEn,icon,type,world,photo,target,paragraphs){
  var c={id:id,title:say(id+'CardTitle',title,en),body:say(id+'CardBody',body,bodyEn),action:say(id+'CardAction',action,actionEn),icon:icon,type:type,world:world,photo:photo,target:target||id};
  c.paragraphs=(paragraphs||[]).map(function(p,i){return say(id+'Paragraph'+i,p[0],p[1]);});return c;
 }
 w.RTGPublicContent={words:words,common:common,company:{stories:[],cards:[]},app:{stories:[],cards:[]}};
 w.RTGPublicDataFactory={story:story,card:card};
})(window);
