(function(){
'use strict';
/* TravelOS Reisboek op het RTG Design System (TRAVELOS-MIGRATIE.md, batch 4).
   Dezelfde bronnen als ervoor: het eigen boek (/api/member/rechterhand/reisboek),
   de reizen van TravelOS (/api/reis/reizen) en de reiswacht (/api/reis/wacht,
   /api/reis/los). Het Reisboek boekt en wijzigt geen domeinobjecten. Datums
   volgen de taal van het lid (Intl) in plaats van een vaste Nederlandse lijst. */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TOKEN=(()=>{try{return localStorage.getItem('rtg_member_token')}catch(e){return null}})();
const TABS=['vandaag','documenten','wijzigingen'],params=new URLSearchParams(location.search);
let TAB=TABS.includes(params.get('view'))?params.get('view'):'vandaag',BOEK={reizen:[],attenties:[]},WERELD={reizen:[]},WACHT={reizen:[],bronnen:[],stil:[]},BEHEER=null,DICHT=false/* de deur verving #inhoud */;
const api=(pad,body,herkans)=>fetch(pad,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(TOKEN||'')},body:JSON.stringify(body||{})}).then(async r=>{const d=await r.json().catch(()=>({}));const p=herkans?null:(window.RTGGegevensPoort&&window.RTGGegevensPoort.vang(d,r.status,()=>api(pad,body,true),api));if(p)return p;if(!r.ok){const e=new Error(d.error||'Dit lukt nu niet.');e.status=r.status;throw e}return d});
function meld(t){const m=$('#melding');if(!m)return;m.textContent=t;m.classList.add('toon');clearTimeout(m._t);m._t=setTimeout(()=>m.classList.remove('toon'),3600)}
const taal=()=>document.documentElement.lang||'nl';
function opmaak(d,o){if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))return '';return new Intl.DateTimeFormat(taal(),o).format(new Date(d+'T12:00:00'))}
const datum=d=>opmaak(d,{day:'numeric',month:'long',year:'numeric'}),korteDatum=d=>opmaak(d,{day:'numeric',month:'short'});
function periode(x){if(!x)return '';const van=x.van||'',tot=x.tot||'';return van?(datum(van)+(tot&&tot!==van?' t/m '+datum(tot):'')):''}
function actieveReis(){return (WERELD.reizen||[])[0]||null}
function actieveBoekreis(){const nu=new Date().toISOString().slice(0,10);return (BOEK.reizen||[]).find(r=>r.van&&r.tot>=nu)||(BOEK.reizen||[]).find(r=>r.komend)||(BOEK.reizen||[])[0]||null}
function onderdeelTitel(o){const s=String(o.soort||'').toLowerCase();if(s==='vlucht')return o.titel?o.titel+' · '+(o.bestemming||'Vlucht'):'Uw vlucht';if(s==='verblijf')return o.titel||'Inchecken bij uw verblijf';if(s==='reis')return o.titel||'Uw reis';if(s==='activiteit')return o.titel||'Reismoment';return o.titel||o.soort||'Reismoment'}
function tijdlijn(reis,boekreis){
  const uit=[];
  for(const o of ((reis&&reis.onderdelen)||[]))uit.push({datum:o.van||'',tijd:o.tijd||'',titel:onderdeelTitel(o),sub:[o.status,o.app].filter(Boolean).join(' · '),soort:String(o.soort||'').toLowerCase(),link:o.link||'',actie:o.app||'dit reismoment'});
  if(boekreis){
    for(const x of (boekreis.legs||[]))uit.push({datum:x.datum||'',tijd:x.tijd||'',titel:[x.van,x.naar].filter(Boolean).join(' → ')||'Verplaatsing',sub:x.vervoer||'',soort:'leg',link:'/apps/reizen.html',actie:'Mijn reizen'});
    for(const x of (boekreis.verblijven||[]))uit.push({datum:x.in||'',tijd:'',titel:x.naam||'Verblijf',sub:[x.plaats,'Inchecken'].filter(Boolean).join(' · '),soort:'verblijf',link:'/apps/hotels.html?view=mijn',actie:'mijn verblijf'});
    for(const x of (boekreis.programma||[]))uit.push({datum:x.datum||'',tijd:'',titel:x.tekst||'Programma',sub:'Uit uw eigen reisboek',soort:'programma',link:'',actie:''});
  }
  const gezien=new Set();return uit.filter(x=>{const k=[x.datum,x.tijd,x.titel].join('|').toLowerCase();if(gezien.has(k))return false;gezien.add(k);return true}).sort((a,b)=>((a.datum||'9999')+(a.tijd||'99:99')).localeCompare((b.datum||'9999')+(b.tijd||'99:99')))
}
function volgende(lijn){const nu=new Date(),dag=nu.toISOString().slice(0,10),tijd=nu.toTimeString().slice(0,5);return lijn.find(x=>x.datum>dag||(x.datum===dag&&(!x.tijd||x.tijd>=tijd)))||lijn.find(x=>!x.datum)||null}
function zetKop(){const k={vandaag:['Vandaag','Uw reis beweegt\nmet u mee.','Vlucht, chauffeur, verblijf en plannen vormen samen één rustige reis.'],documenten:['Uw documenten','Alles wat u nodig heeft.\nOp zijn plaats.','Alleen wat bij uw reis hoort, zonder gevoelige gegevens onnodig in beeld te brengen.'],wijzigingen:['Als iets verandert','Uw reis blijft\nkloppen.','U ziet wat er speelt, welke onderdelen geraakt worden en wat u zelf kunt bevestigen.']}[TAB];$('#rbEy').textContent=k[0];$('#rbTitel').innerHTML=esc(k[1]).replace('\n','<br>');$('#rbIntro').textContent=k[2]}
function context(){return{$,$$,esc,boek:()=>BOEK,wacht:()=>WACHT,actieveReis,actieveBoekreis,tijdlijn,volgende,periode,korteDatum,bindBeheer:()=>BEHEER.bind(),losOp,herlaadWacht}}
const M=()=>window.RTGReisboekMomenten;
function teken(){if(!TOKEN){M().inlog(context());return}const c=context();if(TAB==='vandaag')M().vandaag(c);else if(TAB==='documenten')M().documenten(c);else M().wijzigingen(c)}
function zetTab(tab,schrijf){if(DICHT)return;TAB=TABS.includes(tab)?tab:'vandaag';document.body.dataset.rbTab=TAB;document.body.dataset.dsSchermtype=TAB==='vandaag'?'detail':'collectie';zetKop();$$('[data-rb-tabknop]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.rbTabknop===TAB)));if(schrijf){const u=new URL(location.href);TAB==='vandaag'?u.searchParams.delete('view'):u.searchParams.set('view',TAB);history.replaceState(null,'',u.pathname+u.search)}teken()}
/* De deur: Reisboek hoort bij de Lifestyle Pass, en die gaat uitsluitend op
   uitnodiging of na goedkeuring door een mens (AGENTS.md). */
function gate(){DICHT=true;document.body.dataset.dsSchermtype='status';M().deur(context())}
async function laad(houdBeheer){if(!TOKEN){teken();return}try{BOEK=await api('/api/member/rechterhand/reisboek',{});const uit=await Promise.all([api('/api/reis/reizen',{}).catch(e=>({ok:false,reizen:[],error:e.message})),api('/api/reis/wacht',{}).catch(e=>({ok:false,reizen:[],bronnen:[],stil:['reiswacht'],uitleg:e.message}))]);WERELD=uit[0];WACHT=uit[1];teken();if(houdBeheer)BEHEER.ververs()}catch(e){if(e.status===403){gate();return}M().leeg(context(),'Uw reisboek','Dit lukt nu niet.',e.message,'<button class="ds-knop ds-knop--primair ds-status__actie" type="button" data-opnieuw>Probeer opnieuw</button>');const b=$('[data-opnieuw]');if(b)b.addEventListener('click',()=>laad(false))}}
async function herlaadWacht(knop){knop.disabled=true;knop.textContent='Opnieuw meten...';try{WACHT=await api('/api/reis/wacht',{});teken();meld('De gemeten bronnen zijn bijgewerkt.')}catch(e){meld(e.message);knop.disabled=false;knop.textContent='Meet opnieuw'}}
async function losOp(knop){const vak=$$('[data-losuit]').find(x=>x.dataset.losuit===knop.dataset.los);if(!vak)return;knop.disabled=true;vak.innerHTML='<p class="ds-meta">TravelOS kijkt wat er vanuit de huidige bronnen mogelijk is...</p>';try{const d=await api('/api/reis/los',{reisId:knop.dataset.los});vak.innerHTML='<ul class="ds-lijst">'+(d.blokken||[]).map(b=>rij(b.signaal.tekst,(b.voorstellen||[]).length?'Voorstellen op basis van de situatie van nu.':'Geen voorstel beschikbaar.','')+(b.voorstellen||[]).map(v=>voorstel(v,knop.dataset.los)).join('')).join('')+'</ul><p class="ds-meta">'+esc(d.grens||'')+'</p>';vak.querySelectorAll('[data-doe]').forEach(b=>b.addEventListener('click',()=>doeVoorstel(b)));knop.textContent='Voorstellen bijgewerkt'}catch(e){vak.innerHTML='<p class="ds-meta">'+esc(e.message)+'</p>';knop.disabled=false}}
const rij=(titel,tekst,actie)=>'<li class="ds-lijst__rij"><span></span><span><span class="ds-lijst__titel">'+esc(titel)+'</span><span class="ds-lijst__tekst">'+esc(tekst)+'</span></span><span>'+actie+'</span></li>';
function voorstel(v,reisId){let actie='';if(v.soort==='taak')actie='<button class="ds-knop ds-knop--stil ds-knop--klein" type="button" data-doe="'+esc(v.id)+'" data-reis="'+esc(reisId)+'">Zet in agenda</button>';else if(v.link)actie='<a class="ds-knop ds-knop--stil ds-knop--klein" href="'+esc(v.link)+'">Open '+esc(v.app||'app')+'</a>';return rij(v.tekst,v.uitleg||'',actie)}
async function doeVoorstel(knop){knop.disabled=true;try{const r=await api('/api/reis/los/doe',{reisId:knop.dataset.reis,voorstel:knop.dataset.doe});knop.outerHTML='<a class="ds-knop ds-knop--stil ds-knop--klein" href="'+esc(r.link||'/apps/agenda.html')+'">'+(r.al?'Stond al in agenda':'Naar agenda')+'</a>';WACHT=await api('/api/reis/wacht',{}).catch(()=>WACHT);meld(r.al?'Deze taak stond al in uw agenda.':'De taak staat in uw agenda.')}catch(e){meld(e.message);knop.disabled=false}}
if(window.RTGUitvoer)RTGUitvoer.bron(()=>({naam:'reizen',kolommen:['reis','bestemming','van','tot','route','verblijven','documenten','programma'],rijen:(BOEK.reizen||[]).map(r=>[r.naam||'',r.bestemming||'',r.van||'',r.tot||'',(r.legs||[]).length,(r.verblijven||[]).length,(r.documenten||[]).length,(r.programma||[]).length])}));
BEHEER=RTGReisboekBeheer.maak({$,$$,esc,api,meld,boek:()=>BOEK,periode,datum,herlaad:laad});
$$('[data-rb-tabknop]').forEach(b=>b.addEventListener('click',()=>zetTab(b.dataset.rbTabknop,true)));zetTab(TAB,false);laad(false);
})();
