/* De app-gids, deel 11: de acht werelden en de werkruimte.

   Deel 11 begon als de staart van deel 1, dat over de 10 KB-grens ging. Bij het
   samenvoegen met main bleek diezelfde staart daar op een ANDERE plek geknipt
   (deel1b), en die knip is de nieuwste -- dus die staat. Wat hier overblijft is
   geen willekeurige rest meer maar precies een onderwerp: de wereldschermen uit
   PLATFORM.md plus de werkruimte eroverheen. Dat het nu op een onderwerp valt
   is meegenomen en geen regel: een gidslijst is een lijst.

   De samengevoegde gids is door de knip niet veranderd; test/bibliotheek.test.js
   zou het zien als dat wel zo was. */

const G = (wat, doe, tip) => ({ wat, doe, tip });

module.exports = {
  '/apps/reizen.html': G('RTG Reizen: uw reiswereld op een plek -- alles wat eraan komt, uit alle reisapps tegelijk.',
    ['Kijk bovenaan wat er als eerste aankomt: vlucht, verblijf, reis of charter',
     'Tik een regel aan om naar de app te gaan die hem heeft; daar boekt en wijzigt u',
     'Onderaan staat de hele reiswereld, als u nog niets geboekt heeft'],
    'Dit scherm boekt zelf niets en annuleert zelf niets, met opzet: uw boeking hoort op een plek te staan en niet op twee. Staat er "niet alles is opgehaald", lees dat dan als een onvolledig reisschema en niet als een leeg reisschema.'),
  '/apps/geld.html': G('RTG Geld: hoe u er financieel voor staat, uit alle gelddomeinen tegelijk.',
    ['Bovenaan staat wat aandacht vraagt: een verlopen toezegging, een openstaande verrekening',
     'Tik een regel aan om naar de module te gaan die hem heeft; daar betaalt en verrekent u',
     'Onderaan staat de hele geldwereld'],
    'Dit scherm betaalt zelf niets en telt zelf niets op: elk bedrag komt uit de module die het bijhoudt. Staat er "niet alles is opgehaald", lees dat dan als een onvolledig beeld en niet als een gezond beeld.'),
  '/apps/leven.html': G('Mijn leven: uw levenslijn en wat er speelt, uit alle bronnen tegelijk.',
    ['Bovenaan staat of er iets aandacht vraagt; loopt alles, dan staat dat er ook',
     'Daaronder uw lijn: de fasen waarvan hier iets bekend is, met de bron erbij',
     'De mentor onderin antwoordt op wat er in uw lijn staat, met zijn gegevens eronder'],
    'Fasen waarvan hier niets bekend is, staan er niet -- ook niet grijs. Wie geen studie, geen kinderen of geen pensioen heeft, mist niets: dit is geen lijst die af moet. Dit scherm regelt zelf niets en beslist niets over u; het opent hooguit een deur.'),
  '/apps/sociaal.html': G('RTG Sociaal: wat er tussen u en uw kring speelt, uit alle sociale apps tegelijk.',
    ['Bovenaan staat wat op u wacht: een onbeantwoord gesprek, een bijeenkomst die eraan komt',
     'Tik een regel aan om naar de app te gaan die hem heeft; daar antwoordt en plaatst u',
     'Onderaan staat de hele sociale wereld, als er niets openstaat'],
    'Dit scherm praat zelf niet en plaatst zelf niets, met opzet. Er staat ook geen teller van volgers of likes: dit is een overzicht van wat er speelt, geen aansporing om vaker te kijken.'),
  '/apps/kantoor.html': G('RTG Kantoor: uw werkdag op een plek -- agenda, taken, documenten en gedeelde bestanden tegelijk.',
    ['Kijk bovenaan of er iets aandacht vraagt; wat rustig loopt blijft rustig',
     'Tik een regel aan om naar de app te gaan die hem heeft; daar maakt en wijzigt u',
     'Onderaan staat de hele kantoorwereld, als er nog niets openstaat'],
    'Dit scherm maakt zelf niets en wijzigt zelf niets, met opzet: een taak hoort op een plek te staan en niet op twee. Staat er "niet alles is opgehaald", lees dat dan als een onvolledige werkdag en niet als een lege werkdag.'),
  '/apps/veilig.html': G('RTG Veilig: Thuiswacht, Codewoord, Vitaal en Thuisrust als vier standen van een app, op een kring die je een keer instelt.',
    ['Wissel bovenin van stand: onderweg, stil om hulp vragen, dagelijks melden, of rust',
     'Vul je kring een keer; alle vier de standen gebruiken dezelfde mensen',
     'Stuur een keer een proefalarm, zodat je weet dat de keten echt werkt'],
    'De klok tikt op de server en niet in de app, dus het werkt juist wel als je telefoon uitvalt. Wat het niet is: een alarmcentrale -- er wordt niemand gebeld en er kijkt geen mens mee.'),
  '/apps/werkruimte.html': G('RTG Workspace: uw werkruimte op een groot scherm, waar meerdere RTG-apps naast elkaar draaien en elkaar begrijpen.',
    ['Open een wereld uit de console links; hij verschijnt als eigen vlak',
     'Pak de gouden greep bovenaan een vlak om het te verplaatsen, of sleep het naar een schermrand om het vast te zetten',
     'Druk op Cmd-K (of Ctrl-K) om iets te zoeken of te openen zonder de muis'],
    'Dit is geen grotere telefoon-app: op een groot scherm hoort er meer RTG te staan, niet hetzelfde maar uitgerekt. De apps blijven zelfstandig; de werkruimte verbindt ze alleen.')
};
