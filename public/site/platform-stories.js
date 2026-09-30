(function(w){
 "use strict";
 var story=w.RTGPublicDataFactory.story,card=w.RTGPublicDataFactory.card;
 var companyStories=[
  story('origin',['Platform','Platform'],'Infrastructuur voor drie kanten.','Infrastructure for every side.','Organisaties, partners en mensen werken vanuit dezelfde betekenis, zonder dezelfde interface te krijgen.','Organisations, partners and people operate from the same meaning without receiving the same interface.','platform/company','living','architecture'),
  story('vision',['Organisatie','Organisation'],'Voer de operatie uit zonder haar te versnipperen.','Run operations without fragmenting them.','WorkOS brengt mensen, planning, communicatie, documenten en besluitvorming in één bestuurbare werkomgeving.','WorkOS brings people, planning, communication, documents and decisions into one governable workspace.','editorial/company-technology','work','worlds'),
  story('technology',['Partner','Partner'],'Verbind aanbod met uitvoering en bereik.','Connect supply with delivery and reach.','Partners sluiten aan op dezelfde transacties en afspraken, met toegang die past bij hun rol.','Partners connect to the same transactions and agreements, with access appropriate to their role.','editorial/company-vision','travel','architecture'),
  story('control',['Mens','Person'],'Eén toegang tot het dagelijks leven.','One access point for everyday life.','LivingOS, TravelOS, WorkOS en FoundationOS vormen verschillende werelden binnen één RTG.','LivingOS, TravelOS, WorkOS and FoundationOS are distinct worlds within one RTG.','platform/company','living','worlds'),
  story('opportunity',['Besturing','Governance'],'Slim waar het helpt. Begrensd waar het moet.','Intelligent where it helps. Bounded where it matters.','Identiteit, bevoegdheid, toestemming en bewijs bepalen wat een functie daadwerkelijk mag doen.','Identity, authority, consent and evidence determine what a capability may actually do.','editorial/company-control','foundation','control')
 ];
 var appStories=[
  story('travel',['Begin hier','Start here'],'Eén verandering. Meer samenhang.','One change. More connections.','Uw vlucht vertrekt later. Ontdek wat dat voor uw plannen betekent.','Your flight leaves later. Explore what this means for your plans.','platform/travel','travel','moment'),
  story('dinner',['LivingOS','LivingOS'],'Samen smaakt alles beter.','Everything tastes better together.','Een etentje voor acht personen. Ontdek wat er bij elkaar komt.','Dinner for eight. Discover what comes together.','editorial/app-dinner','living','moment'),
  story('travelWorld',['TravelOS','TravelOS'],'Van vertrek tot thuiskomst.','From departure to coming home.','Uw reis raakt meer dan een boeking. Bekijk de samenhang in dit voorbeeld.','Your journey involves more than a booking. Explore the connections in this example.','editorial/app-journey','travel','moment'),
  story('work',['WorkOS','WorkOS'],'Ruimte voor werk en plannen.','Room for work and plans.','Een teamlid valt uit. Bekijk hoe een voorstel kan helpen bij de volgende stap.','A team member is unavailable. See how a proposal can help with the next step.','editorial/app-work','work','moment'),
  story('family',['Foundation','Foundation'],'Ruimte om te groeien.','Room to grow.','Voor uw gezin, uw talent en uw toekomst. Altijd 100% gratis.','For your family, your talent and your future. Always 100% free.','editorial/app-family','foundation','moment')
 ];
 w.RTGPublicContent.company.stories=companyStories;w.RTGPublicContent.app.stories=appStories;
})(window);
