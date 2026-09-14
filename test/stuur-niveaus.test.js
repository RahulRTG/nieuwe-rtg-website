/* DE SPLITSING VAN `direct` IN `lezen` EN `klein` (server/kern/stuur/beleid.js).

   AANLEIDING. scripts/gezagsnoemer.js kon `direct` niet afbeelden op de gedeelde
   noemer en meldde hem als ONBEPAALD: de bron zei "uitsluitend lezen OF een
   kleine, omkeerbare handeling zonder externe gevolgen", en dat zijn twee treden
   in een woord. Een term in de laag waaruit de AI kiest die twee dingen zegt over
   wat de machine zelfstandig doet, is precies wat PLAN (EXECUTIE.md blok 3) niet
   kan wegen.

   WAT HIER BEWEZEN MOET WORDEN is niet dat de indeling MOOI is maar dat zij
   NIETS VERPLAATST: `lezen` en `klein` samen zijn exact de oude `direct`, en
   alleen `voorstel` vraagt nog een menselijke bevestiging. Een splitsing die
   ongemerkt een route van bevestiging-nodig naar direct-uitvoerbaar schuift, is
   een bevoegdheidswijziging vermomd als opruiming.

   EN DE VIJF DIE HET BLOOTLEGDE staan er als vaste toets bij: ze stonden in de
   lezen-lijst en schrijven aantoonbaar. Zonder deze toets zou iemand ze bij de
   volgende opruiming zo weer terugzetten. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { LEZEN, KLEIN, DIRECT, VOORSTEL, beleidVoor, toegestanePaden } = require('../server/kern/stuur/beleid');

const ROLLEN = ['member', 'supplier', 'staff'];

/* WAT ER SINDS DIE NULMETING MET OPZET UIT `direct` IS GEHAALD, met de datum en de reden.

   Dit is geen correctie van de lijst hierboven: die blijft staan zoals hij was, want een
   nulmeting die je bijwerkt meet niets meer. Een pad dat later bewust van bevoegdheid
   verandert, hoort ERNAAST te staan -- zichtbaar, met een reden, en door toets 1 als exact
   dat ene verschil erkend. Zo blijft "de splitsing verplaatste niets" bewijsbaar EN blijft
   de latere ingreep zichtbaar in plaats van weggepoetst. */
const UIT_DIRECT_GEHAALD = [
  { pad: '/api/pay/saldo', op: '2026-09-13', naar: 'voorstel',
    reden: 'betaalt de maandfactuur uit het eigen RTG Pay-saldo (kern/factuursaldo.js): ' +
      'negen collecties volgens de BRON (de proef komt er niet bij). Hij stond ' +
      'in de LEZEN-lijst en was daarmee het enige geldpad van een lid dat het stuur zonder ' +
      'bevestiging kon uitvoeren' }
];

/* EN WAT ER BEWUST BIJ IS GEKOMEN, apart van wat eruit ging -- want dat zijn twee heel
   verschillende beslissingen. Iets uit DIRECT halen maakt het stuur voorzichtiger; iets
   erbij zetten laat de machine een handeling ZONDER bevestiging doen die dat eerder niet
   mocht. Daarom stond hier eerst alleen de eerste lijst en weigerde toets 1 elke
   toevoeging: een route die stil van bevestiging-nodig naar direct-uitvoerbaar schuift is
   precies de fout waar deze toets voor bestaat.

   Weigeren kan hij niet blijven doen zodra de EIGENAAR zo'n pad opent, en dat is gebeurd.
   Dus staat het hier: benoemd, met datum en reden, en toets 1 erkent uitsluitend deze. */
const ERBIJ_GEKOMEN = [
  { pad: '/api/member/voorstel/intrek', op: '2026-09-13', naar: 'klein',
    reden: 'besluit van de eigenaar: een lid mag zijn eigen klaargezette voorstel conversationeel ' +
      'intrekken. Hij kan uitsluitend vermogen INLEVEREN -- de drie andere `klein`-paden van een ' +
      'lid laten iets gebeuren (een smaak wordt gezet, een model wordt betaald), deze laat iets ' +
      'vervallen. Hij hoort niet bij `lezen` (hij verandert toestand) en niet bij `voorstel` (een ' +
      'voorstel om een voorstel te laten vervallen is een cirkel); zie de kop bij KLEIN in ' +
      'server/kern/stuur/beleid-lijsten.js' }
];

/* De lijst zoals hij VOOR de splitsing was, met de hand overgeschreven uit de
   git-stand ervoor. Een toets die de nieuwe code met zichzelf vergelijkt bewijst
   niets; deze vergelijkt hem met de oude waarheid. */
const DIRECT_VOOR_DE_SPLITSING = {
  member: [
    /^\/api\/kantoorpakket\/(mijn|open|versies|uitslag)$/,
    /^\/api\/onderwijs\/(advies|ladder|mijn)$/,
    /^\/api\/leerstof\/(vakken|les|oefen|antwoord)$/,
    /^\/api\/bijles\/(vraag|gesprek)$/,
    /^\/api\/mediaos\/(wereld|stuur|volg|stuk)$/,
    /^\/api\/agenda\/(mijn|mijn-lijst|bereik|ics)$/,
    /^\/api\/locatie\/mijn$/,
    /^\/api\/asset\/(document|mijn)$/,
    /^\/api\/site\/(mijn|haal|versies|spoor|cijfers|sjablonen|sjabloon|fotos)$/,
    /^\/api\/meet\/mijn$/,
    /^\/api\/pay\/(overzicht|saldo|tiks)$/,
    /^\/api\/bank\/(overzicht|rekening|afschrift|rente-voorbeeld|passen|krediet|terugkerend|advies|hart|inzichten|vastelasten)$/,
    /^\/api\/bookings\/mine$/
  ],
  supplier: [
    /^\/api\/supplier\/state$/,
    /^\/api\/supplier\/agenda\/lijst$/,
    /^\/api\/supplier\/rtmail\/(inbox|verzonden|ongelezen)$/,
    /^\/api\/supplier\/site\/(mijn|haal|versies|spoor|cijfers)$/,
    /^\/api\/supplier\/pay\/overzicht$/
  ],
  staff: [
    /^\/api\/staff\/fluister\/profiel$/,
    /^\/api\/staff\/ov\/(dienst|lijnen)$/,
    /^\/api\/staff\/mob\/kaart\/storingen$/
  ]
};

const ALLE_ROUTES = [...new Set((require('../IDEMPROEF.json').perRoute || [])
  .filter(r => r && r.methode === 'POST' && typeof r.pad === 'string').map(r => r.pad))].sort();

const raakt = (lijst, pad) => (lijst || []).some(re => re.test(pad));

test('0. de meting deugt: er zijn echte routes om overheen te lopen', () => {
  assert.ok(ALLE_ROUTES.length > 1000, 'te weinig routes: ' + ALLE_ROUTES.length);
});

test('1. DE SPLITSING VERPLAATST NIETS: lezen + klein is exact de oude direct-lijst', () => {
  for (const rol of ROLLEN) {
    const verschil = [];
    for (const pad of ALLE_ROUTES) {
      const oud = raakt(DIRECT_VOOR_DE_SPLITSING[rol], pad);
      const nieuw = raakt(LEZEN[rol], pad) || raakt(KLEIN[rol], pad);
      if (oud !== nieuw) verschil.push((oud ? '-' : '+') + pad);
    }
    /* De benoemde uitzonderingen mogen eruit, en ALLEEN die. Een pad dat erbij KOMT
       (`+`) is nooit toegestaan: dat is een route die stil van bevestiging-nodig naar
       direct-uitvoerbaar schuift, en dat is de fout waar deze toets voor bestaat. */
    const mag = [...UIT_DIRECT_GEHAALD.map(u => '-' + u.pad), ...ERBIJ_GEKOMEN.map(u => '+' + u.pad)];
    const onverklaard = verschil.filter(v => !mag.includes(v));
    assert.deepEqual(onverklaard, [], rol + ': de splitsing verschoof ' + onverklaard.length +
      ' route(s) de lijst in of uit zonder verklaring: ' + onverklaard.join(' ') +
      ' (verklaard en toegestaan: ' + (mag.join(' ') || 'niets') + ')');
  }
});

test('2. en `voorstel` is onaangeroerd: dezelfde routes vragen nog een bevestiging', () => {
  for (const rol of ROLLEN)
    for (const pad of ALLE_ROUTES)
      if (raakt(VOORSTEL[rol], pad))
        assert.equal(beleidVoor(pad, rol).niveau, 'voorstel', pad + ' is geen voorstel meer voor ' + rol);
});

test('3. lezen en klein overlappen niet: een pad valt in precies een van de drie', () => {
  for (const rol of ROLLEN)
    for (const pad of ALLE_ROUTES) {
      const treffers = [raakt(LEZEN[rol], pad) && 'lezen', raakt(KLEIN[rol], pad) && 'klein',
        raakt(VOORSTEL[rol], pad) && 'voorstel'].filter(Boolean);
      assert.ok(treffers.length <= 1, pad + ' valt voor ' + rol + ' in meer dan een lijst: ' + treffers.join('+'));
    }
});

test('4. DE VIJF DIE SCHRIJVEN staan onder klein en nooit meer onder lezen', () => {
  const schrijvers = ['/api/mediaos/stuur', '/api/mediaos/volg',
    '/api/leerstof/oefen', '/api/leerstof/antwoord', '/api/bijles/vraag'];
  for (const pad of schrijvers) {
    assert.equal(beleidVoor(pad, 'member').niveau, 'klein',
      pad + ' hoort onder `klein`: hij schrijft, en stond ooit in de lezen-lijst');
    assert.ok(!raakt(LEZEN.member, pad), pad + ' staat weer in de lezen-lijst');
  }
});

test('4b. DE ZESDE DIE SCHRIJFT is een GELDWEG: /api/pay/saldo vraagt een bevestiging', () => {
  /* Toets 4 hierboven houdt de vijf van 31 augustus vast. Dit is de zesde, en hij is van
     een andere orde: die vijf schreven een voorkeur of een oefenstand, deze betaalt de
     maandfactuur uit het eigen saldo en boekt de 30%-afdracht aan de RTFoundation.

     HIJ IS NIET DOOR EEN TOETS GEVONDEN MAAR DOOR EEN TOETS VERBORGEN: toets 5 voerde dit
     pad AAN als voorbeeld van een leesroute, dus stond er een groene bewering op de fout.
     Vandaar dat hij hier een eigen toets krijgt en niet alleen uit die lijst is gehaald.

     MUTATIEPROEF: zet `saldo` terug in de LEZEN-regex van beleid-lijsten.js en alle drie
     de beweringen hieronder zakken. */
  assert.equal(beleidVoor('/api/pay/saldo', 'member').niveau, 'voorstel',
    '/api/pay/saldo verplaatst geld en hoort dus een bevestiging te vragen');
  assert.ok(!raakt(LEZEN.member, '/api/pay/saldo'),
    '/api/pay/saldo staat weer in de lezen-lijst, en die belooft "haalt op en verandert niets"');
  assert.ok(!raakt(DIRECT.member, '/api/pay/saldo'),
    'DIRECT betekent: zonder bevestiging. Een geldweg hoort daar niet in');
  /* EN DE TWEE LIJSTGENOTEN BLIJVEN LEZEN. Zonder deze twee zou een te ruime reparatie
     (de hele pay-groep naar voorstel) er net zo groen uitzien. */
  for (const lees of ['/api/pay/overzicht', '/api/pay/tiks'])
    assert.equal(beleidVoor(lees, 'member').niveau, 'lezen', lees + ' is een echte leesroute');
});

test('5. een leesroute blijft lezen', () => {
  for (const pad of ['/api/agenda/mijn', '/api/pay/overzicht', '/api/bank/overzicht', '/api/site/versies'])
    assert.equal(beleidVoor(pad, 'member').niveau, 'lezen', pad);
});

test('6. DIRECT bestaat nog als vereniging, zodat bestaande aanroepers niets merken', () => {
  for (const rol of ROLLEN)
    for (const pad of ALLE_ROUTES)
      assert.equal(raakt(DIRECT[rol], pad), raakt(LEZEN[rol], pad) || raakt(KLEIN[rol], pad),
        'DIRECT is geen zuivere vereniging meer bij ' + pad);
});

test('7. het aanbod aan de AI is geen pad groter of kleiner geworden', () => {
  /* DE SPLITSING VERPLAATSTE NIETS, maar de EIGENAAR heeft er daarna wel iets bij
     gezet -- en dat zijn twee beweringen die niet op een hoop mogen. `/api/pay/saldo`
     schoof van `lezen` naar `voorstel` en blijft dus in het aanbod; wat het aanbod
     werkelijk groter maakt staat in ERBIJ_GEKOMEN, met datum en reden. Die lijst wordt
     hier OPGETELD en niet weggefilterd: zo blijft de nulmeting van de splitsing intact
     en blijft de latere ingreep zichtbaar. */
  const erbij = new Set(ERBIJ_GEKOMEN.map(u => u.pad));
  for (const rol of ROLLEN) {
    const nu = toegestanePaden(ALLE_ROUTES, rol);
    const toen = ALLE_ROUTES.filter(p => !/^\/api\/(auth|login|account|techniek|boardroom|doos|aanmelding)/.test(p) &&
      (raakt(DIRECT_VOOR_DE_SPLITSING[rol], p) || raakt(VOORSTEL[rol], p) ||
        (erbij.has(p) && beleidVoor(p, rol).niveau !== 'verboden')));
    assert.deepEqual(nu, toen, rol + ': het aanbod aan de AI is veranderd door een splitsing die ' +
      'niets had mogen verplaatsen (of door een toevoeging die niet in ERBIJ_GEKOMEN staat)');
  }
});

test('8. een onbekend pad blijft verboden, en een onbekende rol ook', () => {
  assert.equal(beleidVoor('/api/verzonnen/pad', 'member').niveau, 'verboden');
  assert.equal(beleidVoor('/api/agenda/mijn', 'directeur').niveau, 'verboden');
});
