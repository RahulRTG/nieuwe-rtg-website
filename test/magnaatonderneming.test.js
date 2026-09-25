/* Magnaat V2 ONDERNEMING: wat er gebeurt als je bedrijf groter wordt dan jij.
   Personeel dat loon kost voordat de klant betaalt, planning over meer mensen,
   contracten met vaste uren, een leverancier die eerst geld wil, voorraad die
   geld op de plank is, verkoop, kosten per soort, en een prognose die zegt wat
   ze niet weet. Elke euro loopt door het grootboek, en de toets kijkt daar. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakLeven } = require('../server/kern/magnaat-leven');
const R = require('../server/kern/magnaat-leven/regels');
const B = require('../server/kern/magnaat-leven/regels-bedrijf');
const { boekVan } = require('../server/kern/magnaat-leven/boek');

function leven() {
  let t = 1e12;
  const db = { data: {} };
  const L = maakLeven({ db, nu: () => t });
  const v = {
    db, L, s: L.staat('lid'),
    st: () => db.data.magnaatLeven.lid,
    doe(b) { const r = L.actie('lid', b); if (!r.error) v.s = r; return r; },
    ok(b) { const r = v.doe(b); assert.ok(!r.error, b.actie + ': ' + r.error); return r; },
    slaap(n = 1) { for (let i = 0; i < n; i++) v.doe({ actie: 'slaap' }); return v.s; },
    tot(weekdag) { while (R.weekdag(v.s.dag) !== weekdag) v.slaap(); return v.s; },
    saldo: (rek) => ((v.st().boek.rekeningen[v.st().wereld + ':' + rek] || {}).saldo || 0),
    meldt: (re) => v.st().meldingen.some(m => re.test(m.tekst))
  };
  return v;
}

/* Een onderneming zonder de hele V1-keten: het spel moet hebben vastgesteld
   dat je onderneemt (dat is V1, en daar staat een eigen toets voor), en de
   inschrijving betaal je van je eerste loon. */
function ondernemer(aanbod = 'websites', { kapitaal = 500000 } = {}) {
  const v = leven();
  v.ok({ actie: 'kies', aanbod });
  v.tot(R.BAAN.loondag + 1);
  v.st().ondernemingVraag = v.s.dag;
  v.ok({ actie: 'onderneming', naam: 'Proef Oudwijk' });
  /* Wat een V1-bedrijf na een paar maanden op de bank heeft, als eigen
     vermogen in het grootboek en niet als verzonnen saldo. */
  if (kapitaal) boekVan(v.st()).boekOver(v.st(), { soort: 'OPENING', van: ['begin'], naar: ['kas'], bedrag: kapitaal, omschrijving: 'Opgebouwd in V1', sleutel: 'proefkapitaal' });
  v.s = v.L.staat('lid');
  return v;
}
/* Een klant die je al eens betaalde: de geschiedenis waar een contract uit komt. */
function oudeKlant(v, klantId = 'cafe', klant = 'Café De Brug') {
  v.st().deals.push({ id: 'dOud', klantId, klant, fase: 'betaald', betaaldOp: v.s.dag, sinds: 1, rondes: [], gedaan: 840,
    afspraak: { bedrag: 84000, voorschot: 0, voorschotBedrag: 0, minuten: 840, deadline: v.s.dag, dag: 1 } });
}

test('zonder onderneming geen personeel en geen groothandel, met de reden erbij', () => {
  const v = leven();
  v.ok({ actie: 'kies', aanbod: 'websites' });
  assert.match(v.doe({ actie: 'werf', kandidaat: 'daan' }).error, /als onderneming/);
  assert.match(v.doe({ actie: 'bestel', aantal: 3 }).error, /als onderneming/);
  assert.ok(!v.s.vandaag.volgende.some(a => ['werf', 'bestel'].includes(a.actie)));
});

test('personeel in dienst kost elke vrijdag loon, ook in een week zonder werk, plus een werkplek en een licentie', () => {
  const v = ondernemer();
  const dag = v.s.dag;
  v.ok({ actie: 'werf', kandidaat: 'daan' });
  assert.equal(v.saldo('kosten:werkplek'), B.WERKPLEK.bedrag, 'de werkplek is meteen betaald');
  assert.match(v.doe({ actie: 'werf', kandidaat: 'daan' }).error, /werkt al voor je/);
  v.tot(R.BAAN.loondag);
  let minuten = 0;
  for (let d = dag; d < v.s.dag; d++) if ([0, 1, 3].includes(R.weekdag(d))) minuten += 480;
  assert.ok(minuten > 0);
  assert.equal(v.saldo('kosten:personeel'), minuten * 2600 / 60, 'loon over zijn contractdagen, zonder dat hij iets deed');
  assert.ok(v.s.rtg.some(r => r.id === 'personeel'));
  assert.equal(v.s.bedrijf.team[0].naam, 'Daan');
  assert.equal(v.L.verifieer('lid').ok, true);
});

test('planning: een teamlid werkt aan opdrachten, op zijn eigen dagen, en een junior doet er langer over', () => {
  const v = ondernemer();
  oudeKlant(v);
  v.ok({ actie: 'werf', kandidaat: 'kim' });
  v.slaap(B.KLANTCONTRACT.naDagen);
  const c = v.s.vandaag.volgende.find(a => a.actie === 'teken');
  assert.ok(c, 'een oude klant biedt een contract aan');
  v.ok(Object.assign({ actie: 'teken' }, c.invoer));
  const d = v.s.netwerk.contacten.find(x => x.fase === 'overeenkomst');
  assert.match(v.doe({ actie: 'plan', wie: 'kim', wat: 'project', dag: v.s.dag, minuten: 60 }).error, /blijven van jou/);
  v.tot(1);
  assert.match(v.doe({ actie: 'plan', wie: 'kim', wat: 'opdracht', deal: d.id, dag: v.s.dag, minuten: 60 }).error, /werkt op maandag, woensdag/);
  v.tot(0);
  const hint = v.s.vandaag.volgende.find(a => a.actie === 'plan' && a.invoer.wie === 'kim');
  assert.ok(hint, 'de Edge stelt voor Kim in te plannen');
  v.ok(Object.assign({ actie: 'plan' }, hint.invoer));
  assert.match(v.doe({ actie: 'plan', wie: 'kim', wat: 'opdracht', deal: d.id, dag: v.s.dag, minuten: 30 }).error, /heeft Kim nog 0m vrij/);
  v.slaap();
  assert.equal(v.s.netwerk.contacten.find(x => x.id === d.id).gedaan, Math.floor(480 * 70 / 100), 'acht uur van een junior is 5u 36m werk');
});

test('loon dat niet betaald kan worden: hij legt het werk neer, gaat na een week weg, en het loon blijft verschuldigd', () => {
  const v = ondernemer('websites', { kapitaal: 0 });
  v.ok({ actie: 'werf', kandidaat: 'daan' });   // van € 175 loon betalen lukt niet
  let i = 0;
  while (!v.st().team[0].gestaakt && i++ < 30) v.slaap();
  const m = v.st().team[0];
  assert.ok(m.gestaakt, 'het loon mislukte');
  assert.ok(!v.st().posten.some(p => p.soort === 'aanmaning' && /loon/i.test(p.naam)), 'loon krijgt geen aanmaningskosten');
  assert.match(v.doe({ actie: 'plan', wie: 'daan', wat: 'opdracht', deal: 'x', dag: v.s.dag, minuten: 60 }).error, /loon niet betaald/);
  v.slaap(B.LOON_STAKING);
  assert.equal(v.st().team[0].weg, true);
  assert.ok(v.meldt(/Daan is weggegaan/));
  assert.ok(v.st().posten.some(p => p.soort === 'loon'), 'wat hij tegoed heeft, staat nog open');
});

test('opzeggen: in dienst werkt en verdient hij nog veertien dagen; een freelancer stuurt een factuur per gewerkt uur', () => {
  const v = ondernemer();
  oudeKlant(v);
  v.ok({ actie: 'werf', kandidaat: 'kim' });
  v.ok({ actie: 'werf', kandidaat: 'ravi' });
  v.ok({ actie: 'ontsla', medewerker: 'kim' });
  assert.equal(v.st().team.find(m => m.id === 'kim').einde, v.s.dag + B.OPZEGTERMIJN);
  assert.match(v.doe({ actie: 'ontsla', medewerker: 'kim' }).error, /laatste dag al/);
  v.slaap(B.KLANTCONTRACT.naDagen);
  v.ok(Object.assign({ actie: 'teken' }, v.s.vandaag.volgende.find(a => a.actie === 'teken').invoer));
  const d = v.s.netwerk.contacten.find(x => x.fase === 'overeenkomst');
  v.tot(1);
  v.ok({ actie: 'plan', wie: 'ravi', wat: 'opdracht', deal: d.id, dag: v.s.dag, minuten: 240 });
  v.tot(R.BAAN.loondag + 1);
  assert.equal(v.saldo('kosten:inhuur'), 240 * 4000 / 60, 'alleen de uren die hij maakte');
  assert.equal(v.saldo('crediteur:ravi'), -(240 * 4000 / 60), 'een schuld tot je betaalt');
  const f = v.st().posten.find(p => p.soort === 'inhuur');
  assert.equal(f.dag, v.s.dag - 1 + B.INHUUR_TERMIJN);
  v.slaap(20);
  assert.equal(v.st().team.find(m => m.id === 'kim').weg, true);
  assert.equal(v.L.verifieer('lid').ok, true);
});

test('handel: de eerste bestelling vooraf, daarna krediet, voorraad is geld op de plank en de marge is het resultaat', () => {
  const v = ondernemer('foto');
  const w = B.HANDELSWAAR.foto;
  assert.match(v.doe({ actie: 'bestel', aantal: 5 }).error, /10 tot 50/);
  assert.match(ondernemer('foto', { kapitaal: 0 }).doe({ actie: 'bestel', aantal: 10 }).error, /vooraf/);
  const kas = v.s.geld.bank;
  v.ok({ actie: 'bestel', aantal: 10 });
  assert.equal(v.s.geld.bank, kas - 10 * w.inkoop);
  assert.equal(v.saldo('crediteur:groothandel'), 10 * w.inkoop, 'vooruitbetaald: de leverancier is ons iets schuldig');
  v.slaap(w.levertijd + 7);
  assert.equal(v.saldo('crediteur:groothandel'), 0);
  const h = v.s.bedrijf.handel;
  assert.equal(v.saldo('voorraad'), (h.voorraad) * w.inkoop, 'de voorraad staat tegen inkoopprijs in de boeken');
  assert.ok(h.verkocht > 0, 'er is verkocht');
  assert.equal(v.saldo('kosten:inkoopwaarde'), h.verkocht * w.inkoop);
  assert.equal(h.marge, h.verkocht * (w.advies - w.inkoop));
  v.ok({ actie: 'bestel', aantal: 10 });
  v.slaap(w.levertijd);
  const factuur = v.st().posten.find(p => p.soort === 'leverancier');
  assert.equal(factuur.dag, v.s.dag + w.termijn, 'te betalen dertig dagen na levering');
  assert.equal(v.saldo('crediteur:groothandel'), -10 * w.inkoop, 'na de tweede levering een schuld van dertig dagen');
  assert.equal(v.L.verifieer('lid').ok, true);
});

test('de vraag hangt aan je prijs en je klanten; wat er niet ligt, is een gemiste verkoop', () => {
  const v = ondernemer('foto');
  v.ok({ actie: 'bestel', aantal: 10 });
  const normaal = v.s.bedrijf.handel.perWeek;
  v.ok({ actie: 'prijs', bedrag: 90 });
  assert.ok(v.s.bedrijf.handel.perWeek < normaal / 3, 'twee keer zo duur verkoopt een kwart');
  assert.match(v.doe({ actie: 'prijs', bedrag: 10 }).error, /tussen/);
  v.ok({ actie: 'prijs', bedrag: 25 });
  v.slaap(30);
  assert.equal(v.s.bedrijf.handel.voorraad, 0);
  assert.ok(v.s.bedrijf.handel.gemist > 0);
  assert.ok(v.meldt(/gemiste verkoop/));
});

test('een leverancier die niet betaald wordt, levert niet meer', () => {
  const v = ondernemer('foto');
  v.ok({ actie: 'bestel', aantal: 10 });
  v.slaap(B.HANDELSWAAR.foto.levertijd);
  v.ok({ actie: 'bestel', aantal: 10 });
  const p = () => v.st().posten.find(x => x.soort === 'leverancier');
  v.slaap(3);
  p().dag = v.s.dag + 1;
  p().bedrag = 10000000;                         // onbetaalbaar: de betaling mislukt
  v.slaap();
  assert.ok(p().achterstand);
  assert.match(v.doe({ actie: 'bestel', aantal: 10 }).error, /levert niet meer/);
  assert.ok(!v.s.vandaag.volgende.some(a => a.actie === 'bestel'), 'de Edge biedt het dan ook niet aan');
});

test('contracten: een termijn per vier weken, te laat is geen verlenging, op tijd wel, en opzeggen stopt na de lopende termijn', () => {
  const v = ondernemer();
  oudeKlant(v);
  v.slaap(B.KLANTCONTRACT.naDagen - 1);
  assert.equal(v.s.bedrijf.contracten.length, 0);
  v.slaap();
  const c = v.s.bedrijf.contracten[0];
  assert.equal(c.stand, 'aanbod');
  assert.equal(c.bedrag, 72500, 'twaalf uur tegen het uurtarief dat hij kent (€ 60), op € 25 afgerond');
  v.ok({ actie: 'teken', contract: c.id });
  assert.match(v.doe({ actie: 'teken', contract: c.id }).error, /geen contract/);
  const eerste = v.s.netwerk.contacten.find(x => x.fase === 'overeenkomst');
  assert.equal(eerste.afspraak.deadline, v.s.dag + B.KLANTCONTRACT.periode - 1);
  v.slaap(B.KLANTCONTRACT.periode);
  assert.equal(v.s.bedrijf.contracten[0].termijn, 2);
  assert.equal(v.s.netwerk.contacten.filter(x => x.fase === 'overeenkomst').length, 2, 'de eerste is niet geleverd en loopt door');
  v.ok({ actie: 'zegop', contract: c.id });
  v.slaap(B.KLANTCONTRACT.periode);
  assert.equal(v.s.bedrijf.contracten[0].stand, 'opgezegd');
  assert.equal(v.s.netwerk.contacten.filter(x => x.fase === 'overeenkomst').length, 2, 'geen nieuwe termijn na opzeggen');
});

test('een contractaanbod staat een week open', () => {
  const v = ondernemer();
  oudeKlant(v);
  v.slaap(B.KLANTCONTRACT.naDagen + B.KLANTCONTRACT.geldig);
  assert.equal(v.s.bedrijf.contracten[0].stand, 'verlopen');
  assert.ok(v.meldt(/laat het erbij/));
});

test('de prognose rekent met wat vaststaat, zegt wat ze niet weet, en ziet een tekort aankomen', () => {
  const v = ondernemer('websites', { kapitaal: 0 });
  const p0 = v.s.geld.prognose;
  assert.equal(p0.weken.length, B.PROGNOSE_WEKEN);
  assert.ok(p0.nietMee.some(x => /te laat/.test(x)));
  let kas = v.s.geld.bank;
  for (const w of p0.weken) { kas += w.in - w.uit; assert.equal(w.eind, kas); }
  v.ok({ actie: 'werf', kandidaat: 'daan' });
  const p1 = v.s.geld.prognose;
  const verschil = p0.weken[3].eind - p1.weken[3].eind;
  assert.ok(verschil >= 3 * 24 * 2600, 'drie weken loon van Daan staan erin');
  assert.ok(p1.laagste < 0);
  assert.ok(v.s.vandaag.aandacht.some(a => /prognose/.test(a.tekst)));
});

test('een leven van voor V2 gaat door, met een leeg bedrijf erbij', () => {
  const v = ondernemer();
  for (const k of ['team', 'handel', 'leveringen', 'contracten', 'contractTeller']) delete v.st()[k];
  const s = v.L.staat('lid');
  assert.equal(s.dag, v.s.dag);
  assert.deepEqual(s.bedrijf.team, []);
  assert.equal(v.L.verifieer('lid').ok, true);
});
