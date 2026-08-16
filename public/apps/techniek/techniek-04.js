  /* De laatste stand van het statusbord, zodat "meenemen" uit het EIGEN model
     leest en niet uit de kaartjes op het scherm. */
  var STAND = null;

  function laad(){
    return api('/api/techniek/status').then(function(d){
      STAND = d;
      eigenaar = d.eigenaar;
      tekenControle(d.controle, d.functies);
      $('#wieSub').textContent = (d.naam||'') + (d.eigenaar?' · eigenaar':' · toegelaten');
      var bev = d.beveiliging || { open:0, kritiek:0, recent:[] };
      var tellers = [
        tellerKaart(d.samenvatting.ok,'In orde'),
        tellerKaart(d.samenvatting.waarschuwing,'Let op'),
        tellerKaart(d.samenvatting.fout,'Storing')];
      if (bev.open) tellers.push(tellerKaart(bev.open, bev.kritiek?'Beveiliging!':'Beveiliging'));
      vervang($('#tellers'), tellers);
      // de motorkap-band: grootboek/motor/bank op een oogopslag, uit de checks
      var kap = { wallet:'Grootboek', motorschaduw:'Motor', bank:'Bank' };
      var kapChecks = (d.checks||[]).filter(function(c){ return kap[c.id]; });
      $('#motorkapBand').hidden = !kapChecks.length;
      if (kapChecks.length){
        var pillen = [el('span',{class:'mk-titel'},'De motorkap')];
        kapChecks.forEach(function(c){
          pillen.push(el('span',{class:'mk-pil', title:c.detail||''},
            el('span',{class:'mk-stip '+c.status}), kap[c.id]));
        });
        var band = el('div',{class:'motorkap'}, pillen);
        vervang($('#motorkapBand'), band);
      }
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
      // het papierwerk: eenmalig ophalen, niet elke 12 seconden -- anders staat
      // Rahul de vraag te verversen terwijl de eigenaar zijn antwoord typt
      $('#papierenBlok').hidden = !d.eigenaar;
      if (d.eigenaar && !papGeladen){ papGeladen = true; papieren(); }
      $('#moderniseerBlok').hidden = !d.eigenaar;
      if (d.eigenaar){
        var ms = d.moderniseringen || [];
        vervang($('#modHist'), ms.length ? ms.map(modRij) : el('div',{class:'muted', style:{fontSize:'.75rem'}}, 'Nog geen moderniseringsverzoeken.'));
      }
      $('#grenzenBlok').hidden = !(d.eigenaar && d.grenzen && d.grenzen.length);
      if (d.eigenaar && d.grenzen) vervang($('#grenzen'), d.grenzen.map(function(g){
        return el('div',{class:'zeker'}, el('span',{class:'badge uit'}, 'DICHT'), el('div',{class:'mid'}, el('div',{class:'muted'}, g))); }));
      $('#toegangBlok').hidden = !d.eigenaar;
      // het eigenaarschap: alleen de eigenaar ziet wie het is en kan overdragen
      $('#eigenaarBlok').hidden = !d.eigenaar;
      if (d.eigenaar && window.RTGTechEigenaar) RTGTechEigenaar(d.eigenaarschap);
      if (d.eigenaar) vervang($('#toegangLijst'), (d.toegang&&d.toegang.length)? d.toegang.map(toegangRij) : el('div',{class:'muted'},'Nog niemand extra toegelaten.'));
      // De Wacht-tab: zichtbaar voor iedereen met toegang (lezen); de acties
      // (afsnijden, beslissen, opruimen) zijn in de UI en op de server owner-only.
      $('#tabBtnWacht').hidden = false;
      $('#tabBtnBetalen').hidden = false;
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

  /* Meenemen (shared/uitvoer.js): het statusbord is een register van controles,
     en dat neemt een beheerder mee naar een rapportage. Veld voor veld uit
     d.checks -- niet de regels die op het scherm staan. */
  if (window.RTGUitvoer) RTGUitvoer.bron(function(){
    if (!STAND || !STAND.checks) return null;
    return {
      naam: 'techniek',
      kolommen: ['controle','code','categorie','status','toelichting'],
      rijen: STAND.checks.map(function(c){
        return [c.naam||'', c.code||'', c.categorie||'', c.status||'', c.detail||''];
      })
    };
  });

  /* HET PAPIERWERK: Rahul vraagt het AVG-register en het datalek-draaiboek uit.
     Eerder stond in die documenten een rij [VUL IN]-plekken. Een invullijst
     vult niemand in, dus stond het er nog steeds. Hier stelt Rahul de vraag,
     met erbij waarom hij hem stelt, en het antwoord landt meteen in het
     document. Verzinnen doet hij niet: op deze pagina komt alleen te staan wat
     een mens intypt. */
  var papVraagId = null, papGeladen = false;
  function papieren(){
    return api('/api/techniek/papieren').then(function(d){
      Util.tekst($('#papStand'), d.open
        ? (d.totaal - d.open) + ' van de ' + d.totaal + ' beantwoord · nog ' + d.open + ' te gaan'
        : 'Alle ' + d.totaal + ' vragen beantwoord. Laat het geheel nog juridisch nakijken.');
      var v = d.volgende;
      papVraagId = v ? v.id : null;
      $('#papVraagBlok').hidden = !v;
      if (!v) return;
      Util.tekst($('#papVraag'), v.vraag);
      Util.tekst($('#papWaarom'), v.waarom);
      Util.tekst($('#papVoorbeeld'), v.voorbeeld ? 'Bijvoorbeeld: ' + v.voorbeeld
        : (v.jaVraag ? 'Bij ja: ' + v.jaVraag + '  Bij nee: ' + v.neeVraag : ''));
      $('#papAntwoord').value = '';
      $('#papAntwoord').placeholder = v.eerderGeparkeerd
        ? 'Dit stond geparkeerd; weet u het inmiddels?' : 'Uw antwoord, in uw eigen woorden…';
    }).catch(function(e){ toast(e.message); });
  }
  function papZeg(parkeer){
    if (!papVraagId) return;
    api('/api/techniek/papieren/antwoord', { method:'POST',
      body:{ id: papVraagId, waarde: $('#papAntwoord').value, parkeer: !!parkeer } })
      .then(function(d){ toast(d.terug || 'Genoteerd.'); $('#papDoc').hidden = true; papieren(); })
      .catch(function(e){ toast(e.message); });
  }
  $('#bPapOk').addEventListener('click', function(){ papZeg(false); });
  $('#bPapParkeer').addEventListener('click', function(){ papZeg(true); });
  function papToon(naam){
    api('/api/techniek/papieren/document?naam=' + naam).then(function(d){
      Util.tekst($('#papDoc'), d.tekst);
      $('#papDoc').hidden = false;
    }).catch(function(e){ toast(e.message); });
  }
  $('#bPapReg').addEventListener('click', function(){ papToon('verwerkingsregister'); });
  $('#bPapLek').addEventListener('click', function(){ papToon('datalek'); });

  function start(){
    if (!token){ toonLogin(); return; }
    toonBord();
    laad();
    if (timer) clearInterval(timer);
    timer = setInterval(laad, 12000); // elke 12s verversen
  }
  start();
})();
