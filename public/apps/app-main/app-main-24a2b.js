  /* Afgesplitst van app-main-24a2.js, dat over de 10 KB ging (keuringsregel 13).
     De snede loopt langs een echte grens: hierboven de drie werelden waarin een
     lid leeft, werkt en reist, hier FoundationOS -- de wereld die als laatste
     bijkwam. De MAPPEN-array loopt door over de snede heen; dat is geen
     uitzondering maar hoe deze bundel werkt (scripts/bundel.js plakt de delen
     eerst aaneen, en scripts/lib/wereldregister.js leest ze zo ook). */
    /* De zelfstandige Foundation-wereld. De stichting stond als EEN tegel binnen Het Huis
       ('os:rtf'), terwijl ze zeventien onderdelen, een eigen service worker en
       een eigen huis heeft. Een wereld die als tegel in een andere wereld
       hangt, is geen wereld. */
    /* De wereldtegel NAVIGEERT naar het huis; een tweede item in deze lijst zou
       nooit in beeld komen (openMap navigeert, zie 26.js). Het
       levens-command-center staat daarom als tegel OP de hub zelf, in de
       oudersectie -- zie de opmerking daar over de twee sessiewerelden. */
    /* FOUNDATIONOS IS DE WERELD, RTFOUNDATION IS HET MERK ERIN. Van de 71
       schermen onder /apps/foundation/ gaan er acht over de stichting; de rest
       is het leven van een kind en hoort in LivingOS. Want de bouwer van een
       capability bepaalt niet in welke wereld hij hoort, de gebruikerscontext
       doet dat (WERELDEN.md). Die verhuizing staat daar als genoemde stap. */
    /* HET HUIS IS os-publiek EN NIET os-portaal, en dat scheelde een deur die naar
       het verkeerde publiek leidt. os.html is een kantoorconsole achter een
       kantoortoken ("KANTOORCODE"), os-portaal.html heet met zoveel woorden
       "Portaal voor partners, gemeenten en ondernemers", en os-publiek.html zegt
       "Wat wij doen, bij u in de buurt". Alleen dat laatste is een voordeur voor
       een lid; de andere twee zijn deuren BINNEN de wereld. */
    { sleutel: 'map-rtf', naam: 'FoundationOS', wereld: '/apps/foundation/os-publiek.html', glyf: 'rtf', items: [
      'link:rtfbuurt', 'link:rtfportaal',
    /* Twee uit de tikkenmeting (scripts/tikken.js): het bord en het schrift
       bestonden en hingen nergens aan. */
    /* Het Klimaatfonds is een VENSTER op het Living Lab en geen tweede lab:
       klimaat is daar de soort 'duurzaam' (kern/livinglab/kader.js). */
      'link:rtfbord', 'link:rtfschrift', 'link:klimaat'] }
  ];
