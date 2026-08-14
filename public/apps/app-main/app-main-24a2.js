
  /* Afgesplitst van app-main-24.js, dat over de 10 KB ging. De snede loopt
     langs een echte grens: hierboven staat de registry van alle apps en de
     vaste functierij, hieronder de MAPPEN waarin die apps vallen en de vraag
     welke ervan bij welke pas horen. */
  /* ---------- de mappen, boven de klok ----------
     Zeven mappen, een rij van vier en een rij van drie, en daar zit alles in
     waar je pas je recht op geeft. Niets installeren: het staat er al. Wil je
     iets niet zien, dan zet je het uit in de Boardroom (die zet het uit, hij
     hoeft het niet aan te zetten).

     WAAROM ZEVEN, EN NIET VIER OF ACHT.

     Het waren er VIER, en dat leek rustig tot je ze opendeed: De Salon droeg
     eenentwintig apps en Het Huis zeventien. Een map met eenentwintig tegels
     is geen map maar een lade waar je in graait, en het verschil tussen
     "muziek" en "een vriend appen" was er niet meer aan af te zien.

     Toen werden het er ACHT, en dat was één te veel -- maar dat zag je alleen
     als je op de goede pas keek. De tegels tellen namelijk niet voor iedereen
     hetzelfde: veertien apps zijn Lifestyle/Business (zie PREMIUM hieronder)
     en vallen voor een RTG-pas vanzelf weg. Het Huis had ik gevuld met Maison,
     Table, Cellier, Garde-robe en De Rechterhand -- alle vijf premium -- dus
     een Business-lid zag daar acht tegels en een RTG-lid drie. Dezelfde map,
     half zo vol, precies onderaan. Dat is exact wat de merkregel verbiedt: de
     instappas mag nooit budget aanvoelen.

     Nageteld over alle 62 items is er materiaal voor ZEVEN mappen die op
     allebei de passen gevuld staan, en niet voor acht. De zorgkant is daarom
     terug in Het Huis -- waar zorg, gezin en rust ook horen -- en de tweede
     rij telt drie mappen in plaats van vier. Een rij van drie is geen
     halfvolle rij van vier: hij staat gecentreerd onder de eerste (zie
     .os-mappen in apps/app.html), dus het leest als een vorm en niet als een
     gat.

     Tellingen per pas, gemeten en niet geschat (RTG / Business):
     Reizen 8/10, Geld 7/10, De Salon 6/10, Het Huis 6/12,
     Media 8/8, Werk 7/7, Veilig 4/4.

     Een map heeft een vaste sleutel (waar je eigen naam onder bewaard wordt),
     een standaardnaam en zijn apps. Apps die voor jouw pas niet bestaan
     vallen er vanzelf uit (itemZichtbaar). Een app staat in precies EEN map:
     twee plekken voor hetzelfde is precies waarom je hem nergens meer vindt. */
  const MAPPEN = [
    /* --- eerste rij --- */
    { sleutel: 'map-rtg', naam: 'RTG', wereld: '/apps/rtg.html', glyf: 'rtg', items: [
      'tab:reizen', 'link:reizen', 'tab:terplaatse', 'link:vluchten', 'link:ov', 'link:navigatie',
      'link:flits', 'link:stad', 'link:reisboek', 'link:hangar', 'link:residentie',
      'tab:betalen', 'link:wallet', 'link:bank', 'link:wbw', 'link:rtgcode',
      'link:balans', 'tab:assets', 'link:labfonds', 'link:mecenaat',
      'link:nalatenschap', 'link:logboek',
    /* De Salon is weer De Salon: mensen en wat je met ze deelt. Wat je in je
       eentje kijkt of luistert staat bij Media. */
      'tab:salon', 'link:pulse', 'link:vrienden', 'os:snaps', 'link:camera',
      'link:vonk', 'link:cercle', 'link:entourage', 'link:rendezvous', 'link:attenties',
    /* Het Huis is het huishouden in de brede zin: waar je woont, wat er op
       tafel komt, wat er in de kast hangt -- en hoe het met de mensen erin
       gaat. Die laatste helft (zorg, gezin, vitaal, rust) stond even in een
       eigen map Zorg; die is hier terug, want zonder haar was Het Huis op een
       RTG-pas een map met drie tegels. De kantoorkant zit bij Werk. */
    /* os:rtf stond hier, en staat nu in zijn eigen wereld hieronder. Regel 44
       in scripts/check.js ving dat meteen: een app in twee werelden is precies
       waarom je hem nergens meer vindt. */
      'link:ontdek', 'tab:bestellen', 'tab:zorg', 'tab:gezin',
      'link:rechterhand',
      'link:maison', 'link:table', 'link:cellier', 'link:garderobe',

    /* --- tweede rij, gecentreerd --- */
      'link:muziek', 'link:podium', 'link:theater', 'link:clips', 'link:spelen',
      'link:nieuws', 'link:krant', 'link:sport',
      'link:ik', 'link:veilig', 'link:passkeys', 'link:juridisch'] },
    { sleutel: 'map-werk', naam: 'RTG Kantoor', wereld: '/apps/kantoor.html', glyf: 'office', items: [
      'link:rtgone', 'link:rtmail', 'link:magnaat', 'link:office', 'os:werk', 'link:onderneming', 'link:loonstrook', 'link:school',
      'link:browser', 'link:sitemaker'] },
    /* Veilig: wie je bent en wie er over je waakt. De vier apps op dezelfde
       kern zijn een app met vier standen geworden (zie de opmerking bij LINKS),
       plus de sleutels waarmee je binnenkomt. Drie is hier geen tekort maar de
       hele set -- dit is de enige map die op elke pas even groot is.

       Vitaal en Thuisrust stonden bij Het Huis en niet hier, omdat ze over zorg
       en huishouden gingen. Nu ze standen zijn van een app, kan die app maar in
       een map staan (geen enkel item staat in twee mappen) en dat is deze:
       waar de andere twee standen ook al woonden. Het Huis houdt zorg en gezin
       als eigen tabbladen, dus daar verdwijnt het onderwerp niet.

       Juridisch komt hier vandaan uit de map Werk. Vier tegels werden een, en
       daarmee zakte deze map naar drie -- onder de ondergrens die
       test/appmenu.e2e.js bewaakt, en die ondergrens is er niet voor niets: een
       bijna lege map op de instappas is precies waar de merkregel over gaat.
       Juridisch is geen noodgreep om een gat te vullen maar hoort hier: de
       app-bibliotheek zet hem zelf al in de categorie "Veiligheid & identiteit"
       naast Wie ben ik en Passkeys, en het gaat over jouw voorwaarden en jouw
       akkoorden -- wie je bent, niet waar je werkt. Werk houdt zes tegels. */
    /* De achtste wereld. De stichting stond als EEN tegel binnen Het Huis
       ('os:rtf'), terwijl ze zeventien onderdelen, een eigen service worker en
       een eigen huis heeft. Een wereld die als tegel in een andere wereld
       hangt, is geen wereld. */
    /* De wereldtegel NAVIGEERT naar het huis; een tweede item in deze lijst zou
       nooit in beeld komen (openMap navigeert, zie 26.js). Het
       levens-command-center staat daarom als tegel OP de hub zelf, in de
       oudersectie -- zie de opmerking daar over de twee sessiewerelden. */
    { sleutel: 'map-rtf', naam: 'RTFoundation', wereld: '/apps/foundation/index.html', glyf: 'rtf', items: ['os:rtf'] }
  ];

  /* De premium-suite (De Rechterhand) bestaat alleen voor Lifestyle en
     Business. De registry kent de apps voor iedereen; hier staat wie ze mag
     zien, zodat een RTG-pas ze niet in zijn mappen of in Spotlight tegenkomt. */
  const PREMIUM = new Set(['rechterhand', 'reisboek', 'cellier', 'table', 'maison', 'garderobe',
    'mecenaat', 'nalatenschap', 'logboek', 'cercle', 'hangar', 'entourage', 'attenties', 'rendezvous']);
  const premiumPas = pas === 'lifestyle' || pas === 'business';
