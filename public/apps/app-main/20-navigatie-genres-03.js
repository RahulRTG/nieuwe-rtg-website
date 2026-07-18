    for (const a of aanb){
      const medisch = a.soort === 'kliniek' || (a.behandelingen || []).some(b => b.soort === 'medisch');
      html += '<div class="card"><div style="display:flex;gap:0.5rem;align-items:baseline;"><span style="font-size:1.1rem;">'+esc(a.icon||'🌿')+'</span>'+
        '<div style="flex:1;"><b>'+esc(a.naam)+'</b> <span class="soft-sm">· '+esc(careSoort[a.soort]||a.soort)+(a.waar?' · '+esc(a.waar):'')+'</span>'+
        (a.beschrijving?'<div class="soft-sm" style="margin-top:0.15rem;">'+esc(a.beschrijving)+'</div>':'')+
        ((a.behandelaars||[]).length?'<div class="soft-sm" style="margin-top:0.2rem;">👤 '+a.behandelaars.map(b => esc(b.naam)+(b.functie?' ('+esc(b.functie)+')':'')).join(' · ')+'</div>':'')+'</div></div>';
      // intake-deling voor klinieken/medische zorg: uitdrukkelijk en per aanbieder
      if (medisch){
        const actief = !!a.intakeActief;
        html += '<div style="margin-top:0.6rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div class="soft-sm" style="margin-bottom:0.35rem;">🩺 '+(actief
            ? T('care.intakeaan','U deelt medische context met deze kliniek. U kunt dit bij Mijn afspraken stoppen.')
            : T('care.intakeuit','Wilt u dat de behandelaar iets weet (medicijnen, allergie, aandoening)? Deel het apart en alleen met deze kliniek.'))+'</div>'+
          (actief ? '' :
            '<textarea data-care-intaketxt="'+esc(a.id)+'" rows="2" placeholder="'+T('care.intakeph','Bijv. ik gebruik bloedverdunners en ben allergisch voor penicilline')+'" style="width:100%;box-sizing:border-box;background:var(--card2,var(--card));border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.7rem;font-size:0.8rem;color:var(--txt);outline:none;resize:vertical;">'+esc(careIntakeTekst[a.id]||'')+'</textarea>'+
            '<button class="bz-btn" data-care-intakedeel="'+esc(a.id)+'" style="margin-top:0.4rem;">'+T('care.intakedeel','Deel met deze kliniek')+'</button>')+
          '</div>';
      }
      for (const b of (a.behandelingen || [])){
        const open = careOpen === a.id + ':' + b.id;
        const behlr = (a.behandelaars || []).find(x => x.id === b.behandelaarId);
        html += '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><div style="flex:1;"><div style="font-size:0.88rem;">'+esc(b.naam)+
            ' <span style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:'+(b.soort==='medisch'?'var(--gold)':'var(--green,#8bc3a8)')+';">'+(b.soort==='medisch'?T('care.med','medisch'):T('care.well','wellness'))+'</span></div>'+
            '<div class="soft-sm">'+b.duurMin+' '+T('care.min','min')+(behlr?' · '+esc(behlr.naam):'')+'</div></div>'+
            '<span style="color:var(--gold);font-size:0.82rem;white-space:nowrap;">'+eur(b.prijs)+'</span></div>';
        if (open){
          const k = careKeuze;
          html += '<div style="margin-top:0.5rem;">'+
            '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;">'+dagen.map(d =>
              '<button class="bz-btn'+(k.datum===d?' on':'')+'" data-cared="'+d+'">'+(d===dagen[0]?T('care.vandaag','vandaag'):d.slice(8)+'/'+d.slice(5,7))+'</button>').join('')+'</div>'+
            '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.45rem;">'+(b.tijden||[]).map(t2 =>
              '<button class="bz-btn'+(k.tijd===t2?' on':'')+'" data-caret="'+t2+'">'+t2+'</button>').join('')+'</div>'+
            '<button class="bz-groot" id="careBoek" style="margin-top:0.7rem;"'+(k.tijd?'':' disabled')+'>'+T('care.boek','Boek en betaal')+' · '+eur(b.prijs)+'</button></div>';
        } else {
          html += '<button class="bz-btn" data-careopen="'+a.id+':'+b.id+'" style="margin-top:0.45rem;">'+T('care.kies','Kies dag en tijd')+'</button>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-care-intaketxt]').forEach(t => t.addEventListener('input', () => { careIntakeTekst[t.dataset.careIntaketxt] = t.value; }));
    el.querySelectorAll('[data-care-intakedeel]').forEach(x => x.addEventListener('click', async () => {
      const id = x.dataset.careIntakedeel;
      try { await API.call('/care/intake/deel', { aanbiederId: id, medisch: careIntakeTekst[id] || '' }); careIntakeTekst[id] = ''; toast(T('care.deeltoast','Gedeeld. Alleen deze kliniek ziet het, tot u stopt.')); laadCare(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-careopen]').forEach(x => x.addEventListener('click', () => {
      careOpen = x.dataset.careopen; careKeuze = { datum: dagen[0], tijd: null }; renderCareAanbod();
    }));
    el.querySelectorAll('[data-cared]').forEach(x => x.addEventListener('click', () => { careKeuze.datum = x.dataset.cared; renderCareAanbod(); }));
    el.querySelectorAll('[data-caret]').forEach(x => x.addEventListener('click', () => { careKeuze.tijd = x.dataset.caret; renderCareAanbod(); }));
    const boek = document.getElementById('careBoek');
    if (boek) boek.addEventListener('click', async () => {
      const [aanbiederId, behandelingId] = careOpen.split(':');
      try {
        const r = await API.call('/care/boek', { aanbiederId, behandelingId, datum: careKeuze.datum, tijd: careKeuze.tijd });
        await API.call('/care/betaal', { ref: r.boeking.ref });
        toast(T('care.oktoast','Geboekt en betaald. Tot uw afspraak.'));
        careOpen = null; careKeuze = null;
        laadCare();
      } catch(e){ toast(e.message); }
    });
  }
  function renderCarePakketten(){
    const el = $('#carePakketten'); if (!el) return;
    if (!carePak.length && !carePakMijn.length){ el.innerHTML = ''; return; }
    const dagen = [];
    for (let d = 0; d < 7; d++){ dagen.push(new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)); }
    let html = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.1rem 0 0.5rem;">'+T('care.pakketten','Herstel- & verblijfpakketten')+'</div>';
    // mijn geboekte pakketten
    for (const b of carePakMijn){
      html += '<div class="card" style="border-color:rgba(194,58,94,0.3);">'+
        '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--burgundy);">🌸 '+T('care.pakket','Pakket')+'</div>'+
        '<div style="margin-top:0.3rem;font-size:0.92rem;"><b>'+esc(b.naam)+'</b></div>'+
        '<div class="soft-sm">'+b.nachten+' '+T('care.nachten','nachten')+' · '+esc(b.hotelNaam)+' · '+b.datum+' '+b.tijd+' · '+eur(b.prijs)+
          ' · '+(b.paid?'<span style="color:var(--green,#8bc3a8);">'+T('care.betaald','betaald')+'</span>':'<span style="color:var(--gold);">'+T('care.tebetalen','nog te betalen')+'</span>')+'</div>'+
        (b.paid?'':'<button class="bz-groot" data-carepakpay="'+esc(b.ref)+'" style="margin-top:0.5rem;">'+T('care.betaal','Betaal')+' · '+eur(b.prijs)+'</button>')+
        '</div>';
    }
    // aanbod
    for (const p of carePak){
      const open = carePakOpen === p.id;
      html += '<div class="card"><div style="display:flex;justify-content:space-between;gap:0.5rem;">'+
        '<div style="flex:1;"><b>'+esc(p.naam)+'</b>'+
        '<div class="soft-sm" style="margin-top:0.15rem;">'+esc(p.beschrijving)+'</div>'+
        '<div class="soft-sm" style="margin-top:0.25rem;">🏨 '+esc(p.hotelNaam)+' · '+p.nachten+' '+T('care.nachten','nachten')+' + '+esc(p.behandelingNaam)+' ('+p.duurMin+' min)</div></div>'+
        '<div style="text-align:right;white-space:nowrap;"><div style="color:var(--gold);font-size:0.95rem;">'+eur(p.prijs)+'</div>'+
        (p.bespaar>0?'<div class="soft-sm" style="color:var(--green,#8bc3a8);">'+T('care.bespaar','bespaar')+' '+eur(p.bespaar)+'</div>':'')+'</div></div>';
