'use strict';

// Onafhankelijke mutatieproeven op de echte P0-planning. Deze fixtures voeren
// geen gebruikershandeling uit en zijn geen software- of releasebewijs.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('../scripts/rtg-next-programma');
const planning=require('../scripts/lib/experience/qualification-planning');
const baseline=load();
const fixture=()=>structuredClone(baseline);
const firstRoute=baseline.screens[0].route.slice(1);
const contract=model=>model.coverageContract.qualificationPlanning;
function reject(change,match) {
  const model=fixture();change(model);
  let errors;
  assert.doesNotThrow(()=>{errors=planning.validate(model);},'ongeldige planning moet als concrete fouten worden gerapporteerd');
  assert.ok(errors.length,'de mutatie moet de planningpoort laten zakken');
  if(match) assert.ok(errors.some(error=>match.test(error)),JSON.stringify(errors));
  return errors;
}

test('de huidige 316 schermen en 114 functies hebben planningdekking zonder bewijsclaim',()=>{
  assert.equal(baseline.screens.length,316);
  assert.equal(baseline.inventory.length,114);
  assert.deepEqual(planning.validate(baseline),[]);
  const linked=new Set();
  for(const screen of baseline.screens) {
    const owner=baseline.owners.schermen[screen.route.slice(1)];
    const binding=planning.binding(baseline.coverageContract,owner,screen.profile);
    assert.equal(binding.status,'CONTRACT_DEFINED');
    assert.equal(binding.qualification,'NOT_TESTED');
    assert.ok(binding.criteria.length&&binding.scenarios.length&&binding.budgets.length===4);
    owner.afbouw.workFunctions.forEach(id=>linked.add(id));
  }
  assert.ok(baseline.inventory.every(item=>linked.has(item.function)));
});

test('een ontbrekende eigenaar van één ontdekt scherm blokkeert',()=>{
  reject(model=>{delete model.owners.schermen[firstRoute];},/OWNER_MISSING|CANONICAL_OWNER_MISMATCH/);
});

test('een ontbrekende afbouwbinding van één ontdekt scherm blokkeert',()=>{
  reject(model=>{delete model.owners.schermen[firstRoute].afbouw;},/DELIVERY_MISSING/);
});

test('een ontbrekend verplicht werkpakket of scènefamilie blokkeert',()=>{
  reject(model=>{model.owners.schermen[firstRoute].afbouw.workPackages=[];},/WORK_PACKAGE_MISSING/);
  reject(model=>{delete model.owners.schermen[firstRoute].afbouw.sceneFamily;},/SCENE_FAMILY_MISSING/);
});

test('een ontbrekend premiumcriterium of bewijscontract blokkeert',()=>{
  reject(model=>{contract(model).premiumCriteria.pop();},/PREMIUM_CRITERIA_INCOMPLETE/);
  reject(model=>{contract(model).evidenceContracts.pop();},/EVIDENCE_CONTRACTS_INCOMPLETE/);
});

test('een verdwenen scenariofamilie of schermfamiliekoppeling blokkeert',()=>{
  reject(model=>{delete contract(model).scenarioFamilies.transaction;},/SCENARIO_FAMILY_MISSING/);
  reject(model=>{model.owners.schermen[firstRoute].afbouw.scenarioFamilies=[];},/SCENARIO_BINDING_MISSING/);
});

test('één ontbrekend negatief scenario mag niet achter een minimumtelling verdwijnen',()=>{
  reject(model=>{
    contract(model).scenarioFamilies.transaction=contract(model).scenarioFamilies.transaction.filter(scenario=>scenario.id!=='transaction-negative');
  },/SCENARIO/);
});

test('een dubbele scenario-identiteit is geen extra dekking',()=>{
  reject(model=>{contract(model).scenarioFamilies.transaction[1].id=contract(model).scenarioFamilies.transaction[0].id;},/DUPLICATE_OR_EMPTY_SCENARIO/);
});

test('een ontbrekend risico-apparaatbudget blokkeert',()=>{
  reject(model=>{contract(model).budgetMatrix.pop();},/BUDGET_MISSING/);
});

test('een ontbrekende budgetsectie geeft een fout en geen ongevangen uitzondering',()=>{
  reject(model=>{delete contract(model).budgetMatrix[0].performance;},/BUDGET/);
});

test('een lagere prestatienorm of kleiner aanraakdoel kan niet als premium doorgaan',()=>{
  reject(model=>{contract(model).budgetMatrix[0].performance.lcpP75MsMax=10000;},/BUDGET_WEAKENED_OR_FALSE_PROOF/);
  reject(model=>{contract(model).budgetMatrix[0].accessibility.interactiveTargetPxMin=24;},/BUDGET_WEAKENED_OR_FALSE_PROOF/);
});

test('een lege taakbudgetdefinitie is geen meetbare acceptatievoorwaarde',()=>{
  reject(model=>{contract(model).taskFamilies.transaction.interactionBudget={};},/BUDGET/);
});

test('een herstelbudget zonder meetbare hervatgrens blijft onvolledig',()=>{
  reject(model=>{delete contract(model).budgetMatrix[0].recovery.resumeToSafeStateP95MsMax;},/BUDGET/);
});

test('negatieve prestatiegrenzen mogen niet door een maxima-vergelijking glippen',()=>{
  reject(model=>{contract(model).budgetMatrix[0].performance.lcpP75MsMax=-1;},/BUDGET/);
});

test('een matrixcel mag de vastgelegde risico- en apparaatfeedbackgrens niet verruimen',()=>{
  reject(model=>{contract(model).budgetMatrix[0].performance.localFeedbackP95MsMax=99999;},/BUDGET/);
});

test('twee canonieke eigenaars voor dezelfde capability blokkeren',()=>{
  reject(model=>{
    const [canonical,record]=Object.entries(model.owners.schermen).find(([route,row])=>route.startsWith('apps/')&&row.rol==='eigenaar');
    const other=model.screens.find(screen=>screen.route.slice(1)!==canonical).route.slice(1);
    model.owners.schermen[other].rol='eigenaar';
    model.owners.schermen[other].capability=record.capability;
  },/DUPLICATE_OWNER/);
});

test('een verweesd app-schermrecord blokkeert ook als het afbouwmetadata heeft',()=>{
  reject(model=>{
    model.owners.schermen['apps/p0-verweesde-fixture.html']=structuredClone(model.owners.schermen[firstRoute]);
  },/ORPHAN_SCREEN_RECORD/);
});

test('een aliascyclus of verdwenen aliasbestemming blokkeert',()=>{
  reject(model=>{
    const aliases=Object.entries(model.owners.schermen).filter(([route,row])=>route.startsWith('apps/')&&row.rol==='alias');
    aliases[0][1].naar=aliases[1][0];aliases[1][1].naar=aliases[0][0];
  },/ALIAS_CYCLE/);
  reject(model=>{
    const alias=Object.values(model.owners.schermen).find(row=>row.rol==='alias');
    alias.naar='apps/p0-ontbrekende-bestemming.html';
  },/OWNER_MISSING/);
});

test('bestaande publieke en DS-eigenaars buiten de 316 blijven geldig en ongewijzigd',()=>{
  const model=fixture(),publicRows=Object.entries(model.owners.schermen).filter(([route])=>!route.startsWith('apps/'));
  assert.ok(publicRows.length>0);
  const before=JSON.stringify(publicRows);
  const errors=planning.validate(model);
  assert.equal(errors.some(error=>/ORPHAN_SCREEN_RECORD|CANONICAL_OWNER_MISMATCH/.test(error)),false);
  assert.equal(JSON.stringify(Object.entries(model.owners.schermen).filter(([route])=>!route.startsWith('apps/'))),before);
  assert.equal(model.screens.length,316,'publieke eigenaarrecords voegen geen apps toe aan deze inventaris');
});

for(const [name,change] of [
  ['canonieke belofte',model=>{model.inventory[0].contract.belofte+=' Nieuwe belofte.';}],
  ['premium-eindtoestand',model=>{model.entries[0].target+=' Nieuwe eindtoestand.';}],
  ['wijzigingsomvang',model=>{model.entries[0].changes.push('Nieuwe functionaliteit buiten de scope.');}],
  ['acceptatiescenario',model=>{model.entries[0].acceptance[0].scenario+=' Extra handeling.';}],
  ['acceptatie-uitkomst',model=>{model.entries[0].acceptance[0].expected+=' Extra uitkomst.';}]
]) test('scopewijziging in '+name+' vereist een expliciet nieuw besluit',()=>{
  reject(change,/PREMIUM_SCOPE_CHANGED_EXPLICIT_DECISION_REQUIRED/);
});

test('een risicodowngrade voor gevoelige of kritieke handelingen blokkeert',()=>{
  reject(model=>{
    const row=Object.values(model.owners.schermen).find(row=>row.afbouw?.scenarioFamilies.includes('transaction'));
    row.afbouw.riskClass='standard';
  },/RISK_DOWNGRADE/);
});

test('een alias kan het risico van zijn kritieke canonieke bestemming niet afzwakken',()=>{
  reject(model=>{
    const [route,alias]=Object.entries(model.owners.schermen).find(([,row])=>row.rol==='alias'&&row.afbouw?.riskClass==='critical');
    const canonical=planning.resolveOwner(model.owners,route);
    assert.equal(model.owners.schermen[canonical.canonical].afbouw.riskClass,'critical');
    alias.afbouw.riskClass='standard';alias.afbouw.scenarioFamilies=['redirect'];
  },/RISK/);
});

test('onterecht groene scherm- en budgetmetadata blokkeren',()=>{
  reject(model=>{model.owners.schermen[firstRoute].afbouw.qualified=true;},/UNSUPPORTED_DELIVERY_FIELD/);
  reject(model=>{contract(model).budgetMatrix[0].status='PROVEN';},/BUDGET_WEAKENED_OR_FALSE_PROOF/);
});

test('een scenario of premiumcriterium kan zichzelf niet bewezen verklaren',()=>{
  reject(model=>{contract(model).scenarioFamilies.transaction[0].status='PROVEN';});
  reject(model=>{contract(model).premiumCriteria[0].proven=true;});
});

test('de laatste schermkoppeling van één capability verwijderen breekt volledige scope-dekking',()=>{
  reject(model=>{
    const removed=model.inventory[0].function;
    for(const row of Object.values(model.owners.schermen)) if(row.afbouw)row.afbouw.workFunctions=row.afbouw.workFunctions.filter(id=>id!==removed);
  },/CAPABILITY|FUNCTION/);
});

test('een onbekende functie kan een ontbrekende canonieke koppeling niet vervangen',()=>{
  reject(model=>{model.owners.schermen[firstRoute].afbouw.workFunctions.push('link:p0-verzonnen-115');},/INVALID_CAPABILITY_LINK/);
});

test('een menselijke bewijsroute mag een nog ontbrekende producer eerlijk laten zien',()=>{
  const model=fixture(),plan=contract(model);
  const humanOnly=Object.values(plan.scenarioFamilies).flat().filter(scenario=>scenario.instrumentRefs.length===0);
  assert.ok(humanOnly.length>0);
  assert.ok(humanOnly.every(scenario=>scenario.evidenceRequirements.includes('human-observation')));
  assert.ok(plan.evidenceContracts.find(item=>item.id==='human-observation').sourceRefs.includes('scripts/lib/experience/artifact.js'));
  assert.deepEqual(planning.validate(model),[]);
  assert.equal(plan.evidencePolicy.missingAuthorizedHumanReview,'BLOCKED');
});

test('de menselijke uitzondering mag geen ontbrekend uitvoeringsinstrument maskeren',()=>{
  reject(model=>{
    const scenario=contract(model).scenarioFamilies.transaction[0];
    assert.equal(scenario.evidenceRequirements.includes('human-observation'),false);
    scenario.instrumentRefs=[];
  },/SCENARIO_INSTRUMENT_MISSING/);
});

test('een onbekend bewijscontract of verdwenen verifier blokkeert',()=>{
  reject(model=>{contract(model).scenarioFamilies.transaction[0].evidenceRequirements.push('ongekende-bewijsclaim');},/SCENARIO_INCOMPLETE/);
  reject(model=>{contract(model).evidenceContracts.find(item=>item.id==='human-observation').sourceRefs=['test/geen-menselijke-verifier.js'];},/EVIDENCE_SOURCE_MISSING/);
});
