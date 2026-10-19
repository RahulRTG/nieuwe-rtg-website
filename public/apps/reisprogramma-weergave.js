/* Expliciete gastprojectie. Tekst via textContent; geen boekingen, tracking of
   vrije HTML. Alle tijden blijven de handmatig opgegeven plaatselijke tijden.
   Twee vormen, een inhoud: op een scherm van het RTG Design System
   (html[data-ds], de gastdeur reisuitnodiging.html) komen de klassen uit /ds/;
   in het kantoor (kantoren.html, nog op reisprogramma.css) de rp-klassen.
   De haken data-rp="tijdlijn" en data-rp="stap" staan in beide vormen. */
(function(w){
'use strict';
const status={voorstel:'Voorstel',aangevraagd:'Aangevraagd',bevestigd:'Bevestigd',gewijzigd:'Gewijzigd',geannuleerd:'Geannuleerd'};
const RP={root:'rp-programma',hero:'rp-hero',eyebrow:'rp-eyebrow',titel:'',kop:'',intro:'rp-intro',sub:'rp-sub',tools:'rp-tools',dag:'',lijst:'rp-tijdlijn',stap:'rp-step',stapkop:'rp-step-head',nummer:'rp-number',status:'rp-status',moment:'rp-moment',instructies:'rp-instructies',contact:'rp-contact',print:'rp-print'};
const DS={root:'',hero:'ds-taak__kop',eyebrow:'ds-label',titel:'ds-titel ds-titel--scherm',kop:'ds-kaart__titel',intro:'ds-meta',sub:'ds-meta',tools:'ds-chips',dag:'ds-chip',lijst:'ds-detail__gegevens',stap:'ds-kaart ds-kaart__inhoud',stapkop:'ds-schermkop',nummer:'ds-label',status:'ds-detail__status',moment:'ds-meta',instructies:'ds-meta',contact:'ds-kaart ds-kaart__inhoud',print:'ds-knop ds-knop--stil'};
function el(tag,tekst,cls){const e=document.createElement(tag);if(tekst)e.textContent=tekst;if(cls)e.className=cls;return e;}
function teken(root,u,voorbeeld){
 const K=document.documentElement.hasAttribute('data-ds')?DS:RP,ds=K===DS;
 const p=u.programma;root.replaceChildren();if(K.root)root.classList.add(K.root);
 const hero=el('header',null,K.hero);hero.append(el('p',voorbeeld?'GASTVOORBEELD · NIET GEDEELD':'RTG · UW PERSOONLIJKE REIS',K.eyebrow),el('h1',p.titel||'Uw reis',K.titel),el('p',(p.bestemming||'Bestemming volgt')+' · '+p.personen+' reiziger'+(p.personen===1?'':'s'),ds?'ds-meta':''));if(p.intro)hero.append(el('p',p.intro,K.intro));root.append(hero);
 const meta=el('p','Versie '+u.versie+(u.gewijzigd?' · Bijgewerkt '+new Date(u.gewijzigd).toLocaleString(document.documentElement.lang||navigator.language):' · Nog niet gepubliceerd'),K.sub);root.append(meta,el('p','Persoonlijk samengesteld door uw reisadviseur. Statussen en tijden zijn handmatig bijgewerkt; er is geen live vlucht- of boekingscontrole.',K.sub));
 if(u.geldigTot)root.append(el('p','Deze gastlink is geldig tot '+new Date(u.geldigTot).toLocaleDateString(document.documentElement.lang||navigator.language)+'.',K.sub));
 const nav=el('nav',null,K.tools);nav.setAttribute('aria-label','Reisdagen');
 const dagen=[...new Set(p.onderdelen.map(o=>o.datum||'Datum volgt'))];
 dagen.forEach((d,i)=>{const b=el('button',d,K.dag);b.type='button';b.onclick=()=>root.querySelector('[data-dag="'+i+'"]').scrollIntoView({behavior:'smooth',block:'start'});nav.append(b);});root.append(nav);
 const list=el('ol',null,K.lijst),gezien=new Set();list.dataset.rp='tijdlijn';
 p.onderdelen.forEach((o,i)=>{const li=el('li',null,K.stap);li.dataset.rp='stap';const d=o.datum||'Datum volgt';if(!gezien.has(d)){li.dataset.dag=String(dagen.indexOf(d));gezien.add(d);}const top=el('div',null,K.stapkop);top.append(el('span',String(i+1).padStart(2,'0'),K.nummer),el('span',status[o.status]||'Nog te bepalen',K.status));li.append(top,el('h2',o.titel||'Onderdeel',K.kop));
 const moment=(date,time,z)=>[date||'Datum volgt',time||'Tijd volgt',z].filter(Boolean).join(' · ');
 li.append(el('p',moment(o.datum,o.tijd,o.zone),K.moment));
 if(o.eindDatum||o.eindTijd)li.append(el('p','Aankomst / einde: '+moment(o.eindDatum||o.datum,o.eindTijd,o.eindZone),K.moment));
 const paren=[['vertrek','Vertrek / ontmoetingspunt'],['aankomst','Aankomst / locatie'],['aanbieder','Verzorgd door'],['klasse','Uw service'],['kenmerk','Referentie'],['contact','Contact'],['bevestiging','Bevestiging volgens reisadviseur']].filter(([k])=>o[k]);
 /* In het Design System een gegeven per rij (label en waarde), zoals het Detail-scherm; daarbuiten een dl. */
 if(ds){if(paren.length){const ul=el('ul',null,'ds-detail__gegevens');for(const[k,l]of paren){const r=el('li',null,'ds-veld'),t=el('span');t.append(el('span',l,'ds-veld__label'),el('span',o[k],'ds-veld__waarde'));r.append(el('span'),t,el('span'));ul.append(r);}li.append(ul);}}
 else{const dl=el('dl');for(const[k,l]of paren)dl.append(el('dt',l),el('dd',o[k]));li.append(dl);}
 if(o.instructies)li.append(el('p',o.instructies,K.instructies));list.append(li);
 });root.append(list);
 if(!p.onderdelen.length)root.append(el('p','Nog geen onderdelen toegevoegd.',ds?'ds-meta':''));
 if(p.contactNaam||p.contactTelefoon||p.contactEmail){const c=el('section',null,K.contact);c.append(el('h2','Uw persoonlijke contact',K.kop),el('p',p.contactNaam));if(p.contactTelefoon){const a=el('a',p.contactTelefoon);a.href='tel:'+p.contactTelefoon.replace(/[^+\d]/g,'');c.append(a);}if(p.contactEmail){const a=el('a',p.contactEmail);a.href='mailto:'+encodeURIComponent(p.contactEmail);c.append(a);}root.append(c);}
 if(!voorbeeld){const print=el('button','Afdrukken / bewaren als PDF');print.type='button';print.className=K.print;print.onclick=()=>w.print();root.append(print,el('p','Een opgeslagen of afgedrukte kopie wordt niet automatisch bijgewerkt. Open de gastlink voor de actuele versie.',K.sub));}
}
w.RTGReisProgramma={teken};
})(window);
