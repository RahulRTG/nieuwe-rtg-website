(function(){
  var $ = function(s){ return document.querySelector(s); };
  var el = Util.el, vervang = Util.vervang;
  var token = sessionStorage.getItem('techToken') || null;
  var eigenaar = false;
  var timer = null;

  function toast(t){ var e=$('#toast'); Util.tekst(e,t); e.style.opacity='1'; clearTimeout(e._t); e._t=setTimeout(function(){e.style.opacity='0';},2200); }

  function api(pad, opties){
    opties = opties || {};
    var h = { 'content-type':'application/json' };
    if (token) h['authorization'] = 'Bearer ' + token;
    return fetch(pad, { method: opties.method||'GET', headers:h, body: opties.body?JSON.stringify(opties.body):undefined })
      .then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error||('Fout '+r.status)); return j; }); });
  }

  function toonLogin(){ $('#vLogin').hidden=false; $('#vBord').hidden=true; }
  function toonBord(){ $('#vLogin').hidden=true; $('#vBord').hidden=false; }

  $('#bLogin').addEventListener('click', function(){
    $('#loginFout').textContent='';
    api('/api/techniek/inloggen', { method:'POST', body:{ login:$('#liLogin').value.trim(), wachtwoord:$('#liPass').value } })
      .then(function(d){ token=d.token; sessionStorage.setItem('techToken', token); start(); })
      .catch(function(e){ $('#loginFout').textContent = e.message; });
  });
  $('#liPass').addEventListener('keydown', function(e){ if(e.key==='Enter') $('#bLogin').click(); });
  $('#bUit').addEventListener('click', function(){ token=null; sessionStorage.removeItem('techToken'); if(timer)clearInterval(timer); toonLogin(); });
  $('#bVernieuw').addEventListener('click', function(){ laad(); });

  function tellerKaart(n, label){ return el('div',{class:'tel'}, el('div',{class:'n'}, String(n)), el('div',{class:'l'}, label)); }

  function checkRij(c){
    var mid = el('div',{class:'mid'},
      el('div', null, el('span',{class:'naam'}, c.naam), el('span',{class:'code'}, c.code)),
      el('div',{class:'detail'}, c.detail)
    );
    var acties = el('div',null);
    if (c.status !== 'ok'){
      var knop = el('button',{class:'knop grijs klein', onclick:function(){
        knop.disabled=true; Util.tekst(knop,'AI denkt na...');
        api('/api/techniek/ai', { method:'POST', body:{ checkId:c.id } })
          .then(function(d){ var adv=el('div',{class:'advies'}, d.advies); mid.appendChild(adv); knop.remove(); })
          .catch(function(e){ knop.disabled=false; Util.tekst(knop,'AI: los op'); toast(e.message); });
      }}, 'AI: los op');
      acties.appendChild(knop);
    }
    return el('div',{class:'rij'}, el('div',{class:'bol '+c.status}), mid, acties);
  }

  function zekerRij(z){
    var badge = el('span',{class:'badge '+(z.aan===false?'uit':'aan')}, z.aan===false?'GESPRONGEN':'AAN');
    var mid = el('div',{class:'mid'},
      el('div',null, el('span',{class:'naam'}, z.naam), el('span',{class:'code'}, z.code)),
      el('div',{class:'muted'}, z.uitleg || ''),
      z.aan===false && z.reden ? el('div',{class:'muted', style:{color:'#F4B8C6'}}, 'Reden: '+z.reden) : null
    );
    var knop;
    if (z.aan===false){
      knop = el('button',{class:'knop klein', onclick:function(){ zetZekering(z.id,'reset'); }}, 'Zekering erin');
    } else {
      knop = el('button',{class:'knop rood klein', onclick:function(){
        var reden = prompt('Waarom deze zekering uitschakelen? ('+z.naam+')','handmatig'); if(reden===null) return;
        zetZekering(z.id,'spring',reden);
      }}, 'Zekering eruit');
    }
    return el('div',{class:'zeker'}, badge, mid, knop);
  }
  function zetZekering(id, actie, reden){
    api('/api/techniek/zekering', { method:'POST', body:{ id:id, actie:actie, reden:reden } })
      .then(function(){ toast(actie==='reset'?'Zekering er weer in.':'Zekering eruit.'); laad(); })
      .catch(function(e){ toast(e.message); });
  }

  document.addEventListener('click', function(ev){
    if (ev.target && ev.target.id === 'archiefZet'){
      var n = Number($('#archiefDagen').value);
      api('/api/techniek/archief', { method:'POST', body:{ dagen:n } })
        .then(function(r){ toast(r.verplaatst + ' verhuisd \u00B7 nu ' + r.levend.toLocaleString('nl-NL') + ' levend.'); laad(); })
        .catch(function(e){ toast(e.message); });
    }
  });
  function toegangRij(t){
    var knop = el('button',{class:'knop grijs klein', onclick:function(){
      api('/api/techniek/toegang', { method:'POST', body:{ email:t.email, actie:'intrek' } }).then(function(){ toast('Toegang ingetrokken.'); laad(); }).catch(function(e){ toast(e.message); });
    }}, 'Intrekken');
    return el('div',{class:'zeker'}, el('div',{class:'mid'}, el('div',{class:'naam'}, t.naam||'?'), el('div',{class:'muted'}, t.email||('#'+t.id))), knop);
  }
  $('#bGrant').addEventListener('click', function(){
    $('#grantFout').textContent='';
    api('/api/techniek/toegang', { method:'POST', body:{ email:$('#grantEmail').value.trim(), actie:'verleen' } })
      .then(function(){ $('#grantEmail').value=''; toast('Toegang gegeven.'); laad(); })
      .catch(function(e){ $('#grantFout').textContent = e.message; });
  });

  /* ---------- modernisering: de eigenaar vraagt de AI om een update ---------- */
  function modRij(m){
    return el('div',{class:'zeker'},
      el('span',{class:'badge uit'}, 'VOORSTEL'),
      el('div',{class:'mid'},
        el('div',{class:'naam'}, m.verzoek),
        el('div',{class:'muted', style:{fontSize:'.72rem'}}, new Date(m.at).toLocaleString('nl-NL') + (m.door ? ' · ' + m.door : ''))));
  }
  $('#bMod').addEventListener('click', function(){
    var v = $('#modVraag').value.trim(); if(!v){ toast('Beschrijf eerst kort uw verzoek.'); return; }
    var b = $('#bMod'); b.disabled = true; Util.tekst(b, 'AI denkt na…');
    api('/api/techniek/moderniseer', { method:'POST', body:{ verzoek:v } })
      .then(function(d){
        b.disabled = false; Util.tekst(b, 'Vraag de AI');
        $('#modPlan').hidden = false; Util.tekst($('#modPlan'), d.plan || '');
        Util.tekst($('#modBron'), d.bron === 'ai' ? 'AI-advies' : 'ingebouwd advies');
        $('#modVraag').value = '';
        toast('Vastgelegd als voorstel. Gasten merken er niets van.');
        laad();
      })
      .catch(function(e){ b.disabled = false; Util.tekst(b, 'Vraag de AI'); toast(e.message); });
  });

  /* ---------- tabbladen ---------- */
  function toonTab(naam){
    var status = naam !== 'functies';
    $('#tabStatus').hidden = !status; $('#tabFuncties').hidden = status;
    $('#tabBtnStatus').setAttribute('aria-selected', status?'true':'false');
    $('#tabBtnFuncties').setAttribute('aria-selected', status?'false':'true');
  }
  $('#tabBtnStatus').addEventListener('click', function(){ toonTab('status'); });
  $('#tabBtnFuncties').addEventListener('click', function(){ toonTab('functies'); });

  /* ---------- controlekamer: functies per doelgroep, alles via een aanvraag ---------- */
  var wachtend = {};         // sleutel id|doelgroep -> open aanvraag
  var catData = [];          // laatste catalogus
  var doelgroepenMeta = [];  // doelgroep-meta (chips/pillen)
  var actieveDg = null;      // null = overzicht; anders een doelgroep-id
  var zoekterm = '';

  function sleutel(id, dg){ return id + '|' + (dg||''); }
  function isWacht(id, dg){ return !!wachtend[sleutel(id, dg)]; }
  function dgMeta(id){ for (var i=0;i<doelgroepenMeta.length;i++) if (doelgroepenMeta[i].id===id) return doelgroepenMeta[i]; return { id:id, naam:id, emoji:'•', kleur:'#888' }; }

  function zetFunctie(body){
    api('/api/techniek/functie', { method:'POST', body:body })
      .then(function(d){
        if (d.status === 'ongewijzigd') toast('Niets te wijzigen: dit staat al zo.');
        else toast('Aanvraag aangemaakt. De eigenaar moet dit eerst accepteren.');
        laad();
      })
      .catch(function(e){ toast(e.message); });
  }

  // een pil voor een doelgroep binnen een functie (overzicht-weergave)
  function pil(f, d){
    var geblokkeerd = isWacht(f.id, d.id) || !f.aan;
    var m = dgMeta(d.id);
    return el('button',{class:'pill '+(d.aan?'aan':'uit'), disabled: geblokkeerd||null,
      'aria-label':(d.aan?'Uitzetten voor ':'Aanzetten voor ')+m.naam+': '+f.naam,
      onclick:function(){ zetFunctie({ id:f.id, doelgroep:d.id, aan:!d.aan }); }},
      el('span',{class:'dot', style:{background:m.kleur}}), m.naam);
  }

  function functieRij(f){
    if (actieveDg){
      var dEntry = null;
      for (var i=0;i<f.doelgroepen.length;i++) if (f.doelgroepen[i].id===actieveDg) dEntry=f.doelgroepen[i];
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
  var noodremAan = true;
  $('#bBevAuto').addEventListener('click', function(){
    if (noodremAan && !confirm('De automatische noodrem uitzetten? Bij een brute-force-aanval springen de zekeringen dan NIET meer vanzelf.')) return;
    api('/api/techniek/beveiliging/auto', { method:'POST', body:{ aan: !noodremAan } })
      .then(function(d){ toast(d.autoReactie ? 'Noodrem aan: zekeringen springen vanzelf bij een aanval.' : 'Noodrem uit.'); laad(); })
      .catch(function(e){ toast(e.message); });
  });

  function laad(){
    return api('/api/techniek/status').then(function(d){
      eigenaar = d.eigenaar;
      $('#wieSub').textContent = (d.naam||'') + (d.eigenaar?' · eigenaar':' · toegelaten');
      var bev = d.beveiliging || { open:0, kritiek:0, recent:[] };
      var tellers = [
        tellerKaart(d.samenvatting.ok,'In orde'),
        tellerKaart(d.samenvatting.waarschuwing,'Let op'),
        tellerKaart(d.samenvatting.fout,'Storing')];
      if (bev.open) tellers.push(tellerKaart(bev.open, bev.kritiek?'Beveiliging!':'Beveiliging'));
      vervang($('#tellers'), tellers);
      // beveiligingsmeldingen: tonen bij meldingen, en altijd voor de eigenaar
      // (die ziet er ook de noodrem-schakelaar)
      $('#beveiligBlok').hidden = !(d.eigenaar || (bev.recent && bev.recent.length));
      vervang($('#beveiliging'), (bev.recent && bev.recent.length) ? bev.recent.map(beveiligRij)
        : el('div',{class:'muted'},'Geen beveiligingsmeldingen. Brute force en pogingen om deze pagina binnen te komen verschijnen hier vanzelf.'));
      $('#bBevAf').hidden = !(d.eigenaar && bev.open);
      noodremAan = bev.autoReactie !== false;
      $('#bBevAuto').hidden = !d.eigenaar;
      Util.tekst($('#bBevAuto'), noodremAan ? 'Noodrem: AAN' : 'Noodrem: UIT');
      vervang($('#checks'), d.checks.map(checkRij));
      $('#zekeringBlok').hidden = !d.eigenaar;
      if (d.eigenaar) vervang($('#zekeringen'), d.zekeringen.map(zekerRij));
      $('#archiefBlok').hidden = !(d.eigenaar && d.archief);
      if (d.eigenaar && d.archief){
        Util.tekst($('#archiefInfo'), 'Nu ' + d.archief.dagen + ' dagen \u00B7 ' + d.archief.levend.toLocaleString('nl-NL') + ' levend \u00B7 ' + d.archief.gearchiveerd.toLocaleString('nl-NL') + ' gearchiveerd');
        if (document.activeElement !== $('#archiefDagen')) $('#archiefDagen').value = d.archief.dagen;
      }
      $('#moderniseerBlok').hidden = !d.eigenaar;
      if (d.eigenaar){
        var ms = d.moderniseringen || [];
        vervang($('#modHist'), ms.length ? ms.map(modRij) : el('div',{class:'muted', style:{fontSize:'.75rem'}}, 'Nog geen moderniseringsverzoeken.'));
      }
      $('#grenzenBlok').hidden = !(d.eigenaar && d.grenzen && d.grenzen.length);
      if (d.eigenaar && d.grenzen) vervang($('#grenzen'), d.grenzen.map(function(g){
        return el('div',{class:'zeker'}, el('span',{class:'badge uit'}, 'DICHT'), el('div',{class:'mid'}, el('div',{class:'muted'}, g))); }));
      $('#toegangBlok').hidden = !d.eigenaar;
      if (d.eigenaar) vervang($('#toegangLijst'), (d.toegang&&d.toegang.length)? d.toegang.map(toegangRij) : el('div',{class:'muted'},'Nog niemand extra toegelaten.'));
      // functies-tab: iedereen met toegang kan aanvragen; alleen de eigenaar besluit
      $('#tabBtnFuncties').hidden = false;
      var verzoeken = d.verzoeken || [];
      var open = verzoeken.filter(function(v){ return v.status==='wacht'; });
      wachtend = {};
      open.forEach(function(v){ (v.wijzigingen||[]).forEach(function(w){ wachtend[sleutel(w.id, w.doelgroep||null)]=true; }); });
      var uitLabel = 'Controlekamer', extra = [];
      if (open.length) extra.push(open.length+' wacht');
      if (d.functiesUit) extra.push(d.functiesUit+' globaal uit');
      if (d.doelgroepUit) extra.push(d.doelgroepUit+' per doelgroep');
      if (extra.length) uitLabel += ' · '+extra.join(' · ');
      $('#tabBtnFuncties').textContent = uitLabel;
      $('#verzoekBlok').hidden = !verzoeken.length;
      if (verzoeken.length) vervang($('#verzoeken'), verzoeken.map(verzoekRij));
      catData = d.functies || [];
      doelgroepenMeta = d.doelgroepen || [];
      tekenChips(); updBulk(); tekenFuncties();
    }).catch(function(e){
      if (/401|403|Log in|toegang/i.test(e.message)){ token=null; sessionStorage.removeItem('techToken'); toonLogin(); }
      else toast(e.message);
    });
  }

  function start(){
    if (!token){ toonLogin(); return; }
    toonBord();
    laad();
    if (timer) clearInterval(timer);
    timer = setInterval(laad, 12000); // elke 12s verversen
  }
  start();
})();
