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
