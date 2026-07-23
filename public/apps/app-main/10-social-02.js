  // Het onboarding-gesprek bedraden: de invoerregel, de stuur-knop en de
  // paspoort-upload. De gespreksfuncties zelf staan in 10-social-01.
  (function initOnbGesprek(){
    const go = document.getElementById('onbGo'), inp = document.getElementById('onbIn');
    if (go && inp) go.addEventListener('click', function(){ onbInvoer(inp.value); });
    if (inp) inp.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); onbInvoer(inp.value); } });
    const kf = document.getElementById('onbKycFile');
    if (kf) kf.addEventListener('change', function(){ const f = kf.files[0]; kf.value = ''; onbPaspoortGekozen(f); });
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
        '<div style="display:flex;align-items:center;gap:.5rem;font-size:.78rem;"><span></span><b style="flex:1;color:var(--gold);">'+escT(sn.van)+'</b><span style="color:var(--soft);">stuurde een snap</span><button class="js-opensnap go" data-id="'+escT(sn.id)+'" style="padding:.15rem .55rem;">Bekijk</button></div>'
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
