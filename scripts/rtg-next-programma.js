#!/usr/bin/env node
'use strict';

// Planningoverlay op MAPPEN, appcontract en bestaande bewijsbronnen.
// Dit instrument voert geen productproef uit en kan geen release goedkeuren.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const qualification = require('./lib/experience/qualification-planning');
const root = path.resolve(__dirname, '..');
const programFile = 'docs/rtg-next/programma.json';
const workbookFile = 'docs/rtg-next/werkboek.md';
const signatures = new Set(['Horizon', 'Journey', 'Atelier', 'Ledger', 'Command', 'Salon', 'Library', 'Ceremony', 'Spatial']);
const entryKeys = new Set(['function', 'currentObservation', 'sourceRefs', 'target', 'changes', 'dependsOn', 'usesCapabilities', 'signature', 'budgetProfile', 'acceptance', 'externalDecisions']);
const text = value => typeof value === 'string' && value.trim().length > 0;
const strings = value => Array.isArray(value) && value.every(text);

function fileExists(base, name) {
  if (!text(name) || path.isAbsolute(name) || name.split(/[\\/]/).includes('..')) return false;
  try {
    const resolved = fs.realpathSync(path.resolve(base, name));
    return resolved.startsWith(fs.realpathSync(base) + path.sep) && fs.statSync(resolved).isFile();
  } catch (_) { return false; }
}

function load() {
  const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
  const program = read(programFile);
  const {MAPPEN, los} = require('./lib/wereldregister');
  const {CONTRACT} = require('./lib/appcontract');
  const {screenInventory} = require('./lib/experience/subjects');
  if (!strings(program.workPackageFiles)) throw new Error('workPackageFiles ontbreekt');
  const sources = program.workPackageFiles.map(name => {
    if (!fileExists(root, name)) throw new Error('Ongeldig werkpakketbestand: ' + name);
    return {name, data: read(name)};
  });
  const inventory = MAPPEN.flatMap(map => map.items.map(id => ({
    function: id, world: map.naam, name: los(id).naam, entry: los(id).url,
    logicalAppId: 'app:' + map.sleutel + ':' + id, contract: CONTRACT[id] || null
  })));
  return {root, program, sources, inventory, screens: screenInventory(root),
    entries: sources.flatMap(source => source.data.entries || []),
    owners: read('SCHERMEIGENAAR.json'), appEvidence: read('APPWERKT.json'),
    experienceEvidence: read('EXPERIENCEWERKT.json'), declarations: read('experience-architecture/signatures.json'),
    coverageContract:read('experience-architecture/coverage-contract.json')};
}

function commitExists(base, commit) {
  if (!/^[a-f0-9]{40}$/.test(commit || '')) return false;
  try { cp.execFileSync('git', ['cat-file', '-e', commit + '^{commit}'], {cwd:base, stdio:'ignore'}); return true; }
  catch (_) { return false; }
}

function validate(model) {
  const errors = [];
  const fail = (condition, message) => { if (!condition) errors.push(message); };
  const p = model.program || {};
  fail(p.schemaVersion === 1 && p.status === 'PLANNING_ONLY', 'Programma moet schemaVersion 1 en PLANNING_ONLY zijn');
  fail(p.scopeAuthority === 'AFBOUWPROGRAMMA.md' && p.scopeSource === 'scripts/lib/wereldregister.js', 'Canonieke scopebron mag niet worden vervangen');
  fail(JSON.stringify(p.completionSources) === JSON.stringify(['APPWERKT.json', 'EXPERIENCEWERKT.json']), 'Bestaande bewijsbronnen verplicht');
  fail(/^[a-f0-9]{40}$/.test(p.baselineCommit || ''), 'Baseline moet een volledige historische commit bevatten');
  fail(commitExists(model.root, p.baselineCommit), 'Baselinecommit is niet aanwezig in de lokale repository');
  const forbidden = ['releaseAuthorized', 'premiumReady', 'productQualification', 'proven', 'completed'];
  for (const key of forbidden) fail(!(key in p), 'Planning mag geen productoordeel bevatten: ' + key);
  const packages = Array.isArray(p.packages) ? p.packages : [];
  const packageIds = new Set(packages.map(item => item.id));
  fail(packages.length === 8 && packageIds.size === 8 && [...packageIds].every(id => /^P[0-7]$/.test(id)), 'Precies P0 t/m P7 vereist');
  const refs = (value, label) => {
    fail(strings(value), label + ': bronlijst ongeldig');
    if (strings(value)) for (const file of value) fail(fileExists(model.root, file), label + ': bronbestand ontbreekt of ligt buiten repository: ' + file);
  };
  const dependencies = (value, label) => {
    fail(strings(value) && new Set(value).size === value.length, label + ': afhankelijkheden ongeldig');
    if (strings(value)) for (const id of value) fail(packageIds.has(id), label + ': onbekend pakket ' + id);
  };
  const rules = Array.isArray(p.architectureRules) ? p.architectureRules : [];
  fail(rules.length >= 7 && new Set(rules.map(rule => rule.id)).size === rules.length, 'Architectuur-crosswalk ontbreekt of heeft dubbele regels');
  for (const id of ['single-catalog','domain-owner','live-authority','provider-truth','no-inferred-execution','candidate-bound-proof','independent-human-review','connection-constitution','learning-constitution','public-projection']) fail(rules.some(rule=>rule.id===id), 'Verplichte architectuurkoppeling ontbreekt: '+id);
  for (const rule of rules) {
    fail(text(rule.id) && text(rule.implementationGap), 'Architectuurregel mist id of implementatiegrens');
    refs([rule.ownerSource], rule.id); refs(rule.enforcementRefs, rule.id);
    fail(rule.enforcementRefs?.length > 0, rule.id + ': controleverwijzing ontbreekt');
  }
  for (const pack of packages) {
    for (const key of ['title', 'ownerRole']) fail(text(pack[key]), pack.id + ': ' + key + ' ontbreekt');
    for (const key of ['changes', 'acceptance']) fail(strings(pack[key]) && pack[key].length > 0, pack.id + ': ' + key + ' ontbreekt');
    dependencies(pack.dependsOn, pack.id); refs(pack.sourceRefs, pack.id); refs(pack.testRefs, pack.id);
  }
  const visiting = new Set(), done = new Set();
  function visit(id) {
    if (visiting.has(id)) { errors.push('Cyclische pakketafhankelijkheid: ' + id); return; }
    if (done.has(id)) return;
    visiting.add(id);
    const item = packages.find(pack => pack.id === id);
    if (strings(item?.dependsOn)) for (const dependency of item.dependsOn) if (packageIds.has(dependency)) visit(dependency);
    visiting.delete(id); done.add(id);
  }
  for (const id of packageIds) visit(id);
  const requiredDependencies = {P0:[], P1:['P0'], P2:['P1'], P3:['P2'], P4:['P0'], P5:['P2','P4'], P6:['P0'], P7:['P1','P2','P3','P4','P5','P6']};
  for (const [id, required] of Object.entries(requiredDependencies)) {
    const declared = packages.find(pack => pack.id === id)?.dependsOn;
    fail(Array.isArray(declared) && required.every(dependency => declared.includes(dependency)), id + ': verplichte pakketafhankelijkheid ontbreekt');
  }
  const qualification = packages.find(pack => pack.id === 'P7');
  fail(JSON.stringify(qualification?.repeatableByGate) === JSON.stringify(['G1','G2','G3','G4']) &&
    ['G1','G2','G3','G4'].every(id => text(qualification?.gateAcceptance?.[id])), 'P7 vereist afzonderlijke herhaalbare acceptatie per G1/G2/G3/G4');
  for (const source of model.sources || []) {
    fail(source.data.schemaVersion === 1 && source.data.status === 'PLANNING_ONLY' && Array.isArray(source.data.entries), source.name + ': ongeldige planningoverlay');
  }
  const inventory = model.inventory || [], entries = model.entries || [];
  const canonical = new Set(inventory.map(item => item.function));
  fail(canonical.size === inventory.length, 'MAPPEN heeft dubbele functie-id; scopebesluit nodig');
  const seen = new Set();
  for (const entry of entries) {
    const id = entry.function;
    fail(canonical.has(id), 'Onbekende ingang in planning: ' + id);
    fail(!seen.has(id), 'Dubbel werkpakket: ' + id); seen.add(id);
    for (const key of Object.keys(entry)) fail(entryKeys.has(key), id + ': onbekend veld (geen tweede catalogus/bewijs): ' + key);
    for (const key of ['currentObservation', 'target']) fail(text(entry[key]), id + ': ' + key + ' ontbreekt');
    fail(strings(entry.changes) && entry.changes.length >= 2, id + ': minimaal twee concrete wijzigingen vereist');
    fail(strings(entry.externalDecisions), id + ': externe beslispunten moeten expliciet zijn, desnoods lege lijst');
    fail(signatures.has(entry.signature), id + ': onbekende signaturefamilie');
    fail(Object.hasOwn(p.budgetProfiles || {}, entry.budgetProfile), id + ': onbekend budgetprofiel');
    refs(entry.sourceRefs, id); fail(entry.sourceRefs?.length > 0, id + ': bronverwijzing vereist');
    dependencies(entry.dependsOn, id);
    fail(Array.isArray(entry.dependsOn) && ['P0','P4','P6','P7'].every(required => entry.dependsOn.includes(required)), id + ': gedeelde scope-, experience-, bewijs- of acceptatiepoort ontbreekt');
    fail(strings(entry.usesCapabilities) && new Set(entry.usesCapabilities).size === entry.usesCapabilities.length, id + ': capability-samenwerkingen ontbreken of zijn dubbel');
    if (strings(entry.usesCapabilities)) for (const dependency of entry.usesCapabilities) {
      fail(canonical.has(dependency) && dependency !== id, id + ': onbekende of eigen capability-samenwerking ' + dependency);
    }
    fail(Array.isArray(entry.acceptance) && entry.acceptance.length >= 2, id + ': minimaal twee acceptatiescenario’s vereist');
    for (const criterion of Array.isArray(entry.acceptance) ? entry.acceptance : []) {
      for (const key of ['scenario', 'expected', 'evidence']) fail(text(criterion?.[key]), id + ': acceptatie mist ' + key);
    }
  }
  for (const item of inventory) {
    fail(seen.has(item.function), 'Werkpakket ontbreekt: ' + item.function);
    fail(text(item.contract?.belofte), 'Canonieke appbelofte ontbreekt: ' + item.function);
  }
  const cohort = Array.isArray(p.referenceCohort) ? p.referenceCohort : [];
  fail(cohort.length === 12 && new Set(cohort.map(item => item.function)).size === 12, 'Twaalf unieke referentie-ervaringen vereist');
  for (const item of cohort) {
    fail(canonical.has(item.function), 'Referentie buiten MAPPEN: ' + item.function);
    fail(text(item.purpose) && text(item.requiredOutcome) && strings(item.failureCases) && item.failureCases.length >= 2, 'Referentie mist taak, uitkomst of storingen: ' + item.function);
  }
  for (const [id, budget] of Object.entries(p.budgetProfiles || {})) {
    fail(budget.status === 'CONTRACT_REFERENCE' && budget.source === 'experience-architecture/coverage-contract.json' && strings(budget.families) && budget.families.length > 0 && budget.families.every(family=>qualificationPlanningFamily(model,family)), 'Budget is geen verwijzing naar bestaand contract: ' + id);
    fail(Object.keys(budget).every(key=>['status','source','families'].includes(key)), 'Geen tweede budgetnormbron toegestaan: ' + id);
  }
  const gates = Array.isArray(p.gates) ? p.gates : [];
  fail(gates.length === 4 && new Set(gates.map(gate => gate.id)).size === 4 && gates.every(gate => /^G[1-4]$/.test(gate.id)), 'Precies G1 t/m G4 vereist');
  const gateContract = {G1:{scope:'reference-cohort',previous:[],requires:['P0','P1','P2','P3','P4','P5','P6','P7']},
    G2:{scope:'catalog',previous:['G1'],requires:['P7']}, G3:{scope:'independent-qualification',previous:['G2'],requires:['P7']},
    G4:{scope:'production',previous:['G3'],requires:['P7']}};
  for (const gate of gates) {
    dependencies(gate.requires, gate.id); fail(text(gate.exit), gate.id + ': exitcriterium ontbreekt');
    const contract = gateContract[gate.id];
    fail(contract && gate.scope === contract.scope && JSON.stringify(gate.dependsOnGates) === JSON.stringify(contract.previous), gate.id + ': scope of volgorde van kwalificatiepoort ongeldig');
    fail(contract && Array.isArray(gate.requires) && contract.requires.every(id => gate.requires.includes(id)), gate.id + ': verplicht kwalificatiepakket ontbreekt');
  }
  fail(p.buildPrecondition?.id === 'P0' && p.buildPrecondition?.scope === 'planning-traceability' && p.buildPrecondition?.source === 'SCHERMEIGENAAR.json' && p.buildPrecondition?.contract === 'experience-architecture/coverage-contract.json', 'P0-bouwvoorwaarde ontbreekt');
  errors.push(...require('./lib/experience/qualification-planning').validate(model));
  return [...new Set(errors)];
}

function qualificationPlanningFamily(model, id) { return Object.hasOwn(model.coverageContract?.qualificationPlanning?.taskFamilies || {}, id); }

function screenOwners(model, item) {
  const candidates = [item.entry, item.contract?.ingang, ...(item.contract?.bestanden || [])]
    .filter(text).map(value => value.split(/[?#]/)[0].replace(/^public\//, '').replace(/^\//, ''));
  return [...new Set(candidates)].filter(value => value.startsWith('apps/') && value.endsWith('.html')).map(route => {
    const visited = new Set(); let target = route;
    while (model.owners.schermen[target]?.naar && !visited.has(target)) {
      visited.add(target); target = model.owners.schermen[target].naar.split(/[?#]/)[0].replace(/^\//, '');
    }
    const owner = model.owners.schermen[target];
    return {route, canonical: target, capability: owner?.capability || null, role: owner?.rol || null};
  });
}

function report(model) {
  const errors = validate(model);
  const assignments = screenAssignments(model), q = model.coverageContract.qualificationPlanning;
  const openConsolidation = model.owners.oordelen.filter(item=>item.stand==='open');
  return {
    planningStatus: errors.length ? 'INVALID' : 'CONSISTENT',
    productQualification: 'NOT_ASSESSED', releaseAuthorized: false,
    baselineCommit: model.program.baselineCommit,
    buildReadiness:{status:errors.length ? 'BLOCKED' : 'READY_TO_BUILD',scope:'planning-traceability',blockers:errors,
      limits:['Geen productkwalificatie; G1–G4 beoordelen bewijs afzonderlijk.','Onbesliste consolidaties en externe voorwaarden geven geen bevoegdheid tot nieuwe effecten of scopewijziging.']},
    openConsolidation,
    qualificationDependencies:q?.openDecisions || [],
    counts: {canonicalEntries: model.inventory.length, workPackages: model.entries.length,
      technicalWorkPackages:model.program.packages.length,
      referenceExperiences: model.program.referenceCohort.length,
      remainingEntries: model.inventory.length - model.program.referenceCohort.length,
      discoveredScreens: model.screens.length,
      screensAwaitingP0Assignment: assignments.filter(screen => screen.qualificationPlan.status!=='CONTRACT_DEFINED' || !screen.canonical || screen.ownerError).length,
      screensWithQualificationRoute:assignments.filter(screen=>screen.qualificationPlan.status==='CONTRACT_DEFINED' && screen.canonical && !screen.ownerError).length,
      supportingScreens:assignments.filter(screen=>!screen.functions.length).length,
      capabilityScenarios:model.entries.reduce((sum,item)=>sum+item.acceptance.length,0),
      sharedScenarios:Object.values(q?.scenarioFamilies || {}).reduce((sum,items)=>sum+items.length,0),
      premiumCriteria:q?.premiumCriteria.length || 0, premiumExperienceQuestions:q?.premiumExperienceGate?.checks.length || 0, budgetCells:q?.budgetMatrix.length || 0,
      openConsolidation:openConsolidation.length,
      appSignatureDeclarations: Object.keys(model.declarations.apps).length,
      screenSignatureDeclarations: Object.keys(model.declarations.screens).length},
    storedEvidence: {appStamp: model.appEvidence.stempel, appCounts: model.appEvidence.telling,
      experienceCandidate: model.experienceEvidence.candidateCommit, experienceStatus: model.experienceEvidence.status,
      experienceSummary: model.experienceEvidence.summary},
    errors
  };
}

function screenAssignments(model) {
  return model.screens.map(screen => {
    const owner = qualification.resolveOwner(model.owners,screen.route);
    const record = model.owners.schermen[screen.route.replace(/^\//,'')];
    return {...screen, owner:record, canonical:owner.canonical, canonicalCapability:owner.capability, ownerError:owner.error,
      functions:record?.afbouw?.workFunctions || [], qualificationPlan:qualification.binding(model.coverageContract,record,screen.profile,model.entries)};
  });
}

function render(model) {
  const result = report(model);
  if (result.errors.length) throw new Error(result.errors.join('\n'));
  const link = file => '[' + file + '](../../' + file + ')';
  const digest = crypto.createHash('sha256').update(JSON.stringify({program:model.program, entries:model.entries,
    inventory:model.inventory, owners:model.owners, app:model.appEvidence, experience:model.experienceEvidence,
    signatures:model.declarations, screens:model.screens, coverageContract:model.coverageContract})).digest('hex');
  const lines = ['# RTG NEXT werkboek per capability', '',
    'Gegenereerde planningbijlage bij [het premium-afbouwplan](../rtg-premium-afbouwplan.md). Bewerk de gekoppelde werkpakketten en genereer opnieuw met `node scripts/rtg-next-programma.js --write`.', '',
    '**Planning, geen kwalificatiebewijs.** Dit werkboek inventariseert ' + model.inventory.length + ' bestaande MAPPEN-ingangen. Meerdere ingangen kunnen één domeineigenaar of scherm delen. De canonieke appbelofte en de hieronder voorgestelde premium-eindtoestand blijven afzonderlijk herkenbaar.', '',
    'Bronbaseline: `' + model.program.baselineCommit + '`. Inhoudshash van deze projectie: `' + digest + '`.', '',
    'Opgeslagen APPWERKT-meting: `' + model.appEvidence.stempel.commit + '` op ' + model.appEvidence.stempel.op + '; telling `' + JSON.stringify(model.appEvidence.telling) + '`. Dit is geen verse uitvoering op de bronbaseline.', '',
    'Opgeslagen Experience-status: `' + model.experienceEvidence.status + '`; kandidaat `' + model.experienceEvidence.candidateCommit + '`. Actuele declaratieve signatures: ' + result.counts.appSignatureDeclarations + ' app en ' + result.counts.screenSignatureDeclarations + ' schermen. Een declaratie is geen uitgevoerd bewijs.', '',
    'Alle werkpakketten doorlopen daarnaast de gemeenschappelijke levensloop-, privacy-, rol-, herstel-, toegankelijkheids- en menselijke acceptatie uit het premium-afbouwplan. De scenario’s hieronder zijn specifieke aanvullingen, geen uitputtende testset. Nieuwe scope wordt eerst bij de bestaande scopebron besloten.', '',
    '## Twaalf referentie-ervaringen', '', '| Ingang | Taak | Storingen | Vereiste uitkomst |', '|---|---|---|---|'];
  const cell = value => String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  for (const item of model.program.referenceCohort) lines.push('| `' + item.function + '` | ' + cell(item.purpose) + ' | ' + cell(item.failureCases.join('; ')) + ' | ' + cell(item.requiredOutcome) + ' |');
  let world = null, count = 0;
  for (const item of model.inventory) {
    if (world !== item.world) { world = item.world; lines.push('', '## ' + world, ''); }
    const work = model.entries.find(entry => entry.function === item.function);
    const observation = model.appEvidence.regels.find(entry => entry.functie === item.function);
    const scope = model.experienceEvidence.logicalApps.find(entry => entry.function === item.function);
    const owners = screenOwners(model, item);
    const reference = model.program.referenceCohort.some(entry => entry.function === item.function);
    lines.push('### ' + (++count) + '. ' + item.name + ' — `' + item.function + '`', '',
      '**Bouwcohort:** ' + (reference ? 'eerste twaalf, poort G1' : 'brede afbouw na G1') + '. **Pakketafhankelijkheden bij volledige acceptatie:** ' + work.dependsOn.join(', ') + '. **Ontwerpfamilie:** ' + work.signature + '. **Budgetverwijzing:** ' + work.budgetProfile + ' → bestaand coverage-contract; schermrisico en taak bepalen de meetnorm.', '',
      '**Samenwerkende capabilities:** ' + (work.usesCapabilities.length ? work.usesCapabilities.map(id => '`' + id + '`').join(', ') : 'geen aanvullende taakafhankelijkheid benoemd') + '. Deze verwijzingen geven geen toegang tot het andere domein.', '',
      '**Bestaande ingang:** ' + (item.entry || 'interne keuze; zie appcontract') + '.', '',
      '**Canonieke productbelofte:** ' + item.contract.belofte + '.', '',
      '**Huidige implementatie, statisch onderzocht:** ' + work.currentObservation, '',
      '**Bronnen:** ' + work.sourceRefs.map(link).join(', ') + '.', '',
      '**Scherm-/ingangseigenaar volgens SCHERMEIGENAAR:** ' + (owners.length ? owners.map(owner => '`' + owner.canonical + '` → `' + (owner.capability || 'ONBESLIST') + '` (' + (owner.role || 'onbekend') + ')').join('; ') : 'niet rechtstreeks afleidbaar; P0 moet de canonieke taakbinding vastleggen') + '. Dit is geen extra domeineigenaar.', '',
      '**Opgeslagen bewijs:** APPWERKT `' + (observation?.status || 'ONTBREEKT') + '`; ' + (scope?.screenIds?.length || 0) + ' schermkoppelingen in de Experience-snapshot. ' + (model.declarations.apps[item.logicalAppId] ? 'App-signature declaratief aanwezig.' : 'Geen app-signature in de huidige signature-overlay.') + ' Geen verse kwalificatie uitgevoerd.', '',
      '**Gewenste premium-eindtoestand:** ' + work.target, '', '**Benodigde wijzigingen:**', '');
    work.changes.forEach(change => lines.push('- ' + change));
    lines.push('', '**Specifieke acceptatie en te leveren bewijs:**', '');
    const acceptanceIds = qualification.acceptanceRequirements(model.entries,[item.function]).ids;
    work.acceptance.forEach((criterion, index) => lines.push((index + 1) + '. ' + criterion.scenario + ' → ' + criterion.expected + ' Bewijs: ' + criterion.evidence + ' Vereiste-ID: `' + acceptanceIds[index] + '`.'));
    lines.push('', '**Externe voorwaarden / besluiten:** ' + (work.externalDecisions.length ? work.externalDecisions.join(' ') : 'Geen aanvullend extern besluit benoemd; de bestaande toezegklasse en gemeenschappelijke scopepoort blijven gelden.'), '');
  }
  lines.push('## Volledige schermscope en P0-toewijzing', '',
    'Alle ' + model.screens.length + ' ontdekte schermen hebben een bouw- en bewijsroute in SCHERMEIGENAAR.afbouw. ' + result.counts.supportingScreens + ' ondersteunende schermen hebben een eigen canoniek domein en toepasselijke gedeelde werkpakketten, zonder geforceerde MAPPEN-ingang. Zij blijven volledig in G2. Deze toewijzing is CONTRACT_DEFINED, niet PROVEN. Alle schermen vereisen de toepasselijke premiumcriteria; de concrete scenario- en budgetbinding staat in de tweede tabel en in EXPERIENCEWERKT.', '',
    '| Scherm | Canonieke eigenaar / domein | Pakketten / capabilitydossiers | Scène / risico / taakfamilies |', '|---|---|---|---|');
  for (const screen of screenAssignments(model)) {
    const plan = screen.qualificationPlan;
    lines.push('| `' + screen.route + '` | `' + screen.canonical + '` / `' + screen.canonicalCapability + '` | ' + plan.workPackages.join(', ') + '; ' +
      (screen.functions.length ? screen.functions.map(id => '`' + id + '`').join(', ') : 'ondersteunende domeintaak') + ' | ' + plan.sceneFamily + ' / ' + plan.riskClass + ' / ' + screen.owner.afbouw.scenarioFamilies.join(', ') + ' |');
  }
  lines.push('', '## Criteria en bewijsroute per scherm', '',
    'De IDs hieronder verwijzen naar qualificationPlanning in het bestaande Experience-contract. De gedeelde scenario’s worden uitgevoerd op de concrete taak, doelgroepen, rollen en gegevensgrenzen van ieder scherm, niet op één generieke demonstratie. Specifieke capabilityscenario’s blijven aanvullend verplicht. Apparaten zijn mobile-small, mobile-large, tablet en desktop; alle geldige toestanden/netwerkconfiguraties blijven gelden. De bestaande typed uitvoering en artefactcontrole leveren bewijs; --gate leest dat bewijs en voert de gebruikersproeven niet zelf uit.', '',
    '| Scherm | Premiumcriteria | Scenario-IDs en specifieke acceptatie | Budgetcellen | Bewijscontracten |', '|---|---|---|---|---|');
  for (const screen of screenAssignments(model)) {
    const plan = screen.qualificationPlan;
    lines.push('| `' + screen.route + '` | ' + plan.criteria.join(', ') + ' | ' + [...plan.scenarios,...(plan.acceptanceRequirements || [])].join(', ') + ' | ' + plan.budgets.join(', ') + ' | ' + plan.evidenceContracts.join(', ') + ' |');
  }
  const q = model.coverageContract.qualificationPlanning;
  lines.push('', '## Premium Experience Gate', '',
    'Vijf afzonderlijke voorwaarden binnen G1–G4; alle moeten slagen. Nieuwe en ervaren gebruikers worden apart getoetst. Samenhang, verzorging en vertrouwen vragen gestructureerde onafhankelijke menselijke beoordeling. De bestaande human-quality-blokkade blijft actief totdat bevoegd bewijs beschikbaar is.', '',
    '| Vraag / ID | Vereiste dimensies | Meetbare acceptatie | Bewijscontracten |', '|---|---|---|---|');
  for (const criterion of q.premiumExperienceGate?.checks || []) lines.push('| ' + [criterion.question+' ('+criterion.id+')',criterion.dimensions.join(', '),JSON.stringify(criterion.measurableAcceptance),criterion.evidenceRequirements.join(', ')].map(cell).join(' | ') + ' |');
  lines.push('', '## Gedeelde acceptatiescenario’s', '',
    'Deze ' + result.counts.sharedScenarios + ' scenario’s vullen de ' + result.counts.capabilityScenarios + ' specifieke capabilityscenario’s aan. Geen ervan is door deze planningtoets uitgevoerd.', '',
    '| ID | Gegeven | Wanneer | Vereiste uitkomst | Bewijscontract | Instrument / ontbrekende producer |', '|---|---|---|---|---|---|');
  for (const scenarios of Object.values(q.scenarioFamilies)) for (const scenario of scenarios) lines.push('| ' + [scenario.id,scenario.given,scenario.when,scenario.then,scenario.evidenceRequirements.join(', '),scenario.instrumentRefs.length ? scenario.instrumentRefs.join(', ') : 'Menselijke producer ontbreekt; bestaande artifact-controle weigert onbevoegde review'].map(cell).join(' | ') + ' |');
  lines.push('', '## Taak- en risicobudgetten', '',
    'Normbron: experience-architecture/coverage-contract.json#qualificationPlanning. De complete meetprotocollen en uitsluitingen staan daar. Deze samenvatting creëert geen tweede normbron.', '',
    '| Taakfamilie | Interactiebudget |', '|---|---|');
  for (const [family,task] of Object.entries(q.taskFamilies)) lines.push('| ' + family + ' | ' + cell(JSON.stringify(task.interactionBudget)) + ' |');
  lines.push('', '| Risico / apparaat | Performance | Onderbreking | Herstel | Toegankelijkheid | Begrijpelijkheid |', '|---|---|---|---|---|---|');
  for (const budget of q.budgetMatrix) lines.push('| ' + [budget.id,...['performance','interruption','recovery','accessibility','humanComprehension'].map(key=>JSON.stringify(budget[key]))].map(cell).join(' | ') + ' |');
  lines.push('', '## Open besluiten en uitvoeringsblokkades', '',
    'Structurele P0-dekking: ' + result.buildReadiness.status + '. Dit is geen algemene sluiting van alle productbesluiten en geen toestemming voor integratie of productie.', '',
    '| Bron | Getroffen scope | Open opdracht / besluit |', '|---|---|---|');
  for (const decision of result.openConsolidation) lines.push('| SCHERMEIGENAAR.oordelen | ' + decision.schermen.map(route=>'`'+route+'`').join(', ') + ' | ' + cell(decision.vervolg) + ' |');
  for (const decision of result.qualificationDependencies) lines.push('| coverage-contract / ' + decision.id + ' | ' + cell(decision.blocks) + ' | ' + cell(decision.decision) + ' |');
  lines.push('', '## Vier technisch beoordeelde beslispoorten', '', '| Poort | Scope | Voorgaande poort | Exit |', '|---|---|---|---|');
  for (const gate of model.program.gates) lines.push('| ' + gate.id + ' | ' + gate.scope + ' | ' + (gate.dependsOnGates.join(', ') || 'P0-bouwvoorwaarde') + ' | ' + cell(gate.exit) + ' |');
  lines.push('', 'Lees een poort met `node scripts/rtg-next-programma.js --gate=G1` (of G2/G3/G4). Een ontbrekend, oud of onbevoegd bewijs geeft BLOCKED en exitcode 1. Alle voorgangers worden opnieuw beoordeeld. Geen opgeslagen groen veld of planningstatus kan dit vervangen.', '');
  return lines.join('\n').trimEnd() + '\n';
}

// Publiceer de lezers vóór de CLI de poort aanroept: de poort vraagt ditzelfde
// programma terug op. Anders krijgt de directe CLI een leeg cyclisch exportobject.
module.exports = {load, validate, report, render, fileExists, screenOwners, screenAssignments, commitExists};

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || args.some(arg => !['--write', '--check', '--render'].includes(arg) && !/^--gate=G[1-4]$/.test(arg))) throw new Error('Gebruik: node scripts/rtg-next-programma.js [--write|--check|--render|--gate=G1..G4]');
    if (args[0]?.startsWith('--gate=')) {
      const result = require('./lib/experience/qualification-gates').assess(root,{gate:args[0].slice(7)});
      console.log(JSON.stringify(result,null,2));
      process.exitCode = result.status === 'PROVEN' ? 0 : 1;
    } else {
    const model = load(), result = report(model);
    if (args[0] === '--render') process.stdout.write(render(model));
    else if (args[0] === '--write') {
      fs.writeFileSync(path.join(root, workbookFile), render(model));
      console.log('Alleen planningwerkboek bijgewerkt: ' + workbookFile + '; geen productbewijs of releasegoedkeuring.');
    } else if (args[0] === '--check') {
      const expected = render(model), file = path.join(root, workbookFile);
      if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== expected) throw new Error('Werkboek ontbreekt of is verouderd; genereer de planning opnieuw met --write.');
      console.log('Planning consistent en werkboek actueel; productkwaliteit NOT_ASSESSED, releaseAuthorized=false.');
    } else console.log(JSON.stringify(result, null, 2));
    if (result.errors.length) process.exitCode = 1;
    }
  } catch (error) { console.error('PLANNING_INVALID: ' + error.message); process.exitCode = 1; }
}
