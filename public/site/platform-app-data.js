(function(w){
 "use strict";
 var story=w.RTGPublicDataFactory.story,card=w.RTGPublicDataFactory.card;
 var appCards=[
  card('socialApp','Sociaal, vanaf de kern','Social at the core','Geen feed om aandacht vast te houden, maar technologie om mensen te verbinden, te helpen en samen iets mogelijk te maken.','Not a feed designed to capture attention, but technology that helps people connect, support one another and make things possible together.','Ontdek het sociale hart','Explore the social heart','people','social','living','worlds/heritage/living-sociaal-hero-v1.jpg','verhaal'),
  card('living','LivingOS','LivingOS','Een lange avond, een goed gesprek en tijd voor elkaar. Juist het alledaagse verdient aandacht.','A long evening, a good conversation and time for one another. The everyday deserves our attention.','Ontdek LivingOS','Discover LivingOS','home','photo','living','worlds/owner-20261114/living.jpg','world:living'),
  card('travel','TravelOS','TravelOS','Nieuwe plekken en andere perspectieven. Reizen op uw manier, met oog voor wie de reis met u deelt.','New places and fresh perspectives. Travel your way, with care for those who share the journey.','Ontdek TravelOS','Discover TravelOS','plane','photo','travel','worlds/owner-20261114/travel.jpg','world:travel'),
  card('work','WorkOS','WorkOS','Samen iets opbouwen, met aandacht voor het werk én voor elkaar.','Building something together, with care for the work and for one another.','Ontdek WorkOS','Discover WorkOS','brief','photo','work','worlds/owner-20261114/work.jpg','world:work'),
  card('foundationApp','FoundationOS','FoundationOS','Ontmoeten, leren en samen iets betekenen. Altijd 100% gratis.','Meet, learn and make a difference together. Always 100% free.','Ontdek FoundationOS','Discover FoundationOS','heart','photo','foundation','worlds/owner-20261114/foundation.jpg','world:foundation'),
  card('rahulApp','Rahul','Rahul','Vertel wat u wilt bereiken.','Describe what you want to achieve.','Probeer een voorbeeld','Try an example','spark','rahul','living',null,'rahul'),
  card('permissions','Uw toestemming','Your permission','Deze demonstratie gebruikt alleen voorbeeldgegevens.','This demonstration uses only example data.','Bekijk wat dit verandert','See what changes','shield','permissions','living',null,'regie'),
  card('techApp','Techniek & security','Technology & security','Codenamen, een eigen kluis en meters die kunnen zakken. Met de bestanden erbij.','Code names, our own vault and meters that can fail. With the source files.','Kijk onder de motorkap','Look under the hood','branch','tech','work',null,'techniek'),
  card('languageApp','Taal & bediening','Language & controls','Dezelfde keuzes, een andere taal.','The same choices, another language.','Kies uw taal','Choose your language','book','language','living',null,'language'),
  card('access','Passen & vragen','Passes & questions','Functies, grenzen en menselijke service.','Features, limits and human service.','Bekijk uw mogelijkheden','Explore your options','doc','questions','work',null,'passen'),
  card('create','Maak mijn RTG','Make RTG mine','Begin op uw eigen moment.','Begin in your own time.','Bekijk de volgende stap','See the next step','people','create','living',null,'begin')
 ];
 w.RTGPublicContent.app.cards=appCards;
 w.RTGPublicContent.app.primary=['travel','living','work','foundationApp'].map(function(id){return appCards.find(function(card){return card.id===id;});});
})(window);
