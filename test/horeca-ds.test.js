'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const names=['haccp','club','events','hotel','expeditie','bezorg','beheer'];
test('zeven operationele schermen delen DS en behouden alle domeinowners',()=>{
 for(const name of names){const html=read('public/apps/horeca-'+name+'.html');assert.match(html,/<html lang="nl" data-ds>/);assert.match(html,/class="ds-scherm ds-horeca"/);assert.match(html,/data-rtg-world="work"/);assert.doesNotMatch(html,/<style\b/);assert.deepEqual([...html.matchAll(/<link[^>]*href="([^"]+\.css)"/g)].map(m=>m[1]),['/fonts/fonts.css','/ds/rtg-ds.css']);
 for(const src of ['horeca-enterprise','workos-premium','basis','randen','deur'])assert.ok(html.includes('/shared/'+src+'.js'),name+src);assert.ok(html.includes('/apps/horeca/kern.js'));assert.equal((html.match(/src="\/shared\/appmenu\.js"/g)||[]).length,1);assert.ok(html.indexOf('/shared/appmenu.js')>html.indexOf('/shared/horeca-enterprise.js'));assert.match(html,/<script src="\/shared\/appmenu\.js" defer><\/script>/);assert.match(html,/id="main"/);assert.match(html,/id="melding"/);
 }
 const css=read('public/ds/componenten/horeca.css'),tokens=read('public/ds/tokens.css');for(const m of css.matchAll(/var\((--ds-[\w-]+)/g))assert.ok(tokens.includes(m[1]+':'),m[1]);
 assert.doesNotMatch(css,/!important|#[\da-f]{3,8}\b|(?:padding|margin|border)-(?:left|right)\s*:/i);assert.match(css,/flex-wrap: wrap/);assert.match(css,/prefers-reduced-motion/);
 assert.deepEqual(require('../scripts/ontwerpsysteem').contractFouten({paginas:{}}).filter(x=>x.includes('componenten/horeca.css')),[]);
});
test('shell doet geen onbewezen live-/veiligheidsbelofte; gebruikt bestaande owner en terughoudende profielbron',async()=>{
 const source=read('public/shared/horeca-enterprise.js');assert.doesNotMatch(source,/VERBONDEN|Operatie beschermd|LIVE DOMEIN/);assert.match(source,/data-rtg-menu-host/);assert.doesNotMatch(source,/bestaande operationele|Rahul verbindt|<button class="actief"/);assert.match(source,/<span class="actief ds-horeca-domein"/);assert.match(source,/if\(document.querySelector\('\.hq-shell'\)\)return/);
 const block='(function(){'+source.slice(source.indexOf('  var token='),source.lastIndexOf('})();'))+'})();';
 for(const mode of ['goed','medewerker','witnaam','rolmist','rolgetal','rolwit','managermist','managertekst','http','body','onvolledig','gewisseld','verwijderd','laatgewisseld','laatverwijderd']){
  const status={textContent:'Wordt geladen'},section={lastChild:null,insertBefore(n){this.badge=n}},body={dataset:{}},shell={isConnected:mode!=='verwijderd'};let resolve,actorToken=mode==='gewisseld'?'anders':'eigen';
  const c={window:{RTGHoreca:{token:'eigen'}},RTGHoreca:{token:'eigen'},shell,body,localStorage:{getItem:()=>actorToken},fetch:()=>new Promise(r=>resolve=r),document:{createElement:()=>({})},klasse:(a,b)=>a+' '+b,top:{querySelector:s=>s==='section'?section:status}};
  vm.runInNewContext(block,c);if(mode==='laatgewisseld')actorToken='anders';if(mode==='laatverwijderd')shell.isConnected=false;const actor={name:'Eigen medewerker',role:'manager',manager:true};if(mode==='medewerker'){actor.role='staff';actor.manager=false;}if(mode==='witnaam')actor.name='  ';if(mode==='rolmist')delete actor.role;if(mode==='rolgetal')actor.role=1;if(mode==='rolwit')actor.role=' ';if(mode==='managermist')delete actor.manager;if(mode==='managertekst')actor.manager='false';if(resolve)resolve({ok:mode!=='http',json:async()=>mode==='onvolledig'?{}:mode==='body'?{ok:false}:{state:{actor}}});await new Promise(r=>setImmediate(r));
  assert.equal(!!section.badge,['goed','medewerker'].includes(mode),mode);if(['goed','medewerker'].includes(mode)){assert.equal(status.textContent,'Profiel geladen');assert.equal(body.dataset.hqRole,mode==='goed'?'manager':'staff');}if(['http','body','onvolledig'].includes(mode))assert.equal(status.textContent,'Niet geladen');if(['gewisseld','verwijderd'].includes(mode))assert.equal(status.textContent,'Niet geladen');if(['laatgewisseld','laatverwijderd'].includes(mode))assert.equal(status.textContent,'Wordt geladen');
 }
});
test('gedeelde rij/knop behouden escaping, databinding en ontbreken van fictieve inhoud',()=>{
 const c={window:{},localStorage:{getItem:()=>null}};vm.runInNewContext(read('public/apps/horeca/kern.js'),c);const k=c.window.RTGHoreca;
 assert.match(k.rij('Eigen bron'),/ds-horeca-item/);assert.doesNotMatch(k.rij('Eigen bron'),/undefined/);
 assert.match(k.knop('<Onveilig>',{actie:'"x'},true),/data-actie="&quot;x"/);assert.match(k.knop('Bewaren',{},true),/ds-knop/);assert.doesNotMatch(k.knop('<Onveilig>',{},false),/<Onveilig>/);
});
test('missieprioriteit blijft leesbaar en escaped zonder afhankelijkheid van kleur',()=>{
 const nodes={hmLive:{},hmTeam:{},hmMissies:{}};
 const kctx={window:{},localStorage:{getItem:()=>null}};vm.runInNewContext(read('public/apps/horeca/kern.js'),kctx);
 const K=kctx.window.RTGHoreca;K.poort=()=>false;
 const c={window:{RTGHoreca:K},document:{getElementById:id=>nodes[id]}};
 const source=read('public/apps/horeca/beheer-missions.js');vm.runInNewContext(source.replace('if(!K.poort())return;','window.tekenProef=teken;if(!K.poort())return;'),c);
 for(const prioriteit of ['hoog','normaal','<script>']){
  c.window.tekenProef({team:[],missies:[{titel:'Taak',prioriteit,status:'nieuw',sectie:'Zaal',voorNaam:'Eigen medewerker',minuten:5}]});
  assert.ok(nodes.hmMissies.innerHTML.includes('Prioriteit: '+K.esc(prioriteit)));
  assert.doesNotMatch(nodes.hmMissies.innerHTML,/<script>/);
  assert.equal(nodes.hmMissies.innerHTML.includes('ds-horeca-tag laat'),prioriteit==='hoog');
 }
});
