/* RTG School, leerlijn voortgezet onderwijs (vmbo, havo, vwo). Zelfde vorm
   als de PO-leerlijnen, maar per FASE uit de niveauladder in plaats van per
   groep: elk blok noemt de fasen waarvoor het geldt. De vmbo-doelen zijn de
   gedeelde basis; havo bouwt erop voort en vwo weer op havo. */
const VMBO = ['vmbo-bb', 'vmbo-kb', 'vmbo-gl', 'vmbo-tl'];

module.exports.VO = [
  { vak: 'wiskunde', fasen: VMBO.concat(['havo', 'vwo']), doelen: [
    { id: 'wiskunde.vo.procenten', naam: 'Rekenen met procenten', ref: '2F',
      les: 'Procent betekent per honderd. 25% van 80 reken je zo: 80 : 100 x 25 = 20. Handig ezelsbruggetje: 10% is delen door 10, en de rest bouw je daaruit op.',
      gen: { soort: 'procent', procenten: [10, 15, 20, 25, 50, 75] } },
    { id: 'wiskunde.vo.verhoudingen', naam: 'Verhoudingstabellen', ref: '2F',
      les: 'Een verhoudingstabel rekent via 1: weet je wat 3 stuks kosten, deel dan eerst door 3 (de prijs van 1) en vermenigvuldig daarna.',
      gen: { soort: 'verhouding', max: 40 } },
    { id: 'wiskunde.vo.kommagetallen', naam: 'Rekenen met kommagetallen', ref: '2F',
      les: 'Zet de getallen onder elkaar met de komma recht onder elkaar; dan tellen tienden bij tienden en eenheden bij eenheden.',
      gen: { soort: 'som', op: 'beide', max: 20, komma: true } },
    { id: 'wiskunde.vo.opp-omtrek', naam: 'Oppervlakte en omtrek', ref: '2F',
      les: 'Omtrek is eromheen lopen: 2 x (lengte + breedte). Oppervlakte is bedekken: lengte x breedte, in vierkante meters.',
      gen: { soort: 'opp', max: 12 } }
  ]},
  { vak: 'nederlands', fasen: VMBO.concat(['havo', 'vwo']), doelen: [
    { id: 'nederlands.vo.dt', naam: 'Werkwoordspelling (d/t)', ref: '2F',
      les: 'Tegenwoordige tijd: ik = stam, hij/zij = stam + t. Twijfel je? Vervang het werkwoord door lopen: hoor je "loopt", dan hoort er een t.',
      gen: { soort: 'dt', tijd: 'tt', ww: [['worden', 'word', 'wordt'], ['vinden', 'vind', 'vindt'], ['antwoorden', 'antwoord', 'antwoordt'], ['branden', 'brand', 'brandt']] } },
    { id: 'nederlands.vo.signaalwoorden', naam: 'Signaalwoorden en tekstverbanden', ref: '2F',
      les: 'Signaalwoorden verklappen het verband: "maar" is een tegenstelling, "omdat" een reden, "daarna" een tijdsvolgorde, "bijvoorbeeld" een voorbeeld.',
      gen: { soort: 'mc', vragen: [
        ['Welk signaalwoord hoort bij een TEGENSTELLING?', 'maar', 'omdat', 'daarna'],
        ['Welk signaalwoord hoort bij een REDEN?', 'omdat', 'maar', 'bijvoorbeeld'],
        ['Welk signaalwoord hoort bij een OPSOMMING?', 'bovendien', 'daarom', 'hoewel'],
        ['"Eerst... daarna..." is een verband van:', 'tijd', 'tegenstelling', 'voorbeeld'],
        ['Welk signaalwoord kondigt een VOORBEELD aan?', 'bijvoorbeeld', 'omdat', 'toch'],
        ['"Daarom" wijst op een:', 'gevolg', 'opsomming', 'tijdsvolgorde']
      ] } }
  ]},
  { vak: 'engels', fasen: VMBO.concat(['havo', 'vwo']), doelen: [
    { id: 'engels.vo.woordenschat', naam: 'Engelse basiswoordenschat', ref: '2F',
      les: 'Woorden leer je in tweetallen: het Engelse woord en het jouwe. Lees ze hardop; wat je hoort en zegt, onthoud je beter dan wat je alleen ziet.',
      gen: { soort: 'mc', vragen: [
        ['Wat betekent "science"?', 'wetenschap', 'schaduw', 'schaar'],
        ['Wat betekent "improve"?', 'verbeteren', 'bewijzen', 'invoeren'],
        ['Wat betekent "although"?', 'hoewel', 'altijd', 'allebei'],
        ['Wat is Engels voor "geschiedenis"?', 'history', 'story', 'memory'],
        ['Wat betekent "average"?', 'gemiddelde', 'avontuur', 'voordeel'],
        ['Wat is Engels voor "huiswerk"?', 'homework', 'housework', 'homeward']
      ] } }
  ]},
  { vak: 'wiskunde', fasen: ['havo', 'vwo'], doelen: [
    { id: 'wiskunde.havo.lineair', naam: 'Lineaire vergelijkingen oplossen', ref: '3F',
      les: 'Breng eerst de losse getallen naar rechts, dan delen door het getal voor de x: 3x + 4 = 19 wordt 3x = 15, dus x = 5. Controleer altijd door terug in te vullen.',
      gen: { soort: 'vergelijking', maxA: 9, maxX: 12 } },
    { id: 'wiskunde.havo.statistiek', naam: 'Gemiddelde en spreiding', ref: '3F',
      les: 'Het gemiddelde is alles optellen en delen door het aantal. Let op uitschieters: een enkel extreem getal trekt het gemiddelde scheef.',
      gen: { soort: 'gemiddelde', max: 50 } }
  ]},
  { vak: 'economie', fasen: ['havo', 'vwo'].concat(['mbo-1', 'mbo-2', 'mbo-3', 'mbo-4']), doelen: [
    { id: 'economie.vo.btw', naam: 'Btw en procenten in het echt', ref: '3F',
      les: 'Btw is een percentage bovenop de prijs: 21% standaard, 9% verlaagd. 21% van 300 euro is 63 euro; de klant betaalt dan 363 euro.',
      gen: { soort: 'procent', procenten: [9, 21] } }
  ]},
  { vak: 'wiskunde', fasen: ['vwo'], doelen: [
    { id: 'wiskunde.vwo.vergelijkingen', naam: 'Vergelijkingen met grotere getallen', ref: '3F',
      les: 'Dezelfde stappen als bij lineair, alleen strakker opschrijven: elke regel een bewerking, links en rechts hetzelfde doen, en aan het eind controleren.',
      gen: { soort: 'vergelijking', maxA: 12, maxX: 15 } }
  ]},
  { vak: 'nederlands', fasen: ['vwo'], doelen: [
    { id: 'nederlands.vwo.stijlfiguren', naam: 'Stijlfiguren herkennen', ref: '4F',
      les: 'Een vergelijking gebruikt "als" of "zoals"; een metafoor laat dat weg ("die jongen is een vos"). Een hyperbool overdrijft; een understatement doet juist te klein.',
      gen: { soort: 'mc', vragen: [
        ['"Zo sterk als een beer" is een:', 'vergelijking', 'metafoor', 'hyperbool'],
        ['"Die jongen is een vos" is een:', 'metafoor', 'vergelijking', 'understatement'],
        ['"Ik heb het je al duizend keer gezegd" is een:', 'hyperbool', 'metafoor', 'vergelijking'],
        ['"Het was niet geheel onverdienstelijk" (over een topprestatie) is een:', 'understatement', 'hyperbool', 'metafoor']
      ] } }
  ]}
];
