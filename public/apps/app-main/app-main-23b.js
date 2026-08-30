  /* Afgesplitst van app-main-23.js, dat met dit blok over de 10 KB ging
     (keuringsregel 13). De snede loopt midden door LINKS -- dat mag hier, want
     de bundel plakt de delen rauw aan elkaar (scripts/bundel.js) en 24a2/24a2b
     doen precies hetzelfde met MAPPEN. De naad ligt op een echte grens: hierbo-
     ven staat wat er altijd al hing, hieronder wat de tikkenmeting vond. */
    /* ---------- VEERTIEN SCHERMEN DIE NERGENS AAN HINGEN ----------
       Gevonden met scripts/tikken.js op 30 augustus 2026: die meter loopt het
       huis af vanaf het beginscherm op telefoonformaat en vraagt per scherm
       hoeveel tikken het kost. Tweeenvijftig schermen bleken vanaf het
       beginscherm HELEMAAL niet te bereiken -- niet diep, maar los.

       Van die tweeenvijftig zijn dit de schermen van een LID. De rest is met
       reden onbereikbaar en staat als zodanig genoemd in scripts/tikken.js:
       schermen van een rol (de kantoren, de PDA's, de leverancierskant) komen
       niet op een beginscherm van een lid, en vier adressen zijn een stand van
       een andere app geworden (Metier, Codewoord, Thuisrust, Thuiswacht) en
       horen dus juist NIET opnieuw als tegel te bestaan.

       Ze krijgen hier een sleutel en hangen hieronder in de wereld waar de mens
       denkt te zijn als hij ze gebruikt (WERELDEN.md), niet in de wereld van
       wie ze gebouwd heeft.

       TWEE STAAN ER NIET BIJ, en dat is geen vergeten maar een bestaand besluit:
       /apps/gast.html en /apps/festival-gast.html zijn LANDINGSPAGINA'S. Je komt
       daar door een code op een tafel te scannen of via de link van je groep, en
       scripts/lib/bereik.js zegt dat met zoveel woorden (MAG_LOS). Ze alsnog in
       een wereld hangen zou een deur maken naar een tafel waar u niet zit. */
    mall:        { naam: 'Mall',          url: '/apps/mall.html' },
    mijnmall:    { naam: 'Mijn bestellingen', url: '/apps/mijnmall.html' },
    pay:         { naam: 'Betalen',       url: '/apps/pay.html' },
    huis:        { naam: 'Thuis',         url: '/apps/thuis.html' },
    uitgaan:     { naam: 'Uitgaan',       url: '/apps/uitgaan.html' },
    foodcourt:   { naam: 'Food Court',    url: '/apps/foodcourt.html' },
    spelavond:   { naam: 'Game Night',    url: '/apps/spelscherm.html' },
    tweedescherm:{ naam: 'Tweede scherm', url: '/apps/scherm.html' },
    /* Het inkoopdossier staat bij het LID en niet achter een kantoorpoort
       (APPSTORE.md). Dat het nergens aan hing, maakte die belofte leeg. */
    appdossier:  { naam: 'App-dossier',   url: '/apps/appstore-dossier.html' },
    aankomst:    { naam: 'Aankomst',      url: '/apps/arrival.html' },
    routedossier:{ naam: 'Routedossier',  url: '/apps/routedossier.html' },
    ovroutes:    { naam: 'OV-routes',     url: '/apps/ovroutes.html' },
    rtfbord:     { naam: 'Het bord',      url: '/apps/foundation/bord.html' },
    rtfschrift:  { naam: 'Het schrift',   url: '/apps/foundation/schrift.html' },
