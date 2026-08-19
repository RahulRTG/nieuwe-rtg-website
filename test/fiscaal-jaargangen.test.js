/* DE FISCALE JAARGANGEN: welke regels golden er op die dag.

   Vijf beweringen, en ze gaan alle vijf over hetzelfde verschil: tussen "wat
   geldt er nu" (dat kon dit huis al) en "wat gold er toen" (dat kon het niet,
   want de Regelwacht overschreef de oude waarde).

   1. EEN TARIEFWIJZIGING VAN JULI VERPLAATST HET TARIEF VAN JUNI NIET. Dit is
      de toets waar het om begonnen is. Vóór de jaargangen was hij niet te
      schrijven: de oude waarde bestond nergens meer.
   2. EEN WIJZIGING MET EEN INGANGSDATUM IN DE TOEKOMST LIGT KLAAR EN DOET
      NIETS -- dezelfde eigenschap als een payroll-jaargang die in november
      binnenkomt voor 1 januari.
   3. DE GESCHIEDENIS ZEGT WAT ER VERANDERDE EN WAT HET VERVING.
   4. DE PROJECTIE STAPELT NIET: hij bouwt terug vanaf de basis op, dus een
      wijziging die uit de bak verdwijnt, verdwijnt ook uit het beeld.
   5. DE OUDE PLATTE OVERLAY WORDT EENMALIG OMGEZET, zonder een ingangsdatum
      te verzinnen die nooit is vastgelegd.

   Draai los: node --experimental-sqlite --test test/fiscaal-jaargangen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

/* Een verzette klok, want de hele module gaat over tijd. Zonder een klok die
   je kunt verzetten toets je alleen de dag van vandaag. */
function opstelling(startDag) {
  let dag = startDag || '2026-06-01';
  const LANDEN = { NL: { naam: 'Nederland', uurloonMin: 14.06, lasten: 0.28, vakantiegeld: 0.08,
    alcoholLeeftijd: 18, tarieven: { eten: 9, drank: 21, standaard: 21 }, aangifte: 'oud' } };
  const db = { data: {} };
  const { regelwacht } = require('../server/kern/fiscaal/regelwacht')({
    db, save: () => {}, LANDEN, peiljaar: 2025, nu: () => dag + 'T09:00:00.000Z' });
  return { LANDEN, db, regelwacht, j: regelwacht.jaargangen, zetDag: (d) => { dag = d; } };
}

test('een tariefwijziging van juli verplaatst het tarief van juni niet', () => {
  const o = opstelling('2026-06-01');
  o.regelwacht.pasToe({ landen: { NL: { tarieven: { eten: 11 } } } }, 'kantoor', 'v2',
    { geldigVanaf: '2026-07-01', rechtsgrond: 'Belastingplan 2026' });

  assert.equal(o.j.tariefOp('NL', 'eten', '2026-06-15'), 9, 'juni houdt het oude tarief');
  assert.equal(o.j.tariefOp('NL', 'eten', '2026-06-30'), 9, 'de dag ervoor ook');
  assert.equal(o.j.tariefOp('NL', 'eten', '2026-07-01'), 11, 'vanaf de ingangsdatum het nieuwe');
  assert.equal(o.j.tariefOp('NL', 'eten', '2027-01-01'), 11, 'en daarna blijft het staan');

  // de hele tabel van een dag, niet alleen een tarief
  assert.equal(o.j.regelsOp('NL', '2026-06-15').tarieven.eten, 9);
  assert.equal(o.j.regelsOp('NL', '2026-08-01').tarieven.eten, 11);
  // wat niet is gewijzigd, komt uit de basis mee
  assert.equal(o.j.regelsOp('NL', '2026-08-01').tarieven.drank, 21);
  assert.equal(o.j.regelsOp('NL', '2026-08-01').uurloonMin, 14.06);
  // een onbekende categorie valt terug op standaard -- dezelfde routine als
  // kern/fiscaal/tarief.js gebruikt voor de lopende tabel
  assert.equal(o.j.tariefOp('NL', 'bestaatniet', '2026-08-01'), 21);
  assert.equal(o.j.regelsOp('XX', '2026-08-01'), null, 'een onbekend land geeft niets');
});

test('een wijziging die pas volgende maand ingaat, ligt klaar en doet niets', () => {
  const o = opstelling('2026-06-01');
  o.regelwacht.pasToe({ landen: { NL: { tarieven: { eten: 11 }, uurloonMin: 15.2 } } }, 'kantoor', 'v2',
    { geldigVanaf: '2026-07-01' });

  assert.equal(o.LANDEN.NL.tarieven.eten, 9, 'de gedeelde tabel beweegt nog niet');
  assert.equal(o.LANDEN.NL.uurloonMin, 14.06);
  const st = o.j.stand();
  assert.equal(st.wachtend.length, 1, 'hij staat als wachtend gemeld');
  assert.equal(st.wachtend[0].geldigVanaf, '2026-07-01');

  o.zetDag('2026-07-02');
  const uit = o.j.projecteer();
  assert.equal(uit.wachtend, 0);
  assert.equal(o.LANDEN.NL.tarieven.eten, 11, 'na de ingangsdatum staat hij op de gedeelde tabel');
  assert.equal(o.LANDEN.NL.uurloonMin, 15.2);
});

test('de geschiedenis zegt wat er veranderde, wanneer, en wat het verving', () => {
  const o = opstelling('2026-01-10');
  o.regelwacht.pasToe({ landen: { NL: { tarieven: { eten: 10 } } } }, 'kantoor', 'v1', { geldigVanaf: '2026-01-01' });
  o.zetDag('2026-07-10');
  o.regelwacht.pasToe({ landen: { NL: { tarieven: { eten: 11 } } } }, 'bron', 'v2', { geldigVanaf: '2026-07-01' });

  const alles = o.j.geschiedenis('NL');
  assert.equal(alles.length, 2);
  assert.equal(alles[0].geldigVanaf, '2026-07-01', 'nieuwste eerst');
  assert.equal(alles[0].vorige.tarieven.eten, 10, 'hij weet wat hij verving');
  assert.equal(alles[1].vorige.tarieven.eten, 9, 'en de eerste verving het peiljaar');

  // de stand van de herkomst reist mee: het kantoor is gezien, een bron niet
  assert.equal(alles[1].stand, 'goedgekeurd', 'wat het kantoor doorvoert, heeft een mens gezien');
  assert.equal(alles[0].stand, 'ongecontroleerd', 'wat een bron levert, niet');
  assert.equal(o.j.stand().ongecontroleerd, 1);
  assert.equal(o.regelwacht.status().ongecontroleerd, 1, 'en de Regelwacht meldt het door');

  // filteren op een genest veld
  assert.equal(o.j.geschiedenis('NL', 'tarieven.eten').length, 2);
  assert.equal(o.j.geschiedenis('NL', 'tarieven.drank').length, 0);
  assert.equal(o.j.geschiedenis('NL', 'uurloonMin').length, 0);

  // aanmerken door een mens
  assert.ok(o.j.merkAan('NL', alles[0].id, 'inspecteur Bos').ok);
  assert.equal(o.j.geschiedenis('NL')[0].stand, 'goedgekeurd');
  assert.equal(o.j.geschiedenis('NL')[0].goedgekeurdDoor, 'inspecteur Bos');
  assert.equal(o.j.stand().ongecontroleerd, 0);
});

test('de projectie bouwt terug op vanaf de basis en stapelt niet', () => {
  const o = opstelling('2026-07-10');
  o.regelwacht.pasToe({ landen: { NL: { tarieven: { eten: 11 } } } }, 'kantoor', 'v2', { geldigVanaf: '2026-07-01' });
  assert.equal(o.LANDEN.NL.tarieven.eten, 11);

  // de basis blijft onaangeroerd naast de lopende tabel
  assert.equal(o.j.basisVan('NL').tarieven.eten, 9, 'de basis is niet meegemuteerd');

  /* Verdwijnt de wijziging uit de bak, dan hoort hij ook uit het beeld te
     verdwijnen. Dat lukt alleen als de projectie vanaf de basis opbouwt; wie
     het verschil erbij optelt, houdt hem voor altijd vast. */
  o.db.data.fiscaalJaargangen.NL = [];
  o.j.projecteer();
  assert.equal(o.LANDEN.NL.tarieven.eten, 9, 'terug naar het peiljaar');
});

test('de oude platte overlay wordt eenmalig omgezet zonder een datum te verzinnen', () => {
  const o = opstelling('2026-08-01');
  // de stand van vóór de jaargangen: een kaart van laatste waarden, zonder datums
  o.db.data.fiscaalRegels = { versie: 'oud-3', bron: 'kantoor', at: '2026-05-20T10:00:00.000Z',
    wijzigingen: { NL: { uurloonMin: 15.5, tarieven: { eten: 10 } } } };

  o.regelwacht.herstelOverlay();
  assert.equal(o.LANDEN.NL.uurloonMin, 15.5, 'de oude overlay staat weer op de tabel');
  assert.equal(o.LANDEN.NL.tarieven.eten, 10);

  const g = o.j.geschiedenis('NL');
  assert.equal(g.length, 1);
  assert.equal(g[0].geldigVanaf, '2026-05-20', 'op de laatst bekende updatedatum');
  assert.equal(g[0].bron.soort, 'overlay-migratie', 'en met de herkomst erbij');
  assert.match(g[0].rechtsgrond, /nooit vastgelegd/i, 'eerlijk over wat er niet te redden was');
  assert.deepEqual(o.db.data.fiscaalRegels.wijzigingen, {}, 'de platte kaart is leeg na de omzetting');

  // en hij gebeurt maar EEN keer: een tweede herstel stapelt niets
  o.regelwacht.herstelOverlay();
  assert.equal(o.j.geschiedenis('NL').length, 1);

  // vóór de ingangsdatum geldt gewoon het peiljaar
  assert.equal(o.j.tariefOp('NL', 'eten', '2026-05-19'), 9);
  assert.equal(o.j.tariefOp('NL', 'eten', '2026-05-20'), 10);
});
