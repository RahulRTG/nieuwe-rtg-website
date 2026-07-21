
  // ---- RTG Alpine: de berg op een scherm ----
  async function renderAlpine(){
    const el = $('#alpWrap'); if (!el) return;
    if (!has('alpine')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/alpine'); } catch(e){ el.innerHTML = '<p class="sub">'+esc(e.message)+'</p>'; return; }
    const k = d.kpi;
    const goud = 'background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;';
    const knop = (attr, id, tekst, vol) => '<button '+attr+'="'+id+'" style="'+(vol?'background:var(--gold);color:#000;border:none;':'background:none;border:1px solid var(--line);color:var(--soft);')+'border-radius:8px;padding:0.35rem 0.7rem;font-family:inherit;font-size:0.72rem;'+(vol?'font-weight:600;':'')+'">'+tekst+'</button>';
    let h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr));gap:0.5rem;">'+
      [[k.pistesOpen+' van '+k.pistes, T('al.k.pistes','pistes open')],[k.liftenOpen, T('al.k.liften','liften open')],['niveau '+k.lawine, T('al.k.lawine','lawine')],[k.passenActief, T('al.k.passen','passen actief')],[k.verhuurLopend, T('al.k.huur','verhuur lopend')],[k.chaletsBezet, T('al.k.chalets','chalets bezet')]]
        .map(x=>'<div style="border:1px solid var(--line);border-radius:12px;padding:0.55rem 0.7rem;text-align:center;"><b style="font-size:1.1rem;display:block;">'+x[0]+'</b><span class="sub">'+x[1]+'</span></div>').join('')+'</div>';

    // de berg: pistes, liften en het lawineniveau van de berggids
    h += '<div class="st-sec" style="margin-top:1rem;">'+esc(d.naam)+' · '+esc(d.hoogte)+'</div>';
    h += d.pistes.map(p=>'<div style="display:flex;gap:0.6rem;align-items:center;border-bottom:1px solid var(--line);padding:0.35rem 0;">'+
      '<span class="sub" style="flex:0 0 4.2rem;">'+esc(p.kleur)+'</span><b style="flex:1;font-size:0.85rem;">'+esc(p.naam)+'</b><span class="sub">'+esc(p.status)+'</span>'+
      knop('data-alp', p.id+':'+(p.status==='open'?'dicht':'open'), p.status==='open'?T('al.dicht','Sluit'):T('al.open','Open'), p.status!=='open')+'</div>').join('');
    h += d.liften.map(l=>'<div style="display:flex;gap:0.6rem;align-items:center;border-bottom:1px solid var(--line);padding:0.35rem 0;">'+
      '<span class="sub" style="flex:0 0 4.2rem;">'+esc(l.soort)+'</span><b style="flex:1;font-size:0.85rem;">'+esc(l.naam)+'</b><span class="sub">'+esc(l.status)+'</span>'+
      knop('data-all', l.id+':'+(l.status==='open'?'dicht':'open'), l.status==='open'?T('al.dicht','Sluit'):T('al.open','Open'), l.status!=='open')+'</div>').join('');
    h += '<div class="row-gap" style="margin-top:0.5rem;align-items:center;"><span class="sub" style="flex:1;">'+T('al.lawine','Lawineniveau (zet de berggids)')+': <b>'+k.lawine+'</b></span>'+
      [1,2,3,4,5].filter(n=>n!==k.lawine).map(n=>knop('data-alw', String(n), String(n))).join(' ')+'</div>';

    // skipassen
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('al.passen','Skipassen')+' · '+eur(d.dagpas)+' '+T('al.perdag','per dag')+'</div>'+
      '<div class="row-gap"><input id="alPNaam" class="st-in" placeholder="'+T('al.naam','Op naam van')+'" maxlength="60" style="flex:2;"><input id="alPDagen" class="st-in" type="number" min="1" max="14" value="6" style="flex:0 0 4.5rem;">'+
      '<button id="alPas" style="flex:1;'+goud+'">'+T('al.pas','Maak pas')+'</button></div>';
    h += (d.passen||[]).slice(0,6).map(p=>'<div class="sub" style="padding:0.3rem 0;">'+esc(p.id)+' · '+esc(p.naam)+' · '+p.dagen+' '+T('al.dagen','dagen')+' · tot '+esc(p.tot)+' · '+eur(p.prijs)+'</div>').join('');

    // materiaalverhuur
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('al.verhuur','Materiaalverhuur')+'</div>'+
      '<div class="row-gap" style="flex-wrap:wrap;">'+d.materiaal.map(m=>'<label class="sub" style="display:flex;gap:0.3rem;align-items:center;"><input type="checkbox" data-alhm="'+m.id+'">'+esc(m.naam)+' · '+eur(m.dagprijs)+'/d</label>').join('')+'</div>'+
      '<div class="row-gap" style="margin-top:0.4rem;"><input id="alHNaam" class="st-in" placeholder="'+T('al.naam','Op naam van')+'" maxlength="60" style="flex:2;"><input id="alHDagen" class="st-in" type="number" min="1" max="21" value="6" style="flex:0 0 4.5rem;">'+
      '<button id="alHuur" style="flex:1;'+goud+'">'+T('al.huur','Verhuur')+'</button></div>';
    h += (d.verhuur||[]).map(v=>'<div class="sub" style="padding:0.3rem 0;">'+esc(v.naam)+' · '+v.items.map(esc).join(' + ')+' · '+v.dagen+' d · '+eur(v.prijs)+' '+knop('data-alhi', v.id, T('al.inleveren','Ingeleverd'), true)+'</div>').join('');

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
