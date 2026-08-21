/* een functie globaal aan- of uitzetten */
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

