/* DE CANONIEKE ENVELOP (server/opzet/envelop.js).

   WAT HIER OP HET SPEL STAAT. Dit is de vorm waarin elke poortwachter voortaan
   zegt WIE er handelt. Zeven vormen waren er, en zolang dat er zeven zijn kan er
   niets generieks op staan: geen teller, geen rem, geen bonnetje en geen blast
   radius. Deze module is de achtste vorm die de andere zeven moet vervangen --
   en zolang dat niet gebeurd is, staat die schuld geteld in ENVELOP.json.

   DRIE EIGENSCHAPPEN DIE NIET MOGEN SNEUVELEN, want alle drie zijn ze een regel
   uit LAT.md:

     1 hij GOOIT NOOIT. Een poortwachter die omvalt op zijn eigen boekhouding is
       erger dan een ontbrekende envelop -- maar hij ZWIJGT ook niet: wat misgaat
       staat als `fout` in de envelop (regel 5).
     2 hij maakt GEEN TWEEDE correlatie-id. server/log.js zet er al een op elk
       verzoek; er zelf een maken zou twee waarheden geven die uiteenlopen zodra
       iemand er een gebruikt (regel 4).
     3 hij VERZINT GEEN VELDEN. `doel`, `intent`, `wijzigingen`, `risicoklasse`
       en `omkeerbaarheid` kent een poortwachter niet, en ze staan er dus niet
       in. Een envelop die die velden wel zou dragen met een gokwaarde erin, is
       gevaarlijker dan geen envelop -- daar gaat beleid op.

   EN HET IDENTITEITSOORDEEL, dat het scherpste veld is: 'anoniem' moet ook
   gezegd kunnen worden als er WEL een geldige sessie is. Dat is precies het
   kantoorgeval, en als dat oordeel wegvalt verdwijnt de enige plek waar dat
   verschil nog te zien is.

   Draai los: node --test test/envelopvorm.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const envelop = require('../server/opzet/envelop');

const req = (extra) => Object.assign({ path: '/api/proef', method: 'POST', id: 'corr-1' }, extra || {});

/* ---- de vorm ---- */

test('de envelop draagt de zes velden die een poortwachter kan weten, en geen andere', () => {
  const e = envelop.zet(req(), { soort: 'lid', id: 'lid-1' });
  assert.deepEqual(Object.keys(e).sort(),
    ['actor', 'capability', 'context', 'correlatie', 'gezag', 'tenant'].sort());
  for (const verzonnen of ['doel', 'intent', 'wijzigingen', 'risicoklasse', 'omkeerbaarheid']) {
    assert.equal(verzonnen in e, false,
      'de envelop verzint ' + verzonnen + ' -- die kent een poortwachter niet, en een envelop die gokt is erger dan geen');
  }
});

test('hij hangt zichzelf aan het verzoek en geeft zichzelf terug', () => {
  const r = req();
  const e = envelop.zet(r, { soort: 'lid', id: 'lid-1' });
  assert.equal(r.envelop, e);
  assert.equal(envelop.van(r), e);
});

test('van() valt NIET terug op de zeven oude vormen', () => {
  /* Zou hij dat wel doen, dan werd deze module een achtste lezer die zeven
     vormen kent -- en precies dat is het probleem dat hij oplost. Null is het
     eerlijke antwoord: er is nog geen envelop. */
  assert.equal(envelop.van({ session: { key: 'lid-1' }, actor: { name: 'X' }, techUser: { id: 1 } }), null);
  assert.equal(envelop.van(null), null);
  assert.equal(envelop.van({}), null);
});

/* ---- het identiteitsoordeel ---- */

test('een id maakt de identiteit bewezen, geen id maakt hem anoniem', () => {
  assert.equal(envelop.zet(req(), { soort: 'lid', id: 'lid-1' }).actor.identiteit, 'bewezen');
  assert.equal(envelop.zet(req(), { soort: 'kantoor' }).actor.identiteit, 'anoniem');
});

test('EXPLICIET anoniem gaat voor, ook als er een id is', () => {
  /* Dit is het kantoorgeval en de reden dat het veld bestaat: een sessie kan
     geldig zijn en toch geen persoon dragen. Valt deze regel weg, dan verdwijnt
     de enige plek waar dat verschil nog te zien is. */
  const e = envelop.zet(req(), { soort: 'kantoor', id: 'kantoor-sessie', identiteit: 'anoniem' });
  assert.equal(e.actor.identiteit, 'anoniem');
  assert.equal(e.actor.id, 'kantoor-sessie');
});

test('een verzonnen identiteitsoordeel wordt niet overgenomen', () => {
  const e = envelop.zet(req(), { soort: 'lid', id: 'lid-1', identiteit: 'super-bewezen' });
  assert.ok(envelop.IDENTITEITEN.includes(e.actor.identiteit), 'onbekend oordeel: ' + e.actor.identiteit);
  assert.equal(e.actor.identiteit, 'bewezen', 'hij valt terug op de afleiding uit het id');
});

test('een verzonnen soort wordt niet overgenomen', () => {
  assert.equal(envelop.zet(req(), { soort: 'godmode', id: 'x' }).actor.soort, null);
  for (const s of envelop.SOORTEN) {
    assert.equal(envelop.zet(req(), { soort: s, id: 'x' }).actor.soort, s, 'soort ' + s + ' hoort te blijven staan');
  }
});

/* ---- geen tweede waarheid ---- */

test('de correlatie komt van req.id en er wordt er nooit een verzonnen', () => {
  assert.equal(envelop.zet(req({ id: 'abc' }), { soort: 'lid', id: 'l' }).correlatie, 'abc');
  /* Zonder req.id: null, en NIET een zelfgemaakt id. Twee bronnen voor een
     correlatie-id lopen uiteen zodra iemand er een gaat gebruiken. */
  const zonder = envelop.zet({ path: '/a', method: 'GET' }, { soort: 'lid', id: 'l' });
  assert.equal(zonder.correlatie, null);
});

test('de tenant is null als er geen is, en geen leeg object', () => {
  assert.equal(envelop.zet(req(), { soort: 'lid', id: 'l' }).tenant, null);
  assert.deepEqual(envelop.zet(req(), { soort: 'medewerker', id: 'm', tenantId: 'ZK1' }).tenant,
    { soort: 'zaak', id: 'ZK1' });
});

/* ---- hij gooit nooit, en zwijgt ook niet ---- */

test('een onleesbaar verzoek levert een envelop met een REDEN, geen uitzondering', () => {
  const stuk = { get path() { throw new Error('stuk verzoek'); } };
  let e;
  assert.doesNotThrow(() => { e = envelop.zet(stuk, { soort: 'lid', id: 'l' }); },
    'een poortwachter mag nooit omvallen op zijn eigen boekhouding');
  assert.ok(e.fout, 'en hij zwijgt er niet over (LAT-regel 5): ' + JSON.stringify(e));
  assert.match(e.fout, /pad/, 'de reden noemt wat er onleesbaar was');
  assert.equal(e.context.pad, null);
  /* DE IDENTITEIT BLIJFT BEWEZEN, en dat is geen slordigheid maar het punt: het
     id komt van de POORTWACHTER, die zijn werk gewoon heeft gedaan. Hem hier
     naar 'onbekend' trekken zou een bewezen actor onbewezen maken om een
     onleesbaar padje -- dan gaat het oordeel over iets anders dan waar het over
     hoort te gaan. Deze bewering stond eerst andersom en was fout. */
  assert.equal(e.actor.identiteit, 'bewezen');
  assert.equal(e.actor.id, 'l');
});

test('valt de opbouw ZELF om, dan is de identiteit onbekend en staat de reden erin', () => {
  /* Het echte vangnet: een waarde die niet eens in tekst om te zetten is. Dan is
     er over de actor niets meer te zeggen, en zegt de envelop dat ook. */
  const gif = { toString() { throw new Error('onvertaalbaar'); } };
  let e;
  assert.doesNotThrow(() => { e = envelop.zet({ path: '/a', method: 'GET', id: 'c' }, { soort: 'lid', id: gif }); });
  assert.equal(e.actor.identiteit, 'onbekend');
  assert.ok(e.fout, 'het vangnet zwijgt niet: ' + JSON.stringify(e));
});

test('een bevroren verzoek krijgt geen envelop maar wel een teruggave', () => {
  const bevroren = Object.freeze({ path: '/a', method: 'GET', id: 'x' });
  let e;
  assert.doesNotThrow(() => { e = envelop.zet(bevroren, { soort: 'lid', id: 'l' }); });
  assert.equal(e.actor.id, 'l');
});

test('te lange waarden worden afgekapt in plaats van doorgelaten', () => {
  const lang = 'x'.repeat(5000);
  const e = envelop.zet(req(), { soort: 'lid', id: lang, naam: lang });
  assert.ok(e.actor.id.length <= 200, 'id niet afgekapt: ' + e.actor.id.length);
  assert.ok(e.actor.naam.length <= 200);
});

/* ---- de tijd komt van de klok van dit huis ---- */

test('de tijd in de context loopt via server/lib/klok, zodat een tijdproef hem verzet', () => {
  const bron = require('fs').readFileSync(require('path').join(__dirname, '..', 'server/opzet/envelop.js'), 'utf8');
  assert.match(bron, /require\('\.\.\/lib\/klok'\)/,
    'de envelop hoort zijn tijd bij de klok te halen; anders staat hij buiten de tijdmachine');
  const e = envelop.zet(req(), { soort: 'lid', id: 'l' });
  assert.equal(typeof e.context.tijd, 'number');
  assert.ok(e.context.tijd > 0);
});
