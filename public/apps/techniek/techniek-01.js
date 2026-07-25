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
  /* ---------- eigenaarschap overdragen ----------
     Bewust stroef: een bevestiging waarin het adres letterlijk staat, en het
     eigen wachtwoord erbij. Wie dit per ongeluk aanklikt raakt anders in één
     tik de zeggenschap over het hele platform kwijt. */
  $('#bEigenaar').addEventListener('click', function(){
    $('#eigFout').textContent='';
    var email = $('#eigEmail').value.trim();
    var ww = $('#eigWw').value;
    if (!email) { $('#eigFout').textContent = 'Vul het e-mailadres van de nieuwe eigenaar in.'; return; }
    if (!ww) { $('#eigFout').textContent = 'Vul uw eigen wachtwoord in ter bevestiging.'; return; }
    if (!confirm('Het eigenaarschap van het hele platform overdragen aan ' + email + '?\n\n' +
      'Daarna bepaalt dat account de zekeringen, de functieschakelaars en wie er toegang heeft. ' +
      'U verliest die zeggenschap, tenzij de nieuwe eigenaar hem teruggeeft.')) return;
    api('/api/techniek/eigenaar', { method:'POST', body:{ email:email, wachtwoord:ww } })
      .then(function(r){
        $('#eigEmail').value=''; $('#eigWw').value='';
        toast('Eigenaarschap overgedragen aan ' + (r.naam || r.eigenaar) + '.');
        laad();
      })
      .catch(function(e){ $('#eigWw').value=''; $('#eigFout').textContent = e.message; });
  });
  function eigLogRij(o){
    return el('div',{class:'zeker'}, el('div',{class:'mid'},
      el('div',{class:'naam'}, (o.van||'?') + ' → ' + (o.naar||'?')),
      el('div',{class:'muted'}, 'door ' + (o.doorNaam||'?') + ' op ' + new Date(o.at).toLocaleString('nl-NL'))));
  }
  window.RTGTechEigenaar = function(e){
    $('#eigNu').textContent = e && e.email ? e.email : '-';
    $('#eigHerkomst').textContent = e && e.herkomst ? '(' + e.herkomst + ')' : '';
    var log = (e && e.overdrachten) || [];
    vervang($('#eigLog'), log.length
      ? [el('div',{class:'muted',style:'margin-bottom:.3rem;'},'Eerdere overdrachten')].concat(log.map(eigLogRij))
      : el('div',{class:'muted'},'Nog nooit overgedragen.'));
  };

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
    var panelen = { status:'#tabStatus', wacht:'#tabWacht', functies:'#tabFuncties' };
    var knoppen = { status:'#tabBtnStatus', wacht:'#tabBtnWacht', functies:'#tabBtnFuncties' };
    if (!panelen[naam]) naam = 'status';
    for (var k in panelen){ $(panelen[k]).hidden = (k !== naam); $(knoppen[k]).setAttribute('aria-selected', k===naam?'true':'false'); }
    if (naam === 'wacht') laadWacht();
  }
  $('#tabBtnStatus').addEventListener('click', function(){ toonTab('status'); });
  $('#tabBtnWacht').addEventListener('click', function(){ toonTab('wacht'); });
  $('#tabBtnFuncties').addEventListener('click', function(){ toonTab('functies'); });

  /* ---------- De Wacht: immuunsysteem + meters/grafiek + raadkamer ---------- */
  function wachtActie(pad, body, melding){
    api('/api/techniek/wacht/' + pad, { method:'POST', body:body||{} })
      .then(function(d){ if (melding) toast(melding); if (d && d.bord) tekenWacht(d.bord); })
      .catch(function(e){ toast(e.message); });
  }
  $('#bWachtAnalyseer').addEventListener('click', function(){ wachtActie('analyseer', {}, 'AI heeft de signalen uitgekauwd.'); });
  $('#bWachtOpruimen').addEventListener('click', function(){ wachtActie('opruimen', {}, 'Opgeruimd.'); });
  $('#bWachtIsoleer').addEventListener('click', function(){
    var b = $('#wachtBron').value.trim(); if(!b){ toast('Vul een bron (IP) in.'); return; }
    wachtActie('quarantaine', { bron:b, actie:'isoleer' }, 'In quarantaine gezet.'); $('#wachtBron').value='';
  });
  $('#bAvTest').addEventListener('click', function(){
    var eicar = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
    api('/api/techniek/wacht/av-test', { method:'POST', body:{ inhoud:eicar, naam:'eicar.com', mime:'application/octet-stream' } })
      .then(function(d){ toast('Scanner: ' + d.resultaat.verdict + ' (' + (d.resultaat.redenen[0]||'') + ')'); laadWacht(); })
      .catch(function(e){ toast(e.message); });
  });

  function avRij(x){
    var badge = el('span',{class:'badge '+(x.verdict==='besmet'?'uit':'aan')}, (x.verdict||'').toUpperCase());
    return el('div',{class:'zeker'}, badge,
      el('div',{class:'mid'},
        el('div',null, el('span',{class:'naam'}, x.naam||'(upload)'), el('span',{class:'code'}, (x.sha256||'').slice(0,10))),
        el('div',{class:'muted', style:{fontSize:'.74rem'}}, (x.redenen||[]).join('; ') + (x.bron?(' · ' + x.bron):''))));
  }

  function meterKaart(n, label){ return el('div',{class:'tel'}, el('div',{class:'n'}, String(n)), el('div',{class:'l'}, label)); }

  // Een simpele multi-lijn grafiek op canvas (geen externe library).
  function tekenGrafiek(reeks){
    var c = $('#wachtGrafiek'); if (!c || !c.getContext) return;
    var dpr = window.devicePixelRatio || 1;
    var w = c.clientWidth || 600, h = 120;
    c.width = w * dpr; c.height = h * dpr;
    var x = c.getContext('2d'); x.scale(dpr, dpr); x.clearRect(0,0,w,h);
    if (!reeks || reeks.length < 2){ x.fillStyle = '#8A8680'; x.font = '12px Inter, sans-serif'; x.fillText('Nog te weinig metingen voor een grafiek.', 8, 20); return; }
    var series = [ { k:'verzoeken', kleur:'#FFFFFF' }, { k:'alarm', kleur:'#C23A5E' }, { k:'quarantaine', kleur:'#C9A227' } ];
    series.forEach(function(s){
      var max = 1; for (var i=0;i<reeks.length;i++) if ((reeks[i][s.k]||0) > max) max = reeks[i][s.k];
      x.beginPath(); x.lineWidth = 1.5; x.strokeStyle = s.kleur;
      for (var j=0;j<reeks.length;j++){
        var px = (j/(reeks.length-1)) * (w-6) + 3;
        var py = h - 6 - ((reeks[j][s.k]||0)/max) * (h-16);
        if (j===0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.stroke();
    });
  }

  function quarantaineRij(q){
    var mid = el('div',{class:'mid'},
      el('div',null, el('span',{class:'naam'}, q.bron)),
      el('div',{class:'muted', style:{fontSize:'.74rem'}}, (q.reden||'') + ' · nog ' + Math.round((q.resterend||0)/60) + ' min'));
    var knop = eigenaar ? el('button',{class:'knop grijs klein', onclick:function(){ wachtActie('quarantaine', { bron:q.bron, actie:'vrij' }, 'Vrijgegeven.'); }}, 'Vrijgeven') : null;
    return el('div',{class:'zeker'}, el('span',{class:'badge uit'}, 'AFGESNEDEN'), mid, knop);
  }

  var VERDICT_LABEL = { open:'OPEN', inconclaaf:'INCONCLAAF', geaccepteerd:'GEACCEPTEERD', afgewezen:'AFGEWEZEN' };
  function raadRij(v){
    var badgeKlas = (v.status==='geaccepteerd') ? 'aan' : 'uit';
    var mid = el('div',{class:'mid'},
      el('div',null, el('span',{class:'naam'}, v.titel), el('span',{class:'code'}, (v.soort||'').toUpperCase())),
      el('div',{class:'muted', style:{fontSize:'.78rem'}}, v.uitleg || ''),
      v.resultaat ? el('div',{class:'muted', style:{fontSize:'.72rem',color:'#9ED3A6'}}, 'Uitgevoerd: '+v.resultaat) : null);
    var acties = el('div',null);
    if (eigenaar && (v.status==='open' || v.status==='inconclaaf')){
      acties.appendChild(el('button',{class:'knop klein', onclick:function(){ wachtActie('beslis', { id:v.id, verdict:'accepteren' }, 'Geaccepteerd.'); }}, 'Accepteren'));
      acties.appendChild(el('button',{class:'knop grijs klein', onclick:function(){
        var n = prompt('Napraten met de AI (inconclaaf) - noteer je vraag of twijfel:', ''); if (n===null) return;
        wachtActie('beslis', { id:v.id, verdict:'inconclaaf', notitie:n }, 'Inconclaaf: geparkeerd om na te praten.');
      }}, 'Inconclaaf'));
      acties.appendChild(el('button',{class:'knop rood klein', onclick:function(){ wachtActie('beslis', { id:v.id, verdict:'afwijzen' }, 'Afgewezen.'); }}, 'Afwijzen'));
    } else {
      acties.appendChild(el('span',{class:'badge '+badgeKlas}, VERDICT_LABEL[v.status] || v.status));
    }
    return el('div',{class:'zeker'}, mid, acties);
  }

  // De rand-status (Cloudflare/edge): staat de eerste linie?
  function randChip(r){
    if (!r) return el('div',{class:'muted', style:{fontSize:'.78rem'}}, 'Rand-status onbekend.');
    var kleur = r.status==='actief' ? '#9ED3A6' : (r.status==='stil' ? '#C23A5E' : '#C9A227');
    var label = r.status==='actief' ? 'RAND ACTIEF' : (r.status==='stil' ? 'RAND STIL' : (r.status==='wachtend' ? 'RAND WACHT' : 'GEEN RAND'));
    return el('div',{style:{display:'flex',alignItems:'center',gap:'.6rem',flexWrap:'wrap'}},
      el('span',{class:'badge', style:{background:'transparent',border:'1px solid '+kleur,color:kleur}}, label),
      el('div',{class:'muted', style:{fontSize:'.78rem'}}, r.uitleg || ''),
      r.ouderdomSec!=null ? el('span',{class:'code'}, 'laatst ' + r.ouderdomSec + 's geleden') : null);
  }
  // De automatische lastafworp (L7-zekering): 503 "kom zo terug".
  function lastafworpBanner(la){
    if (!la || !la.actief) return el('div');
    var mid = el('div',{class:'mid'},
      el('div',null, el('span',{class:'naam'}, 'Automatische lastafworp actief')),
      el('div',{class:'muted', style:{fontSize:'.78rem'}}, (la.reden||'') + ' - de server serveert tijdelijk 503 en dooft vanzelf.'));
    var knop = eigenaar ? el('button',{class:'knop grijs klein', onclick:function(){ wachtActie('lastafworp', { aan:false }, 'Lastafworp opgeheven.'); }}, 'Nu opheffen') : null;
    return el('div',{class:'zeker', style:{borderColor:'#C23A5E'}}, el('span',{class:'badge uit'}, '503'), mid, knop);
  }

  function tekenWacht(bord){
    var m = bord.meters || {};
    var la = bord.lastafworp || {};
    vervang($('#wachtMeters'), [
      meterKaart(m.verzoeken||0, 'verzoeken/10s'),
      meterKaart(m.bans||0, 'op de banlijst'),
      meterKaart(m.quarantaine||0, 'in quarantaine'),
      meterKaart(m.alarm||0, 'open alarmen'),
      meterKaart(m.kritiek||0, 'kritiek'),
      meterKaart(m.openVoorstellen||0, 'open voorstellen'),
      meterKaart(la.actief ? 'AAN' : 'rustig', 'lastafworp'),
      meterKaart((m.geheugen||0)+' MB', 'geheugen')
    ]);
    vervang($('#wachtLastafworp'), lastafworpBanner(la));
    vervang($('#wachtRand'), randChip(bord.rand));
    tekenGrafiek(bord.grafiek || []);
    $('#wachtIsoleer').hidden = !eigenaar;
    $('#bWachtAnalyseer').hidden = !eigenaar;
    var q = bord.quarantaine || [];
    vervang($('#wachtQuarantaine'), q.length ? q.map(quarantaineRij) : el('div',{class:'muted', style:{padding:'.4rem 0'}}, 'Niemand in quarantaine. De afweer is rustig.'));
    var r = bord.raad || [];
    vervang($('#wachtRaad'), r.length ? r.map(raadRij) : el('div',{class:'muted', style:{padding:'.4rem 0'}}, 'Geen voorstellen. Laat de AI de signalen uitkauwen met "AI kauwt uit".'));
    // De Ontsmetter (malware-scanner)
    var a = bord.av;
    if (a){
      vervang($('#avMeters'), [
        meterKaart(a.totaal||0, 'gescand'),
        meterKaart(a.besmet||0, 'besmet geweigerd'),
        meterKaart(a.verdacht||0, 'verdacht'),
        meterKaart(a.definities||0, 'handtekeningen'),
        meterKaart('v'+(a.versie||1), 'definitie-versie')
      ]);
      var det = a.laatste || [];
      vervang($('#avLaatste'), det.length ? det.map(avRij) : el('div',{class:'muted', style:{padding:'.4rem 0'}}, 'Nog geen verdachte of besmette uploads. Alles schoon.'));
      $('#bAvTest').hidden = !eigenaar;
    }
  }

  function laadWacht(){
    api('/api/techniek/wacht/bord', {}).then(tekenWacht).catch(function(e){ toast(e.message); });
  }

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
