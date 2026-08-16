    if (noodremAan && !confirm('De automatische noodrem uitzetten? Bij een brute-force-aanval springen de zekeringen dan NIET meer vanzelf.')) return;
    api('/api/techniek/beveiliging/auto', { method:'POST', body:{ aan: !noodremAan } })
      .then(function(d){ toast(d.autoReactie ? 'Noodrem aan: zekeringen springen vanzelf bij een aanval.' : 'Noodrem uit.'); laad(); })
      .catch(function(e){ toast(e.message); });
  });

  /* PERMANENTE CONTROLE. De server levert alleen metadata: route, schakelaar,
     grootte en SHA-256. Broninhoud en geheimen komen nooit in dit scherm. */
  var controleSoort = 'routes';

  function cBytes(n){
    n = Number(n)||0;
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n/1024).toFixed(1) + ' KB';
    return (n/1048576).toFixed(1) + ' MB';
  }
  function cTijd(v){ try { return new Date(v).toLocaleString('nl-NL'); } catch(e){ return ''; } }

  function tekenControle(c, cat){
    $('#controleBlok').hidden = !eigenaar;
    if (!eigenaar || !c) return;
    var inc = c.incident || {}, integ = c.integriteit || {}, inv = c.inventaris || {};
    var scan = integ.laatst;
    var oordeel = !integ.beschikbaar ? 'GEEN BEWIJS' : !scan ? 'NOG NIET GESCAND' : (scan.ok ? 'CODE GELIJK' : 'AFWIJKING');
    var klasse = (scan && scan.ok) ? 'aan' : 'uit';
    var pin = integ.pinIngesteld ? (integ.pinGeldig ? 'extern verankerd' : 'externe pin wijkt af') : 'bewijs nog niet extern verankerd';
    var dreig = c.dreiging && c.dreiging.antivirus;
    vervang($('#controleStand'), [
      el('div',{class:'zeker'}, el('span',{class:'badge '+(inc.modus==='normaal'?'aan':'uit')}, String(inc.modus||'normaal').toUpperCase()),
        el('div',{class:'mid'}, el('div',{class:'naam'}, inc.actief ? inc.actief.reden : 'Geen actief incident'),
          el('div',{class:'muted'}, (inc.functiesUit||0)+' functies uit · revisie '+(inc.revisie||0)+' · audit '+(inc.auditAantal||0)+' regels'))),
      el('div',{class:'zeker'}, el('span',{class:'badge '+klasse}, oordeel),
        el('div',{class:'mid'}, el('div',{class:'naam'}, (integ.bestandAantal||inv.bestanden||0)+' releasebestanden · '+(inv.routes||0)+' routes'),
          el('div',{class:'muted'}, pin+(scan ? ' · laatste scan '+cTijd(scan.at)+' · '+scan.verschillen+' verschil(len)' : '')))),
      dreig ? el('div',{class:'muted',style:{marginTop:'.35rem'}}, 'Ontsmetter: '+(dreig.totaal||0)+' gescand, '+(dreig.besmet||0)+' besmet geweigerd, '+(dreig.verdacht||0)+' verdacht.') : null
    ]);
    $('#bWaakzaam').disabled = inc.modus !== 'normaal';
    $('#bHerstel').disabled = inc.modus === 'normaal';
    $('#bIsoleer').disabled = inc.modus === 'isolatie';
    var sel = $('#incidentFunctie'), waarde = sel.value;
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    (cat||[]).forEach(function(g){ (g.functies||[]).forEach(function(f){
      var o = document.createElement('option'); o.value=f.id; o.textContent=f.naam+' ('+f.id+')'; sel.appendChild(o);
    }); });
    if (waarde) sel.value = waarde;
    var audit = inc.audit || [];
    vervang($('#controleAudit'), audit.length ? [el('div',{class:'muted',style:{marginBottom:'.25rem'}},'Laatste noodhandelingen')].concat(audit.slice(0,10).map(function(a){
      return el('div',{class:'zeker'}, el('span',{class:'code'}, '#'+a.revisie), el('div',{class:'mid'},
        el('div',{class:'naam'}, String(a.actie||'').toUpperCase()+' · '+(a.functies||[]).length+' functie(s)'),
        el('div',{class:'muted'}, cTijd(a.at)+' · '+a.actor+' · '+a.reden)));
    })) : el('div',{class:'muted'},'Nog geen noodhandelingen.'));
  }

  function incidentDoe(actie, extra){
    var reden = $('#incidentReden').value.trim();
    if (reden.length < 8){ toast('Geef een concrete reden van minimaal 8 tekens.'); return; }
    var body = Object.assign({ actie:actie, reden:reden }, extra||{});
    api('/api/techniek/controle/incident',{method:'POST',body:body}).then(function(){
      $('#incidentReden').value=''; toast('Incidentstand bijgewerkt.'); laad();
    }).catch(function(e){ toast(e.message); });
  }
  $('#bWaakzaam').addEventListener('click',function(){ incidentDoe('waakzaam'); });
  $('#bBeperk').addEventListener('click',function(){ incidentDoe('beperk',{id:$('#incidentFunctie').value}); });
  $('#bIsoleer').addEventListener('click',function(){
    if (!confirm('Alle productfuncties onmiddellijk sluiten? Techniek, health en privacy blijven bereikbaar.')) return;
    var woord = prompt('Typ exact ISOLEER RTG om door te gaan:','');
    if (woord !== 'ISOLEER RTG'){ toast('Niet geisoleerd: bevestiging klopte niet.'); return; }
    incidentDoe('isoleer',{bevestiging:woord});
  });
  $('#bHerstel').addEventListener('click',function(){
    var woord = prompt('Typ exact HERSTEL RTG om de bewaarde standen terug te zetten:','');
    if (woord !== 'HERSTEL RTG'){ toast('Niet hersteld: bevestiging klopte niet.'); return; }
    incidentDoe('herstel',{bevestiging:woord});
  });
  $('#bIntegriteit').addEventListener('click',function(){
    var b=$('#bIntegriteit'); b.disabled=true; Util.tekst(b,'Alle code wordt gecontroleerd...');
    api('/api/techniek/controle/integriteit',{method:'POST',body:{}}).then(function(d){
      b.disabled=false; Util.tekst(b,'Controleer alle code nu');
      toast(d.laatst && d.laatst.ok ? 'Alle code is gelijk aan het releasebewijs.' : 'Afwijking gevonden. Bekijk het resultaat.');
      laad();
      var regels=(d.laatst&&d.laatst.details)||[];
      vervang($('#controleResultaat'), regels.length ? regels.map(function(x){ return el('div',{class:'zeker'},
        el('span',{class:'badge uit'},String(x.soort||'fout').toUpperCase()),el('div',{class:'mid'},
          el('div',{class:'naam'},x.pad||'releasebewijs'),el('div',{class:'muted'},x.uitleg||''))); }) : el('div',{class:'muted'},'Geen verschillen gevonden.'));
      $('#controleResultaat').hidden=false;
    }).catch(function(e){ b.disabled=false; Util.tekst(b,'Controleer alle code nu'); toast(e.message); });
  });

  function laadInventaris(soort){
    controleSoort=soort;
    var zoek=$('#controleZoek').value.trim();
    api('/api/techniek/controle/inventaris?soort='+encodeURIComponent(soort)+'&zoek='+encodeURIComponent(zoek)+'&limiet=100').then(function(d){
      var kop=el('div',{class:'muted',style:{marginBottom:'.4rem'}},d.totaal+' '+d.soort+' gevonden · pagina '+d.pagina+' van '+d.paginas);
      var regels=d.resultaten.map(function(x){
        var rechts=x.sha256 ? cBytes(x.bytes)+' · '+x.sha256 : (x.methoden||[]).join(', ')+' · '+(x.functienaam||x.beschermreden||'geen schakelaar');
        return el('div',{class:'zeker'},el('div',{class:'mid'},el('div',{class:'naam'},x.pad),el('div',{class:'muted'},rechts)));
      });
      vervang($('#controleResultaat'),[kop].concat(regels.length?regels:[el('div',{class:'muted'},'Geen resultaten.') ]));
      $('#controleResultaat').hidden=false;
    }).catch(function(e){ toast(e.message); });
  }
  $('#bBestanden').addEventListener('click',function(){ laadInventaris('bestanden'); });
  $('#bRoutes').addEventListener('click',function(){ laadInventaris('routes'); });
  $('#controleZoek').addEventListener('keydown',function(e){ if(e.key==='Enter') laadInventaris(controleSoort); });
