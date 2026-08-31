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
    assert.deepEqual(verschil, [], rol + ': de splitsing verschoof ' + verschil.length +
      ' route(s) de lijst in of uit: ' + verschil.join(' '));
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

test('5. een leesroute blijft lezen', () => {
  for (const pad of ['/api/agenda/mijn', '/api/pay/saldo', '/api/bank/overzicht', '/api/site/versies'])
    assert.equal(beleidVoor(pad, 'member').niveau, 'lezen', pad);
});

test('6. DIRECT bestaat nog als vereniging, zodat bestaande aanroepers niets merken', () => {
  for (const rol of ROLLEN)
    for (const pad of ALLE_ROUTES)
      assert.equal(raakt(DIRECT[rol], pad), raakt(LEZEN[rol], pad) || raakt(KLEIN[rol], pad),
        'DIRECT is geen zuivere vereniging meer bij ' + pad);
});

test('7. het aanbod aan de AI is geen pad groter of kleiner geworden', () => {
  for (const rol of ROLLEN) {
    const nu = toegestanePaden(ALLE_ROUTES, rol);
    const toen = ALLE_ROUTES.filter(p => !/^\/api\/(auth|login|account|techniek|boardroom|doos|aanmelding)/.test(p) &&
      (raakt(DIRECT_VOOR_DE_SPLITSING[rol], p) || raakt(VOORSTEL[rol], p)));
    assert.deepEqual(nu, toen, rol + ': het aanbod aan de AI is veranderd door een splitsing die niets had mogen verplaatsen');
  }
});

test('8. een onbekend pad blijft verboden, en een onbekende rol ook', () => {
  assert.equal(beleidVoor('/api/verzonnen/pad', 'member').niveau, 'verboden');
  assert.equal(beleidVoor('/api/agenda/mijn', 'directeur').niveau, 'verboden');
});
