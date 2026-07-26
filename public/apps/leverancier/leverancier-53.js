    // de skischool
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('al.school','De skischool')+'</div>';
    h += d.groepslessen.map(l=>'<div style="border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.8rem;margin-top:0.5rem;">'+
      '<div style="display:flex;gap:0.5rem;align-items:baseline;"><b style="flex:1;font-size:0.85rem;">'+esc(l.naam)+' · '+esc(l.tijd)+'</b><span class="sub">'+l.deelnemers.length+' van '+l.capaciteit+'</span></div>'+
      (l.deelnemers.length?'<div class="sub" style="margin-top:0.3rem;">'+l.deelnemers.slice(0,10).map(esc).join(' · ')+'</div>':'')+
      '<div class="row-gap" style="margin-top:0.45rem;"><input data-algn="'+l.id+'" class="st-in" placeholder="'+T('al.deelnemer','Naam deelnemer')+'" maxlength="60" style="flex:2;">'+knop('data-algi', l.id, T('al.meld','Meld aan'), true)+'</div></div>').join('');
    h += '<div class="row-gap" style="margin-top:0.5rem;"><select id="alIns" class="st-in" style="flex:2;">'+d.instructeurs.map(i=>'<option value="'+i.id+'">'+esc(i.naam)+' · priveles '+eur(i.prijs)+'</option>').join('')+'</select>'+
      '<input id="alLNaam" class="st-in" placeholder="'+T('al.voorwie','Voor wie')+'" maxlength="60" style="flex:1;"><input id="alLDatum" class="st-in" type="date" style="flex:1;"><input id="alLTijd" class="st-in" type="time" style="flex:1;">'+
      '<button id="alPrive" style="flex:1;'+goud+'">'+T('al.plan','Plan')+'</button></div>';
    h += (d.privelessen||[]).map(l=>'<div class="sub" style="padding:0.3rem 0;">'+esc(l.datum)+' '+esc(l.tijd)+' · '+esc(l.instructeur)+' · '+esc(l.naam)+' '+knop('data-allk', l.id, T('al.gegeven','Gegeven'), true)+'</div>').join('');

    // de chalets
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('al.chalets','De chalets')+'</div>'+
      '<div class="row-gap"><select id="alCh" class="st-in" style="flex:2;">'+d.chalets.map(c=>'<option value="'+c.id+'">'+esc(c.naam)+' · '+c.bedden+' bedden · '+eur(c.nachtprijs)+'/n</option>').join('')+'</select>'+
      '<input id="alCNaam" class="st-in" placeholder="'+T('al.naam','Op naam van')+'" maxlength="60" style="flex:1;"><input id="alCVan" class="st-in" type="date" style="flex:1;"><input id="alCNachten" class="st-in" type="number" min="1" max="28" value="7" style="flex:0 0 4.5rem;">'+
      '<button id="alChalet" style="flex:1;'+goud+'">'+T('al.boek','Boek')+'</button></div>';
    h += (d.chaletBoekingen||[]).map(b=>'<div class="sub" style="padding:0.3rem 0;">'+esc(b.chalet)+' · '+esc(b.naam)+' · '+esc(b.van)+' tot '+esc(b.tot)+' · '+eur(b.prijs)+'</div>').join('');
    h += '<p class="sub" style="margin-top:0.5rem;">'+esc(d.regel||'')+'</p>';
    el.innerHTML = h;

    const doe = (sel, pad, body) => el.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', async () => {
      try { await API.call(pad, body(b.dataset)); renderAlpine(); } catch(e){ toast(e.message); }
    }));
    const ba = (id, fn) => { const b = el.querySelector('#'+id); if (b) b.addEventListener('click', fn); };
    ba('alPas', async () => { try { await API.call('/supplier/alpine/pas', { naam: $('#alPNaam').value, dagen: $('#alPDagen').value }); renderAlpine(); } catch(e){ toast(e.message); } });
    ba('alHuur', async () => { try {
      const items = [...el.querySelectorAll('[data-alhm]:checked')].map(x => x.dataset.alhm);
      await API.call('/supplier/alpine/huur', { naam: $('#alHNaam').value, dagen: $('#alHDagen').value, items });
      renderAlpine();
    } catch(e){ toast(e.message); } });
    ba('alPrive', async () => { try { await API.call('/supplier/alpine/prive', { instructeurId: $('#alIns').value, naam: $('#alLNaam').value, datum: $('#alLDatum').value, tijd: $('#alLTijd').value }); renderAlpine(); } catch(e){ toast(e.message); } });
    ba('alChalet', async () => { try { await API.call('/supplier/alpine/chalet', { chaletId: $('#alCh').value, naam: $('#alCNaam').value, van: $('#alCVan').value, nachten: $('#alCNachten').value }); renderAlpine(); } catch(e){ toast(e.message); } });
    doe('data-alp', '/supplier/alpine/piste', ds => { const [id, status] = ds.alp.split(':'); return { id, status }; });
    doe('data-all', '/supplier/alpine/lift', ds => { const [id, status] = ds.all.split(':'); return { id, status }; });
    doe('data-alw', '/supplier/alpine/lawine', ds => ({ niveau: ds.alw }));
    doe('data-alhi', '/supplier/alpine/huur/in', ds => ({ id: ds.alhi }));
    doe('data-algi', '/supplier/alpine/groep/in', ds => ({ lesId: ds.algi, naam: (el.querySelector('[data-algn="'+ds.algi+'"]')||{}).value }));
    doe('data-allk', '/supplier/alpine/prive/klaar', ds => ({ id: ds.allk }));
  }

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

