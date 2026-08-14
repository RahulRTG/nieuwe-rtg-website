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
    var panelen = { status:'#tabStatus', betalen:'#tabBetalen', wacht:'#tabWacht', functies:'#tabFuncties' };
    var knoppen = { status:'#tabBtnStatus', betalen:'#tabBtnBetalen', wacht:'#tabBtnWacht', functies:'#tabBtnFuncties' };
    if (!panelen[naam]) naam = 'status';
    for (var k in panelen){ $(panelen[k]).hidden = (k !== naam); $(knoppen[k]).setAttribute('aria-selected', k===naam?'true':'false'); }
    if (naam === 'wacht') laadWacht();
    if (naam === 'betalen') laadBetalingen();
  }
  $('#tabBtnStatus').addEventListener('click', function(){ toonTab('status'); });
  $('#tabBtnBetalen').addEventListener('click', function(){ toonTab('betalen'); });
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
    laadJournaal();
  }

  // het doorgeefjournaal: /shared/journaalbord.js (eigen bestand, 10 KB-lat)
  function laadJournaal(){ if (window.RTGJournaalbord) RTGJournaalbord.laad(api, $, toast); }
  if (window.RTGJournaalbord) RTGJournaalbord.koppel($, laadJournaal);


  /* BETAALREGIE. IT begeleidt en beproeft; alleen de eigenaar kiest en zet
     live. De API bewaart uitsluitend processtappen en controle-uitkomsten. */
  function bpGeld(c){ return new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format((Number(c)||0)/100); }
  function bpWerkLabel(p){
    if (p.werkt === 'bewezen-met-betaling') return 'BEWEZEN WERKEND';
    if (p.werkt === 'klaar-voor-proef') return 'KLAAR VOOR PROEF';
    if (p.werkt === 'onvolledig') return 'ONVOLLEDIG';
    return 'NOG NIET GEKOPPELD';
  }
  function bpStap(provider, fase){
    api('/api/techniek/betalingen/stap',{method:'POST',body:{provider:provider,fase:fase}})
      .then(function(d){ tekenBetalingen(d); toast('Stap vastgelegd.'); })
      .catch(function(e){ toast(e.message); });
  }
  function bpProef(provider){
    api('/api/techniek/betalingen/proef',{method:'POST',body:{provider:provider}})
      .then(function(d){ tekenBetalingen(d.overzicht); toast(d.uitleg); })
      .catch(function(e){ toast(e.message); });
  }
  function bpKeuze(provider){
    api('/api/techniek/betalingen/keuze',{method:'POST',body:{provider:provider}})
      .then(function(d){ tekenBetalingen(d); toast('Voorkeursprovider vastgelegd.'); })
      .catch(function(e){ toast(e.message); });
  }
  function bpProvider(p,d){
    var fase = el('select',{class:'veld',style:{margin:'0',padding:'.38rem',fontSize:'.74rem'}});
    ['aanvraag','controle','goedgekeurd','techniek','proef','gepauzeerd','probleem'].concat(eigenaar?['live']:[])
      .forEach(function(f){ var o=el('option',{value:f},f); if(p.fase===f)o.selected=true; fase.appendChild(o); });
    var open = el('a',{class:'knop grijs klein',href:p.aanmeldUrl,target:'_blank',rel:'noopener noreferrer'},p.fase==='niet-gestart'?'Open aanvraag':'Provider openen');
    open.addEventListener('click',function(){ if(p.fase==='niet-gestart') bpStap(p.id,'aanvraag'); });
    var acties = el('div',{class:'bp-acties'},open,
      el('button',{class:'knop grijs klein',onclick:function(){bpStap(p.id,fase.value);}},'Stap opslaan'),
      el('button',{class:'knop klein',onclick:function(){bpProef(p.id);}},'Controleer koppeling'));
    if(eigenaar) acties.appendChild(el('button',{class:'knop grijs klein',disabled:d.voorkeur===p.id?true:null,onclick:function(){bpKeuze(p.id);}},d.voorkeur===p.id?'Voorkeur':'Maak voorkeur'));
    var regels = p.checklist.map(function(x){return el('div',{class:'bp-regel',style:{color:x.ingesteld?'#7EE0A3':null}},(x.ingesteld?'✓ ':'○ ')+x.label);});
    return el('div',{class:'bp-kaart'},
      el('h3',null,p.naam,el('span',{class:'code'},bpWerkLabel(p))),
      el('div',{class:'muted',style:{fontSize:'.76rem',minHeight:'2.3rem'}},p.uitleg),
      el('div',{class:'badge '+(p.werkt==='bewezen-met-betaling'?'aan':'uit'),style:{margin:'.55rem 0'}},p.faseLabel),
      regels, fase, acties);
  }
  function tekenBetalingen(d){
    var c=d.cijfers||{};
    vervang($('#bpTellers'),[
      tellerKaart(bpGeld(c.bevestigdCenten),'bevestigd'),tellerKaart(bpGeld(c.terugbetaaldCenten),'terugbetaald'),
      tellerKaart(c.onderweg||0,'onderweg'),tellerKaart(c.controleNodig||0,'controle nodig')]);
    vervang($('#bpProviders'),(d.providers||[]).map(function(p){return bpProvider(p,d);}));
    vervang($('#bpProblemen'),(d.problemen||[]).length?(d.problemen||[]).map(function(p){return el('div',{class:'bp-fout'},
      el('span',{class:'code'},p.code),document.createTextNode(' '+p.tekst));}):el('div',{class:'kaart muted'},'Alle betaalcontroles zijn groen.'));
    vervang($('#bpAudit'),(d.audit||[]).length?(d.audit||[]).slice(0,15).map(function(a){return el('div',{class:'zeker'},
      el('div',{class:'mid'},el('div',{class:'naam'},(a.provider?a.provider+' · ':'')+(a.soort||'handeling')),
      el('div',{class:'muted'},new Date(a.at).toLocaleString('nl-NL')+' · '+(a.actor||'onbekend')+(a.naar?' · '+a.naar:''))));}):el('div',{class:'muted'},'Nog geen handelingen.'));
  }
  function laadBetalingen(){
    api('/api/techniek/betalingen/status').then(tekenBetalingen).catch(function(e){toast(e.message);});
  }
  /* DE CONTROLEKAMER -- afgesplitst uit techniek-02.js.

     Die had twee onderwerpen: De Wacht (meters, grafiek, journaal) en de
     controlekamer (functies per doelgroep, alles via een aanvraag). Twee lezers,
     twee vragen, en samen over de 10 KB-lat. De knip loopt langs die grens en
     niet halverwege een functie.

     Dit deel deelt de scope van de bundel (zie scripts/bundel.js): $, api, toast
     en de rest komen uit de delen hiervoor. */
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
    if (noodremAan && !confirm('De automatische noodrem uitzetten? Bij een brute-force-aanval springen de zekeringen dan NIET meer vanzelf.')) return;
    api('/api/techniek/beveiliging/auto', { method:'POST', body:{ aan: !noodremAan } })
      .then(function(d){ toast(d.autoReactie ? 'Noodrem aan: zekeringen springen vanzelf bij een aanval.' : 'Noodrem uit.'); laad(); })
      .catch(function(e){ toast(e.message); });
  });

  /* De laatste stand van het statusbord, zodat "meenemen" uit het EIGEN model
     leest en niet uit de kaartjes op het scherm. */
  var STAND = null;

  function laad(){
    return api('/api/techniek/status').then(function(d){
      STAND = d;
      eigenaar = d.eigenaar;
      $('#wieSub').textContent = (d.naam||'') + (d.eigenaar?' · eigenaar':' · toegelaten');
      var bev = d.beveiliging || { open:0, kritiek:0, recent:[] };
      var tellers = [
        tellerKaart(d.samenvatting.ok,'In orde'),
        tellerKaart(d.samenvatting.waarschuwing,'Let op'),
        tellerKaart(d.samenvatting.fout,'Storing')];
      if (bev.open) tellers.push(tellerKaart(bev.open, bev.kritiek?'Beveiliging!':'Beveiliging'));
      vervang($('#tellers'), tellers);
      // de motorkap-band: grootboek/motor/bank op een oogopslag, uit de checks
      var kap = { wallet:'Grootboek', motorschaduw:'Motor', bank:'Bank' };
      var kapChecks = (d.checks||[]).filter(function(c){ return kap[c.id]; });
      $('#motorkapBand').hidden = !kapChecks.length;
      if (kapChecks.length){
        var pillen = [el('span',{class:'mk-titel'},'De motorkap')];
        kapChecks.forEach(function(c){
          pillen.push(el('span',{class:'mk-pil', title:c.detail||''},
            el('span',{class:'mk-stip '+c.status}), kap[c.id]));
        });
        var band = el('div',{class:'motorkap'}, pillen);
        vervang($('#motorkapBand'), band);
      }
      // beveiligingsmeldingen: tonen bij meldingen, en altijd voor de eigenaar
      // (die ziet er ook de noodrem-schakelaar)
      $('#beveiligBlok').hidden = !(d.eigenaar || (bev.recent && bev.recent.length));
      vervang($('#beveiliging'), (bev.recent && bev.recent.length) ? bev.recent.map(beveiligRij)
        : el('div',{class:'muted'},'Geen beveiligingsmeldingen. Brute force en pogingen om deze pagina binnen te komen verschijnen hier vanzelf.'));
      $('#bBevAf').hidden = !(d.eigenaar && bev.open);
      noodremAan = bev.autoReactie !== false;
      $('#bBevAuto').hidden = !d.eigenaar;
      Util.tekst($('#bBevAuto'), noodremAan ? 'Noodrem: AAN' : 'Noodrem: UIT');
      // storingen (eigen fout-aggregatie): tonen bij storingen, en altijd voor de eigenaar
      var fout = d.fouten || { totaal:0, distinct:0, recent:[] };
      $('#foutenBlok').hidden = !(d.eigenaar || fout.totaal);
      vervang($('#fouten'), (fout.recent && fout.recent.length) ? fout.recent.map(foutRij)
        : el('div',{class:'muted'},'Geen storingen sinds de start. Onverwachte serverfouten verschijnen hier vanzelf, gegroepeerd met een teller.'));
      $('#bFoutenWis').hidden = !(d.eigenaar && fout.totaal);
      vervang($('#checks'), d.checks.map(checkRij));
      $('#zekeringBlok').hidden = !d.eigenaar;
      if (d.eigenaar) vervang($('#zekeringen'), d.zekeringen.map(zekerRij));
      $('#archiefBlok').hidden = !(d.eigenaar && d.archief);
      if (d.eigenaar && d.archief){
        Util.tekst($('#archiefInfo'), 'Nu ' + d.archief.dagen + ' dagen \u00B7 ' + d.archief.levend.toLocaleString('nl-NL') + ' levend \u00B7 ' + d.archief.gearchiveerd.toLocaleString('nl-NL') + ' gearchiveerd');
        if (document.activeElement !== $('#archiefDagen')) $('#archiefDagen').value = d.archief.dagen;
      }
      // het papierwerk: eenmalig ophalen, niet elke 12 seconden -- anders staat
      // Rahul de vraag te verversen terwijl de eigenaar zijn antwoord typt
      $('#papierenBlok').hidden = !d.eigenaar;
      if (d.eigenaar && !papGeladen){ papGeladen = true; papieren(); }
      $('#moderniseerBlok').hidden = !d.eigenaar;
      if (d.eigenaar){
        var ms = d.moderniseringen || [];
        vervang($('#modHist'), ms.length ? ms.map(modRij) : el('div',{class:'muted', style:{fontSize:'.75rem'}}, 'Nog geen moderniseringsverzoeken.'));
      }
      $('#grenzenBlok').hidden = !(d.eigenaar && d.grenzen && d.grenzen.length);
      if (d.eigenaar && d.grenzen) vervang($('#grenzen'), d.grenzen.map(function(g){
        return el('div',{class:'zeker'}, el('span',{class:'badge uit'}, 'DICHT'), el('div',{class:'mid'}, el('div',{class:'muted'}, g))); }));
      $('#toegangBlok').hidden = !d.eigenaar;
      // het eigenaarschap: alleen de eigenaar ziet wie het is en kan overdragen
      $('#eigenaarBlok').hidden = !d.eigenaar;
      if (d.eigenaar && window.RTGTechEigenaar) RTGTechEigenaar(d.eigenaarschap);
      if (d.eigenaar) vervang($('#toegangLijst'), (d.toegang&&d.toegang.length)? d.toegang.map(toegangRij) : el('div',{class:'muted'},'Nog niemand extra toegelaten.'));
      // De Wacht-tab: zichtbaar voor iedereen met toegang (lezen); de acties
      // (afsnijden, beslissen, opruimen) zijn in de UI en op de server owner-only.
      $('#tabBtnWacht').hidden = false;
      $('#tabBtnBetalen').hidden = false;
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

  /* Meenemen (shared/uitvoer.js): het statusbord is een register van controles,
     en dat neemt een beheerder mee naar een rapportage. Veld voor veld uit
     d.checks -- niet de regels die op het scherm staan. */
  if (window.RTGUitvoer) RTGUitvoer.bron(function(){
    if (!STAND || !STAND.checks) return null;
    return {
      naam: 'techniek',
      kolommen: ['controle','code','categorie','status','toelichting'],
      rijen: STAND.checks.map(function(c){
        return [c.naam||'', c.code||'', c.categorie||'', c.status||'', c.detail||''];
      })
    };
  });

  /* HET PAPIERWERK: Rahul vraagt het AVG-register en het datalek-draaiboek uit.
     Eerder stond in die documenten een rij [VUL IN]-plekken. Een invullijst
     vult niemand in, dus stond het er nog steeds. Hier stelt Rahul de vraag,
     met erbij waarom hij hem stelt, en het antwoord landt meteen in het
     document. Verzinnen doet hij niet: op deze pagina komt alleen te staan wat
     een mens intypt. */
  var papVraagId = null, papGeladen = false;
  function papieren(){
    return api('/api/techniek/papieren').then(function(d){
      Util.tekst($('#papStand'), d.open
        ? (d.totaal - d.open) + ' van de ' + d.totaal + ' beantwoord · nog ' + d.open + ' te gaan'
        : 'Alle ' + d.totaal + ' vragen beantwoord. Laat het geheel nog juridisch nakijken.');
      var v = d.volgende;
      papVraagId = v ? v.id : null;
      $('#papVraagBlok').hidden = !v;
      if (!v) return;
      Util.tekst($('#papVraag'), v.vraag);
      Util.tekst($('#papWaarom'), v.waarom);
      Util.tekst($('#papVoorbeeld'), v.voorbeeld ? 'Bijvoorbeeld: ' + v.voorbeeld
        : (v.jaVraag ? 'Bij ja: ' + v.jaVraag + '  Bij nee: ' + v.neeVraag : ''));
      $('#papAntwoord').value = '';
      $('#papAntwoord').placeholder = v.eerderGeparkeerd
        ? 'Dit stond geparkeerd; weet u het inmiddels?' : 'Uw antwoord, in uw eigen woorden…';
    }).catch(function(e){ toast(e.message); });
  }
  function papZeg(parkeer){
    if (!papVraagId) return;
    api('/api/techniek/papieren/antwoord', { method:'POST',
      body:{ id: papVraagId, waarde: $('#papAntwoord').value, parkeer: !!parkeer } })
      .then(function(d){ toast(d.terug || 'Genoteerd.'); $('#papDoc').hidden = true; papieren(); })
      .catch(function(e){ toast(e.message); });
  }
  $('#bPapOk').addEventListener('click', function(){ papZeg(false); });
  $('#bPapParkeer').addEventListener('click', function(){ papZeg(true); });
  function papToon(naam){
    api('/api/techniek/papieren/document?naam=' + naam).then(function(d){
      Util.tekst($('#papDoc'), d.tekst);
      $('#papDoc').hidden = false;
    }).catch(function(e){ toast(e.message); });
  }
  $('#bPapReg').addEventListener('click', function(){ papToon('verwerkingsregister'); });
  $('#bPapLek').addEventListener('click', function(){ papToon('datalek'); });

  function start(){
    if (!token){ toonLogin(); return; }
    toonBord();
    laad();
    if (timer) clearInterval(timer);
    timer = setInterval(laad, 12000); // elke 12s verversen
  }
  start();
})();
