/* DE INTERPRETATIERAIL -- is hij werkelijk vervangbaar, en grendelt hij dicht?

   Dit bestand bewaakt één belofte: de RTG-keten (resolver -> plan -> gevolg ->
   plafond -> capability) moet te beproeven zijn ZONDER extern model, en de
   vervanger mag alleen de RAIL zijn en nooit de POORT.

   Elke bewering draagt hieronder zijn MUTATIE: wat je moet slopen om hem te
   laten zakken. Een toets die je niet hebt zien zakken is geen toets
   (LAT.md regel 2). Toets 3 en 8 zijn met de hand gedraaid.

   Draai los: node --test test/stuurrail.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const rail = require('../server/kern/stuur/rail');
const { maakCorpusRail, normaliseer, NIET_HERKEND } = require('../server/kern/stuur/rail-corpus');

/* Een modelclient zoals server/ai.js hem teruggeeft: genoeg om ernaar te
   verwijzen, niet meer. */
const NEPMODEL = { aanbieders: ['claude'], messages: { create: async () => ({ content: [], stop_reason: 'end_turn' }) } };

test('1. geen sleutel is NOOIT stilzwijgend deterministisch', () => {
  /* DE BELANGRIJKSTE VAN DE DRIE GRENDELS. `if (!key) gebruik corpus` zou
     betekenen dat elke omgeving die zijn sleutel kwijtraakt stilletjes op een
     corpus van drie zinnen gaat draaien -- en dat merkt niemand, want er komt
     gewoon antwoord. server/server.js r. 241 is precies deze fout, één laag
     lager: een slot dat opengaat als iemand iets vergeet is geen slot.
     MUTATIE: laat waaromNietDeterministisch() null teruggeven als er geen
     modelclient is. */
  const uit = rail.kies({ env: {}, modelclient: null, corpusRail: () => maakCorpusRail({}) });
  assert.equal(uit.naam, 'GEEN', 'zonder vlag hoort er GEEN rail te zijn, geen corpus');
  assert.equal(uit.client, null);
  assert.match(uit.reden, /RTG_INTENT_RAIL/, 'de weigering zegt niet welke grendel dichtzit');
});

test('2. de deterministische rail weigert in productie, ook mét de vlag', () => {
  /* Een vergeten omgevingsvariabele is de normaalste fout die er bestaat.
     MUTATIE: haal de NODE_ENV-regel uit waaromNietDeterministisch(). */
  const env = { RTG_INTENT_RAIL: 'deterministisch', NODE_ENV: 'production' };
  const reden = rail.waaromNietDeterministisch({ env, modelclient: null });
  assert.ok(reden, 'in productie hoort de deterministische rail te weigeren');
  assert.match(reden, /productie/);
  assert.equal(rail.kies({ env, modelclient: null, corpusRail: () => maakCorpusRail({}) }).naam, 'GEEN');
});

test('3. de deterministische rail overschaduwt nooit een echte modelrail', () => {
  /* Een simulatie die een werkende rail verdringt is erger dan geen simulatie.
     MUTATIE: haal de modelclient-regel uit waaromNietDeterministisch() -- dan
     wordt deze CLAUDE-verwachting DETERMINISTISCH. Met de hand gedraaid. */
  const env = { RTG_INTENT_RAIL: 'deterministisch' };
  const uit = rail.kies({ env, modelclient: NEPMODEL, corpusRail: () => maakCorpusRail({}) });
  assert.equal(uit.naam, 'CLAUDE', 'de echte rail hoort te winnen van de deterministische');
  assert.equal(uit.client, NEPMODEL);
});

test('4. mét de vlag, buiten productie en zonder model draait hij wél', () => {
  const uit = rail.kies({ env: { RTG_INTENT_RAIL: 'deterministisch' }, modelclient: null,
    corpusRail: () => maakCorpusRail({}) });
  assert.equal(uit.naam, 'DETERMINISTISCH');
  assert.ok(uit.client && uit.client.messages && typeof uit.client.messages.create === 'function',
    'de rail hoort dezelfde vorm te hebben als de modelclient, anders moet lus.js veranderen');
});

test('5. de railnaam wordt AFGELEID uit de aanbieders en niet overgetypt', () => {
  /* Een tweede lijst rails naast die van server/ai.js is de 22e capabilitylijst
     waar OS.md voor waarschuwt. MUTATIE: geef modelrailNaam() een vaste
     tekenreeks terug. */
  assert.equal(rail.modelrailNaam({ aanbieders: ['local', 'claude'] }), 'LOKAAL');
  assert.equal(rail.modelrailNaam({ aanbieders: ['openai'] }), 'OPENAI');
  assert.equal(rail.modelrailNaam(null), 'GEEN');
  /* Een client die bestaat maar geen bekende aanbieder noemt, is nog steeds een
     MODELrail. Dat is een andere uitslag dan GEEN en wordt er geen. */
  assert.equal(rail.modelrailNaam({ aanbieders: ['iets-nieuws'] }), 'ONBEKEND_MODEL');
});

test('6. de rail VERVANGT DE RAIL en nooit de poort', () => {
  /* MAGNAATLAB.md. Bouwt de adapter zelf begrip of beslissingen, dan toets je
     straks de adapter in plaats van RTG en is groen waardeloos. Dit is een
     BRONtoets omdat een gedragstoets hem niet kan zien.
     MUTATIE: zet `require('./resolver')` in rail-corpus.js. */
  const bron = fs.readFileSync(path.join(WORTEL, 'server/kern/stuur/rail-corpus.js'), 'utf8');
  for (const poort of ['resolver', 'plan', 'gevolg', 'plafond', 'mandaat', 'beleid', 'lusstap']) {
    assert.doesNotMatch(bron, new RegExp("require\\(['\"][^'\"]*" + poort + "['\"]\\)"),
      'de deterministische rail importeert ' + poort + ' -- dan vervangt hij de poort in plaats van de rail');
  }
});

test('7. een onbekende zin levert NIET_HERKEND en géén enkele tool-aanroep', async () => {
  /* Raden is hier de fout die het instrument waardeloos maakt: een rail die
     "parijs vrijdagg" toch als "parijs vrijdag" leest, verbergt precies het gat
     dat een echte rail moet dichten.
     MUTATIE: laat create() bij een onbekende zin de eerste corpusregel pakken. */
  const r = maakCorpusRail({});
  const uit = await r.messages.create({ messages: [{ role: 'user', content: 'parijs vrijdagg' }] });
  assert.equal(uit.stop_reason, 'end_turn');
  assert.equal(uit.content.filter(c => c.type === 'tool_use').length, 0,
    'een onbekende zin mag geen enkele tool aanroepen; dan kan er ook geen effect ontstaan');
  assert.match(uit.content[0].text, /NIET_HERKEND/);
  assert.equal(NIET_HERKEND.startsWith('NIET_HERKEND'), true);
});

test('8. de stapindex komt uit messages en niet uit eigen toestand', async () => {
  /* Twee gesprekken tegelijk zouden elkaars teller overschrijven, en dan
     verschuift het corpus van de een op de beurten van de ander.
     MUTATIE: houd de stapindex in een variabele op moduleniveau. Met de hand
     gedraaid: dan geeft de tweede aanroep hieronder stap 2 in plaats van 1. */
  const r = maakCorpusRail({});
  const vraag = [{ role: 'user', content: 'zet vrijdag in mijn agenda' }];
  const een = await r.messages.create({ messages: vraag });
  const twee = await r.messages.create({ messages: vraag });
  assert.deepEqual(een.content, twee.content,
    'dezelfde beurtenlijst hoort tweemaal dezelfde stap te geven');
  assert.equal(een.content[0].name, 'kaart');
  /* En met één assistant-beurt erbij schuift hij wél op. */
  const derde = await r.messages.create({ messages: vraag.concat([{ role: 'assistant', content: een.content }]) });
  assert.equal(derde.content[0].name, 'plan', 'met een beurt erbij hoort stap 2 te komen');
});

test('9. het corpus draagt de BESTAANDE toolvorm en geen nieuwe', () => {
  /* De vormen komen uit ./gereedschap.js en ./plan.js. Een corpus dat zijn
     eigen velden verzint, bewijst dat de compiler ze afwijst en verder niets.
     MUTATIE: hernoem `capability` naar `pad` in een planstap. */
  const zinnen = require('../server/kern/stuur/rail-corpus-zinnen');
  const agenda = zinnen['zet vrijdag in mijn agenda'];
  const planstap = agenda.stappen.find(s => s.tools && s.tools[0].name === 'plan');
  const invoer = planstap.tools[0].input;
  assert.ok(typeof invoer.doel === 'string' && invoer.doel.length, 'plan vraagt een doel');
  assert.ok(Array.isArray(invoer.stappen) && invoer.stappen.length, 'plan vraagt stappen');
  for (const s of invoer.stappen)
    assert.ok(typeof s.capability === 'string' && s.capability.startsWith('/api/'),
      'een planstap draagt een echt API-pad in `capability`');
});

test('10. elk pad in het corpus bestaat echt in het beleid', () => {
  /* Een corpus dat naar een verzonnen pad wijst, bewijst hooguit dat het plan
     terecht zakt. `verboden` is hier de uitslag die telt: het pad mag bestaan
     en toch dicht zijn, maar het mag niet NERGENS over gaan.
     MUTATIE: zet /api/verzonnen/pad in een planstap. */
  const { beleidVoor } = require('../server/kern/stuur/beleid');
  const zinnen = require('../server/kern/stuur/rail-corpus-zinnen');
  let gezien = 0;
  for (const [zin, regel] of Object.entries(zinnen)) {
    for (const stap of regel.stappen || []) {
      for (const t of stap.tools || []) {
        if (t.name !== 'plan') continue;
        for (const s of t.input.stappen || []) {
          gezien++;
          const oordeel = beleidVoor(s.capability, 'member');
          assert.notEqual(oordeel.niveau, 'verboden',
            'corpusregel "' + zin + '" plant op ' + s.capability +
            ', en dat pad staat niet op de member-allowlist -- dan zakt het plan altijd');
        }
      }
    }
  }
  assert.ok(gezien > 0, 'geen enkele planstap gevonden; dan bewaakt deze toets niets');
});

test('11. normaliseren blijft dom', () => {
  /* Elke regel die hier bij komt is BEGRIP, en begrip hoort in de echte rail.
     Deze toets staat er om die grens zichtbaar te houden, niet om hem te
     verdedigen: hij zakt zodra iemand synoniemen of datums gaat parsen. */
  assert.equal(normaliseer('  Parijs, VRIJDAG!  '), 'parijs vrijdag');
  assert.equal(normaliseer('Wat is TravelOS?'), 'wat is travelos');
});

/* ------------------------------------------------------------------------
   DE INTEGRATIEPROEF: draait de ECHTE keten zonder model?

   Dit is waar het hele bestand om draait. Hierboven staat dat de rail
   vervangbaar is; hier wordt het uitgevoerd. `lus.js` krijgt de corpusrail op
   de plek van de modelclient en verandert geen letter. Wat er dan gebeurt --
   resolver versmalt, compileer() weegt, voorspel() kijkt naar gevolgen -- is de
   echte machine, niet een namaak ervan.

   De stubs eronder zijn met opzet alleen de RANDEN van de lus (de padenlijst,
   de interne aanroep). Zodra een stub iets van kern/stuur/ zou nabouwen, meet
   deze proef zijn eigen fixture. ------------------------------------------ */

function maakLus(railClient) {
  const { classificeer, parseSubs } = require('../server/kern/stuur/classificatie');
  const geroepen = [];
  const stuurRoep = async (req, pad, body) => { geroepen.push({ pad, body }); return { status: 200, antwoord: {} }; };
  /* Een echte member-padenlijst, groot genoeg dat de resolver iets te
     VERSMALLEN heeft -- anders geeft hij de lijst ongefilterd terug en bewijst
     de proef niets over hem. De kandidaten staan hier met de hand, maar ze
     gaan door de ECHTE beleidsfilter: wat niet op de allowlist staat, valt weg
     en kan dus ook niet stilletjes in deze proef binnenkomen. */
  const { toegestanePaden } = require('../server/kern/stuur/beleid');
  const KANDIDATEN = [
    '/api/agenda/mijn', '/api/agenda/toevoegen', '/api/agenda/wijzig', '/api/agenda/verwijder',
    '/api/agenda/bereik', '/api/locatie/mijn', '/api/locatie/deel', '/api/asset/mijn',
    '/api/asset/koop', '/api/site/mijn', '/api/site/bewaar', '/api/site/publiceer',
    '/api/meet/mijn', '/api/meet/maak', '/api/onderwijs/advies', '/api/onderwijs/mijn',
    '/api/leerstof/vakken', '/api/leerstof/les', '/api/mediaos/wereld', '/api/bijles/gesprek',
    '/api/kantoorpakket/mijn', '/api/kantoorpakket/maak',
    /* En twee die er NIET door mogen komen, zodat zichtbaar is dat de echte
       filter draait en niet mijn lijst. */
    '/api/reisbureau/boek', '/api/office/bank/terugstorting'
  ];
  const alle = toegestanePaden(KANDIDATEN, 'member');
  const stuurPaden = () => alle;
  const lus = require('../server/kern/stuur/lus')({
    anthropic: railClient, app: {}, log: null, stuurRoep, stuurPaden,
    classificeer, parseSubs, isolatie: null
  });
  return { lus, geroepen, alle };
}

const NEPREQ = { socket: { localPort: 0 }, get: () => null, session: {} };

test('12. de ECHTE plan- en gevolgmotor draaien zonder enig model', async () => {
  /* `plan` is de enige tool die in `acties` terechtkomt met een status, en die
     status komt rechtstreeks uit compileer(). Staat hij er, dan heeft de echte
     compiler gedraaid -- met de echte gevolgvoorspelling ernaast.
     MUTATIE: geef de corpusregel geen planstap; dan blijft acties leeg. */
  const { lus, alle } = maakLus(maakCorpusRail({}));
  assert.ok(alle.length > 5, 'zonder een echte padenlijst bewijst deze proef niets over de resolver');
  assert.ok(!alle.includes('/api/reisbureau/boek'),
    'de echte beleidsfilter draaide niet: een verboden pad staat nog in de lijst');
  const uit = await lus(NEPREQ, { vraag: 'zet vrijdag in mijn agenda', wereld: 'member' });
  assert.ok(uit, 'de lus gaf null terug; dan bestaat de rail niet');
  const planactie = uit.acties.find(a => a.pad === 'plan');
  assert.ok(planactie, 'de echte plan-compiler is niet geraakt');
  assert.ok(planactie.status === 200 || planactie.status === 409,
    'de status hoort uit compileer() te komen, niet uit de rail');
  assert.match(uit.tekst, /agenda/i, 'de projectie van de corpusregel hoort terug te komen');
});

test('13. een vraag die alleen kijkt, laat geen enkel spoor na', async () => {
  /* De scherpste regel van deze opdracht: GEEN ENKELE BESTAANDE VRAAG MAG DOOR
     DE ROUTEWISSEL AUTOMATISCH EEN SIDE EFFECT KRIJGEN. "parijs vrijdag" roept
     alleen `kaart` aan -- de echte resolver -- en raakt verder niets.
     MUTATIE: zet een `doe`-stap in de corpusregel; dan vult `geroepen` zich. */
  const { lus, geroepen } = maakLus(maakCorpusRail({}));
  const uit = await lus(NEPREQ, { vraag: 'parijs vrijdag', wereld: 'member' });
  assert.ok(uit, 'de lus gaf null terug');
  assert.equal(geroepen.length, 0, 'er is een echte API-aanroep gedaan op een vraag die alleen kijkt');
  assert.equal(uit.acties.filter(a => a.pad && a.pad.startsWith('/api/')).length, 0,
    'er staat een capability-actie in het spoor van een kijkvraag');
  assert.match(uit.tekst, /Parijs/, 'de projectie hoort terug te komen');
});

test('14. een onbekende zin komt nergens in de machine', async () => {
  const { lus, geroepen } = maakLus(maakCorpusRail({}));
  const uit = await lus(NEPREQ, { vraag: 'doe eens iets geks met mijn geld', wereld: 'member' });
  assert.equal(geroepen.length, 0);
  assert.match(uit.tekst, /NIET_HERKEND/);
});
