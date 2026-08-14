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
