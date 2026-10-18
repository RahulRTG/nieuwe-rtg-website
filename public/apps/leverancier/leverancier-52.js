/* de polis van een verzekeringszaak */
    let d; try { d = await API.call('/supplier/polis'); } catch(e){ el.innerHTML = '<p class="sub">'+esc(e.message)+'</p>'; return; }
    const k = d.kpi;
    let h = '<div class="s-1ah2knl">'+
      [[k.open, T('sg.k.open','aanvragen open')],[k.geadviseerd, T('sg.k.klaar','advies klaar')],[k.doorverwezen, T('sg.k.door','doorverwezen')]]
        .map(x=>'<div class="s-1fk9glc"><b class="s-123kxff">'+x[0]+'</b><span class="sub">'+x[1]+'</span></div>').join('')+'</div>';

    h += '<div class="st-sec h-mt100">'+T('sg.vraag','Nieuwe adviesvraag')+'</div>'+
      '<div class="row-gap"><input id="sgKlant" class="st-in h-flex1" placeholder="'+T('sg.klant','Voor wie')+'" maxlength="60"><select id="sgProd" class="st-in h-flex2">'+d.producten.map(p=>'<option value="'+p.id+'">'+esc(p.naam)+' · '+esc(p.indicatie)+'</option>').join('')+'</select>'+
      '<input id="sgSit" class="st-in s-1dzu8du" placeholder="'+T('sg.sit','De situatie (bijv. drie weken Ibiza met de boot)')+'" maxlength="200"><button id="sgVraag" style="flex:1;'+PL_GOUD+'">'+T('sg.aanvraag','Vraag advies')+'</button></div>';
    h += (d.aanvragen||[]).map(a=>'<div class="' + (a.status==='doorverwezen' ? 's-q8bqou' : 's-dbavhu') + '">'+
      '<div class="s-tbd6xd"><b class="s-1q6kbkp">'+esc(a.klant)+' · '+esc(a.product)+'</b><span class="sub">'+esc(a.status)+'</span></div>'+
      '<div class="sub">'+esc(a.situatie)+(a.advies?' · '+T('sg.advies','advies')+': '+esc(a.advies):'')+'</div>'+
      (a.status==='aangevraagd'?'<div class="row-gap h-mt45"><input data-sgat="'+a.id+'" class="st-in s-1dzu8du" placeholder="'+T('sg.schrijf','Het advies, geschreven door de adviseur')+'" maxlength="240">'+plKnop('data-sgak', a.id, T('sg.klaarzet','Advies klaar'), true)+'</div>':
        a.status==='advies-klaar'?'<div class="h-mt45">'+plKnop('data-sgdw', a.id, T('sg.verwijs','Doorverwijzen naar de verzekeraar'))+'</div>':'')+'</div>').join('');
    h += '<p class="sub h-mt50">'+esc(d.regel||'')+'</p>';
    el.innerHTML = h;

    const doe = (sel, pad, body) => el.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', async () => {
      try { await API.call(pad, body(b.dataset)); renderPolis(); } catch(e){ toast(e.message); }
    }));
    const bp = (id, fn) => { const b = el.querySelector('#'+id); if (b) b.addEventListener('click', fn); };
    bp('sgVraag', async () => { try { await API.call('/supplier/polis/vraag', { klant: $('#sgKlant').value, productId: $('#sgProd').value, situatie: $('#sgSit').value }); renderPolis(); } catch(e){ toast(e.message); } });
    doe('data-sgak', '/supplier/polis/zet', ds => ({ id: ds.sgak, status: 'advies-klaar', advies: (el.querySelector('[data-sgat="'+ds.sgak+'"]')||{}).value }));
    doe('data-sgdw', '/supplier/polis/zet', ds => ({ id: ds.sgdw, status: 'doorverwezen' }));
  }

  // ---- RTG Alpine: de berg op een scherm ----
  async function renderAlpine(){
    const el = $('#alpWrap'); if (!el) return;
    if (!has('alpine')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/alpine'); } catch(e){ el.innerHTML = '<p class="sub">'+esc(e.message)+'</p>'; return; }
    const k = d.kpi;
    const goud = 'background:var(--gold);color:#000;border:none;border-radius:0;padding:0.45rem;font-weight:600;font-family:inherit;';
    const knop = (attr, id, tekst, vol) => '<button '+attr+'="'+id+'" style="'+(vol?'background:var(--gold);color:#000;border:none;':'background:none;border:1px solid var(--line);color:var(--soft);')+'border-radius:0;padding:0.35rem 0.7rem;font-family:inherit;font-size:0.72rem;'+(vol?'font-weight:600;':'')+'">'+tekst+'</button>';
    let h = '<div class="s-1ah2knl">'+
      [[k.pistesOpen+' van '+k.pistes, T('al.k.pistes','pistes open')],[k.liftenOpen, T('al.k.liften','liften open')],['niveau '+k.lawine, T('al.k.lawine','lawine')],[k.passenActief, T('al.k.passen','passen actief')],[k.verhuurLopend, T('al.k.huur','verhuur lopend')],[k.chaletsBezet, T('al.k.chalets','chalets bezet')]]
        .map(x=>'<div class="s-1fk9glc"><b class="s-123kxff">'+x[0]+'</b><span class="sub">'+x[1]+'</span></div>').join('')+'</div>';

    // de berg: pistes, liften en het lawineniveau van de berggids
    h += '<div class="st-sec h-mt100">'+esc(d.naam)+' · '+esc(d.hoogte)+'</div>';
    h += d.pistes.map(p=>'<div class="s-5fdu0n">'+
      '<span class="sub" style="flex:0 0 4.2rem;">'+esc(p.kleur)+'</span><b class="s-1q6kbkp">'+esc(p.naam)+'</b><span class="sub">'+esc(p.status)+'</span>'+
      knop('data-alp', p.id+':'+(p.status==='open'?'dicht':'open'), p.status==='open'?T('al.dicht','Sluit'):T('al.open','Open'), p.status!=='open')+'</div>').join('');
    h += d.liften.map(l=>'<div class="s-5fdu0n">'+
      '<span class="sub" style="flex:0 0 4.2rem;">'+esc(l.soort)+'</span><b class="s-1q6kbkp">'+esc(l.naam)+'</b><span class="sub">'+esc(l.status)+'</span>'+
      knop('data-all', l.id+':'+(l.status==='open'?'dicht':'open'), l.status==='open'?T('al.dicht','Sluit'):T('al.open','Open'), l.status!=='open')+'</div>').join('');
    h += '<div class="row-gap s-1p57fsb"><span class="sub h-flex1">'+T('al.lawine','Lawineniveau (zet de berggids)')+': <b>'+k.lawine+'</b></span>'+
      [1,2,3,4,5].filter(n=>n!==k.lawine).map(n=>knop('data-alw', String(n), String(n))).join(' ')+'</div>';

    // skipassen
    h += '<div class="st-sec h-mt100">'+T('al.passen','Skipassen')+' · '+eur(d.dagpas)+' '+T('al.perdag','per dag')+'</div>'+
      '<div class="row-gap"><input id="alPNaam" class="st-in h-flex2" placeholder="'+T('al.naam','Op naam van')+'" maxlength="60"><input id="alPDagen" class="st-in s-mbp5mo" type="number" min="1" max="14" value="6">'+
      '<button id="alPas" style="flex:1;'+goud+'">'+T('al.pas','Maak pas')+'</button></div>';
    h += (d.passen||[]).slice(0,6).map(p=>'<div class="sub" style="padding:0.3rem 0;">'+esc(p.id)+' · '+esc(p.naam)+' · '+p.dagen+' '+T('al.dagen','dagen')+' · tot '+esc(p.tot)+' · '+eur(p.prijs)+'</div>').join('');

    // materiaalverhuur
    h += '<div class="st-sec h-mt100">'+T('al.verhuur','Materiaalverhuur')+'</div>'+
      '<div class="row-gap h-wrap">'+d.materiaal.map(m=>'<label class="sub" style="display:flex;gap:0.3rem;align-items:center;"><input type="checkbox" data-alhm="'+m.id+'">'+esc(m.naam)+' · '+eur(m.dagprijs)+'/d</label>').join('')+'</div>'+
      '<div class="row-gap h-mt40"><input id="alHNaam" class="st-in h-flex2" placeholder="'+T('al.naam','Op naam van')+'" maxlength="60"><input id="alHDagen" class="st-in s-mbp5mo" type="number" min="1" max="21" value="6">'+
      '<button id="alHuur" style="flex:1;'+goud+'">'+T('al.huur','Verhuur')+'</button></div>';
    h += (d.verhuur||[]).map(v=>'<div class="sub" style="padding:0.3rem 0;">'+esc(v.naam)+' · '+v.items.map(esc).join(' + ')+' · '+v.dagen+' d · '+eur(v.prijs)+' '+knop('data-alhi', v.id, T('al.inleveren','Ingeleverd'), true)+'</div>').join('');

