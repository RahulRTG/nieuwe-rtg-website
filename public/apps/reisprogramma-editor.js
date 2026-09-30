/* Kantoor-editor: concept -> expliciete uitgifte -> versiegebonden wijziging.
   Invoer blijft in geheugen bij storing; gastcodes worden nooit opgeslagen. */
(function(w){
'use strict';
let gemonteerd=false;
w.RTGReisPlanner={mount(api){
 if(gemonteerd)return;gemonteerd=true;
 const root=document.querySelector('#reisPlanner'),V=w.RTGReisVelden,$=s=>root.querySelector(s);
 let plan=V.basis(),id=null,versie=0,keuze=-1,vuil=false,bezig=false,items=[],idem=null,gepubliceerd=false;
 root.innerHTML='<h3>Uw reis, van deur tot deur</h3><p>Stel iedere bestemming en ieder serviceniveau zelf samen. Bewaar eerst een concept; deel pas als het programma klopt.</p><div class="rp-tools"><button type="button" id="rp-nieuw">Nieuwe reis</button><button type="button" id="rp-basis">Deur-tot-deur-sjabloon</button></div><div id="rp-meta" class="rp-grid"></div><datalist id="rp-zones"></datalist><div class="rp-columns"><div><h4>Programma</h4><p>De volgorde hieronder is de volgorde voor uw klant. Tijden zijn lokaal, met tijdzone.</p><ol id="rp-onderdelen"></ol><button type="button" id="rp-toevoegen">Onderdeel toevoegen</button></div><div id="rp-detail"></div></div><div class="rp-tools"><button type="button" id="rp-bewaar">Concept bewaren</button><button type="button" id="rp-voorbeeld">Gastvoorbeeld</button></div><div id="rp-preview" hidden></div><div class="rp-publiceer"><h4>Gastlink zonder account</h4><p>Iedereen met de link kan alle gegevens in dit programma lezen, inclusief adressen en contactgegevens. Voeg geen paspoort-, betaalkaart- of medische gegevens toe. De link verleent geen boeking of betaling.</p><label>Link geldig tot<input id="rp-verval" type="date"></label><label><input id="rp-toestemming" type="checkbox"> Ik heb het gastvoorbeeld gecontroleerd en wil deze gegevens delen.</label><button type="button" id="rp-deel">Opslaan en nieuwe gastlink maken</button></div><p id="rp-bericht" role="status" aria-live="polite"></p><div id="rp-link"></div><h4>Bewaarde programma’s</h4><p>Een gastlink wordt alleen bij uitgifte getoond. Maak een nieuwe link als u hem kwijt bent; de vorige vervalt dan.</p><button type="button" id="rp-ververs">Lijst vernieuwen</button><div id="rp-bewaard"></div>';
 for(const z of Intl.supportedValuesOf('timeZone')){const o=document.createElement('option');o.value=z;$('#rp-zones').append(o);}
 $('#rp-verval').value=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
 const meld=s=>{$('#rp-bericht').textContent=s;};
 $('#rp-verval').oninput=()=>{idem=null;$('#rp-toestemming').checked=false;};
 const wijzig=()=>{vuil=true;idem=null;$('#rp-toestemming').checked=false;$('#rp-preview').hidden=true;};
 function meta(){const el=$('#rp-meta');el.replaceChildren();for(const [k,l,t]of [['titel','Reistitel'],['bestemming','Land / stad / route'],['personen','Aantal reizigers','number'],['intro','Welkom en algemene informatie','textarea'],['contactNaam','Uw reisadviseur / concierge'],['contactTelefoon','Telefoon reisadviseur','tel'],['contactEmail','E-mail reisadviseur','email']]){const v=V.veld(k,l,t,plan[k]);v.lastChild.oninput=e=>{plan[k]=k==='personen'?Number(e.target.value):e.target.value;wijzig();};el.append(v);}}
 function knop(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;return b;}
 function lijst(){const el=$('#rp-onderdelen');el.replaceChildren();plan.onderdelen.forEach((o,i)=>{const li=document.createElement('li');li.append(knop((i+1)+'. '+(o.titel||'Nieuw onderdeel'),()=>{keuze=i;detail();}));const sub=document.createElement('small');sub.textContent=(o.datum||'Datum nog invullen')+' · '+V.standen[o.status];li.append(sub);const tools=document.createElement('div');for(const [l,n]of [['Omhoog',i-1],['Omlaag',i+1]]){const b=knop(l,()=>{[plan.onderdelen[i],plan.onderdelen[n]]=[plan.onderdelen[n],plan.onderdelen[i]];keuze=n;wijzig();lijst();detail();});b.disabled=n<0||n>=plan.onderdelen.length;tools.append(b);}tools.append(knop('Dupliceren',()=>{plan.onderdelen.splice(i+1,0,{...o});keuze=i+1;wijzig();lijst();detail();}),knop('Verwijderen',()=>{if(!confirm('Dit onderdeel verwijderen?'))return;plan.onderdelen.splice(i,1);keuze=-1;wijzig();lijst();detail();}));li.append(tools);el.append(li);});}
 function detail(){const el=$('#rp-detail');el.replaceChildren();const o=plan.onderdelen[keuze];if(!o){el.textContent='Kies een onderdeel om het handmatig in te vullen.';return;}for(const [k,l,t]of V.velden){const v=V.veld(k,l,t,o[k],'rp-item');v.lastChild.oninput=e=>{o[k]=e.target.value;wijzig();if(['titel','status','datum'].includes(k))lijst();};el.append(v);}}
 function teken(){meta();lijst();detail();$('#rp-bewaar').textContent=gepubliceerd?'Wijzigingen bewaren voor gasten':id?'Concept bijwerken':'Concept bewaren';}
 async function laad(){try{const d=await api('reisbureau/uitnodigingen');
  items=(d.uitnodigingen||[]).filter(x=>x.programmaReis);
  const el=$('#rp-bewaard');
  el.replaceChildren();
  for(const u of items){const row=document.createElement('div');
  row.className='rp-saved';
  const label=document.createElement('span');
  label.textContent=u.titel+' · versie '+u.versie+' · '+(!u.toegang?'Concept':u.ingetrokken?'Link ingetrokken':Date.parse(u.toegang.expires_at)<=Date.now()?'Link verlopen':'Link tot '+u.toegang.expires_at.slice(0,10));
  row.append(label,knop('Open programma',()=>{if(vuil&&!confirm('U heeft niet bewaarde invoer. Toch een ander programma openen?'))return;
  plan=structuredClone(u.programma);
  id=u.id;
  versie=u.versie;
  gepubliceerd=!!u.toegang&&!u.ingetrokken;
  keuze=-1;
  vuil=false;
  idem=null;
  $('#rp-link').replaceChildren();
  $('#rp-preview').hidden=true;
  $('#rp-toestemming').checked=false;
  teken();
  meld('Versie '+versie+' geopend. Wijzigingen worden zichtbaar via de bestaande gastlink wanneer u bewaart.');
  }));
  if(u.toegang&&!u.ingetrokken)row.append(knop('Gastlink intrekken',async()=>{if(!confirm('Deze gastlink direct intrekken?'))return;
  try{await api('reisbureau/uitnodiging-weg',{id:u.id});
  meld('Gastlink ingetrokken.');
  $('#rp-link').replaceChildren();
  await laad();
  }catch(e){meld(e.message);
  }}));
  el.append(row);
  }if(!items.length)el.textContent='Nog geen bewaarde reisprogramma’s.';
  }catch(e){meld('Lijst niet geladen: '+e.message);
  }}
 async function bewaar(delen){
  if(bezig)return;if(delen&&!$('#rp-toestemming').checked){meld('Controleer eerst het gastvoorbeeld en geef aan dat u wilt delen.');return;}
  bezig=true;root.querySelectorAll('button,input,select,textarea').forEach(b=>b.disabled=true);idem=idem||RTGIdem('reisprogramma');
  try{const d=await api('reisbureau/klaarzetten',{id,versie,idem,programma:plan,publiceer:delen,geldigTot:$('#rp-verval').value});id=d.uitnodiging.id;versie=d.uitnodiging.versie;vuil=false;idem=null;gepubliceerd=!!d.uitnodiging.toegang&&!d.uitnodiging.ingetrokken;$('#rp-bewaar').textContent=gepubliceerd?'Wijzigingen bewaren voor gasten':'Concept bijwerken';$('#rp-link').replaceChildren();
   if(d.link){const l=document.createElement('input');l.readOnly=true;l.setAttribute('aria-label','Gastlink');l.value=new URL(d.link,location.origin).href;$('#rp-link').append(l,knop('Kopieer gastlink',async()=>{try{await navigator.clipboard.writeText(l.value);meld('Gastlink gekopieerd.');}catch(e){l.focus();l.select();meld('Selecteer en kopieer de link.');}}));}
   meld('Versie '+versie+' bewaard.'+(d.link?' Gastlink klaar; kopieer hem nu.':' Er is geen nieuwe link verstuurd.'));$('#rp-toestemming').checked=false;await laad();
  }catch(e){meld(e.message+' Uw invoer staat nog in het formulier. Vernieuw bij twijfel de lijst voordat u opnieuw opslaat.');}
  finally{bezig=false;root.querySelectorAll('button,input,select,textarea').forEach(b=>b.disabled=false);lijst();}
 }
 $('#rp-bewaar').onclick=()=>bewaar(false);$('#rp-deel').onclick=()=>bewaar(true);$('#rp-ververs').onclick=laad;
 $('#rp-voorbeeld').onclick=()=>{const p=$('#rp-preview');p.hidden=false;w.RTGReisProgramma.teken(p,{programma:plan,versie:versie||'concept',gewijzigd:null},true);};
 $('#rp-toevoegen').onclick=()=>{if(plan.onderdelen.length>=80){meld('Maximaal 80 onderdelen.');return;}plan.onderdelen.push(V.nieuw());keuze=plan.onderdelen.length-1;wijzig();lijst();detail();};
 $('#rp-basis').onclick=()=>{if(plan.onderdelen.length&&!confirm('De huidige onderdelen vervangen door een leeg deur-tot-deur-sjabloon?'))return;plan.onderdelen=V.sjabloon();keuze=0;wijzig();lijst();detail();};
 $('#rp-nieuw').onclick=()=>{if(vuil&&!confirm('Uw niet bewaarde invoer verlaten?'))return;plan=V.basis();id=null;versie=0;gepubliceerd=false;keuze=-1;vuil=false;idem=null;$('#rp-link').replaceChildren();$('#rp-preview').hidden=true;$('#rp-toestemming').checked=false;teken();meld('Nieuwe reis.');};
 addEventListener('beforeunload',e=>{if(vuil){e.preventDefault();e.returnValue='';}});
 teken();laad();
}};
})(window);
