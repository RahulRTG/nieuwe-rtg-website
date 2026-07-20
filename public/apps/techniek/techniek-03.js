  function beveiligRij(m){
    var kop = el('div', null,
      el('span',{class:'naam'}, m.tekst),
      m.aantal>1 ? el('span',{class:'code'}, m.aantal+'x') : null,
      m.afgehandeld ? el('span',{class:'code'}, 'gezien') : null);
    return el('div',{class:'rij', style: m.afgehandeld?{opacity:'.55'}:null},
      el('div',{class:'bol '+(ernstKleur[m.ernst]||'waarschuwing')}),
      el('div',{class:'mid'}, kop, el('div',{class:'detail'}, new Date(m.at).toLocaleString('nl-NL'))));
  }
  function bevAfhandelen(){
    api('/api/techniek/beveiliging/afhandelen', { method:'POST', body:{} })
      .then(function(){ toast('Beveiligingsmeldingen als gezien gemarkeerd.'); laad(); })
      .catch(function(e){ toast(e.message); });
  }
  $('#bBevAf').addEventListener('click', bevAfhandelen);

  /* ---------- storingen (eigen fout-aggregatie) ---------- */
  function foutRij(g){
    var nu = Date.now();
    var vers = (nu - g.laatst) < 15*60000; // recent = laatste kwartier -> rood, anders oranje
    var kop = el('div', null,
      el('span',{class:'naam'}, g.bericht),
      g.aantal>1 ? el('span',{class:'code'}, g.aantal+'x') : null);
    var meta = new Date(g.laatst).toLocaleString('nl-NL') + (g.waar ? ' · ' + g.waar : '');
    return el('div',{class:'rij'},
      el('div',{class:'bol '+(vers?'fout':'waarschuwing')}),
      el('div',{class:'mid'}, kop, el('div',{class:'detail'}, meta)));
  }
  $('#bFoutenWis').addEventListener('click', function(){
    if (!confirm('De storingslijst wissen? De tellers beginnen weer bij nul.')) return;
    api('/api/techniek/fouten/wis', { method:'POST', body:{} })
      .then(function(){ toast('Storingslijst gewist.'); laad(); })
      .catch(function(e){ toast(e.message); });
  });
  var noodremAan = true;
  $('#bBevAuto').addEventListener('click', function(){
    if (noodremAan && !confirm('De automatische noodrem uitzetten? Bij een brute-force-aanval springen de zekeringen dan NIET meer vanzelf.')) return;
    api('/api/techniek/beveiliging/auto', { method:'POST', body:{ aan: !noodremAan } })
      .then(function(d){ toast(d.autoReactie ? 'Noodrem aan: zekeringen springen vanzelf bij een aanval.' : 'Noodrem uit.'); laad(); })
      .catch(function(e){ toast(e.message); });
  });

  function laad(){
    return api('/api/techniek/status').then(function(d){
      eigenaar = d.eigenaar;
      $('#wieSub').textContent = (d.naam||'') + (d.eigenaar?' · eigenaar':' · toegelaten');
      var bev = d.beveiliging || { open:0, kritiek:0, recent:[] };
      var tellers = [
        tellerKaart(d.samenvatting.ok,'In orde'),
        tellerKaart(d.samenvatting.waarschuwing,'Let op'),
        tellerKaart(d.samenvatting.fout,'Storing')];
      if (bev.open) tellers.push(tellerKaart(bev.open, bev.kritiek?'Beveiliging!':'Beveiliging'));
      vervang($('#tellers'), tellers);
      // beveiligingsmeldingen: tonen bij meldingen, en altijd voor de eigenaar
      // (die ziet er ook de noodrem-schakelaar)
      $('#beveiligBlok').hidden = !(d.eigenaar || (bev.recent && bev.recent.length));
      vervang($('#beveiliging'), (bev.recent && bev.recent.length) ? bev.recent.map(beveiligRij)
        : el('div',{class:'muted'},'Geen beveiligingsmeldingen. Brute force en pogingen om deze pagina binnen te komen verschijnen hier vanzelf.'));
      $('#bBevAf').hidden = !(d.eigenaar && bev.open);
      noodremAan = bev.autoReactie !== false;
      $('#bBevAuto').hidden = !d.eigenaar;
      Util.tekst($('#bBevAuto'), noodremAan ? 'Noodrem: AAN' : 'Noodrem: UIT');
      // storingen (eigen fout-aggregatie): tonen bij storingen, en altijd voor de eigenaar
      var fout = d.fouten || { totaal:0, distinct:0, recent:[] };
      $('#foutenBlok').hidden = !(d.eigenaar || fout.totaal);
      vervang($('#fouten'), (fout.recent && fout.recent.length) ? fout.recent.map(foutRij)
        : el('div',{class:'muted'},'Geen storingen sinds de start. Onverwachte serverfouten verschijnen hier vanzelf, gegroepeerd met een teller.'));
      $('#bFoutenWis').hidden = !(d.eigenaar && fout.totaal);
      vervang($('#checks'), d.checks.map(checkRij));
      $('#zekeringBlok').hidden = !d.eigenaar;
      if (d.eigenaar) vervang($('#zekeringen'), d.zekeringen.map(zekerRij));
      $('#archiefBlok').hidden = !(d.eigenaar && d.archief);
      if (d.eigenaar && d.archief){
        Util.tekst($('#archiefInfo'), 'Nu ' + d.archief.dagen + ' dagen \u00B7 ' + d.archief.levend.toLocaleString('nl-NL') + ' levend \u00B7 ' + d.archief.gearchiveerd.toLocaleString('nl-NL') + ' gearchiveerd');
        if (document.activeElement !== $('#archiefDagen')) $('#archiefDagen').value = d.archief.dagen;
      }
      $('#moderniseerBlok').hidden = !d.eigenaar;
      if (d.eigenaar){
        var ms = d.moderniseringen || [];
        vervang($('#modHist'), ms.length ? ms.map(modRij) : el('div',{class:'muted', style:{fontSize:'.75rem'}}, 'Nog geen moderniseringsverzoeken.'));
      }
      $('#grenzenBlok').hidden = !(d.eigenaar && d.grenzen && d.grenzen.length);
      if (d.eigenaar && d.grenzen) vervang($('#grenzen'), d.grenzen.map(function(g){
        return el('div',{class:'zeker'}, el('span',{class:'badge uit'}, 'DICHT'), el('div',{class:'mid'}, el('div',{class:'muted'}, g))); }));
      $('#toegangBlok').hidden = !d.eigenaar;
      if (d.eigenaar) vervang($('#toegangLijst'), (d.toegang&&d.toegang.length)? d.toegang.map(toegangRij) : el('div',{class:'muted'},'Nog niemand extra toegelaten.'));
      // functies-tab: iedereen met toegang kan aanvragen; alleen de eigenaar besluit
      $('#tabBtnFuncties').hidden = false;
      var verzoeken = d.verzoeken || [];
      var open = verzoeken.filter(function(v){ return v.status==='wacht'; });
      wachtend = {};
      open.forEach(function(v){ (v.wijzigingen||[]).forEach(function(w){ wachtend[sleutel(w.id, w.doelgroep||null)]=true; }); });
      var uitLabel = 'Controlekamer', extra = [];
      if (open.length) extra.push(open.length+' wacht');
      if (d.functiesUit) extra.push(d.functiesUit+' globaal uit');
      if (d.doelgroepUit) extra.push(d.doelgroepUit+' per doelgroep');
      if (extra.length) uitLabel += ' · '+extra.join(' · ');
      $('#tabBtnFuncties').textContent = uitLabel;
      $('#verzoekBlok').hidden = !verzoeken.length;
      if (verzoeken.length) vervang($('#verzoeken'), verzoeken.map(verzoekRij));
      catData = d.functies || [];
      doelgroepenMeta = d.doelgroepen || [];
      tekenChips(); updBulk(); tekenFuncties();
    }).catch(function(e){
      if (/401|403|Log in|toegang/i.test(e.message)){ token=null; sessionStorage.removeItem('techToken'); toonLogin(); }
      else toast(e.message);
    });
  }

  function start(){
    if (!token){ toonLogin(); return; }
    toonBord();
    laad();
    if (timer) clearInterval(timer);
    timer = setInterval(laad, 12000); // elke 12s verversen
  }
  start();
})();
