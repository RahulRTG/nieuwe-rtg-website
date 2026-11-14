'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const {load, validate, report, render, fileExists, screenOwners} = require('../scripts/rtg-next-programma');
const baseline = load();
const fixture = () => structuredClone(baseline);

test('planning dekt precies de actuele canonieke ingangen en twaalf referenties', () => {
  assert.deepEqual(validate(baseline), []);
  const result = report(baseline);
  assert.equal(result.counts.workPackages, baseline.inventory.length);
  assert.equal(result.counts.referenceExperiences, 12);
  assert.equal(result.counts.remainingEntries, baseline.inventory.length - 12);
});

test('ontbrekend werkpakket wordt bij functie-id gemeld', () => {
  const model = fixture(), missing = model.entries.pop().function;
  assert.ok(validate(model).includes('Werkpakket ontbreekt: ' + missing));
});

test('duplicaat kan een ontbrekende capability niet verbergen', () => {
  const model = fixture(), missing = model.entries[1].function;
  model.entries[1] = structuredClone(model.entries[0]);
  const errors = validate(model);
  assert.ok(errors.includes('Dubbel werkpakket: ' + model.entries[0].function));
  assert.ok(errors.includes('Werkpakket ontbreekt: ' + missing));
});

test('een verzonnen app is geen toegelaten uitbreiding van de catalogus', () => {
  const model = fixture(); model.entries[0].function = 'link:app115';
  assert.ok(validate(model).includes('Onbekende ingang in planning: link:app115'));
});

test('groeiende canonieke scope vergroot de verplichting, geen vaste 114-truc', () => {
  const model = fixture();
  model.inventory.push({...model.inventory[0], function: 'link:nieuwe-goedgekeurde-taak'});
  assert.ok(validate(model).includes('Werkpakket ontbreekt: link:nieuwe-goedgekeurde-taak'));
});

test('bronbestanden moeten bestaan binnen de repository', () => {
  const model = fixture(); model.entries[0].sourceRefs.push('server/bestaat-niet.js');
  assert.ok(validate(model).some(error => error.includes('bronbestand ontbreekt') && error.includes('server/bestaat-niet.js')));
  assert.equal(fileExists(model.root, '../AGENTS.md'), false);
  assert.equal(fileExists(model.root, '/etc/passwd'), false);
});

test('historische bronbaseline moet een echt lokaal Git-commitobject zijn', () => {
  const model = fixture(); model.program.baselineCommit = '0'.repeat(40);
  assert.ok(validate(model).includes('Baselinecommit is niet aanwezig in de lokale repository'));
});

test('dossier kan geen alternatieve productnaam, route of groen oordeel bezitten', () => {
  for (const key of ['name', 'route', 'premiumReady', 'proven']) {
    const model = fixture(); model.entries[0][key] = 'niet toegestaan';
    assert.ok(validate(model).some(error => error.includes('onbekend veld') && error.endsWith(key)));
  }
});

test('programma kan zichzelf geen releasegoedkeuring geven', () => {
  const model = fixture(); model.program.releaseAuthorized = true;
  assert.ok(validate(model).includes('Planning mag geen productoordeel bevatten: releaseAuthorized'));
});

test('cyclische en onbekende afhankelijkheden blokkeren', () => {
  const cyclic = fixture(); cyclic.program.packages[0].dependsOn = ['P7'];
  assert.ok(validate(cyclic).some(error => error.startsWith('Cyclische pakketafhankelijkheid:')));
  const unknown = fixture(); unknown.entries[0].dependsOn.push('P8');
  assert.ok(validate(unknown).some(error => error.endsWith('onbekend pakket P8')));
});

test('de funderingsafhankelijkheden kunnen niet stil worden verwijderd', () => {
  const model = fixture(); model.program.packages.forEach(pack => { pack.dependsOn = []; });
  assert.ok(validate(model).some(error => error.endsWith('verplichte pakketafhankelijkheid ontbreekt')));
});

test('iedere capability houdt de onafhankelijke acceptatiepoort', () => {
  const model = fixture(); model.entries[0].dependsOn = model.entries[0].dependsOn.filter(id => id !== 'P7');
  assert.ok(validate(model).some(error => error.endsWith('gedeelde scope-, experience-, bewijs- of acceptatiepoort ontbreekt')));
});

test('de poort voor twaalf referenties gaat aantoonbaar voor volledige uitrol', () => {
  const skipped = fixture(); skipped.program.gates[1].dependsOnGates = [];
  assert.ok(validate(skipped).includes('G2: scope of volgorde van kwalificatiepoort ongeldig'));
  const renamed = fixture(); renamed.program.gates.forEach((gate, index) => { gate.id = 'XX' + index; });
  assert.ok(validate(renamed).includes('Precies G1 t/m G4 vereist'));
  const wrongScope = fixture(); wrongScope.program.gates[0].scope = 'catalog';
  assert.ok(validate(wrongScope).includes('G1: scope of volgorde van kwalificatiepoort ongeldig'));
});

test('kwalificatiepakket heeft aparte exits voor pilot, catalogus en productie', () => {
  const model = fixture(); delete model.program.packages.find(pack => pack.id === 'P7').gateAcceptance.G1;
  assert.ok(validate(model).includes('P7 vereist afzonderlijke herhaalbare acceptatie per G1/G2/G3/G4'));
});

test('referenties kunnen niet verdwijnen of een dubbel tellen', () => {
  const model = fixture(); model.program.referenceCohort[1] = model.program.referenceCohort[0];
  assert.ok(validate(model).includes('Twaalf unieke referentie-ervaringen vereist'));
});

test('samenwerkende capabilities moeten canoniek en verschillend van zichzelf zijn', () => {
  const model = fixture(); model.entries[0].usesCapabilities = ['link:niet-bestaand', model.entries[0].function];
  const errors = validate(model).filter(error => error.includes('capability-samenwerking'));
  assert.equal(errors.length, 2);
});

test('acceptatie vereist handeling, waarneembare uitkomst en bewijs', () => {
  const model = fixture(); delete model.entries[0].acceptance[0].expected;
  assert.ok(validate(model).some(error => error.endsWith('acceptatie mist expected')));
});

test('budgetvoorstel mag niet als gemeten resultaat worden gepresenteerd', () => {
  const model = fixture(); model.program.budgetProfiles.browse.status = 'PROVEN';
  assert.ok(validate(model).includes('Budget is geen verwijzing naar bestaand contract: browse'));
});

test('architectuur-crosswalk vereist een bron en werkelijk bestaand controlepad', () => {
  const model = fixture(); model.program.architectureRules[0].enforcementRefs = ['test/verzonnen.test.js'];
  assert.ok(validate(model).some(error => error.includes('test/verzonnen.test.js')));
});

test('groene of oude bewijs-snapshots geven de planning geen kwalificatiegezag', () => {
  const model = fixture();
  model.appEvidence.telling = {BEWEZEN: model.inventory.length};
  model.experienceEvidence.status = 'PROVEN';
  const result = report(model);
  assert.equal(result.planningStatus, 'CONSISTENT');
  assert.equal(result.productQualification, 'NOT_ASSESSED');
  assert.equal(result.releaseAuthorized, false);
});

test('werkboek toont iedere ingang, actuele declaraties en opgeslagen bewijs afzonderlijk', () => {
  const output = render(baseline);
  assert.equal((output.match(/^### \d+\./gm) || []).length, baseline.inventory.length);
  for (const item of baseline.inventory) assert.ok(output.includes('`' + item.function + '`'));
  assert.ok(output.includes('Geen verse kwalificatie uitgevoerd.'));
  assert.ok(output.includes('App-signature declaratief aanwezig.'));
  assert.ok(output.includes('geen uitgevoerde') || output.includes('geen uitgevoerd bewijs'));
  for (const screen of baseline.screens) assert.ok(output.includes('`' + screen.route + '`'));
  assert.ok(output.includes('Alle 316 ontdekte schermen hebben een bouw- en bewijsroute'));
  assert.ok(output.includes('Menselijke producer ontbreekt'));
  assert.equal(report(baseline).counts.screensAwaitingP0Assignment, 0);
});

test('werkboektabel ontsnapt bestaande backslashes vóór de kolomscheiding', () => {
  const model = fixture();
  const examples = [
    ['keuze | alternatief', String.raw`keuze \| alternatief`],
    [String.raw`voor \| na`, String.raw`voor \\\| na`],
    [String.raw`voor \\| na`, String.raw`voor \\\\\| na`],
    [String.raw`pad\map\bestand`, String.raw`pad\\map\\bestand`],
    ['eerste\nvolgende | einde', String.raw`eerste volgende \| einde`]
  ];
  examples.forEach(([source], index) => { model.program.referenceCohort[index].purpose = source; });
  const lines = render(model).split('\n');
  examples.forEach(([, expected], index) => {
    const prefix = '| `' + model.program.referenceCohort[index].function + '` | ';
    const row = lines.find(line => line.startsWith(prefix));
    assert.ok(row?.startsWith(prefix + expected + ' | '), 'Tabelcel behoudt letterlijke tekst zonder extra kolom: ' + index);
  });
});

test('Geld en presets behouden dezelfde fysieke eigenaar', () => {
  const money = screenOwners(baseline, baseline.inventory.find(item => item.function === 'link:geldcommand'));
  const bank = screenOwners(baseline, baseline.inventory.find(item => item.function === 'link:bank'));
  assert.ok(money.some(owner => owner.canonical === 'apps/geld.html'));
  assert.ok(bank.some(owner => owner.canonical === 'apps/geld.html'));
});

test('standaardopdracht is alleen-lezen en verklaart geen product gereed', () => {
  const evidenceFiles = ['APPWERKT.json', 'EXPERIENCEWERKT.json', 'experience-architecture/signatures.json'];
  const before = evidenceFiles.map(name => fs.readFileSync(path.join(baseline.root, name), 'utf8'));
  const output = cp.execFileSync(process.execPath, ['scripts/rtg-next-programma.js'], {cwd:baseline.root, encoding:'utf8'});
  const result = JSON.parse(output);
  assert.equal(result.planningStatus, 'CONSISTENT');
  assert.equal(result.releaseAuthorized, false);
  evidenceFiles.forEach((name, index) => assert.equal(fs.readFileSync(path.join(baseline.root, name), 'utf8'), before[index]));
});
