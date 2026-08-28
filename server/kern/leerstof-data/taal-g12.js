/* RTG School, leerlijn taal groep 1 en 2. Hoort bij ./taal-g34.js, -g56 en
   -g78; ./taal.js voegt ze samen.

   Zelfde opbouw als bij rekenen: elk doel draagt zijn voorkennis, twee of drie
   manieren om hetzelfde uit te leggen, en generator-parameters. Waar de oude
   leerlijn vijf handgeschreven woordparen had, staat er nu een woordbank met
   een regel: de motor maakt de fout zelf, dus elk woord in de bank is een
   verse opgave. */
module.exports.TAAL_G12 = [
  { groep: 1, doelen: [
    { id: 'taal.g1.letters-horen', naam: 'Letters horen',
      les: 'Elk woord begint met een klank. Zeg het woord langzaam: vvv-is. Hoor je de v vooraan?',
      uitleg: [
        { soort: 'stap', tekst: 'Rek de eerste klank uit tot je hem alleen hoort: mmmmaan. Die klank hoort bij de letter die je zoekt.' },
        { soort: 'praktijk', tekst: 'Zoek in huis dingen die met dezelfde klank beginnen: stoel, sok, stok. Je oor leert het sneller dan je ogen.' }],
      gen: { soort: 'letter', woorden: ['vis', 'maan', 'roos', 'boom', 'sok', 'pen', 'kat', 'bal', 'huis', 'tak', 'zon', 'muur', 'deur', 'lamp', 'neus'] } },
    { id: 'taal.g1.rijmen', naam: 'Rijmen',
      les: 'Rijmwoorden klinken aan het eind hetzelfde: kat en mat, boom en zoom. Luister naar het einde van het woord.',
      uitleg: [
        { soort: 'stap', tekst: 'Zeg het woord en laat het begin weg: -at. Zoek dan een woord dat ook op -at eindigt.' },
        { soort: 'verhaal', tekst: 'In liedjes en versjes rijmt het einde van de regels. Daarom onthoud je een versje makkelijker dan een gewone zin.' }],
      gen: { soort: 'rijm', paren: [['kat', 'mat', 'boom'], ['muis', 'huis', 'pen'], ['bal', 'stal', 'vis'], ['zon', 'ton', 'kaas'],
        ['boom', 'zoom', 'muur'], ['haas', 'kaas', 'stoel'], ['pet', 'net', 'raam'], ['deur', 'kleur', 'bal']] } },
    { id: 'taal.g1.alfabet-start', naam: 'De letters op volgorde',
      les: 'Het alfabet is de vaste volgorde van alle letters: a, b, c... In een woordenboek en op een naamlijst staat alles zo geordend.',
      vereist: ['taal.g1.letters-horen'],
      uitleg: [
        { soort: 'stap', tekst: 'Kijk naar de eerste letter van elk woord. De letter die het vroegst in het alfabet zit, staat vooraan.' },
        { soort: 'praktijk', tekst: 'Namen in de klas, boeken in de kast, woorden in een woordenboek: overal is het dezelfde volgorde.' }],
      gen: { soort: 'alfabet', woorden: ['appel', 'boot', 'citroen', 'druif', 'egel', 'fiets', 'geit', 'huis', 'ijs', 'jas', 'kat', 'lamp', 'muis', 'noot'] } }
  ]},

  { groep: 2, doelen: [
    { id: 'taal.g2.hakken-plakken', naam: 'Hakken en plakken',
      les: 'Een woord kun je in stukjes hakken: b-oo-m. Plak je de klanken weer aan elkaar, dan hoor je het woord.',
      vereist: ['taal.g1.letters-horen'],
      uitleg: [
        { soort: 'stap', tekst: 'Hak het woord in losse klanken en zeg ze een voor een. Plak ze daarna steeds sneller aan elkaar tot je het woord hoort.' },
        { soort: 'visueel', tekst: 'Leg voor elke klank een blokje neer. Schuif de blokjes tegen elkaar aan: dat is plakken.' }],
      gen: { soort: 'letter', woorden: ['boom', 'vis', 'poes', 'deur', 'raam', 'tuin', 'bank', 'klok', 'stoel', 'trein', 'schaap', 'brood'] } },
    { id: 'taal.g2.eerste-woorden', naam: 'Je eerste woorden lezen',
      les: 'Korte woorden lees je klank voor klank: k-a-t is kat. Hoe vaker je het ziet, hoe sneller het gaat.',
      vereist: ['taal.g2.hakken-plakken'],
      uitleg: [
        { soort: 'stap', tekst: 'Lees eerst hardop klank voor klank. Zeg daarna het hele woord in een keer. Zo gaat lezen van hakken naar herkennen.' },
        { soort: 'eenvoudig', tekst: 'Een woord dat je vaak ziet, hoef je op een dag niet meer te hakken: je herkent het zoals je een gezicht herkent.' }],
      gen: { soort: 'spel', fout: 'dubbel-eind', fout2: 'klinker-wissel',
        woorden: ['kat', 'vis', 'zon', 'bal', 'pen', 'bos', 'tak', 'mug', 'pit', 'kip', 'net', 'rok', 'zak', 'lip'] } },
    { id: 'taal.g2.lidwoorden', naam: 'De of het',
      les: 'Bijna elk woord heeft een vast lidwoord: de tafel, het huis. Er is geen regel voor; je leert ze door te horen en te lezen.',
      vereist: ['taal.g2.eerste-woorden'],
      uitleg: [
        { soort: 'praktijk', tekst: 'Verkleinwoorden krijgen altijd het: het tafeltje, het huisje. Dat is de enige regel die echt altijd klopt.' },
        { soort: 'eenvoudig', tekst: 'Twijfel je? Zeg het hardop met allebei. Vaak hoor je meteen welke goed klinkt.' }],
      gen: { soort: 'lidwoord', woorden: [['huis', 'het'], ['tafel', 'de'], ['boek', 'het'], ['stoel', 'de'], ['raam', 'het'],
        ['deur', 'de'], ['bed', 'het'], ['school', 'de'], ['brood', 'het'], ['fiets', 'de'], ['kind', 'het'], ['hond', 'de'],
        ['paard', 'het'], ['boom', 'de'], ['water', 'het'], ['straat', 'de']] } }
  ]}
];
