(function(w){
 "use strict";
 var story=w.RTGPublicDataFactory.story,card=w.RTGPublicDataFactory.card;
 var companyStories=[
  story('origin',['Rahul Travel Group','Rahul Travel Group'],'Het begint bij een reis.','It begins with a journey.','RTG ontwikkelt reis- en lifestyledienstverlening rond mensen en de ondernemers die eraan bijdragen.','RTG is developing travel and lifestyle services around people and the businesses that contribute to them.','platform/company','living','architecture'),
  story('vision',['Organisatie','Organisation'],'De context blijft bij het werk.','Keep work in context.','Projecten, taken en documenten binnen uw werkruimte, met herkenbare verantwoordelijkheden.','Projects, tasks and documents in your workspace, with clear responsibilities.','editorial/company-technology','work','worlds'),
  story('technology',['Partner','Partner'],'Uw zaak. Uw eigen karakter.','Your business. Your own character.','Ontdek de aansluiting voor uw onderneming. Aanbod, rechten en dienstverlening worden afzonderlijk afgesproken.','Explore how your business can join. Offerings, permissions and services are agreed separately.','editorial/company-vision','travel','architecture'),
  story('control',['Mens','Person'],'Eén toegang tot het dagelijks leven.','One access point for everyday life.','LivingOS, TravelOS, WorkOS en FoundationOS vormen verschillende werelden binnen één RTG.','LivingOS, TravelOS, WorkOS and FoundationOS are distinct worlds within one RTG.','platform/company','living','worlds'),
  story('opportunity',['Besturing','Governance'],'Slim waar het helpt. Begrensd waar het moet.','Intelligent where it helps. Bounded where it matters.','Identiteit, bevoegdheid, toestemming en bewijs bepalen wat een functie daadwerkelijk mag doen.','Identity, authority, consent and evidence determine what a capability may actually do.','editorial/company-control','foundation','control')
 ];
 var appStories=[
  story('overview',['Rahul Travel Group','Rahul Travel Group'],'Meer dan de bestemming.','Beyond the destination.','Uw reis, de plannen eromheen en de mensen met wie u ze deelt.','Your journey, the plans around it and the people you share them with.','editorial/public-evening','living','rahul')
 ];
 w.RTGPublicContent.company.stories=companyStories;w.RTGPublicContent.app.stories=appStories;
})(window);
