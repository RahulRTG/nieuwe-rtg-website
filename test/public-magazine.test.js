'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),html=read('index.html');
const reader=()=>['platform-magazine.js','magazine-layout.js','magazine-history.js'].map(name=>read('public/site/'+name)).join('\n');
const home=html.split('id="magazineHome"')[1].split('id="magazineDetail"')[0];
const pages=['editie','inhoudsopgave','interview','bedoeling','reisverhaal','reisnotities','goedeleven','salon-verhaal','ondernemen','foundation-verhaal','atelier','werelden-gids','code','vertrouwen','eigen-regie','lid-worden','service-gids','tot-ziens'];
const articles=['artikel-interview','artikel-reizen','artikel-leven','artikel-ondernemers','artikel-foundation','artikel-atelier','artikel-code','artikel-vertrouwen'];
const sections=[...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/g)].map(m=>m[0]);
const section=id=>sections.find(s=>new RegExp('\\bid="'+id+'"').test(s));
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('de canonieke voordeur heeft één editorial main, huisletters en beide onvervormde merkrollen',()=>{
 assert.equal((html.match(/<main\b/g)||[]).length,1);
 assert.deepEqual([...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m=>m[1]),['./public/fonts/fonts.css','./public/ds/rtg-ds.css']);
 assert.match(html,/<html[^>]*data-ds/);
 const header=html.match(/<header[^>]*class="ds-magazine-[\s\S]*?<\/header>/)[0];
 assert.match(header,/class="ds-brand-mark__image"/);assert.match(header,/src="\.\/public\/images\/brand\/rtg-mark\.svg"/);
 assert.match(header,/width="40" height="32"/);assert.match(header,/aria-label="Rahul Travel Group, naar het begin"/);
 const footer=html.match(/<footer[^>]*class="ds-magazine-[\s\S]*?<\/footer>/)[0];
 assert.match(footer,/class="ds-brand-lockup__image"/);assert.match(footer,/src="\.\/public\/images\/brand\/rahul-travel-group-logo\.jpg"/);
 assert.match(footer,/width="1280" height="470"/);assert.match(footer,/alt="Rahul Travel Group - EXPERIENCE THE ELITE CLASS" translate="no"/);
 assert.equal((html.match(/fetchpriority="high"/g)||[]).length,1);
});
test('achttien eindige bladen hebben native ankers, inhoudsopgave en handmatige horizontale bediening',()=>{
 const leaves=[...home.matchAll(/<section\b[^>]*\bdata-issue-page\b[^>]*>/g)].map(m=>m[0]);
 assert.deepEqual(leaves.map(tag=>tag.match(/\bid="([^"]+)"/)[1]),pages);
 for(const leaf of leaves){assert.match(leaf,/tabindex="-1"/);assert.match(leaf,/aria-labelledby="[^"]+"/);assert.match(leaf,/data-issue-label="[^"]+"/);}
 assert.match(home,/id="issueTrack"[^>]*data-magazine-carousel[^>]*tabindex="0"[^>]*role="region"/);
 const index=section('inhoudsopgave');
 for(const id of ['artikel-interview','artikel-reizen','artikel-leven','artikel-ondernemers','artikel-foundation','artikel-atelier','werelden-gids','artikel-code','lid-worden'])assert.match(index,new RegExp('href="#'+id+'"'),id+' staat rechtstreeks in de inhoudsopgave');
 for(const id of ['inhoudsopgave','service-gids'])assert.match(section(id),/data-command-open/,id+' biedt direct zoeken in de inhoud');
 assert.match(home,/data-carousel-prev[^>]*aria-disabled="true"/);
 assert.match(home,/data-carousel-next[^>]*aria-disabled="false"/);
 assert.match(home,/data-carousel-status[^>]*>1 \/ 18</);
 assert.doesNotMatch(home,/<figcaption\b|AI-gegenereerd|Uit De Salon ·/);
 const css=read('public/ds/componenten/magazine.css');
 assert.match(css,/\.ds-issue-track \{[^}]*overflow-x: auto[^}]*scroll-snap-type: inline mandatory/);
 assert.match(css,/\.ds-issue-page \{[^}]*overflow-y: hidden[^}]*scroll-snap-align: start/);
 assert.match(css,/\.ds-magazine-page\[data-magazine-view="cover"\] \{[^}]*block-size: 100dvh[^}]*overflow: hidden/,'de gesloten editie blijft binnen het scherm');
 assert.match(css,/\.ds-magazine \.ds-issue-reader \{[^}]*block-size: auto[^}]*overflow: visible/,'geopende leesinhoud houdt natuurlijke verticale ruimte');
 assert.match(css,/\.ds-issue-condensed > :not\(\.ds-issue-preview\)/,'een te vol blad heeft een expliciete leesingang');
 assert.doesNotMatch(css,/!important|#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\(|url\(https?:/i);
 assert.doesNotMatch(home,/<style\b|\sstyle=/i);
 const script=reader();
 assert.match(script,/function readingNode\(id\)/);assert.match(script,/open\.dataset\.readLeaf=card\.id/);
 assert.match(script,/card\.scrollHeight>card\.clientHeight\+2\|\|card\.scrollWidth>card\.clientWidth\+2/,'ook vergrote tekst wordt gemeten in plaats van afgeknipt');
 assert.doesNotMatch(script,/setInterval|(?:setTimeout|requestAnimationFrame)\s*\(\s*(?:next|move)\b/,'geen automatisch doorbladeren');
 assert.match(script,/Math\.max\(0,Math\.min\(s\.cards\.length-1,index\)\)/);
 assert.match(script,/e\.key==='Home'/);assert.match(script,/e\.key==='End'/);
});
test('iedere lokale magazine-ingang verwijst naar één bestaande eigenaar, nooit naar een dood anker',()=>{
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 for(const link of home.matchAll(/<a\b[^>]*href="#([^"]+)"[^>]*>/g)){
  const id=decodeURIComponent(link[1]);
  assert.equal(ids.filter(v=>v===id).length,1,id+' heeft één canonieke bron');
 }
 for(const link of home.matchAll(/<a\b[^>]*href="\.\/([^"#?]+\.html)(?:[?#][^"]*)?"[^>]*>/g))assert.ok(fs.existsSync(path.join(root,link[1])),link[1]+' is een bestaande publieke pagina');
 const worlds=section('werelden-gids');
 for(const id of ['livingos','travelos','workos'])assert.match(worlds,new RegExp('href="\\./public/site/werelden/'+id+'\\.html"'),id+' behoudt zijn bestaande dossierpagina');
 assert.match(worlds,/href="#foundation"/,'Foundation behoudt zijn bestaande bronscène');
 const membership=section('lid-worden');
 for(const id of ['community','rtg-pass','business-lite','business-pass','lifestyle-pass'])assert.match(membership,new RegExp('href="\\./public/site/passen/'+id+'\\.html"'),id+' behoudt zijn bestaande paspagina');
 assert.match(membership,/nog niet boekbaar/i);
});
test('acht echte artikelen hebben leesinhoud, bronverantwoording en bestaande vervolgroutes',()=>{
 assert.equal((html.match(/\bdata-issue-article\b/g)||[]).length,8);
 for(const id of articles){
  const article=section(id);assert.ok(article,id+' bestaat');
  assert.match(article,/data-scene=/);assert.match(article,/ds-issue-prose/);
  assert.match(article,/class="ds-issue-sources"/);assert.match(article,/class="ds-issue-related"/);
  assert.ok((article.match(/<(?:p|dd)>/g)||[]).length>=3,id+' is meer dan een poster');
  assert.match(home,new RegExp('href="#'+id+'"'),id+' heeft een native ingang');
 }
 assert.match(section('artikel-code'),/server\/ai\.js/);
 assert.match(section('artikel-code'),/server\/local-ai\.js/);
 assert.match(section('artikel-vertrouwen'),/server\/kern\/reservering\/providerbewijs\.js/);
 assert.match(section('artikel-vertrouwen'),/test\/hospitality-providerbewijs\.test\.js/);
});
test('het interview bewaart de drie letterlijke antwoorden en het goedgekeurde echte portret',()=>{
 const article=section('artikel-interview');
 const answers=[...article.matchAll(/<dd>([\s\S]*?)<\/dd>/g)].map(m=>m[1]);
 assert.deepEqual(answers,['“Reizen, de mens en ondernemers”','“Verrast door schoonheid, kunst en nieuwe perspectieven”','“Een ingewikkeld systeem dat alleen voor een kleine elite werkt”']);
 assert.match(article,/class="ds-issue-interview-answers" lang="nl" translate="no"/);
 const portrait='rtg-founder-portrait.jpg',bytes=fs.readFileSync(path.join(root,'public/images/editorial',portrait));
 assert.equal(bytes.length,148314);
 assert.equal(digest(bytes),'c192e5a432ed5b5a1095df867d202430f7546a121c1863a22f7ae4b8b68e292a');
 const tags=[...html.matchAll(/<img\b[^>]*rtg-founder-portrait\.jpg[^>]*>/g)].map(m=>m[0]);
 assert.ok(tags.length>=2,'hetzelfde portret op het blad en in het gesprek');
 for(const id of ['interview','artikel-interview'])assert.equal((section(id).match(/rtg-founder-portrait\.jpg/g)||[]).length,1,id+' heeft één origineel portret');
 for(const tag of tags)assert.match(tag,/width="960" height="1280"/);
 for(const id of ['interview','artikel-interview'])assert.match(section(id),/alt="Portret van de initiatiefnemer van RTG, aangeleverd voor dit interview"/);
 const registry=JSON.parse(read('public/images/editorial/PROVENANCE.json'));
 assert.equal(registry.some(r=>r.path===portrait),false,'een echt aangeleverd portret wordt niet als AI-beeld geregistreerd');
});
test('andere redactionele beelden zijn herleidbare sfeer; de bronverantwoording staat discreet in het colofon',()=>{
 const registry=JSON.parse(read('public/images/editorial/PROVENANCE.json'));
 for(const image of html.matchAll(/src="\.\/public\/images\/editorial\/([^"]+)"/g)){
  if(image[1]==='rtg-founder-portrait.jpg')continue;
  assert.ok(registry.some(r=>r.path===image[1]&&r.illustrative===true),image[1]);
 }
 const colophon=html.match(/<details id="colofon"[\s\S]*?<\/details>/)[0];
 assert.doesNotMatch(colophon.slice(0,colophon.indexOf('>')),/\bopen\b/);
 assert.match(colophon,/AI-gegenereerde sfeerillustraties/);assert.match(colophon,/echte interviewportret/);
 assert.match(colophon,/aangeleverd en goedgekeurd/);assert.match(colophon,/zonder retouche/);
 assert.match(colophon,/geen echte geïnterviewden, leden, bevestigde partners/);
 assert.match(colophon,/editorial\/PROVENANCE\.json/);assert.match(colophon,/brand\/ink-provenance\.json/);
 assert.match(colophon,/geen algemene productievrijgave/);
 assert.match(html,/<details id="magazineService"[^>]*><summary>Service &amp; informatie/);
 assert.match(html,/id="magazineDirectory"/);
});
test('Inkt blijft één apart lazy-loaded kunstmoment in het atelier, met origineel bewijs',()=>{
 assert.equal((home.match(/rtg-ink-artwork\.webp/g)||[]).length,1);
 assert.match(section('atelier'),/<img[^>]+rtg-ink-artwork\.webp[^>]+width="1536" height="1024"[^>]+loading="lazy"[^>]+alt="[^"]+"/);
 assert.doesNotMatch(section('interview'),/rtg-ink-artwork/);
 assert.match(read('public/ds/componenten/magazine.css'),/\.ds-issue-ink img \{[^}]*object-fit: contain/);
 const provenance=JSON.parse(read('public/images/brand/ink-provenance.json'));
 assert.equal(provenance.selectedDirection,'A \u2014 Inkt');assert.equal(provenance.tool,'built-in image_gen');
 const bytes=fs.readFileSync(path.join(root,provenance.path));
 assert.ok(bytes.length<200000);assert.equal(digest(bytes),provenance.sha256);
});
test('de geschilderde cover, atelier en afsluiting blijven licht, ongewijzigd en los van het kunstenaarscitaat',()=>{
 const provenance=JSON.parse(read('public/images/brand/ink-provenance.json'));
 assert.equal(provenance.paintExtensions.length,2);
 let total=0;
 for(const [file,width,height,count] of [['rtg-painted-horizon.webp',1536,512,1],['rtg-painted-colourfield.webp',960,1200,2]]){
  const asset='public/images/brand/'+file,entry=provenance.paintExtensions.find(r=>r.path===asset);
  assert.ok(entry);assert.equal(entry.width,width);assert.equal(entry.height,height);assert.ok(entry.prompt.length>0);
  const bytes=fs.readFileSync(path.join(root,asset));total+=bytes.length;
  assert.ok(bytes.length<200000);assert.equal(digest(bytes),entry.sha256);
  const tags=[...home.matchAll(/<img\b[^>]*>/g)].map(m=>m[0]).filter(t=>t.includes('/'+file+'"'));
  assert.equal(tags.length,count);
  for(const tag of tags)assert.match(tag,new RegExp('width="'+width+'" height="'+height+'"'));
 }
 assert.ok(total<360000);
 assert.match(section('editie'),/class="ds-cover-masthead"/);
 assert.match(section('editie'),/<h1[^>]*>JOURNAL<\/h1>/);
 assert.match(section('editie'),/rtg-painted-colourfield\.webp[^>]*fetchpriority="high"/);
 assert.doesNotMatch(section('editie'),/rtg-painted-horizon/);
 for(const id of ['artikel-interview','artikel-code','artikel-atelier'])assert.match(section('editie'),new RegExp('href="#'+id+'"'));
 assert.match(section('tot-ziens'),/rtg-painted-horizon\.webp[^>]*loading="lazy"/);
 assert.match(section('inhoudsopgave'),/rtg-painted-colourfield\.webp[^>]*loading="lazy"/);
 assert.doesNotMatch(section('artikel-atelier'),/<img[^>]*rtg-painted-colourfield/);
});
test('het kunstenaarscitaat bewaart naam, primaire bron, taal en eigen vertaling',()=>{
 const article=section('artikel-atelier');
 assert.match(article,/<blockquote lang="en" translate="no">“To see takes time, like to have a friend takes time\.”<\/blockquote>/);
 assert.match(article,/Georgia O’Keeffe/);assert.match(article,/https:\/\/www\.moma\.org\/audio\/playlist\/329\/4355/);
 assert.match(article,/Eigen vertaling:/);
});
test('de reader verplaatst de oorspronkelijke scène en bewaart pagina en focus zonder tweede toestand',()=>{
 const script=reader();
 assert.match(script,/moved\.marker\.replaceWith\(s\.moved\.el\)/);assert.match(script,/detail\.append\(content\)/);
 assert.doesNotMatch(script,/cloneNode|fetch\(|XMLHttpRequest|sendBeacon|localStorage/);
 assert.match(script,/title\.dataset\.i18n=/);assert.match(script,/function next\(delta\)/);
 assert.match(script,/savedPage=a\.closest\(\)/);assert.match(script,/move\(s\.savedPage,true\)/);
 assert.match(script,/lastFocus\.focus\(\{preventScroll:true\}\)/);
 assert.match(read('public/site/platform-shell.js'),/o\.kind==='app'&&w\.RTGPublicMagazine/);
});
test('zoeken, demo, prijzen en voorwaarden blijven routes naar hun bestaande eigenaar',()=>{
 assert.match(read('public/site/start/experience-command.js'),/RTGPublicApp\.open\(entry\.href\.slice\(1\)\)/);
 for(const id of ['inhoud','moment','rahul','intent','confirmExample','exampleReceipt','prijsbeleid','commissie','passen','werelden','regie','commandSearch','commandResults'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/747,50/);assert.match(html,/nog niet boekbaar/);
});
