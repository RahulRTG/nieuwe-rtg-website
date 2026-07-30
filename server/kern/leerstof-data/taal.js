/* RTG School, leerlijn taal en spelling groep 1 t/m 8. Zelfde opbouw als de
   rekenleerlijn: vaste doel-ids, een korte les in gewone taal, en generator-
   parameters. Bij taal put de oefenmotor uit woordpakketten per regel:
   'kies' laat de goede en een fout gespelde vorm zien, 'dt' vervoegt
   werkwoorden, 'rijm' en 'letter' zijn voor de kleuters. */
module.exports.TAAL = [
  { groep: 1, doelen: [
    { id: 'taal.g1.letters-horen', naam: 'Letters horen', les: 'Elk woord begint met een klank. Zeg het woord langzaam: vvv-is. Hoor je de v vooraan?', gen: { soort: 'letter', woorden: ['vis', 'maan', 'roos', 'boom', 'sok', 'pen', 'kat', 'bal'] } },
    { id: 'taal.g1.rijmen', naam: 'Rijmen', les: 'Rijmwoorden klinken aan het eind hetzelfde: kat en mat, boom en zoom. Luister naar het einde van het woord.', gen: { soort: 'rijm', paren: [['kat', 'mat', 'boom'], ['muis', 'huis', 'pen'], ['bal', 'stal', 'vis'], ['zon', 'ton', 'kaas']] } }
  ]},
  { groep: 2, doelen: [
    { id: 'taal.g2.hakken-plakken', naam: 'Hakken en plakken', les: 'Een woord kun je in stukjes hakken: b-oo-m. Plak je de klanken weer aan elkaar, dan hoor je het woord.', gen: { soort: 'letter', woorden: ['boom', 'vis', 'poes', 'deur', 'raam', 'tuin', 'bank', 'klok'] } },
    { id: 'taal.g2.eerste-woorden', naam: 'Je eerste woorden lezen', les: 'Korte woorden lees je klank voor klank: k-a-t is kat. Hoe vaker je het ziet, hoe sneller het gaat.', gen: { soort: 'kies', paren: [['kat', 'kot'], ['vis', 'ves'], ['zon', 'son'], ['bal', 'bol'], ['pen', 'pin']] } }
  ]},
  { groep: 3, doelen: [
    { id: 'taal.g3.mkm-woorden', naam: 'Korte woorden goed schrijven', les: 'Schrijf wat je hoort: eerst de beginklank, dan de klinker, dan de eindklank. K-a-t: kat.', gen: { soort: 'kies', paren: [['bos', 'bosch'], ['vel', 'vell'], ['tak', 'tack'], ['mug', 'mugg'], ['pit', 'pid']] } },
    { id: 'taal.g3.tweeklanken', naam: 'Woorden met au, ou, ei en ij', les: 'Sommige klanken kun je op twee manieren schrijven. Die woorden moet je gewoon kennen: pauw met au, jij met de lange ij.', gen: { soort: 'kies', paren: [['pauw', 'pouw'], ['trein', 'trijn'], ['blauw', 'blouw'], ['ijs', 'eijs'], ['kous', 'kaus']] } }
  ]},
  { groep: 4, doelen: [
    { id: 'taal.g4.sch-ng-nk', naam: 'Woorden met sch, ng en nk', les: 'School schrijf je met sch, ook al hoor je de h bijna niet. Bang eindigt op ng, bank op nk: luister naar de k.', gen: { soort: 'kies', paren: [['school', 'sgool'], ['schaap', 'sgaap'], ['bang', 'bangk'], ['ring', 'rink'], ['drinken', 'drinkken']] } },
    { id: 'taal.g4.aai-ooi-oei', naam: 'Woorden met aai, ooi en oei', les: 'Haai, mooi en groei: je hoort een j maar schrijft een i. Aai, ooi en oei zijn vaste rijtjes.', gen: { soort: 'kies', paren: [['haai', 'haaj'], ['mooi', 'mooj'], ['groei', 'groej'], ['draai', 'draaj'], ['kooi', 'kooj']] } }
  ]},
  { groep: 5, doelen: [
    { id: 'taal.g5.open-gesloten', naam: 'Open en gesloten lettergrepen', les: 'Bomen heeft een open lettergreep: bo-men, een o die zichzelf lang maakt. Bommen heeft er twee m-en om de o kort te houden.', gen: { soort: 'kies', paren: [['bomen', 'boomen'], ['muren', 'muuren'], ['spelen', 'speelen'], ['ramen', 'raamen'], ['lopen', 'loopen']] } },
    { id: 'taal.g5.eind-d-t', naam: 'Een d of een t aan het eind', les: 'Hoor je een t aan het eind? Maak het woord langer: hond wordt honden, dus schrijf je een d.', gen: { soort: 'kies', paren: [['hond', 'hont'], ['paard', 'paart'], ['brood', 'broot'], ['bord', 'bort'], ['hand', 'hant']] } }
  ]},
  { groep: 6, doelen: [
    { id: 'taal.g6.verkleinwoorden', naam: 'Verkleinwoorden', les: 'Klein maken doe je met -je, -tje of -pje: boom wordt boompje, ring wordt ringetje. Luister welk stukje past.', gen: { soort: 'kies', paren: [['boompje', 'boomje'], ['ringetje', 'ringtje'], ['visje', 'vissje'], ['mannetje', 'mantje'], ['koninkje', 'koningje']] } },
    { id: 'taal.g6.cht-ch', naam: 'Woorden met cht en ch', les: 'Lucht, nacht en zacht: na een korte klank schrijf je meestal cht. Behalve in hij ligt en hij zegt -- dat is werkwoordspelling.', gen: { soort: 'kies', paren: [['lucht', 'lugt'], ['nacht', 'nagt'], ['zacht', 'zagt'], ['dochter', 'dogter'], ['kracht', 'kragt']] } }
  ]},
  { groep: 7, doelen: [
    { id: 'taal.g7.ww-tt', naam: 'Werkwoorden in de tegenwoordige tijd', les: 'Ik-vorm is de stam: ik loop. Bij jij, hij en zij komt er een t bij: hij loopt. Jij achter het werkwoord? Dan valt de t weer weg: loop jij.', gen: { soort: 'dt', tijd: 'tt', ww: [['lopen', 'loop', 'loopt'], ['worden', 'word', 'wordt'], ['vinden', 'vind', 'vindt'], ['antwoorden', 'antwoord', 'antwoordt'], ['rijden', 'rijd', 'rijdt']] } },
    { id: 'taal.g7.leestekens', naam: 'Hoofdletters en leestekens', les: 'Een zin begint met een hoofdletter en eindigt met een punt, vraagteken of uitroepteken. Namen krijgen altijd een hoofdletter.', gen: { soort: 'kies', paren: [['Wij gaan morgen naar Ibiza.', 'wij gaan morgen naar ibiza'], ['Kom je ook?', 'Kom je ook.'], ['Amsterdam is een stad.', 'amsterdam is een stad.']] } }
  ]},
  { groep: 8, doelen: [
    { id: 'taal.g8.ww-vt', naam: 'Werkwoorden in de verleden tijd', les: 'Kofschip-truc: eindigt de ik-vorm op een letter uit het kofschip (t, k, f, s, ch, p), dan krijgt de verleden tijd -te, anders -de. Werkte, maar speelde. Dit is het 1F-fundament.', ref: '1F', gen: { soort: 'dt', tijd: 'vt', ww: [['werken', 'werkte', 'werkten'], ['spelen', 'speelde', 'speelden'], ['fietsen', 'fietste', 'fietsten'], ['verhuizen', 'verhuisde', 'verhuisden'], ['praten', 'praatte', 'praatten']] } },
    { id: 'taal.g8.voltooid-dw', naam: 'Het voltooid deelwoord', les: 'Gebeurd of gebeurt? Voltooid deelwoord maak je langer: het gebeurde ding -- dus een d. Hij gebeurt nu -- stam + t.', ref: '1F', gen: { soort: 'kies', paren: [['Het is gebeurd.', 'Het is gebeurt.'], ['Hij heeft gewerkt.', 'Hij heeft gewerkd.'], ['Zij is verhuisd.', 'Zij is verhuist.'], ['Het is gelukt.', 'Het is gelukd.']] } },
    { id: 'taal.g8.samenstellingen', naam: 'Aan elkaar of los', les: 'Samenstellingen schrijf je aan elkaar: basisschool, voetbalveld. Twijfel je? Als het een ding is, is het een woord.', ref: '1S', gen: { soort: 'kies', paren: [['basisschool', 'basis school'], ['voetbalveld', 'voetbal veld'], ['zonnebril', 'zonne bril'], ['boekenkast', 'boeken kast']] } }
  ]}
];
