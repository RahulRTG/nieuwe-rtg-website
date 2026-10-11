/* De twee panelen van het werkblad Leven die hun inhoud van de server lezen:
   de levenslijn (het levens-command-center) en Ontdekken. Ze staan apart van
   leven.js omdat dat bestand anders over de 10 KB ging; ze krijgen de
   hulpjes van het werkblad mee en hebben geen eigen toestand. */
window.RTGLevenPanelen=function(h){
  'use strict';
  var api=h.api,esc=h.esc,datum=h.datum,haak=h.haak,vandaag=h.vandaag;
  /* Een fout staat op het scherm, met de zin van de server en een weg terug. */
  function fout(el,melding,e,opnieuw){melding.textContent=e.message||'Dit lukte niet.';var b=document.createElement('button');b.type='button';b.textContent='Opnieuw';b.onclick=()=>opnieuw(el);melding.appendChild(b)}
  /* HET LEVENS-COMMAND-CENTER (LEVEN.md par. 1.5): drie vragen en verder rust.
     Wat hier staat komt letterlijk uit POST /api/leven/cockpit; dit scherm
     rekent niets bij. Twee grenzen uit par. 1.1 en 2.4 die hier gelden: een
     fase met staat 'nvt' staat er NIET (grijs is hoe een norm eruitziet), en er
     komt geen teller over hoeveel fasen er zijn geweest. Er is geen knop die
     iets uitvoert: de cockpit kent alleen 'kijken', en een uitzondering zonder
     adres krijgt dus geen knop. */
  var STAAT={geweest:'Geweest',nu:'Nu',komt:'Komt'};
  /* Het jaartal bij een fase zegt iets anders per staat: bij 'nu' sinds wanneer
     (de datum van de server als die er is), bij 'geweest' alleen het jaar, bij
     'komt' wanneer. "Sinds 2030" bij iets dat nog moet komen, is onwaar. */
  function wanneerFase(f){if(f.staat==='nu'&&(f.sinds||f.vanaf))return ' · sinds '+(f.sinds?datum(f.sinds)||f.sinds:f.vanaf);if(f.staat==='komt'&&f.vanaf)return ' · in '+f.vanaf;return f.vanaf?' · '+f.vanaf:''}
  /* De bronnen heten in de kern naar hun module; het lid krijgt een woord. */
  var BRON={paspoort:'uw geboortejaar',onderwijs:'uw leerpaspoort',werkrollen:'uw werkrollen',metier:'uw vakprofiel',entourage:'uw Entourage',levensgraaf:'uw termijnen en afspraken',rtf:'de leeftijdsgroepen van de RTFoundation'};
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
    el.querySelector('[data-speelt]').innerHTML='<h2 class="lv-kop2">Uw lijn</h2>'+(fasen.length?fasen.map(f=>'<div class="lv-rij" data-fase-id="'+esc(f.id)+'"><small>'+esc(STAAT[f.staat]||f.staat)+esc(wanneerFase(f))+'</small><h3>'+esc(f.naam)+'</h3><p>'+esc(f.toelichting)+'</p>'+verantwoording(f.gegevens)+'</div>').join(''):'<p class="lv-sub">Er staat nog niets op uw lijn. De lijn vult zich alleen met wat u zelf ergens deed, zoals een schoolfase of een werkrol.</p>');
    var stil=c.stil||[];el.querySelector('[data-stil]').textContent=stil.length?'Niet gelezen: '+stil.map(b=>BRON[b]||'een deel van uw gegevens').filter((b,i,a)=>a.indexOf(b)===i).join(', ')+'. Dit beeld is daarom niet compleet.':'';
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
      bak.innerHTML='<h2 class="lv-kop2">Restaurants</h2><p class="lv-sub">Kiezen en reserveren doet u in het foodcourt.</p>'+(l.length?'<div class="lv-grid">'+l.map(r=>'<button data-app="food" data-zaak="'+esc(r.code)+'"><span>'+esc([r.keuken,r.prijs,r.stad].filter(Boolean).join(' · ').toUpperCase())+'</span><h3>'+esc(r.naam)+'</h3><p>'+esc(r.tagline||'')+(r.reserverenOpen?'':' Neemt nu geen reserveringen aan.')+'</p></button>').join('')+'</div>':'<p class="lv-sub" data-leeg>'+(alleen&&resto.length?'Geen restaurant neemt nu reserveringen aan.':'Er staan nu geen restaurants in het foodcourt.')+'</p>');
      haak(bak);
    }
    knop.onclick=()=>{knop.setAttribute('aria-pressed',knop.getAttribute('aria-pressed')==='true'?'false':'true');tekenResto()};
    tekenResto();
    var bak=el.querySelector('[data-avonden]');
    if(u[1].status==='rejected'){bak.innerHTML='<h2 class="lv-kop2">Uitgaan</h2><p class="lv-sub">'+esc(u[1].reason.message)+'</p>';return}
    var dag=vandaag(),av=[];
    (u[1].value.zaken||[]).forEach(z=>(z.events||[]).forEach(e=>{if(!e.datum||e.datum>=dag)av.push({z,e})}));
    av.sort((a,b)=>String(a.e.datum||'9999').localeCompare(String(b.e.datum||'9999')));
    bak.innerHTML='<h2 class="lv-kop2">Uitgaan</h2><p class="lv-sub">Op de gastenlijst zet u zich bij Uitgaan.</p>'+(av.length?'<div class="lv-grid">'+av.slice(0,4).map(x=>'<button data-app="uitgaan" data-avond-id="'+esc(x.e.id)+'"><span>'+esc([x.z.soortLabel,x.z.stad].filter(Boolean).join(' · ').toUpperCase())+'</span><h3>'+esc(x.e.naam)+'</h3><p>'+esc(x.z.naam)+(x.e.datum?' · '+esc(datum(x.e.datum)):'')+(x.e.tijd?' '+esc(x.e.tijd):'')+(x.e.capaciteit?' · '+esc(x.e.vrij)+' plekken vrij':'')+'</p></button>').join('')+'</div>':'<p class="lv-sub" data-leeg>Er staan geen aankomende avonden van bars en clubs.</p>');
    haak(bak);
  }

  return {lijn:vulLijn,ontdek:vulOntdek};
};
