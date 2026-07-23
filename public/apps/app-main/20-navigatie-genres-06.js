      for (const b of p.boten){
        const open = chOpen === p.code + ':' + b.id;
        html += '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><div style="font-size:0.88rem;">'+(b.icoon||'')+' '+esc(b.naam)+'</div>'+
          '<span style="color:var(--gold);font-size:0.82rem;white-space:nowrap;">'+eur(b.dagprijs)+'/'+T('ch.dag','dag')+'</span></div>'+
          '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.2rem;">'+esc(b.type||'')+' · '+(b.lengte||0)+'m · '+(b.gasten||'-')+(b.hutten?' · '+b.hutten:'')+' · '+(b.snelheidKn||0)+' kn · '+esc(b.ligplaats||'')+' · '+T('ch.borg','borg')+' '+eur(b.borg||0)+
          ' · '+(b.skipperVerplicht?''+T('ch.skipperv','schipper verplicht'):(b.vaarbewijsVereist?T('ch.vaarbewijs','vaarbewijs of schipper'):T('ch.vrij','vrij')))+'</div>';
        if (open){
          const verplicht = b.skipperVerplicht;
          html += '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;">'+
            '<div class="bz-veld" style="flex:1;margin-top:0;"><label>'+T('ch.van','Vanaf')+'</label><input type="date" id="chVan" value="'+chKeuze.van+'"></div>'+
            '<div class="bz-veld" style="flex:1;margin-top:0;"><label>'+T('ch.tot','Tot')+'</label><input type="date" id="chTot" value="'+chKeuze.tot+'"></div>'+
            '<div class="bz-veld" style="width:76px;margin-top:0;"><label>'+T('ch.gastn','Gasten')+'</label><input type="number" id="chGasten" min="1" max="'+(b.gasten||12)+'" value="'+Math.min(2,b.gasten||2)+'"></div></div>'+
            (verplicht
              ? '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.5rem;">'+T('ch.altijdskipper','Dit vaartuig vaart altijd met een schipper (+'+eur(b.skipperPrijsPerDag||0)+'/'+T('ch.dag','dag')+').')+'</div>'
              : '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8rem;margin-top:0.55rem;"><input type="checkbox" id="chSkipper">  '+T('ch.wilskipper','Met schipper (+'+eur(b.skipperPrijsPerDag||0)+'/'+T('ch.dag','dag')+')')+'</label>'+
                '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8rem;margin-top:0.35rem;"><input type="checkbox" id="chVaarbewijs"> '+T('ch.hebvaarbewijs','Ik vaar bareboat en heb een geldig vaarbewijs')+'</label>')+
            '<button class="bz-groot" id="chBoek" style="margin-top:0.7rem;" data-verplicht="'+(verplicht?'1':'0')+'">'+T('ch.boek','Boek en betaal, vaste prijs')+'</button>';
        } else {
          html += '<button class="bz-btn" data-chopen="'+p.code+':'+b.id+'" style="margin-top:0.45rem;">'+T('ch.kies','Kies periode')+'</button>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    document.querySelectorAll('[data-chopen]').forEach(b => b.addEventListener('click', () => {
      chOpen = b.dataset.chopen;
      chKeuze = { van: new Date(Date.now() + 86400000).toISOString().slice(0, 10), tot: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) };
      renderChAanbod(); koppelChActies();
    }));
    const boek = document.getElementById('chBoek');
    if (boek) boek.addEventListener('click', async () => {
      const [code, bootId] = chOpen.split(':');
      const verplicht = boek.dataset.verplicht === '1';
      const metSkipper = verplicht || ($('#chSkipper') && $('#chSkipper').checked);
      const body = { supplierCode: code, bootId, van: $('#chVan').value, tot: $('#chTot').value, gasten: Number($('#chGasten').value), metSkipper };
      if (!metSkipper && $('#chVaarbewijs')) body.vaarbewijs = $('#chVaarbewijs').checked;
      try {
        const c = await API.call('/charter/boek', body);
        await API.call('/booking/pay', { ref: c.charter.ref });
        toast(T('ch.ok','Geboekt en betaald: ') + eur(c.charter.price) + T('ch.ok2',' vast. Behouden vaart.'));
        chOpen = null; chKeuze = null;
        laadCharter();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- vastgoed: aanbod, interesse, bod, keyless ---------- */
  let vgOpen = null;
  const vgGeld = n => '\u20AC ' + Number(n||0).toLocaleString('nl-NL');
  async function laadVastgoed(){
    if (!API.live) return;
    let d = { panden: [], bezichtigingen: [], biedingen: [] };
    try { d = await API.call('/vastgoed/aanbod'); } catch(e){}
    const el = $('#vgMijn'); if (!el) return;
    if (!d.panden.length && !d.bezichtigingen.length && !d.biedingen.length){ el.innerHTML = ''; return; }
    let html = '';
    // lopende bezichtigingen met keyless
    for (const b of d.bezichtigingen){
      if (b.status === 'afgewezen') continue;
      html += '<div class="card" style="border-color:rgba(91,185,140,0.4);">'+
        '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--green);">\uD83D\uDD11 '+T('vg.m.bez','Bezichtiging')+' \u00B7 '+esc(b.pand)+'</div>'+
        '<div style="margin-top:0.3rem;font-size:0.85rem;">'+({ 'aangevraagd': T('vg.m.aangevr','aangevraagd, wacht op bevestiging'), 'bevestigd': T('vg.m.bevestigd','bevestigd')+(b.moment?' \u00B7 '+String(b.moment).replace('T',' ').slice(0,16):''), 'afgewezen': T('vg.m.afgewezen','afgewezen') }[b.status] || b.status)+'</div>'+
        (b.keyless ? (b.keyless.actiefNu
          ? '<button class="bz-groot" style="margin-top:0.6rem;" data-vgkey="'+b.ref+'">\uD83D\uDD13 '+T('vg.m.open','Open de deur (keyless)')+'</button>'
          : '<div style="margin-top:0.4rem;font-size:0.76rem;color:var(--soft);">\uD83D\uDD12 '+T('vg.m.venster','Keyless toegang rond het afgesproken moment')+'</div>') : '')+
        '</div>';
    }
    // eigen biedingen
    for (const b of d.biedingen){
      html += '<div class="card"><div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);">\uD83D\uDCB0 '+T('vg.m.bod','Uw bod')+' \u00B7 '+esc(b.pand)+'</div>'+
        '<div style="margin-top:0.3rem;font-size:0.85rem;">'+vgGeld(b.bedrag)+' \u00B7 <b>'+({ 'open':T('vg.m.open2','in behandeling'),'geaccepteerd':T('vg.m.acc','geaccepteerd!'),'afgewezen':T('vg.m.afg','afgewezen'),'tegenbod':T('vg.m.tegen','tegenbod')+(b.tegenbod?' '+vgGeld(b.tegenbod):'') }[b.status]||b.status)+'</b></div></div>';
    }
    // aangeboden panden
    if (d.panden.length){
      html += '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.1rem 0 0.5rem;">\uD83C\uDFE1 '+T('vg.m.aanbod','Voor u: vastgoed')+'</div>';
      for (const p of d.panden){
        const open = vgOpen === p.supplierCode + ':' + p.id;
        html += '<div class="card">'+
          (p.fotos && p.fotos.length ? '<img src="'+p.fotos[0]+'" alt="" style="width:100%;border-radius:12px;margin-bottom:0.5rem;max-height:180px;object-fit:cover;">' : '')+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><b>'+esc(p.titel)+(p.gericht?' <span style="font-size:0.6rem;color:var(--burgundy);">\u2605 '+T('vg.m.gericht','persoonlijk')+'</span>':'')+'</b>'+
          '<span style="color:var(--gold);white-space:nowrap;">'+vgGeld(p.prijs)+(p.transactie==='huur'?'/mnd':'')+'</span></div>'+
          '<div style="font-size:0.74rem;color:var(--soft);margin-top:0.2rem;">'+esc(p.soort)+' \u00B7 '+esc(p.plaats||'')+' \u00B7 \uD83D\uDECF\uFE0F'+(p.slaapkamers||0)+' \u00B7 \uD83D\uDEC1'+(p.badkamers||0)+' \u00B7 '+(p.oppervlakte||0)+'m\u00B2'+(p.zwembad?' \u00B7 \uD83C\uDFCA':'')+'</div>'+
          (open ? '<div style="margin-top:0.5rem;font-size:0.82rem;color:var(--muted);">'+escT(p.omschrijving||'')+'</div>'+
            (p.fotos && p.fotos.length > 1 ? '<div style="display:flex;gap:0.4rem;overflow-x:auto;margin-top:0.5rem;">'+p.fotos.slice(1).map(f=>'<img src="'+f+'" alt="" style="height:70px;border-radius:8px;">').join('')+'</div>' : '')+
            '<div style="display:flex;gap:0.5rem;margin-top:0.7rem;">'+
            '<button class="bz-groot" style="flex:1;" data-vgint="'+p.supplierCode+':'+p.id+'">\uD83D\uDC41\uFE0F '+T('vg.m.interesse','Bezichtigen')+'</button>'+
            '<button class="bz-btn" data-vgbod="'+p.supplierCode+':'+p.id+'">\uD83D\uDCB0 '+T('vg.m.doebod','Bod')+'</button></div>'
            : '<button class="bz-btn" data-vgopen="'+p.supplierCode+':'+p.id+'" style="margin-top:0.5rem;">'+T('vg.m.bekijk','Bekijk')+'</button>')+
          '</div>';
      }
    }
    el.innerHTML = html;
    document.querySelectorAll('[data-vgopen]').forEach(b => b.addEventListener('click', () => { vgOpen = b.dataset.vgopen; laadVastgoed(); }));
    document.querySelectorAll('[data-vgint]').forEach(b => b.addEventListener('click', async () => {
      const [code, pid] = b.dataset.vgint.split(':');
      const wens = prompt(T('vg.m.wensvraag','Wanneer zou u willen bezichtigen? (bijv. zaterdagochtend)'));
