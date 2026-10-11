(function(){
  'use strict';
  var $=s=>document.querySelector(s),panes=[],actief=-1;
  /* [titel, adres, sjabloon, vuller]. Een paneel met een vuller leest zijn
     inhoud van de server; er staat hier geen enkel verzonnen adres, tijdstip of
     beschikbaarheid meer (die stonden in het oude sjabloon "Ontdekken"). */
  var apps={lijn:['Mijn lijn',null,'#lvLijn',vulLijn],ontdek:['Ontdekken',null,'#lvOntdek',vulOntdek],moment:['Uw avond','/apps/avond.html'],bestellen:['Bestellen','/apps/bestellen.html'],uitgaan:['Uitgaan','/apps/uitgaan.html'],verblijf:['Verblijf','/apps/hotels.html'],plannen:['Mijn plannen','/apps/avond.html#mijn'],avond:['Avond plannen','/apps/avond.html'],food:['Restaurants','/apps/foodcourt.html'],kantoor:['Privékantoor','/apps/lifestyle.html']};
  function token(){try{return localStorage.getItem('rtg_member_token')}catch(e){return null}}
  async function api(p,b){var r=await fetch(p,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(token()||'')},body:JSON.stringify(b||{})}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Dit lukte niet.');return d}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function datum(d){var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(d||''));if(!m)return '';try{return new Date(+m[1],+m[2]-1,+m[3]).toLocaleDateString(document.documentElement.lang||undefined,{weekday:'short',day:'numeric',month:'long'})}catch(e){return m[0]}}
  function vandaag(){var n=new Date();return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0')}
  /* Een fout staat op het scherm, met de zin van de server en een weg terug. */
  function fout(el,melding,e,opnieuw){melding.textContent=e.message||'Dit lukte niet.';var b=document.createElement('button');b.type='button';b.textContent='Opnieuw';b.onclick=()=>opnieuw(el);melding.appendChild(b)}
  function open(id,naast){var a=apps[id]||apps.moment,n=panes.findIndex(p=>p.id===id);if(n>=0)return kies(n);if(!naast||innerWidth<761){panes.forEach(p=>p.el.remove());panes=[]}if(panes.length>=2)panes.shift().el.remove();var el=document.createElement('section');el.className='rv-pane';if(a[1]){el.classList.add('lv-pane-iframe');var f=document.createElement('iframe');f.src=a[1];f.title=a[0];RTGMedia.kader(f);el.appendChild(f)}else el.appendChild($(a[2]).content.cloneNode(true));$('#lvPanes').appendChild(el);panes.push({id,titel:a[0],el});haak(el);if(a[3])a[3](el);kies(panes.length-1)}
  function haak(el){el.querySelectorAll('[data-app]').forEach(b=>b.onclick=()=>open(b.dataset.app,innerWidth>760));}

  /* HET LEVENS-COMMAND-CENTER (LEVEN.md par. 1.5): drie vragen en verder rust.
     Wat hier staat komt letterlijk uit POST /api/leven/cockpit; dit scherm
     rekent niets bij. Twee grenzen uit par. 1.1 en 2.4 die hier gelden: een
     fase met staat 'nvt' staat er NIET (grijs is hoe een norm eruitziet), en er
     komt geen teller over hoeveel fasen er zijn geweest. Er is geen knop die
     iets uitvoert: de cockpit kent alleen 'kijken', en een uitzondering zonder
     adres krijgt dus geen knop. */
  var STAAT={geweest:'Geweest',nu:'Nu',komt:'Komt'};
  function verantwoording(g){return g&&g.length?'<details><summary>Waar komt dit vandaan</summary><ul>'+g.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></details>':''}
  async function vulLijn(el){
    var m=el.querySelector('[data-melding]');m.textContent='Uw lijn wordt gelezen…';
    var c;try{c=await api('/api/leven/cockpit')}catch(e){el.querySelector('[data-doen]').innerHTML='';el.querySelector('[data-speelt]').innerHTML='';return fout(el,m,e,vulLijn)}
    m.textContent='';
    var groet=c.groet||{};el.querySelector('[data-groet]').textContent=groet.zin||'Uw lijn';
    el.querySelector('[data-fase]').textContent=groet.fase?'Wat nu speelt: '+groet.fase+'.':'';
    var u=c.uitzonderingen||[];
    el.querySelector('[data-doen]').innerHTML='<h2 class="lv-kop2">Moet ik iets doen?</h2>'+(u.length?u.map(x=>'<div class="lv-rij" data-uitzondering><small>'+esc(x.soort==='achterstallig'?'Datum voorbij':'Komt eraan')+(x.wanneer?' · '+esc(datum(x.wanneer)):'')+'</small><h3>'+esc(x.titel)+'</h3><p>'+esc(x.uitleg)+'</p>'+verantwoording(x.gegevens)+'</div>').join(''):'<p class="lv-sub" data-rust>Vandaag hoeft u niets te doen.</p>');
    var fasen=((c.lijn||{}).fasen||[]).filter(f=>f.staat&&f.staat!=='nvt');
    el.querySelector('[data-speelt]').innerHTML='<h2 class="lv-kop2">Uw lijn</h2>'+(fasen.length?fasen.map(f=>'<div class="lv-rij" data-fase-id="'+esc(f.id)+'"><small>'+esc(STAAT[f.staat]||f.staat)+(f.vanaf?' · sinds '+esc(f.vanaf):'')+'</small><h3>'+esc(f.naam)+'</h3><p>'+esc(f.toelichting)+'</p>'+verantwoording(f.gegevens)+'</div>').join(''):'<p class="lv-sub">Er staat nog niets op uw lijn. De lijn vult zich alleen met wat u zelf ergens deed, zoals een schoolfase of een werkrol.</p>');
    var stil=c.stil||[];el.querySelector('[data-stil]').textContent=stil.length?'Niet gelezen: '+stil.join(', ')+'. Dit beeld is daarom niet compleet.':'';
  }

  /* ONTDEKKEN uit de echte zaken: het foodcourt en de avonden van bars en
     clubs, dezelfde routes als foodcourt.html en uitgaan.html. Kiezen en
     reserveren gebeurt daar; hier staat alleen wat er is. De filter werkt op
     het enige veld dat de server ervoor levert (`reserverenOpen`: de zaak neemt
     reserveringen aan) -- niet op "nu open", want dat weet hij niet. */
  async function vulOntdek(el){
    var m=el.querySelector('[data-melding]'),knop=el.querySelector('[data-filter]');m.textContent='De zaken worden gelezen…';
    var u=await Promise.allSettled([api('/api/foodcourt'),api('/api/uitgaan')]);
    if(u[0].status==='rejected'&&u[1].status==='rejected')return fout(el,m,u[0].reason,vulOntdek);
    m.textContent='';
    var resto=u[0].status==='fulfilled'?(u[0].value.restaurants||[]):null;
    function tekenResto(){
      var alleen=knop.getAttribute('aria-pressed')==='true',bak=el.querySelector('[data-restaurants]');
      if(resto===null){bak.innerHTML='<h2 class="lv-kop2">Restaurants</h2><p class="lv-sub">'+esc(u[0].reason.message)+'</p>';return}
      var l=resto.filter(r=>!alleen||r.reserverenOpen).slice(0,4);
      bak.innerHTML='<h2 class="lv-kop2">Restaurants</h2>'+(l.length?'<div class="lv-grid">'+l.map(r=>'<button data-app="food" data-resto="'+esc(r.code)+'"><span>'+esc([r.keuken,r.prijs,r.stad].filter(Boolean).join(' · ').toUpperCase())+'</span><h3>'+esc(r.naam)+'</h3><p>'+esc(r.tagline||'')+(r.reserverenOpen?'':' Neemt nu geen reserveringen aan.')+'</p></button>').join('')+'</div>':'<p class="lv-sub" data-leeg>'+(alleen&&resto.length?'Geen restaurant neemt nu reserveringen aan.':'Er staan nu geen restaurants in het foodcourt.')+'</p>');
      haak(bak);
    }
    knop.onclick=()=>{knop.setAttribute('aria-pressed',knop.getAttribute('aria-pressed')==='true'?'false':'true');tekenResto()};
    tekenResto();
    var bak=el.querySelector('[data-avonden]');
    if(u[1].status==='rejected'){bak.innerHTML='<h2 class="lv-kop2">Uitgaan</h2><p class="lv-sub">'+esc(u[1].reason.message)+'</p>';return}
    var dag=vandaag(),av=[];
    (u[1].value.zaken||[]).forEach(z=>(z.events||[]).forEach(e=>{if(!e.datum||e.datum>=dag)av.push({z,e})}));
    av.sort((a,b)=>String(a.e.datum||'9999').localeCompare(String(b.e.datum||'9999')));
    bak.innerHTML='<h2 class="lv-kop2">Uitgaan</h2>'+(av.length?'<div class="lv-grid">'+av.slice(0,4).map(x=>'<button data-app="uitgaan" data-avond="'+esc(x.e.id)+'"><span>'+esc([x.z.soortLabel,x.z.stad].filter(Boolean).join(' · ').toUpperCase())+'</span><h3>'+esc(x.e.naam)+'</h3><p>'+esc(x.z.naam)+(x.e.datum?' · '+esc(datum(x.e.datum)):'')+(x.e.tijd?' '+esc(x.e.tijd):'')+(x.e.capaciteit?' · '+esc(x.e.vrij)+' plekken vrij':'')+'</p></button>').join('')+'</div>':'<p class="lv-sub" data-leeg>Er staan geen aankomende avonden van bars en clubs.</p>');
    haak(bak);
  }

  /* Een avond samenstellen en aanvragen gebeurt in avond.html (SCHERMEIGENAAR.json).
     Hier stond een tweede samensteller op dezelfde routes, met een eigen
     "Moment Contract"; het paneel opent nu de eigenaar zelf. */
  function kies(i){actief=i;panes.forEach((p,n)=>p.el.classList.toggle('actief',n===i));var t=$('#lvTabs');t.innerHTML='';panes.forEach((p,n)=>{var b=document.createElement('button');b.className='rv-tab'+(n===i?' actief':'');b.textContent=p.titel;b.onclick=()=>kies(n);t.appendChild(b)});document.querySelectorAll('[data-open]').forEach(b=>b.classList.toggle('actief',b.dataset.open===panes[i].id));context()}
  function context(){var z={lijn:'Uw lijn toont wat u zelf ergens deed. Ik voer hier niets uit.',moment:'Kies in de planner sfeer, tijd, gezelschap en budget; aanvragen doet u zelf.',ontdek:'Ik vergelijk deze adressen en maak er één kloppend plan van.',bestellen:'Zal ik bezorgen laten aansluiten op wanneer iedereen er is?',uitgaan:'Ik combineer gastenlijst, tafel en veilige terugreis.',verblijf:'Ik verbind verblijf, aankomst en ontbijt.'};$('#lvContext').textContent=z[panes[actief]?.id]||'Ik houd de samenhang voor u vast.'}
  function vraag(){var q=$('#lvIn').value.trim().toLowerCase();if(!q)return;$('#lvIn').value='';if(/eten|restaurant|tafel/.test(q))open('food',true);else if(/bezorg|bestel/.test(q))open('bestellen',true);else if(/club|uit|avond/.test(q))open('avond',true);else if(/hotel|slaap|verblijf/.test(q))open('verblijf',true);else open('moment',false)}
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>open(b.dataset.open,false));$('#lvPlus').onclick=()=>open(panes[0]?.id==='moment'?'ontdek':'moment',true);$('#lvStuur').onclick=vraag;$('#lvIn').onkeydown=e=>{if(e.key==='Enter')vraag()};$('#lvMond').onclick=()=>$('#lvIn').focus();if(window.RTGMond)RTGMond.fab($('#lvMond'),20);
  /* Het werkblad opent op de lijn: dat is het command center dat LEVEN.md
     par. 4 op dit adres belooft. Op een breed scherm staat de avondplanner
     ernaast. */
  if(innerWidth>980){open('lijn',false);open('moment',true)}else open('lijn',false)
})();
