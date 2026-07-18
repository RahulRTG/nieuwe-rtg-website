    const huidig = {}; vBox.querySelectorAll('input[data-veld]').forEach(function(i){ if (i.value) huidig[i.dataset.veld] = i.value; });
    vBox.textContent='';
    (st.velden||[]).forEach(function(v){
      if (v.type === 'kyc'){
        const d = document.createElement('div'); d.className='onb-kyc';
        const l = document.createElement('div');
        const b = document.createElement('b'); b.textContent = v.label; l.appendChild(b);
        const s = document.createElement('span'); s.className='sub';
        s.textContent = v.ingevuld ? T('onb.kyc.ok','Ontvangen, wordt gecontroleerd.') : T('onb.kyc.upl','Upload een foto van de voorkant van uw paspoort.');
        l.appendChild(s); d.appendChild(l);
        if (v.ingevuld){ const st2 = document.createElement('span'); st2.className='st'; st2.style.color='#7EE0A3'; st2.textContent='✓'; d.appendChild(st2); }
        else { const btn = document.createElement('button'); btn.type='button'; btn.className='onb-btn ghost'; btn.textContent=T('onb.kyc.knop','Uploaden');
          btn.addEventListener('click', ()=> document.getElementById('onbKycFile').click()); d.appendChild(btn); }
        vBox.appendChild(d); return;
      }
      const wrap = document.createElement('label'); wrap.className='onb-veld';
      const sp = document.createElement('span'); sp.textContent = v.label + (v.ingevuld ? ' ✓' : '');
      wrap.appendChild(sp);
      const inp = document.createElement('input'); inp.type = onbInputType(v.type); inp.dataset.veld = v.id;
      inp.value = huidig[v.id] != null ? huidig[v.id] : (v.waarde || ''); inp.autocomplete = ({naam:'name',email:'email',telefoon:'tel',adres:'street-address',postcode:'postal-code',woonplaats:'address-level2',land:'country-name'})[v.id] || 'off';
      wrap.appendChild(inp); vBox.appendChild(wrap);
    });
    document.getElementById('onbCTitel').textContent = st.contract.titel || '';
    document.getElementById('onbCTekst').textContent = st.contract.tekst || '';
    const ak = document.getElementById('onbAkkoord'); ak.checked = ak.checked || !!st.contract.ondertekend;
    document.getElementById('onbFout').textContent = '';
  }
  (function initOnb(){
    const kf = document.getElementById('onbKycFile');
    if (kf) kf.addEventListener('change', async () => {
      const file = kf.files[0]; kf.value=''; if (!file) return;
      if (file.size > 5*1024*1024){ document.getElementById('onbFout').textContent = T('onb.toobig','De foto is te groot (max 5 MB).'); return; }
      const data = await snapVerklein(file); if (!data) return;
      try { await API.call('/verify/upload', { image: data }); if (user) user.verified='pending'; toast(T('onb.kyc.ok','Ontvangen, wordt gecontroleerd.')); checkOnboarding(); }
      catch(e){ document.getElementById('onbFout').textContent = e.message || 'Upload mislukt.'; }
    });
    const kn = document.getElementById('onbKlaar');
    if (kn) kn.addEventListener('click', async () => {
      const fout = document.getElementById('onbFout'); fout.textContent='';
      onbBezig = true;
      try {
        const velden = {};
        document.querySelectorAll('#onbVelden input[data-veld]').forEach(function(i){ if (i.value.trim()) velden[i.dataset.veld] = i.value.trim(); });
        if (Object.keys(velden).length) { try { await API.call('/onboarding/opslaan', { velden }); } catch(e){} }
        const naam = (document.getElementById('onbNaam').value || '').trim();
        const akkoord = document.getElementById('onbAkkoord').checked;
        const r = await API.call('/onboarding/teken', { naam, akkoord });
        if (r.klaar){ document.getElementById('onbGate').hidden = true; toast(T('onb.welkom','Welkom aan boord! Fijne reis.')); onbBezig=false; return; }
        tekenOnbGate(r);
        fout.textContent = T('onb.rest','Nog niet compleet: vul de resterende velden in (ook uw paspoort).');
      } catch(e){ fout.textContent = e.message || 'Er ging iets mis.'; }
      onbBezig = false;
    });
  })();

  function snapOverlay(){
    let ov = document.getElementById('snapOv'); if (ov) return ov;
    ov = document.createElement('div'); ov.id='snapOv';
    ov.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.9);display:none;flex-direction:column;align-items:center;justify-content:center;padding:1rem;';
    ov.innerHTML='<button id="snapOvX" style="position:absolute;top:1rem;right:1rem;background:none;border:none;color:#fff;font-size:1.6rem;">✕</button>'+
      '<div id="snapOvVan" style="color:#fff;font-size:.85rem;margin-bottom:.6rem;"></div>'+
      '<img id="snapOvImg" alt="" style="max-width:100%;max-height:72vh;border-radius:12px;">'+
      '<div id="snapOvTxt" style="color:#fff;margin-top:.7rem;text-align:center;"></div>'+
      '<div id="snapOvNote" style="color:#999;font-size:.72rem;margin-top:.7rem;"></div>';
    document.body.appendChild(ov);
    ov.querySelector('#snapOvX').addEventListener('click', ()=>{ ov.style.display='none'; ov.querySelector('#snapOvImg').src=''; loadSocial(); });
    return ov;
  }
  async function renderSnapsStories(){
    const el = $('#homeContacts'); if (!el || !socialOK) return;
    // verhalen-strip + inkomende snaps bovenaan de contactenkaart
    let stories = [], snaps = [];
    try { stories = (await API.call('/member/stories')).stories || []; } catch(e){}
    try { snaps = (await API.call('/member/snaps')).snaps || []; } catch(e){}
    let box = el.querySelector('#snapStrip');
    if (!box){ box = document.createElement('div'); box.id='snapStrip'; el.insertBefore(box, el.firstChild.nextSibling); }
    let h = '<div style="display:flex;gap:.6rem;overflow-x:auto;padding:.2rem 0 .7rem;">';
    h += '<button id="storyPlus" style="flex:0 0 auto;background:none;border:none;text-align:center;width:3.6rem;cursor:pointer;"><span style="display:flex;width:3rem;height:3rem;border-radius:50%;margin:0 auto;align-items:center;justify-content:center;font-size:1.2rem;background:var(--card2);border:2px dashed var(--gold);color:var(--gold);">＋</span><span style="display:block;font-size:.6rem;color:var(--soft);margin-top:.2rem;">Verhaal</span></button>';
    h += stories.map(v=>'<button class="js-story" data-id="'+escT(v.id)+'" style="flex:0 0 auto;background:none;border:none;text-align:center;width:3.6rem;cursor:pointer;"><span style="display:flex;width:3rem;height:3rem;border-radius:50%;margin:0 auto;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;background:var(--card2);border:2px solid '+(v.gezien?'var(--line)':'var(--gold)')+';">'+initCN(v.van)+'</span><span style="display:block;font-size:.6rem;color:var(--soft);margin-top:.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escT(v.vanMij?'Jij':v.van)+'</span></button>').join('');
    h += '</div>';
    if (snaps.length){
      h += '<div style="display:flex;flex-direction:column;gap:.35rem;margin-bottom:.5rem;">'+snaps.map(sn=>
        '<div style="display:flex;align-items:center;gap:.5rem;font-size:.78rem;"><span>📷</span><b style="flex:1;color:var(--gold);">'+escT(sn.van)+'</b><span style="color:var(--soft);">stuurde een snap</span><button class="js-opensnap go" data-id="'+escT(sn.id)+'" style="padding:.15rem .55rem;">Bekijk</button></div>'
      ).join('')+'</div>';
    }
    box.innerHTML = h;
    box.querySelector('#storyPlus').addEventListener('click', storyKies);
    box.querySelectorAll('.js-story').forEach(b => b.addEventListener('click', () => openStory(b.dataset.id)));
    box.querySelectorAll('.js-opensnap').forEach(b => b.addEventListener('click', () => openSnap(b.dataset.id)));
  }
  async function openSnap(id){
    let d; try { d = await API.call('/member/snap/view', { id }); } catch(e){ toast(e.message); return; }
    const ov = snapOverlay();
    ov.querySelector('#snapOvVan').textContent = 'Snap van ' + d.van;
    ov.querySelector('#snapOvImg').src = d.foto;
    ov.querySelector('#snapOvTxt').textContent = d.tekst || '';
    ov.querySelector('#snapOvNote').textContent = T('snap.weg','Deze snap verdwijnt zodra je sluit.');
    ov.style.display='flex';
  }
  async function openStory(id){
    let d; try { d = await API.call('/member/story/view', { id }); } catch(e){ toast(e.message); return; }
    const ov = snapOverlay();
    ov.querySelector('#snapOvVan').textContent = 'Verhaal van ' + d.van;
    ov.querySelector('#snapOvImg').src = d.foto;
    ov.querySelector('#snapOvTxt').textContent = d.tekst || '';
    ov.querySelector('#snapOvNote').textContent = '';
    ov.style.display='flex';
  }

  function renderSocialBar(){
    const el = $('#socialBar'); if (!el) return;
    if (!socialOK){ el.innerHTML = ''; return; }
    let html = '';
