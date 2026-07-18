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
