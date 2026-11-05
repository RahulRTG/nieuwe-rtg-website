'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('public/apps/library.html');
const bron=()=>require('../scripts/bundel').bundel('apps/library/app.js').toString();

test('Library blijft Foundation met één inhoudsdoel, dezelfde bediening en uitsluitend DS-presentatie',()=>{
 assert.match(html,/<html lang="nl" data-ds>/);assert.match(html,/data-rtg-world="foundation"/);
 assert.match(html,/data-ds-schermtype="detail" data-ds-nadruk="gereedschap"/);
 assert.deepEqual([...html.matchAll(/<link[^>]*href="([^"]+\.css)"/g)].map(x=>x[1]),['/fonts/fonts.css','/ds/rtg-ds.css']);
 assert.doesNotMatch(html,/<style\b|\bstyle=/);assert.equal(fs.existsSync(path.join(__dirname,'../public/apps/library/style.css')),false);
 assert.equal((html.match(/<main\b/g)||[]).length,1);assert.match(html,/<main[^>]+id="libraryContent"/);
 assert.match(html,/<section id="main"[^>]+ds-library-paneel/);
 assert.equal((html.match(/src="\/shared\/rtg-world-desktop.js" defer/g)||[]).length,1);
 assert.ok(html.indexOf('/ds/shell.js')<html.indexOf('/shared/rtg-world-desktop.js'));
 for(const owner of ['metgezel','basis','bediening','randen','sneltoets'])assert.ok(html.includes('/shared/'+owner+'.js'));
 for(const id of ['create','new-title','new-type','new-language','node-form','node-title','node-kind','node-content','node-summary','reader-search','reader-note','feedback-kind','feedback-message','release'])assert.ok(html.includes('id="'+id+'"'),id);
 for(const id of ['new-title','new-type','new-language','node-title','node-kind','node-content','node-summary','reader-search','reader-note','feedback-kind','feedback-message'])assert.ok(html.includes('for="'+id+'"'),id);
 for(const id of ['rail','main','side'])assert.match(html,new RegExp('data-tab="'+id+'" aria-controls="'+id+'"'));
 const css=read('public/ds/componenten/library.css'),tokens=read('public/ds/tokens.css');
 assert.doesNotMatch(css,/!important|#[\da-f]{3,8}\b|\b(?:margin|padding|border)-(?:left|right|top|bottom)\s*:/i);
 for(const m of css.matchAll(/var\((--ds-[\w-]+)/g))assert.ok(tokens.includes(m[1]+':'),m[1]);
 assert.match(css,/@container ds \(min-width: 64rem\)/);assert.match(css,/\.ds-library-paneel\.mobile \{ display: block;/);
 assert.match(css,/\.ds-library-tabs \{ display: flex;/);assert.match(css,/safe-area-inset-bottom/);assert.match(css,/prefers-reduced-motion/);
 assert.deepEqual(require('../scripts/ontwerpsysteem').contractFouten({paginas:{}}).filter(x=>x.includes('componenten/library.css')),[]);
 for(const name of fs.readdirSync(path.join(__dirname,'../public/apps/library/app')))assert.ok(Buffer.byteLength(read('public/apps/library/app/'+name))<10240,name);
 new vm.Script(bron());
});

function scherm(){
 const nodes=new Map();
 function node(id,classes='',dataset={}){
  const set=new Set(classes.split(/\s+/)),attrs={};
  return {id,dataset,value:'',innerHTML:'',textContent:'',disabled:false,
   classList:{add:x=>set.add(x),remove:x=>set.delete(x),contains:x=>set.has(x),toggle(x,on){if(on===undefined)on=!set.has(x);on?set.add(x):set.delete(x)}},
   setAttribute(k,v){attrs[k]=v},getAttribute:k=>attrs[k],focus(){},reset(){}};
 }
 for(const m of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g))nodes.set(m[1],node(m[1],(m[0].match(/class="([^"]*)"/)||[])[1]||''));
 const panels=['rail','main','side'].map(id=>nodes.get(id));
 const tabs=['rail','main','side'].map(id=>node('',id==='rail'?'on':'',{tab:id}));
 const document={querySelector:s=>nodes.get(s.slice(1))||null,querySelectorAll:s=>s==='[data-tab]'?tabs:s==='.rail,.main,.side'?panels:[]};
 const window={LibraryAPI:{token:'',call(){throw Error('Geen netwerkaanroep toegestaan in deze presentatieproef')}}};
 const instrumented=bron().replace('edgeContext();if(!A.token)','window.proef={state:state,drawReader:drawReader,drawPublish:drawPublish,status:status};edgeContext();if(!A.token)');
 vm.runInNewContext(instrumented,{window,document,Promise});
 return {nodes,tabs,panels,proef:window.proef};
}

test('de bestaande paneelbediening bewaart conceptinvoer en maakt selectie leesbaar voor hulptechnologie',()=>{
 const e=scherm();e.nodes.get('node-content').value='Een onopgeslagen hoofdstuk';
 assert.equal(e.nodes.get('status').textContent,'Log eerst in via de leden-app.');assert.equal(e.nodes.get('status').dataset.fout,'true');
 for(const id of ['main','side','rail','main']){
  e.tabs.find(b=>b.dataset.tab===id).onclick();
  for(const p of e.panels)assert.equal(p.classList.contains('mobile'),p.id===id);
  for(const b of e.tabs){assert.equal(b.getAttribute('aria-pressed'),String(b.dataset.tab===id));assert.equal(b.classList.contains('on'),b.dataset.tab===id)}
  assert.equal(e.nodes.get('node-content').value,'Een onopgeslagen hoofdstuk');
 }
 e.proef.status('Persoonlijke notitie bewaard.');assert.equal(e.nodes.get('status').dataset.fout,'false');
});

test('Reader en publicatie behouden veilige inhoud, persoonlijke notities en expliciete Foundation-rechten',()=>{
 const e=scherm(),p=e.proef;
 p.state.work={title:'Mijn <werk>',activeAgreementId:null,agreements:[],editions:[{id:'editie-1',status:'draft',language:'nl',changeSummary:'Concept',distribution:{status:'private'}},{id:'editie-2',status:'released',language:'nl',changeSummary:'Vrijgegeven',distribution:{status:'private'}}]};
 p.state.reader={edition:{id:'editie-2',nodes:[{nodeId:'n1',kind:'chapter',revision:{title:'<img src=x onerror=alert(1)>',content:'Tekst & <script>ongewenst</script>\nTweede regel'}},{nodeId:'n2',kind:'chapter',revision:{title:'Vervolg',content:'Slot'}}]}};
 p.state.readerState={state:{notes:{a:{id:'notitie-1',nodeId:'n1',content:'Mijn eigen aantekening'}}}};
 p.drawReader();const paper=e.nodes.get('paper').innerHTML;
 assert.match(paper,/&lt;img/);assert.match(paper,/&amp;/);assert.match(paper,/&lt;script&gt;/);assert.doesNotMatch(paper,/<img|<script>/);
 assert.equal(e.nodes.get('reader-title').textContent,'Mijn <werk> · 1/2');
 assert.equal(e.nodes.get('reader-note').value,'Mijn eigen aantekening');assert.equal(e.nodes.get('reader-note').dataset.noteId,'notitie-1');
 assert.equal(e.nodes.get('prev-node').disabled,true);assert.equal(e.nodes.get('next-node').disabled,false);
 e.nodes.get('next-node').onclick();assert.equal(e.nodes.get('reader-note').value,'');assert.equal(e.nodes.get('next-node').disabled,true);
 p.drawPublish();const rights=e.nodes.get('governance').innerHTML,editions=e.nodes.get('editions').innerHTML;
 for(const id of ['solo-decision','solo-rights','solo-foundation'])assert.ok(rights.includes('id="'+id+'"'));
 assert.match(rights,/Foundation hierdoor geen eigenaar wordt/);assert.match(rights,/ds-library-akkoord/);
 assert.doesNotMatch(editions,/data-read="editie-1"/);assert.match(editions,/data-read="editie-2"/);
});

test('bestaande LibraryAPI houdt lidtoken, operationId en HTTP-foutgrens',async()=>{
 const calls=[],window={RTGId:prefix=>prefix+'-uniek'};
 const ctx={window,localStorage:{getItem:key=>{assert.equal(key,'rtg_member_token');return 'lidtoken'}},fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({workId:'w1'})}}};
 vm.runInNewContext(read('public/apps/library/api.js'),ctx);
 const id=window.LibraryAPI.op('work');assert.match(id,/uniek$/);
 assert.equal((await window.LibraryAPI.call('/api/library/work/create',{operationId:id,data:{title:'Een werk'}})).workId,'w1');
 assert.equal(calls[0].options.headers.Authorization,'Bearer lidtoken');assert.equal(calls[0].options.method,'POST');
 assert.equal(JSON.parse(calls[0].options.body).operationId,id);
 ctx.fetch=async()=>({ok:false,json:async()=>({error:'revision_conflict',message:'Herlaad het werk.'})});
 await assert.rejects(window.LibraryAPI.call('/api/library/revision/add',{}),/revision_conflict/);
});
