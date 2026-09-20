/* Company content uses the same public shell and Edge as the app website. */
(function(w,d){
 'use strict';
 var P=w.RTGPublicPlatform,D=w.RTGPublicContent,source=d.querySelector('main');if(!P||!source)return;
 var languagePrefix=w.location.pathname.match(/^\/([a-z]{2})(?:\/|$)/);
 if(languagePrefix)w.RTGi18n.set(languagePrefix[1],true);
 var hash=new URLSearchParams(w.location.hash.replace(/^#rtg\?/,'')),shell;
 function word(id,nl,en){D.words[id]=[nl,en];w.I18N.en['public.'+id]=en;return id;}
 var steps=[
  ['Person','De persoon staat centraal.','The person comes first.'],
  ['Context','Alleen informatie die bij de situatie en toestemming past, hoort bij het voorstel.','Only information appropriate to the situation and permission belongs in the proposal.'],
  ['Goal','Welk resultaat wilt u bereiken?','What outcome would you like to achieve?'],
  ['Intent','De bedoeling krijgt een betekenis die losstaat van de gekozen taal.','The intention receives meaning independent of the chosen language.'],
  ['Plan','Een voorstel maakt de stappen en mogelijke gevolgen zichtbaar.','A proposal makes the steps and possible consequences visible.'],
  ['Authority','Bevoegdheden en vereiste bevestigingen begrenzen de uitvoering.','Authority and required confirmations limit execution.'],
  ['Capability','Alleen een beschikbare en toegestane functie mag de handeling uitvoeren.','Only an available and permitted function may carry out the action.'],
  ['Effect','Het resultaat is wat daadwerkelijk is veranderd.','The effect is what actually changed.'],
  ['Evidence','Bewijs onderbouwt het resultaat; ontbrekend bewijs blijft zichtbaar.','Evidence substantiates the result; missing evidence remains visible.']
 ];
 steps.forEach(function(s,i){word('step'+i,s[1],s[2]);});
 word('laws','De RTG Laws begrenzen de hele keten.','The RTG Laws govern the entire chain.');
 word('readMore','Lees verder op de bedrijfspagina.','Read more on the company page.');
 word('email','Neem contact op met RTG.','Contact RTG.');
 word('companyPages','Alle bedrijfspagina’s','All company pages');
 var pages={origin:'/rtg/',worlds:'/worlds/',architecture:'/technology/',language:'/languages/',rahul:'/technology/intelligence/',control:'/trust/',foundation:'/foundation/',questions:'/company/about/',support:'/company/contact/'};
 function link(key,href){var a=P.node('a',key,'pp-button');a.href=href;return a;}
 function article(card){
  var el=P.node('article',null,'pp-company-article');
  if(card.photo)el.append(P.photo(card.photo,'pp-detail-photo',true));
  el.append(P.node('p',card.body,'pp-lead'));
  card.paragraphs.forEach(function(key){el.append(P.node('p',key));});
  if(card.id==='architecture'){
   el.append(P.node('p','laws','pp-overline'));var chain=P.node('div',null,'pp-architecture');
   steps.forEach(function(s,i){var row=P.node('details'),summary=P.node('summary');summary.textContent=String(i+1).padStart(2,'0')+' · '+s[0];summary.translate=false;row.append(summary,P.node('p','step'+i));chain.append(row);});el.append(chain);
  }
  if(card.id==='worlds'){
   var grid=P.node('div',null,'pp-company-worlds');D.app.cards.slice(0,4).forEach(function(c){var a=P.node('a',null,'pp-company-world');a.href='/worlds/'+c.world+'/';a.append(P.photo(c.photo),P.node('h3',c.title),P.node('p',c.body));grid.append(a);});el.append(grid);
  }
  if(card.id==='questions')D.company.cards.filter(function(c){return ['origin','architecture','language','control','foundation'].includes(c.id);}).forEach(function(c){var q=P.node('details');q.append(P.node('summary',c.title));c.paragraphs.forEach(function(k){q.append(P.node('p',k));});el.append(q);});
  if(card.id==='language')el.append(P.button('language',function(){w.RTGi18n.openModal();}));
  if(card.id==='support')el.append(link('email','mailto:roellie.i@gmail.com?subject=RTG%20enquiry'));
  if(pages[card.id])el.append(link('readMore',pages[card.id]));
  return el;
 }
 function open(id){
  if(id.startsWith('https://app.rahultravelgroup.com/')){w.location.assign(id);return;}
  if(id==='language-picker'){w.RTGi18n.openModal();return;}
  var card=D.company.cards.find(function(c){return c.id===id;});if(!card)return;
  shell.show(id,card.title,article(card));
 }
 shell=P.init({kind:'company',source:source,open:open});
 d.querySelectorAll('link[rel="stylesheet"]').forEach(function(link){if(/\/(?:site|styles)\.css(?:\?|$)/.test(link.href))link.disabled=true;});
 w.RTGPublicCompany={shell:shell,open:open};
 /* The legacy Edge is replaced only after the shared projection mounts. */
 d.querySelectorAll('[data-edge-shell],[data-menu],[data-rahul],.rahul-panel,.menu-panel').forEach(function(el){el.remove();});
 w.RTGPublicEdge({kind:'company',shell:shell,open:open});
 var footer=d.querySelector('.pp-footer'),nav=P.node('nav',null,'pp-footer-links');
 [['contact','/company/contact/'],['privacy','/legal/privacy/'],['terms','/legal/terms/'],['company','/company/about/']].forEach(function(row){nav.append(link(row[0],row[1]));});footer.append(nav);
 if(hash.get('story'))shell.select(hash.get('story'),false);
 if(hash.get('detail')&&hash.get('detail')!=='page')open(hash.get('detail'));
 else if(d.body.dataset.companyPage!=='home'&&(!hash.has('story')||hash.get('detail')==='page')){
  var heading=source.querySelector('h1'),key=word('currentPage',heading?heading.textContent:d.title,heading?heading.textContent:d.title),content=P.node('article',null,'pp-existing-page');
  while(source.firstChild)content.append(source.firstChild);shell.show('page',key,content);
 }
 w.addEventListener('hashchange',function(){var h=new URLSearchParams(w.location.hash.replace(/^#rtg\?/,''));if(h.get('story'))shell.select(h.get('story'),false);if(h.get('detail'))open(h.get('detail'));else shell.collapse();});
 w.RTGi18n.apply(w.RTGi18n.lang);
})(window,document);
