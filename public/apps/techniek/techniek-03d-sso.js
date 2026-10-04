  /* SSO-CLIENTGEHEIMEN (B16, B22): alleen de STAND, nooit het geheim; roteren
     vraagt een verse passkey (RTGZwaar). */
  var ssoGeladen = false;
  function ssoDatum(t){ return t ? new Date(t).toLocaleDateString(document.documentElement.lang || undefined,{day:'numeric',month:'short',year:'numeric'}) : 'onbekend'; }
  function ssoBlok(){
    var b = $('#ssoBlok');
    if (b) return b;
    b = el('div',{id:'ssoBlok'}, el('div',{class:'sec'},'SSO-clientgeheimen'),
      el('div',{class:'muted',style:{fontSize:'.76rem',margin:'0 0 .5rem'}},
        'Per organisatie versleuteld. Hier staat alleen de stand; het geheim komt er nooit meer uit.'),
      el('div',{class:'kaart',id:'ssoLijst'}));
    $('#zekeringBlok').parentNode.insertBefore(b, $('#zekeringBlok').nextSibling);
    return b;
  }
  function ssoRij(k){
    var g = k.geheim || {};
    var ok = !!g.bruikbaar;
    var badge = el('span',{class:'badge '+(ok?'aan':'uit')}, ok ? 'BRUIKBAAR' : 'DICHT');
    var regels = [
      el('div',null, el('span',{class:'naam'}, k.naam || k.org), el('span',{class:'code'}, k.org)),
      g.gezet ? el('div',{class:'muted'}, 'Vingerafdruk ' + (g.vingerafdruk || '?') + ' · gezet ' + ssoDatum(g.gezetOp) +
        ' · vervalt ' + ssoDatum(g.vervalt) + (g.dagenOver != null ? ' (' + g.dagenOver + ' dagen)' : '') +
        (g.gemigreerd ? ' · uit de oude opslag overgezet' : '') + (g.afgekapt ? ' · afgekapt op 90 dagen' : '')) : null,
      ok ? null : el('div',{class:'muted',style:{color:'#F4B8C6'}}, 'Inloggen staat dicht: ' + (g.reden || 'onbekend')),
      g.overlap ? el('div',{class:'muted'}, 'Het vorige geheim (' + g.overlap.vingerafdruk + ') werkt nog tot ' + ssoDatum(g.overlap.tot) + '.') : null
    ];
    var veld = el('input',{class:'veld',type:'password',autocomplete:'new-password','aria-label':'Nieuw clientgeheim voor '+k.org,
      placeholder:'Nieuw clientgeheim',style:{margin:'0',maxWidth:'16rem'}});
    var overlap = el('input',{class:'veld',type:'number',inputmode:'numeric',min:'0',max:'7',value:'3',
      'aria-label':'Dagen overlap',style:{margin:'0',width:'5rem'}});
    var acties = el('div',{style:{display:'flex',gap:'.5rem',flexWrap:'wrap',alignItems:'center',marginTop:'.5rem'}},
      veld, overlap, el('span',{class:'muted',style:{fontSize:'.72rem'}},'dagen overlap'),
      el('button',{class:'knop klein',onclick:function(){ ssoRoteer(k.org, veld, overlap.value); }}, g.gezet ? 'Roteren' : 'Zetten'),
      g.overlap ? el('button',{class:'knop grijs klein',onclick:function(){ ssoSluit(k.org); }}, 'Overlap sluiten') : null);
    return el('div',{class:'zeker'}, badge, el('div',{class:'mid'}, regels, acties));
  }
  function ssoTeken(d){
    var lijst = (d && d.koppelingen) || [];
    vervang($('#ssoLijst'), lijst.length ? lijst.map(ssoRij)
      : el('div',{class:'muted'},'Er zijn nog geen SSO-koppelingen.'));
  }
  function ssoLaad(){
    ssoBlok();
    api('/api/techniek/sso').then(ssoTeken).catch(function(e){ toast(e.message); });
  }
  function ssoRoteer(org, veld, dagen){
    var geheim = veld.value;
    veld.value = '';
    if (!geheim) { toast('Vul het nieuwe clientgeheim in.'); return; }
    var b = {org:org,clientSecret:geheim,overlapDagen:Number(dagen)};
    (window.RTGZwaar ? RTGZwaar.doe('/api/techniek/sso/geheim', b, {token:token, optiesPad:'/api/techniek/bevestig/opties'})
      : api('/api/techniek/sso/geheim',{method:'POST',body:b})).then(function(d){ toast(d.ongewijzigd ? 'Dit geheim stond er al.' : (d.let_op || 'Geroteerd.')); ssoLaad(); })
      .catch(function(e){ toast(e.message); });
  }
  function ssoSluit(org){
    api('/api/techniek/sso/geheim/overlap/sluit',{method:'POST',body:{org:org}})
      .then(function(){ toast('Het vorige geheim werkt niet meer.'); ssoLaad(); })
      .catch(function(e){ toast(e.message); });
  }
