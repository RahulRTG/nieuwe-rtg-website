'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture,tick}=require('./lib/foundation-ds-fixture');
const vm=require('node:vm');
const parts=['01','02'].map(n=>fs.readFileSync('public/shared/verbinding/verbinding-'+n+'.js','utf8'));
const source='var navigator={onLine:true};\n'+parts.join('');
for(const ds of [true,false])test('werkelijke verbindingsowner: banner, fout en satelliet '+(ds?'met':'zonder')+' DS-marker',()=>{
 const f=fixture({ds,source});const net=f.context.RTGNet;
 net.toon('Offline');const banner=f.node('#rtg-net-banner');assert.equal(banner.textContent,'Offline');assert.equal(banner.hidden,false);
 assert.equal(!!banner.style.cssText,false);net.verberg();assert.equal(banner.hidden,true);
 net.fout('Bewaren mislukt');const toast=f.node('.ds-melding');
 assert.equal(toast.textContent,'Bewaren mislukt');assert.equal(!!toast.style.cssText,false);
 assert.equal(toast.classList.contains('toon'),true);
 net.satelliet.zetStand('aan');const sat=f.node('#rtg-sat-balkje');assert.ok(sat);assert.equal(!!sat.style.cssText,false);
 assert.equal(!!sat.querySelector('button').style.cssText,false);
 assert.equal(sat.parentNode,banner.parentNode);assert.equal(f.document.querySelectorAll('.ds-net').length,1);
 sat.querySelector('button').click();assert.equal(f.node('#rtg-sat-balkje'),null);assert.equal(f.storage.get('rtg_sat'),'uit');
});
test('bestaande applicatietoast blijft eerste eigenaar',()=>{
 const f=fixture({source});let tekst;f.context.toast=t=>tekst=t;
 f.context.RTGNet.fout('Proef');assert.equal(tekst,'Proef');assert.equal(f.node('.ds-melding'),null);
});
test('bronparts blijven binnen grens; nieuwe presentatie gebruikt alleen DS-eigenaren',()=>{
 for(const p of parts)assert.ok(Buffer.byteLength(p)<=10240);
 const css=fs.readFileSync('public/ds/componenten/verbinding.css','utf8');
 assert.match(css,/position: relative/);assert.doesNotMatch(css,/position: fixed/);assert.match(css,/min-block-size: var\(--ds-doel\)/);
 assert.match(css,/min-inline-size: var\(--ds-doel\)/);
 assert.doesNotMatch(css,/!important|#[a-f0-9]{3,8}\b|\b(?:left|right|bottom|top)\s*:/i);
});

test('Zaakdoosstatus gebruikt dezelfde echte statusrespons en één DS-rail',async()=>{
 const f=fixture({source:'void 0;'});f.document.readyState='complete';f.context.navigator={onLine:true};
 vm.runInContext(parts.join(''),f.context);
 const request=f.requests.find(r=>r.url==='/api/doos/status');assert.ok(request);
 f.reply(request,{doos:true});await tick();
 const badge=f.node('#rtg-doos-pill');assert.ok(badge);assert.equal(badge.textContent,'● Zaakdoos');
 assert.equal(badge.style.cssText,undefined);assert.equal(badge.style.background,undefined);
 assert.equal(badge.parentNode.className,'ds-net');
 f.context.RTGNet.toon('Offline');assert.equal(badge.parentNode,f.node('#rtg-net-banner').parentNode);
});

test('Zaakdoosadres is een begrensde documentnavigatie en nooit uitvoerbare invoer',()=>{
 const f=fixture({source:'void 0;'});f.context.navigator={onLine:true};let bestemming='';
 f.context.location.assign=adres=>{bestemming=adres;};
 vm.runInContext(parts.join(''),f.context);
 const doos=f.context.RTGNet.doos;
 for(const onveilig of ['javascript:alert(1)','http://voorbeeld.nl','https://naam:wachtwoord@doos.example','https://doos.example/?x=1']){
  doos.instellen(onveilig);assert.equal(doos.adres(),'');
 }
 doos.instellen('http://192.168.1.40:8080/');assert.equal(doos.adres(),'http://192.168.1.40:8080');
 doos.instellen('https://doos.example/');assert.equal(doos.adres(),'https://doos.example');
 f.storage.set('rtg_member_token','lid-token');doos.naarDoos();
 assert.equal(bestemming,'https://doos.example/apps/foundation/studie.html#doos-token=lid-token');
});

test('flowrail behoudt nodes vóór/na surface-opbouw, wereld-main en toegangsdeur',()=>{
 for(const vroeg of [true,false])for(const wereldHome of [true,false]){
  const f=fixture({source:'void 0;'});f.context.navigator={onLine:true};
  f.document.body.prepend=n=>f.document.body.insertBefore(n,f.document.body.firstChild);
  const main=f.add('main'),input=f.document.createElement('input');input.value='Mijn concept';main.appendChild(input);
  if(wereldHome)f.document.body.dataset.worldHome='foundation';
  vm.runInContext(fs.readFileSync('public/shared/interface/world-desktop-surface.js','utf8'),f.context);
  vm.runInContext(parts.join(''),f.context);
  if(vroeg)f.context.RTGNet.toon('Offline');
  const original=f.node('.ds-net'),surface=f.context.RTGDesktopSurface;
  const home=surface.prepare(),root=f.add('div');root.className='wd-shell';home.classList.add('wd-home');root.appendChild(home);
  f.context.MutationObserver=class{observe(){}disconnect(){}};
  surface.guard(root,home);
  if(!vroeg)f.context.RTGNet.toon('Offline');
  const rail=f.node('.ds-net');assert.ok(rail);assert.equal(rail.parentNode,home);assert.equal(home.firstChild,rail);
  if(vroeg)assert.equal(rail,original,'dezelfde owner wordt verplaatst');
  assert.equal(main.querySelector('input'),input);assert.equal(input.value,'Mijn concept');
  f.context.RTGNet.toon('Opnieuw');assert.equal(f.document.querySelectorAll('.ds-net').length,1);
  const gate=f.add('section');gate.id='rtf-toegang-slot';gate.className='ds-foundation-toegang';
  f.document.documentElement.classList.add('rtf-toegang-dicht');surface.guard(root,home);
  assert.equal(home.hidden,true);assert.equal(home.inert,true);assert.equal(rail.parentNode,home,'status kan toegangsdeur niet omzeilen');
 }
});
