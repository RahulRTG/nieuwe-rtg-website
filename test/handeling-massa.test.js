/* DE MASSA-BEWERKINGEN MELDEN HUN OMVANG (TAKEN.md 4.74).

   WAT HIER OP HET SPEL STAAT. server/opzet/handeling.js telt per verzoek de
   RIJEN in db.data en zegt zo hoe groot een handeling was. Zijn grootste blinde
   vlek staat in zijn eigen kop: een wijziging BINNEN een rij ziet hij niet.
   Vierduizend medewerkers op non-actief is dan nul. `raakt()` bestond voor die
   klasse en werd door NIEMAND aangeroepen -- een functie die er is en niets doet
   is een voornemen en geen dekking.

   DEZE TOETS DOET HET OMGEKEERDE VAN EEN GERUSTSTELLING. Hij draait de drie
   zwaarste bewerkingen die dit huis kent -- de loonrun, het vastgestelde
   weekrooster en het bord van een lid -- als ECHTE code binnen de meting, en
   eist per stuk twee dingen tegelijk:

     1. de rij-telling ziet er (bijna) niets van; dat is de blinde vlek, en die
        wordt hier zichtbaar gemaakt en niet weggeschreven;
     2. het gemelde getal slaat wel uit, en het is het ECHTE aantal en niet 1.

   Zonder die tweede eis zou "hij roept raakt() aan" ook waar zijn met
   raakt('iets', 1) onder een run van vierhonderd stroken, en dan meet de blast
   radius nog steeds niet wat er gebeurde.

   EN HIJ MAG NOOIT WEIGEREN. Een meter die een loonrun kan laten vastlopen is
   erger dan geen meter. De laatste toets draait dezelfde bewerkingen BUITEN een
   verzoek en eist dat de uitkomst tot op het veld hetzelfde is.

   Draai los: node --test test/handeling-massa.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const handeling = require('../server/opzet/handeling');

/* Hetzelfde harnas als test/handeling.test.js: de middleware echt draaien
   zonder server, en res.finish zelf afvuren zoals Express dat doet. */
function meet(data, werk) {
  const req = { id: 'corr-massa', path: '/api/proef', method: 'POST' };
  const luisteraars = {};
  const res = { on: (n, fn) => { (luisteraars[n] = luisteraars[n] || []).push(fn); } };
  const mw = handeling.middleware({ data: () => data, log: () => {} });
  let uitkomst = null;
  mw(req, res, () => { uitkomst = werk(); });
  for (const fn of luisteraars.finish || []) fn();
  return { h: req.handeling, uitkomst };
}

/* De som van wat de handeling ZELF meldde, los van de rij-telling. */
const gemeld = (h) => h.gemeld.reduce((n, g) => n + g.aantal, 0);
const rijen = (h) => h.wijzigingen.reduce((n, w) => n + Math.abs(w.delta), 0);

/* ---------- 1. de loonrun ---------- */

function loonrun(aantal) {
  const runs = [];
  const opslag = { bak: () => runs };
  const strook = { nettoCenten: 100000, kostenWerkgeverCenten: 130000, valuta: { code: 'EUR' } };
  const run = require('../server/kern/payroll/run.js').maakRun({
    opslag, save: () => {}, crypto,
    motor: { bereken: () => Object.assign({}, strook), controleer: () => [] },
    regelpakket: { opDatum: () => ({ versie: '2026.1', stand: 'goedgekeurd' }) },
    componenten: { geldigOp: () => [] }
  });
  const regels = [];
  for (let i = 0; i < aantal; i++) regels.push({ staffId: i, naam: 'mw' + i, invoer: {}, contract: {} });
  return { run, runs, regels };
}

test('DE LOONRUN: honderd stroken zijn EEN rij, en de melding zegt honderd', () => {
  const { run, runs, regels } = loonrun(100);
  const data = { runs };
  const r = meet(data, () => run.open({ code: 'z1', zaak: 'Zaak', periode: '2026-07', land: 'NL', regels, door: 'kantoor' }));
  assert.ok(r.uitkomst.ok, JSON.stringify(r.uitkomst));
  /* De blinde vlek, hardop: de rij-telling zag EEN rij bewegen voor honderd
     loonstroken. Dat is precies het verschil dat 4.74 wilde zien. */
  assert.equal(rijen(r.h), 1);
  assert.equal(gemeld(r.h), 100, 'de run meldde zijn omvang niet, of meldde er 1');
  assert.equal(r.h.geraakt, 101);
});

test('DEFINITIEF MAKEN verandert geen enkele rij, en slaat toch uit', () => {
  /* De zuiverste vorm van de blinde vlek: er komt niets bij en er gaat niets
     af, en toch gaat er in een klap honderd keer loon naar onaanraakbaar. */
  const { run, runs, regels } = loonrun(100);
  const geopend = run.open({ code: 'z1', zaak: 'Zaak', periode: '2026-07', land: 'NL', regels, door: 'kantoor' });
  run.keurGoed(geopend.run.id, 'manager', 'anna', null);
  run.keurGoed(geopend.run.id, 'administrateur', 'bram', null);
  const data = { runs };
  const r = meet(data, () => run.maakDefinitief(geopend.run.id, 'bram'));
  assert.ok(r.uitkomst.ok, JSON.stringify(r.uitkomst));
  assert.equal(rijen(r.h), 0, 'er bewoog een rij; dan is dit niet meer de blinde vlek die hier wordt gemeten');
  assert.equal(r.h.geraakt, 100, 'een massale statuswijziging kwam als nul binnen');
});

/* ---------- 2. het weekrooster ---------- */

function roosterlab(personeel) {
  const zaak = { code: 'z1', name: 'Zaak' };
  const staff = [];
  for (let i = 0; i < personeel; i++) staff.push({ id: i, name: 'mw' + i, role: i === 0 ? 'manager' : 'kok' });
  const agent = require('../server/kern/agent.js').maakAgent({
    db: { data: {} }, crypto, findSupplier: () => zaak, notifySupplier: () => {},
    ghBijbestelVoorstel: () => {}, ghPlaatsBestelling: () => {},
    accounts: { listStaff: () => staff, publicStaff: (m) => m },
    weekdagFactor: () => [1.0, 'dinsdag'], SHIFT_NAMES: ['dag', 'avond', 'vrij'],
    save: () => {}, logActivity: () => {}
  });
  return { agent, zaak };
}

test('HET ROOSTER: zeven dagen maal het personeel, en nul rijen verschil', () => {
  const { agent, zaak } = roosterlab(12);
  agent.roosterVoorstel(zaak);
  const data = { zaken: [zaak] };
  const r = meet(data, () => agent.roosterBeslis(zaak, 'akkoord', 'manager'));
  assert.ok(r.uitkomst.ok, JSON.stringify(r.uitkomst));
  assert.equal(rijen(r.h), 0, 'roosterVast is een veld op de zaak; er hoort geen rij te bewegen');
  assert.equal(r.h.geraakt, 7 * 12, 'het vastgestelde rooster meldde zijn omvang niet');
  assert.deepEqual(r.h.doel, [], 'de rij-telling ziet hier met recht niets');
});

/* ---------- 3. het bord van een lid ---------- */

function bordlab() {
  const { CAPS, OP_ID } = require('../server/kern/lidboard/catalogus.js');
  const bak = {};
  const store = () => bak;
  const aan = (s, id) => (bak[s] || {})[id] !== false;
  const schakel = require('../server/kern/lidboard/schakel.js')({
    store, versie: (s) => Number((bak[s] || {})._v || 0), aan, save: () => {},
    journaal: { noteer: () => {} }, bord: () => ({}), beheerStand: () => null
  });
  return { schakel, CAPS, OP_ID, bak };
}

test('HET LEDENBORD: "alles uit" is een rij en tientallen wijzigingen', () => {
  const { schakel, CAPS } = bordlab();
  /* Alles wat uit MAG: een vaste functie slaat de schakellaag met opzet over,
     dus het verwachte getal wordt hier uit de catalogus gerekend en niet
     overgetypt -- anders zakt deze toets bij elke functie die erbij komt. */
  const standen = {};
  for (const c of CAPS) if (!c.vast) standen[c.id] = false;
  const teVerwachten = Object.keys(standen).length;
  assert.ok(teVerwachten > 20, 'te weinig functies om dit een massa-bewerking te noemen');

  const data = { leden: [{ id: 'lid-7' }] };
  const r = meet(data, () => schakel.zetVeel('lid-7', standen, {}));
  assert.equal(r.uitkomst.status, 200, JSON.stringify(r.uitkomst));
  assert.equal(rijen(r.h), 0, 'het bord woont in een veld; er hoort geen rij te bewegen');
  assert.equal(r.h.geraakt, teVerwachten);
  assert.equal(r.uitkomst.gewijzigd, teVerwachten, 'de melding en het antwoord tellen niet hetzelfde');
});

test('NIETS VERANDERD MELDT NIETS: dezelfde stand nog een keer is geen handeling', () => {
  /* Dezelfde regel die het journaal al hanteert. Zou de melding op het AANBOD
     zitten in plaats van op de wijzigingen, dan zou een dubbelklik de blast
     radius verdubbelen. */
  const { schakel, CAPS } = bordlab();
  const standen = {};
  for (const c of CAPS) if (!c.vast) standen[c.id] = false;
  schakel.zetVeel('lid-7', standen, {});
  const r = meet({ leden: [] }, () => schakel.zetVeel('lid-7', standen, {}));
  assert.equal(r.h.geraakt, 0);
});

/* ---------- de grens van de melder ---------- */

test('HIJ MELDT EN HIJ WEIGERT NIET: buiten een verzoek verandert er niets', () => {
  /* Een meter die een loonrun kan laten vastlopen is erger dan geen meter.
     Buiten een verzoek is er geen context, geeft raakt() false, en hoort de
     uitkomst tot op het veld dezelfde te zijn als binnen een verzoek. */
  assert.equal(handeling.huidige(), null);
  assert.equal(handeling.raakt('loonstroken', 100), false);

  const a = loonrun(30);
  const buiten = a.run.open({ code: 'z1', zaak: 'Zaak', periode: '2026-07', land: 'NL', regels: a.regels, door: 'kantoor' });
  const b = loonrun(30);
  const binnen = meet({ runs: b.runs },
    () => b.run.open({ code: 'z1', zaak: 'Zaak', periode: '2026-07', land: 'NL', regels: b.regels, door: 'kantoor' })).uitkomst;
  assert.ok(buiten.ok && binnen.ok);
  /* Het id en de tijdstempel verschillen per run; de rest hoort gelijk te zijn. */
  const zonderId = (r) => Object.assign({}, r.run, { id: null, at: null });
  assert.deepEqual(zonderId(buiten), zonderId(binnen));
  assert.deepEqual(buiten.waarschuwingen, binnen.waarschuwingen);
});

test('MUTATIE: haal een melding weg en die massa-bewerking meet weer nul', () => {
  /* LAT.md regel 10 -- een toets die je niet hebt zien zakken is geen toets. En
     hij gaat over alle DRIE de plekken: was er maar een gemuteerd, dan zou een
     stille verwijdering in de twee andere hier ongemerkt langskomen. De echte
     bron wordt gemuteerd en in de finally teruggezet; een kill tussen die twee
     laat de mutatie staan. */
  const fs = require('fs');
  const path = require('path');
  const plekken = [
    { bestand: 'server/kern/lidboard/schakel.js',
      zoek: "if (wijzigingen.length) handeling.raakt('lidfuncties', wijzigingen.length);",
      proef: () => {
        const { schakel, CAPS } = bordlab();
        const standen = {};
        for (const c of CAPS) if (!c.vast) standen[c.id] = false;
        return meet({ leden: [] }, () => schakel.zetVeel('lid-7', standen, {})).h;
      } },
    { bestand: 'server/kern/agent.js',
      zoek: "handeling.raakt('roosterdiensten', a.rooster.days.reduce((n, d) => n + d.staff.length, 0));",
      proef: () => {
        const { agent, zaak } = roosterlab(12);
        agent.roosterVoorstel(zaak);
        return meet({ zaken: [zaak] }, () => agent.roosterBeslis(zaak, 'akkoord', 'manager')).h;
      } },
    { bestand: 'server/kern/payroll/run.js',
      zoek: "handeling.raakt('loonstroken', run.stroken.length);",
      proef: () => {
        const { run, runs, regels } = loonrun(100);
        const g = run.open({ code: 'z1', zaak: 'Zaak', periode: '2026-07', land: 'NL', regels, door: 'kantoor' });
        run.keurGoed(g.run.id, 'manager', 'anna', null);
        run.keurGoed(g.run.id, 'administrateur', 'bram', null);
        return meet({ runs }, () => run.maakDefinitief(g.run.id, 'bram')).h;
      } }
  ];

  for (const plek of plekken) {
    const vol = path.join(__dirname, '..', plek.bestand);
    const origineel = fs.readFileSync(vol, 'utf8');
    assert.ok(origineel.includes(plek.zoek), 'de aanname onder deze mutatie klopt niet meer: ' + plek.bestand);
    const leeg = () => {
      for (const b of plekken) delete require.cache[require.resolve(path.join(__dirname, '..', b.bestand))];
    };
    try {
      fs.writeFileSync(vol, origineel.replace(plek.zoek, ''));
      leeg();
      assert.equal(plek.proef().geraakt, 0,
        'zonder de melding in ' + plek.bestand + ' hoort deze bewerking weer onzichtbaar te zijn');
    } finally {
      fs.writeFileSync(vol, origineel);
      leeg();
    }
    assert.ok(plek.proef().geraakt > 0, 'de mutatie in ' + plek.bestand + ' is niet teruggezet');
  }
});
