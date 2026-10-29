'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const identity = require('../../../public/shared/rtg-world-identity');
const {files} = require('./compiler');
const {MAPPEN} = require('../wereldregister');
const {rijen, meetIngang} = require('../../appwerkt');

const DIMENSION_ORDER = ['identity','composition','continuity','restraint','adaptability','accessibility','fluidity','human-quality'];

function json(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function sha(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function routeFor(file, root) { return '/' + path.relative(path.join(root, 'public'), file).replace(/\\/g, '/'); }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}
function sourceHash(root, contract, signatures) {
  const hash = crypto.createHash('sha256');
  const names = [
    'public/shared/rtg-world-identity.js',
    'SCHERMEIGENAAR.json',
    'APPWERKT.json',
    'scripts/lib/wereldregister.js',
    'scripts/lib/appcontract.js',
    'scripts/appwerkt.js',
    'scripts/lib/experience/coverage.js',
    'scripts/experience-coverage.js',
    'experience-architecture/coverage-contract.json',
    'experience-architecture/signatures.json'
  ];
  for (const name of names) { hash.update(name); hash.update('\0'); hash.update(fs.readFileSync(path.join(root,name))); hash.update('\0'); }
  for (const file of files(path.join(root,'public/apps')).filter(f => f.endsWith('.html'))) {
    hash.update(path.relative(root,file)); hash.update('\0'); hash.update(fs.readFileSync(file)); hash.update('\0');
  }
  hash.update(JSON.stringify(stable(contract))); hash.update(JSON.stringify(stable(signatures)));
  return hash.digest('hex');
}

function appInventory(root = path.join(__dirname,'..','..','..')) {
  const rows = rijen();
  const measured = json(path.join(root,'APPWERKT.json')).regels || [];
  return rows.map(row => {
    const map = MAPPEN.find(entry => entry.naam === row.wereld && entry.items.includes(row.functie));
    const destination = meetIngang(row);
    const observation = measured.find(item => item.functie === row.functie && item.wereld === row.wereld);
    return {
      id: 'app:' + (map ? map.sleutel : 'unknown') + ':' + row.functie,
      function: row.functie,
      name: row.app,
      world: row.wereld,
      persona: row.persona,
      destination: destination ? destination.bestemming : null,
      entry: destination ? destination.pad : null,
      interactionInventory: observation ? {
        source:'APPWERKT.json',
        found:observation.gevonden,
        touched:(observation.aangeraakt || []).slice(),
        untouched:(observation.onaangeraakt || []).slice()
      } : null
    };
  }).sort((a,b) => a.id.localeCompare(b.id));
}

function screenInventory(root) {
  const owners = json(path.join(root,'SCHERMEIGENAAR.json')).schermen;
  return files(path.join(root,'public/apps')).filter(file => file.endsWith('.html')).map(file => {
    const route = routeFor(file, root);
    const world = identity.classify(route);
    const owner = owners[route.replace(/^\//,'')] || null;
    return {id:'screen:' + route, route, world, profile:world === 'redirect' ? 'redirect' : 'interface',owner};
  }).sort((a,b) => a.route.localeCompare(b.route));
}

function signatureErrors(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['signature is geen object'];
  const required = ['identity','purpose','composition','motion','interactionDensity','interactions','humanTasks'];
  const errors = required.filter(key => value[key] === undefined).map(key => 'mist ' + key);
  for (const key of ['identity','purpose','composition','motion']) if (value[key] !== undefined && (typeof value[key] !== 'string' || !value[key].trim())) errors.push(key + ' is leeg');
  if (value.interactionDensity !== undefined && !['quiet','balanced','dense'].includes(value.interactionDensity)) errors.push('interactionDensity is ongeldig');
  if (value.interactions !== undefined && (!Array.isArray(value.interactions) || value.interactions.some(action=>!action || typeof action.id!=='string' || !action.id.trim() || typeof action.label!=='string' || !action.label.trim()))) errors.push('interactions is ongeldig');
  if (Array.isArray(value.interactions) && new Set(value.interactions.map(action=>action&&action.id)).size !== value.interactions.length) errors.push('interactions bevat dubbele ids');
  if (Array.isArray(value.interactions) && !value.interactions.length && (!value.noInteractions || !value.noInteractions.decision || !value.noInteractions.reason)) errors.push('lege interactions mist gemotiveerd noInteractions-besluit');
  if (value.humanTasks !== undefined && (!Array.isArray(value.humanTasks) || !value.humanTasks.length || value.humanTasks.some(task=>typeof task!=='string'||!task.trim()))) errors.push('humanTasks is leeg of ongeldig');
  for (const key of ['additionalStates','additionalDevices']) if (value[key] !== undefined && (!Array.isArray(value[key]) || value[key].some(item=>typeof item!=='string'||!item.trim()))) errors.push(key + ' is ongeldig');
  return errors;
}

function signatureFor(signatures, kind, subject) {
  const source = kind === 'app' ? signatures.apps : signatures.screens;
  const key = kind === 'app' ? subject.id : subject.route;
  const declared = source && source[key];
  if (!declared) return {status:'NOT_TESTED',source:null,reason:'Experience Signature ontbreekt'};
  const errors = signatureErrors(declared);
  if (kind === 'app' && subject.interactionInventory) {
    const actions = declared.interactions || [];
    const labels = new Set(actions.map(action=>action.label));
    const missing = subject.interactionInventory.touched.filter(label=>!labels.has(label));
    if (actions.length < subject.interactionInventory.found) errors.push('signature bevat minder interacties dan APPWERKT vond');
    if (missing.length) errors.push('signature mist APPWERKT-interacties: ' + missing.join(', '));
    if (subject.interactionInventory.untouched.length) errors.push('APPWERKT heeft nog onaangeraakte interacties');
  }
  if (errors.length) return {status:'BLOCKED',source:'experience-architecture/signatures.json',reason:errors.join('; '),value:declared};
  return {status:'DECLARED',source:'experience-architecture/signatures.json',value:declared};
}

function requirements(contract, profile, dimension, signature) {
  /* Een signature mag de grondwet uitbreiden, nooit de noemer verkleinen. */
  const states = [...new Set(contract.states.concat(signature?.value?.additionalStates || []))];
  const devices = [...new Set(contract.devices.concat(signature?.value?.additionalDevices || []))];
  const interactions = (signature?.value?.interactions || []).map(action => action.id);
  if (dimension === 'identity') return ['signature'];
  if (dimension === 'composition' || dimension === 'restraint') return states.flatMap(state => devices.map(device => state + '@' + device)).concat(interactions.map(id=>'interaction:'+id));
  if (dimension === 'continuity') return contract.continuityChecks.slice().concat(interactions.map(id=>'interaction:'+id));
  if (dimension === 'adaptability') return devices.flatMap(device => contract.networks.map(network => device + '@' + network));
  if (dimension === 'accessibility') return devices.flatMap(device => contract.accessibilityChecks.map(check => device + '@' + check)).concat(interactions.map(id=>'interaction:'+id));
  if (dimension === 'fluidity') return devices.flatMap(device => contract.fluidityChecks.map(check => device + '@' + check)).concat(interactions.map(id=>'interaction:'+id));
  if (dimension === 'human-quality') {
    const tasks = signature?.value?.humanTasks || [];
    return (tasks.length ? tasks.flatMap((task,index)=>['task:'+index+'@mobile','task:'+index+'@desktop']) : ['signature:human-task@mobile','signature:human-task@desktop']).concat(interactions.map(id=>'interaction:'+id));
  }
  return [];
}

function evidenceStatus(record, source, candidate, dimension) {
  if (!record) return 'NOT_TESTED';
  if (!['PROVEN','FAILED','BLOCKED'].includes(record.status)) return 'BLOCKED';
  if (record.sourceHash !== source || !record.commit || record.commit !== candidate) return 'STALE';
  if (!record.configurationHash || !record.artifact || !record.method) return 'BLOCKED';
  if (dimension === 'human-quality') {
    if (record.method !== 'human-user-test' || record.reviewer?.type !== 'human' || !record.reviewer.id) return 'BLOCKED';
  }
  return record.status;
}

function dimensionRows(contract, profileName, subject, kind, signature, evidence, source, candidate) {
  const profile = contract.profiles[profileName];
  return DIMENSION_ORDER.map(dimension => {
    if (!profile.dimensions.includes(dimension)) {
      const decision = profile.notApplicable && profile.notApplicable[dimension];
      return {id:dimension,applicable:false,status:'NOT_APPLICABLE',decision:decision?.decision || null,reason:decision?.reason || null,requirementCount:0,provenCount:0};
    }
    const required = requirements(contract, profileName, dimension, signature);
    const records = required.map(requirement => {
      const record = (evidence.records || []).find(item => item.subjectType === kind && item.subjectId === subject.id && item.dimension === dimension && item.requirement === requirement);
      return {requirement,status:evidenceStatus(record,source,candidate,dimension)};
    });
    const statuses = new Set(records.map(row => row.status));
    let status = 'PROVEN';
    for (const value of ['FAILED','BLOCKED','STALE','NOT_TESTED']) if (statuses.has(value)) { status = value; break; }
    if (signature.status !== 'DECLARED') status = signature.status === 'BLOCKED' ? 'BLOCKED' : 'NOT_TESTED';
    return {id:dimension,applicable:true,status,requirementCount:records.length,provenCount:records.filter(row=>row.status==='PROVEN').length};
  });
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
    return {...app,screenIds:screenByRoute.has(app.destination) ? [screenByRoute.get(app.destination).id] : [],signature,
      scope:{profile:'interface',states:'coverage-contract#states + signature.additionalStates',devices:'coverage-contract#devices + signature.additionalDevices'},
      dimensions:dimensionRows(contract,'interface',app,'app',signature,evidence,source,candidate)};
  });
  const appIdsByRoute = new Map();
  for (const app of logicalApps) for (const screenId of app.screenIds) {
    const list = appIdsByRoute.get(screenId) || []; list.push(app.id); appIdsByRoute.set(screenId,list);
  }
  const screenRows = screens.map(screen => {
    const signature = signatureFor(signatures,'screen',screen);
    return {...screen,logicalAppIds:appIdsByRoute.get(screen.id) || [],signature,
      scope:{profile:screen.profile,states:'coverage-contract#states + signature.additionalStates',devices:'coverage-contract#devices + signature.additionalDevices'},
      dimensions:dimensionRows(contract,screen.profile,screen,'screen',signature,evidence,source,candidate)};
  });
  const all = logicalApps.concat(screenRows);
  const applicable = all.flatMap(subject => subject.dimensions.filter(d => d.applicable));
  const proven = applicable.filter(d => d.status === 'PROVEN').length;
  const completeApps = logicalApps.filter(row => row.signature.status === 'DECLARED' && row.dimensions.filter(d=>d.applicable).every(d=>d.status==='PROVEN')).length;
  const completeScreens = screenRows.filter(row => row.signature.status === 'DECLARED' && row.dimensions.filter(d=>d.applicable).every(d=>d.status==='PROVEN')).length;
  return {
    schemaVersion:1,
    generatedFrom:['MAPPEN','public/apps/**/*.html','experience-architecture/coverage-contract.json','experience-architecture/signatures.json'],
    sourceHash:source,
    candidateCommit:candidate,
    status:completeApps === logicalApps.length && completeScreens === screenRows.length ? 'PROVEN' : 'NOT_TESTED',
    summary:{logicalApps:{proven:completeApps,total:logicalApps.length},screens:{proven:completeScreens,total:screenRows.length},dimensions:{proven,total:applicable.length}},
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
      ? {status:row.status,required:row.requirementCount,proven:row.provenCount}
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

module.exports = {build,validate,registryView,serializeRegistry,appInventory,screenInventory,requirements,evidenceStatus,sourceHash,DIMENSION_ORDER,stable,sha};
