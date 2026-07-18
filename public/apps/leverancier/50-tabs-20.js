  function renderPage(){
    const el = $('#pageWrap'); if (!el) return;
    const photos = state.photos || [];
    if (salonStatus === null){ laadSalonStatus(); }
    let html = '';
    // De Salon is verplicht: een blijvende profielkaart met compleetheidsmeter
    if (salonStatus){
      const st = salonStatus, canEdit = actor().manager;
      const kleur = st.compleet ? 'var(--green)' : 'var(--burgundy)';
      html += '<div class="card" style="border-color:'+kleur+';"><div class="tt-h" style="color:'+kleur+';">'+
        (st.compleet ? '✅ '+T('sn.compleet','Salon-profiel compleet') : '⚠️ '+T('sn.verplicht','De Salon is verplicht'))+'</div>'+
        '<p class="ds" style="margin:0.4rem 0;">'+T('sn.uitleg','Al uw marketing, producten en folders lopen via De Salon. Zonder compleet profiel bent u niet zichtbaar voor leden en kunt u niets publiceren.')+'</p>'+
        '<div style="height:8px;background:var(--card2);border-radius:999px;overflow:hidden;margin:0.5rem 0;"><div style="height:100%;width:'+st.percentage+'%;background:'+kleur+';"></div></div>'+
        '<div style="display:grid;gap:0.35rem;">'+st.stappen.map(s => '<div style="font-size:0.82rem;">'+(s.klaar?'✅':'⬜')+' '+T('sn.stap.'+s.id, s.tekst)+'</div>').join('')+'</div>'+
        (canEdit ? '<div class="field" style="margin-top:0.7rem;"><label>'+T('sn.bio','Bio (wie bent u?)')+'</label><textarea id="snBio" rows="2" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;font-family:inherit;">'+esc(st.bio||'')+'</textarea></div>'+
          '<div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.5rem;flex-wrap:wrap;">'+
          '<label class="obtn" style="cursor:pointer;">📷 '+T('sn.foto','Profielfoto')+'<input type="file" id="snFoto" accept="image/*" style="display:none;"></label>'+
          (st.foto?'<img src="'+esc(st.foto)+'" alt="'+T('sn.foto','Profielfoto')+'" style="width:44px;height:44px;object-fit:cover;border-radius:8px;">':'')+
          '<button class="obtn primary" id="snBioSave">'+T('sn.opslaan','Profiel opslaan')+'</button></div>' : '')+
        '</div>';
    }
    html += '<div class="card"><div class="tt-h">'+T('sup.photos','Foto\'s op uw pagina')+' ('+photos.length+'/6)</div>';
    html += '<div class="ph-grid">'+
      photos.map((p,i)=>'<div class="ph"><img src="'+p+'" alt=""><button data-phdel="'+i+'">✕</button></div>').join('')+
      (photos.length<6?'<label class="ph add">+<input type="file" id="phFile" accept="image/jpeg,image/png,image/webp" style="display:none;"></label>':'')+
    '</div>';
    html += '<div style="margin-top:0.6rem;font-size:0.72rem;color:var(--soft);">'+T('sup.photonote','Gasten zien deze foto\'s in de RTG-app bij uw pagina, direct na plaatsen.')+'</div></div>';

    html += '<div class="card"><div class="tt-h">'+T('sup.salonpub','Publiceer op De Salon')+'</div>'+
      '<textarea id="spText" class="salon-ta" placeholder="'+T('sup.salonph','Vertel RTG-leden over uw nieuwste gerecht, suite of avond...')+'"></textarea>'+
      (photos.length?'<div class="ph-pick">'+photos.map((p,i)=>'<img src="'+p+'" data-pick="'+i+'" alt="">').join('')+'</div>':'')+
      '<button class="bigbtn" id="spPost" style="margin-top:0.8rem;">'+T('sup.salonpost','Publiceer als RTG-partner')+'</button>'+
      '<div style="margin-top:0.6rem;font-size:0.72rem;color:var(--soft);">'+T('sup.salonnote','Uw bericht verschijnt in De Salon van alle leden, met uw bedrijfsnaam als partner.')+'</div></div>';

    // folder (digitale brochure): titel + foto's + producten
    if (actor().manager) html += '<div class="card"><div class="tt-h">'+T('sn.folder','Folder plaatsen (producten & aanbod)')+'</div>'+
      '<p class="ds" style="margin:0.3rem 0;">'+T('sn.foldertip','Een digitale brochure: foto\'s en producten met prijs. Zo staan uw producten in De Salon, niet los in de leden-app.')+'</p>'+
      '<div class="field"><label>'+T('sn.f.titel','Titel')+'</label><input id="snFdTitel" placeholder="'+T('sn.f.titelph','Bijv. Zomerkaart')+'"></div>'+
      '<div class="field"><label>'+T('sn.f.tekst','Korte intro (optioneel)')+'</label><input id="snFdTekst"></div>'+
      '<div class="field"><label>'+T('sn.f.fotos','Foto\'s')+'</label><div id="snFdFotos" style="display:flex;gap:0.4rem;flex-wrap:wrap;"></div>'+
        '<label class="obtn" style="cursor:pointer;margin-top:0.4rem;display:inline-block;">📷 '+T('sn.f.fotoadd','Foto toevoegen')+'<input type="file" id="snFdFoto" accept="image/*" style="display:none;"></label></div>'+
      '<div class="field"><label>'+T('sn.f.items','Producten')+'</label><div id="snFdItems"></div>'+
        '<button class="obtn" id="snFdItemAdd" style="margin-top:0.4rem;">+ '+T('sn.f.itemadd','Product toevoegen')+'</button></div>'+
      '<button class="obtn primary" id="snFdPlaats" style="margin-top:0.7rem;">'+T('sn.f.plaats','Folder plaatsen')+'</button></div>';

    el.innerHTML = html;

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

