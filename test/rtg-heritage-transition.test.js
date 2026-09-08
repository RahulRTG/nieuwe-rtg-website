'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');

test('a superseded pending transition cannot render an earlier selection', async () => {
  const callbacks=[],finished=[];
  const source={style:{viewTransitionName:''},getClientRects:()=>[{}]};
  const target={style:{viewTransitionName:''}};
  const document={documentElement:{classList:{contains:()=>false}},querySelector:()=>target,
    startViewTransition(fn){callbacks.push(fn);return {ready:Promise.resolve(),finished:new Promise(r=>finished.push(r)),skipTransition(){}};}};
  const window={matchMedia:()=>({matches:false}),addEventListener(){}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/shared/rtg-heritage-transition.js'),'utf8'),{window,document,URL});
  const updates=[];
  window.RTGHeritageTransition.run(source,target,()=>updates.push('first'));
  window.RTGHeritageTransition.run(source,target,()=>updates.push('second'));
  await callbacks[0](); finished[0](); await Promise.resolve();
  assert.deepEqual(updates,['second']);
  assert.equal(source.style.viewTransitionName,'');
  assert.equal(target.style.viewTransitionName,'');
});
