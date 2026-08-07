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


