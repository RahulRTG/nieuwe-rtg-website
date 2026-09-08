/* Alleen de weergave van Hulp & Zorg. Alle teksten uit API's worden eerst
   ontsmet; een kaart verschijnt pas wanneer de bron werkelijk iets kent. */
(function(w,d){
  'use strict';
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
  function dag(iso){try{return new Intl.DateTimeFormat('nl-NL',{weekday:'short',day:'numeric',month:'short'}).format(new Date(iso+'T12:00:00'))}catch(e){return iso}}
  function lang(iso){try{return new Intl.DateTimeFormat('nl-NL',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(iso+'T12:00:00'))}catch(e){return iso}}
  function euro(n){return new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(Number(n||0))}
  function glyph(n){return w.RTGGlyf&&w.RTGGlyf.svgHTML?w.RTGGlyf.svgHTML(n):''}
  function toekomst(b){return String(b.datum||'')>=new Date().toISOString().slice(0,10)}
  function afspraken(care,gezondheid){
    var leden=(care||[]).filter(toekomst).map(function(x){return{bron:'care',ref:x.ref,datum:x.datum,tijd:x.tijd||'',titel:x.behandelingNaam||'Zorgafspraak',onder:x.aanbiederNaam+(x.behandelaarNaam?' · '+x.behandelaarNaam:''),data:x}});
    var gezin=[];(gezondheid&&gezondheid.personen||[]).forEach(function(p){(p.afspraken||[]).filter(function(x){return !x.voorbij}).forEach(function(x){gezin.push({bron:'gezin',datum:x.datum,tijd:x.tijd||'',titel:x.wat||'Gezondheidsafspraak',onder:p.naam+(x.waar?' · '+x.waar:''),data:x})})});
    return leden.concat(gezin).sort(function(a,b){return(a.datum+a.tijd).localeCompare(b.datum+b.tijd)}).slice(0,4)
  }
  function tekenAfspraken(care,gezondheid){
    var doel=d.getElementById('fhAfspraken'),lijst=afspraken(care,gezondheid);
    if(!lijst.length){doel.innerHTML='<div class="fh-leeg">Er staat nog geen zorg- of gezondheidsafspraak in uw verbonden omgevingen. U kunt zelf een moment kiezen in RTG Care.</div>';return}
    doel.innerHTML=lijst.map(function(x){return '<article class="fh-afspraak"><time datetime="'+esc(x.datum+'T'+x.tijd)+'">'+esc(x.tijd||'Dag')+'<span class="fh-afspraak__datum">'+esc(dag(x.datum))+'</span></time><div class="fh-afspraak__tekst"><b>'+esc(x.titel)+'</b><span>'+esc(x.onder)+'</span></div>'+(x.bron==='care'?'<button type="button" data-fh-detail="'+esc(x.ref)+'" aria-label="Bekijk '+esc(x.titel)+'">'+glyph('rechterhand')+'</button>':'<a href="gezondheid.html" aria-label="Open gezondheid">'+glyph('rechterhand')+'</a>')+'</article>'}).join('')
  }
  function fout(tekst){d.getElementById('fhAfspraken').innerHTML='<div class="fh-fout">'+esc(tekst)+'</div>'}
  function begeleider(care){
    var nu=new Date().toISOString().slice(0,10),volgende=(care||[]).filter(function(x){return String(x.datum||'')>=nu}).sort(function(a,b){return(a.datum+a.tijd).localeCompare(b.datum+b.tijd)})[0],doel=d.getElementById('fhBegeleider');
    if(!volgende){doel.innerHTML='<div class="fh-leeg">Er is nog geen begeleider aan een komende RTG Care-afspraak verbonden. Zodra u boekt, verschijnt het echte zorgcontact hier.</div>';return null}
    var naam=volgende.behandelaarNaam||volgende.aanbiederNaam,letter=String(naam||'Z').trim().charAt(0).toUpperCase();
    doel.innerHTML='<div class="fh-contact"><span class="fh-contact__mark" aria-hidden="true">'+esc(letter)+'</span><div><small>Verbonden aan uw volgende afspraak</small><b>'+esc(naam)+'</b><span>'+esc(volgende.aanbiederNaam)+'</span></div></div><div class="fh-volgende"><span><b>'+esc(volgende.behandelingNaam)+'</b><br>'+esc(lang(volgende.datum))+'</span><strong>'+esc(volgende.tijd)+'</strong></div>';
    return volgende
  }
  function stappen(volgende){
    var doel=d.getElementById('fhStappen');
    if(!volgende){doel.innerHTML='<div class="fh-leeg">Uw stappen verschijnen hier zodra er een zorgafspraak is.</div>';return}
    var datumVoorbij=String(volgende.datum||'')<new Date().toISOString().slice(0,10),afgerond=volgende.status==='afgerond';
    var items=[{t:'Afspraak aangevraagd',s:'De aanbieder en het moment zijn vastgelegd.',klaar:true},{t:volgende.paid?'Betaling bevestigd':'Betaling nog nodig',s:volgende.paid?'Uw afspraak is betaald.':'Rond de betaling af om uw afspraak te bevestigen.',klaar:!!volgende.paid},{t:'Zorgmoment',s:lang(volgende.datum)+' om '+volgende.tijd+'.',klaar:datumVoorbij||afgerond},{t:'Afgerond',s:afgerond?'De zorgverlener heeft dit moment afgerond.':'Dit verandert alleen na bevestiging door de zorgverlener.',klaar:afgerond}];
    doel.innerHTML=items.map(function(x,i){return '<div class="fh-stap '+(x.klaar?'is-klaar':'')+'"><i aria-hidden="true">'+(x.klaar?'&#10003;':(i+1))+'</i><div><b>'+esc(x.t)+'</b><span>'+esc(x.s)+'</span></div></div>'}).join('')
  }
  function delen(intakes,beschikbaar){
    var doel=d.getElementById('fhDelen'),lijst=intakes||[];
    if(!beschikbaar){doel.innerHTML='<div class="fh-leeg">Log in bij RTG Care om actieve medische delingen te controleren.</div>';return}
    if(!lijst.length){doel.innerHTML='<div class="fh-leeg">Er is op dit moment geen aparte medische intake met een zorgaanbieder gedeeld.</div>';return}
    doel.innerHTML=lijst.map(function(x){return '<div class="fh-deling"><div><b>'+esc(x.aanbiederNaam)+'</b><span>Medische intake gedeeld tot en met '+esc(lang(x.vervaltOp))+'</span></div><em>Actief</em></div>'}).join('')
  }
  function detail(boeking){
    var dlg=d.getElementById('fhDetail');d.getElementById('fhDetailTitel').textContent=boeking.behandelingNaam||'Uw afspraak';
    d.getElementById('fhDetailInhoud').innerHTML='<div class="fh-detailrij"><small>Datum en tijd</small><b>'+esc(lang(boeking.datum))+' · '+esc(boeking.tijd)+'</b></div><div class="fh-detailrij"><small>Zorgverlener</small><b>'+esc(boeking.aanbiederNaam)+(boeking.behandelaarNaam?' · '+esc(boeking.behandelaarNaam):'')+'</b></div><div class="fh-detailrij"><small>Status</small><b>'+(boeking.paid?'Bevestigd en betaald':'Nog te betalen · '+esc(euro(boeking.prijs)))+'</b></div><div class="fh-dialogacties">'+(!boeking.paid?'<button class="is-hoofd" type="button" data-fh-betaal="'+esc(boeking.ref)+'">Nu betalen</button>':'')+'<button type="button" data-fh-annuleer="'+esc(boeking.ref)+'">Afspraak annuleren</button></div>';
    if(typeof dlg.showModal==='function')dlg.showModal()
  }
  w.RTGFoundationHulpBeeld={afspraken:tekenAfspraken,fout:fout,begeleider:begeleider,stappen:stappen,delen:delen,detail:detail};
})(window,document);
