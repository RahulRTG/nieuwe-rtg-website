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
