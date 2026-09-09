/* Weergave van Leren & Groei. Een taak, vak of stap verschijnt alleen als de
   bestaande leerroute hem teruggeeft; dit scherm maakt geen eigen score. */
(function(w,d){
  'use strict';
  function el(id){return d.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
  function titel(v){var s=String(v||'leren').replace(/[-_]/g,' ');return s.charAt(0).toUpperCase()+s.slice(1)}
  function iconen(){if(w.RTGGlyf&&w.RTGGlyf.vul)w.RTGGlyf.vul()}
  function dag(plan){
    var doel=el('lgDag'),stukken=plan&&plan.stukken||[];
    if(!stukken.length){doel.innerHTML='<div class="lg-leeg">'+esc(plan&&plan.let||'Er staat nog geen leerroute klaar. Kies eerst uw fase in het leerpaspoort.')+'</div>';return}
    doel.innerHTML=stukken.map(function(x){return '<a class="lg-taak" href="leerpaspoort.html" data-lg-doel="'+esc(x.doel)+'"><i class="lg-taak__icoon" data-glyf="'+(x.soort==='herhalen'?'agenda':'diploma')+'"></i><div><small>'+esc(x.soort==='herhalen'?'Even ophalen':'Volgende stap')+'</small><b>'+esc(x.naam)+'</b><span>'+esc(titel(x.vak))+' - '+esc(x.waarom)+'</span></div><i aria-hidden="true">&rarr;</i></a>'}).join('');iconen()
  }
  function telling(vakken){var totaal=0,klaar=0;(vakken||[]).forEach(function(v){(v.doelen||[]).forEach(function(x){totaal++;if(x.behaald)klaar++})});return{totaal:totaal,klaar:klaar}}
  function groei(pas,plan,vakken){
    var tel=telling(vakken),fase=pas&&pas.fase,bezig=!!(plan&&plan.stukken&&plan.stukken.length),rond=tel.totaal>0&&tel.klaar===tel.totaal;
    el('lgGroeipad').innerHTML=[{t:'Ontdekt',s:fase?fase.naam+' is uw huidige fase.':'Kies eerst uw fase.',k:!!fase},{t:'Aan het oefenen',s:bezig?'Uw volgende stappen liggen klaar.':'Er staat nu geen oefenstap klaar.',k:bezig},{t:'Volgende trede',s:rond?'Deze fase is rond; bekijk wat hierna past.':'Rustig verder in uw eigen route.',k:rond}].map(function(x){return '<div class="lg-padstap '+(x.k?'is-klaar':'')+'"><b>'+esc(x.t)+'</b><span>'+esc(x.s)+'</span></div>'}).join('');
    var vak=el('lgVakken');
    if(!(vakken||[]).length){vak.innerHTML='<div class="lg-leeg">Er zijn nog geen vakken aan een gekozen leerfase verbonden.</div>'}
    else {vak.innerHTML=vakken.slice(0,6).map(function(v){var n=(v.doelen||[]).length,k=(v.doelen||[]).filter(function(x){return x.behaald}).length,p=n?Math.round(k/n*100):0;return '<a class="lg-vak" href="leerpaspoort.html"><i class="lg-vak__icoon" data-glyf="diploma"></i><div><b>'+esc(v.vak)+'</b><span>'+k+' van '+n+' leerdoelen hebben bewijs</span><div class="lg-meter" aria-hidden="true"><i data-lg-voortgang="'+p+'"></i></div></div><em aria-hidden="true">&rarr;</em></a>'}).join('');vak.querySelectorAll('[data-lg-voortgang]').forEach(function(meter){meter.style.width=meter.dataset.lgVoortgang+'%'})}
    var trots=el('lgTrots');
    if(tel.klaar){trots.innerHTML='<i data-glyf="ster"></i><div><b>Hier mag u trots op zijn</b><span>'+tel.klaar+' leerdoel'+(tel.klaar===1?' heeft':'en hebben')+' inmiddels bewijs in uw eigen paspoort.</span></div>'}
    else trots.innerHTML='<i data-glyf="rtf"></i><div><b>Groeien begint met proberen</b><span>Uw eerste bewijs verschijnt pas wanneer een echte oefening of begeleider het heeft vastgelegd.</span></div>';
    iconen()
  }
  function onderwerpen(vakken,geselecteerd){
    var namen=(vakken||[]).map(function(v){return v.vak}).filter(function(v,i,a){return v&&a.indexOf(v)===i}).slice(0,5);namen.push('Iets anders');
    el('lgOnderwerpen').innerHTML=namen.map(function(n,i){var aan=geselecteerd?geselecteerd===n:i===0;return '<button type="button" role="radio" aria-checked="'+aan+'" class="'+(aan?'is-actief':'')+'" data-lg-onderwerp="'+esc(n)+'">'+esc(titel(n))+'</button>'}).join('');return namen[0]||'Iets anders'
  }
  function gesprek(beurten,wacht){
    var lijst=(beurten||[]).slice(-12),doel=el('lgGesprek');
    doel.innerHTML=lijst.map(function(b){var ik=b.rol==='user';return '<div class="lg-beurt '+(ik?'ik':'rahul')+'"><small>'+(ik?'Uw vraag':'Rahul Bijles')+'</small>'+esc(b.tekst)+'</div>'}).join('')+(wacht?'<div class="lg-beurt rahul"><small>Rahul Bijles</small>Ik kijk met u mee...</div>':'');
  }
  function fout(plek,tekst){el(plek).innerHTML='<div class="lg-fout">'+esc(tekst)+'</div>'}
  w.RTGFoundationLerenBeeld={dag:dag,groei:groei,onderwerpen:onderwerpen,gesprek:gesprek,fout:fout,iconen:iconen};
})(window,document);
