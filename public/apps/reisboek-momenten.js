(function(w){
'use strict';
const icoon={vlucht:'✈',verblijf:'⌂',reis:'◇',activiteit:'◌',charter:'✈',leg:'→',programma:'·'};
function leeg(c,label,titel,tekst,actie){c.$('#inhoud').innerHTML='<div class="rb-leeg"><span>'+c.esc(label)+'</span><h2>'+c.esc(titel)+'</h2><p>'+c.esc(tekst)+'</p>'+(actie||'')+'</div>'}
function vandaag(c){
  const reis=c.actieveReis(),boekreis=c.actieveBoekreis(),lijn=c.tijdlijn(reis,boekreis),volgende=c.volgende(lijn);
  if(!reis&&!boekreis){leeg(c,'UW REISBOEK','Begin met de reis die voor u ligt.','Zet een reis in uw eigen boek. Daarna krijgen planning en documenten samen een rustige plek.','<button type="button" data-beheer>Voeg een reis toe</button>');c.bindBeheer();return}
  const bestemming=(reis&&reis.bestemming)||(boekreis&&boekreis.bestemming)||(boekreis&&boekreis.naam)||'Uw reis';
  const periode=c.periode(reis?reis.venster:{van:boekreis&&boekreis.van,tot:boekreis&&boekreis.tot});
  const momenten=lijn.length?lijn.map(x=>'<a class="rb-moment'+(volgende===x?' is-volgende':'')+'" href="'+c.esc(x.link||'#')+'"'+(x.link?'':' data-geen-link')+'><time>'+c.esc(x.tijd||c.korteDatum(x.datum)||'-')+'</time><span><b>'+c.esc(x.titel)+'</b><small>'+c.esc(x.sub||'')+'</small></span><i aria-hidden="true">'+c.esc(icoon[x.soort]||'◇')+'</i></a>').join(''):'<p class="rb-sub">Voor deze reis staan nog geen momenten met een datum in het boek.</p>';
  const nu=volgende?'<div class="rb-nu">Volgende: '+c.esc(volgende.titel)+(volgende.tijd?' om '+c.esc(volgende.tijd):'')+'</div>':'';
  const actie=volgende&&volgende.link?'<a class="rb-hoofdknop" href="'+c.esc(volgende.link)+'">Open '+c.esc(volgende.actie||'dit reismoment')+'</a>':'<button class="rb-hoofdknop" type="button" data-beheer>Werk mijn reis bij</button>';
  const boeken=(c.boek().reizen||[]).map(r=>'<button class="rb-reiskaart" type="button" data-open-reis="'+c.esc(r.id)+'"><b>'+c.esc(r.naam)+'</b><span>'+c.esc([r.bestemming,c.periode(r)].filter(Boolean).join(' · ')||'Open het draaiboek')+'</span></button>').join('');
  c.$('#inhoud').innerHTML='<div class="rb-dubbel"><section class="rb-sectie"><div class="rb-route"><div><span class="rb-label">UW REIS</span><h2>'+c.esc(bestemming)+'</h2><p>'+c.esc(periode||'De periode is nog niet ingevuld')+'</p></div><a href="/apps/reizen.html">Alles bekijken</a></div><div class="rb-tijdlijn">'+momenten+'</div>'+nu+actie+'</section><section class="rb-sectie"><span>UW EIGEN DRAAIBOEK</span><h2>Alles blijft bij elkaar.</h2><p class="rb-sub">Ook wat u zelf toevoegt, reist mee in hetzelfde boek.</p><div class="rb-reizen">'+(boeken||'<p class="rb-sub">Nog geen eigen reis toegevoegd.</p>')+'</div><button class="rb-stilknop" type="button" data-beheer>Reis toevoegen of beheren</button></section></div>';
  c.$$('#inhoud [data-geen-link]').forEach(a=>a.addEventListener('click',e=>e.preventDefault()));c.bindBeheer();
}
function documenten(c){
  const docs=c.documenten(),aandacht=docs.filter(x=>x.klasse==='fout'||x.klasse==='aandacht').length;
  const lijst=docs.length?docs.map(d=>'<div class="rb-document"><i aria-hidden="true">'+c.esc(d.icoon)+'</i><div><b>'+c.esc(d.naam)+'</b><small>'+c.esc(d.reis||'TravelOS')+'</small></div><em class="'+c.esc(d.klasse||'')+'">'+c.esc(d.status)+'</em></div>').join(''):'<div class="rb-leeg"><span>UW DOCUMENTEN</span><h2>Nog niets opgenomen.</h2><p>Voeg alleen de documentsoort en geldigheid toe. Gevoelige nummers horen hier niet in beeld.</p><button type="button" data-beheer>Voeg een document toe</button></div>';
  c.$('#inhoud').innerHTML='<section class="rb-sectie"><span>UW DOCUMENTEN</span><h2>Alles wat u nodig heeft. Op zijn plaats.</h2><p class="rb-sub">'+(aandacht?aandacht+' document'+(aandacht===1?' vraagt':'en vragen')+' uw aandacht.':'Uw opgenomen documenten staan rustig bij de juiste reis.')+'</p><div class="rb-doclijst">'+lijst+'</div><p class="rb-privacy">Uw documenten blijven van u. Nummers en bewijsstukken worden hier niet getoond.</p><button class="rb-hoofdknop" type="button" data-beheer>Bekijk mijn documenten</button></section>';
  c.bindBeheer();
}
function wijzigingen(c){
  const wacht=c.wacht(),reizen=(wacht.reizen||[]).filter(r=>(r.signalen||[]).length),stil=(wacht.stil||[]),bronnen=(wacht.bronnen||[]);
  let inhoud='';
  if(reizen.length){
    inhoud=reizen.map(r=>'<article class="rb-signaal"><div class="rb-signaal-kop"><i aria-hidden="true">!</i><div><b>'+c.esc(r.bestemming)+'</b><small>'+c.esc(c.periode(r.venster))+'</small></div></div><div class="rb-impact" aria-label="Wat een wijziging kan raken"><b><i>✈</i>Vlucht</b><i>→</i><b><i>◇</i>Vervoer</b><i>→</i><b><i>⌂</i>Aankomst</b><i>→</i><b><i>▣</i>Verblijf</b></div>'+r.signalen.map(s=>'<div class="rb-signaal-kop"><i aria-hidden="true">'+(s.ernst==='incident'?'!':'△')+'</i><div><b>'+c.esc(s.tekst)+'</b><small>Bron: '+c.esc(s.bron)+' · '+c.esc(s.grond)+'</small></div></div>').join('')+'<button class="rb-stilknop" type="button" data-los="'+c.esc(r.id)+'">Bekijk wat mogelijk is</button><div class="rb-voorstellen" data-losuit="'+c.esc(r.id)+'"></div></article>').join('');
  }else{
    inhoud='<div class="rb-leeg"><span>DE GEMETEN BRONNEN</span><h2>Geen aandachtspunt gevonden.</h2><p>Dit is een momentopname van de bronnen die RTG nu kon meten. Het is geen achtergrondbewaking.</p><button type="button" data-ververs>Meet opnieuw</button></div>';
  }
  const bronregels=bronnen.map(b=>'<p><b>'+c.esc(b.naam)+'</b> · '+c.esc(b.stand)+(b.stand==='gemeten'?'':' - '+c.esc(b.uitleg||''))+'</p>').join('');
  c.$('#inhoud').innerHTML='<section class="rb-sectie"><span>ALS IETS VERANDERT</span><h2>Uw reis blijft begrijpelijk.</h2><p class="rb-sub">TravelOS laat zien wat er speelt en wat u kunt doen. Het past niets zelfstandig aan.</p>'+inhoud+(stil.length?'<p class="rb-grens">Dit beeld is onvolledig: '+c.esc(stil.join(', '))+' deed niet mee.</p>':'')+'<a class="rb-stilknop" href="/apps/comm.html">Praat met TravelOS</a><p class="rb-grens">Niets wordt aangepast zonder uw akkoord.</p><details class="rb-bronnen"><summary>Welke bronnen zijn gemeten?</summary>'+bronregels+'<p>'+c.esc(wacht.uitleg||'')+'</p></details></section>';
  c.$$('#inhoud [data-los]').forEach(b=>b.addEventListener('click',()=>c.losOp(b)));const v=c.$('[data-ververs]');if(v)v.addEventListener('click',()=>c.herlaadWacht(v));
}
w.RTGReisboekMomenten={vandaag,documenten,wijzigingen,leeg};
})(window);
