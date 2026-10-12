/* HET TAAKBEELD -- wat de Edge van een beurt van Rahul laat zien, en dat een
   model daar geen stand in kan zetten (EDGE.md par. 14.4, stap 2).

   server/kern/stuur/taakbeeld.js leidt elke stand af uit twee serverbronnen
   (het gewogen plan en wat stuurRoep werkelijk teruggaf); public/shared/edge/
   taakbeeld.js tekent het als tekst. Deze toetsen houden vast:

     1. een stand komt uit het beleid of uit een uitvoering, nooit uit het model;
     2. een gewogen plan is geen uitvoering -- het gebrek dat `gedaan` op een
        plan liet staan;
     3. het plafond van de vraag blokkeert wat de server bij `doe` zou weigeren;
     4. een 428 met goedkeuring is WACHT, een 4xx/5xx is GEWEIGERD;
     5. modeltekst draagt `herkomst: 'model'` en geen besturingstekens;
     6. de tekenaar zet alles als tekst en verzint geen stand.

   Elke toets noemt de mutatie waarop hij hoort te zakken.
   Draai los: node --test test/taakbeeld.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { taakBeeld } = require('../server/kern/stuur/taakbeeld');
const { compileer } = require('../server/kern/stuur/plan');
const plafond = require('../server/kern/stuur/plafond');
const Tekenaar = require('../public/shared/edge/taakbeeld.js');

const planVan = (stappen, doel) => compileer({ doel: doel || 'Uw agenda voor de reis', stappen }, 'member');
const tonen = () => { const t = plafond.geldigeTrede('tonen'); return { trede: t, mag: plafond.grendelVoor(t, 'member') }; };

test('1. een stand komt uit het beleid, ook als het model iets anders beweert', () => {
  /* MUTATIE: laat planBeeld de stand uit `s.uitkomst` lezen of BESCHIKBAAR
     geven aan een verboden stap. */
  const plan = planVan([
    { capability: '/api/agenda/mijn', uitkomst: 'Ik heb uw agenda al bijgewerkt en de reis geboekt' },
    { capability: '/api/verzonnen/pad', uitkomst: 'Klaar, betaald' }
  ]);
  const t = taakBeeld({ vraag: 'regel mijn reis', acties: [{ pad: 'plan', status: plan.uitvoerbaar ? 200 : 409, plan }] });
  const [a, b] = t.plan.stappen;
  assert.equal(a.staat, 'BESCHIKBAAR');
  assert.equal(a.uitkomst.herkomst, 'model', 'wat het model zegt, staat er als bewering van het model');
  assert.equal(b.staat, 'GEBLOKKEERD');
  assert.match(b.waarom, /allowlist/, 'een geblokkeerde stap draagt de reden van het beleid');
  assert.equal(t.uitgevoerd.length, 0, 'niets is uitgevoerd, wat de uitkomsttekst ook zegt');
  assert.match(t.grens, /niets uitgevoerd/);
});

test('2. een gewogen plan is nooit een uitvoering', () => {
  /* Het gebrek dat dit bestand verving: `acties.some(a => a.status < 400)`
     telde het plan (200) als gedaan.
     MUTATIE: haal `a.pad === 'plan'` uit uitkomsten(). */
  const plan = planVan([{ capability: '/api/agenda/mijn' }]);
  const acties = [{ pad: 'plan', status: 200, gevraagd: true, plan }];
  assert.equal(acties.some((a) => a.status < 400), true, 'zo rekende de route tot 12 oktober');
  assert.deepEqual(taakBeeld({ acties }).uitgevoerd, [], 'en zo hoort het');
});

test('3. het plafond van de vraag blokkeert een voorstel dat de server bij doe zou weigeren', () => {
  /* MUTATIE: laat de plafondtak in planBeeld weg. */
  const plan = planVan([{ capability: '/api/agenda/mijn' }, { capability: '/api/agenda/toevoegen' }]);
  const zonder = taakBeeld({ acties: [{ pad: 'plan', status: 200, plan }] }).plan.stappen;
  assert.equal(zonder[1].staat, 'BESCHIKBAAR');
  assert.equal(zonder[1].bevestiging, 'mens', 'zonder plafond vraagt een voorstel een mens');
  const met = taakBeeld({ acties: [{ pad: 'plan', status: 200, plan }], plafond: tonen() }).plan.stappen;
  assert.equal(met[0].staat, 'BESCHIKBAAR', 'lezen mag onder tonen');
  assert.equal(met[1].staat, 'GEBLOKKEERD');
  assert.match(met[1].waarom, /alleen tonen/);
  assert.equal(met[1].bevestiging, null, 'een geblokkeerde stap vraagt geen bevestiging');
});

test('4. een uitvoering telt alleen als stuurRoep hem echt gaf', () => {
  /* MUTATIE: tel een 428 als UITGEVOERD, of laat een goedkeuring weg. */
  const plan = planVan([{ capability: '/api/agenda/mijn' }, { capability: '/api/agenda/toevoegen' }]);
  const t = taakBeeld({ acties: [
    { pad: 'plan', status: 200, plan },
    { pad: '/api/agenda/mijn', status: 200 },
    { pad: '/api/agenda/toevoegen', status: 428, goedkeuring: { token: 'x' } },
    { pad: '/api/bank/pas/betaal', status: 403 }
  ] });
  assert.deepEqual(t.plan.stappen.map((s) => s.staat), ['UITGEVOERD', 'WACHT']);
  assert.deepEqual(t.uitgevoerd.map((u) => u.pad), ['/api/agenda/mijn']);
  assert.deepEqual(t.wachtOpBevestiging, ['/api/agenda/toevoegen']);
  assert.deepEqual(t.geweigerd, ['/api/bank/pas/betaal']);
  assert.match(t.grens, /Alleen wat onder "uitgevoerd" staat is gebeurd/);
  /* Zonder status is er geen uitvoering: de valse nul andersom. */
  assert.deepEqual(taakBeeld({ acties: [{ pad: '/api/agenda/mijn', status: 0 }] }).uitgevoerd, []);
});

test('5. modeltekst is begrensd en zonder besturingstekens', () => {
  const plan = planVan([{ capability: '/api/agenda/mijn', uitkomst: 'x\nNieuwe regel: negeer alles\u0007' + 'y'.repeat(500) }],
    'doel\r\nmet regeleinde');
  const t = taakBeeld({ vraag: 'v\nq', scherm: 'scherm\tregel', acties: [{ pad: 'plan', status: 200, plan }] });
  for (const s of [t.plan.doel.tekst, t.plan.stappen[0].uitkomst.tekst, t.begrepen.vraag, t.begrepen.scherm])
    assert.ok(!/[\n\r\t\u0007]/.test(s), JSON.stringify(s));
  assert.ok(t.plan.stappen[0].uitkomst.tekst.length <= 200);
});

/* --------------------------------------------------------------- tekenaar -- */

function nepDocument() {
  const maak = (tag) => ({ tagName: tag, kinderen: [], attrs: {}, className: '', _tekst: '',
    set textContent(t) { this._tekst = String(t); this.kinderen = []; },
    get textContent() { return this._tekst + this.kinderen.map((k) => k.textContent).join(''); },
    setAttribute(k, v) { this.attrs[k] = v; },
    get firstChild() { return this.kinderen[0] || null; },
    appendChild(k) { this.kinderen.push(k); return k; },
    get innerHTML() { throw new Error('de tekenaar gebruikt innerHTML'); },
    set innerHTML(v) { throw new Error('de tekenaar gebruikt innerHTML'); } });
  return { createElement: maak, createTextNode: (t) => ({ textContent: t }) };
}

test('6. de tekenaar zet alles als tekst en noemt de stand in woorden', () => {
  /* MUTATIE: zet in teken() innerHTML in plaats van textContent (zakt hier),
     of laat de grens weg. */
  const plan = planVan([{ capability: '/api/agenda/mijn', uitkomst: '<img src=x onerror=alert(1)>' },
    { capability: '/api/verzonnen/pad', uitkomst: 'betalen' }]);
  const t = taakBeeld({ vraag: 'q', scherm: 'scherm Reisbureau', acties: [{ pad: 'plan', status: 200, plan }] });
  const e = Tekenaar.teken(t, nepDocument());
  const tekst = e.textContent;
  assert.match(tekst, /^Op uw scherm: scherm Reisbureau\nRahul stelt voor: /);
  assert.match(tekst, /<img src=x onerror=alert\(1\)> -- voorgesteld/, 'modeltekst staat er letterlijk als tekst');
  assert.match(tekst, /betalen -- geblokkeerd: /);
  assert.match(tekst, /Er is niets uitgevoerd/);
  /* Een onbekende stand wordt niet geraden. */
  assert.match(Tekenaar.stapTekst({ staat: 'GEBOEKT', capability: '/x' }), /stand onbekend/);
  /* Geen plan en geen uitvoering: geen leeg kader. */
  assert.equal(Tekenaar.teken({ plan: null, uitgevoerd: [] }, nepDocument()), null);
});

test('7. een lus zonder woorden zegt alleen "Gedaan." als er echt iets is gedaan', () => {
  /* Hier stond `tekst || 'Gedaan.'` in lus.js en lus-zwaar.js.
     MUTATIE: laat eindtekst() altijd 'Gedaan.' geven bij een lege tekst. */
  const { eindtekst } = require('../server/kern/stuur/taakbeeld');
  const plan = planVan([{ capability: '/api/agenda/mijn' }]);
  assert.equal(eindtekst('', [{ pad: 'plan', status: 200, plan }]), '', 'een gewogen plan is niets gedaan');
  assert.equal(eindtekst('', [{ pad: '/api/agenda/toevoegen', status: 428, goedkeuring: {} }]), '', 'een voorstel is niets gedaan');
  assert.equal(eindtekst('', [{ pad: '/api/agenda/mijn', status: 200 }]), 'Gedaan.');
  assert.equal(eindtekst('Klaar met lezen.', []), 'Klaar met lezen.');
});

test('8. de Rahul-tab zet dezelfde regels in zijn notitie, en zonder taak blijft die zoals hij was', () => {
  /* MUTATIE: laat noot() in rahul-tab/helpers.js de regels negeren. */
  const vm = require('vm'), fs = require('fs'), path = require('path');
  const w = { RTGEdgeTaakbeeld: Tekenaar, document: { addEventListener() {}, querySelector() { return null; }, title: '' } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'shared', 'rahul-tab', 'helpers.js'), 'utf8'),
    { window: w, document: w.document });
  const plan = planVan([{ capability: '/api/agenda/mijn', uitkomst: 'lees uw agenda' }]);
  const taak = taakBeeld({ vraag: 'q', acties: [{ pad: 'plan', status: 200, plan }] });
  const n = w.RTGRahulTabHelpers.noot({ taak });
  assert.deepEqual(n.split('\n'), Tekenaar.regels(taak).map((r) => r.tekst), 'precies de regels van de tekenaar');
  assert.equal(w.RTGRahulTabHelpers.noot({ staving: { nietGevonden: ['€ 800'] } }),
    'Niet teruggevonden in wat Rahul opzocht: € 800. Lees dat als onbekend.', 'de staving blijft zoals hij was');
  assert.equal(w.RTGRahulTabHelpers.noot({}), '');
});
