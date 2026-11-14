'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const hosts=[...['community','rtg-pass','business-lite','business-pass','lifestyle-pass'].map(id=>'public/site/passen/'+id+'.html'),...['livingos','travelos','workos','foundationos'].map(id=>'public/site/werelden/'+id+'.html'),'public/site/techniek/techniek.html','explore/index.html'];
const asset='public/images/brand/rahul-travel-group-logo.jpg',mark='public/images/brand/rtg-mark.svg';
test('het publieke logo is byte-identiek aan de door de eigenaar aangeleverde Foto 1',()=>{
 const bytes=fs.readFileSync(path.join(root,asset));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'85aedde105a77695862450b7af2097836b6bfc1eece3e1d0f7e66f70ec0092ac');
});
test('het goedgekeurde navigatiesubmerk is een statische vector zonder externe fonts of scripts',()=>{
 const svg=read(mark);
 assert.match(svg,/viewBox="0 0 40 32"/);assert.match(svg,/<title[^>]*>Rahul Travel Group<\/title>/);
 assert.equal((svg.match(/<path\b/g)||[]).length,2,'twee lipcontouren, geen letterblok of extra ornament');
 assert.match(svg,/fill="#7F1634"/);assert.doesNotMatch(svg,/<rect\b|<linearGradient\b|<filter\b|fill="#FFFFFF"/);
 assert.doesNotMatch(svg,/<(?:script|style|text|image|foreignObject|use|animate)\b|\b(?:href|onload|onclick)=|@font-face/i);
});
test('alle publieke detailhosts hebben hetzelfde kleine sublogo en dezelfde bronroute, ook zonder JavaScript',()=>{
 for(const host of hosts){
  const html=read(host),tag=html.match(/<img[^>]+class="ds-brand-mark__image"[^>]*>/),link=html.match(/<a[^>]+class="ds-brand-mark"[^>]*>/),favicon=html.match(/<link rel="icon"[^>]*>/);
  assert.ok(tag,host);assert.ok(link,host);assert.match(tag[0],/width="40" height="32"/);assert.match(tag[0],/alt="Rahul Travel Group"/);
  assert.equal(path.resolve(root,path.dirname(host),tag[0].match(/src="([^"]+)"/)[1]),path.join(root,mark));
  assert.equal(new URL(link[0].match(/href="([^"]+)"/)[1],'https://example.test/project/'+host).href,'https://example.test/project/');
  assert.equal(path.resolve(root,path.dirname(host),favicon[0].match(/href="([^"]+)"/)[1]),path.join(root,mark));assert.match(favicon[0],/type="image\/svg\+xml"/);
  assert.match(html,/ds\/rtg-ds\.css/);assert.doesNotMatch(html,/class="brand-name"|class="brand-slogan"/);
  assert.doesNotMatch(html,/<link[^>]*href="[^"]*brand-lockup\.css"/,'gemigreerde hosts laden de component via de ene DS-root');
  assert.match(html,/data-language-picker/);
 }
});
test('dynamische publieke koppen gebruiken dezelfde submerk-eigenaar en geen getypte RTG-variant',()=>{
 for(const file of ['public/site/platform-shell.js','public/site/platform-detail.js']){
  const script=read(file);assert.match(script,/P\.brand\(/);assert.match(script,/ds-brand-lockup-header/);
  assert.doesNotMatch(script,/brand\.textContent='RTG'|link\('RTG'/);
 }
 assert.match(read('public/site/platform-detail.js'),/source\.querySelector\('\.ds-brand-mark'\)/,'de statische bron verhuist mee en wordt geen tweede zichtbare merkheader');
});
test('de gedeelde sublogo-helper gebruikt de bestaande assetbasis en bewaart navigatiedoel en afbeeldingverhouding',()=>{
 const document={baseURI:'https://example.test/project/public/site/passen/rtg-pass.html',querySelector:()=>({content:'../..'}),createElement:tag=>({tagName:tag,attributes:{},children:[],setAttribute(k,v){this.attributes[k]=v;},appendChild(child){this.children.push(child);}})};
 const window={RTGPublicContent:{words:{}}};vm.runInNewContext(read('public/site/platform-elements.js'),{window,document,URL});
 const brand=window.RTGPublicPlatform.brand('../../../'),img=brand.children[0];
 assert.equal(brand.attributes.href,'../../../');assert.equal(brand.attributes.translate,'no');
 assert.equal(brand.className,'ds-brand-mark');assert.equal(img.className,'ds-brand-mark__image');
 assert.equal(img.src,'https://example.test/project/public/images/brand/rtg-mark.svg');assert.equal(img.width,40);assert.equal(img.height,32);assert.equal(img.alt,'Rahul Travel Group');
});
test('submerk en volledige lockup delen één geregistreerde DS-owner zonder cropping of kleurfilter',()=>{
 const contract=JSON.parse(read('public/ds/contract.json')),css=read('public/ds/componenten/brand-lockup.css');
 assert.ok(contract.componenten.includes('brand-lockup'));assert.ok(contract.ingangen['brand-lockup.css']);
 assert.match(read('public/ds/rtg-ds.css'),/componenten\/brand-lockup\.css/);assert.match(read('public/ds/brand-lockup.css'),/componenten\/brand-lockup\.css/);
 assert.match(css,/object-fit: contain/);assert.match(css,/block-size: auto/);assert.match(css,/inline-size: 152px/);assert.match(css,/inline-size: 176px/);
 assert.match(css,/\.ds-brand-mark \{[^}]*min-inline-size: 44px;[^}]*min-block-size: 44px;/);
 assert.match(css,/\.ds-brand-mark__image \{[^}]*inline-size: 40px;[^}]*block-size: 32px;/);
 assert.doesNotMatch(css,/!important|object-fit:\s*cover|filter:|clip-path:|overflow:\s*hidden/);
});
