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
  story('overview',['Rahul Travel Group','Rahul Travel Group'],'Technologie rondom mensen.','Technology built around people.','Vier werelden brengen leven, reizen, werk en bijdragen samen rond de persoon.','Four worlds bring life, travel, work and contribution together around the person.','editorial/public-evening','living','rahul')
 ];
 w.RTGPublicContent.company.stories=companyStories;w.RTGPublicContent.app.stories=appStories;
})(window);
