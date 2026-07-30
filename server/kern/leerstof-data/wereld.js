/* RTG School, leerlijn wereldorientatie groep 4 t/m 8: aardrijkskunde en
   geschiedenis. Zelfde vorm als rekenen/taal: vaste ids, een les in gewone
   taal, en generator-parameters (hier vooral meerkeuze-kennisvragen). */
module.exports.AARDRIJKSKUNDE = [
  { groep: 5, doelen: [
    { id: 'aardrijkskunde.g5.provincies', naam: 'De twaalf provincies', les: 'Nederland heeft twaalf provincies, elk met een hoofdstad. Amsterdam ligt in Noord-Holland, maar de regering zit in Den Haag (Zuid-Holland).',
      gen: { soort: 'mc', vragen: [
        ['In welke provincie ligt Amsterdam?', 'Noord-Holland', 'Zuid-Holland', 'Utrecht'],
        ['Wat is de hoofdstad van Friesland?', 'Leeuwarden', 'Groningen', 'Assen'],
        ['In welke provincie ligt Maastricht?', 'Limburg', 'Noord-Brabant', 'Gelderland'],
        ['Hoeveel provincies heeft Nederland?', 'twaalf', 'tien', 'veertien'],
        ['Wat is de hoofdstad van Overijssel?', 'Zwolle', 'Enschede', 'Deventer']
      ] } }
  ]},
  { groep: 6, doelen: [
    { id: 'aardrijkskunde.g6.kaartlezen', naam: 'Kaartlezen en windrichtingen', les: 'Op een kaart is het noorden bijna altijd boven. De vier hoofdwindrichtingen zijn noord, oost, zuid en west; onthoud ze met "Nooit Opstaan Zonder Wekker".',
      gen: { soort: 'mc', vragen: [
        ['Welke windrichting staat op een kaart meestal boven?', 'noord', 'zuid', 'west'],
        ['Je loopt van noord naar zuid. Welke richting is links van je?', 'oost', 'west', 'noord'],
        ['Wat betekent de schaal 1:1000?', '1 cm op de kaart is 1000 cm echt', 'de kaart is 1000 jaar oud', 'er passen 1000 mensen'],
        ['De zon komt op in het:', 'oosten', 'westen', 'noorden']
      ] } }
  ]},
  { groep: 7, doelen: [
    { id: 'aardrijkskunde.g7.europa', naam: 'Europa: landen en hoofdsteden', les: 'Europa telt tientallen landen. Onze buren zijn Duitsland en Belgie; Parijs, Berlijn, Madrid en Rome zijn hoofdsteden van grote landen.',
      gen: { soort: 'mc', vragen: [
        ['Wat is de hoofdstad van Frankrijk?', 'Parijs', 'Lyon', 'Marseille'],
        ['Welk land grenst aan Nederland?', 'Duitsland', 'Frankrijk', 'Denemarken'],
        ['Wat is de hoofdstad van Spanje?', 'Madrid', 'Barcelona', 'Sevilla'],
        ['Rome is de hoofdstad van:', 'Italie', 'Griekenland', 'Portugal'],
        ['Welke rivier stroomt door Nederland en Duitsland?', 'de Rijn', 'de Seine', 'de Donau']
      ] } }
  ]},
  { groep: 8, doelen: [
    { id: 'aardrijkskunde.g8.wereld', naam: 'De wereld: continenten en oceanen', les: 'De aarde heeft zeven continenten en vijf oceanen. De Stille Oceaan is de grootste; Azie is het grootste en drukstbevolkte continent.',
      gen: { soort: 'mc', vragen: [
        ['Wat is het grootste continent?', 'Azie', 'Afrika', 'Europa'],
        ['Wat is de grootste oceaan?', 'de Stille Oceaan', 'de Atlantische Oceaan', 'de Indische Oceaan'],
        ['Op welk continent ligt Brazilie?', 'Zuid-Amerika', 'Afrika', 'Azie'],
        ['De Sahara is een woestijn in:', 'Afrika', 'Australie', 'Azie'],
        ['Welk continent is grotendeels bedekt met ijs?', 'Antarctica', 'Europa', 'Oceanie']
      ] } }
  ]}
];

module.exports.GESCHIEDENIS = [
  { groep: 5, doelen: [
    { id: 'geschiedenis.g5.vroeger', naam: 'Van jagers tot boeren', les: 'De eerste mensen jaagden en verzamelden; later leerden ze zaaien en oogsten en bleven ze op een plek wonen. Zo ontstonden dorpen.',
      gen: { soort: 'mc', vragen: [
        ['Hoe kwamen de allereerste mensen aan eten?', 'jagen en verzamelen', 'supermarkten', 'fabrieken'],
        ['Wat veranderde er toen mensen boeren werden?', 'ze bleven op een plek wonen', 'ze reisden meer', 'ze stopten met eten'],
        ['Wat is een archeoloog?', 'iemand die oude resten opgraaft en onderzoekt', 'een dierenarts', 'een bergbeklimmer'],
        ['In welke tijd leefden ridders en kastelen?', 'de middeleeuwen', 'de prehistorie', 'vorig jaar']
      ] } }
  ]},
  { groep: 6, doelen: [
    { id: 'geschiedenis.g6.gouden-eeuw', naam: 'De Gouden Eeuw', les: 'In de zeventiende eeuw voeren Nederlandse schepen de hele wereld over en werden steden rijk. Rembrandt schilderde toen de Nachtwacht. Die rijkdom had ook een donkere kant, zoals de slavenhandel.',
      gen: { soort: 'mc', vragen: [
        ['In welke eeuw was de Gouden Eeuw?', 'de zeventiende eeuw', 'de negentiende eeuw', 'de twaalfde eeuw'],
        ['Wie schilderde de Nachtwacht?', 'Rembrandt', 'Van Gogh', 'Mondriaan'],
        ['Waarmee verdienden Nederlandse steden toen veel geld?', 'handel en scheepvaart', 'vliegtuigen', 'computers'],
        ['Wat was een donkere kant van die rijkdom?', 'de slavenhandel', 'te veel tulpen', 'te weinig schepen']
      ] } }
  ]},
  { groep: 7, doelen: [
    { id: 'geschiedenis.g7.wereldoorlogen', naam: 'De wereldoorlogen', les: 'In de twintigste eeuw waren er twee wereldoorlogen. Nederland werd in 1940 bezet en in 1945 bevrijd; op 4 mei herdenken we de slachtoffers, op 5 mei vieren we de vrijheid.',
      gen: { soort: 'mc', vragen: [
        ['In welk jaar werd Nederland bevrijd?', '1945', '1940', '1918'],
        ['Wat doen we op 4 mei?', 'de slachtoffers herdenken', 'de vrijheid vieren', 'niets'],
        ['Wat vieren we op 5 mei?', 'de vrijheid', 'de bezetting', 'het nieuwe jaar'],
        ['Wie hield zich tijdens de bezetting verborgen en schreef een beroemd dagboek?', 'Anne Frank', 'Willem van Oranje', 'Michiel de Ruyter']
      ] } }
  ]},
  { groep: 8, doelen: [
    { id: 'geschiedenis.g8.democratie', naam: 'Nederland na de oorlog: democratie', les: 'Na de oorlog bouwde Nederland aan een vrij en democratisch land: iedereen van achttien jaar en ouder mag stemmen, en de grondwet beschermt iedereen gelijk.',
      gen: { soort: 'mc', vragen: [
        ['Vanaf welke leeftijd mag je in Nederland stemmen?', 'achttien jaar', 'zestien jaar', 'eenentwintig jaar'],
        ['Wat beschermt de grondwet?', 'de rechten van iedereen', 'alleen de regering', 'alleen volwassenen'],
        ['Wat is een democratie?', 'het volk kiest wie er bestuurt', 'een koning beslist alles', 'niemand beslist iets'],
        ['Waar vergadert de Tweede Kamer?', 'in Den Haag', 'in Amsterdam', 'in Rotterdam']
      ] } }
  ]}
];
