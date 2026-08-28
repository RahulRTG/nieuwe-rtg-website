/* De canary (kern/command/canary.js) en de verdeling die erbij hoort
   (inCanary in server/functies/toegang.js).

   WAT DEZE TOETS VOORAL BEWAAKT zijn drie dingen die allemaal stil kunnen
   omslaan en waarvan je het pas merkt als een uitrol misgaat:

   1. DE VERDELING IS STABIEL PER PERSOON EN VERSCHILT PER FUNCTIE. Zonder het
      eerste wisselt dezelfde gebruiker binnen één scherm tussen oud en nieuw;
      zonder het tweede draagt steeds dezelfde tien procent van de mensen het
      risico van elke uitrol.

   2. DE REM SLAAT NIET AAN OP EEN HANDVOL VERZOEKEN. Drie fouten op vier
      antwoorden is 75%, en dat terugrollen zou betekenen dat elke canary die
      net begint meteen omvalt.

   3. EEN KWIJTGERAAKTE NULMETING WEEGT NIET. Na een herstart beginnen de
      tellers op nul en staat het verschil negatief. Doorrekenen geeft dan een
      negatief foutaantal en dus altijd groen -- precies de kant waarop een
      uitrolrem niet fout mag gaan.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de functie-id uit de hash gehaald (alleen op de persoon verdeeld)
     -> "de verdeling verschilt per functie" ZAKT (RAAK)
   - de minimum-eis uit het oordeel gehaald
     -> "de rem slaat niet aan op een handvol verzoeken" ZAKT (RAAK)
   - de kwijt-tak weggelaten (negatief verschil gewoon doorrekenen)
     -> "een kwijtgeraakte nulmeting weegt niet" ZAKT (RAAK)

   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakCanary } = require('../server/kern/command/canary');
const maakCmdOpslag = require('../server/kern/command/opslag');
const toegang = require('../server/functies/toegang');

/* Een nagemaakte meting met dezelfde vorm als server/meting.js reeksen(). De
   toets zet de tellers met de hand, want anders zou hij verkeer moeten
   opwekken om een foutpercentage te kunnen maken. */
function meting(paden) {
  const staat = { antwoorden: 0, fouten: 0 };
  return {
    zet: (antwoorden, fouten) => { staat.antwoorden = antwoorden; staat.fouten = fouten; },
    reeksen: () => ({
      gestart: Date.now(), emmers: [], duur: [],
      verzoeken: [
        { methode: 'POST', route: paden[0], status: '2xx', aantal: staat.antwoorden - staat.fouten },
        { methode: 'POST', route: paden[0], status: '5xx', aantal: staat.fouten },
        /* Een reeks op een heel ander pad, om te toetsen dat de canary alleen
           de paden van ZIJN functie telt. */
        { methode: 'POST', route: '/api/heel-iets-anders', status: '5xx', aantal: 9999 }
      ]
    })
  };
}

function maak(opties) {
  const o = opties || {};
  const f = { id: 'proef', naam: 'Proeffunctie', categorie: 'Test', paden: ['/api/proef'],
    doelgroepen: ['rtg'], standaard: true };
  const db = { data: { techniek: { functies: {} } } };
  const m = meting(f.paden);
  const regels = [];
  const journaal = { noteer: (r) => regels.push(r) };
  const canary = maakCanary({ db, opslag: maakCmdOpslag({ db }), save: () => {}, meting: m, journaal,
    functies: { OP_ID: Object.assign({ proef: f }, o.extra || {}) } });
  return { db, f, m, canary, regels };
}

test('een canary begint op een deel en legt een nulmeting vast', () => {
  const { db, m, canary } = maak();
  m.zet(1000, 40);                       // er stond al van alles, ook fouten
  const r = canary.start('proef', 0.1, { door: 'ik' });
  assert.equal(r.canary.deel, 0.1);
  assert.equal(db.data.techniek.functies.proef.canary.basis.antwoorden, 1000);
  assert.equal(db.data.techniek.functies.proef.canary.basis.fouten, 40,
    'de fouten van vóór de canary tellen niet mee');
  assert.equal(r.canary.meting.antwoorden, 0, 'de proef begint op nul');
  assert.equal(canary.start('bestaatniet', 0.1).status, 404);
});

test('een canary opent geen dichte functie', () => {
  /* Een canary VERDEELT een open functie over de mensen; hij opent er geen.
     Zou hij dat wel doen, dan zet iemand met de canary-knop stilletjes een
     functie aan die de eigenaar bewust dicht had gezet. */
  const { db, canary } = maak();
  db.data.techniek.functies.proef = { aan: false };
  const r = canary.start('proef', 0.1);
  assert.equal(r.status, 409);
  assert.match(r.error, /staat helemaal uit/);
});

test('de rem slaat niet aan op een handvol verzoeken', () => {
  const { m, canary } = maak();
  m.zet(0, 0);
  canary.start('proef', 0.1, { door: 'ik' });
  m.zet(4, 3);                            // 75% fout, maar op vier antwoorden
  const st = canary.stand();
  assert.equal(st.canaries[0].oordeel, 'onvoldoende gemeten');
  assert.equal(st.canaries[0].deel, 0.1, 'en dus is er niets teruggerold');
  assert.deepEqual(st.zojuistTeruggerold, []);
});

test('over de drempel rolt de canary zichzelf terug', () => {
  const { m, canary, regels } = maak();
  m.zet(0, 0);
  canary.start('proef', 0.1, { door: 'ik' });
  m.zet(200, 20);                         // 10% fout op 200 antwoorden, drempel 2%
  const st = canary.stand();
  assert.deepEqual(st.zojuistTeruggerold, ['proef']);
  const k = st.canaries[0];
  assert.equal(k.deel, 0);
  assert.equal(k.stand, 'teruggerold');
  assert.equal(k.automatisch, true);
  assert.match(k.reden, /automaat/);
  const regel = regels.find(r => r.actie === 'canary teruggerold');
  assert.ok(regel, 'het staat in het journaal');
  assert.equal(regel.niveau, 'auto', 'en wel als machinehandeling');

  /* Blijft hij daarna liggen: een teruggerolde canary wordt niet nog eens
     teruggerold, en gaat ook niet vanzelf weer open. */
  const st2 = canary.stand();
  assert.deepEqual(st2.zojuistTeruggerold, []);
  assert.equal(st2.canaries[0].deel, 0);
});

test('een kwijtgeraakte nulmeting weegt niet', () => {
  const { m, canary } = maak();
  m.zet(1000, 0);
  canary.start('proef', 0.1, { door: 'ik' });
  m.zet(5, 4);                            // het proces is herstart: tellers terug op nul
  const k = canary.stand().canaries[0];
  assert.equal(k.meting.kwijt, true);
  assert.equal(k.oordeel, 'niet te wegen');
  assert.match(k.meting.uitleg, /herstart/);
  assert.equal(k.deel, 0.1, 'en er wordt niets teruggerold op een onbekende');
});

test('verbreden schuift de nulmeting mee', () => {
  /* Anders zou een canary die op tien procent fouten maakte, op vijftig
     procent nooit meer groen kunnen worden: hij sleept zijn oude fouten mee. */
  const { m, canary } = maak();
  m.zet(0, 0);
  canary.start('proef', 0.1, { door: 'ik' });
  m.zet(100, 1);
  const r = canary.breder('proef', 0.5, 'ik');
  assert.equal(r.canary.deel, 0.5);
  assert.equal(r.canary.meting.antwoorden, 0, 'vanaf nu is het een nieuwe proef');
  assert.equal(r.canary.meting.fouten, 0);
});

test('afronden is iets anders dan honderd procent', () => {
  const { db, canary } = maak();
  canary.start('proef', 1, { door: 'ik' });
  assert.ok(db.data.techniek.functies.proef.canary, 'op honderd procent loopt de canary nog');
  const r = canary.af('proef', 'ik');
  assert.equal(r.af, true);
  assert.equal(db.data.techniek.functies.proef.canary, undefined,
    'pas na afronden is er geen uitrol meer die niemand weegt');
  assert.equal(canary.af('proef', 'ik').status, 404);
});

/* ---------- de verdeling ---------- */

test('de verdeling is stabiel per persoon', () => {
  const c = { deel: 0.5 };
  const eerst = toegang.inCanary('proef', c, { persoon: 'user-42' });
  for (let i = 0; i < 20; i++) {
    assert.equal(toegang.inCanary('proef', c, { persoon: 'user-42' }), eerst,
      'dezelfde persoon krijgt bij elk verzoek hetzelfde antwoord');
  }
});

test('de verdeling verschilt per functie', () => {
  /* DE KERN. Zonder de functie-id in de hash zit steeds dezelfde helft van de
     mensen in elke canary, en draagt een vaste groep alle risico. */
  const c = { deel: 0.5 };
  const mensen = Array.from({ length: 300 }, (_, i) => ({ persoon: 'user-' + i }));
  const a = mensen.map(p => toegang.inCanary('functie-a', c, p));
  const b = mensen.map(p => toegang.inCanary('functie-b', c, p));
  const gelijk = a.filter((x, i) => x === b[i]).length;
  assert.ok(gelijk < mensen.length * 0.75,
    'twee functies verdelen niet dezelfde groep (' + gelijk + ' van ' + mensen.length + ' gelijk)');

  /* En de verdeling benadert het gevraagde deel. Ruim, want dit is een hash en
     geen weegschaal. */
  const erin = a.filter(Boolean).length;
  assert.ok(erin > 90 && erin < 210, 'ongeveer de helft zit erin: ' + erin);
});

test('zonder identiteit valt niemand in de canary, en bij nul en een is er niets te verdelen', () => {
  assert.equal(toegang.inCanary('proef', { deel: 0.5 }, {}), false, 'anoniem verkeer heeft geen stabiele sleutel');
  assert.equal(toegang.inCanary('proef', { deel: 0.5 }, null), false);
  assert.equal(toegang.inCanary('proef', { deel: 0 }, { persoon: 'user-1' }), false);
  assert.equal(toegang.inCanary('proef', { deel: 1 }, {}), true, 'op honderd procent hoeft er niets verdeeld te worden');
});

test('de canary-as blokkeert alleen waar een canary staat', () => {
  const zonder = { proef: { aan: true } };
  assert.equal(toegang.blokkadeReden('proef', zonder, { persoon: 'user-1' }), null,
    'zonder canary-stand verandert er niets');
  const met = { proef: { aan: true, canary: { deel: 0 } } };
  assert.equal(toegang.blokkadeReden('proef', met, { persoon: 'user-1' }), 'canary');
  const heel = { proef: { aan: true, canary: { deel: 1 } } };
  assert.equal(toegang.blokkadeReden('proef', heel, { persoon: 'user-1' }), null);
});
