    // Salon-profiel: bio + foto opslaan
    let snFotoData = null;
    const snFoto = el.querySelector('#snFoto');
    if (snFoto) snFoto.addEventListener('change', () => { const file = snFoto.files && snFoto.files[0]; if (!file) return;
      if (file.size > 1.4*1024*1024){ toast(T('sup.phtoobig','Foto te groot (max 1 MB).')); return; } fileToDataURL(file, d => { snFotoData = d; toast(T('sn.fotoklaar','Foto gekozen; sla het profiel op.')); }); });
    const snSave = el.querySelector('#snBioSave');
    if (snSave) snSave.addEventListener('click', async () => {
      const body = { bio: $('#snBio').value }; if (snFotoData) body.foto = snFotoData;
      try { await API.call('/supplier/salon/bio', body); toast(T('sn.opgeslagen','Profiel opgeslagen.')); await laadSalonStatus(); await refresh(); } catch(e){ toast(e.message); }
    });
    // folder-composer
    const fdFotos = [], fdItems = [];
    const tekenFdFotos = () => { const c = el.querySelector('#snFdFotos'); if (c) c.innerHTML = fdFotos.map((f,i)=>'<div style="position:relative;"><img src="'+f+'" alt="" style="width:52px;height:52px;object-fit:cover;border-radius:8px;"><button class="rr-del" data-fdfdel="'+i+'" style="position:absolute;top:-6px;right:-6px;">✕</button></div>').join('');
      c && c.querySelectorAll('[data-fdfdel]').forEach(b => b.addEventListener('click', () => { fdFotos.splice(Number(b.dataset.fdfdel),1); tekenFdFotos(); })); };
    const tekenFdItems = () => { const c = el.querySelector('#snFdItems'); if (!c) return; c.innerHTML = fdItems.map((it,i)=>'<div style="display:flex;gap:0.4rem;margin-top:0.3rem;"><input data-fdinaam="'+i+'" placeholder="'+T('sn.f.naam','Product')+'" value="'+esc(it.naam)+'" style="flex:2;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;font-size:0.82rem;color:var(--txt);"><input data-fdiprijs="'+i+'" type="number" placeholder="€" value="'+(it.prijs!=null?it.prijs:'')+'" style="width:70px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;font-size:0.82rem;color:var(--txt);"><button class="rr-del" data-fdidel="'+i+'">✕</button></div>').join('');
      c.querySelectorAll('[data-fdinaam]').forEach(inp => inp.addEventListener('input', () => { fdItems[Number(inp.dataset.fdinaam)].naam = inp.value; }));
      c.querySelectorAll('[data-fdiprijs]').forEach(inp => inp.addEventListener('input', () => { fdItems[Number(inp.dataset.fdiprijs)].prijs = inp.value === '' ? null : Number(inp.value); }));
      c.querySelectorAll('[data-fdidel]').forEach(b => b.addEventListener('click', () => { fdItems.splice(Number(b.dataset.fdidel),1); tekenFdItems(); })); };
    const fdFoto = el.querySelector('#snFdFoto');
    if (fdFoto) fdFoto.addEventListener('change', () => { const file = fdFoto.files && fdFoto.files[0]; if (!file) return;
      if (fdFotos.length >= 8) return toast(T('sn.f.max','Maximaal 8 foto\'s.')); fotoKlein(file, d => { fdFotos.push(d); tekenFdFotos(); }); });
    const fdItemAdd = el.querySelector('#snFdItemAdd');
    if (fdItemAdd) fdItemAdd.addEventListener('click', () => { if (fdItems.length >= 30) return; fdItems.push({ naam:'', prijs:null }); tekenFdItems(); });
    const fdPlaats = el.querySelector('#snFdPlaats');
    if (fdPlaats) fdPlaats.addEventListener('click', async () => {
      const titel = $('#snFdTitel').value.trim();
      if (!titel) return toast(T('sn.f.geeftitel','Geef de folder een titel.'));
      if (!fdFotos.length && !fdItems.some(i=>i.naam.trim())) return toast(T('sn.f.leeg','Voeg minstens een foto of product toe.'));
      try { await API.call('/supplier/salon/folder', { titel, tekst: $('#snFdTekst').value, fotos: fdFotos, items: fdItems.filter(i=>i.naam.trim()) });
        toast(T('sn.f.ok','Folder geplaatst op De Salon.')); await laadSalonStatus(); openTab('page'); } catch(e){ toast(e.message); }
    });

    el.querySelectorAll('[data-phdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/photo/remove', { index: Number(b.dataset.phdel) }); await refresh(); openTab('page'); } catch(e){ toast(e.message); }
    }));
    const f = $('#phFile'); if (f) f.addEventListener('change', () => {
      const file = f.files && f.files[0]; if (!file) return;
      if (file.size > 1024*1024){ toast(T('sup.phtoobig','Foto te groot (max 1 MB).')); return; }
      fileToDataURL(file, async url => {
        try { await API.call('/supplier/photo/add', { image: url }); toast(T('sup.phadded','Foto geplaatst.')); await refresh(); openTab('page'); } catch(e){ toast(e.message); }
      });
    });
    let picked = null;
    el.querySelectorAll('[data-pick]').forEach(img => img.addEventListener('click', () => {
      picked = picked === Number(img.dataset.pick) ? null : Number(img.dataset.pick);
      el.querySelectorAll('[data-pick]').forEach(x => x.classList.toggle('sel', Number(x.dataset.pick) === picked));
    }));
    const post = $('#spPost'); if (post) post.addEventListener('click', async () => {
      const text = $('#spText').value.trim();
      if (!text){ toast(T('sup.salonempty','Schrijf eerst een tekst.')); return; }
      try {
        await API.call('/supplier/salon/post', { text, photoIndex: picked });
        toast(T('sup.salondone','Gepubliceerd op De Salon.'));
        $('#spText').value = ''; picked = null;
        el.querySelectorAll('[data-pick]').forEach(x => x.classList.remove('sel'));
      } catch(e){ toast(e.message); }
    });
  }

