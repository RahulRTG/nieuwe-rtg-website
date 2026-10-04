'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { discover, cssPath, redirectTarget, resolveLocal } = require('../scripts/editorial-coverage');
function fixture(t, files) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rtg-editorial-coverage-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const [file,source] of Object.entries(files)){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),source);}
  return root;
}
test('a disconnected screen is a gap; linked CSS is never declared visual or functional proof',t=>{
  const root=fixture(t,{
    'public/apps/one.html':'<body><link rel="stylesheet" href="/shared/heritage.css"></body>',
    'public/apps/missing.html':'<body>Unstyled screen</body>',
    'public/shared/heritage.css':'@import url("./rtg-editorial-system.css");',
    'public/shared/rtg-editorial-system.css':'body{color:ivory}'
  });
  const report=discover(root);
  assert.deepEqual(report.findings.missing_shared_design,['/apps/missing.html']);
  const one=report.rows.find(row=>row.route==='/apps/one.html');
  assert.deepEqual(one.shared_design_path,['public/shared/heritage.css','public/shared/rtg-editorial-system.css']);
  assert.equal(one.visual_review,'NOT_PROVEN_BY_STATIC_LINKAGE');
  assert.equal(one.functional_review,'NOT_PROVEN_BY_STATIC_LINKAGE');
});
test('CSS comment references and cyclic imports do not manufacture coverage',t=>{
  const root=fixture(t,{'public/shared/a.css':'/* @import "./target.css"; */ @import "./b.css";', 'public/shared/b.css':'@import "./a.css";', 'public/shared/target.css':'body{}'});
  assert.equal(cssPath(root,'public/shared/a.css','public/shared/target.css'),null);
});
test('redirect targets resolve separately, including old routes misclassified by the world register',t=>{
  const root=fixture(t,{
    'public/apps/old.html':'<meta http-equiv="refresh" content="0;url=/apps/new.html?a=1&amp;b=2">',
    'public/apps/new.html':'<link rel="stylesheet" href="/shared/rtg-editorial-system.css">',
    'public/apps/broken.html':'<meta content="0;url=/apps/absent.html" http-equiv="refresh">',
    'public/shared/rtg-editorial-system.css':'body{}'
  });
  const report=discover(root);
  assert.equal(report.totals.screen_sources,1);
  assert.equal(report.totals.redirects,2);
  assert.deepEqual(report.findings.unresolved_redirect_design,['/apps/broken.html']);
  assert.equal(redirectTarget('<meta http-equiv="refresh" content="0;url=/apps/new.html?a=1&amp;b=2">'),'/apps/new.html?a=1&b=2');
});
test('isolated offline app bundles remain explicit review gaps and keep their isolation',t=>{
  const root=fixture(t,{'storeapps/calculator/index.html':'<body><style>body{background:black}</style></body>'});
  const report=discover(root);
  assert.equal(report.totals.screen_sources,0);
  assert.equal(report.totals.isolated_packages,1);
  assert.equal(report.rows[0].shared_design_coverage,'SEPARATE_BUNDLE_REVIEW_REQUIRED');
  assert.deepEqual(report.findings.isolated_package_review,['storeapps/calculator/index.html']);
  assert.equal(resolveLocal('index.html','./public/shared/a.css'),'public/shared/a.css');
  assert.equal(resolveLocal('explore/index.html','../public/shared/a.css'),'public/shared/a.css');
});
