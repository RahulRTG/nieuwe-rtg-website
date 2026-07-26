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

