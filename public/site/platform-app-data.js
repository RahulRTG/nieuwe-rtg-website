(function(w){
 "use strict";
 var story=w.RTGPublicDataFactory.story,card=w.RTGPublicDataFactory.card;
 var appCards=[
  card('socialApp','Sociaal, vanaf de kern','Social at the core','Geen feed om aandacht vast te houden, maar technologie om mensen te verbinden, te helpen en samen iets mogelijk te maken.','Not a feed designed to capture attention, but technology that helps people connect, support one another and make things possible together.','Ontdek het sociale hart','Explore the social heart','people','social','living','worlds/heritage/living-sociaal-hero-v1.jpg','verhaal'),
  card('living','LivingOS','LivingOS','Uw dagelijks leven, bij elkaar.','Your daily life, together.','Verken LivingOS','Explore LivingOS','home','photo','living','editorial/discover-living','world:living'),
  card('travel','TravelOS','TravelOS','Van vertrek tot thuiskomst.','From departure to coming home.','Verken TravelOS','Explore TravelOS','plane','photo','travel','editorial/discover-travel','world:travel'),
  card('work','WorkOS','WorkOS','Ruimte voor werk en plannen.','Room for work and plans.','Verken WorkOS','Explore WorkOS','brief','photo','work','editorial/discover-work','world:work'),
  card('foundationApp','FoundationOS','FoundationOS','Altijd 100% gratis.','Always 100% free.','Verken FoundationOS','Explore FoundationOS','heart','photo','foundation','editorial/discover-foundation','world:foundation'),
  card('rahulApp','Rahul','Rahul','Vertel wat u wilt bereiken.','Describe what you want to achieve.','Probeer een voorbeeld','Try an example','spark','rahul','living',null,'rahul'),
  card('permissions','Uw toestemming','Your permission','Deze demonstratie gebruikt alleen voorbeeldgegevens.','This demonstration uses only example data.','Bekijk wat dit verandert','See what changes','shield','permissions','living',null,'regie'),
  card('techApp','Techniek & security','Technology & security','Codenamen, een eigen kluis en meters die kunnen zakken. Met de bestanden erbij.','Code names, our own vault and meters that can fail. With the source files.','Kijk onder de motorkap','Look under the hood','branch','tech','work',null,'techniek'),
  card('languageApp','Taal & bediening','Language & controls','Dezelfde keuzes, een andere taal.','The same choices, another language.','Kies uw taal','Choose your language','book','language','living',null,'language'),
  card('access','Passen & vragen','Passes & questions','Functies, grenzen en menselijke service.','Features, limits and human service.','Bekijk uw mogelijkheden','Explore your options','doc','questions','work',null,'passen'),
  card('create','Maak mijn RTG','Make RTG mine','Begin op uw eigen moment.','Begin in your own time.','Bekijk de volgende stap','See the next step','people','create','living',null,'begin')
 ];
 w.RTGPublicContent.app.cards=appCards;
})(window);
