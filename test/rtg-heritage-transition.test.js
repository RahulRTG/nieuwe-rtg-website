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

/* Het gedeelde element (WERKRUIMTE.md par. 12): bij vertrek krijgt ALLEEN de
   link die naar het doeladres gaat de naam, en na de overgang is hij weer weg.
   Twee elementen met dezelfde naam laten de browser de hele overgang
   overslaan, dus een tweede link naar elders mag hem nooit krijgen. */
function pageswapProef(naar, links) {
  let swap = null; let klaar = null;
  const document = { documentElement: { classList: { contains: () => false } },
    querySelector: () => null,
    querySelectorAll: (sel) => (sel.indexOf('data-rtg-gedeeld') >= 0 ? links : []) };
  const window = { matchMedia: () => ({ matches: false }), location: { href: 'http://rtg.test/apps/reizen.html' },
    addEventListener: (naam, fn) => { if (naam === 'pageswap') swap = fn; } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/shared/rtg-heritage-transition.js'), 'utf8'), { window, document, URL });
  const vt = { ready: Promise.resolve(), finished: new Promise((r) => { klaar = r; }), skipTransition() {} };
  swap({ viewTransition: vt, activation: { entry: { url: 'http://rtg.test' + naar } } });
  return { klaar: () => { klaar(); return vt.finished.then(() => Promise.resolve()); } };
}
const link = (href, naam) => ({ href, style: { viewTransitionName: '' },
  getAttribute: (a) => (a === 'data-rtg-gedeeld' ? naam : null) });

test('gedeeld element: alleen de link naar het doel krijgt de naam, en verliest hem na de overgang', async () => {
  const goed = link('/apps/reisboek.html', 'reisboek');
  const elders = link('/apps/hotels.html', 'hotels');
  const p = pageswapProef('/apps/reisboek.html', [elders, goed]);
  assert.equal(goed.style.viewTransitionName, 'rtg-gedeeld-reisboek');
  assert.equal(elders.style.viewTransitionName, '', 'een link naar elders krijgt geen naam');
  await p.klaar();
  assert.equal(goed.style.viewTransitionName, '', 'na de overgang is de naam weer weg');
});

test('gedeeld element: een naam buiten [a-z0-9-] wordt nooit een overgangsnaam', () => {
  const vreemd = link('/apps/reisboek.html', 'reis boek;x');
  pageswapProef('/apps/reisboek.html', [vreemd]);
  assert.equal(vreemd.style.viewTransitionName, '');
});
