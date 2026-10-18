/* De Salon is verplicht: de profielkaart met compleetheidsmeter */
    if (salonStatus === null){ laadSalonStatus(); }
    let html = '';
    // De Salon is verplicht: een blijvende profielkaart met compleetheidsmeter
    if (salonStatus){
      const st = salonStatus, canEdit = actor().manager;
      const kleur = st.compleet ? 'var(--green)' : 'var(--burgundy)';
      html += '<div class="card" style="border-color:'+kleur+';"><div class="tt-h" style="color:'+kleur+';">'+
        (st.compleet ? ''+T('sn.compleet','Salon-profiel compleet') : ''+T('sn.verplicht','De Salon is verplicht'))+'</div>'+
        '<p class="ds s-9ex6ps">'+T('sn.uitleg','Al uw marketing, producten en folders lopen via De Salon. Zonder compleet profiel bent u niet zichtbaar voor leden en kunt u niets publiceren.')+'</p>'+
        '<div class="s-giw7kv"><div style="height:100%;width:'+st.percentage+'%;background:'+kleur+';"></div></div>'+
        '<div class="s-7ighdl">'+st.stappen.map(s => '<div class="s-2tvgiv">'+(s.klaar?'':'')+' '+T('sn.stap.'+s.id, s.tekst)+'</div>').join('')+'</div>'+
        (canEdit ? '<div class="field h-mt70"><label>'+T('sn.bio','Bio (wie bent u?)')+'</label><textarea id="snBio" rows="2" class="s-kzj9i7">'+esc(st.bio||'')+'</textarea></div>'+
          '<div class="s-1xkv4fo">'+
          '<label class="obtn" style="cursor:pointer;">'+T('sn.foto','Profielfoto')+'<input type="file" id="snFoto" accept="image/*" style="display:none;"></label>'+
          (st.foto?'<img src="'+esc(st.foto)+'" alt="'+T('sn.foto','Profielfoto')+'" class="s-150eibx">':'')+
          '<button class="obtn primary" id="snBioSave">'+T('sn.opslaan','Profiel opslaan')+'</button></div>' : '')+
        '</div>';
    }
    html += '<div class="card"><div class="tt-h">'+T('sup.photos','Foto\'s op uw pagina')+' ('+photos.length+'/6)</div>';
    html += '<div class="ph-grid">'+
      photos.map((p,i)=>'<div class="ph"><img src="'+p+'" alt=""><button data-phdel="'+i+'">✕</button></div>').join('')+
      (photos.length<6?'<label class="ph add">+<input type="file" id="phFile" accept="image/jpeg,image/png,image/webp" style="display:none;"></label>':'')+
    '</div>';
    html += '<div class="s-cb89dq">'+T('sup.photonote','Gasten zien deze foto\'s in de RTG-app bij uw pagina, direct na plaatsen.')+'</div></div>';

    html += '<div class="card"><div class="tt-h">'+T('sup.salonpub','Publiceer op De Salon')+'</div>'+
      '<textarea id="spText" class="salon-ta" placeholder="'+T('sup.salonph','Vertel RTG-leden over uw nieuwste gerecht, suite of avond...')+'"></textarea>'+
      (photos.length?'<div class="ph-pick">'+photos.map((p,i)=>'<img src="'+p+'" data-pick="'+i+'" alt="">').join('')+'</div>':'')+
      '<button class="bigbtn h-mt80" id="spPost">'+T('sup.salonpost','Publiceer als RTG-partner')+'</button>'+
      '<div class="s-cb89dq">'+T('sup.salonnote','Uw bericht verschijnt in De Salon van alle leden, met uw bedrijfsnaam als partner.')+'</div></div>';

    // folder (digitale brochure): titel + foto's + producten
    if (actor().manager) html += '<div class="card"><div class="tt-h">'+T('sn.folder','Folder plaatsen (producten & aanbod)')+'</div>'+
      '<p class="ds s-kpqwcd">'+T('sn.foldertip','Een digitale brochure: foto\'s en producten met prijs. Zo staan uw producten in De Salon, niet los in de leden-app.')+'</p>'+
      '<div class="field"><label>'+T('sn.f.titel','Titel')+'</label><input id="snFdTitel" placeholder="'+T('sn.f.titelph','Bijv. Zomerkaart')+'"></div>'+
      '<div class="field"><label>'+T('sn.f.tekst','Korte intro (optioneel)')+'</label><input id="snFdTekst"></div>'+
      '<div class="field"><label>'+T('sn.f.fotos','Foto\'s')+'</label><div id="snFdFotos" style="display:flex;gap:0.4rem;flex-wrap:wrap;"></div>'+
        '<label class="obtn" style="cursor:pointer;margin-top:0.5rem;display:inline-block;">'+T('sn.f.fotoadd','Foto toevoegen')+'<input type="file" id="snFdFoto" accept="image/*" style="display:none;"></label></div>'+
      '<div class="field"><label>'+T('sn.f.items','Producten')+'</label><div id="snFdItems"></div>'+
        '<button class="obtn h-mt40" id="snFdItemAdd">+ '+T('sn.f.itemadd','Product toevoegen')+'</button></div>'+
      '<button class="obtn primary h-mt70" id="snFdPlaats">'+T('sn.f.plaats','Folder plaatsen')+'</button></div>';

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
    const tekenFdFotos = () => { const c = el.querySelector('#snFdFotos'); if (c) c.innerHTML = fdFotos.map((f,i)=>'<div class="s-mw4zr1"><img src="'+f+'" alt="" class="s-ksdwer"><button class="rr-del s-1ul32ld" data-fdfdel="'+i+'">✕</button></div>').join('');
      c && c.querySelectorAll('[data-fdfdel]').forEach(b => b.addEventListener('click', () => { fdFotos.splice(Number(b.dataset.fdfdel),1); tekenFdFotos(); })); };
    const tekenFdItems = () => { const c = el.querySelector('#snFdItems'); if (!c) return; c.innerHTML = fdItems.map((it,i)=>'<div class="s-1stteow"><input data-fdinaam="'+i+'" placeholder="'+T('sn.f.naam','Product')+'" value="'+esc(it.naam)+'" class="s-rtpvzq"><input data-fdiprijs="'+i+'" type="number" placeholder="€" value="'+(it.prijs!=null?it.prijs:'')+'" class="s-1ejnsii"><button class="rr-del" data-fdidel="'+i+'">✕</button></div>').join('');
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
