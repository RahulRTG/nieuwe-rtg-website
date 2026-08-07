/* ============================================================================
   DE LIEGPOORT: liegt hij precies waar hij moet, en zwijgt hij waar het telt?

   WAAROM DIT ER IS. De liegpoort (server/opzet/liegpoort.js) is het mes van de
   mutatiemotor voor servertoetsen: met RTG_LIEG=<pad> geeft elk endpoint op dat
   voorvoegsel een geldig maar leeg antwoord, en dan zie je of een toets naar de
   INHOUD kijkt. Een mes dat verkeerd snijdt levert een uitslag op die niemand
   kan gebruiken, en juist bij dit instrument valt dat niet op: alles staat dan
   netjes op "gezakt".

   Twee manieren waarop het misgaat, en beide zijn hier vastgelegd.

   TE BREED. Met RTG_LIEG=/api/ liegt ook /api/auth/register en
   /api/supplier/login. Dan struikelt een toets al bij zijn VOORBEREIDING -- hij
   komt niet meer binnen -- en zakt alles daarna vanzelf. Dat telt als
   afhankelijkheid van echt gedrag, maar het is zwakker bewijs dan een assertie
   die op de inhoud viel, en bij "399 van de 399 gezakt" weet je niet meer welke
   van de twee je hebt gemeten. Vandaar RTG_LIEG_NIET.

   TE SMAL. De infra mag nooit liegen: de poortwachter (server/trio.js) leest
   /api/health om te zien of een server leeft. Een liegende health-check laat de
   hele opstelling omvallen om een reden die niets met de proef te maken heeft --
   en dan lijkt de code stuk terwijl het de proef is.

   De beslissing staat als losse functie in de module, zodat ze zonder server te
   toetsen is. Een poort die je alleen via een draaiende app kunt nakijken, kijkt
   niemand na.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { magLiegen, INFRA } = require('../server/opzet/liegpoort');

test('zonder RTG_LIEG liegt er niets', () => {
  assert.equal(magLiegen('/api/member/profiel', '', ''), false);
  assert.equal(magLiegen('/api/member/profiel', undefined, undefined), false);
});

test('een voorvoegsel raakt zijn eigen pad en niets daarbuiten', () => {
  assert.equal(magLiegen('/api/school/klas', '/api/school/', ''), true);
  assert.equal(magLiegen('/api/school/', '/api/school/', ''), true);
  assert.equal(magLiegen('/api/scholen/x', '/api/school/', ''), false,
    '/api/scholen/ begint niet met /api/school/ -- of wel, en dan is dit precies de val');
  assert.equal(magLiegen('/api/member/x', '/api/school/', ''), false);
});

test('alles buiten /api/ blijft ongemoeid, ook als het patroon erbuiten wijst', () => {
  /* De liegpoort hoort geen schermen of bestanden te raken. Zou hij dat wel doen,
     dan geeft /apps/app.html ineens {ok:true} en zakt elke schermtoets om een
     reden die niets met zijn bewering te maken heeft.

     DE EERSTE VERSIE VAN DEZE TOETS KON NIET ZAKKEN, en de mutatie vond dat. Hij
     vroeg alleen naar magLiegen('/apps/app.html', '/api/') -- en dat is al false
     omdat het patroon /api/ niet op /apps/ past, met of zonder de /api/-bewaking.
     De bewaking doet er pas toe als het PATROON zelf buiten /api/ wijst; dan is
     zij het enige dat de schermen beschermt. Precies LAT.md regel 9: een toets
     die niet kan zakken is erger dan geen toets. */
  assert.equal(magLiegen('/apps/app.html', '/apps/', ''), false,
    'ook met RTG_LIEG=/apps/ blijft een scherm ongemoeid: de poort is er voor de API');
  assert.equal(magLiegen('/shared/media.js', '/shared/', ''), false);
  assert.equal(magLiegen('/', '/', ''), false);
  // en de gewone gevallen blijven ook staan
  assert.equal(magLiegen('/apps/app.html', '/api/', ''), false);
});

test('de infra liegt nooit, ook niet als je ALLES aanzet', () => {
  for (const pad of ['/api/health', '/api/ready', '/api/cluster/leden']) {
    assert.equal(magLiegen(pad, '/api/', ''), false,
      pad + ' hoort nooit te liegen: de poortwachter leest hem om te zien of een server leeft');
  }
  assert.ok(INFRA.length >= 3, 'de infralijst is niet stilletjes leeggeraakt');
});

test('RTG_LIEG_NIET spaart de deuren, zodat alleen het domein liegt', () => {
  const alles = '/api/';
  const deuren = '/api/auth/,/api/login,/api/supplier/login,/api/office/login';
  // binnenkomen lukt nog
  assert.equal(magLiegen('/api/auth/register', alles, deuren), false);
  assert.equal(magLiegen('/api/auth/login', alles, deuren), false);
  assert.equal(magLiegen('/api/login', alles, deuren), false);
  assert.equal(magLiegen('/api/supplier/login', alles, deuren), false);
  assert.equal(magLiegen('/api/office/login', alles, deuren), false);
  // en de rest van hetzelfde domein liegt WEL -- anders meet de scherpe ronde niets
  assert.equal(magLiegen('/api/supplier/menu/get', alles, deuren), true);
  assert.equal(magLiegen('/api/office/leden', alles, deuren), true);
  assert.equal(magLiegen('/api/member/profiel', alles, deuren), true);
});

test('een gespaard voorvoegsel spaart niet meer dan het zegt', () => {
  /* /api/supplier/login sparen mag niet /api/supplier/loginpoging meenemen zonder
     dat iemand dat besluit. Voorvoegsel is voorvoegsel; deze toets legt vast dat
     het gedrag ook echt zo is en niet per ongeluk op woordgrenzen werkt. */
  assert.equal(magLiegen('/api/supplier/loginpoging', '/api/', '/api/supplier/login'), false,
    'een voorvoegsel spaart ook wat eraan vastgeplakt zit -- weet dat, en kies je lijst erop');
  assert.equal(magLiegen('/api/supplier/inlog', '/api/', '/api/supplier/login'), true);
});

test('sparen wint van liegen, ook als beide passen', () => {
  assert.equal(magLiegen('/api/auth/register', '/api/auth/', '/api/auth/'), false,
    'staat een pad in beide lijsten, dan wint sparen -- anders is de uitzondering geen uitzondering');
});
