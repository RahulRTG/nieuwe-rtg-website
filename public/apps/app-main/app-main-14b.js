/* de zorgpakketten: wat er loopt en wat er te kiezen valt */
  function renderCarePakketten(){
    const el = $('#carePakketten'); if (!el) return;
    if (!carePak.length && !carePakMijn.length){ el.innerHTML = ''; return; }
    const dagen = [];
    for (let d = 0; d < 7; d++){ dagen.push(new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)); }
    let html = '<div class="s-llzgco">'+T('care.pakketten','Herstel- & verblijfpakketten')+'</div>';
    // mijn geboekte pakketten
    for (const b of carePakMijn){
      html += '<div class="card s-b27r2w">'+
        '<div class="s-11guwa8">'+T('care.pakket','Pakket')+'</div>'+
        '<div class="s-g18z7m"><b>'+esc(b.naam)+'</b></div>'+
        '<div class="soft-sm">'+b.nachten+' '+T('care.nachten','nachten')+' · '+esc(b.hotelNaam)+' · '+b.datum+' '+b.tijd+' · '+eur(b.prijs)+
          ' · '+(b.paid?'<span class="s-muqwc6">'+T('care.betaald','betaald')+'</span>':'<span class="s-1poh6kx">'+T('care.tebetalen','nog te betalen')+'</span>')+'</div>'+
        (b.paid?'':'<button class="bz-groot h-mt50" data-carepakpay="'+esc(b.ref)+'">'+T('care.betaal','Betaal')+' · '+eur(b.prijs)+'</button>')+
        '</div>';
    }
    // aanbod
    for (const p of carePak){
      const open = carePakOpen === p.id;
      html += '<div class="card"><div style="display:flex;justify-content:space-between;gap:0.5rem;">'+
        '<div class="h-flex1"><b>'+esc(p.naam)+'</b>'+
        '<div class="soft-sm h-mt15">'+esc(p.beschrijving)+'</div>'+
        '<div class="soft-sm h-mt25">'+esc(p.hotelNaam)+' · '+p.nachten+' '+T('care.nachten','nachten')+' + '+esc(p.behandelingNaam)+' ('+p.duurMin+' min)</div></div>'+
        '<div class="s-hfmpdj"><div class="s-1ixwj23">'+eur(p.prijs)+'</div>'+
        (p.bespaar>0?'<div class="soft-sm s-muqwc6">'+T('care.bespaar','bespaar')+' '+eur(p.bespaar)+'</div>':'')+'</div></div>';
      if (open){
        const k = carePakKeuze;
        html += '<div class="s-e7t9zs">'+
          '<div class="soft-sm s-iy4lih">'+T('care.pakkies','Kies wanneer de behandeling valt:')+'</div>'+
          '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;">'+dagen.map(d =>
            '<button class="bz-btn'+(k.datum===d?' on':'')+'" data-carepakd="'+d+'">'+(d===dagen[0]?T('care.vandaag','vandaag'):d.slice(8)+'/'+d.slice(5,7))+'</button>').join('')+'</div>'+
          '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.5rem;">'+(p.tijden||[]).map(t2 =>
            '<button class="bz-btn'+(k.tijd===t2?' on':'')+'" data-carepakt="'+t2+'">'+t2+'</button>').join('')+'</div>'+
          '<button class="bz-groot h-mt70" id="carePakBoek"'+(k.tijd?'':' disabled')+'>'+T('care.pakboek','Boek dit pakket')+' · '+eur(p.prijs)+'</button></div>';
      } else {
        html += '<button class="bz-btn h-mt50" data-carepakopen="'+esc(p.id)+'">'+T('care.pakkies2','Kies dag en tijd')+'</button>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
