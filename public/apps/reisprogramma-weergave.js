/* Expliciete gastprojectie. Tekst via textContent; geen boekingen, tracking of
   vrije HTML. Alle tijden blijven de handmatig opgegeven plaatselijke tijden. */
(function(w){
'use strict';
const status={voorstel:'Voorstel',aangevraagd:'Aangevraagd',bevestigd:'Bevestigd',gewijzigd:'Gewijzigd',geannuleerd:'Geannuleerd'};
function el(tag,tekst,cls){const e=document.createElement(tag);if(tekst)e.textContent=tekst;if(cls)e.className=cls;return e;}
function teken(root,u,voorbeeld){
 const p=u.programma;root.replaceChildren();root.classList.add('rp-programma');
 const hero=el('header',null,'rp-hero');hero.append(el('p',voorbeeld?'GASTVOORBEELD · NIET GEDEELD':'RTG · UW PERSOONLIJKE REIS','rp-eyebrow'),el('h1',p.titel||'Uw reis'),el('p',(p.bestemming||'Bestemming volgt')+' · '+p.personen+' reiziger'+(p.personen===1?'':'s')));if(p.intro)hero.append(el('p',p.intro,'rp-intro'));root.append(hero);
 const meta=el('p','Versie '+u.versie+(u.gewijzigd?' · Bijgewerkt '+new Date(u.gewijzigd).toLocaleString(document.documentElement.lang||navigator.language):' · Nog niet gepubliceerd'),'rp-sub');root.append(meta,el('p','Persoonlijk samengesteld door uw reisadviseur. Statussen en tijden zijn handmatig bijgewerkt; er is geen live vlucht- of boekingscontrole.','rp-sub'));
 if(u.geldigTot)root.append(el('p','Deze gastlink is geldig tot '+new Date(u.geldigTot).toLocaleDateString(document.documentElement.lang||navigator.language)+'.','rp-sub'));
 const nav=el('nav',null,'rp-tools');nav.setAttribute('aria-label','Reisdagen');
 const dagen=[...new Set(p.onderdelen.map(o=>o.datum||'Datum volgt'))];
 dagen.forEach((d,i)=>{const b=el('button',d);b.type='button';b.onclick=()=>root.querySelector('[data-dag="'+i+'"]').scrollIntoView({behavior:'smooth',block:'start'});nav.append(b);});root.append(nav);
 const list=el('ol',null,'rp-tijdlijn'),gezien=new Set();
 p.onderdelen.forEach((o,i)=>{const li=el('li',null,'rp-step');const d=o.datum||'Datum volgt';if(!gezien.has(d)){li.dataset.dag=String(dagen.indexOf(d));gezien.add(d);}const top=el('div',null,'rp-step-head');top.append(el('span',String(i+1).padStart(2,'0'),'rp-number'),el('span',status[o.status]||'Nog te bepalen','rp-status'));li.append(top,el('h2',o.titel||'Onderdeel'));
 const moment=(date,time,z)=>[date||'Datum volgt',time||'Tijd volgt',z].filter(Boolean).join(' · ');
 li.append(el('p',moment(o.datum,o.tijd,o.zone),'rp-moment'));
 if(o.eindDatum||o.eindTijd)li.append(el('p','Aankomst / einde: '+moment(o.eindDatum||o.datum,o.eindTijd,o.eindZone),'rp-moment'));
 const dl=el('dl');for(const[k,l]of [['vertrek','Vertrek / ontmoetingspunt'],['aankomst','Aankomst / locatie'],['aanbieder','Verzorgd door'],['klasse','Uw service'],['kenmerk','Referentie'],['contact','Contact'],['bevestiging','Bevestiging volgens reisadviseur']])if(o[k])dl.append(el('dt',l),el('dd',o[k]));li.append(dl);if(o.instructies)li.append(el('p',o.instructies,'rp-instructies'));list.append(li);
 });root.append(list);
 if(!p.onderdelen.length)root.append(el('p','Nog geen onderdelen toegevoegd.'));
 if(p.contactNaam||p.contactTelefoon||p.contactEmail){const c=el('section',null,'rp-contact');c.append(el('h2','Uw persoonlijke contact'),el('p',p.contactNaam));if(p.contactTelefoon){const a=el('a',p.contactTelefoon);a.href='tel:'+p.contactTelefoon.replace(/[^+\d]/g,'');c.append(a);}if(p.contactEmail){const a=el('a',p.contactEmail);a.href='mailto:'+encodeURIComponent(p.contactEmail);c.append(a);}root.append(c);}
 if(!voorbeeld){const print=el('button','Afdrukken / bewaren als PDF');print.type='button';print.className='rp-print';print.onclick=()=>w.print();root.append(print,el('p','Een opgeslagen of afgedrukte kopie wordt niet automatisch bijgewerkt. Open de gastlink voor de actuele versie.','rp-sub'));}
}
w.RTGReisProgramma={teken};
})(window);
