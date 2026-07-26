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

