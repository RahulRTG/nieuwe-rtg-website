/* RTG School, leerlijn VO verbreed (deel 2): biologie, geschiedenis,
   aardrijkskunde, maatschappijleer en Duits. Zelfde blokvorm als vo.js. */
const VMBO = ['vmbo-bb', 'vmbo-kb', 'vmbo-gl', 'vmbo-tl'];
const ALLE_VO = VMBO.concat(['havo', 'vwo']);

module.exports.VO2 = [
  { vak: 'biologie', fasen: ALLE_VO, doelen: [
    { id: 'biologie.vo.cellen', naam: 'Cellen: de bouwstenen van het leven', ref: '2F',
      les: 'Alles wat leeft bestaat uit cellen. Plantencellen hebben een celwand en bladgroenkorrels; dierlijke cellen niet. De kern is het regelcentrum met het DNA.',
      gen: { soort: 'mc', vragen: [
        ['Wat is het regelcentrum van de cel?', 'de celkern', 'de celwand', 'het celvocht'],
        ['Wat hebben plantencellen wel en dierlijke cellen niet?', 'een celwand', 'een kern', 'celvocht'],
        ['Waar zit het DNA?', 'in de celkern', 'in de celwand', 'buiten de cel'],
        ['Waarmee maken plantencellen voedsel?', 'bladgroenkorrels', 'de celkern', 'de celwand']
      ] } },
    { id: 'biologie.vo.lichaam', naam: 'Organen en orgaanstelsels', ref: '2F',
      les: 'Organen werken samen in stelsels: hart en bloedvaten vervoeren, longen wisselen zuurstof, nieren zuiveren het bloed en de lever verwerkt voedingsstoffen.',
      gen: { soort: 'mc', vragen: [
        ['Welk orgaan zuivert het bloed?', 'de nieren', 'de longen', 'de maag'],
        ['Wat vervoert zuurstof door je lichaam?', 'het bloed', 'de zenuwen', 'de spieren'],
        ['Waar vindt de gaswisseling plaats?', 'in de longblaasjes', 'in de maag', 'in de lever'],
        ['Welk stelsel stuurt je lichaam aan met signalen?', 'het zenuwstelsel', 'het spijsverteringsstelsel', 'het skelet']
      ] } }
  ]},
  { vak: 'geschiedenis', fasen: ALLE_VO, doelen: [
    { id: 'geschiedenis.vo.tijdvakken', naam: 'De tien tijdvakken', ref: '2F',
      les: 'De geschiedenis is verdeeld in tien tijdvakken, van jagers en boeren tot de tijd van televisie en computer. Zo kun je gebeurtenissen op de tijdbalk plaatsen.',
      gen: { soort: 'mc', vragen: [
        ['Welk tijdvak komt het eerst?', 'jagers en boeren', 'ridders en kastelen', 'pruiken en revoluties'],
        ['De Gouden Eeuw hoort bij de tijd van:', 'regenten en vorsten', 'jagers en boeren', 'wereldoorlogen'],
        ['De industriele revolutie draaide om:', 'fabrieken en machines', 'kastelen', 'hunebedden'],
        ['In welk tijdvak leven wij?', 'de tijd van televisie en computer', 'de tijd van monniken en ridders', 'de tijd van ontdekkers']
      ] } }
  ]},
  { vak: 'aardrijkskunde', fasen: ALLE_VO, doelen: [
    { id: 'aardrijkskunde.vo.klimaat', naam: 'Klimaten en landschappen', ref: '2F',
      les: 'Het klimaat hangt af van de ligging: bij de evenaar is het warm en nat, bij de polen koud. Nederland heeft een gematigd zeeklimaat: zachte winters, koele zomers.',
      gen: { soort: 'mc', vragen: [
        ['Welk klimaat heeft Nederland?', 'gematigd zeeklimaat', 'tropisch klimaat', 'woestijnklimaat'],
        ['Bij de evenaar is het meestal:', 'warm en nat', 'koud en droog', 'altijd winter'],
        ['Wat beschermt Nederland tegen de zee?', 'duinen en dijken', 'bergen', 'bossen'],
        ['Een rivierdelta is:', 'het gebied waar een rivier in zee uitmondt', 'een bergtop', 'een woestijn']
      ] } }
  ]},
  { vak: 'maatschappijleer', fasen: ALLE_VO, doelen: [
    { id: 'maatschappijleer.vo.rechtsstaat', naam: 'De rechtsstaat', ref: '2F',
      les: 'In een rechtsstaat geldt de wet voor iedereen, ook voor de regering. Rechters zijn onafhankelijk, en grondrechten zoals vrijheid van meningsuiting beschermen jou.',
      gen: { soort: 'mc', vragen: [
        ['Voor wie geldt de wet in een rechtsstaat?', 'voor iedereen, ook de regering', 'alleen voor burgers', 'alleen voor de politie'],
        ['Wat is een grondrecht?', 'vrijheid van meningsuiting', 'gratis snoep', 'altijd gelijk krijgen'],
        ['Waarom zijn rechters onafhankelijk?', 'zodat niemand de uitspraak kan sturen', 'omdat ze geen wetten kennen', 'omdat ze niet stemmen'],
        ['De trias politica verdeelt de macht in:', 'wetgevend, uitvoerend en rechtsprekend', 'noord, oost en zuid', 'jong, oud en rijk']
      ] } }
  ]},
  { vak: 'duits', fasen: ALLE_VO, doelen: [
    { id: 'duits.vo.woordenschat', naam: 'Duitse basiswoordenschat', ref: '2F',
      les: 'Duits lijkt op Nederlands, maar let op de valse vrienden: "bellen" is blaffen en "See" kan meer of zee zijn. Begin met de woorden van elke dag.',
      gen: { soort: 'mc', vragen: [
        ['Wat betekent "das Haus"?', 'het huis', 'de haas', 'de hut'],
        ['Wat is Duits voor "school"?', 'die Schule', 'der Stuhl', 'die Schale'],
        ['Wat betekent "bellen" in het Duits?', 'blaffen', 'telefoneren', 'bellen blazen'],
        ['Wat betekent "die Woche"?', 'de week', 'de wolk', 'het woord'],
        ['Wat is Duits voor "dank je wel"?', 'danke schön', 'bitte schön', 'guten Tag']
      ] } }
  ]}
];
