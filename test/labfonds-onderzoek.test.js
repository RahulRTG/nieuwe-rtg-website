/* DE SCHAKEL TUSSEN HET LAB-FONDS EN HET ONDERZOEK -- wat is er met mijn
   bijdrage onderzocht?

   Het fonds haalde geld op VOOR onderzoek en wist niet WELK; een lid kon zien
   dat het aan de pot van Amsterdam had bijgedragen en nergens welk onderzoek
   daarmee is betaald. Wat deze toets vastlegt:

     1. Een voorstel mag een onderzoek noemen bij zijn ONDERZOEKSNUMMER (het
        nummer is voor mensen), en wat er wordt vastgelegd is de interne
        studie-id (die is voor de software).
     2. Een voorstel dat een onbestaand onderzoek noemt, wordt GEWEIGERD met de
        reden -- er ontstaat geen voorstel met een dood verwijzingsveld.
     3. Zonder onderzoek blijft een voorstel gewoon mogelijk: niet elk plan voor
        de omgeving is onderzoek.
     4. De andere kant is AFGELEID: het onderzoek weet welk fondsgeld eraan is
        toegezegd, zonder tweede lijst. Toegekend en open staan apart.
     5. Er komt niet meer mee dan de openbare ring van het onderzoek: nummer,
        titel, soort, stap -- geen dossierinhoud, ook niet van een gescheiden
        studie.
     6. Het is een TOEZEGGING en geen betaling, en het staat in het grootboek
        naast de gemeten kosten en niet erbij opgeteld.

   Draai los: node --test test/labfonds-onderzoek.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

function huis() {
  const db = { data: {} };
  const livinglab = require('../server/kern/livinglab')({ db, save: () => {}, crypto,
    anthropic: null, lab: null, kosten: () => null, economie: () => null }).livinglab;
  const labfonds = require('../server/kern/labfonds')({ db, save: () => {}, crypto,
    anthropic: null, livinglab }).labfonds;
  const lab = livinglab.bestuur.labMaak({ naam: 'Lab IJmuiden', stad: 'IJmuiden' }, { staf: true }).lab;
  const studie = (b) => livinglab.studie.studieMaak(Object.assign({ labId: lab.id,
    soort: 'leefomgeving', doel: 'inzicht',
    vraagstuk: 'Welke woningen in de wijk lopen risico bij aanhoudende hitte?' }, b), 'staf').studie;
  return { db, livinglab, labfonds, lab, studie };
}

test('1. een voorstel noemt het onderzoek bij zijn nummer, en bewaart de sleutel', () => {
  const h = huis();
  const s = h.studie({ titel: 'Hittestress in woningen' });
  assert.match(s.nummer, /^RTF-IJM-\d{4}-\d{4}$/);
  h.labfonds.doneer('l1', 'Amber', 'ibiza', 1000);
  const v = h.labfonds.voorstelMaak('l1', 'Amber', 'ibiza', 'Sensoren voor hittemeting',
    'Sensoren in de wijk zodat we hittestress echt kunnen meten voor de hele omgeving.', 400, s.nummer);
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.equal(v.voorstel.onderzoek.nummer, s.nummer);
  assert.equal(v.voorstel.onderzoek.titel, 'Hittestress in woningen');
  assert.equal(v.voorstel.onderzoek.studieId, s.id);
  // ook de interne id mag ingetikt worden; het nummer is voor mensen, niet de enige weg
  const w = h.labfonds.voorstelMaak('l1', 'Amber', 'ibiza', 'Tweede meetronde',
    'Een tweede meetronde in dezelfde wijk zodat we het effect over een jaar zien.', 100, s.id);
  assert.equal(w.voorstel.onderzoek.studieId, s.id);
});

test('2. een onbestaand onderzoek wordt geweigerd, met de reden', () => {
  const h = huis();
  h.labfonds.doneer('l1', 'Amber', 'ibiza', 1000);
  const r = h.labfonds.voorstelMaak('l1', 'Amber', 'ibiza', 'Sensoren',
    'Sensoren in de wijk zodat we hittestress kunnen meten voor de omgeving.', 100, 'RTF-XXX-2026-0099');
  assert.equal(r.status, 400);
  assert.match(r.error, /RTF-XXX-2026-0099/);
  assert.equal(h.labfonds.fonds('l1').voorstellen.length, 0, 'er is niets aangemaakt');
  // en een sleutel die nergens op slaat, krijgt de uitleg met het nummer erbij
  const q = h.labfonds.voorstelMaak('l1', 'Amber', 'ibiza', 'Sensoren',
    'Sensoren in de wijk zodat we hittestress kunnen meten voor de omgeving.', 100, 'abcd1234');
  assert.equal(q.status, 400);
  assert.match(q.error, /RTF-/);
});

test('3. zonder onderzoek blijft een voorstel mogelijk', () => {
  const h = huis();
  h.labfonds.doneer('l1', 'Amber', 'ibiza', 1000);
  const v = h.labfonds.voorstelMaak('l1', 'Amber', 'ibiza', 'Bankjes bij de haven',
    'Twee bankjes bij de haven zodat buurtbewoners elkaar daar kunnen ontmoeten.', 200);
  assert.equal(v.ok, true);
  assert.equal(v.voorstel.onderzoek, null, 'geen onderzoek is null, en geen verzonnen verwijzing');
});

test('4. het onderzoek weet welk fondsgeld eraan is toegezegd -- afgeleid, en gescheiden van de wensen', () => {
  const h = huis();
  const s = h.studie({ titel: 'Hittestress in woningen' });
  h.labfonds.doneer('l1', 'Amber', 'ibiza', 1000);
  const v = h.labfonds.voorstelMaak('l1', 'Amber', 'ibiza', 'Sensoren voor hittemeting',
    'Sensoren in de wijk zodat we hittestress echt kunnen meten voor de hele omgeving.', 400, s.nummer);
  const open = h.labfonds.voorstelMaak('l1', 'Amber', 'ibiza', 'Extra meetpunten',
    'Extra meetpunten aan de noordkant van de wijk, zodat het beeld compleet wordt.', 100, s.nummer);

  let f = h.labfonds.financiering(s.id);
  assert.equal(f.toegezegd.bedrag, 0, 'een voorstel waarover nog wordt gestemd is nog geen financiering');
  assert.equal(f.openVoorstellen.length, 2);

  h.labfonds.beslis(v.voorstel.id, 'l1');
  f = h.labfonds.financiering(s.id);
  assert.equal(f.toegezegd.bedrag, 400);
  assert.equal(f.toegezegd.graad, 'gemeten');
  assert.equal(f.toegezegd.voorstellen.length, 1);
  assert.equal(f.toegezegd.voorstellen[0].locatie, 'Ibiza');
  assert.equal(f.openVoorstellen.length, 1);
  assert.equal(f.openVoorstellen[0].id, open.voorstel.id);

  // een ander onderzoek deelt niets van deze financiering
  const t = h.studie({ titel: 'Wateroverlast in de haven' });
  assert.equal(h.labfonds.financiering(t.id).toegezegd.bedrag, 0);
});

test('5. er komt niet meer mee dan de openbare ring -- ook niet van een gescheiden studie', () => {
  const h = huis();
  /* Een studie met een menselijk, gevoelig onderwerp krijgt een hoge
     risicoklasse en wordt daarmee gescheiden gehouden. */
  const s = h.studie({ titel: 'Eenzaamheid en psychische klachten in de wijk', soort: 'welzijn',
    vraagstuk: 'Hoe hangt eenzaamheid samen met psychische klachten bij ouderen in deze wijk?' });
  h.labfonds.doneer('l1', 'Amber', 'ibiza', 1000);
  const v = h.labfonds.voorstelMaak('l1', 'Amber', 'ibiza', 'Buurtgesprekken',
    'Begeleide buurtgesprekken zodat bewoners elkaar leren kennen in de hele omgeving.', 300, s.nummer);
  assert.equal(h.livinglab.studie.isGescheiden(h.livinglab.vindStudie(s.id)), true,
    'deze studie hoort gescheiden gehouden te worden -- anders toetst dit niets');
  const o = v.voorstel.onderzoek;
  assert.deepEqual(Object.keys(o).sort(), ['nummer', 'soort', 'stap', 'studieId', 'titel']);
  for (const verboden of ['dossier', 'deelnemers', 'vraagstuk', 'conclusies', 'ethiek'])
    assert.ok(!(verboden in o), verboden + ' hoort niet op een openbare fondspagina');
  /* Dezelfde grens bij het OPZOEKEN: dat antwoord gaat rechtstreeks naar de
     route /api/labfonds/financiering, dus wat daar uit komt is even openbaar. */
  const z = h.labfonds.zoekOnderzoek(s.nummer);
  assert.deepEqual(Object.keys(z.studie).sort(), ['id', 'labId', 'nummer', 'soort', 'stap', 'titel']);
});

test('6. een verdwenen onderzoek wordt gemeld en niet stil weggelaten', () => {
  const h = huis();
  const s = h.studie({ titel: 'Hittestress in woningen' });
  h.labfonds.doneer('l1', 'Amber', 'ibiza', 1000);
  const v = h.labfonds.voorstelMaak('l1', 'Amber', 'ibiza', 'Sensoren voor hittemeting',
    'Sensoren in de wijk zodat we hittestress echt kunnen meten voor de hele omgeving.', 400, s.nummer);
  // het onderzoek verdwijnt uit het lab (opgeruimd, verwijderd)
  h.livinglab.S().studies = h.livinglab.S().studies.filter(x => x.id !== s.id);
  const o = h.labfonds.fonds('l1').voorstellen.find(x => x.id === v.voorstel.id).onderzoek;
  assert.equal(o.titel, null);
  assert.equal(o.nummer, s.nummer, 'het bevroren nummer blijft, want dat verandert nooit');
  assert.match(o.nietTeZeggen, /niet meer in het lab/);
});

test('7. het is een toezegging en geen betaling, en het wordt nergens bij de gemeten kosten opgeteld', () => {
  const h = huis();
  const s = h.studie({ titel: 'Hittestress in woningen' });
  const f = h.labfonds.financiering(s.id);
  assert.ok(f.zegtNiet.some(z => /toegezegd/i.test(z) && /betaling/i.test(z)));
  assert.ok(f.zegtNiet.some(z => /opgeteld/i.test(z)));
  assert.ok(!('saldo' in f) && !('totaal' in f),
    'er staat geen saldo tussen een toezegging en een meting');
});

test('8. zonder Living Lab verzint het fonds geen onderzoek', () => {
  const lf = require('../server/kern/labfonds')({ db: { data: {} }, save: () => {}, crypto,
    anthropic: null }).labfonds;
  lf.doneer('l1', 'Amber', 'ibiza', 1000);
  const r = lf.voorstelMaak('l1', 'Amber', 'ibiza', 'Sensoren',
    'Sensoren in de wijk zodat we hittestress kunnen meten voor de omgeving.', 100, 'RTF-IJM-2026-0001');
  assert.equal(r.status, 400);
  assert.match(r.error, /niet beschikbaar/, 'geen stilzwijgende koppeling aan niets');
  // en een voorstel zonder onderzoek werkt daar gewoon
  assert.equal(lf.voorstelMaak('l1', 'Amber', 'ibiza', 'Bankjes bij de haven',
    'Twee bankjes bij de haven zodat buurtbewoners elkaar daar kunnen ontmoeten.', 200).ok, true);
});
