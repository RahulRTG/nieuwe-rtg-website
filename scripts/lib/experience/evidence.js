/* Bewijs is gebonden aan broninhoud, proef, tijd en een werkelijk testproces. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {files} = require('./compiler');
function fingerprint(root) {
  const hash = crypto.createHash('sha256');
  for (const folder of ['server','public','experience','scripts','test','.github/workflows']) {
    for (const f of files(path.join(root,folder))) {
      if (/\/(?:data|dist|node_modules)\//.test(f)) continue;
      hash.update(path.relative(root,f)); hash.update('\0'); hash.update(fs.readFileSync(f)); hash.update('\0');
    }
  }
  for (const name of ['package.json','package-lock.json']) hash.update(fs.readFileSync(path.join(root,name)));
  return hash.digest('hex');
}
function outcome(code, tap) {
  const number = name => Number((tap.match(new RegExp('^# '+name+' (\\d+)$','m'))||[])[1]);
  return code === 0 && number('tests') > 0 && number('pass') === number('tests') &&
    number('fail') === 0 && number('cancelled') === 0 && number('skipped') === 0 && number('todo') === 0;
}
function state(record, sourceHash, test, now = Date.now()) {
  if (!record) return 'NOT_TESTED';
  if (record.version !== 1 || record.test !== test || !Number.isFinite(Date.parse(record.at)) ||
      Date.parse(record.at) > now) return 'BLOCKED';
  if (record.sourceHash !== sourceHash || now-Date.parse(record.at)>86400000) return 'STALE';
  if (record.sourceChanged) return 'STALE';
  if (!record.logHash || !record.tests || record.skipped !== 0) return 'BLOCKED';
  return record.passed === true && record.exitCode === 0 ? 'PROVEN' : 'FAILED';
}
function sha(text) { return crypto.createHash('sha256').update(text).digest('hex'); }
module.exports = {fingerprint,outcome,state,sha};
