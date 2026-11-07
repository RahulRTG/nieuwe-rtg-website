'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const bron=fs.readFileSync('public/ds/edge.js','utf8');
for(const mode of ['normaal','frame','embed','geen-edge'])test('documentfocusruimte volgt daadwerkelijke Edge-owner: '+mode,()=>{
 const classes=new Set(),children=[],events={};
 function el(tag,cls,attrs){return{tag,cls,attrs:attrs||{},children:[],appendChild(n){this.children.push(n)},setAttribute(k,v){this.attrs[k]=v},querySelector(){return null}};}
 const document={readyState:'loading',documentElement:{classList:{contains:k=>classes.has(k),add:k=>classes.add(k)},setAttribute(){}},body:{hasAttribute:k=>k==='data-ds-geen-edge'&&mode==='geen-edge',appendChild(n){children.push(n)}},querySelectorAll:()=>[],addEventListener:(k,f)=>events[k]=f};
 const window={RTGDs:{hulp:{el}},location:{search:mode==='embed'?'?embed=1':''}};window.self=window;window.top=mode==='frame'?{}:window;
 vm.runInNewContext(bron,{window,document});assert.equal(classes.has('ds-edge-aan'),false,'niet vóór daadwerkelijke opbouw');events.DOMContentLoaded();events.DOMContentLoaded();
 assert.equal(classes.has('ds-edge-aan'),mode==='normaal');assert.equal(children.length,mode==='normaal'?1:0);
});
test('focusruimte is logisch, tokengebonden en afwezig bij verborgen/verwijderde Edge',()=>{
 const css=fs.readFileSync('public/ds/componenten/edge.css','utf8');assert.match(css,/\.ds-edge-aan:has\(\.ds-edge:not\(\[hidden\]\)\)\s*\{\s*scroll-padding-block-end:\s*calc\(var\(--ds-edge-hoogte\) \+ max\(var\(--ds-ruimte-3\), env\(safe-area-inset-bottom\)\) \+ var\(--ds-ruimte-3\)\)/);
 assert.equal((css.match(/scroll-padding/g)||[]).length,1,'geen universele interne-scrollerregel');
 assert.deepEqual(require('../scripts/ontwerpsysteem').contractFouten({paginas:{}}).filter(x=>x.includes('componenten/edge.css')),[]);
});
