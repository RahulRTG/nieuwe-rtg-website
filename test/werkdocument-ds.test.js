'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('Room-presentaties delen één DS-component; gegevenshuizen en runtime blijven afzonderlijk',()=>{
 for(const [naam,prefix,root] of [['project-room','pr','projectRoom'],['decision-room','dr','decisionRoom']]){
  const html=read('public/apps/'+naam+'.html');
  assert.match(html,/<html lang="nl" data-ds="1">/);assert.match(html,/class="ds-scherm ds-werkdocument"/);
  assert.deepEqual([...html.matchAll(/<link[^>]*href="([^"]+\.css)"/g)].map(x=>x[1]),['/fonts/fonts.css','/ds/rtg-ds.css']);
  assert.match(html,new RegExp('id="'+root+'"'));assert.match(html,/data-rtg-world="work"/);
  for(const h of ['rtg','rtf','gedeeld'])assert.ok(html.includes('data-'+prefix+'-huis="'+h+'"'));
  for(const s of ['rtg-world-desktop','metgezel','basis','randen','cookie','ios'])assert.ok(html.includes('/shared/'+s+'.js'));
  const controller=read('public/apps/'+naam+'.js');assert.match(controller,/Authorization: 'Bearer ' \+ \(token \|\| ''\)/);
  assert.match(controller,/\/api\/account\/start/);assert.match(controller,/\/api\/rtgone\/state/);
 }
 const css=read('public/ds/componenten/werkdocument.css'),tokens=read('public/ds/tokens.css');
 assert.doesNotMatch(css,/!important|#[\da-f]{3,8}\b|\b(?:margin|padding|border)-(?:left|right|top|bottom)\s*:/i);
 for(const m of css.matchAll(/var\((--ds-[\w-]+)/g))assert.ok(tokens.includes(m[1]+':'),m[1]);
 assert.match(css,/prefers-reduced-motion/);assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/\.ds-werkdocument-laag\[hidden\]/);
 const fouten=require('../scripts/ontwerpsysteem').contractFouten({paginas:{}});
 assert.deepEqual(fouten.filter(x=>x.includes('componenten/werkdocument.css')),[]);
});
function renderer(naam){const window={};window.ProjectRoomUtil=window.DecisionRoomUtil={veilig:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),initialen:()=> 'AB'};
 vm.runInNewContext(read('public/apps/'+naam+'.js'),{window,Intl,Date});return window;}
test('bestaande Room-renderers tonen echte broninhoud veilig met gedeelde DS-acties',()=>{
 const w=renderer('project-room-uitvoering'),vak={innerHTML:'',querySelector:()=>null},dag={};
 const root={querySelector:s=>s==='#prDag'?dag:vak};
 const p={id:'p1',titel:'<script>ongewenst</script>',status:'actief',taken:[{id:'t1',tekst:'Controleer bron',af:false}],bewijs:[],eigenaar:'AB'};
 assert.equal(w.ProjectRoomUitvoering.teken(root,{huis:'rtf',projecten:[p]},'p1'),'p1');
 assert.match(vak.innerHTML,/ds-werkdocument-focus/);assert.match(vak.innerHTML,/data-pr-taak="t1"/);assert.match(vak.innerHTML,/ds-knop/);assert.doesNotMatch(vak.innerHTML,/<script>/);assert.match(dag.textContent,/RTF/);
 w.ProjectRoomUitvoering.teken(root,{projecten:[]},'');assert.match(vak.innerHTML,/Nog geen project/);assert.match(vak.innerHTML,/\/apps\/rtmail.html/);
 const d=renderer('decision-room-afweging');d.DecisionRoomAfweging.teken({querySelector:()=>vak},{id:'b1',titel:'<script>',reden:'Echte afweging',bronMailId:'m1',documentId:'d1',bedrag:0},{huis:'rtf'});
 assert.match(vak.innerHTML,/ds-werkdocument-afwegvlak/);assert.match(vak.innerHTML,/Echte afweging/);assert.match(vak.innerHTML,/Rahul ordent, niet beslist/);assert.match(vak.innerHTML,/data-dr-open="besluit"/);assert.doesNotMatch(vak.innerHTML,/<script>/);
});
test('bestaande intake-owner gebruikt native modaliteit zonder vertraagde focus of conceptreset bij dubbel openen',()=>{
 for(const [name,prefix,begin,open,close,form] of [['project-room','pr','var bewijsOpener','openBewijs','sluitBewijs','bewijsForm'],['decision-room','dr','var intakeIdem','openIntake','sluitIntake','intake']]){
  const s=read('public/apps/'+name+'.js'),h=read('public/apps/'+name+'.html');
  assert.match(h,/<dialog class="ds-dialoog/);assert.doesNotMatch(s,/body\.style\.overflow|setTimeout\(function \(\) \{ (?:bewijsForm|intake)\.elements\.titel\.focus/);
  let resets=0,focus=0,back=0,ids=0;const elements={};for(const n of ['titel','documentId','documentTitel','projectId','bronMailId'])elements[n]={value:'',focus(){focus++}};
  const layer={open:false,showModal(){this.open=true},close(){this.open=false}},opener={isConnected:true,focus(){back++}};
  const meldingVak={hidden:true,textContent:''};
  const c={laag:layer,d:{activeElement:opener,getElementById:()=>meldingVak},w:{RTGId(){return 'sleutel-'+(++ids)}},params:new URLSearchParams(),gekozen:()=>({id:'p'}),melding(){throw Error('Onverwacht')},[form]:{elements,reset(){resets++}}};
  const start=s.indexOf(begin),end=s.indexOf("  root.addEventListener('click'",start);
  vm.runInNewContext(s.slice(start,end)+';this.openModal='+open+';this.closeModal='+close+';',c);
  c.openModal();assert.equal(layer.open,true);elements.titel.value='Onopgeslagen concept';c.openModal();assert.equal(resets,1);assert.equal(elements.titel.value,'Onopgeslagen concept');assert.equal(focus,1);
  c.closeModal();assert.equal(layer.open,false);assert.equal(back,1);assert.equal(focus,1,'geen late focusactie');c.closeModal();assert.equal(back,1);
  assert.match(s,/laag\.addEventListener\('cancel', function \(e\) \{ e.preventDefault\(\)/);
 }
});
