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
    /* Eerst de camera vrijgeven. Deze balk wordt ook opnieuw opgebouwd door een
       binnenkomend bericht, en dan verdwijnt het video-vak uit de DOM terwijl
       de scanner er nog op draait -- met een camera die aan blijft staan als
       gevolg. Dat is geen schoonheidsfoutje maar een lampje dat blijft branden.
       pinScanUit staat in ./app-main-09a.js. */
    pinScanUit();
    if (!socialOK){ el.innerHTML = ''; return; }
    let html = '';
    for (const r of (social.requests || [])){
      /* WAARLANGS dit verzoek binnenkwam, en dat is meer dan een detail: staat
         er "via je pin" bij iemand die je niet verwacht, dan gaat de pin die je
         ooit ergens neerzette nog rond -- en dan is dit het moment om hem te
         vernieuwen. Zonder dat verschil merk je dat nooit. */
      const langs = r.via === 'pin' ? T('sal.viapin','via je pin')
                  : r.via === 'code' ? T('sal.viacode','via je live code')
                  : T('sal.wilverbinden','wil verbinden');
      html += '<div class="sc-req"><b>' + escT(r.codename) + '</b><span style="color:var(--soft);font-size:0.7rem;">' + langs + '</span>' +
        '<button class="ja" data-scja="' + escT(r.key) + '">' + T('sal.accepteer','Accepteer') + '</button>' +
        '<button data-scnee="' + escT(r.key) + '">✕</button></div>';
    }
    html += '<div class="sc-strip">' +
      '<button class="sc-p add" id="scAddBtn"><span class="sc-av">+</span><span>' + T('sal.add','Toevoegen') + '</span></button>' +
      (social.connections || []).map(c => { const nm = c.eigenNaam || c.codename; return (
        '<button class="sc-p" data-scdm="' + escT(c.key) + '" data-cn="' + escT(nm) + '" title="' + escT(c.codename) + '">' +
          '<span class="sc-av">' + initCN(nm) + (c.unread ? '<span class="sc-badge">' + c.unread + '</span>' : '') + '</span>' +
          '<span>' + escT(nm.split(' ')[0]) + '</span></button>'); }
      ).join('') + '</div>';
    html += '<div class="sc-zoek" id="scZoek"><input id="scQ" placeholder="' + T('sal.zoekph','Zoek op codenaam, bijv. Gouden Ibis') + '"><button id="scGo">' + T('sal.zoek','Zoek') + '</button></div>' +
      '<div class="sc-res" id="scRes"></div>' +
      // en de tweede weg naar dezelfde vriendschap: de contactpin (zie ./app-main-09a.js)
      '<div class="sc-pin" id="scPin"></div>';
    el.innerHTML = html;

    el.querySelectorAll('[data-scja]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/member/connect/respond', { key: b.dataset.scja, action: 'accept' }); toast(T('sal.verbonden','Verbonden.')); loadSocial(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-scnee]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/member/connect/respond', { key: b.dataset.scnee, action: 'decline' }); loadSocial(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-scdm]').forEach(b => b.addEventListener('click', () => openDm(b.dataset.scdm, b.dataset.cn)));
    const add = $('#scAddBtn'); if (add) add.addEventListener('click', () => {
      const open = $('#scZoek').classList.toggle('open');
      $('#scPin').classList.toggle('open', open);
      if (open) { pinBlokVul(); const q = $('#scQ'); if (q) q.focus(); } else pinScanUit();
    });
    const go = $('#scGo'); if (go) go.addEventListener('click', zoekLeden);
    const q = $('#scQ'); if (q) q.addEventListener('keydown', e => { if (e.key === 'Enter') zoekLeden(); });
  }

  async function zoekLeden(){
    const q = $('#scQ').value.trim();
    if (q.length < 2){ toast(T('sal.zoekkort','Typ minimaal twee letters.')); return; }
    try {
      const d = await API.call('/member/find', { q });
      $('#scRes').innerHTML = (d.results || []).map(r =>
        '<div class="sc-hit"><span class="sc-av" style="width:34px;height:34px;font-size:0.7rem;">' + initCN(r.codename) + '</span><b>' + escT(r.codename) + '</b>' +
        (r.status === 'geen' ? '<button data-scvz="' + escT(r.key) + '">' + T('sal.verzoek','Verzoek sturen') + '</button>'
         : r.status === 'verbonden' ? '<span style="color:var(--green,#2E7D4F);font-size:0.72rem;">✓ ' + T('sal.isverbonden','verbonden') + '</span>'
         : r.status === 'aangevraagd' ? '<span style="color:var(--soft);font-size:0.72rem;">' + T('sal.gevraagd','aangevraagd') + '</span>'
         : '<span style="color:var(--gold);font-size:0.72rem;">' + T('sal.wachtu','wacht op u') + '</span>') + '</div>'
      ).join('') || '<div style="font-size:0.78rem;color:var(--soft);">' + T('sal.niksgevonden','Geen leden gevonden met deze codenaam.') + '</div>';
      $('#scRes').querySelectorAll('[data-scvz]').forEach(b => b.addEventListener('click', async () => {
        try { await API.call('/member/connect', { key: b.dataset.scvz }); toast(T('sal.verzonden','Verzoek verstuurd.')); zoekLeden(); } catch(e){ toast(e.message); }
      }));
    } catch(e){ toast(e.message); }
  }

