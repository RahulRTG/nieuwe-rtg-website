(function(w){
 "use strict";
 var story=w.RTGPublicDataFactory.story,card=w.RTGPublicDataFactory.card;
 var companyStories=[
  story('origin',['Ons verhaal','Our story'],'Het leven is verbonden. Wij bouwen de samenhang.','Life is connected. We build the connections.','Het begon met reizen. Daar ontdekten we hoeveel eromheen samenkomt.','It began with travel. That showed us how much comes together around it.','platform/company','living','origin'),
  story('vision',['Visie','Vision'],'Een platform rondom mensen.','A platform built around people.','Leven, reizen, werk en kansen geven we een plek binnen dezelfde RTG-visie.','We give life, travel, work and opportunity a place within the same RTG vision.','world-homes/living','living','worlds'),
  story('technology',['Techniek','Technology'],'Van een wens naar een verantwoorde handeling.','From an intention to a responsible action.','Betekenis, bevoegdheid en bewijs bepalen hoe wij het platform ontwerpen.','Meaning, authority and evidence shape how we design the platform.','world-homes/work','work','architecture'),
  story('control',['Regie','Control'],'Rahul bereidt voor. U houdt de regie.','Rahul prepares. You remain in control.','Een voorstel en de bevoegdheid om het uit te voeren zijn verschillende stappen.','A proposal and the authority to execute it are different steps.','world-homes/living','living','control'),
  story('opportunity',['Foundation','Foundation'],'Kansen horen bij iedereen.','Opportunity belongs to everyone.','FoundationOS is en blijft altijd 100% gratis.','FoundationOS is and always will be 100% free.','world-homes/foundation','foundation','foundation')
 ];
 var appStories=[
  story('travel',['Begin hier','Start here'],'Eén verandering. Meer samenhang.','One change. More connections.','Uw vlucht vertrekt later. Ontdek wat dat voor uw plannen betekent.','Your flight leaves later. Explore what this means for your plans.','platform/travel','travel','moment'),
  story('dinner',['LivingOS','LivingOS'],'Samen smaakt alles beter.','Everything tastes better together.','Een etentje voor acht personen. Ontdek wat er bij elkaar komt.','Dinner for eight. Discover what comes together.','world-homes/living','living','moment'),
  story('travelWorld',['TravelOS','TravelOS'],'Van vertrek tot thuiskomst.','From departure to coming home.','Uw reis raakt meer dan een boeking. Bekijk de samenhang in dit voorbeeld.','Your journey involves more than a booking. Explore the connections in this example.','world-homes/travel','travel','moment'),
  story('work',['WorkOS','WorkOS'],'Ruimte voor werk en plannen.','Room for work and plans.','Een teamlid valt uit. Bekijk hoe een voorstel kan helpen bij de volgende stap.','A team member is unavailable. See how a proposal can help with the next step.','world-homes/work','work','moment'),
  story('family',['Foundation','Foundation'],'Ruimte om te groeien.','Room to grow.','Voor uw gezin, uw talent en uw toekomst. Altijd 100% gratis.','For your family, your talent and your future. Always 100% free.','world-homes/foundation','foundation','moment')
 ];
 w.RTGPublicContent.company.stories=companyStories;w.RTGPublicContent.app.stories=appStories;
})(window);
