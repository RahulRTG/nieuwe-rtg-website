/* De app-gids, deel 11: de staart van deel 1.

   Deel 1 groeide over de 10 KB-grens die het modulebeleid stelt (README.md,
   "Modulebeleid"), en de keuring in scripts/check.js merkte dat meteen. Geknipt
   op een entry-grens -- geld, sport en spelen -- precies zoals deel 8 en 9 ooit
   de staarten van deel 4 en 5 werden. De samengevoegde gids is er niet door
   veranderd; test/bibliotheek.test.js zou het zien als dat wel zo was. */

const G = (wat, doe, tip) => ({ wat, doe, tip });

module.exports = {
  /* De vijf wereld-apps zelf. Hun entries stonden in de gids-delen zoals de
     consolidatietak die had herschikt; bij de samenvoeging is de indeling van
     main gehouden en zijn deze vijf hierheen overgenomen -- de dekkingsscan
     (elke pagina een eigen uitleg) wees ze aan. */
  '/apps/geld.html': G('RTG Geld: hoe u er financieel voor staat, uit alle gelddomeinen tegelijk.',
    ['Bovenaan staat wat aandacht vraagt: een verlopen toezegging, een openstaande verrekening',
     'Tik een regel aan om naar de module te gaan die hem heeft; daar betaalt en verrekent u',
     'Onderaan staat de hele geldwereld'],
    'Dit scherm betaalt zelf niets en telt zelf niets op: elk bedrag komt uit de module die het bijhoudt. Staat er "niet alles is opgehaald", lees dat dan als een onvolledig beeld en niet als een gezond beeld.'),
  '/apps/kantoor.html': G('RTG Kantoor: uw werkdag op een plek -- agenda, taken, documenten en gedeelde bestanden tegelijk.',
    ['Kijk bovenaan of er iets aandacht vraagt; wat rustig loopt blijft rustig',
     'Tik een regel aan om naar de app te gaan die hem heeft; daar maakt en wijzigt u',
     'Onderaan staat de hele kantoorwereld, als er nog niets openstaat'],
    'Dit scherm maakt zelf niets en wijzigt zelf niets, met opzet: een taak hoort op een plek te staan en niet op twee. Staat er "niet alles is opgehaald", lees dat dan als een onvolledige werkdag en niet als een lege werkdag.'),
  '/apps/leven.html': G('Mijn leven: uw levenslijn en wat er speelt, uit alle bronnen tegelijk.',
    ['Bovenaan staat of er iets aandacht vraagt; loopt alles, dan staat dat er ook',
     'Daaronder uw lijn: de fasen waarvan hier iets bekend is, met de bron erbij',
     'De mentor onderin antwoordt op wat er in uw lijn staat, met zijn gegevens eronder'],
    'Fasen waarvan hier niets bekend is, staan er niet -- ook niet grijs. Wie geen studie, geen kinderen of geen pensioen heeft, mist niets: dit is geen lijst die af moet. Dit scherm regelt zelf niets en beslist niets over u; het opent hooguit een deur.'),
  '/apps/reizen.html': G('RTG Reizen: uw reiswereld op een plek -- alles wat eraan komt, uit alle reisapps tegelijk.',
    ['Kijk bovenaan wat er als eerste aankomt: vlucht, verblijf, reis of charter',
     'Tik een regel aan om naar de app te gaan die hem heeft; daar boekt en wijzigt u',
     'Onderaan staat de hele reiswereld, als u nog niets geboekt heeft'],
    'Dit scherm boekt zelf niets en annuleert zelf niets, met opzet: uw boeking hoort op een plek te staan en niet op twee. Staat er "niet alles is opgehaald", lees dat dan als een onvolledig reisschema en niet als een leeg reisschema.'),
  '/apps/sociaal.html': G('RTG Sociaal: wat er tussen u en uw kring speelt, uit alle sociale apps tegelijk.',
    ['Bovenaan staat wat op u wacht: een onbeantwoord gesprek, een bijeenkomst die eraan komt',
     'Tik een regel aan om naar de app te gaan die hem heeft; daar antwoordt en plaatst u',
     'Onderaan staat de hele sociale wereld, als er niets openstaat'],
    'Dit scherm praat zelf niet en plaatst zelf niets, met opzet. Er staat ook geen teller van volgers of likes: dit is een overzicht van wat er speelt, geen aansporing om vaker te kijken.'),

  '/apps/werkruimte.html': G('RTG Workspace: uw werkruimte op een groot scherm, waar meerdere RTG-apps naast elkaar draaien en elkaar begrijpen.',
    ['Open een wereld uit de console links; hij verschijnt als eigen vlak',
     'Pak de gouden greep bovenaan een vlak om het te verplaatsen, of sleep het naar een schermrand om het vast te zetten',
     'Druk op Cmd-K (of Ctrl-K) om iets te zoeken of te openen zonder de muis'],
    'Dit is geen grotere telefoon-app: op een groot scherm hoort er meer RTG te staan, niet hetzelfde maar uitgerekt. De apps blijven zelfstandig; de werkruimte verbindt ze alleen.'),
  '/apps/wbw.html': G('Wie betaalt wat: groepsuitgaven bijhouden met een live balans.',
    ['Maak een groep en zet uitgaven erin', 'Zie live wie wat voorschoot', 'Verreken in één keer via RTG Pay'],
    'Direct na de vakantie verrekenen voorkomt het eeuwige "dat komt nog wel".'),
  '/apps/bank.html': G('RTG Rekening: je saldo, afschriften en betalingen in de vertrouwde RTG-stijl.',
    ['Bekijk je saldo en afschriften', 'Zet spaardoelen en volg ze', 'Vraag krediet aan; een mens beoordeelt'],
    'De AI adviseert, een mens beslist; zeker bij geld houden we die volgorde altijd aan.'),
  '/apps/balans.html': G('RTG Balans: je financiële overzicht en de boekhoudhulp.',
    ['Bekijk inkomsten en uitgaven per maand', 'Laat de AI-boekhouder meedenken', 'Exporteer voor je administratie'],
    'Tien minuten per week naar je balans kijken voorkomt de meeste geldverrassingen.'),
  '/apps/sport.html': G('RTG Sport: kampen, lessen en sportieve activiteiten van partners.',
    ['Bekijk het aanbod en de data', 'Meld je aan voor een kamp of les', 'Stel een vraag aan de organisatie'],
    'Begin klein: één vast uur per week houd je langer vol dan een groots plan.'),
};
