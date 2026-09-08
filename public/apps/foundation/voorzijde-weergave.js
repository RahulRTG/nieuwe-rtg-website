/* Presentatielaag voor de persoonlijke FoundationOS-voorzijde. Alle inhoud
   komt uit de bestaande gezins-, agenda-, leer- en bandenbronnen. */
(function(w,d){
  'use strict';
  function el(id){return d.getElementById(id)}
  function esc(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function initialen(naam){return String(naam||'RT').trim().split(/\s+/).slice(0,2).map(function(x){return x.charAt(0)}).join('').toUpperCase()||'RT'}
  function dagNaam(iso){var n=new Date(iso+'T12:00:00');var v=new Date();var m=new Date(v);m.setDate(v.getDate()+1);var zelf=function(x){return x.toISOString().slice(0,10)};if(iso===zelf(v))return'Vandaag';if(iso===zelf(m))return'Morgen';return n.toLocaleDateString('nl-NL',{weekday:'short',day:'numeric'})}
  function dag(info,items){
    var p=info.profiel||{},naam=p.naam||'u';el('rtfVoorNaam').textContent=naam;el('rtfVoorInit').textContent=initialen(naam);el('rtfGroeiInit').textContent=initialen(naam);
    var uur=new Date().getHours();el('rtfGroet').textContent=(uur<12?'Goedemorgen, ':uur<18?'Goedemiddag, ':'Goedenavond, ')+naam;
    el('rtfDatum').textContent=new Date().toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long'});
    var vak=el('rtfDagLijst'),rijen=(items||[]).slice(0,6);vak.innerHTML=rijen.length?rijen.map(function(x){var bron=x.bron==='school'?'Van school':(x.wieNaam?'Voor '+x.wieNaam:'Voor het gezin');return '<a class="rtf-thuis-regel" href="agenda.html"><time>'+esc(x.tijd||dagNaam(x.datum))+'</time><div><b>'+esc(x.titel)+'</b><span>'+esc(bron+(x.notitie?' - '+x.notitie:''))+'</span></div><em aria-hidden="true">&rarr;</em></a>'}).join(''):'<p class="rtf-thuis-leeg">Er staat niets in uw agenda voor de komende dagen. De ruimte is van u.</p>';
  }
  function groei(info,pas,plan){
    var p=info.profiel||{},kind=p.rol==='kind',fase=pas&&pas.fase;
    el('rtfGroeiFase').textContent=fase?fase.naam+(pas.jaar?' - jaar '+pas.jaar:''):(kind?'Uw leerpaspoort':'Uw eigen volgende stap');
    el('rtfGroeiUitleg').textContent=fase?'Wat u opbouwt reist met u mee, zonder vergelijking met een ander.':(kind?'Kies in uw leerpaspoort rustig waar u wilt beginnen.':'Leren, hulp en nieuwe kansen staan bij elkaar wanneer u ze nodig heeft.');
    var doelen=pas?Object.keys(pas.doelen||{}).length:0,historie=pas?(pas.historie||[]).length:0;
    el('rtfGroeiDoelen').innerHTML=kind?'<div class="rtf-groei-doel"><b>'+doelen+'</b><span>leerdoelen met bewijs in uw eigen paspoort</span></div><div class="rtf-groei-doel"><b>'+historie+'</b><span>stappen op uw persoonlijke leerroute</span></div>':'<div class="rtf-groei-doel"><b>Vrij</b><span>leren wanneer het in uw leven past</span></div><div class="rtf-groei-doel"><b>Menselijk</b><span>advies helpt, een mens beslist</span></div>';
    var stukken=plan&&plan.stukken||[],vol=el('rtfGroeiVolgende');
    if(stukken.length){vol.innerHTML=stukken.slice(0,4).map(function(x){return '<a class="rtf-thuis-regel" href="leerpaspoort.html"><time>'+esc(x.vak||'Leren')+'</time><div><b>'+esc(x.naam)+'</b><span>'+esc(x.waarom||'Past in uw leerroute')+'</span></div><em aria-hidden="true">&rarr;</em></a>'}).join('');return}
    var opties=kind?[['Leerpaspoort','Uw doelen, bewijs en uitleg bij elkaar','leerpaspoort.html'],['Campus','Leren, maken en ontdekken','campus.html']]:[['Verder leren','Een studie kiezen die bij uw leven past','studie.html'],['Hulpwijzer','De juiste steun zonder zelf te hoeven zoeken','hulpwijzer.html']];
    vol.innerHTML=opties.map(function(x){return '<a class="rtf-thuis-regel" href="'+x[2]+'"><time>'+esc(x[0])+'</time><div><b>'+esc(x[1])+'</b><span>Open wanneer u eraan toe bent</span></div><em aria-hidden="true">&rarr;</em></a>'}).join('');
  }
  function kring(info,stand){
    var eigen=info.profiel||{},profielen=info.profielen||[];el('rtfFamilie').innerHTML=profielen.map(function(p){var rol=p.id===eigen.id?'U':(p.rol==='kind'?'Kind':p.rol==='gast'?'Gast':'Gezin');return '<div class="rtf-kring-persoon"><i style="background:' + esc(p.kleur||'#861936')+'">'+esc(initialen(p.naam))+'</i><b>'+esc(p.naam)+'</b><span>'+esc(rol)+'</span></div>'}).join('')||'<p class="rtf-thuis-leeg">Er zijn nog geen andere gezinsprofielen.</p>';
    var banden=stand&&stand.banden||[],vak=el('rtfKringLijst');
    vak.innerHTML=banden.length?banden.slice(0,6).map(function(b){var open=b.staat==='gevraagd',status=open?(b.ikVroeg?'Wacht op antwoord':'Uw antwoord nodig'):(b.staat==='verlopen'?'Verlopen':(b.ikDeel||[]).length+' onderdeel(en) gedeeld');var detail=open?'Een band ontstaat pas na bevestiging.':((b.ikDeel||[]).length?b.ikDeel.map(function(x){return x.wat}).join(', '):'U deelt nog niets met deze persoon.');return '<a class="rtf-thuis-regel rtf-kring-regel" href="mijnbanden.html"><i class="rtf-kring-avatar">'+esc(initialen(b.ander))+'</i><div><b>'+esc(b.ander)+'</b><span>'+esc(detail)+'</span><span class="rtf-kring-status">'+esc(status)+'</span></div><em aria-hidden="true">&rarr;</em></a>'}).join(''):'<p class="rtf-thuis-leeg">U heeft nog geen persoonlijke banden. Ook zonder band wordt er niets gedeeld.</p>';
  }
  w.RTGFoundationVoorzijdeBeeld={dag:dag,groei:groei,kring:kring};
})(window,document);
