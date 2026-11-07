/* Afgeleide configuratieverplichtingen binnen de bestaande Experience-lezer.
   Een passende configuratie is geen waarneming of procesontvangstbewijs. */
'use strict';
const {stable,same} = require('./artifact');
const {sha} = require('./evidence');
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const own = (value,key) => Object.prototype.hasOwnProperty.call(value,key);
const key = value => JSON.stringify([value.state,value.device,value.network]);
const hash = configuration => sha(JSON.stringify(stable(configuration)));
const configurationFields=['browser','browserVersion','device','deviceScaleFactor','locale','network','reducedMotion','serviceWorkers','state','touch','viewport'];
function immutable(value) {
  if (value && typeof value==='object') { for (const child of Object.values(value)) immutable(child); Object.freeze(value); }
  return value;
}
function names(value,field,errors,optional=false) {
  if (optional && value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push('INVALID_CONFIGURATION_AXIS:'+field); return [];
  }
  const valid=value.filter(name=>typeof name==='string' && /^[a-z][a-z0-9-]*$/.test(name));
  if ((!optional && !value.length) || valid.length!==value.length) errors.push('INVALID_CONFIGURATION_AXIS:'+field);
  return [...new Set(valid)];
}
function deviceValid(value) {
  return object(value) && same(Object.keys(value).sort(),['browser','deviceScaleFactor','touch','viewport']) &&
    ['chromium','firefox','webkit'].includes(value.browser) && object(value.viewport) &&
    same(Object.keys(value.viewport).sort(),['height','width']) &&
    ['width','height'].every(k=>Number.isInteger(value.viewport[k]) && value.viewport[k]>0) &&
    Number.isFinite(value.deviceScaleFactor) && value.deviceScaleFactor>0 && typeof value.touch === 'boolean';
}
function required(contract,signature,dimension,requirement) {
  if (dimension !== 'continuity' || requirement !== 'destination') return null;
  const errors=[],value=signature?.value || {},policy=contract.configurationCoverage?.['continuity:destination'];
  // Geen normal-default of producentenfilter: ook een kapotte policy mag de
  // bekende noemer niet verkleinen. De fout blokkeert iedere afsluiting.
  const states=[...new Set(names(contract.states,'states',errors).concat(names(value.additionalStates,'additionalStates',errors,true)))];
  const devices=[...new Set(names(contract.devices,'devices',errors).concat(names(value.additionalDevices,'additionalDevices',errors,true)))];
  const networks=names(contract.networks,'networks',errors);
  if (!object(policy) || policy.version!==1 || ['states','devices','networks'].some(axis=>policy[axis]!=='all')) errors.push('CONFIGURATION_POLICY_UNDEFINED');
  const profiles=object(policy?.deviceConfigurations) ? policy.deviceConfigurations : {};
  if (!object(policy?.deviceConfigurations)) errors.push('DEVICE_CONFIGURATIONS_UNDEFINED');
  const configured={},viewports=new Map();
  for (const device of devices) {
    if (!own(profiles,device) || !deviceValid(profiles[device])) { errors.push('DEVICE_CONFIGURATION_UNDEFINED:'+device); continue; }
    const profile=profiles[device],viewport=JSON.stringify(stable(profile.viewport));
    if (viewports.has(viewport)) errors.push('DEVICE_VIEWPORT_ALIAS:'+viewports.get(viewport)+':'+device);
    else viewports.set(viewport,device);
    configured[device]=structuredClone(profile);
  }
  const cells=states.flatMap(state=>devices.flatMap(device=>networks.map(network=>({state,device,network}))));
  if (!cells.length) errors.push('CONFIGURATION_MATRIX_EMPTY');
  return immutable({version:1,dimension,requirement,states,devices,networks,cells,deviceConfigurations:configured,
    status:errors.length?'BLOCKED':'NOT_TESTED',blockers:[...new Set(errors)]});
}
function match(plan,configuration) {
  if (!plan || plan.status==='BLOCKED') return {status:'BLOCKED',reason:'CONFIGURATION_PLAN_BLOCKED'};
  if (!object(configuration)) return {status:'BLOCKED',reason:'CONFIGURATION_MISSING'};
  for (const [field,axis] of [['state','states'],['device','devices'],['network','networks']]) {
    if (!plan[axis].includes(configuration[field])) return {status:'BLOCKED',reason:'UNKNOWN_CONFIGURATION_'+field.toUpperCase()};
  }
  const fields=own(configuration,'persona')?configurationFields.concat('persona').sort():configurationFields;
  if (!same(Object.keys(configuration).sort(),fields) ||
    (own(configuration,'persona') && (typeof configuration.persona!=='string' || !configuration.persona.trim())) ||
    typeof configuration.browserVersion!=='string' || !/^\d+(\.\d+)+$/.test(configuration.browserVersion) ||
    typeof configuration.locale!=='string' || !configuration.locale.trim() ||
    typeof configuration.reducedMotion!=='boolean' || !['allow','block'].includes(configuration.serviceWorkers)) {
    return {status:'BLOCKED',reason:'CONFIGURATION_SHAPE_INVALID'};
  }
  const profile=plan.deviceConfigurations[configuration.device];
  if (!profile || Object.keys(profile).some(field=>!same(profile[field],configuration[field]))) return {status:'BLOCKED',reason:'DEVICE_CONFIGURATION_MISMATCH'};
  return {status:'NOT_TESTED',cell:key(configuration),configurationHash:hash(configuration),reason:'EXECUTION_MATRIX_BINDING_MISSING'};
}
function inspect(plan,configurations=[]) {
  if (!plan) return null;
  const blockers=plan.blockers.slice(),mapped=new Map();
  if (!Array.isArray(configurations)) blockers.push('CONFIGURATIONS_INVALID');
  else for (const configuration of configurations) {
    const result=match(plan,configuration);
    if (result.status==='BLOCKED') { blockers.push(result.reason); continue; }
    if (mapped.has(result.cell)) blockers.push((mapped.get(result.cell)===result.configurationHash?'DUPLICATE':'CONFLICTING')+'_CONFIGURATION_CELL:'+result.cell);
    else mapped.set(result.cell,result.configurationHash);
  }
  const missing=plan.cells.filter(cell=>!mapped.has(key(cell)));
  // Zelfs volledige configuratiemetadata is NOT_TESTED: deze functie heeft
  // geen artefacten, echte state-observaties of live executor-receipts gezien.
  return {version:1,requirement:plan.requirement,status:blockers.length?'BLOCKED':'NOT_TESTED',
    requiredCellCount:plan.cells.length,mappedCellCount:mapped.size,missingCellCount:missing.length,
    blockers:[...new Set(blockers)],reason:blockers.length?'CONFIGURATION_PLAN_BLOCKED':missing.length?'CONFIGURATION_CELLS_MISSING':'EXECUTION_MATRIX_BINDING_MISSING'};
}
module.exports = {required,match,inspect};
