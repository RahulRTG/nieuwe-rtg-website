/* DE VEILIGE NOODSTAND -- de stand die BESCHERMT in plaats van uitzet.

   BESTUUR.md grens 6.10: "Een noodknop die alles platlegt, wordt niet gebruikt."
   De incidentcontrole kende drie standen en alle drie zetten iets UIT. Wie onder
   druk moet kiezen tussen niets doen en alles dichtgooien, doet meestal niets.

   WAT DEZE TOETS BEWIJST, en de tweede is de belangrijkste:

   1. de stand bevriest werkelijk iets, en laat werkelijk iets door;
   2. hij is GEEN isolatie met een andere naam. Tien van de zestien categorieën
      werken door, en de vier uitzonderingen -- inloggen, hulpdiensten,
      grensdiensten, de storingsmelder -- lopen ook binnen een bevroren
      categorie door. Zonder die vier zou "lezen loopt door" een zin zonder
      inhoud zijn: wie niet kan inloggen, leest niets;
   3. hij zet GEEN enkele functieschakelaar om, dus opheffen is geen
      herstelactie met een eigen risico;
   4. het bewijs wordt bij het omzetten vastgezet, en zegt eerlijk welk van de
      drie gevallen het is;
   5. het onderdeel dat NIET is gebouwd (sleutels roteren) staat in het antwoord
      van de server met de reden, en niet als lege waarde;
   6. de drie fail-fasts vallen om bij het laden en niet bij het eerste incident.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de vier uitzonderingen leeggemaakt
     -> toets 2 EN 6 ZAKKEN (RAAK). Toets 2 is de bewering: inloggen wordt dan
        bevroren. Dat 6 meezakt is geen te grove mutatie maar een gevolg met een
        naam -- de fail-fast op een verdwenen uitzondering kan niet aanslaan op
        een lijst die leeg is, en dat is precies wat die toets nakijkt.
   - "RTG-Backoffice" van LOOPT_DOOR naar BEVRIEST verplaatst
     -> toets 2 ZAKT, en ALLEEN toets 2 (RAAK): de hand die de stand weer opheft,
        zit dan zelf vast.
   - de methodecontrole uit houdtTegen() gehaald (ook GET tegenhouden)
     -> toets 1 ZAKT, en alleen toets 1 (RAAK).
   - `nietAfgedwongen` bij de sleutels vervangen door `afgedwongen: 'kern/sleutels.js'`
     -> toets 5 ZAKT, en alleen toets 5 (RAAK).

   Draai los: node --test test/beschermstand.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const functies = require('../server/functies');
const { maakBeschermstand } = require('../server/kern/beschermstand');
const lijst = require('../server/kern/beschermstand-lijst');

const B = maakBeschermstand({ functies });
const stand = (j) => require('../server/kern/incidentcontrole')({
  db: { data: {} }, save: () => {}, functies, beveilig: null, journaal: j });

test('1. de stand bevriest werkelijk iets, en laat werkelijk iets door', () => {
  const tegen = B.houdtTegen('/api/bank/krediet', 'POST');
  assert.ok(tegen, 'een betaalroute wordt niet tegengehouden');
  assert.equal(tegen.categorie, 'Geld');
  assert.ok(tegen.waarom.length > 20, 'de reden is een categorie-naam en geen uitleg');

  /* Een GET blijft door, ook in een bevroren categorie: dat is het verschil met
     uitzetten. */
  assert.equal(B.houdtTegen('/api/bank/krediet', 'GET'), null, 'een GET werd tegengehouden');
  assert.equal(B.houdtTegen('/api/bank/krediet', 'HEAD'), null);
});

test('2. dit is geen isolatie met een andere naam', () => {
  /* Tien categorieën werken gewoon door -- een lid dat zijn reis bijwerkt is
     geen derde partij en geen voorrecht. */
  assert.equal(Object.keys(lijst.LOOPT_DOOR).length, 10, Object.keys(lijst.LOOPT_DOOR).join(', '));
  assert.equal(Object.keys(lijst.BEVRIEST).length, 6);
  for (const pad of ['/api/leden/reis', '/api/salon/post', '/api/command/start'])
    assert.equal(B.houdtTegen(pad, 'POST'), null, pad + ' werd tegengehouden');

  /* EN DE VIER MET NAAM. Inloggen is de belangrijkste: wie dat bevriest, zet
     ook het lezen stil en heeft dan isolatie gebouwd. */
  for (const id of ['tg-inlog', 'dom-veiligheid', 'dom-kmar', 'dom-foutmelder']) {
    const f = functies.FUNCTIES.find(x => x.id === id);
    assert.ok(f, id + ' bestaat niet meer');
    assert.ok(lijst.BEVRIEST[f.categorie], id + ' zit niet in een bevroren categorie; de uitzondering doet niets');
    assert.equal(B.houdtTegen(f.paden[0] + '/iets', 'POST'), null,
      id + ' wordt tegengehouden terwijl hij een uitzondering is');
  }
});

test('3. de stand zet geen enkele functieschakelaar om', () => {
  const ic = stand(null);
  const voor = JSON.stringify(ic.status().uit);
  const na = ic.bescherm('een inbraakpoging op de betaalroutes', { id: 7 });
  assert.equal(na.modus, 'beschermd');
  assert.equal(JSON.stringify(na.uit), voor, 'de beschermstand heeft functies omgezet');
  assert.equal(na.actief.geraakt, 0, 'er staat een herstelvoorraad die er niet hoort te zijn');
  assert.equal(na.onderhoud, false, 'de hoofdzekering is aangeraakt');

  /* En hij is met dezelfde knop weer weg -- zonder standen terug te zetten. */
  const terug = ic.herstel('de poging is afgeslagen', { id: 7 });
  assert.equal(terug.modus, 'normaal');
  assert.equal(terug.bescherming.aan, false);
});

test('4. het bewijs wordt vastgezet, met de eerlijke reden als dat niet kan', () => {
  const heel = stand(() => ({ controleer: () => ({ heel: true, regels: 42 }) }))
    .bescherm('een inbraakpoging op de betaalroutes', { id: 7 });
  const z = heel.bescherming.onderdelen.find(o => o.wat === 'bewijs veiligstellen').gemeten;
  assert.equal(z.heel, true);
  assert.equal(z.regels, 42);
  assert.ok(z.at, 'een zegel zonder tijdstip zegt niets over waarvandaan het geldt');

  const geen = stand(() => null).bescherm('zelfde reden, andere opstelling', { id: 7 });
  const z2 = geen.bescherming.onderdelen.find(o => o.wat === 'bewijs veiligstellen').gemeten;
  assert.match(z2.nietTeZeggen, /geen journaal/, JSON.stringify(z2));
  assert.equal(z2.heel, undefined, 'er staat toch een oordeel bij een zegel dat niet bestaat');

  const stuk = stand(() => ({ controleer: () => { throw new Error('de schijf is weg'); } }))
    .bescherm('zelfde reden, kapotte keten', { id: 7 });
  const z3 = stuk.bescherming.onderdelen.find(o => o.wat === 'bewijs veiligstellen').gemeten;
  assert.match(z3.nietTeZeggen, /niet worden nagelopen/, JSON.stringify(z3));
  assert.notEqual(z3.nietTeZeggen, z2.nietTeZeggen,
    '"er is geen keten" en "de keten is niet te lezen" komen als hetzelfde antwoord terug');
});

test('5. wat niet gebouwd is, staat er met de reden en niet als lege waarde', () => {
  const o = lijst.onderdelen({});
  assert.equal(o.length, 5, 'grens 6.10 noemt vijf onderdelen');
  const sleutels = o.find(x => x.wat === 'sleutels roteren');
  assert.ok(sleutels, o.map(x => x.wat).join(', '));
  assert.equal(sleutels.afgedwongen, undefined, 'de sleutelrotatie beweert afgedwongen te zijn');
  assert.match(sleutels.nietAfgedwongen, /geen rotatiemechanisme/, sleutels.nietAfgedwongen);

  /* De vier andere dragen WEL een plek in de code. Een onderdeel zonder een van
     beide is een bewering zonder bron. */
  for (const x of o) {
    assert.ok(x.afgedwongen || x.nietAfgedwongen,
      '"' + x.wat + '" zegt niet waar hij wordt afgedwongen en ook niet dat hij dat niet wordt');
  }
  /* En de kost van deze stand staat erbij en niet in een voetnoot: veel lezen
     is hier een POST en wordt dus ook tegengehouden. */
  assert.match(o[0].let, /POST/, o[0].let);
});

test('6. de drie fail-fasts vallen om bij het laden', () => {
  const nep = (extra) => ({
    FUNCTIES: functies.FUNCTIES.concat(extra || []),
    functieVoorPad: functies.functieVoorPad
  });
  assert.throws(() => maakBeschermstand({ functies: nep([{ id: 'verzonnen', categorie: 'Iets nieuws', naam: 'X', paden: [] }]) }),
    /niet ingedeeld/, 'een nieuwe categorie glipt er ongemerkt door');

  /* En een uitzondering die niet meer bestaat: dat is de gevaarlijkste, want
     zonder controle bevriest de stand dan juist het inloggen. */
  const zonderInlog = { FUNCTIES: functies.FUNCTIES.filter(f => f.id !== 'tg-inlog'),
    functieVoorPad: functies.functieVoorPad };
  assert.throws(() => maakBeschermstand({ functies: zonderInlog }), /bestaat niet \(meer\)/,
    'een verdwenen uitzondering wordt niet opgemerkt');
});
