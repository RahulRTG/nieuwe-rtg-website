/* het doelgroepfilter met chips, en het zoeken erin */
  /* ---------- doelgroep-filter (chips) + zoeken ---------- */
  function chip(id, label, kleur){
    var actief = actieveDg===id;
    var kids = [];
    if (kleur) kids.push(el('span',{class:'dot', style:{background:kleur}}));
    kids.push(label);
    return el('button',{class:'chip', 'aria-pressed':actief?'true':'false',
      onclick:function(){ actieveDg=id; tekenChips(); updBulk(); tekenFuncties(); }}, kids);
  }
  function tekenChips(){
    var chips = [ chip(null, 'Overzicht', null) ];
    doelgroepenMeta.forEach(function(d){ chips.push(chip(d.id, d.emoji+' '+d.naam, d.kleur)); });
    vervang($('#dgChips'), chips);
  }
  function past(f){
    if (actieveDg && !(f.doelgroepen||[]).some(function(d){ return d.id===actieveDg; })) return false;
    if (zoekterm){ var s=(f.naam+' '+(f.uitleg||'')).toLowerCase(); if (s.indexOf(zoekterm)<0) return false; }
    return true;
  }
  function tekenFuncties(){
    var groepen = catData.map(function(g){ return { categorie:g.categorie, functies:g.functies.filter(past) }; })
                         .filter(function(g){ return g.functies.length; });
    var blokken = groepen.map(categorieBlok).filter(Boolean);
    vervang($('#functies'), blokken.length ? blokken : el('div',{class:'muted', style:{padding:'.6rem 0'}}, 'Geen functies gevonden voor deze filter.'));
    if (actieveDg){ var m=dgMeta(actieveDg); Util.tekst($('#ctxUitleg'), m.naam+' · '+(m.uitleg||'')+' Wijzigingen hier gelden alleen voor deze doelgroep.'); }
    else Util.tekst($('#ctxUitleg'), 'Overzicht: de grote knop zet een functie globaal aan of uit; de gekleurde pillen sturen per doelgroep bij (bijv. wel voor RTG-leden, niet voor Lifestyle).');
  }
  function updBulk(){
    var suffix = actieveDg ? (' voor '+dgMeta(actieveDg).naam) : '';
    Util.tekst($('#bAllesAan'), 'Alles aan'+suffix);
    Util.tekst($('#bAllesUit'), 'Alles uit'+suffix);
  }
  $('#fnZoek').addEventListener('input', function(){ zoekterm=this.value.trim().toLowerCase(); tekenFuncties(); });
  $('#bAllesAan').addEventListener('click', function(){ var b={ alles:true, aan:true }; if(actieveDg) b.doelgroep=actieveDg; zetFunctie(b); });
  $('#bAllesUit').addEventListener('click', function(){
    var wat = actieveDg ? ('alles voor '+dgMeta(actieveDg).naam) : 'ALLE functionaliteiten';
    if (!confirm('Weet je het zeker? Dit maakt een aanvraag om '+wat+' uit te zetten. Er verandert pas iets nadat de eigenaar de aanvraag accepteert.')) return;
    var b={ alles:true, aan:false }; if(actieveDg) b.doelgroep=actieveDg; zetFunctie(b);
  });

  /* ---------- AI-hulp voor de controlekamer ---------- */
  var aiVoorstelData = [];
  function voorstelRij(w){
    var m = w.doelgroep ? dgMeta(w.doelgroep) : null;
    return el('div',{class:'voorstelrij'},
      el('span',{class:'tag', style:{color:w.aan?'#7EE0A3':'#F4B8C6'}}, w.aan?'AAN':'UIT'),
      el('span',{style:{flex:'1',minWidth:'0'}}, w.naam||w.id),
      el('span',{class:'muted'}, m ? (m.emoji+' '+m.naam) : 'globaal'));
  }
  $('#bAiVraag').addEventListener('click', function(){
    var v=$('#aiVraag').value.trim(); if(!v){ toast('Typ eerst een vraag of instructie.'); return; }
    var b=$('#bAiVraag'); b.disabled=true; Util.tekst(b,'AI denkt na…');
    api('/api/techniek/functie/ai', { method:'POST', body:{ vraag:v } })
      .then(function(d){
        b.disabled=false; Util.tekst(b,'Vraag de AI');
        $('#aiAntwoord').hidden=false; Util.tekst($('#aiAntwoord'), d.antwoord||'');
        Util.tekst($('#aiBron'), d.bron==='ai' ? 'AI-antwoord' : 'ingebouwde taal-hulp');
        aiVoorstelData = d.voorstel||[];
        if (aiVoorstelData.length){ $('#aiVoorstelBlok').hidden=false; vervang($('#aiVoorstel'), aiVoorstelData.map(voorstelRij)); }
        else $('#aiVoorstelBlok').hidden=true;
      })
      .catch(function(e){ b.disabled=false; Util.tekst(b,'Vraag de AI'); toast(e.message); });
  });
  $('#bAiVoorstel').addEventListener('click', function(){
    if(!aiVoorstelData.length) return;
    var lijst = aiVoorstelData.slice();
    (function volgende(i){
      if (i>=lijst.length){ toast(lijst.length+' aanvraag(-vragen) ingediend. De eigenaar accepteert ze nog.'); laad(); return; }
      api('/api/techniek/functie', { method:'POST', body:{ id:lijst[i].id, doelgroep:lijst[i].doelgroep||undefined, aan:lijst[i].aan } })
        .then(function(){ volgende(i+1); }).catch(function(){ volgende(i+1); });
    })(0);
    $('#aiVoorstelBlok').hidden=true; aiVoorstelData=[];
  });

  /* ---------- beveiliging (inbraakdetectie) ---------- */
  var ernstKleur = { kritiek:'fout', waarschuwing:'waarschuwing', info:'ok' };
  function beveiligRij(m){
    var kop = el('div', null,
      el('span',{class:'naam'}, m.tekst),
      m.aantal>1 ? el('span',{class:'code'}, m.aantal+'x') : null,
      m.afgehandeld ? el('span',{class:'code'}, 'gezien') : null);
    return el('div',{class:'rij', style: m.afgehandeld?{opacity:'.55'}:null},
      el('div',{class:'bol '+(ernstKleur[m.ernst]||'waarschuwing')}),
      el('div',{class:'mid'}, kop, el('div',{class:'detail'}, new Date(m.at).toLocaleString('nl-NL'))));
  }
  function bevAfhandelen(){
    api('/api/techniek/beveiliging/afhandelen', { method:'POST', body:{} })
      .then(function(){ toast('Beveiligingsmeldingen als gezien gemarkeerd.'); laad(); })
      .catch(function(e){ toast(e.message); });
  }
  $('#bBevAf').addEventListener('click', bevAfhandelen);

  /* ---------- storingen (eigen fout-aggregatie) ---------- */
  function foutRij(g){
    var nu = Date.now();
    var vers = (nu - g.laatst) < 15*60000; // recent = laatste kwartier -> rood, anders oranje
    var kop = el('div', null,
      el('span',{class:'naam'}, g.bericht),
      g.aantal>1 ? el('span',{class:'code'}, g.aantal+'x') : null);
    var meta = new Date(g.laatst).toLocaleString('nl-NL') + (g.waar ? ' · ' + g.waar : '');
    return el('div',{class:'rij'},
      el('div',{class:'bol '+(vers?'fout':'waarschuwing')}),
      el('div',{class:'mid'}, kop, el('div',{class:'detail'}, meta)));
  }
  $('#bFoutenWis').addEventListener('click', function(){
    if (!confirm('De storingslijst wissen? De tellers beginnen weer bij nul.')) return;
    api('/api/techniek/fouten/wis', { method:'POST', body:{} })
      .then(function(){ toast('Storingslijst gewist.'); laad(); })
      .catch(function(e){ toast(e.message); });
  });
  var noodremAan = true;
  $('#bBevAuto').addEventListener('click', function(){
