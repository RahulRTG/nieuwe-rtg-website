      if (!dEntry) return null; // deze functie bedient deze doelgroep niet
      var aan1 = dEntry.aan, wacht1 = isWacht(f.id, actieveDg);
      var schakel1 = el('button',{class:'schakel '+(aan1?'aan':'uit'), disabled: wacht1||null,
        'aria-label':(aan1?'Uitzetten':'Aanzetten')+' voor '+dgMeta(actieveDg).naam+': '+f.naam,
        onclick:function(){ zetFunctie({ id:f.id, doelgroep:actieveDg, aan:!aan1 }); }}, aan1?'AAN':'UIT');
      return el('div',{class:'fn'},
        el('div',{class:'mid'},
          el('div',{class:'naam'}, f.naam,
            !f.aan ? el('span',{class:'code'}, 'globaal uit') : null,
            wacht1 ? el('span',{class:'code'}, 'aanvraag wacht') : null),
          el('div',{class:'muted'}, f.uitleg||'')),
        schakel1);
    }
    // overzicht: globale schakel + doelgroep-pillen (alleen als >1 doelgroep)
    var wachtG = isWacht(f.id, null);
    var schakel = el('button',{class:'schakel '+(f.aan?'aan':'uit'), disabled: wachtG||null,
      'aria-label':(f.aan?'Globaal uitzetten: ':'Globaal aanzetten: ')+f.naam,
      onclick:function(){ zetFunctie({ id:f.id, aan:!f.aan }); }}, f.aan?'AAN':'UIT');
    return el('div',{class:'fn'},
      el('div',{class:'mid'},
        el('div',{class:'naam'}, f.naam, wachtG ? el('span',{class:'code'}, 'aanvraag wacht') : null),
        el('div',{class:'muted'}, f.uitleg||''),
        (f.doelgroepen && f.doelgroepen.length>1) ? el('div',{class:'pills'}, f.doelgroepen.map(function(d){ return pil(f,d); })) : null),
      schakel);
  }
  function verzoekRij(v){
    var wanneer = new Date(v.at).toLocaleString('nl-NL');
    var mid = el('div',{class:'mid'},
      el('div',{class:'naam'}, v.label, el('span',{class:'code'}, v.wijzigingen.length+' functie(s)')),
      el('div',{class:'muted'}, 'aangevraagd door '+v.doorNaam+' op '+wanneer));
    if (v.status !== 'wacht'){
      return el('div',{class:'zeker'},
        el('span',{class:'badge '+(v.status==='akkoord'?'aan':'uit')}, v.status==='akkoord'?'GEACCEPTEERD':'GEWEIGERD'), mid);
    }
    var acties;
    if (eigenaar){
      acties = el('div',{style:{display:'flex',gap:'.4rem',flexShrink:0}},
        el('button',{class:'knop klein', onclick:function(){ besluit(v.vid, true); }}, 'Accepteren'),
        el('button',{class:'knop rood klein', onclick:function(){ besluit(v.vid, false); }}, 'Weigeren'));
    } else {
      acties = el('span',{class:'badge uit'}, 'WACHT OP EIGENAAR');
    }
    return el('div',{class:'zeker'}, el('span',{class:'badge uit'}, 'WACHT'), mid, acties);
  }
  function besluit(vid, akkoord){
    api('/api/techniek/functie/besluit', { method:'POST', body:{ verzoekId:vid, akkoord:akkoord } })
      .then(function(d){ toast(d.status==='akkoord'?'Geaccepteerd en doorgevoerd.':'Geweigerd; er is niets veranderd.'); laad(); })
      .catch(function(e){ toast(e.message); });
  }
  function functieAan(f){
    if (actieveDg){ for (var i=0;i<(f.doelgroepen||[]).length;i++) if (f.doelgroepen[i].id===actieveDg) return f.doelgroepen[i].aan; return true; }
    return f.aan;
  }
  function categorieBlok(g){
    var rijen = g.functies.map(functieRij).filter(Boolean);
    if (!rijen.length) return null;
    var totaal = g.functies.length;
    var aan = g.functies.filter(functieAan).length;
    var storing = g.functies.filter(function(f){ return isWacht(f.id, actieveDg||null); }).length;
    // Alleen categorieën met iets uit of een wachtende aanvraag klappen vanzelf
    // open; de rest blijft rustig samengevat.
    var afwijkt = aan < totaal || storing > 0;
    var bulk = function(aan2){ return function(){ var b={ categorie:g.categorie, aan:aan2 }; if(actieveDg) b.doelgroep=actieveDg; zetFunctie(b); }; };
    var kaart = el('div',{class:'kaart', hidden: afwijkt ? null : true}, rijen);
    var chev = el('span',{class:'catchev'}, afwijkt ? '▾' : '▸');
    var tel = el('span',{class:'cattel'+(afwijkt?' let':'')}, aan+'/'+totaal+' aan'+(storing?' · '+storing+' aanvraag':''));
    var kop = el('button',{class:'catklap', type:'button', 'aria-expanded': afwijkt?'true':'false'},
      chev, el('h2', null, g.categorie), tel);
    kop.addEventListener('click', function(){
      var dicht = kaart.hidden;
      kaart.hidden = !dicht;
      chev.textContent = dicht ? '▾' : '▸';
      kop.setAttribute('aria-expanded', dicht ? 'true' : 'false');
    });
    return el('div', null,
      el('div',{class:'catkop'},
        kop,
        el('div',{style:{display:'flex',gap:'.4rem'}},
          el('button',{class:'knop grijs klein', onclick:bulk(true)}, 'Alles aan'),
          el('button',{class:'knop grijs klein', onclick:bulk(false)}, 'Alles uit'))),
      kaart);
  }

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
