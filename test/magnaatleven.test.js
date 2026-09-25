/* Magnaat FROM ZERO (V1): van een mens met € 64,32 en een baan in de keuken,
   via zijn eigen project, een kans, een onderhandeling en een factuur, naar een
   cashprobleem en een eerste bedrijf. Elke euro loopt door het grootboek, en
   de boeken zeggen iets wat een scherm alleen kan herhalen: een factuur is
   omzet, geen geld. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { maakLeven } = require('../server/kern/magnaat-leven');
const R = require('../server/kern/magnaat-leven/regels');
const { startServer } = require('./helper');

function leven() {
  let t = 1e12;
  const db = { data: {} };
  const L = maakLeven({ db, nu: () => t });
  const v = {
    db, L, s: L.staat('lid'),
    st: () => db.data.magnaatLeven.lid,
    doe(b) { const r = L.actie('lid', b); if (!r.error) v.s = r; return r; },
    slaap(n = 1) { for (let i = 0; i < n; i++) v.doe({ actie: 'slaap' }); return v.s; },
    wacht(dagen) { t += R.DAG_MS * dagen; v.s = L.staat('lid'); return v.s; },
    deal: (fase) => v.s.netwerk.contacten.find(d => d.fase === fase),
    meldt: (re) => v.st().meldingen.some(m => re.test(m.tekst))
  };
  return v;
}
const vrijNu = (v) => v.s.vrijVandaag - (v.s.vrijVandaag % 30);

/* Een speler die doet wat een mens zou doen: werken aan zijn project tot er
   een kans komt, het voorbeeld uit MAGNAAT.md onderhandelen, het werk doen,
   leveren en factureren. */
function totDeFactuur(v, { voorschot = 25 } = {}) {
  v.doe({ actie: 'kies', aanbod: 'websites' });
  while (!v.deal('kans')) { if (vrijNu(v)) v.doe({ actie: 'plan', wat: 'project', dag: v.s.dag, minuten: vrijNu(v) }); v.slaap(); }
  v.doe({ actie: 'gesprek', deal: v.deal('kans').id });
  const id = v.deal('onderhandeling').id;
  v.doe({ actie: 'voorstel', deal: id, bedrag: 900, voorschot: 0 });
  v.doe({ actie: 'voorstel', deal: id, bedrag: 800, voorschot });
  while (v.deal('overeenkomst')) {
    const d = v.deal('overeenkomst');
    if (d.gedaan >= d.afspraak.minuten) { v.doe({ actie: 'lever', deal: id }); break; }
    if (vrijNu(v)) v.doe({ actie: 'plan', wat: 'opdracht', deal: id, dag: v.s.dag, minuten: vrijNu(v) });
    v.slaap();
  }
  v.doe({ actie: 'factuur', deal: id });
  return id;
}

test('je begint op maandag met € 64,32, een baan, 4u 20m vrij en geen onderneming', () => {
  const v = leven(), s = v.s;
  assert.equal(s.dagNaam, 'maandag');
  assert.equal(s.geld.bank, 6432);
  assert.equal(s.vrijVandaag, 260);
  assert.equal(s.werk.baan.uren, 24);
  assert.equal(s.werk.baan.loondag, 'vrijdag');
  assert.deepEqual(s.werk.bezit, ['telefoon', 'eenvoudige laptop']);
  assert.equal(s.vandaag.agenda[2].betalingen[0].bedrag, 4199, 'vaste betalingen deze week op woensdag');
  assert.equal(s.bedrijf, null, 'Mijn bedrijf bestaat pas met een onderneming');
  assert.deepEqual(s.rtg.map(r => r.id), ['geld']);
});

test('tijd is schaars: een extra dienst neemt de hele donderdag, en daar past dan niets meer bij', () => {
  const v = leven();
  v.doe({ actie: 'kies', aanbod: 'websites' });
  const r = v.doe({ actie: 'plan', wat: 'project', dag: 1, minuten: 300 });
  assert.match(r.error, /nog 4u 20m vrij/);
  assert.ok(!v.doe({ actie: 'plan', wat: 'extra', dag: 4 }).error);
  assert.match(v.doe({ actie: 'plan', wat: 'project', dag: 4, minuten: 30 }).error, /nog 0m vrij/);
  assert.match(v.doe({ actie: 'plan', wat: 'extra', dag: 5 }).error, /donderdag/);
  v.slaap(3);
  assert.equal(v.s.dagNaam, 'donderdag');
  const voor = v.s.geld.bank;
  v.slaap();
  assert.equal(v.s.geld.bank, voor + R.BAAN.extra.loon + R.BAAN.urenPerWeek * R.BAAN.uurloon - R.BOODSCHAPPEN, 'extra dienst, loon op vrijdag, boodschappen');
});

test('een kans komt uit je eigen project, niet uit een knop', () => {
  const v = leven();
  v.doe({ actie: 'kies', aanbod: 'websites' });
  v.slaap(10);
  assert.equal(v.s.netwerk.contacten.length, 0, 'wie niets maakt, wordt niet gevonden');
  v.doe({ actie: 'plan', wat: 'project', dag: v.s.dag, minuten: vrijNu(v) });
  while (!v.deal('kans')) { if (vrijNu(v)) v.doe({ actie: 'plan', wat: 'project', dag: v.s.dag, minuten: vrijNu(v) }); v.slaap(); }
  assert.ok(v.st().portfolio >= 360);
  assert.ok(v.meldt(/heeft je eigen portfolio-site gezien/));
});

test('de onderhandeling uit MAGNAAT.md: € 900, klant € 650, jij € 800 + 25% vooraf, akkoord', () => {
  const v = leven();
  v.doe({ actie: 'kies', aanbod: 'websites' });
  while (!v.deal('kans')) { if (vrijNu(v)) v.doe({ actie: 'plan', wat: 'project', dag: v.s.dag, minuten: vrijNu(v) }); v.slaap(); }
  v.doe({ actie: 'gesprek', deal: v.deal('kans').id });
  const id = v.deal('onderhandeling').id;
  v.doe({ actie: 'voorstel', deal: id, bedrag: 900, voorschot: 0 });
  assert.deepEqual(v.deal('onderhandeling').rondes.map(x => [x.van, x.bedrag]), [['jij', 90000], ['klant', 65000]]);
  v.doe({ actie: 'voorstel', deal: id, bedrag: 800, voorschot: 25 });
  const d = v.deal('overeenkomst');
  assert.equal(d.afspraak.bedrag, 80000);
  assert.equal(d.afspraak.voorschotBedrag, 20000);
  assert.equal(d.afspraak.minuten, 840, 'een echte opdracht: veertien uur werk met een deadline');
  assert.ok(v.st().software.gepauzeerd, 'met € 8,33 op je rekening kan het abonnement niet worden betaald');
  assert.match(v.doe({ actie: 'plan', wat: 'opdracht', deal: id, dag: v.s.dag, minuten: 30 }).error, /software is niet betaald/,
    'werk dat vandaag niet kan, wordt geweigerd met de reden, en niet aan het eind van de dag stil weggegooid');
  v.slaap(2);
  assert.equal(v.s.geld.vooruitOntvangen, 20000, 'het voorschot is binnen');
  assert.equal(v.s.geld.resultaat.omzet, 0, 'maar een voorschot is geen omzet: je moet er nog werk voor leveren');
});

test('een klant betaalt het bedrag, maar niet elk voorschot: te veel vooraf wordt een tegenvoorstel', () => {
  const v = leven();
  v.doe({ actie: 'kies', aanbod: 'websites' });
  while (!v.deal('kans')) { if (vrijNu(v)) v.doe({ actie: 'plan', wat: 'project', dag: v.s.dag, minuten: vrijNu(v) }); v.slaap(); }
  v.doe({ actie: 'gesprek', deal: v.deal('kans').id });
  const id = v.deal('onderhandeling').id;
  v.doe({ actie: 'voorstel', deal: id, bedrag: 800, voorschot: 50 });
  const laatste = v.deal('onderhandeling').rondes.pop();
  assert.deepEqual([laatste.van, laatste.bedrag, laatste.voorschot], ['klant', 80000, 25], 'het bedrag is goed, de helft vooraf niet');
  v.doe({ actie: 'neem', deal: id });
  assert.equal(v.deal('overeenkomst').afspraak.voorschotBedrag, 20000);
  v.doe({ actie: 'voorstel', deal: id, bedrag: 700 });
  assert.equal(v.deal('overeenkomst').afspraak.bedrag, 80000, 'een afspraak is een afspraak');
});

test('de deadline is de derde voorwaarde: meer dagen mag, maar een klant wacht niet eindeloos', () => {
  const v = leven();
  v.doe({ actie: 'kies', aanbod: 'websites' });
  while (!v.deal('kans')) { if (vrijNu(v)) v.doe({ actie: 'plan', wat: 'project', dag: v.s.dag, minuten: vrijNu(v) }); v.slaap(); }
  v.doe({ actie: 'gesprek', deal: v.deal('kans').id });
  const id = v.deal('onderhandeling').id, dag = v.s.dag;
  v.doe({ actie: 'voorstel', deal: id, bedrag: 800, voorschot: 25, dagen: 30 });
  const tegen = v.deal('onderhandeling').rondes.slice(-1)[0];
  assert.deepEqual([tegen.van, tegen.bedrag, tegen.voorschot, tegen.dagen], ['klant', 80000, 25, 14], 'prijs en voorschot zijn goed, 30 dagen niet');
  assert.ok(v.meldt(/[Ll]anger dan 14 dagen kan ik niet wachten/), "de klant zegt waarom");
  v.doe({ actie: 'voorstel', deal: id, bedrag: 800, voorschot: 25, dagen: 12 });
  assert.equal(v.deal('overeenkomst').afspraak.deadline, dag + 12, 'meer tijd dan zijn voorkeur, binnen zijn speling');
});

test('de inschrijving is een regel van Oudwijk en wordt ook zo uitgesproken', () => {
  const v = leven();
  assert.ok(v.s.wereld.spelregels.some(r => /^In Oudwijk schrijf je je als onderneming in/.test(r)), 'het Wereld-scherm toont de regels van deze wereld');
  const bron = ['acties.js', 'dag.js', 'gesprek.js', 'volgende.js'].map(f => require('fs').readFileSync(require('path').join(__dirname, '../server/kern/magnaat-leven', f), 'utf8')).join('');
  assert.doesNotMatch(bron, /Kamer van Koophandel|kleineondernemersregeling/, 'geen echte instelling of regeling als wet van deze wereld');
});

test('resultaat is geen bank: een factuur maakt omzet en een vordering, geen geld', () => {
  const v = leven();
  totDeFactuur(v);
  const g = v.s.geld;
  assert.equal(g.teOntvangen, 60000, 'de klant moet nog € 600');
  assert.equal(g.resultaat.omzet, 80000, 'de hele € 800 is omzet');
  assert.ok(g.resultaat.resultaat > g.bank, 'het resultaat is groter dan wat er op de rekening staat');
  assert.ok(g.recent.some(x => /Factuur P001/.test(x.omschrijving) && x.labels.includes('boek')), 'de factuur raakt je rekening niet');
  assert.equal(v.s.bedrijf, null, 'de eerste factuur komt voor de onderneming');
  assert.equal(v.L.verifieer('lid').ok, true);
});

test('de eerste klant betaalt te laat, de huur lukt niet, en een herinnering helpt', () => {
  const v = leven();
  totDeFactuur(v);
  let i = 0;
  while (v.s.dag <= 15 && i++ < 30) v.slaap();
  assert.ok(v.meldt(/Huur van je kamer .* kon niet worden betaald/), 'wie geen extra dienst draaide, kan de huur niet betalen');
  assert.ok(v.s.rtg.some(r => r.id === 'budget'));
  const huur = v.s.geld.komend.find(p => /Huur/.test(p.naam));
  assert.ok(huur && huur.achterstand, 'de huur staat open');
  assert.match(v.doe({ actie: 'uitstel', post: huur.id }).error, /kun je niet uitstellen/);
  const f = v.s.netwerk.contacten[0].factuur;
  while (v.s.dag <= f.vervaldag) v.slaap();
  assert.equal(v.deal('gefactureerd').fase, 'gefactureerd', 'de vervaldag is voorbij en er is niet betaald');
  assert.ok(!v.doe({ actie: 'herinnering', deal: v.deal('gefactureerd').id }).error);
  v.slaap(R.HERINNERING_DAGEN);
  assert.equal(v.s.netwerk.contacten[0].fase, 'betaald');
  assert.equal(v.s.geld.teOntvangen, 0);
  assert.equal(v.s.geld.bank, v.st().kas);
  assert.equal(v.L.verifieer('lid').ok, true);
});

test('korting voor directe betaling kost geld, en voorfinancieren kan pas als onderneming', () => {
  const v = leven();
  const id = totDeFactuur(v);
  assert.match(v.doe({ actie: 'voorfinancier', deal: id }).error, /ondernemingen/);
  v.doe({ actie: 'korting', deal: id, procent: 2 });
  assert.ok(v.meldt(/gaat niet in op 2% korting/), 'deze klant wil minstens 3%');
  v.doe({ actie: 'korting', deal: id, procent: 3 });
  v.slaap();
  assert.equal(v.s.netwerk.contacten[0].fase, 'betaald', 'de klant betaalt de dag erna');
  const rek = v.st().boek.rekeningen, w = v.st().wereld;
  assert.equal(rek[w + ':kosten:korting'].saldo, 1800, '3% van € 600 staat als kosten in je resultaat');
  assert.equal(rek[w + ':vordering:cafe'].saldo, 0, 'de vordering is helemaal weg');
  assert.ok(v.s.geld.recent.some(x => /Betaling factuur P001/.test(x.omschrijving)));
});

test('lenen bij je familie: geld nu, twee termijnen later van je loon', () => {
  const v = leven();
  assert.match(v.doe({ actie: 'lenen', bedrag: 5000 }).error, /tot € 250/);
  v.doe({ actie: 'lenen', bedrag: 200 });
  assert.equal(v.s.geld.bank, 6432 + 20000);
  assert.equal(v.s.geld.schuld, 20000);
  v.slaap(12);
  assert.equal(v.s.geld.schuld, 0, 'afgelost van twee lonen');
  assert.ok(v.meldt(/lening bij je familie is afgelost/));
  assert.equal(v.L.verifieer('lid').ok, true);
});

test('na twee betaalde opdrachten stelt het spel vast dat je onderneemt, en pas dan is er Mijn bedrijf', () => {
  const v = leven();
  totDeFactuur(v);
  let i = 0;
  while (!v.s.vandaag.volgende.some(a => a.actie === 'onderneming') && i++ < 90) {
    const k = v.deal('kans'); if (k) v.doe({ actie: 'gesprek', deal: k.id });
    const o = v.deal('onderhandeling'); if (o) v.doe({ actie: 'voorstel', deal: o.id, bedrag: 1000, voorschot: 25 });
    const f = v.s.netwerk.contacten.find(d => d.fase === 'gefactureerd' && v.s.dag > d.factuur.vervaldag && !d.factuur.herinnerd);
    if (f) v.doe({ actie: 'herinnering', deal: f.id });
    const d = v.deal('overeenkomst');
    if (d && d.gedaan >= d.afspraak.minuten) v.doe({ actie: 'lever', deal: d.id });
    else if (d && vrijNu(v)) v.doe({ actie: 'plan', wat: 'opdracht', deal: d.id, dag: v.s.dag, minuten: vrijNu(v) });
    const g = v.deal('geleverd'); if (g) v.doe({ actie: 'factuur', deal: g.id });
    v.slaap();
  }
  assert.ok(v.st().betaald >= R.ONDERNEMING.opdrachten);
  assert.equal(v.s.bedrijf, null);
  /* Een nieuwe klant neem je vanaf nu aan als onderneming, niet als particulier. */
  v.st().deals.push({ id: 'dNieuw', klantId: 'yoga', klant: 'Yogastudio Adem', fase: 'kans', sinds: v.st().dag, rondes: [], gedaan: 0 });
  assert.match(v.doe({ actie: 'gesprek', deal: 'dNieuw' }).error, /schrijf je eerst in/);
  assert.match(v.doe({ actie: 'onderneming', naam: 'X' }).error, /2 tot 60/);
  v.doe({ actie: 'onderneming', naam: 'Webwerk Oudwijk' });
  assert.equal(v.s.bedrijf.naam, 'Webwerk Oudwijk');
  assert.ok(!v.doe({ actie: 'gesprek', deal: 'dNieuw' }).error, 'als onderneming kan het gesprek wel');
  assert.ok(v.s.rtg.some(r => r.id === 'zakelijk'));
  assert.equal(v.s.geld.bank, v.st().kas);
  assert.equal(v.L.verifieer('lid').ok, true);
});

test('dezelfde keuzes geven hetzelfde leven, en de klok rekent tien dagen in een keer', () => {
  const a = leven(), b = leven();
  totDeFactuur(a); totDeFactuur(b);
  assert.deepEqual(a.s, b.s);
  const los = leven(), ineens = leven();
  for (let i = 0; i < 10; i++) los.wacht(1);
  ineens.wacht(10);
  assert.equal(los.s.dag, 11);
  assert.deepEqual(ineens.s.geld, los.s.geld);
});

test('de speelronde: tempo verandert hoe lang een dag duurt, niet wat erin gebeurt', () => {
  const v = leven();
  assert.equal(v.s.tempo.stand, 'rustig');
  assert.match(v.doe({ actie: 'tempo', stand: 'turbo' }).error, /rustig, vlot, proef/);
  v.doe({ actie: 'tempo', stand: 'proef' });
  assert.equal(v.st().dagMs, R.TEMPO.proef);
  assert.equal(v.s.dag, 1, 'wisselen laat geen dagen tegelijk vallen');
  v.wacht(R.TEMPO.proef / R.DAG_MS * 3);
  assert.equal(v.s.dag, 4, 'drie proefdagen later');
});

test('doorspoelen stopt bij het volgende moment dat aandacht vraagt, en ongeplande tijd is weg', () => {
  const v = leven();
  v.doe({ actie: 'kies', aanbod: 'websites' });
  v.doe({ actie: 'plan', wat: 'project', dag: 1, minuten: 240 });
  v.doe({ actie: 'plan', wat: 'project', dag: 2, minuten: 180 });
  v.doe({ actie: 'doorspoelen' });
  assert.ok(v.deal('kans'), 'de kans uit het project is het moment');
  assert.equal(v.s.dag, 3, 'en daar stopt het, niet later');
  assert.equal(v.st().portfolio, 420, 'wat gepland was, is gebeurd; de rest niet');
  const w = leven();
  w.doe({ actie: 'doorspoelen' });
  assert.ok(w.s.dag <= 1 + R.DOORSPOELEN_MAX, 'hooguit twee weken');
  assert.equal(w.st().portfolio, 0, 'niets gepland is niets gedaan');
  assert.equal(w.s.geld.bank, w.st().kas);
});

test('opnieuw beginnen vraagt een bevestiging, en het oude journaal blijft staan', () => {
  const v = leven();
  v.doe({ actie: 'kies', aanbod: 'foto' });
  v.slaap(3);
  const oud = v.st().wereld;
  assert.match(v.doe({ actie: 'opnieuw' }).error, /Bevestig/);
  assert.equal(v.st().dag, 4);
  v.doe({ actie: 'opnieuw', zeker: true });
  assert.equal(v.s.dag, 1);
  assert.equal(v.s.geld.bank, R.START_KAS);
  assert.equal(v.s.werk.project, null);
  assert.notEqual(v.st().wereld, oud, 'een nieuwe wereld in het grootboek');
  assert.ok(JSON.stringify(v.db.data.magnaatJournaal || {}).includes(oud), 'het oude journaal is er nog: een journaal groeit alleen');
  assert.equal(v.L.verifieer('lid').ok, true);
});

test('de routes: kijken en handelen met een ledensessie, en een gast komt er niet in', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-fromzero-'));
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const post = (pad, body, tok) => fetch(base + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
      body: JSON.stringify(body || {}) });
    assert.equal((await post('/api/member/magnaat/leven/staat')).status, 401);
    const reg = await post('/api/auth/register', { name: 'Nul Speler', email: 'nul@x.nl', phone: '0612345678',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' });
    assert.equal(reg.status, 200);
    const tok = (await reg.json()).token;
    const s = await (await post('/api/member/magnaat/leven/staat', {}, tok)).json();
    assert.equal(s.geld.bank, R.START_KAS);
    const r = await post('/api/member/magnaat/leven/actie', { actie: 'kies', aanbod: 'websites' }, tok);
    assert.equal(r.status, 200);
    const f = await post('/api/member/magnaat/leven/actie', { actie: 'factuur', deal: 'd9' }, tok);
    assert.equal(f.status, 400);
    assert.ok((await f.json()).error);
  } finally {
    try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
