/* Bewijs is gebonden aan broninhoud, proef, tijd en een werkelijk testproces. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {exactStempel} = require('../stempel');
const SOURCE_PATHS = ['server','public','experience','experience-architecture','scripts','test','.github/workflows',
  'package.json','package-lock.json','.nvmrc','.node-version','Dockerfile','index.html','SCHERMEIGENAAR.json','APPWERKT.json'];
const SOURCE_DIRECTORIES = new Set(['server','public','experience','experience-architecture','scripts','test','.github/workflows']);
// Gegenereerde runtime-uitvoer is geen Experience-bron. public/dist wordt per
// platform opnieuw gebouwd en mag de bronvingerafdruk daarom niet laten
// verschillen tussen een schone ontwikkelboom en GitHub Actions.
const GENERATED_PATHS = new Set(['public/dist','server/data','server/uploads']);
function candidate(root) {
  const stamp = exactStempel({}, {wortel:root});
  if (!stamp.commit || stamp.boomVuil !== false) return {ok:false,reason:'Kandidaat heeft ongecommitte code of onbekende Git-toestand',commit:stamp.commit};
  try {
    // De bestaande stempel dekt code. Experience-contracten en gebruikte
    // inventaris zijn hier eveneens invoer; outputs blijven erbuiten.
    const dirty = execFileSync('git',['status','--porcelain','--untracked-files=all','--',...SOURCE_PATHS],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']});
    if (dirty.trim()) return {ok:false,reason:'Experience-kandidaatinvoer is niet schoon',commit:stamp.commit};
    return {ok:true,commit:stamp.commit};
  } catch (_) { return {ok:false,reason:'Experience-kandidaat kon niet worden gecontroleerd',commit:null}; }
}
function untrackedInputs(root) {
  try {
    const status = execFileSync('git',['status','--porcelain=v1','-z','--untracked-files=all','--',...SOURCE_PATHS],
      {cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']});
    return status.split('\0').filter(Boolean).filter(line => line.startsWith('?? ')).map(line => line.slice(3));
  } catch (_) {
    throw new Error('Experience-broninvoer kon niet tegen Git worden gecontroleerd');
  }
}
function fingerprint(root) {
  const hash = crypto.createHash('sha256');
  function add(name) {
    const file = path.join(root,name);
    /* Een ontbrekende bronMAP en een lege bronmap zijn dezelfde Git-inhoud:
       geen bestand. Benoemde bronBESTANDEN behouden wel een ontbreekt-marker,
       zodat bijvoorbeeld een verwijderd package.json de hash verandert. */
    if (!fs.existsSync(file)) {
      if (!SOURCE_DIRECTORIES.has(name)) { hash.update(name); hash.update('\0MISSING\0'); }
      return;
    }
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error('Onbekende Experience-bronafhankelijkheid: ' + name);
    if (stat.isDirectory()) {
      /* Git bewaart geen lege mappen. Een lokale runtime kan ze wel achterlaten
         (bijvoorbeeld server/opzet/data/theater), waardoor dezelfde commit op
         een schone CI-export vroeger een andere hash kreeg. Alleen bestanden
         dragen Experience-inhoud; hun volledige relatieve pad blijft hieronder
         onderdeel van de hash. */
      for (const child of fs.readdirSync(file).sort()) {
        if (['node_modules','.git'].includes(child) || GENERATED_PATHS.has(name+'/'+child)) continue;
        add(name+'/'+child);
      }
    } else if (stat.isFile()) {
      hash.update(name); hash.update('\0FILE\0'); hash.update(fs.readFileSync(file)); hash.update('\0');
    }
    else throw new Error('Onleesbare Experience-bron: ' + name);
  }
  // Geen extensiefilter: fotografie, SVG, fonts en manifesten bepalen de ervaring.
  // Gegenereerde bewijsregisters/artifacts zijn geen invoer van hun eigen hash.
  for (const name of SOURCE_PATHS) add(name);
  return hash.digest('hex');
}
function outcome(code, tap) {
  const number = name => Number((tap.match(new RegExp('^# '+name+' (\\d+)$','m'))||[])[1]);
  return code === 0 && number('tests') > 0 && number('pass') === number('tests') &&
    number('fail') === 0 && number('cancelled') === 0 && number('skipped') === 0 && number('todo') === 0;
}
function state(record, sourceHash, test, now = Date.now(), candidate) {
  if (!record) return 'NOT_TESTED';
  if (record.worktreeDirty !== false) return 'BLOCKED';
  if (record.version !== 1 || record.test !== test || !Number.isFinite(Date.parse(record.at)) ||
      Date.parse(record.at) > now) return 'BLOCKED';
  if (record.sourceHash !== sourceHash || now-Date.parse(record.at)>86400000) return 'STALE';
  if (candidate && record.commit !== candidate) return 'STALE';
  if (record.sourceChanged) return 'STALE';
  if (!record.logHash || !record.tests || record.skipped !== 0) return 'BLOCKED';
  return record.passed === true && record.exitCode === 0 ? 'PROVEN' : 'FAILED';
}
function sha(text) { return crypto.createHash('sha256').update(text).digest('hex'); }
module.exports = {fingerprint,outcome,state,sha,candidate,untrackedInputs,SOURCE_PATHS};
