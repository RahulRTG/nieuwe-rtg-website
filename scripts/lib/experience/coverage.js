'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {fingerprint,sha} = require('./evidence');
const {appInventory,interactionInventory,screenInventory,signatureFor}=require('./subjects');
const {requirements,dimensionRows,evidenceStatus,DIMENSION_ORDER}=require('./dimensions');


function json(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function physicalRoute(destination) {
  if (typeof destination !== 'string' || !destination.startsWith('/') || destination.startsWith('//') || destination.includes('\\')) return null;
  try { return new URL(destination, 'https://rtg.invalid').pathname; } catch (_) { return null; }
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}
function sourceHash(root, contract, signatures) {
  return sha(fingerprint(root) + JSON.stringify(stable(contract)) + JSON.stringify(stable(signatures)));
}

function build(root, options = {}) {
  const contract = options.contract || json(path.join(root,'experience-architecture/coverage-contract.json'));
  const signatures = options.signatures || json(path.join(root,'experience-architecture/signatures.json'));
  const evidence = options.evidence || {version:1,records:[]};
  const apps = options.apps || appInventory(root);
  const screens = options.screens || screenInventory(root);
  const source = options.sourceHash || sourceHash(root,contract,signatures);
  const candidate = options.commit || null;
  const screenByRoute = new Map(screens.map(screen => [screen.route,screen]));
  const logicalApps = apps.map(app => {
    const signature = signatureFor(signatures,'app',app);
    // Het document is fysiek één scherm; query en fragment blijven hieronder
    // onverkort in destination/entry en dus in het afzonderlijke appcontract.
    const screen = screenByRoute.get(physicalRoute(app.destination));
    return {...app,screenIds:screen ? [screen.id] : [],signature,
      scope:{profile:'interface',states:'coverage-contract#states + signature.additionalStates',devices:'coverage-contract#devices + signature.additionalDevices'},
      dimensions:dimensionRows(root,contract,'interface',app,'app',signature,evidence,source,candidate)};
  });
  const appIdsByRoute = new Map();
  for (const app of logicalApps) for (const screenId of app.screenIds) {
    const list = appIdsByRoute.get(screenId) || []; list.push(app.id); appIdsByRoute.set(screenId,list);
  }
  const screenRows = screens.map(screen => {
    const signature = signatureFor(signatures,'screen',screen);
    return {...screen,logicalAppIds:appIdsByRoute.get(screen.id) || [],signature,
      scope:{profile:screen.profile,states:'coverage-contract#states + signature.additionalStates',devices:'coverage-contract#devices + signature.additionalDevices'},
      dimensions:dimensionRows(root,contract,screen.profile,screen,'screen',signature,evidence,source,candidate)};
  });
  const all = logicalApps.concat(screenRows);
  const applicable = all.flatMap(subject => subject.dimensions.filter(d => d.applicable));
  const proven = applicable.filter(d => d.status === 'PROVEN').length;
  const completeApps = logicalApps.filter(row => row.signature.status === 'DECLARED' && row.dimensions.filter(d=>d.applicable).every(d=>d.status==='PROVEN')).length;
  const completeScreens = screenRows.filter(row => row.signature.status === 'DECLARED' && row.dimensions.filter(d=>d.applicable).every(d=>d.status==='PROVEN')).length;
  const qualificationGates = (contract.release.requiredQualificationGates || []).map(gate => ({
    id:gate.id,label:gate.label,status:'NOT_TESTED',requires:gate.requires
  }));
  const qualificationComplete = qualificationGates.length > 0 && qualificationGates.every(gate => gate.status === 'PROVEN');
  return {
    schemaVersion:1,
    generatedFrom:['MAPPEN','public/apps/**/*.html','experience-architecture/coverage-contract.json','experience-architecture/signatures.json'],
    sourceHash:source,
    candidateCommit:candidate,
    status:completeApps === logicalApps.length && completeScreens === screenRows.length && qualificationComplete ? 'PROVEN' : 'NOT_TESTED',
    summary:{logicalApps:{proven:completeApps,total:logicalApps.length},screens:{proven:completeScreens,total:screenRows.length},dimensions:{proven,total:applicable.length}},
    releaseReadiness:{status:qualificationComplete?'PROVEN':'NOT_TESTED',qualificationGates,experienceBudgets:contract.release.experienceBudgets},
    logicalApps,
    screens:screenRows
  };
}

function validate(root, report, contract, signatures) {
  const errors = [];
  const appIds = new Set(report.logicalApps.map(row => row.id));
  const routes = new Set(report.screens.map(row => row.route));
  if (appIds.size !== report.logicalApps.length) errors.push('DUPLICATE_APP');
  if (routes.size !== report.screens.length) errors.push('DUPLICATE_SCREEN');
  if (report.logicalApps.length < contract.inventoryBaselines.logicalApps) errors.push('APP_INVENTORY_BELOW_BASELINE:' + report.logicalApps.length);
  if (report.screens.length < contract.inventoryBaselines.screens) errors.push('SCREEN_INVENTORY_BELOW_BASELINE:' + report.screens.length);
  const gates = contract.release.requiredQualificationGates || [];
  if (gates.length !== 8 || new Set(gates.map(gate=>gate.id)).size !== gates.length) errors.push('INVALID_QUALIFICATION_GATES');
  for (const gate of gates) if (!gate.id || !gate.label || !gate.requires) errors.push('INCOMPLETE_QUALIFICATION_GATE:' + (gate.id || 'unknown'));
  const budgets = contract.release.experienceBudgets || {};
  for (const key of ['lcpP75MsMax','inpP75MsMax','clsP75Max','interactiveTargetPxMin','unexplainedVisualRegressionsMax','humanCriticalFindingsMax']) {
    if (!Number.isFinite(budgets[key])) errors.push('MISSING_EXPERIENCE_BUDGET:' + key);
  }
  for (const row of report.logicalApps) if (!row.screenIds.length) errors.push('APP_WITHOUT_SCREEN:' + row.id);
  for (const row of report.screens) if (!row.owner || !row.owner.rol || (!row.owner.capability && !(row.owner.rol === 'alias' && row.owner.naar))) errors.push('SCREEN_WITHOUT_OWNER:' + row.id);
  for (const key of Object.keys(signatures.apps || {})) if (!appIds.has(key)) errors.push('UNKNOWN_APP_SIGNATURE:' + key);
  for (const key of Object.keys(signatures.screens || {})) if (!routes.has(key)) errors.push('UNKNOWN_SCREEN_SIGNATURE:' + key);
  for (const subject of report.logicalApps.concat(report.screens)) for (const dimension of subject.dimensions) {
    if (dimension.applicable && !dimension.requirementCount) errors.push('EMPTY_REQUIREMENTS:' + subject.id + ':' + dimension.id);
    if (!dimension.applicable && contract.release.notApplicableRequiresDecisionAndReason && (!dimension.decision || !dimension.reason)) errors.push('UNJUSTIFIED_NOT_APPLICABLE:' + subject.id + ':' + dimension.id);
  }
  return errors;
}

function registryView(report) {
  const compact = subject => {
    const dimensions = {};
    for (const row of subject.dimensions) dimensions[row.id] = row.applicable
      ? {status:row.status,required:row.requirementCount,proven:row.provenCount,...(row.reason?{reason:row.reason}:{}),
        ...(row.configurationCoverage?{configurationCoverage:row.configurationCoverage}:{})}
      : {status:row.status,decision:row.decision,reason:row.reason};
    const {dimensions:ignored,...base} = subject;
    return {...base,dimensions};
  };
  return {...report,logicalApps:report.logicalApps.map(compact),screens:report.screens.map(compact)};
}

function serializeRegistry(report) {
  const value = stable(registryView(report));
  const entries = Object.entries(value);
  const lines = ['{'];
  entries.forEach(([key,item],index) => {
    const comma = index === entries.length-1 ? '' : ',';
    if (!Array.isArray(item)) lines.push(' ' + JSON.stringify(key) + ': ' + JSON.stringify(item) + comma);
    else {
      lines.push(' ' + JSON.stringify(key) + ': [');
      item.forEach((row,rowIndex) => lines.push('  ' + JSON.stringify(row) + (rowIndex===item.length-1?'':',')));
      lines.push(' ]' + comma);
    }
  });
  lines.push('}');
  return lines.join('\n') + '\n';
}

module.exports = {build,validate,registryView,serializeRegistry,appInventory,interactionInventory,screenInventory,requirements,evidenceStatus,sourceHash,DIMENSION_ORDER,stable,sha};
