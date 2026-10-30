/* Ontvangstcontrole van bestaande Experience-artefacten, geen bewijsgenerator.
   Een lokaal bestand is geen ondertekende productie-attestatie. */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const {sha,outcome} = require('./evidence');
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])) : value;
const same = (a,b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
// Een producer gebruikt t.diagnostic('RTG_EXPERIENCE_OBSERVATION ' + JSON.stringify(...)).
// Dit bindt het proceslog aan zijn waarneming; lokale bytes zijn geen attestatie.
const observationKeys = ['version','instrument','subjectType','subjectId','dimension','requirement',
  'sourceHash','commit','configurationHash','method','checks','result'];
const observation = artifact => Object.fromEntries(observationKeys.map(key=>[key,artifact[key]]));
function read(root, name, expectedHash) {
  if (typeof name !== 'string' || !name || path.isAbsolute(name) || !/^[a-f0-9]{64}$/.test(expectedHash || '')) throw new Error('Ongeldige artefactverwijzing');
  const base = fs.realpathSync(root), file = fs.realpathSync(path.resolve(base,name));
  if (!file.startsWith(base+path.sep) || !fs.statSync(file).isFile()) throw new Error('Artefact buiten bewijsbron');
  const bytes = fs.readFileSync(file);
  if (sha(bytes) !== expectedHash) throw new Error('Artefactinhoud gewijzigd');
  return bytes.toString('utf8');
}
function integrity(record, source, candidate, dimension, context = {}) {
  if (!record) return 'NOT_TESTED';
  if (record.worktreeDirty !== false) return 'BLOCKED';
  if (!['PROVEN','FAILED','BLOCKED'].includes(record.status)) return 'BLOCKED';
  if (record.sourceHash !== source || !candidate || record.commit !== candidate) return 'STALE';
  // Een zelf ingevuld reviewer.type is geen menselijke bevestigingsbron.
  // Koppeling aan de bestaande gezaghebbende reviewvoorziening staat nog open.
  if (dimension === 'human-quality') return 'BLOCKED';
  if (!context.root || !context.subjectId || !context.subjectType || !context.requirement || !context.configurationHash) return 'BLOCKED';
  try {
    const artifact = JSON.parse(read(context.root,record.artifact,record.artifactHash));
    if (artifact.worktreeDirty !== false) return 'BLOCKED';
    for (const [key,value] of Object.entries({version:1,subjectType:context.subjectType,subjectId:context.subjectId,
      dimension,requirement:context.requirement,sourceHash:source,commit:candidate,
      configurationHash:record.configurationHash,method:record.method})) {
      if (value === undefined || artifact[key] !== value || (key !== 'version' && record[key] !== value)) return 'BLOCKED';
    }
    if (!['browser','visual','performance','accessibility','contract'].includes(artifact.method)) return 'BLOCKED';
    if (!artifact.configuration || typeof artifact.configuration !== 'object' || Array.isArray(artifact.configuration) ||
      !Object.keys(artifact.configuration).length || sha(JSON.stringify(stable(artifact.configuration))) !== artifact.configurationHash) return 'BLOCKED';
    if (context.configurationHash && artifact.configurationHash !== context.configurationHash) return 'BLOCKED';
    const at = Date.parse(artifact.at), now = context.now ?? Date.now();
    if (!Number.isFinite(at) || at > now) return 'BLOCKED';
    if (now-at > 86400000) return 'STALE';
    if (typeof artifact.instrument !== 'string' || !/^test\/[\w./-]+\.js$/.test(artifact.instrument) ||
      artifact.instrument.split('/').includes('..') || !fs.statSync(path.join(context.root,artifact.instrument)).isFile()) return 'BLOCKED';
    if (!Array.isArray(artifact.checks) || !artifact.checks.length || artifact.checks.some(check =>
      !check || typeof check.id !== 'string' || !check.id || check.passed !== true ||
      check.observed === undefined || check.expected === undefined)) return 'BLOCKED';
    const log = read(context.root,artifact.log?.path,artifact.log?.sha256);
    if (!outcome(artifact.log.exitCode,log) || artifact.result !== 'passed') return 'FAILED';
    const passedChecks = new Set(log.split(/\r?\n/).map(line => /^\s*ok \d+ - (.+)$/.exec(line)?.[1]));
    if (artifact.checks.some(check => !passedChecks.has(check.id))) return 'BLOCKED';
    const observations = log.split(/\r?\n/).filter(line=>/^\s*# RTG_EXPERIENCE_OBSERVATION(?: |$)/.test(line))
      .map(line=>JSON.parse(line.replace(/^\s*# RTG_EXPERIENCE_OBSERVATION\s*/,'')));
    const relevant = observations.filter(value => value && value.subjectType === artifact.subjectType &&
      value.subjectId === artifact.subjectId && value.dimension === artifact.dimension && value.requirement === artifact.requirement);
    if (relevant.length !== 1 || !same(relevant[0],observation(artifact))) return 'BLOCKED';
    return record.status === 'PROVEN' ? 'VALID' : record.status;
  } catch (_) { return 'BLOCKED'; }
}
function assessment(...args) {
  const result = integrity(...args);
  if (result === 'VALID') return {status:'BLOCKED',integrity:'VALID',reason:'AUTHORITATIVE_EXECUTION_AND_TYPED_REQUIREMENT_BINDING_MISSING'};
  return {status:result,integrity:result,reason:args[3] === 'human-quality' ? 'AUTHORITATIVE_HUMAN_CONFIRMATION_MISSING' : 'ARTIFACT_NOT_QUALIFIED'};
}
const status = (...args) => assessment(...args).status;
module.exports = {status,assessment,integrity,stable,same};
