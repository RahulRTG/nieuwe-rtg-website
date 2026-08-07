  /* DE MAPPEN VAN HET BEGINSCHERM -- afgesplitst uit ./app-main-24.js.

     Dat deel droeg twee dingen: WELKE apps er zijn (OSAPPS/LINKS) en HOE ze op
     het beginscherm in mappen liggen. Samen gingen ze over de 10 KB-lat, en de
     knip loopt langs die grens: hierboven de catalogus, hier de indeling.

     Dit deel deelt de scope van de bundel (zie scripts/bundel.js). */
  const MAPPEN = [
    { sleutel: 'map-reizen', naam: 'Reizen', secties: [
      { naam: 'Plannen', items: ['tab:reizen', 'link:vluchten', 'link:residentie'] },
      { naam: 'Onderweg', items: ['tab:terplaatse', 'link:navigatie', 'link:ov', 'link:flits', 'link:stad'] }
    ] },
    { sleutel: 'map-geld', naam: 'Geld', secties: [
      { naam: 'Betalen', items: ['tab:betalen', 'link:wallet', 'link:rtgcode', 'tab:bestellen'] },
      { naam: 'Rekeningen', items: ['link:bank', 'link:balans', 'link:loonstrook'] },
      { naam: 'Samen en bezit', items: ['link:wbw', 'tab:assets', 'link:labfonds'] }
    ] },
    { sleutel: 'map-salon', naam: 'De Salon', secties: [
      { naam: 'Delen', items: ['tab:salon', 'link:pulse', 'os:snaps', 'link:camera', 'link:mediaos', 'link:clips'] },
      { naam: 'Mensen', items: ['link:vrienden', 'link:vonk'] },
      { naam: 'Kijken en luisteren', items: ['link:muziek', 'link:theater', 'link:podium', 'link:spelen'] },
      { naam: 'Lezen', items: ['link:nieuws', 'link:krant', 'link:sport'] }
    ] },
    { sleutel: 'map-huis', naam: 'Het Huis', secties: [
      { naam: 'Thuis', items: ['link:ontdek', 'tab:zorg', 'tab:gezin', 'link:thuiswacht', 'link:thuisrust', 'link:vitaal'] },
      { naam: 'Leren', items: ['os:rtf', 'link:school'] },
      { naam: 'Werken', items: ['os:werk', 'link:office', 'link:sitemaker', 'link:browser'] },
      { naam: 'Uzelf', items: ['link:ik', 'link:passkeys', 'link:codewoord', 'link:juridisch'] }
    ] },
    /* Het Privekantoor staat als VIJFDE brede app op het beginscherm en niet
       meer als tegel binnen Het Huis. Bij twintigduizend euro per maand is het
       geen onderdeel van je huis; het is de reden dat je die pas hebt. Voor een
       RTG-pas valt hij vanzelf weg (PREMIUM + itemZichtbaar), en dan staan er
       vier. */
    { sleutel: 'map-kantoor', naam: 'Privekantoor', secties: [
      { naam: 'Uw kantoor', items: ['link:rechterhand'] }
    ] }
  ];

  /* De vlakke itemlijst per map wordt AFGELEID uit de secties en niet apart
     bijgehouden. Spotlight, de zijpanelen en de volgorde-bewaring lezen
     `map.items`; zou die naast `secties` bestaan, dan vergeet iemand op een dag
     de ene bij te werken en verdwijnt een app stil uit het zoeken terwijl hij op
     het scherm staat. Regel 4 van de lat, op een plek waar het echt gebeurt. */
  for (const mp of MAPPEN) mp.items = mp.secties.reduce((a, s) => a.concat(s.items), []);

  /* De premium-suite bestaat alleen voor Lifestyle en Business. De registry kent
     de apps voor iedereen; hier staat wie ze mag zien, zodat een RTG-pas ze niet
     in zijn mappen of in Spotlight tegenkomt.

     Sinds Het Privekantoor staat hiervan nog EEN in de mappen: 'rechterhand',
     dat /apps/lifestyle.html opent. De andere dertien zijn geen tegels meer maar
     KAMERS binnen die app -- je komt er via de plattegrond, en de app legt de
     verbanden die je zelf moest leggen toen het dertien losse tegels waren.
     Ze blijven wel in deze lijst: de pagina's bestaan nog, worden gelinkt vanuit
     het kantoor en zijn nog in Spotlight te vinden. Een oude link mag niets
     opleveren is de regel; uit de mappen halen is iets anders dan opheffen. */
  const PREMIUM = new Set(['rechterhand', 'reisboek', 'cellier', 'table', 'maison', 'garderobe',
    'mecenaat', 'nalatenschap', 'logboek', 'cercle', 'hangar', 'entourage', 'attenties', 'rendezvous']);
  const premiumPas = pas === 'lifestyle' || pas === 'business';

