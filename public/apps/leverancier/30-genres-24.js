
  // ---- de zorgtak van de verzekeraar: zorgpassen en de declaratieketen ----
  async function renderZorgpolis(){
    const el = $('#polZorgWrap'); if (!el) return;
    if (!has('polis')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/zorgpolis'); } catch(e){ el.innerHTML = '<p class="sub">'+esc(e.message)+'</p>'; return; }
    const goud = 'background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;';
    const knop = (attr, id, tekst, vol) => '<button '+attr+'="'+id+'" style="'+(vol?'background:var(--gold);color:#000;border:none;':'background:none;border:1px solid var(--line);color:var(--soft);')+'border-radius:8px;padding:0.35rem 0.7rem;font-family:inherit;font-size:0.72rem;'+(vol?'font-weight:600;':'')+'">'+tekst+'</button>';
    const k = d.kpi;
    let h = '<div class="st-sec" style="margin-top:1.4rem;">'+T('zp.kop','Zorgverzekering · de werkplek')+'</div>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr));gap:0.5rem;">'+
      [[k.actief, T('zp.k.actief','actieve polissen')],[k.open, T('zp.k.open','declaraties open')],[k.goedgekeurd, T('zp.k.goed','goedgekeurd')]]
        .map(x=>'<div style="border:1px solid var(--line);border-radius:12px;padding:0.55rem 0.7rem;text-align:center;"><b style="font-size:1.1rem;display:block;">'+x[0]+'</b><span class="sub">'+x[1]+'</span></div>').join('')+'</div>';

    // inschrijven: op codenaam, door een mens; de pas landt in de wallet
    h += '<div class="row-gap" style="margin-top:0.7rem;"><input id="zpCode" class="st-in" placeholder="'+T('zp.codenaam','Codenaam van het lid')+'" maxlength="60" style="flex:2;">'+
      '<select id="zpPakket" class="st-in" style="flex:1;">'+Object.keys(d.pakketten).map(p=>'<option value="'+p+'">'+p+' · '+eur(d.pakketten[p])+' p/m</option>').join('')+'</select>'+
      '<button id="zpIn" style="flex:1;'+goud+'">'+T('zp.schrijfin','Schrijf in')+'</button></div>'+
      '<p class="sub" style="margin-top:0.3rem;">'+T('zp.regel','Inschrijven doet altijd een medewerker, op codenaam; de zorgpas verschijnt direct in de RTG Wallet van het lid.')+'</p>';
    h += (d.verzekerden||[]).slice(0,10).map(v=>'<div style="display:flex;gap:0.5rem;align-items:center;border-bottom:1px solid var(--line);padding:0.35rem 0;">'+
      '<span class="sub" style="flex:0 0 4.5rem;">'+esc(v.pas)+'</span><b style="flex:1;font-size:0.85rem;">'+esc(v.codenaam)+'</b><span class="sub">'+esc(v.pakket)+' · '+esc(v.status)+'</span>'+
      (v.status==='actief'?knop('data-zpstop', v.id, T('zp.stop','Stop polis')):'')+'</div>').join('');

    // declaraties: invoeren en beslissen (mens beslist; afwijzen met reden)
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('zp.decl','Declaraties')+'</div>'+
      '<div class="row-gap"><input id="zpDPas" class="st-in" placeholder="'+T('zp.pasnr','Pasnummer (ZP-XXXX)')+'" maxlength="12" style="flex:1;text-transform:uppercase;">'+
      '<input id="zpDOms" class="st-in" placeholder="'+T('zp.oms','Waar gaat het over?')+'" maxlength="160" style="flex:2;"><input id="zpDBedrag" class="st-in" type="number" min="1" step="0.01" placeholder="EUR" style="flex:0 0 6rem;">'+
      '<button id="zpDIn" style="flex:1;'+goud+'">'+T('zp.dien','Dien in')+'</button></div>';
    h += (d.declaraties||[]).map(x=>'<div style="border:1px solid '+(x.status==='ingediend'?'var(--gold)':'var(--line)')+';border-radius:12px;padding:0.6rem 0.8rem;margin-top:0.5rem;">'+
      '<div style="display:flex;gap:0.5rem;align-items:baseline;"><b style="flex:1;font-size:0.85rem;">'+esc(x.codenaam)+' · '+esc(x.omschrijving)+'</b><span class="sub">'+eur(x.bedrag)+' · '+esc(x.status)+'</span></div>'+
      (x.reden?'<div class="sub">'+T('zp.reden','Reden')+': '+esc(x.reden)+'</div>':'')+
      (x.status==='ingediend'?'<div class="row-gap" style="margin-top:0.45rem;">'+knop('data-zpgoed', x.id, T('zp.goed','Keur goed'), true)+
        '<input data-zpredin="'+x.id+'" class="st-in" placeholder="'+T('zp.redenwaarom','Reden bij afwijzen')+'" maxlength="160" style="flex:2;">'+knop('data-zpaf', x.id, T('zp.af','Wijs af'))+'</div>':'')+'</div>').join('');

    // de pas-controle: alleen actief, pakket en codenaam
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('zp.check','Pas-controle')+'</div>'+
      '<div class="row-gap"><input id="zpCPas" class="st-in" placeholder="'+T('zp.pasnr','Pasnummer (ZP-XXXX)')+'" maxlength="12" style="flex:2;text-transform:uppercase;">'+
      '<button id="zpCGo" style="flex:1;'+goud+'">'+T('zp.controle','Controleer')+'</button></div><div id="zpCUit" class="sub" style="margin-top:0.4rem;"></div>';
    el.innerHTML = h;

    const doe = (sel, pad, body) => el.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', async () => {
      try { await API.call(pad, body(b.dataset)); renderZorgpolis(); } catch(e){ toast(e.message); }
    }));
    const bz = (id, fn) => { const b = el.querySelector('#'+id); if (b) b.addEventListener('click', fn); };
    bz('zpIn', async () => { try { const r = await API.call('/supplier/zorgpolis/inschrijf', { codenaam: $('#zpCode').value, pakket: $('#zpPakket').value, door: (state && state.actor && state.actor.name) || '' }); toast(T('zp.klaar','Ingeschreven; pas ')+r.verzekerde.pas+T('zp.inwallet',' ligt in de wallet van het lid.')); renderZorgpolis(); } catch(e){ toast(e.message); } });
    bz('zpDIn', async () => { try { await API.call('/supplier/zorgpolis/declaratie', { pas: $('#zpDPas').value, omschrijving: $('#zpDOms').value, bedrag: $('#zpDBedrag').value }); renderZorgpolis(); } catch(e){ toast(e.message); } });
    bz('zpCGo', async () => { try { const r = await API.call('/supplier/zorgpolis/pas', { pas: $('#zpCPas').value });
      $('#zpCUit').textContent = (r.actief ? T('zp.actief','Actief') : T('zp.nietactief','Niet actief')) + ' · ' + r.pakket + ' · ' + r.codenaam;
    } catch(e){ $('#zpCUit').textContent = e.message; } });
    doe('data-zpstop', '/supplier/zorgpolis/stop', ds => ({ id: ds.zpstop }));
    doe('data-zpgoed', '/supplier/zorgpolis/declaratie/beslis', ds => ({ id: ds.zpgoed, besluit: 'goedgekeurd', door: (state && state.actor && state.actor.name) || '' }));
    el.querySelectorAll('[data-zpaf]').forEach(b => b.addEventListener('click', async () => {
      const idd = b.dataset.zpaf;
      try { await API.call('/supplier/zorgpolis/declaratie/beslis', { id: idd, besluit: 'afgewezen',
        reden: (el.querySelector('[data-zpredin="'+idd+'"]')||{}).value, door: (state && state.actor && state.actor.name) || '' }); renderZorgpolis(); } catch(e){ toast(e.message); }
    }));
  }
