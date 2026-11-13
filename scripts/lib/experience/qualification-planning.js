'use strict';

// Afbouwmetadata blijft bij SCHERMEIGENAAR; eisen bij het bestaande
// Experience-contract. Deze lezer maakt geen catalogus of uitvoeringsbewijs.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sceneFamilies = ['Horizon','Journey','Atelier','Ledger','Command','Salon','Library','Ceremony','Spatial'];
const taskFamilies = ['orientation','identity','transaction','travel','content','communication','care','learning','operations','governance','public','redirect'];
const premiumExperienceChecks = ['novice-task','expert-efficiency','informed-decision','safe-resumption','coherent-trust'];
const riskRank = {standard:0, sensitive:1, critical:2};
const minimumRisk = {identity:1,transaction:2,communication:1,care:2,learning:1,operations:1,governance:2};
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const uniqueStrings = value => Array.isArray(value) && value.every(nonempty) && new Set(value).size === value.length;
const positive = value => Number.isFinite(value) && value > 0;
const routeKey = route => String(route || '').split(/[?#]/)[0].replace(/^\//,'');

function premiumGateDefined(gate) {
  const checks = Array.isArray(gate?.checks) ? gate.checks : [], aggregation = gate?.aggregation;
  const design = checks.find(item=>item.id==='coherent-trust')?.measurableAcceptance;
  const rubric = design?.rubric;
  return gate?.version === 1 && gate.status === 'CONTRACT_DEFINED' && aggregation?.operator === 'ALL' && aggregation.checksRequired === 5 &&
    ['compensationAllowed','crossCohortPoolingAllowed','crossRiskPoolingAllowed','crossDevicePoolingAllowed','crossTaskPoolingAllowed'].every(key=>aggregation[key]===false) &&
    aggregation.criticalFailuresAllowed === 0 && aggregation.missingEvidenceStatus === 'NOT_TESTED' && aggregation.missingAuthorizedHumanReviewStatus === 'BLOCKED' &&
    gate.cohortProtocol?.separateCohortResults === true && gate.cohortProtocol?.novice?.coachingAllowed === false && gate.cohortProtocol?.independentReviewRequired === true &&
    ['novice','experienced'].every(id=>gate.cohortProtocol?.cohorts?.includes(id)) &&
    rubric?.scaleMin === 1 && rubric.scaleMax === 5 && rubric.scoreMinPerCriterion >= 4 && rubric.scoreMinPerCriterion <= 5 && rubric.criticalFindingsMax === 0 &&
    rubric.independentHumanAssessmentRequired === true && rubric.averagingAllowed === false && rubric.everyObservedRatingMustMeetMinimum === true &&
    Array.isArray(rubric.criteria) && new Set(rubric.criteria.map(item=>item.id)).size === rubric.criteria.length &&
    ['orientation','consistency','craft','trust'].every(id=>rubric.criteria.some(item=>item.id===id)) &&
    checks.length === premiumExperienceChecks.length && premiumExperienceChecks.every(id=>checks.some(item=>item.id===id));
}

function resolveOwner(owners, route) {
  const visited = new Set(); let current = routeKey(route);
  while (true) {
    if (visited.has(current)) return {error:'ALIAS_CYCLE',route:current};
    visited.add(current);
    const record = owners.schermen[current];
    if (!record) return {error:'OWNER_MISSING',route:current};
    if (record.rol === 'alias') {
      if (!nonempty(record.naar)) return {error:'ALIAS_TARGET_MISSING',route:current};
      current = routeKey(record.naar); continue;
    }
    const canonical = owners.capabilities[record.capability], owner = owners.schermen[canonical];
    if (!canonical || !owner || owner.rol !== 'eigenaar' || owner.capability !== record.capability) return {error:'CANONICAL_OWNER_MISMATCH',route:current};
    if (record.rol === 'eigenaar' && canonical !== current) return {error:'DUPLICATE_OWNER',route:current};
    return {route:current,canonical,capability:record.capability,record};
  }
}

function scopeDigest(inventory, entries) {
  const rows = inventory.map(item => {
    const work = entries.find(entry => entry.function === item.function);
    return {function:item.function,canonicalPromise:item.contract?.belofte,target:work?.target,changes:work?.changes,
      acceptance:work?.acceptance?.map(criterion => ({scenario:criterion.scenario,expected:criterion.expected}))};
  }).sort((a,b)=>a.function.localeCompare(b.function));
  return crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

function existingFile(root, name) {
  if (!nonempty(name) || path.isAbsolute(name) || name.split(/[\\/]/).includes('..')) return false;
  try { const file = fs.realpathSync(path.join(root,name)); return file.startsWith(fs.realpathSync(root)+path.sep) && fs.statSync(file).isFile(); }
  catch (_) { return false; }
}

// Alleen een projectie uit de bestaande werkpakketbestanden. Verwijderde of
// onleesbare invoer wordt een blokkade, nooit een lege acceptatienoemer.
function acceptanceSource(root) {
  try {
    const program = JSON.parse(fs.readFileSync(path.join(root,'docs/rtg-next/programma.json'),'utf8'));
    if (!uniqueStrings(program.workPackageFiles) || !program.workPackageFiles.length) throw Error('WORK_PACKAGE_FILES_MISSING');
    const entries = [], files = [];
    for (const file of program.workPackageFiles) {
      if (!existingFile(root,file)) throw Error('WORK_PACKAGE_FILE_INVALID:'+file);
      const bytes = fs.readFileSync(path.join(root,file));
      const data = JSON.parse(bytes.toString('utf8'));
      if (!Array.isArray(data.entries) || !data.entries.length) throw Error('WORK_PACKAGE_ENTRIES_MISSING:'+file);
      entries.push(...data.entries); files.push({path:file,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
    }
    if (new Set(entries.map(entry=>entry.function)).size !== entries.length) throw Error('DUPLICATE_WORK_FUNCTION');
    for (const entry of entries) {
      if (!nonempty(entry.function) || !Array.isArray(entry.acceptance) || !entry.acceptance.length ||
          entry.acceptance.some(item=>!item || !['scenario','expected','evidence'].every(key=>nonempty(item[key]))))
        throw Error('SPECIFIC_ACCEPTANCE_MISSING:'+entry.function);
      if (new Set(entry.acceptance.map(item=>item.scenario)).size !== entry.acceptance.length)
        throw Error('DUPLICATE_SPECIFIC_ACCEPTANCE:'+entry.function);
    }
    return {status:'CONTRACT_DEFINED',entries,files};
  } catch (error) { return {status:'BLOCKED',entries:[],files:[],reason:error.message}; }
}

function acceptanceRequirements(entries, functions) {
  const ids = [], missing = [];
  for (const id of functions || []) {
    const matches = (entries || []).filter(entry=>entry.function===id);
    if (matches.length !== 1 || !Array.isArray(matches[0].acceptance) || !matches[0].acceptance.length) { missing.push(id); continue; }
    for (const criterion of matches[0].acceptance) {
      if (!criterion || !['scenario','expected','evidence'].every(key=>nonempty(criterion[key]))) { missing.push(id); continue; }
      // Niet op arraypositie: herordenen behoudt de identiteit, een andere
      // uitkomst of bewijsbelofte vereist wel nieuw kandidaatgebonden bewijs.
      const digest = crypto.createHash('sha256').update(JSON.stringify({scenario:criterion.scenario,
        expected:criterion.expected,evidence:criterion.evidence})).digest('hex');
      ids.push('acceptance:'+id+':'+digest);
    }
  }
  return {ids:[...new Set(ids)],missing:[...new Set(missing)]};
}

function validate(model) {
  const errors = [], check = (condition,message) => { if (!condition) errors.push(message); };
  const contract = model.coverageContract, plan = contract?.qualificationPlanning;
  if (!plan || plan.version !== 1 || plan.status !== 'CONTRACT_DEFINED') return ['P0:QUALIFICATION_CONTRACT_MISSING'];
  const routes = new Set(model.screens.map(screen => routeKey(screen.route)));
  const functions = new Set(model.inventory.map(item => item.function));
  const packages = new Set(model.program.packages.map(pack => pack.id));
  const criteria = plan.premiumCriteria || [], criterionIds = new Set(criteria.map(item => item.id));
  const evidenceContracts = plan.evidenceContracts || [], evidenceIds = new Set(evidenceContracts.map(item=>item.id));
  check(evidenceContracts.length >= 12 && evidenceIds.size === evidenceContracts.length, 'P0:EVIDENCE_CONTRACTS_INCOMPLETE');
  for (const item of evidenceContracts) check(nonempty(item.requires) && uniqueStrings(item.sourceRefs) && item.sourceRefs.length > 0 && item.sourceRefs.every(file=>existingFile(model.root,file)), 'P0:EVIDENCE_SOURCE_MISSING:'+item.id);
  check(criteria.length >= 12 && criterionIds.size === criteria.length, 'P0:PREMIUM_CRITERIA_INCOMPLETE');
  const dimensionIds = new Set(contract.dimensions.map(d=>d.id));
  const premiumGate = plan.premiumExperienceGate;
  check(premiumGateDefined(premiumGate), 'P0:PREMIUM_EXPERIENCE_GATE_INCOMPLETE');
  for (const item of premiumGate?.checks || []) check(nonempty(item.question) && uniqueStrings(item.dimensions) && item.dimensions.includes('human-quality') &&
    item.dimensions.every(id=>dimensionIds.has(id)) && uniqueStrings(item.evidenceRequirements) && item.evidenceRequirements.includes('human-observation') &&
    item.evidenceRequirements.every(id=>evidenceIds.has(id)) && item.measurableAcceptance && Object.keys(item.measurableAcceptance).length > 0 &&
    !['proven','passed','completed','status'].some(key=>Object.hasOwn(item,key)), 'P0:PREMIUM_EXPERIENCE_CHECK_INVALID:'+item.id);
  const resultFields = ['status','proven','passed','completed','qualification','releaseAuthorized'];
  for (const criterion of criteria) {
    check(nonempty(criterion.id) && uniqueStrings(criterion.dimensions) && criterion.dimensions.length && criterion.dimensions.every(id=>dimensionIds.has(id)) && nonempty(criterion.acceptance) && uniqueStrings(criterion.evidenceRequirements) && criterion.evidenceRequirements.length > 0 && criterion.evidenceRequirements.every(id=>evidenceIds.has(id)), 'P0:INVALID_CRITERION:'+criterion.id);
    check(resultFields.every(key=>!Object.hasOwn(criterion,key)), 'P0:CRITERION_FALSE_PROOF:'+criterion.id);
  }
  const scenarioIds = new Set();
  for (const family of taskFamilies) {
    const scenarios = plan.scenarioFamilies?.[family];
    check(Array.isArray(scenarios) && ['execute','negative','recover','understand'].every(kind=>scenarios.some(row=>row.id===family+'-'+kind)), 'P0:SCENARIO_FAMILY_MISSING:'+family);
    const declared = plan.taskFamilies?.[family]?.scenarioIds;
    check(uniqueStrings(declared) && Array.isArray(scenarios) && declared.length===scenarios.length && scenarios.every(row=>declared.includes(row.id)), 'P0:SCENARIO_DECLARATION_MISMATCH:'+family);
    const interaction = plan.taskFamilies?.[family]?.interactionBudget;
    check(interaction && Number.isInteger(interaction.meaningfulActionsMax) && interaction.meaningfulActionsMax > 0 &&
      interaction.unnecessaryContextSwitchesMax === 0 && interaction.simultaneousPrimaryActionsMax === 1 &&
      Number.isInteger(interaction.extraActionsForRecoveryMax) && interaction.extraActionsForRecoveryMax >= 0, 'P0:TASK_BUDGET_MISSING:'+family);
    for (const scenario of scenarios || []) {
      check(nonempty(scenario.id) && !scenarioIds.has(scenario.id), 'P0:DUPLICATE_OR_EMPTY_SCENARIO:'+scenario.id); scenarioIds.add(scenario.id);
      check(resultFields.every(key=>!Object.hasOwn(scenario,key)), 'P0:SCENARIO_FALSE_PROOF:'+scenario.id);
      check(['given','when','then'].every(key=>nonempty(scenario[key])) && uniqueStrings(scenario.evidenceRequirements) && scenario.evidenceRequirements.length > 0 && scenario.evidenceRequirements.every(id=>evidenceIds.has(id)), 'P0:SCENARIO_INCOMPLETE:'+scenario.id);
      // Menselijke acceptatie heeft een bestaande weigeraar, nog geen bevoegde producer.
      // Een lege instrumentlijst sluit alleen de routeplanning; nooit de uitvoering.
      check(uniqueStrings(scenario.instrumentRefs) && (scenario.instrumentRefs.length > 0 || scenario.evidenceRequirements?.includes('human-observation')) && scenario.instrumentRefs.every(file=>existingFile(model.root,file)), 'P0:SCENARIO_INSTRUMENT_MISSING:'+scenario.id);
    }
  }
  const matrix = plan.budgetMatrix || [], matrixIds = new Set(matrix.map(item=>item.id));
  check(matrixIds.size === matrix.length, 'P0:DUPLICATE_BUDGET');
  for (const risk of Object.keys(riskRank)) for (const device of contract.devices) {
    const id = risk+':'+device, budget = matrix.find(item=>item.id===id);
    check(budget && budget.riskClass===risk && budget.device===device && ['performance','interruption','recovery','accessibility','humanComprehension'].every(key=>budget[key] && Object.keys(budget[key]).length), 'P0:BUDGET_MISSING:'+id);
    const base = contract.release.experienceBudgets;
    check(budget?.status === 'CONTRACT_DEFINED' && budget.performance?.lcpP75MsMax <= base.lcpP75MsMax && budget.performance?.inpP75MsMax <= base.inpP75MsMax && budget.performance?.clsP75Max <= base.clsP75Max && budget.accessibility?.interactiveTargetPxMin >= base.interactiveTargetPxMin && budget.humanComprehension?.criticalFindingsMax === 0, 'P0:BUDGET_WEAKENED_OR_FALSE_PROOF:'+id);
    const performance = budget?.performance, recovery = budget?.recovery, interruption = budget?.interruption;
    const accessibility = budget?.accessibility, human = budget?.humanComprehension;
    const riskBudget = plan.riskClasses?.[risk], deviceBudget = plan.deviceBudgets?.[device];
    check(performance && ['lcpP75MsMax','inpP75MsMax','localFeedbackP95MsMax','pendingStatusVisibleMsMax','stalledExplanationVisibleMsMax'].every(key=>positive(performance[key])) &&
      Number.isFinite(performance.clsP75Max) && performance.clsP75Max >= 0 &&
      positive(riskBudget?.localFeedbackP95MsMax) && positive(deviceBudget?.localFeedbackP95MsMax) &&
      performance.localFeedbackP95MsMax <= Math.min(riskBudget.localFeedbackP95MsMax,deviceBudget.localFeedbackP95MsMax) &&
      nonempty(performance.providerCompletionDeadline), 'P0:BUDGET_PERFORMANCE_INVALID:'+id);
    check(recovery && positive(recovery.resumeToSafeStateP95MsMax) && positive(deviceBudget?.resumeToSafeStateP95MsMax) &&
      recovery.resumeToSafeStateP95MsMax <= deviceBudget.resumeToSafeStateP95MsMax &&
      recovery.mutationsBeforeReauthorizationMax === 0 && recovery.sourceConflictSilentOverwritesMax === 0 &&
      nonempty(recovery.unknownOutcomeRule) && nonempty(recovery.localDraftExpirySource), 'P0:BUDGET_RECOVERY_INVALID:'+id);
    check(interruption && ['duplicateExternalEffectsMax','unconfirmedAutoReplayMax','acknowledgedDataLossMax','accountSwitchSensitiveResidueMax'].every(key=>interruption[key]===0) &&
      interruption.offlineSensitiveWritesAllowed === false && nonempty(interruption.unsavedDataPolicy), 'P0:BUDGET_INTERRUPTION_INVALID:'+id);
    check(accessibility && accessibility.criticalFindingsMax === 0 && accessibility.unexplainedExemptionsMax === 0 &&
      ['keyboardAllApplicableTasks','focusVisibleAndRestored','reducedMotionHonored','screenReaderTaskRequired'].every(key=>accessibility[key]===true) &&
      positive(accessibility.interactiveTargetPxMin) && positive(accessibility.zoomPercentMin) && accessibility.zoomPercentMin >= 200 &&
      positive(accessibility.reflowWidthCssPx) && accessibility.reflowWidthCssPx <= 320 &&
      uniqueStrings(accessibility.physicalChecks) && uniqueStrings(deviceBudget?.physicalChecks) && deviceBudget.physicalChecks.every(item=>accessibility.physicalChecks.includes(item)), 'P0:BUDGET_ACCESSIBILITY_INVALID:'+id);
    check(human && human.criticalFindingsMax === 0 && human.criticalMisunderstandingsMax === 0 &&
      ['unassistedTaskSuccessRatioMin','teachBackCorrectRatioMin'].every(key=>positive(human[key]) && human[key] <= 1 && positive(riskBudget?.[key]) && human[key] >= riskBudget[key]) &&
      uniqueStrings(human.questions) && human.questions.length >= 4 && nonempty(human.assessment), 'P0:BUDGET_HUMAN_INVALID:'+id);
  }
  // Het bestaande register bevat daarnaast publieke site-/DS-schermen, buiten de apps-inventaris.
  for (const key of Object.keys(model.owners.schermen).filter(key=>key.startsWith('apps/'))) check(routes.has(key), 'P0:ORPHAN_SCREEN_RECORD:'+key);
  const allowed = new Set(['workPackages','workFunctions','sceneFamily','riskClass','scenarioFamilies','rationale']);
  for (const screen of model.screens) {
    const key = routeKey(screen.route), record = model.owners.schermen[key], delivery = record?.afbouw;
    const owner = resolveOwner(model.owners,screen.route);
    check(!owner.error, 'P0:'+owner.error+':'+key);
    check(!!record && Object.hasOwn(model.owners.rollen,record.rol), 'P0:UNKNOWN_OWNER_ROLE:'+key);
    if (!delivery || typeof delivery !== 'object') { errors.push('P0:DELIVERY_MISSING:'+key); continue; }
    for (const field of Object.keys(delivery)) check(allowed.has(field), 'P0:UNSUPPORTED_DELIVERY_FIELD:'+key+':'+field);
    check(uniqueStrings(delivery.workPackages) && ['P0','P4','P6','P7'].every(id=>delivery.workPackages.includes(id)) && delivery.workPackages.every(id=>packages.has(id)), 'P0:WORK_PACKAGE_MISSING:'+key);
    check(uniqueStrings(delivery.workFunctions) && delivery.workFunctions.every(id=>functions.has(id)), 'P0:INVALID_CAPABILITY_LINK:'+key);
    check(sceneFamilies.includes(delivery.sceneFamily), 'P0:SCENE_FAMILY_MISSING:'+key);
    check(Object.hasOwn(riskRank,delivery.riskClass), 'P0:RISK_CLASS_MISSING:'+key);
    check(uniqueStrings(delivery.scenarioFamilies) && delivery.scenarioFamilies.length > 0 && delivery.scenarioFamilies.every(id=>taskFamilies.includes(id)), 'P0:SCENARIO_BINDING_MISSING:'+key);
    for (const family of delivery.scenarioFamilies || []) check(riskRank[delivery.riskClass] >= (minimumRisk[family] || 0), 'P0:RISK_DOWNGRADE:'+key+':'+family);
    if (riskRank[delivery.riskClass] > 0) check(delivery.workPackages?.includes('P1'), 'P0:AUTHORITY_PACKAGE_MISSING:'+key);
    if (record.rol === 'alias') {
      check(delivery.scenarioFamilies?.includes('redirect'), 'P0:REDIRECT_CONTRACT_MISSING:'+key);
      check(!owner.error && riskRank[delivery.riskClass] >= riskRank[owner.record?.afbouw?.riskClass], 'P0:ALIAS_RISK_DOWNGRADE:'+key);
    }
    check(nonempty(delivery.rationale) && delivery.rationale.length >= 20, 'P0:DELIVERY_RATIONALE_MISSING:'+key);
  }
  const mapped = new Set(model.screens.flatMap(screen=>model.owners.schermen[routeKey(screen.route)]?.afbouw?.workFunctions || []));
  for (const id of functions) check(mapped.has(id), 'P0:CAPABILITY_WITHOUT_SCREEN_BINDING:'+id);
  const actualOwners = new Map();
  for (const [route,record] of Object.entries(model.owners.schermen)) if (record.rol === 'eigenaar') {
    if (actualOwners.has(record.capability)) errors.push('P0:DUPLICATE_OWNER:'+record.capability);
    actualOwners.set(record.capability,route);
  }
  for (const [capability,route] of Object.entries(model.owners.capabilities)) check(actualOwners.get(capability)===route && (routes.has(route) || (!route.startsWith('apps/') && existingFile(model.root,'public/'+route))), 'P0:CANONICAL_OWNER_MISMATCH:'+capability);
  check(model.program.scopeLock?.status==='LOCKED' && model.program.scopeLock?.sha256===scopeDigest(model.inventory,model.entries), 'P0:PREMIUM_SCOPE_CHANGED_EXPLICIT_DECISION_REQUIRED');
  return [...new Set(errors)];
}

function binding(contract, owner, profile = 'interface', entries, functions = owner?.afbouw?.workFunctions) {
  const plan = contract.qualificationPlanning, delivery = owner?.afbouw;
  if (!plan || !delivery) return {status:'NOT_DEFINED',criteria:[],scenarios:[],budgets:[],evidenceContracts:[]};
  const dimensions = contract.profiles[profile]?.dimensions || [];
  const criteria = plan.premiumCriteria.filter(item=>item.dimensions.some(id=>dimensions.includes(id)));
  const scenarios = [...new Map(delivery.scenarioFamilies.flatMap(id=>plan.scenarioFamilies[id] || []).map(item=>[item.id,item])).values()];
  const budgets = contract.devices.map(device=>plan.budgetMatrix.find(item=>item.id===delivery.riskClass+':'+device)).filter(Boolean);
  const acceptance = entries === undefined ? null : acceptanceRequirements(entries,functions);
  return {status:acceptance?.missing.length ? 'BLOCKED' : 'CONTRACT_DEFINED',criteria:criteria.map(item=>item.id),scenarios:scenarios.map(item=>item.id),budgets:budgets.map(item=>item.id),
    ...(acceptance ? {acceptanceRequirements:acceptance.ids,missingAcceptanceFunctions:acceptance.missing} : {}),
    premiumExperienceChecks:profile === 'interface' ? (plan.premiumExperienceGate?.checks || []).map(item=>item.id) : [],
    sceneFamily:delivery.sceneFamily,riskClass:delivery.riskClass,workPackages:delivery.workPackages,workFunctions:delivery.workFunctions,
    evidenceContracts:[...new Set([...criteria,...scenarios].flatMap(item=>item.evidenceRequirements))],
    proofRoute:'scripts/experience-coverage.js --gate',qualification:'NOT_TESTED'};
}

function requirements(contract, dimension, subject, profile = 'interface') {
  const plan = contract.qualificationPlanning, delivery = subject?.owner?.afbouw;
  if (!plan || !delivery) return [];
  const extra = plan.premiumCriteria.filter(item=>item.dimensions.includes(dimension)).map(item=>'premium:'+item.id);
  if (profile === 'interface') for (const item of plan.premiumExperienceGate?.checks || []) if (item.dimensions.includes(dimension)) extra.push('premium-experience:'+item.id);
  if (dimension==='continuity') for (const family of delivery.scenarioFamilies) for (const scenario of plan.scenarioFamilies[family] || []) extra.push('scenario:'+scenario.id);
  if (dimension==='continuity') extra.push(...(subject.acceptanceRequirements || []));
  const groups = {fluidity:['performance'],accessibility:['accessibility'],continuity:['interruption','recovery'],'human-quality':['humanComprehension']};
  for (const device of contract.devices) for (const group of groups[dimension] || []) extra.push('budget:'+delivery.riskClass+':'+device+':'+group);
  if (dimension==='restraint') for (const family of delivery.scenarioFamilies) extra.push('task-budget:'+family);
  return [...new Set(extra)];
}

// Dit oordeel leest uitsluitend opnieuw opgebouwde Experience-dimensies.
// Het accepteert geen aparte reviewerboolean of handmatig groen gatebestand.
function premiumExperienceAssessment(contract, subjects) {
  const gate = contract.qualificationPlanning?.premiumExperienceGate;
  const checks = gate?.checks || [];
  const completeContract = premiumGateDefined(gate);
  const applicable = subjects.filter(subject=>(subject.profile || subject.scope?.profile || 'interface') === 'interface');
  const excludedRedirects = subjects.filter(subject=>(subject.profile || subject.scope?.profile) === 'redirect').map(subject=>subject.id);
  const unknownProfiles = subjects.filter(subject=>!['interface','redirect'].includes(subject.profile || subject.scope?.profile || 'interface'));
  const rows = premiumExperienceChecks.map(id=>{
    const check = checks.find(item=>item.id===id);
    const passing = applicable.filter(subject=>check?.dimensions?.includes('human-quality') &&
      subject.signature?.status === 'DECLARED' && subject.qualificationPlan?.status === 'CONTRACT_DEFINED' &&
      subject.qualificationPlan.premiumExperienceChecks?.includes(id) && check.dimensions.every(dimension=>{
        const row = subject.dimensions.find(item=>item.id===dimension);
        const required = require('./dimensions').requirements(contract,'interface',dimension,subject.signature,subject);
        return row?.applicable === true && row.status === 'PROVEN' && row.requirementCount === required.length &&
          row.provenCount === required.length && required.includes('premium-experience:'+id);
      }));
    return {id,status:completeContract && applicable.length > 0 && passing.length === applicable.length ? 'PROVEN' : 'BLOCKED',
      requiredSubjects:applicable.length,provenSubjects:passing.length};
  });
  return {status:completeContract && !unknownProfiles.length && rows.every(row=>row.status==='PROVEN') ? 'PROVEN' : 'BLOCKED',
    checks:rows,excludedRedirects,releaseAuthorized:false};
}

module.exports = {resolveOwner,scopeDigest,validate,binding,requirements,acceptanceSource,acceptanceRequirements,sceneFamilies,taskFamilies,riskRank,premiumExperienceChecks,premiumExperienceAssessment,premiumGateDefined};
