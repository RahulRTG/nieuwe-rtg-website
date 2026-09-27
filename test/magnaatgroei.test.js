/* Magnaat na 1.0: GROEIEN (./server/kern/magnaat-leven/groei.js). Wie van zijn
   eigen bedrijf leeft, kan een krediet vragen, een filiaal openen en een
   concurrent overnemen. Wat hier vastligt:
   - voor je zelfstandig bent is geen van de drie er, en een weigering zegt waarom;
   - de bank leent op wat er binnenkwam, met rente als kosten en aflossing als schuld;
   - een filiaal kost huur, vraagt iemand van je team en maakt je zichtbaarder;
   - een overgenomen concurrent verdwijnt van de markt, zijn klant zoekt jou, en
     de laatste concurrent blijft;
   - het grootboek klopt na elke stap, en een oude save zonder groei speelt door. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { maakLeven } = require('../server/kern/magnaat-leven');
const { boekVan } = require('../server/kern/magnaat-leven/boek');
const G = require('../server/kern/magnaat-leven/regels-groei');
const M = require('../server/kern/magnaat-leven/regels-markt');
const { aandelen } = require('../server/kern/magnaat-leven/markt');
const { zichtbaarheid, teamMax } = require('../server/kern/magnaat-leven/bereik');
const B = require('../server/kern/magnaat-leven/regels-bedrijf');
const { ontvangen } = require('../server/kern/magnaat-leven/geld');
const { maakSpeler } = require('./lib-magnaatspeler');

/* Een keer spelen tot je van je bedrijf leeft; elke toets krijgt een kopie. */
const basis = (() => {
  const p = maakSpeler({});
  for (let i = 0; i < 200 && !p.st().zelfstandig; i++) p.dag();
  assert.ok(p.st().zelfstandig, 'de speler wordt zelfstandig');
  return p.db.data;
})();
function zelfstandig() {
  const db = { data: structuredClone(basis) };
  const L = maakLeven({ db, nu: () => 1e12 });
  const v = { db, L, st: () => db.data.magnaatLeven.speler, s: () => L.staat('speler'), doe: (b) => L.actie('speler', b) };
  v.handelingen = () => v.s().vandaag.volgende.map(a => a.actie);
  v.geld = (b) => boekVan(v.st()).boekOver(v.st(), { soort: 'OPENING', van: ['begin'], naar: ['kas'], bedrag: b, omschrijving: 'proef', sleutel: 'proef:' + b });
  L.staat('speler');
  v.slaap = (n) => { for (let i = 0; i < n; i++) v.doe({ actie: 'slaap' }); };
  return v;
}

test('voor je zelfstandig bent is er niets om te groeien, en een weigering zegt waarom', () => {
  const p = maakSpeler({});
  for (let i = 0; i < 60; i++) p.dag();
  assert.ok(!p.st().zelfstandig);
  for (const actie of ['krediet', 'filiaal', 'overname']) {
    assert.ok(!p.beeld().vandaag.volgende.some(a => a.actie === actie), actie + ' staat er niet');
    assert.match(p.L.actie(p.key, { actie, bedrag: 5000, wijk: 'haven', bedrijf: 'pixel' }).error, /zeg eerst je baan op/);
  }
  assert.equal(p.beeld().bedrijf.groei.open, false);
});

test('krediet: de bank leent op wat binnenkwam, rente is kosten, aflossen is schuld, en na zes termijnen is het klaar', () => {
  const v = zelfstandig();
  assert.ok(v.handelingen().includes('krediet'));
  const ruimte = Math.min(G.KREDIET.max, 2 * ontvangen(v.st(), 56));
  assert.equal(v.s().bedrijf.groei.kredietRuimte, ruimte);
  assert.match(v.doe({ actie: 'krediet', bedrag: ruimte / 100 + 1 }).error, /leent je € 1\.000,00 tot/);
  const kas = v.st().kas, bedrag = 1000000;
  assert.ok(!v.doe({ actie: 'krediet', bedrag: bedrag / 100 }).error);
  assert.equal(v.st().kas, kas + bedrag);
  const b = boekVan(v.st());
  assert.equal(-b.saldo(v.st(), ['schuld', 'financier']), bedrag, 'een schuld aan de bank');
  assert.equal(v.st().posten.filter(p => p.soort === 'krediet').reduce((s, p) => s + p.bedrag, 0), bedrag);
  assert.equal(v.st().posten.filter(p => p.soort === 'rente').reduce((s, p) => s + p.bedrag, 0), 60000, '6% rente');
  assert.match(v.doe({ actie: 'krediet', bedrag: 1000 }).error, /al een krediet/);
  assert.ok(!v.handelingen().includes('krediet'));
  v.geld(5000000);
  v.slaap(G.KREDIET.termijnen * G.KREDIET.elke + 1);
  assert.equal(v.st().groei.krediet, null, 'afgelost');
  assert.equal(b.saldo(v.st(), ['schuld', 'financier']), 0);
  assert.equal(b.saldo(v.st(), ['kosten', 'rente']), 60000, 'de rente staat in je kosten');
  assert.ok(v.s().bedrijf.kosten.some(k => k.naam === 'Rente op je krediet'));
  assert.equal(v.L.verifieer('speler').ok, true);
});

test('filiaal: niet naast je huiskamer, niet zonder team, en dan huur en zichtbaarheid', () => {
  const v = zelfstandig();
  assert.equal(v.st().vestiging.wijk, 'thuis');
  assert.match(v.doe({ actie: 'filiaal', wijk: 'haven' }).error, /huur eerst een bedrijfsruimte/);
  v.geld(3000000);
  assert.ok(!v.doe({ actie: 'vestig', wijk: 'oost' }).error);
  assert.ok(v.handelingen().includes('filiaal'));
  assert.match(v.doe({ actie: 'filiaal', wijk: 'oost' }).error, /een filiaal staat ergens anders/);
  assert.match(v.doe({ actie: 'filiaal', wijk: 'thuis' }).error, /wijk met een bedrijfsruimte/);
  if (v.st().team.filter(m => !m.weg).length === 0) {
    assert.match(v.doe({ actie: 'filiaal', wijk: 'haven' }).error, /neem eerst iemand aan/);
    const k = v.s().vandaag.volgende.find(a => a.actie === 'werf').invoer.kandidaat[0].id;
    assert.ok(!v.doe({ actie: 'werf', kandidaat: k }).error);
  }
  const zicht = zichtbaarheid(v.st()), kas = v.st().kas;
  assert.ok(!v.doe({ actie: 'filiaal', wijk: 'haven' }).error);
  const w = M.WIJKEN.haven;
  assert.equal(v.st().kas, kas - w.verhuis - w.huur, 'inrichten en de eerste huur');
  assert.equal(zichtbaarheid(v.st()), zicht + w.zichtbaar * G.FILIAAL.zichtbaar / 100);
  assert.equal(teamMax(v.st()), B.TEAM_MAX + G.FILIAAL.extraMensen, 'plek voor meer mensen');
  assert.deepEqual(v.s().bedrijf.groei.filiaal, { wijk: 'haven', naam: w.naam, huur: w.huur });
  assert.match(v.doe({ actie: 'filiaal', wijk: 'centrum' }).error, /al een filiaal/);
  assert.match(v.doe({ actie: 'vestig', wijk: 'haven' }).error, /Daar staat je filiaal al/);
  const voor = boekVan(v.st()).saldo(v.st(), ['kosten', 'huisvesting']);
  const dag = v.st().dag;
  v.slaap(29);
  assert.ok(boekVan(v.st()).saldo(v.st(), ['kosten', 'huisvesting']) >= voor + w.huur, 'na vier weken weer huur voor het filiaal');
  assert.equal(v.st().groei.filiaal.volgende, dag + 56, 'en de volgende over vier weken');
  assert.equal(v.L.verifieer('speler').ok, true);
});

test('overname: de concurrent verdwijnt, zijn mens komt mee, zijn klant zoekt jou, en de laatste blijft', () => {
  const v = zelfstandig();
  const a = aandelen(v.st()), prijs = Math.max(G.OVERNAME.minimum, a.pixel * G.OVERNAME.perPromille);
  const keuze = v.s().vandaag.volgende.find(x => x.actie === 'overname').invoer.bedrijf;
  assert.deepEqual(keuze.map(c => c.id), ['pixel', 'noord', 'snel']);
  assert.match(v.doe({ actie: 'overname', bedrijf: 'niemand' }).error, /Kies een concurrent/);
  if (v.st().kas < prijs) assert.match(v.doe({ actie: 'overname', bedrijf: 'pixel' }).error, /krediet van de bank kan helpen/);
  v.geld(6000000);
  const kas = v.st().kas, deals = v.st().deals.length;
  assert.ok(!v.doe({ actie: 'overname', bedrijf: 'pixel' }).error);
  assert.equal(v.st().kas, kas - prijs - B.WERKPLEK.bedrag, 'de koopsom, en een werkplek voor wie meekomt (je werkt thuis)');
  assert.equal(boekVan(v.st()).saldo(v.st(), ['kosten', 'overname']), prijs);
  assert.equal(aandelen(v.st()).pixel, undefined, 'geen aandeel meer');
  assert.ok(!v.s().wereld.markt.concurrenten.some(c => c.naam === 'Pixelwerk'));
  assert.equal(v.st().deals.length, deals + 1, 'een klant van Pixelwerk zoekt jou');
  assert.match(v.st().meldingen.map(m => m.tekst).join(' '), /was klant van Pixelwerk, dat nu van jou is/);
  assert.deepEqual(v.s().bedrijf.groei.overgenomen, ['Pixelwerk']);
  const noor = v.st().team.find(m => m.id === 'o-pixel');
  assert.deepEqual([noor.naam, noor.contract, noor.uurloon], ['Noor', 'dienst', G.OVERNAME.mens.uurloon], 'wie er werkte, komt mee');
  assert.match(v.doe({ actie: 'overname', bedrijf: 'pixel' }).error, /Kies een concurrent om over te nemen: WebStudio Noord, SnelSite/);
  assert.ok(!v.doe({ actie: 'overname', bedrijf: 'noord' }).error);
  assert.ok(!v.handelingen().includes('overname'), 'de laatste staat niet meer te koop');
  assert.match(v.doe({ actie: 'overname', bedrijf: 'snel' }).error, /laatste concurrent/);
  v.slaap(28);
  assert.equal(v.L.verifieer('speler').ok, true, 'met een concurrent over draait de markt door');
  /* Zestien weken: elke dag de open kansen wegzetten (anders stopt de markt bij twee
     open kansen), en tellen hoe vaak een vaste klant van een overgenomen bedrijf komt. */
  let terug = 0;
  for (let i = 0; i < 112; i++) {
    v.doe({ actie: 'slaap' });
    for (const d of v.st().deals) if (d.fase === 'kans') d.fase = 'afgehaakt';
    terug += v.st().meldingen.filter(m => m.dag === v.st().dag && /dat nu van jou is/.test(m.tekst)).length;
  }
  assert.ok(terug >= 2, 'de klanten van wie je overnam blijven komen: ' + terug + ' keer in zestien weken');
  assert.ok(v.st().mijlpalen.some(m => m.id === 'overname'));
});

test('een oude save zonder groei speelt door, en de mijlpalen komen in je verhaal', () => {
  const oud = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'magnaat-leven-v1.json'), 'utf8'));
  const L = maakLeven({ db: { data: structuredClone(oud.data) }, nu: () => 1e12 });
  assert.equal(L.staat('oud').bedrijf, null);
  const st = structuredClone(oud.data.magnaatLeven.oud);
  assert.equal(st.groei, undefined);
  require('../server/kern/magnaat-leven/groei').groeiDag(st);
  assert.equal(st.groei, undefined, 'een dag zonder groei verandert niets');
  const v = zelfstandig();
  v.geld(6000000);
  v.doe({ actie: 'krediet', bedrag: 1000 });
  assert.deepEqual(v.s().verhaal.mijlpalen.filter(m => ['krediet'].includes(m.id)).map(m => m.id), ['krediet']);
});

test('het scherm bouwt de keuze van een bedrijf en stuurt hem mee', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/apps/magnaat-leven-invoer.js'), 'utf8'), { window });
  const I = window.RTGMagnaatLevenInvoer;
  const a = { actie: 'overname', label: 'Neem een concurrent over', waarom: 'w', invoer: { bedrijf: [{ id: 'pixel', naam: 'Pixelwerk' }] } };
  assert.match(I.html(a, { esc: String, duur: String, vrij: 0 }), /id="vnF-bedrijf"/);
  assert.equal(I.zonderVelden(a), false);
  assert.deepEqual(JSON.parse(JSON.stringify(I.lichaam(a, () => ({ value: 'pixel' })))), { actie: 'overname', bedrijf: 'pixel' });
});

test('een overname brengt iemand mee, dus met een vol team kan het niet', () => {
  const v = zelfstandig();
  v.geld(6000000);
  for (const k of B.TEAMKANDIDATEN) assert.ok(!v.doe({ actie: 'werf', kandidaat: k.id }).error);
  const r = v.doe({ actie: 'overname', bedrijf: 'noord' });
  assert.match(r.error, /Sem van WebStudio Noord komt mee, en je team is vol: open een filiaal/);
  assert.ok(v.s().wereld.markt.concurrenten.some(c => c.naam === 'WebStudio Noord'), 'er is niets gekocht');
  assert.match(v.doe({ actie: 'werf', kandidaat: 'kim' }).error, /werkt al voor je/);
});
