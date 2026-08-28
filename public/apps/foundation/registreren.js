(function(){
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const esc=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const api=(pad,body)=>fetch('/api/foundation/registratie/'+pad,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})})
    .then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Er ging iets mis.');return d;});
  const gezinApi=(pad,body)=>fetch('/api/foundation/gezin/'+pad,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})})
    .then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Er ging iets mis.');return d;});
  const KEY='rtf_registraties'; let catalogus={types:{},eisenPerType:{},steden:[]};
  function bewaard(){try{return JSON.parse(localStorage.getItem(KEY)||'[]');}catch(e){return[];}}
  function bewaar(x){const a=bewaard().filter(y=>y.id!==x.id);a.unshift(x);localStorage.setItem(KEY,JSON.stringify(a.slice(0,10)));}
  function toonForm(type){
    const def=catalogus.types[type];if(!def)return;
    $('#type').value=type;$('#formTitel').textContent=def.label;$('#formUitleg').textContent=def.uitleg;
    $('#naamLabel').textContent=type==='vrijwilliger'?'Uw naam':'Officiële naam';
    $$('[data-alleen]').forEach(e=>e.hidden=e.dataset.alleen!==type);
    $$('[data-stad]').forEach(e=>e.hidden=type==='school');
    $$('[data-kwetsbaar]').forEach(e=>e.hidden=type==='school');
    $('#controles').innerHTML='<div class="uitleg"><b>Deze controles moeten afgerond zijn vóór toegang:</b></div>'+((catalogus.eisenPerType||{})[type]||[]).map(e=>
      '<div class="controle">'+esc(e.label)+'<small>'+esc(e.bron)+(e.url?' · <a href="'+esc(e.url)+'" target="_blank" rel="noopener">officiële bron</a>':'')+'</small></div>').join('');
    $('#fout').textContent='';$('#formulierPaneel').hidden=false;$('#formulierPaneel').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function dataVan(form){
    const fd=new FormData(form), b={};for(const [k,v] of fd)b[k]=v;
    for(const k of ['bevoegd','waarheidsgetrouw','privacyAkkoord','minderjarig','ouderToestemming','werktMetKwetsbaren','verwerktPersoonsgegevens','anbi'])b[k]=form.elements[k]&&form.elements[k].checked===true;
    for(const k of ['talen','vaardigheden'])b[k]=String(b[k]||'').split(',').map(x=>x.trim()).filter(Boolean);
    if(b.landCode==='OTHER')b.landCode='XX';return b;
  }
  async function laadStatus(){
    const host=$('#status'), items=bewaard();if(!items.length)return;
    const uit=[];
    for(const item of items){
      try{
        const d=await api('status',{id:item.id,statusToken:item.token}),a=d.aanvraag;
        const toegang=a.toegang?'<div class="geheim">'+esc(Object.entries(a.toegang).filter(x=>!['soort','opmerking'].includes(x[0])).map(x=>x[0]+': '+x[1]).join('\n'))+(a.toegang.opmerking?'\n'+esc(a.toegang.opmerking):'')+'</div>':'';
        uit.push('<div class="statusrij"><div><b>'+esc(a.naam)+'</b> · '+esc(a.typeLabel)+'</div><div class="uitleg">'+
          (a.status==='goedgekeurd'?'<span class="pill goed">goedgekeurd</span>':a.status==='afgewezen'?'<span class="pill">afgewezen</span>':'<span class="pill wacht">in controle</span>')+
          ' · '+a.open+' controle(s) open</div>'+(a.reden?'<div class="fout">'+esc(a.reden)+'</div>':'')+toegang+'</div>');
      }catch(e){uit.push('<div class="statusrij"><b>'+esc(item.naam||'Registratie')+'</b><div class="fout">Statuslink niet meer geldig.</div></div>');}
    }
    host.innerHTML=uit.join('');
  }
  async function start(){
    try{catalogus=await api('catalogus');
      $('#stad').insertAdjacentHTML('beforeend',(catalogus.steden||[]).map(s=>'<option value="'+esc(s.id)+'">'+esc(s.naam)+'</option>').join(''));
      $$('[data-type]').forEach(b=>b.addEventListener('click',()=>toonForm(b.dataset.type)));
      const q=new URLSearchParams(location.search).get('type');if(q)toonForm(q);
    }catch(e){$('#fout').textContent='De registratiebalie is nu niet bereikbaar. Probeer het later opnieuw.';}
    const hash=location.hash.startsWith('#familie=')?decodeURIComponent(location.hash.slice(9)):'';
    if(hash)toonUitnodiging(hash);
    laadStatus();
  }
  function bewaarGezin(d){localStorage.setItem('rtf_sessie',JSON.stringify({code:d.code,token:d.token,gezin:d.gezin,profiel:d.profiel}));}
  function zelfdePin(form,fout){
    const a=form.elements.pin.value.trim(),b=form.elements.pinNogmaals.value.trim();
    if(!/^\d{4,6}$/.test(a)){fout.textContent='Kies een pincode van 4 tot 6 cijfers.';return false;}
    if(a!==b){fout.textContent='De twee pincodes zijn niet gelijk.';return false;}return true;
  }
  async function toonUitnodiging(sleutel){
    $('#gezinPaneel').hidden=true;$('#formulierPaneel').hidden=true;$('#uitnodigingPaneel').hidden=false;
    const fout=$('#uitnodigingFout');fout.textContent='';
    try{const d=await gezinApi('uitnodiging/bekijk',{uitnodiging:sleutel}),u=d.uitnodiging;
      $('#uitnodigingTitel').textContent='Uitnodiging van '+u.gezinNaam;
      $('#uitnodigingUitleg').textContent=u.naam+', u bent uitgenodigd als '+u.rolNaam.toLowerCase()+'. De sleutel werkt één keer en verloopt op '+new Date(u.verlooptAt).toLocaleString('nl-NL')+'.';
      $('#uitnodigingForm').dataset.sleutel=sleutel;
    }catch(e){fout.textContent=e.message;$('#uitnodigingForm').querySelector('[type=submit]').disabled=true;}
    $('#uitnodigingPaneel').scrollIntoView({behavior:'smooth'});
  }
  $('#gezinKeuze').addEventListener('click',()=>{$('#formulierPaneel').hidden=true;$('#uitnodigingPaneel').hidden=true;$('#gezinPaneel').hidden=false;$('#gezinFout').textContent='';$('#gezinPaneel').scrollIntoView({behavior:'smooth'});});
  $('#gezinAnnuleer').addEventListener('click',()=>{$('#gezinPaneel').hidden=true;});
  $('#gezinForm').addEventListener('submit',async e=>{
    e.preventDefault();const form=e.currentTarget,fout=$('#gezinFout'),knop=form.querySelector('[type=submit]');fout.textContent='';
    if(!zelfdePin(form,fout))return;knop.disabled=true;
    try{const d=await gezinApi('maak',{gezinsnaam:form.elements.gezinsnaam.value,naam:form.elements.naam.value,pin:form.elements.pin.value,
      bevoegdGezin:form.elements.bevoegdGezin.checked,privacyAkkoord:form.elements.privacyAkkoord.checked});
      bewaarGezin(d);location.href='beheer.html#gezinsopbouw';
    }catch(err){fout.textContent=err.message;}finally{knop.disabled=false;}
  });
  $('#uitnodigingForm').addEventListener('submit',async e=>{
    e.preventDefault();const form=e.currentTarget,fout=$('#uitnodigingFout'),knop=form.querySelector('[type=submit]');fout.textContent='';
    if(!zelfdePin(form,fout))return;knop.disabled=true;
    try{const d=await gezinApi('uitnodiging/accepteer',{uitnodiging:form.dataset.sleutel,pin:form.elements.pin.value,
      akkoord:form.elements.akkoord.checked,privacyAkkoord:form.elements.privacyAkkoord.checked});
      bewaarGezin(d);history.replaceState(null,'',location.pathname);location.href='index.html';
    }catch(err){fout.textContent=err.message;}finally{knop.disabled=false;}
  });
  $('#annuleer').addEventListener('click',()=>{$('#formulierPaneel').hidden=true;});
  $('#form').addEventListener('submit',async e=>{
    e.preventDefault();const fout=$('#fout');fout.textContent='';const knop=e.currentTarget.querySelector('[type=submit]');knop.disabled=true;
    try{const b=dataVan(e.currentTarget),d=await api('aanvragen',b);if(!d.id)throw new Error('De registratie kon niet worden vastgelegd.');
      bewaar({id:d.id,token:d.statusToken,naam:d.aanvraag.naam});e.currentTarget.reset();$('#formulierPaneel').hidden=true;await laadStatus();$('#statusPaneel').scrollIntoView({behavior:'smooth'});
    }catch(err){fout.textContent=err.message;}finally{knop.disabled=false;}
  });
  start();
})();
