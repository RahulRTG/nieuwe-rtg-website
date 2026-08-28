/* de HR-cijfers op het zaakbord */
    const hr = d.hr || {};
    h += '<div class="st-sec">'+T('zb.hr','HR')+'</div><div class="stats" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+
      zbCel(hr.teamAantal||0, T('zb.team','Team'))+zbCel(hr.ingeklokt||0, T('zb.ingeklokt','Ingeklokt'))+
      zbCel(hr.openVerlof||0, T('zb.verlof','Verlof/ziek'), hr.openVerlof)+zbCel(hr.openSollicitaties||0, T('zb.soll','Sollicitaties'), hr.openSollicitaties)+
      zbCel(hr.openVacatures||0, T('zb.vac','Vacatures'))+'</div>'+
      '<button class="js-zbnaar" data-tab="team" style="background:var(--card2);border:1px solid var(--line);border-radius:0;padding:0.4rem 0.7rem;color:var(--txt);font-size:0.75rem;font-family:inherit;margin-bottom:1rem;">'+T('zb.naarteam','Naar het team ›')+'</button>';
    // Marketing
    const mk = d.marketing || {};
    h += '<div class="st-sec">'+T('zb.marketing','Marketing (De Salon)')+'</div><div class="stats" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+
      zbCel(mk.volgers||0, T('zb.volgers','Volgers'))+zbCel(mk.posts||0, T('zb.posts','Posts'))+
      zbCel(mk.lopendeDeal?1:0, T('zb.deal','Actie'))+zbCel(mk.lopendePoll?1:0, T('zb.poll','Poll'))+'</div>'+
      '<div class="sub" style="margin-bottom:0.5rem;">'+(mk.salonActief? (mk.bioIngevuld&&mk.fotoIngevuld ? '✓ '+T('zb.compleet','profiel compleet, zichtbaar voor leden') : ''+T('zb.onvolledig','profiel onvolledig, nog niet zichtbaar')) : '○ '+T('zb.salonuit','Salon-marketing staat uit'))+'</div>'+
      (mk.laatstePost? '<div class="sub">'+T('zb.laatste','Laatste post')+': '+esc(mk.laatstePost.text)+'</div>' : '')+
      '<button class="js-zbnaar" data-tab="page" style="background:var(--card2);border:1px solid var(--line);border-radius:0;padding:0.4rem 0.7rem;color:var(--txt);font-size:0.75rem;font-family:inherit;margin-top:0.5rem;">'+T('zb.naarsalon','Naar De Salon ›')+'</button>';
    // Rechtstreekse ontvangsten: geld dat direct van klanten binnenkwam (Face ID)
    let ont = null; try { ont = await API.call('/supplier/ontvangsten'); } catch(e){}
    if (ont){
      const e2 = n => '€ '+((n||0)/100).toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2});
      h += '<div class="st-sec">'+T('zb.ontvangsten','Rechtstreekse ontvangsten')+'</div>'+
        '<div class="stats" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+
        '<div class="b" style="flex:1;min-width:5rem;"><div class="v">'+e2(ont.som)+'</div><div class="l">'+T('zb.binnen','Binnengekomen')+'</div></div>'+
        '<div class="b" style="flex:1;min-width:4.5rem;"><div class="v">'+(ont.aantal||0)+'</div><div class="l">'+T('zb.betalingen','Betalingen')+'</div></div>'+
        '<div class="b" style="flex:1;min-width:5rem;"><div class="v">'+e2(ont.saldo)+'</div><div class="l">'+T('zb.saldo','Uitbetaalbaar')+'</div></div></div>'+
        '<div class="sub" style="margin-bottom:0.5rem;">'+T('zb.directsub','Face ID-betalingen van klanten, rechtstreeks op uw rekening.')+'</div>'+
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+
        '<input id="bvCode" placeholder="'+T('zb.codenaam','codenaam klant')+'" style="width:9rem;">'+
        '<input id="bvBedrag" type="number" min="0.5" step="0.5" placeholder="'+T('zb.bedrag','bedrag €')+'" style="width:6.5rem;">'+
        '<input id="bvOms" placeholder="'+T('zb.waarvoor','waarvoor')+'" style="width:9rem;">'+
        '<button class="abtn" id="bvSend">'+T('zb.stuurverzoek','Stuur betaalverzoek')+'</button></div>'+
        (ont.openVerzoeken&&ont.openVerzoeken.length? '<div class="sub" style="margin-bottom:0.25rem;">'+T('zb.open','Openstaand')+':</div>'+ont.openVerzoeken.map(v=>'<div style="display:flex;justify-content:space-between;gap:0.5rem;border-bottom:1px solid var(--line);padding:0.3rem 0;font-size:0.8rem;"><span>'+esc(v.naarCodename||'')+' · '+esc(v.omschrijving||'')+'</span><span>'+e2(v.bedrag)+' <button class="bev-plan" data-bvweg="'+v.ref+'">✕</button></span></div>').join(''):'')+
        (ont.betalingen&&ont.betalingen.length? '<div class="sub" style="margin:0.5rem 0 0.25rem;">'+T('zb.recent','Recent binnen')+':</div>'+ont.betalingen.slice(0,6).map(b=>'<div style="display:flex;justify-content:space-between;gap:0.5rem;font-size:0.8rem;padding:0.2rem 0;"><span>'+esc(b.codename||'')+' · '+esc(b.omschrijving||'')+'</span><b>'+e2(b.bedrag)+'</b></div>').join(''):'');
    }
    // Boerderij-KPI's: de boardroom van de boer (oogst, dieropbrengst, taken)
    if (has('boerderij')){
      let bo = boer; if (!bo){ try { bo = await API.call('/supplier/boerderij/overzicht', {}); boer = bo; } catch(e){} }
      if (bo){ const bst = bo.stats||{}; const bbr = bo.briefing||{ punten:[] };
        h += '<div class="st-sec">'+T('zb.boer','Boerderij')+(bo.typeLabel?' · '+esc(bo.typeLabel):'')+'</div>'+
          '<div class="stats" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+
          zbCel(bst.teOogsten||0, T('zb.oogstklaar','Oogstklaar'), bst.teOogsten)+
          zbCel((bst.hectare||0)+' ha', T('zb.areaal','Areaal'))+
          zbCel(bst.melkPerDag||0, T('zb.melk','L melk/dag'))+
          zbCel(bst.dieren||0, T('zb.dieren','Dieren'))+
          zbCel(bst.openTaken||0, T('zb.boertaken','Open taken'), bst.openTaken)+'</div>'+
          (bbr.punten.length ? '<div class="sub" style="margin-bottom:0.4rem;">'+esc(bbr.punten[0].tekst)+'</div>' : '')+
          '<button class="js-zbnaar" data-tab="boerderij" style="background:var(--card2);border:1px solid var(--line);border-radius:0;padding:0.4rem 0.7rem;color:var(--txt);font-size:0.75rem;font-family:inherit;margin-bottom:1rem;">'+T('zb.naarboer','Naar de boerderij ›')+'</button>';
      }
    }
