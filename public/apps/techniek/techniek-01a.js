/* eigenaarschap overdragen, en de modernisering door de AI */
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
