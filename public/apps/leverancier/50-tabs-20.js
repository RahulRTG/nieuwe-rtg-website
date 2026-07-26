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
        (st.compleet ? ''+T('sn.compleet','Salon-profiel compleet') : ''+T('sn.verplicht','De Salon is verplicht'))+'</div>'+
        '<p class="ds" style="margin:0.4rem 0;">'+T('sn.uitleg','Al uw marketing, producten en folders lopen via De Salon. Zonder compleet profiel bent u niet zichtbaar voor leden en kunt u niets publiceren.')+'</p>'+
        '<div style="height:8px;background:var(--card2);border-radius:999px;overflow:hidden;margin:0.5rem 0;"><div style="height:100%;width:'+st.percentage+'%;background:'+kleur+';"></div></div>'+
        '<div style="display:grid;gap:0.35rem;">'+st.stappen.map(s => '<div style="font-size:0.82rem;">'+(s.klaar?'':'')+' '+T('sn.stap.'+s.id, s.tekst)+'</div>').join('')+'</div>'+
        (canEdit ? '<div class="field" style="margin-top:0.7rem;"><label>'+T('sn.bio','Bio (wie bent u?)')+'</label><textarea id="snBio" rows="2" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;font-family:inherit;">'+esc(st.bio||'')+'</textarea></div>'+
          '<div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.5rem;flex-wrap:wrap;">'+
          '<label class="obtn" style="cursor:pointer;">'+T('sn.foto','Profielfoto')+'<input type="file" id="snFoto" accept="image/*" style="display:none;"></label>'+
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
        '<label class="obtn" style="cursor:pointer;margin-top:0.4rem;display:inline-block;">'+T('sn.f.fotoadd','Foto toevoegen')+'<input type="file" id="snFdFoto" accept="image/*" style="display:none;"></label></div>'+
      '<div class="field"><label>'+T('sn.f.items','Producten')+'</label><div id="snFdItems"></div>'+
        '<button class="obtn" id="snFdItemAdd" style="margin-top:0.4rem;">+ '+T('sn.f.itemadd','Product toevoegen')+'</button></div>'+
      '<button class="obtn primary" id="snFdPlaats" style="margin-top:0.7rem;">'+T('sn.f.plaats','Folder plaatsen')+'</button></div>';

    el.innerHTML = html;

