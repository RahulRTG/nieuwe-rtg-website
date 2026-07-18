    if (ont){
      const e2 = n => '€ '+((n||0)/100).toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2});
      h += '<div class="st-sec">💸 '+T('zb.ontvangsten','Rechtstreekse ontvangsten')+'</div>'+
        '<div class="stats" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+
        '<div class="b" style="flex:1;min-width:5rem;"><div class="v">'+e2(ont.som)+'</div><div class="l">'+T('zb.binnen','Binnengekomen')+'</div></div>'+
        '<div class="b" style="flex:1;min-width:4.5rem;"><div class="v">'+(ont.aantal||0)+'</div><div class="l">'+T('zb.betalingen','Betalingen')+'</div></div>'+
        '<div class="b" style="flex:1;min-width:5rem;"><div class="v">'+e2(ont.saldo)+'</div><div class="l">'+T('zb.saldo','Uitbetaalbaar')+'</div></div></div>'+
        '<div class="sub" style="margin-bottom:0.4rem;">'+T('zb.directsub','Face ID-betalingen van klanten, rechtstreeks op uw rekening.')+'</div>'+
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+
        '<input id="bvCode" placeholder="'+T('zb.codenaam','codenaam klant')+'" style="width:9rem;">'+
        '<input id="bvBedrag" type="number" min="0.5" step="0.5" placeholder="'+T('zb.bedrag','bedrag €')+'" style="width:6.5rem;">'+
        '<input id="bvOms" placeholder="'+T('zb.waarvoor','waarvoor')+'" style="width:9rem;">'+
        '<button class="abtn" id="bvSend">'+T('zb.stuurverzoek','Stuur betaalverzoek')+'</button></div>'+
        (ont.openVerzoeken&&ont.openVerzoeken.length? '<div class="sub" style="margin-bottom:0.3rem;">'+T('zb.open','Openstaand')+':</div>'+ont.openVerzoeken.map(v=>'<div style="display:flex;justify-content:space-between;gap:0.5rem;border-bottom:1px solid var(--line);padding:0.3rem 0;font-size:0.8rem;"><span>'+esc(v.naarCodename||'')+' · '+esc(v.omschrijving||'')+'</span><span>'+e2(v.bedrag)+' <button class="bev-plan" data-bvweg="'+v.ref+'">✕</button></span></div>').join(''):'')+
        (ont.betalingen&&ont.betalingen.length? '<div class="sub" style="margin:0.4rem 0 0.3rem;">'+T('zb.recent','Recent binnen')+':</div>'+ont.betalingen.slice(0,6).map(b=>'<div style="display:flex;justify-content:space-between;gap:0.5rem;font-size:0.8rem;padding:0.2rem 0;"><span>'+esc(b.codename||'')+' · '+esc(b.omschrijving||'')+'</span><b>'+e2(b.bedrag)+'</b></div>').join(''):'');
    }
    // Boerderij-KPI's: de boardroom van de boer (oogst, dieropbrengst, taken)
    if (has('boerderij')){
      let bo = boer; if (!bo){ try { bo = await API.call('/supplier/boerderij/overzicht', {}); boer = bo; } catch(e){} }
      if (bo){ const bst = bo.stats||{}; const bbr = bo.briefing||{ punten:[] };
        h += '<div class="st-sec">🚜 '+T('zb.boer','Boerderij')+(bo.typeLabel?' · '+esc(bo.typeLabel):'')+'</div>'+
          '<div class="stats" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+
          zbCel(bst.teOogsten||0, T('zb.oogstklaar','Oogstklaar'), bst.teOogsten)+
          zbCel((bst.hectare||0)+' ha', T('zb.areaal','Areaal'))+
          zbCel(bst.melkPerDag||0, T('zb.melk','L melk/dag'))+
          zbCel(bst.dieren||0, T('zb.dieren','Dieren'))+
          zbCel(bst.openTaken||0, T('zb.boertaken','Open taken'), bst.openTaken)+'</div>'+
          (bbr.punten.length ? '<div class="sub" style="margin-bottom:0.4rem;">'+esc(bbr.punten[0].tekst)+'</div>' : '')+
          '<button class="js-zbnaar" data-tab="boerderij" style="background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:0.4rem 0.7rem;color:var(--txt);font-size:0.75rem;font-family:inherit;margin-bottom:1rem;">'+T('zb.naarboer','Naar de boerderij ›')+'</button>';
      }
    }
    // de belastingtool van de zaak: dezelfde motor als de Business Pass
    h += '<div class="st-sec">🧮 '+T('zb.bel','Belastingtool')+'</div>'+
      '<div class="sub" style="margin-bottom:0.4rem;">'+T('zb.bel.s','Vul de verwachte jaarwinst in voor een indicatie van de belasting, de nettowinst en wat u maandelijks opzij zet. Het land van de zaak is het vertrekpunt.')+'</div>'+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+
      '<input id="zbBelWinst" type="number" min="1" placeholder="'+T('zb.bel.ph','jaarwinst €')+'" style="width:9rem;">'+
      '<button class="abtn" id="zbBelGo">'+T('zb.bel.reken','Reken')+'</button></div>'+
      '<div id="zbBelRes" style="display:none;border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;font-size:0.78rem;line-height:1.7;color:var(--muted);margin-bottom:0.8rem;"></div>';
    el.innerHTML = h;
    const zbGo = el.querySelector('#zbBelGo');
    if (zbGo) zbGo.addEventListener('click', async () => {
      const box = el.querySelector('#zbBelRes');
      box.style.display = 'block'; box.textContent = '…';
      try {
        const d2 = await API.call('/supplier/belasting', { winst: Number(el.querySelector('#zbBelWinst').value) });
        const rij = (l, v, sterk) => '<div style="display:flex;justify-content:space-between;gap:0.8rem;"><span>'+l+'</span><span style="flex-shrink:0;'+(sterk?'color:var(--txt);font-weight:600;':'')+'">'+v+'</span></div>';
        box.innerHTML = '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);margin-bottom:0.35rem;">'+d2.regime+' · '+d2.landNaam+'</div>'+
          rij(T('zb.bel.winst','Jaarwinst'), eur(d2.winst))+
          d2.posten.map(p2 => rij(p2.label, (p2.bedrag<0?'- ':'')+eur(Math.abs(p2.bedrag)))).join('')+
          rij(T('zb.bel.betalen','Te betalen (indicatie)'), eur(d2.belasting), true)+
          rij(T('zb.bel.netto','Netto over'), eur(d2.netto), true)+
          '<div style="margin-top:0.5rem;color:var(--gold);">💡 '+T('zb.bel.zet','Zet ~')+d2.reserveerPct+'% '+T('zb.bel.opzij','opzij: ongeveer')+' '+eur(d2.perMaand)+' '+T('zb.bel.pm','per maand')+'.</div>'+
          '<div style="margin-top:0.4rem;font-size:0.64rem;color:var(--soft);">'+T('zb.bel.disc','Indicatie; dit is voorlichting, geen bindend fiscaal advies.')+'</div>';
      } catch(e){ box.textContent = e.message; }
    });
    wireFuncBlok(el);
    el.querySelectorAll('.js-zbf').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/zaak/functie', { id:b.dataset.id, aan: b.dataset.aan!=='true' }); await refresh(); renderZaakBoard(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-zbnaar').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab)));
    const bvSend = $('#bvSend');
    if (bvSend) bvSend.addEventListener('click', async () => {
      const bedrag = Number(($('#bvBedrag')||{}).value);
      if (!(bedrag >= 0.5)) { toast(T('zb.bedragmin','Kies een bedrag van minstens € 0,50.')); return; }
      try { await API.call('/supplier/betaalverzoek', { codename: ($('#bvCode')||{}).value, bedrag, omschrijving: ($('#bvOms')||{}).value }); toast('💸 '+T('zb.verzoekgestuurd','Betaalverzoek verstuurd.')); renderZaakBoard(); }
      catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-bvweg]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/betaalverzoek/intrek', { ref:b.dataset.bvweg }); renderZaakBoard(); } catch(e){ toast(e.message); }
    }));
  }
  function zbCel(n, label, waarschuw){
    return '<div class="b" style="flex:1;min-width:4.5rem;"><div class="v'+(waarschuw?' a':'')+'">'+n+'</div><div class="l">'+label+'</div></div>';
  }
  /* Gedeeld met de Boardroom: vat een rij aan/uit-schakelaars samen tot een
     rustige, inklapbare kop "titel · X/Y aan". Alleen open als er iets uit staat
     (de uitzondering telt), of wanneer de gebruiker erop tikt. Zo lijken alle
     schakelpanelen op elkaar en oogt veel opties nooit slordig. */
  function funcBlok(titel, functies, chipsHTML){
    const totaal = functies.length;
    const aan = functies.filter(f => f.aan).length;
    const uit = totaal - aan;
    const afwijkt = uit > 0;
    return '<button type="button" class="func-kop" data-funcblok>'+
      '<span class="func-chev">'+(afwijkt?'▾':'▸')+'</span>'+
      '<span class="func-naam">'+esc(titel)+'</span>'+
      '<span class="func-tel'+(afwijkt?' let':'')+'">'+aan+'/'+totaal+' '+T('fb.aan','aan')+(uit?' · '+uit+' '+T('fb.uit','uit'):'')+'</span></button>'+
      '<div class="func-body"'+(afwijkt?'':' hidden')+'>'+chipsHTML+'</div>';
  }
  /* Klap elk funcBlok in een container open/dicht (chevron mee). */
  function wireFuncBlok(root){
    if (!root) return;
    root.querySelectorAll('[data-funcblok]').forEach(k => k.addEventListener('click', () => {
      const body = k.nextElementSibling; if (!body) return;
      const chev = k.querySelector('.func-chev');
      const dicht = body.hidden; body.hidden = !dicht;
      if (chev) chev.textContent = dicht ? '▾' : '▸';
    }));
  }

  /* ---- het beveiligings-commandocentrum ---- */
  let bevDatum = null; // gekozen roosterdag
  function bevVandaag(){ return new Date().toISOString().slice(0,10); }
  async function renderBeveiliging(){
    const el = $('#bevWrap'); if (!el) return;
    if (!has('beveiliging')) { el.innerHTML=''; return; }
    let cmd, roo;
