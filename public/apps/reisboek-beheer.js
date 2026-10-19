(function(w){
'use strict';
/* Het beheerblad van het Reisboek (Taak, in een dialoog): een reis vastleggen
   en daarin de route, verblijven, documenten en het programma bijhouden. Dit
   is wat het lid zelf vastlegt, geen reservering bij een vervoerder of hotel. */
function maak(c){
  let actief='';
  const veld=(label,naam,extra)=>'<label class="ds-veldlabel">'+label+'<input class="ds-invoer" name="'+naam+'"'+(extra||'')+'></label>';
  const groep=inhoud=>'<div class="ds-veldgroep">'+inhoud+'</div>';
  const opslaan=tekst=>'<div><button class="ds-knop ds-knop--primair" type="submit">'+tekst+'</button></div>';
  function lijst(items,soort){return items.length?'<ul class="ds-lijst">'+items.map(x=>'<li class="ds-lijst__rij"><span></span><span><span class="ds-lijst__titel">'+c.esc(soort==='legs'?[x.van,x.naar].filter(Boolean).join(' → '):soort==='verblijven'?x.naam:soort==='documenten'?x.soort:x.tekst)+'</span><span class="ds-lijst__tekst">'+c.esc(soort==='legs'?[x.datum,x.tijd,x.vervoer].filter(Boolean).join(' · '):soort==='verblijven'?[x.plaats,x.in,x.uit].filter(Boolean).join(' · '):soort==='documenten'?(x.geldigTot?'Geldig tot '+c.datum(x.geldigTot):'Geen geldigheid ingevuld'):c.datum(x.datum))+'</span></span><button class="ds-knop ds-knop--stil ds-knop--klein" type="button" data-item-weg="'+c.esc(x.id)+'" data-lijst="'+c.esc(soort)+'" aria-label="Verwijderen">×</button></li>').join('')+'</ul>':'<p class="ds-meta">Nog niets toegevoegd.</p>'}
  function blok(titel,soort,items,velden){return'<form class="ds-velden" data-lijst="'+soort+'"><h3 class="ds-kaart__titel">'+titel+'</h3>'+lijst(items||[],soort)+velden+opslaan('+ Toevoegen')+'</form>'}
  function nieuw(vak){
    vak.innerHTML='<form class="ds-velden" id="nieuweReis"><h3 class="ds-kaart__titel">Nieuwe reis</h3>'+veld('Naam','naam',' required maxlength="80" placeholder="Bijv. Ibiza in september"')+groep(veld('Bestemming','bestemming',' maxlength="80"')+veld('Van','van',' type="date"')+veld('Tot','tot',' type="date"'))+opslaan('In mijn reisboek')+'</form><div class="ds-velden"><h3 class="ds-kaart__titel">Uw reizen</h3>'+((c.boek().reizen||[]).map(x=>'<button class="ds-veld" type="button" data-beheer-reis="'+c.esc(x.id)+'"><span></span><span><span class="ds-veld__label">'+c.esc(x.naam)+'</span><span class="ds-veld__waarde">'+c.esc([x.bestemming,c.periode(x)].filter(Boolean).join(' · ')||'Open het draaiboek')+'</span></span><svg class="ds-veld__pijl" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>').join('')||'<p class="ds-meta">Nog geen reizen.</p>')+'</div>';
    vak.querySelector('#nieuweReis').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget),knop=e.currentTarget.querySelector('button');knop.disabled=true;try{const d=await c.api('/api/member/rechterhand/reis/zet',{naam:f.get('naam'),bestemming:f.get('bestemming'),van:f.get('van'),tot:f.get('tot')});actief=d.reis.id;c.meld('De reis staat in uw reisboek.');await c.herlaad(true)}catch(err){c.meld(err.message);knop.disabled=false}});
    vak.querySelectorAll('[data-beheer-reis]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.beheerReis)));
  }
  function bestaand(vak,r){
    vak.innerHTML='<div class="ds-velden"><div><button class="ds-knop ds-knop--stil ds-knop--klein" type="button" data-terug-beheer>Alle reizen</button></div><h3 class="ds-titel">'+c.esc(r.naam)+'</h3><p class="ds-meta">'+c.esc([r.bestemming,c.periode(r)].filter(Boolean).join(' · '))+'</p><div><button class="ds-knop ds-knop--stil ds-knop--klein" type="button" data-reis-weg>Reis verwijderen</button></div></div>'
      +blok('Reisroute','legs',r.legs,groep(veld('Van','van',' required maxlength="60"')+veld('Naar','naar',' maxlength="60"'))+groep(veld('Datum','datum',' type="date"')+veld('Tijd','tijd',' type="time"'))+veld('Vervoer','vervoer',' maxlength="40"'))
      +blok('Verblijven','verblijven',r.verblijven,groep(veld('Naam','naam',' required maxlength="80"')+veld('Plaats','plaats',' maxlength="60"'))+groep(veld('Inchecken','in',' type="date"')+veld('Uitchecken','uit',' type="date"')))
      +blok('Documenten','documenten',r.documenten,groep(veld('Documentsoort','soort',' required maxlength="40" placeholder="Bijv. paspoort"')+veld('Geldig tot','geldigTot',' type="date"'))+veld('Houder','houder',' maxlength="60" autocomplete="off"'))
      +blok('Programma','programma',r.programma,groep(veld('Datum','datum',' type="date"')+veld('Moment','tekst',' required maxlength="200"')));
    vak.querySelector('[data-terug-beheer]').addEventListener('click',()=>open(''));
    vak.querySelector('[data-reis-weg]').addEventListener('click',async()=>{if(!confirm('Deze reis uit uw reisboek verwijderen?'))return;try{await c.api('/api/member/rechterhand/reis/weg',{id:r.id});actief='';c.meld('De reis is verwijderd.');await c.herlaad(true)}catch(err){c.meld(err.message)}});
    vak.querySelectorAll('form[data-lijst]').forEach(f=>f.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),body={reisId:r.id,lijst:e.currentTarget.dataset.lijst};for(const [k,v] of fd)body[k]=v;const b=e.currentTarget.querySelector('button[type="submit"]');b.disabled=true;try{await c.api('/api/member/rechterhand/reis/item',body);c.meld('Toegevoegd aan uw reis.');await c.herlaad(true)}catch(err){c.meld(err.message);b.disabled=false}}));
    vak.querySelectorAll('[data-item-weg]').forEach(b=>b.addEventListener('click',async()=>{try{await c.api('/api/member/rechterhand/reis/item/weg',{reisId:r.id,lijst:b.dataset.lijst,itemId:b.dataset.itemWeg});await c.herlaad(true)}catch(err){c.meld(err.message)}}));
  }
  function open(id){const dialoog=c.$('#rbBeheer'),vak=c.$('#rbBeheerInhoud');actief=id||'';const r=(c.boek().reizen||[]).find(x=>x.id===actief);r?bestaand(vak,r):nieuw(vak);if(!dialoog.open)dialoog.showModal()}
  function bind(){c.$$('#inhoud [data-beheer]').forEach(b=>b.addEventListener('click',()=>open('')));c.$$('#inhoud [data-open-reis]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.openReis)))}
  function ververs(){if(c.$('#rbBeheer').open)open(actief)}
  c.$('[data-beheer-sluit]').addEventListener('click',()=>c.$('#rbBeheer').close());c.$('#rbBeheer').addEventListener('click',e=>{if(e.target===c.$('#rbBeheer'))c.$('#rbBeheer').close()});
  return{open,bind,ververs};
}
w.RTGReisboekBeheer={maak};
})(window);
