/* ============================================================================
   DE PROEVEN KOMEN NOG BINNEN.

   WAT ER GEBEURD IS, EN WAAROM DEZE TOETS BESTAAT. server/testomgeving.js kreeg
   een expliciete testomgeving: RTG_DEMO=1 doet sindsdien alleen nog iets samen
   met NODE_ENV=test, of via de nieuwe vlag RTG_MAGNAAT_TEST=1. Dertien
   instrumenten geven `RTG_DEMO: '1'` mee en verder niets.

   Gevolg: /api/login gaf 403 "Log in met je account", er kwam geen token voor
   member en supplier, en elk van die instrumenten stopte bij de start. Negen
   dagen lang. IDEMPROEF.json bleef ondertussen 845 beproefde routes tonen, en
   scripts/versheid.js meldde alleen "verouderd" -- die kent het verschil niet
   tussen een meting die niet is herhaald en een meting die niet MEER KAN.

   EEN REGISTER MET GETALLEN VAN EEN INSTRUMENT DAT NIET DRAAIT is de
   gevaarlijkste vorm van schijnzekerheid die dit huis kent: het ziet er precies
   uit als bewijs.

   Deze toets meet de INGANG en niet de uitkomst: kan een instrument dat de
   gedeelde wegwerpserver start, de vijf rollen aannemen die hij denkt te hebben?
   Zo niet, dan zakt hij hier -- binnen een testronde, in plaats van dat dertien
   registers stilletjes verouderen.

   DE MUTATIES VOOR DIT BESTAND, elk een keer gedraaid en zien zakken:
     1. haal de vertaling in lib/wegwerpserver.js weg (gereedschapsomgeving zet
        RTG_MAGNAAT_TEST niet meer) -> "de demo-rollen komen binnen" zakt;
     2. laat de eigenaarslogin mislukken (verkeerd wachtwoord)
        -> "een mislukte eigenaarslogin houdt de drie onmisbare rollen niet
        tegen" zakt als iemand de luiheid weghaalt EN de fout laat doorwerken.

   EEN MUTATIE DIE NIET ZAKTE, EN DAT HOORT ER OOK TE STAAN. De eerste opzet van
   dit bestand beweerde dat een EAGER eigenaarslogin de inlogrem liet aanslaan en
   daardoor member en supplier blokkeerde. Die mutatie is gedraaid en de toetsen
   bleven groen: de rem was nooit de oorzaak. De echte oorzaak stond een laag
   dieper (RTG_DEMO=1 doet op zichzelf niets meer). De bewering is daarom uit
   lib/proefsleutels.js gehaald in plaats van blijven staan als plausibele
   uitleg -- zie LAT.md regel 10: een meter die je niet hebt zien uitslaan, meet
   niets, en dat geldt net zo hard voor een verklaring.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { start, gereedschapsomgeving } = require('../scripts/lib/wegwerpserver');
const { maakSleutels, haalSleutels, ONMISBAAR, ROLLEN } = require('../scripts/lib/proefsleutels');

let server;
test.before(async () => {
  server = await start({ naam: 'proefsleutels', env: { RTG_DEMO: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF' } });
});
test.after(() => { try { server && server.klaar(); } catch (e) {} });

const post = async (pad, lijf) => {
  const r = await fetch(server.basis + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lijf || {}) });
  let data = null; try { data = await r.json(); } catch (e) {}
  return { status: r.status, data };
};

test('de vertaling zet de testomgeving aan, en alleen als erom gevraagd is', () => {
  const met = gereedschapsomgeving({ poort: 1, datamap: '/tmp/x' }, { RTG_DEMO: '1' });
  assert.equal(met.RTG_MAGNAAT_TEST, '1', 'wie om de demo-stand vraagt, krijgt de omgeving waarin die bestaat');
  const zonder = gereedschapsomgeving({ poort: 1, datamap: '/tmp/x' }, {});
  assert.equal(zonder.RTG_MAGNAAT_TEST, undefined,
    'er wordt nooit een testomgeving aangezet die de aanroeper niet heeft gevraagd');
});

test('de demo-rollen komen binnen: zonder token meet een proef niets', async () => {
  const bos = maakSleutels({ post, officeCode: 'RTG-OFFICE-PROEF' });
  const { tokens, mislukt } = await haalSleutels(bos);
  for (const rol of ONMISBAAR) {
    assert.ok(tokens[rol], 'geen token voor ' + rol + ' -- dan stopt elk proefinstrument bij de start. ' +
      'Mislukt: ' + JSON.stringify(mislukt));
  }
});

test('de eigenaarsrollen komen er ook in, en dat waren 156 onbereikbare routes', async () => {
  /* boardroom en techniek waren voor alle proeven onbereikbaar omdat de
     inlogtabel in zes instrumenten drie rollen kende. Ze staan hier apart van
     de onmisbare drie: een database zonder demo-eigenaar is een geldige
     database, en dan is hun afwezigheid een uitkomst en geen storing. */
  const bos = maakSleutels({ post, officeCode: 'RTG-OFFICE-PROEF' });
  const { tokens } = await haalSleutels(bos);
  assert.ok(tokens.boardroom, 'geen boardroom-token in de demo-omgeving');
  assert.ok(tokens.techniek, 'geen techniek-token in de demo-omgeving');
  assert.equal(tokens.boardroom, tokens.techniek,
    'beide zijn de eigenaarssessie; wijkt dat af, dan is er een aanname veranderd');
});

test('een ontbrekende sleutel is een uitkomst met een reden, en geen stilte', async () => {
  const bos = maakSleutels({ post, officeCode: 'ONJUISTE-CODE-VOOR-DEZE-TOETS',
    eigen: { supplier: async () => { throw new Error('opzettelijk stuk'); } } });
  const { tokens, mislukt } = await haalSleutels(bos);
  assert.ok(!tokens.supplier, 'deze rol hoort te ontbreken');
  const rij = mislukt.find(m => m.rol === 'supplier');
  assert.ok(rij && rij.reden, 'een ontbrekende rol hoort een reden te dragen');
  assert.match(rij.reden, /opzettelijk stuk/);
});

test('een mislukte eigenaarslogin houdt de drie onmisbare rollen niet tegen', async () => {
  /* De volgorde in ROLLEN is geen smaak: member, office en supplier komen eerst,
     en pas daarna de eigenaar. Mislukt die laatste (een database zonder
     demo-eigenaar), dan hoort dat de drie ervoor niet te raken. */
  const bos = maakSleutels({ post, officeCode: 'RTG-OFFICE-PROEF',
    eigen: { boardroom: async () => { throw new Error('geen eigenaar in deze database'); },
      techniek: async () => null, 'kantoor-op-naam': async () => null } });
  const { tokens, mislukt } = await haalSleutels(bos);
  for (const rol of ONMISBAAR) assert.ok(tokens[rol], rol + ' sneuvelde door een mislukte eigenaarslogin');
  assert.ok(mislukt.some(m => m.rol === 'boardroom'), 'en de mislukking wordt wel gemeld');
});

test('elke rol in ROLLEN heeft een inlog, en andersom', () => {
  const bos = maakSleutels({ post, officeCode: 'x' });
  assert.deepEqual(Object.keys(bos.inlog).sort(), [...ROLLEN].sort(),
    'een rol zonder inlog telt wel mee als beproefbaar en levert dan 401 op');
});
