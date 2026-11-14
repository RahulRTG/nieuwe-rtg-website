'use strict';
/* Echte tijdelijke Git-bronnen en de bestaande raakvlakcontrole. De acht
   gelijkvormige meetrecords zijn protocolfixtures, geen RTG-productbewijs. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const cp = require('node:child_process');
const R = require('../scripts/lib/bewijsraakvlak');
const gates = require('../scripts/lib/experience/qualification-gates');
const evidence = require('../scripts/lib/experience/evidence');
const names = require('../scripts/lib/appcontract').BEWIJZEN;
const scope = () => new Set(['link:fixture']);
const grof = () => ({vers:false, reden:'Geen grove terugval in deze fixture'});

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-next-app-binding-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  const git = (...args) => cp.execFileSync('git', args, {cwd:root, encoding:'utf8', stdio:['ignore','pipe','ignore']}).trim();
  const put = (file, data) => {
    fs.mkdirSync(path.dirname(path.join(root,file)), {recursive:true});
    fs.writeFileSync(path.join(root,file), typeof data === 'string' ? data : JSON.stringify(data));
  };
  const commit = message => {
    git('add','-A');
    git('-c','user.name=Protocol fixture','-c','user.email=fixture@example.invalid','commit','-q','-m',message);
    return git('rev-parse','HEAD');
  };
  git('init','-q');
  for (const [file, data] of Object.entries({
    'server/server.js':"require('./middleware/auth');\nrequire('./opzet/routes')(require('./kern/db'));\n",
    'server/middleware/auth.js':'module.exports=(req,res,next)=>next();\n',
    'server/kern/db.js':'module.exports={db:{}};\n',
    'server/opzet/routes.js':"module.exports=kern=>{const grens=()=>kern; require('../routes/a')(grens('a'));};\n",
    'server/routes/a.js':"module.exports=({app})=>app.get('/api/a/lijst',(req,res)=>res.json([]));\n",
    'public/apps/a.html':'<!doctype html><script src="/apps/a.js"></script>\n',
    'public/apps/a.js':"fetch('/api/a/lijst');\n",
    'scripts/instr.js':'module.exports=1;\n',
    'package.json':'{"name":"rtg-next-protocol-fixture","private":true}\n',
    'package-lock.json':'{"name":"rtg-next-protocol-fixture","lockfileVersion":3}\n'
  })) put(file,data);
  const measuredCommit = commit('Meetbare bron A');
  // maakWereld ontdekt standaard de router van de hoofdrepository. Deze proef
  // gebruikt uitsluitend de echte registratie uit haar eigen fixturemodule,
  // zowel bij de meting als bij de latere inspectie; geen RTG-appstart/deps.
  t.mock.method(require('../scripts/lib/routes'), 'alleRoutes', () => {
    const routes = [];
    require(path.join(root,'server/routes/a.js'))({app:{get(pad) {
      routes.push({methode:'GET', pad, bestand:'server/routes/a.js'});
    }}});
    return routes;
  });
  const stamp = {op:new Date().toISOString(), commit:measuredCommit, boomVuil:false,
    instrument:'scripts/instr.js', node:process.version};
  const world = R.maakWereld({wortel:root});
  const measurement = R.versheidVoor(world, {ingang:'/apps/a.html', soort:'browser', kanaal:'browser'}, grof)(stamp);
  assert.equal(measurement.vers,true,measurement.reden);
  assert.ok(measurement.raakvlak && !measurement.raakvlak.onbepaald);
  const hashes = R.hashes(world), paired = R.register(stamp,hashes);
  const register = {stempel:stamp, raakvlak:R.verwijzing(stamp,hashes), regels:[{
    functie:'link:fixture', ingang:'/apps/a.html', status:'BEWEZEN',
    bewijzen:Object.fromEntries(names.map(name=>[name,{status:'BEWEZEN',raakvlak:[structuredClone(measurement.raakvlak)]}]))
  }]};
  const save = () => { put('APPWERKT.json',register); put('APPWERKT-RAAKVLAK.json',paired); };
  save();
  let candidateCommit = commit('Alleen meetpaar B, zonder bronwijziging');
  const result = () => gates.inspectAppProof(root,scope(),candidateCommit);
  const update = mutate => { mutate(); save(); candidateCommit=commit('Protocolwijziging'); return result(); };
  return {root,git,put,commit,register,paired,save,result,update,measuredCommit,
    get candidateCommit() { return candidateCommit; }};
}

test('bewijscommit B mag bron-equivalente meting A dragen zonder fictieve meting op B', t => {
  const f=fixture(t), result=f.result();
  assert.notEqual(f.measuredCommit,f.candidateCommit);
  assert.equal(result.status,'PROVEN',JSON.stringify(result));
  assert.equal(result.measuredCommit,f.measuredCommit);
  assert.equal(result.candidateCommit,f.candidateCommit);
  assert.equal(result.binding,'SCOPED_SOURCE_EQUIVALENCE');
  assert.equal(result.proven,1);
});

test('gewijzigde relevante bron verhindert kandidaatbinding ondanks schoon gecommit meetpaar', t => {
  const f=fixture(t);
  const result=f.update(()=>f.put('public/apps/a.js',"fetch('/api/a/lijst'); window.changed=true;\n"));
  assert.equal(result.status,'NOT_TESTED');
  assert.equal(result.proven,0);
});

test('ontbrekende hash blijft ongeldig zelfs als de paarsamenvatting opnieuw klopt', t => {
  const f=fixture(t);
  const result=f.update(()=>{
    delete f.paired.hashes['public/apps/a.js'];
    Object.assign(f.paired,R.register(f.register.stempel,f.paired.hashes));
    f.register.raakvlak=R.verwijzing(f.register.stempel,f.paired.hashes);
  });
  assert.equal(result.status,'NOT_TESTED');
});

test('verkeerde meetpaarbinding en oude ingebedde hashes worden expliciet geweigerd', t => {
  const f=fixture(t);
  f.paired.stempel={...f.paired.stempel,op:new Date(Date.now()-1000).toISOString()};
  assert.equal(f.update(()=>{}).reason,'APP_PROOF_CANONICAL_PAIR_INVALID');
  assert.equal(f.update(()=>{
    f.paired.stempel=f.register.stempel;
    f.register.raakvlak.hashes=f.paired.hashes;
  }).reason,'APP_PROOF_CANONICAL_PAIR_INVALID');
});

test('onbekende meetcommit en individueel onbekend raakvlak kunnen niet groen worden', t => {
  const f=fixture(t), measured=f.register.stempel.commit;
  assert.equal(f.update(()=>{f.register.stempel.commit='f'.repeat(40);}).reason,'APP_PROOF_CANDIDATE_MISMATCH');
  assert.equal(f.update(()=>{
    f.register.stempel.commit=measured;
    f.register.regels[0].bewijzen[names[0]].raakvlak[0].commit='e'.repeat(40);
  }).status,'NOT_TESTED');
});

test('niet-voorouder met dezelfde broninhoud is geen meetkandidaat', t => {
  const f=fixture(t), tree=f.git('rev-parse',f.measuredCommit+'^{tree}');
  const foreign=cp.execFileSync('git',['-c','user.name=Protocol fixture','-c','user.email=fixture@example.invalid',
    'commit-tree',tree,'-m','Niet-gerelateerde meting'],{cwd:f.root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  assert.equal(f.update(()=>{f.register.stempel.commit=foreign;}).reason,'APP_PROOF_CANDIDATE_MISMATCH');
});

test('GROF en ontbrekend raakvlak blijven ongekwalificeerd bij acht groene statusvelden', t => {
  const f=fixture(t), proof=f.register.regels[0].bewijzen[names[0]];
  assert.equal(f.update(()=>{proof.raakvlak[0].onbepaald='Fixture zonder exacte grens';}).status,'NOT_TESTED');
  assert.equal(f.update(()=>{proof.raakvlak=[];}).status,'NOT_TESTED');
});

test('verkeerde Node-runtime, oude tijd en ongeldige stempel blijven geblokkeerd', t => {
  const f=fixture(t);
  assert.equal(f.update(()=>{f.register.stempel.node='v0.0.0';}).reason,'APP_PROOF_RUNTIME_MISMATCH');
  assert.equal(f.update(()=>{
    f.register.stempel.node=process.version;
    f.register.regels[0].bewijzen[names[0]].raakvlak[0].node='v0.0.0';
  }).status,'NOT_TESTED');
  assert.equal(f.update(()=>{f.register.stempel.op=new Date(Date.now()-86400001).toISOString();}).reason,'APP_PROOF_OLDER_THAN_24H');
  assert.equal(f.update(()=>{f.register.stempel.op='onbekend';}).reason,'APP_PROOF_STAMP_INVALID');
});

test('rechtstreekse lezer weigert lege scope, ontbrekende bron en vuile kandidaat', t => {
  const f=fixture(t);
  assert.equal(gates.inspectAppProof(f.root,new Set(),f.candidateCommit).status,'BLOCKED');
  assert.equal(gates.inspectAppProof(f.root,undefined,f.candidateCommit).status,'BLOCKED');
  assert.equal(gates.inspectAppProof(f.root,scope(),'f'.repeat(40)).reason,'APP_PROOF_CANDIDATE_NOT_CLEAN');
  f.put('public/apps/a.js','window.dirty=true;\n');
  assert.equal(f.result().reason,'APP_PROOF_CANDIDATE_NOT_CLEAN');
  assert.equal(gates.inspectAppProof(path.join(f.root,'missing'),scope(),f.candidateCommit).status,'BLOCKED');
});

test('canoniek raakvlakregister zit in bronvingerafdruk en schone-kandidaatcontrole', t => {
  const f=fixture(t), before=evidence.fingerprint(f.root);
  assert.equal(evidence.candidate(f.root).ok,true);
  f.put('APPWERKT-RAAKVLAK.json',JSON.stringify(f.paired)+'\n');
  assert.notEqual(evidence.fingerprint(f.root),before);
  assert.equal(evidence.candidate(f.root).ok,false);
});
