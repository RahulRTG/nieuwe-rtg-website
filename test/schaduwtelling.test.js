/* DE SCHADUWTELLING VAN DE HERKOMSTPOORT (server/kern/stuur/schaduwtelling.js).

   CONTROLPLANE.md: je kunt niet afdwingen wat nooit in de schaduw heeft gelopen.
   De poort loopt al in de schaduw, maar telde PER GESPREK en verdween daarna --
   dus de vraag "hoe vaak zou hij bijten" was niet te beantwoorden en de vlag
   omzetten was een gok. Deze module telt over gesprekken heen.

   Wat hier machinaal te handhaven is, is niet of het getal KLOPT (dat is een
   meting en die beweegt) maar de drie dingen die hem stilletjes waardeloos of
   gevaarlijk zouden maken:

     1 er komt GEEN IDENTITEIT in. Dit is een teller en geen journaal -- de vraag
       is wat een beleidsknop kost, en daarvoor is nul informatie over een mens
       nodig. Een pad met een id erin wordt geschuild, niet weggelaten: weglaten
       zou het getal stil verlagen, en dat is erger dan een schuilnaam.
     2 beide getallen staan erbij. 3 van de 4 is een andere uitslag dan 3 van de
       4000, en met alleen `zouSluiten` zijn die twee niet uit elkaar te houden.
     3 de uitslag zegt dat hij NIET BEWAARD is. Zonder `sinds` leest "achttien"
       als een totaal over de levensduur terwijl het "sinds de laatste herstart"
       is -- precies de vorm van valse zekerheid waar BESTUUR.md een bewijsgraad
       met een datum voor eist.

   Draai los: node --test test/schaduwtelling.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const telling = require('../server/kern/stuur/schaduwtelling');

test('1. de telling houdt beide getallen bij, per wereld', () => {
  telling.vergeet();
  telling.noteer('member', '/api/agenda/mijn', false);
  telling.noteer('member', '/api/pay/stuur', true);
  telling.noteer('member', '/api/pay/stuur', true);
  telling.noteer('supplier', '/api/supplier/kassa', false);

  const s = telling.stand();
  assert.equal(s.totaal, 4, 'elke weging telt mee, ook die niets zou sluiten');
  assert.equal(s.totaalZouSluiten, 2);

  const lid = s.werelden.find(w => w.wereld === 'member');
  assert.equal(lid.gewogen, 3);
  assert.equal(lid.zouSluiten, 2);
  /* BEIDE GETALLEN, en dat is geen dubbeling. Zonder `gewogen` is 2 een getal
     zonder noemer, en een getal zonder noemer wordt gelezen als "veel". */
  assert.ok(lid.gewogen > lid.zouSluiten, 'de noemer hoort groter te zijn dan de teller');
  assert.deepEqual(lid.paden.map(p => p.pad), ['/api/pay/stuur'],
    'alleen paden die zouden sluiten staan in de lijst -- de rest is ruis');
});

test('2. er komt geen identiteit in de telling', () => {
  telling.vergeet();
  /* Vier vormen die in een pad kunnen opduiken en die een mens aanwijzen. Ze
     worden GESCHUILD en niet weggelaten: een teller die stiekem lager wordt
     omdat er een id in het pad stond, liegt over de prijs. */
  telling.noteer('member', '/api/lid/cn-8842/profiel', true);
  telling.noteer('member', '/api/mail/naar/iemand@voorbeeld.nl', true);
  telling.noteer('member', '/api/order/20260909123456', true);
  telling.noteer('member', '/api/user-4471/agenda', true);

  const s = telling.stand();
  assert.equal(s.totaalZouSluiten, 4, 'alle vier tellen mee; schuilen is geen weglaten');
  const alleTekst = JSON.stringify(s);
  for (const spoor of ['cn-8842', 'voorbeeld.nl', '20260909123456', 'user-4471'])
    assert.ok(!alleTekst.includes(spoor),
      'de telling draagt "' + spoor + '" -- dan is het een journaal geworden in plaats van een teller');
});

test('3. de uitslag zegt zelf dat hij niet bewaard is, en sinds wanneer', () => {
  telling.vergeet();
  telling.noteer('member', '/api/pay/stuur', true);
  const s = telling.stand();
  assert.equal(s.bewaard, false, 'wie dit als een totaal leest, leest het verkeerd');
  assert.ok(!Number.isNaN(Date.parse(s.sinds)), '`sinds` is geen leesbare datum');
  assert.ok(s.grens.includes(s.sinds),
    'de grens hoort de begindatum te NOEMEN; een losse datum verderop wordt niet gelezen');
  /* En wat hij NIET meet, staat erbij: of de poort gelijk had. Een hoog getal
     kan een aanval betekenen of een te brede regel, en dat onderscheid is een
     oordeel. Weglaten zou de lezer het zelf laten invullen. */
  assert.ok(String(s.nietGemeten || '').length > 40,
    'zonder `nietGemeten` leest een hoog getal als een bewijs van aanvallen');
});

test('4. er staat geen percentage in', () => {
  telling.vergeet();
  telling.noteer('member', '/api/pay/stuur', true);
  telling.noteer('member', '/api/agenda/mijn', false);
  const s = telling.stand();
  /* Bij twee metingen is "50%" een getal met valse precisie eromheen. Dezelfde
     regel als INT-04 en kern/kosten/vooruitblik.js: een trefzekerheid verschijnt
     pas als zij gemeten is, niet zodra zij te berekenen valt. */
  const platgeslagen = JSON.stringify(s);
  assert.ok(!/%/.test(platgeslagen) && !/\bpct\b|percentage/i.test(platgeslagen),
    'er staat een percentage in de uitslag; bij een handvol metingen is dat valse precisie');
});

test('5. de lusstap voedt de telling, en niet alleen zijn eigen gesprek', () => {
  const bron = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'server/kern/stuur/lusstap.js'), 'utf8');
  assert.match(bron, /require\('\.\/schaduwtelling'\)/,
    'lusstap.js telt niet mee in de optelling; dan verdwijnt de schaduw weer per gesprek');
  assert.match(bron, /telling\.noteer\(/,
    'lusstap.js laadt de telling maar noteert er niets in -- een dode koppeling leest als een levende');
});
