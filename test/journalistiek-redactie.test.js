/* ============================================================================
   DE REDACTIE VAN EEN NIEUWSBEDRIJF -- 13 endpoints achter de leverancier-inlog.

   Deze dertien wees de waargenomen dekkingsmeting aan als nooit aangeroepen:
   niet een enkele test raakte /api/supplier/redactie/*. Er BESTAAT een test
   voor een redactie (test/redactie.test.js), maar die gaat door de
   KANTOOR-ingang: /api/office/redactie/*, de eigen redactie van RTG zelf.
   Dit is een andere motor achter een andere deur -- een nieuwsbedrijf dat als
   leverancier is aangesloten en zijn eigen krant maakt.

   WAT ER OP HET SPEL STAAT

   Een redactie heeft twee soorten stukken door elkaar staan: wat af is en
   wat nog niet af is. De kop van server/kern/journalistiek.js belooft
   "concepten blijven binnen de redactie", en dat is geen stijlkeuze: een
   half stuk over een persoon dat per ongeluk publiek staat, is precies het
   soort schade dat je niet terugdraait. Diezelfde belofte moet ook gelden
   voor een stuk dat WEER van de site wordt gehaald.

   De rode draad hieronder is dus de grens tussen binnen en buiten, in beide
   richtingen: een concept mag er nooit uit, een teruggetrokken stuk moet er
   weer uit kunnen, en de redactie van de een is niet die van de ander.

   Draai los: node --experimental-sqlite --test test/journalistiek-redactie.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, bode, ander;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-journ-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
// de redactie-endpoints, met de prefix er los voor zodat de paden leesbaar blijven
const red = (pad, body, token) => api('/api/supplier/redactie/' + pad, body, token);

/* Inloggen op de zaak gaat op naam met een persoonlijke pincode; de
   demo-rooster geeft de bezetting per code (manager 1234, personeel 5678). */
async function zaak(code) {
  const roster = await api('/api/supplier/roster', { code });
  const wie = roster.body.staff.find(x => x.role === 'manager');
  assert.ok(wie, 'de zaak ' + code + ' heeft een manager in het rooster');
  return (await api('/api/supplier/login', { code, staffId: wie.id, pin: '1234' })).body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  bode = await zaak('BODE');        // De Ibiza Bode, genre journalistiek
  ander = await zaak('KIKUNOI');    // een restaurant: hoort hier niets te vinden
  assert.ok(bode && ander, 'beide zaken zijn binnen');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de redactie staat klaar: huisstijl, rubrieken en lege tellers; zonder inlog niets', async () => {
  const r = await red('staat', {}, bode);
  assert.equal(r.status, 200);
  assert.equal(r.body.huisstijl.naam, 'De Ibiza Bode', 'de krant erft de naam van de zaak');
  assert.ok(r.body.rubrieken.includes('Voorpagina'), 'er staat een startset rubrieken klaar');
  assert.deepEqual(r.body.tellers, { concept: 0, live: 0, gelezen: 0 }, 'een verse redactie telt nul');
  assert.deepEqual(r.body.site.blokken, [], 'de krantsite is nog leeg');
  assert.equal((await red('staat', {}, null)).status, 401, 'zonder zaak-inlog geen redactie');
});

test('2. de huisstijl: wat geldig is wordt bewaard, de rest wordt GEWEIGERD', async () => {
  const goed = await red('huisstijl', { naam: 'De Ibiza Bode', payoff: 'Onafhankelijk sinds 1998', accent: '#7F1634', thema: 'licht' }, bode);
  assert.equal(goed.status, 200);
  assert.equal(goed.body.huisstijl.payoff, 'Onafhankelijk sinds 1998');
  assert.equal(goed.body.huisstijl.thema, 'licht');

  /* HIER STOND: "een ongeldige kleur verandert niets", met status 200 en de
     oude waarde terug. Dat is precies de stille variant, en hij was ook nog
     eens ANDERS dan wat het Theater met dezelfde invoer deed (400). Sinds de
     merkkern de enige bron is (kern/tenant/merkkern.js) strandt dezelfde
     invoer overal hetzelfde: met een melding. Voor wie de knop indrukt is dat
     het verschil tussen weten dat het niet mocht en denken dat het gelukt is. */
  const fout = await red('huisstijl', { accent: 'bordeaux' }, bode);
  assert.equal(fout.status, 400);
  assert.match(fout.body.error, /hexcode/);
  const themaFout = await red('huisstijl', { thema: 'neon' }, bode);
  assert.equal(themaFout.status, 400);
  assert.match(themaFout.body.error, /licht of donker/);

  /* En er is niets half toegepast: de stand van na de geldige bewaring staat er nog. */
  const na = await red('staat', {}, bode);
  assert.equal(na.body.huisstijl.accent, '#7F1634');
  assert.equal(na.body.huisstijl.thema, 'licht');
});

test('3. rubrieken: een nieuwe komt vooraan, een lege naam wordt geweigerd', async () => {
  const nieuw = await red('rubriek/bewaar', { naam: 'Haven' }, bode);
  assert.equal(nieuw.status, 200);
  assert.equal(nieuw.body.rubrieken[0], 'Haven', 'de nieuwste rubriek staat vooraan');
  assert.equal((await red('rubriek/bewaar', { naam: '   ' }, bode)).status, 400, 'een lege naam is geen rubriek');
  const nogmaals = await red('rubriek/bewaar', { naam: 'Haven' }, bode);
  assert.equal(nogmaals.body.rubrieken.filter(x => x === 'Haven').length, 1, 'dezelfde rubriek komt er niet dubbel in');
  const weg = await red('rubriek/verwijder', { naam: 'Haven' }, bode);
  assert.ok(!weg.body.rubrieken.includes('Haven'), 'de rubriek is weg');
});

test('4. een stuk schrijven: het blijft concept, en een onbekende rubriek valt terug', async () => {
  const mk = await red('artikel/bewaar', {
    titel: 'Nieuwe steiger in de haven', chapo: 'De werkzaamheden beginnen maandag.',
    inhoud: 'De gemeente begint maandag aan de nieuwe steiger. Het werk duurt tot het najaar.',
    rubriek: 'Bestaat Niet'
  }, bode);
  assert.equal(mk.status, 200);
  const a = mk.body.artikel;
  assert.equal(a.status, 'concept', 'een nieuw stuk begint altijd als concept');
  assert.equal(a.auteur, 'Elvira Sanz', 'de auteur komt uit de inlog, niet uit het verzoek');
  assert.ok(a.rubriek && a.rubriek !== 'Bestaat Niet', 'een onbekende rubriek valt terug op een bestaande');

  // hetzelfde id opnieuw bewaren wijzigt het stuk en maakt er geen tweede
  const bij = await red('artikel/bewaar', { id: a.id, titel: 'Nieuwe steiger komt er', inhoud: a.inhoud }, bode);
  assert.equal(bij.body.artikel.id, a.id, 'bewaren op id wijzigt hetzelfde stuk');
  assert.equal(bij.body.artikel.titel, 'Nieuwe steiger komt er');

  const lijst = await red('artikelen', { status: 'concept' }, bode);
  assert.equal(lijst.body.lijst.filter(x => x.id === a.id).length, 1, 'het staat er precies een keer in');
  assert.equal((await red('artikelen', { status: 'live' }, bode)).body.lijst.length, 0, 'er staat nog niets live');

  const vol = await red('artikel/haal', { id: a.id }, bode);
  assert.equal(vol.body.artikel.inhoud, a.inhoud, 'de redactie ziet de volledige tekst');
  assert.equal((await red('artikel/haal', { id: 'bestaatniet' }, bode)).status, 404);
});

test('5. een concept blijft binnen de redactie: de krant toont het niet', async () => {
  const mk = await red('artikel/bewaar', { titel: 'Nog niet af', inhoud: 'Een half stuk over een raadslid.' }, bode);
  const id = mk.body.artikel.id;
  /* Eerst de andere kant: in de REDACTIE staat het stuk wel. Zonder die regel
     zou "het staat niet in de krant" ook slagen als het stuk nergens is
     aangekomen -- en op dit punt in het bestand is er nog niets gepubliceerd,
     dus de krant is sowieso leeg. De bewering die telt is het VERSCHIL tussen
     de twee lijsten, en dat verschil bewijst zich alleen als het stuk aan de
     ene kant aantoonbaar bestaat. */
  assert.ok((await red('artikelen', {}, bode)).body.lijst.some(x => x.id === id),
    'het concept staat wel in de redactie');
  const krant = await api('/api/krant/open', { code: 'BODE' });
  assert.equal(krant.status, 200);
  assert.ok(!krant.body.artikelen.some(x => x.id === id), 'het concept staat niet in de krant');
  /* En ook niet als je het id al weet. Een lijst die iets verzwijgt terwijl
     de detailpagina het gewoon geeft, is geen grens maar een gordijn. */
  assert.equal((await api('/api/krant/artikel', { code: 'BODE', id })).status, 404, 'ook niet rechtstreeks op id');
  await red('artikel/verwijder', { id }, bode);
});

test('6. publiceren en terugtrekken: de krant volgt beide kanten op', async () => {
  const mk = await red('artikel/bewaar', { titel: 'Zeilseizoen geopend', chapo: 'De eerste boten liggen klaar.', inhoud: 'De haven loopt vol.' }, bode);
  const id = mk.body.artikel.id;
  const pub = await red('artikel/publiceer', { id }, bode);
  assert.equal(pub.body.artikel.status, 'live');

  const krant = await api('/api/krant/open', { code: 'BODE' });
  assert.ok(krant.body.artikelen.some(x => x.id === id), 'het stuk staat in de krant');
  const lees = await api('/api/krant/artikel', { code: 'BODE', id });
  assert.equal(lees.body.artikel.titel, 'Zeilseizoen geopend');
  assert.equal((await red('staat', {}, bode)).body.tellers.gelezen, 1, 'een lezer wordt geteld');

  // terugtrekken: wat de redactie in draait, hoort de lezer niet meer te zien
  const terug = await red('artikel/concept', { id }, bode);
  assert.equal(terug.body.artikel.status, 'concept');
  assert.ok(!(await api('/api/krant/open', { code: 'BODE' })).body.artikelen.some(x => x.id === id), 'het stuk is uit de krant');
  assert.equal((await api('/api/krant/artikel', { code: 'BODE', id })).status, 404, 'en ook niet meer op id te lezen');
  assert.equal((await red('artikel/concept', { id: 'bestaatniet' }, bode)).status, 404);
});

test('7. snel nieuws: in een handeling geschreven en gepubliceerd', async () => {
  const snel = await red('snel', { titel: 'Stroomstoring in Vila', inhoud: 'Delen van Vila zaten een uur zonder stroom.' }, bode);
  assert.equal(snel.status, 200);
  assert.equal(snel.body.artikel.status, 'live', 'snel nieuws staat meteen live');
  const krant = await api('/api/krant/open', { code: 'BODE' });
  assert.ok(krant.body.artikelen.some(x => x.id === snel.body.artikel.id), 'en het staat meteen in de krant');
});

test('8. de redactie-assistent draait ook zonder sleutel', async () => {
  const a = await red('assist', { titel: 'Stroomstoring in Vila', inhoud: 'Delen van Vila zaten een uur zonder stroom. De oorzaak was een defecte kabel.' }, bode);
  assert.equal(a.status, 200);
  assert.equal(a.body.chapo, 'Delen van Vila zaten een uur zonder stroom.', 'de chapo is de eerste zin');
  assert.ok(a.body.koppen.length >= 1, 'er komen kopsuggesties terug');
  assert.equal(a.body.ai, undefined, 'zonder sleutel geen AI-tekst, maar wel een bruikbaar antwoord');
});

test('9. de krantsite: blokken worden geschoond en de volgorde opgeschoond', async () => {
  const bw = await red('site/bewaar', {
    design: {
      blokken: [
        { id: 'b1', type: 'kop', tekst: 'De Ibiza Bode' },
        { id: 'b2', type: 'ruimte', hoogte: 9999 },
        { id: 'b3', type: 'raket', tekst: 'onbekend type' }
      ],
      volgorde: { telefoon: ['b3', 'b1', 'bestaatniet', 'b1'] }
    }
  }, bode);
  assert.equal(bw.status, 200);
  const blokken = bw.body.site.blokken;
  assert.equal(blokken.length, 3);
  assert.equal(blokken[1].hoogte, 240, 'een absurde hoogte wordt naar het maximum gebracht');
  assert.equal(blokken[2].type, 'tekst', 'een onbekend bloktype wordt gewone tekst');
  assert.deepEqual(bw.body.site.volgorde.telefoon, ['b3', 'b1'], 'onbekende en dubbele ids vallen uit de volgorde');
  // de site komt mee met de openbare krant, want dat is de vormgeving ervan
  assert.equal((await api('/api/krant/open', { code: 'BODE' })).body.site.blokken.length, 3);
});

test('10. een krant beginnen is een werkvorm, geen algemene knop', async () => {
  const mk = await red('artikel/bewaar', { titel: 'Interne notitie', inhoud: 'Bronnen en telefoonnummers.' }, bode);
  const id = mk.body.artikel.id;

  /* TOT DEZE RONDE kon ELKE zaak met een leverancier-inlog een krant beginnen:
     een taxibedrijf, een hotel, een kapper. Dat wijkt af van elke andere
     zakelijke module in dit huis (retail, zorg, vervoer), die allemaal achter
     hun capability zitten. En het is niet vrijblijvend: dit is de enige module
     waarmee een zaak zonder tussenkomst iets NAAR BUITEN brengt, onder haar
     eigen naam, op /api/krant/*.

     De redactie zit nu achter de capability 'redactie' (werkvorm
     journalistiek). Een restaurant komt niet meer bij een enkele deur -- dus
     ook niet bij de deuren waar het vroeger een nette 404 op kreeg. Die 409
     is de sterkere scheiding: hij zegt niet "dat stuk bestaat niet" maar "deze
     zaak heeft hier niets te zoeken". */
  for (const pad of ['staat', 'artikelen', 'artikel/haal', 'artikel/bewaar', 'artikel/verwijder',
    'snel', 'rubriek/bewaar', 'rubriek/verwijder', 'huisstijl', 'site/bewaar', 'assist']) {
    const r = await red(pad, { id, titel: 'Van de buren', naam: 'Iets', inhoud: 'x' }, ander);
    assert.equal(r.status, 409, pad + ' hoort dicht te zijn voor een restaurant (kreeg ' + r.status + ')');
    assert.match(r.body.error || '', /redactie|journalistiek/i, pad + ' zegt ook waarom');
  }
  assert.equal((await red('artikel/haal', { id }, bode)).status, 200, 'en bij de krant zelf staat het stuk er nog gewoon');

  const weg = await red('artikel/verwijder', { id }, bode);
  assert.equal(weg.status, 200);
  assert.equal((await red('artikel/haal', { id }, bode)).status, 404, 'de eigenaar kan het wel weghalen');
});

/* De scheiding TUSSEN TWEE KRANTEN is met die deur niet meer over HTTP te
   bereiken: er staat maar een zaak met de werkvorm journalistiek in de seed, en
   een restaurant komt niet meer binnen. De regel zelf staat in de kern --
   artikelVol() zoekt in de ruimte van EEN code -- en die toetsen we daarom
   rechtstreeks. Anders zou deze scheiding stilletjes onbewaakt raken doordat we
   er een deur voor hebben gezet. */
test('11. een stuk hoort bij een redactie, en niet bij de redactie ernaast', async () => {
  const maak = require('../server/kern/journalistiek');
  const db = { data: {} };
  const j = maak({ db, save: () => {}, crypto: require('crypto'), schoon: (s, n) => String(s || '').slice(0, n),
    findSupplier: code => ({ code, name: 'Krant ' + code }), claude: null });

  const a = j.bewaarArtikel('EEN', { titel: 'Van krant EEN', inhoud: 'Eigen bronnen.' }, { name: 'Redacteur' });
  const id = a.artikel.id;
  assert.ok(j.artikelVol('EEN', id), 'bij de eigen krant is het stuk te vinden');
  assert.equal(j.artikelVol('TWEE', id), null, 'bij de krant ernaast niet');
  j.verwijderArtikel('TWEE', id);
  assert.ok(j.artikelVol('EEN', id), 'en de buren kunnen het ook niet weggooien');
});
