  /* Vervolg van app-main-08: de snaps- en verhalenstrip boven de contactenkaart.
     Geknipt toen deel 08 met het inrichten (de onboarding-stap erboven) over de
     10 KB-lat ging, en langs de enige naad die er zat: hierboven is het gesprek
     bij de voordeur, hieronder De Salon. Let op de STAART: renderSnapsStories
     loopt door in deel 09, precies zoals hij dat in 08 deed -- die grens is
     alleen van bestand veranderd, niet van plek. */
  function snapOverlay(){
    let ov = document.getElementById('snapOv'); if (ov) return ov;
    ov = document.createElement('div'); ov.id='snapOv';
    ov.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.9);display:none;flex-direction:column;align-items:center;justify-content:center;padding:1rem;';
    ov.innerHTML='<button id="snapOvX" style="position:absolute;top:1rem;right:1rem;background:none;border:none;color:#fff;font-size:1.6rem;">✕</button>'+
      '<div id="snapOvVan" class="s-qdf6eq"></div>'+
      '<img id="snapOvImg" alt="" class="s-1q33w57">'+
      '<div id="snapOvTxt" class="s-wexjct"></div>'+
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
