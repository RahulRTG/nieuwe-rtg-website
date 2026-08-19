    el.innerHTML = '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">'+T('cv.card.k','Werken via RTG')+'</div>'+
      (myCvReady
        ? '<div style="margin-top:0.4rem;font-size:0.85rem;color:var(--muted);">✓ '+T('cv.card.ready','Uw cv staat klaar. Solliciteer bij elke RTG-partner in een tik, via Ter plaatse.')+'</div>'
        : '<div style="margin-top:0.4rem;font-size:0.85rem;color:var(--muted);">'+T('cv.card.build','Maak eenmalig uw cv met de cv-builder en solliciteer daarna bij elke RTG-partner op dezelfde manier.')+'</div>')+
      (myApps.length ? '<div style="margin-top:0.9rem;display:flex;flex-direction:column;gap:0.45rem;">'+myApps.map(a => {
        const kleur = a.status==='aangenomen' ? '#4CAF7D' : a.status==='afgewezen' ? 'var(--burgundy)' : a.status==='uitgenodigd' ? '#4CAF7D' : 'var(--gold)';
        const label = a.status==='aangenomen' ? T('cv.st.hired','aangenomen') : a.status==='afgewezen' ? T('cv.st.rejected','afgewezen') : a.status==='uitgenodigd' ? T('cv.st.invited','uitgenodigd') : T('cv.st.new','in behandeling');
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.6rem;font-size:0.78rem;color:var(--muted);">'+
          '<span>'+a.company+' · '+a.func+'</span>'+
          '<span style="display:flex;align-items:center;gap:0.4rem;flex-shrink:0;">'+
          (a.chatId ? '<button class="chatb" style="width:auto;padding:0.2rem 0.55rem;font-size:0.7rem;" data-apchat="'+a.chatId+'" data-apco="'+encodeURIComponent(a.company)+'">'+T('cv.chat','Chat')+'</button>' : '')+
          '<span style="font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;color:'+kleur+';border:1px solid '+kleur+';border-radius:999px;padding:0.15rem 0.55rem;">'+label+'</span></span></div>';
      }).join('')+'</div>' : '')+
      '<button class="vbtn" style="margin-top:0.8rem;" id="cvOpen">'+(myCvReady?T('cv.card.edit','Bewerk mijn cv'):T('cv.card.make','Maak mijn cv'))+'</button>';
    $('#cvOpen').addEventListener('click', openCvSheet);
    el.querySelectorAll('[data-apchat]').forEach(b => b.addEventListener('click', () => openApplyChat(b.dataset.apchat, decodeURIComponent(b.dataset.apco||''))));
  }
  function openCvSheet(){
    const c = myCv || {};
    $('#cvName').value = c.name || (user && user.full) || '';
    $('#cvContact').value = c.contact || (user && (user.phone || user.email)) || '';
    $('#cvHeadline').value = c.headline || '';
    $('#cvExp').value = (c.experience || []).join('\n');
    $('#cvSkills').value = (c.skills || []).join(', ');
    $('#cvLang').value = (c.languages || []).join(', ');
    $('#cvAbout').value = c.about || '';
    $('#cv-sheet').classList.add('open');
    $('#cv-scrim').classList.add('open');
  }
  function closeCvSheet(){ $('#cv-sheet').classList.remove('open'); $('#cv-scrim').classList.remove('open'); }
  $('#cvClose').addEventListener('click', closeCvSheet);
  $('#cv-scrim').addEventListener('click', closeCvSheet);
  $('#cvSave').addEventListener('click', async () => {
    try {
      const d = await API.call('/cv/save', {
        name: $('#cvName').value, contact: $('#cvContact').value, headline: $('#cvHeadline').value,
        experience: $('#cvExp').value, skills: $('#cvSkills').value, languages: $('#cvLang').value, about: $('#cvAbout').value
      });
      myCv = d.cv; myCvReady = d.ready;
      toast(d.ready ? T('cv.saved','Cv bewaard. U kunt nu overal solliciteren.') : T('cv.savedpart','Bewaard. Vul ervaring of vaardigheden aan om te kunnen solliciteren.'));
      renderCvCard(); closeCvSheet();
    } catch(e){ toast(e.message); }
  });
  async function memberApply(code, func, note){
    try {
      await API.call('/member/apply', { supplierCode: code, func, note });
      toast(T('cv.applied','Sollicitatie verstuurd, met uw RTG-cv erbij.'));
      return true;
    } catch(e){
      toast(e.message);
      if (/cv/i.test(e.message)) openCvSheet();
      return false;
    }
  }

  /* ---------- vacatures: dezelfde partnervacatures als in de RTFoundation,
     nu ook voor RTG-leden, met land- en afstandfilter en solliciteren met cv ---------- */
  const VACSOORT = { bijbaan:'Bijbaan', vakantiewerk:'Vakantiewerk', parttime:'Parttime', fulltime:'Fulltime', stage:'Stage', vrijwilliger:'Vrijwilliger' };
  let vacs = [], vacLanden = [], vacLand = '';
  async function loadVacatures(){
    try {
      const d = await API.call('/member/vacatures', vacLand ? { land: vacLand } : {});
      vacs = d.vacatures || []; vacLanden = d.landen || [];
      renderVacatures();
      // locatie ophalen zodat vacatures op afstand komen (eenmalig)
      if (window.Geo && !Geo.laatste() && !loadVacatures._gps){ loadVacatures._gps = true; Geo.positie().then(p => { if (p) renderVacatures(); }); }
    } catch(e){ $('#homeVacatures').hidden = true; }
  }
  function renderVacatures(){
    const el = $('#homeVacatures'); if (!el) return;
    if (!vacs.length && !vacLand){ el.hidden = true; return; }
    el.hidden = false;
    const mijnPlek = window.Geo ? Geo.laatste() : null;
    const rij = vacs.map(v => ({ v, km: mijnPlek && v.loc ? Geo.afstandKm(mijnPlek, v.loc) : null }));
    if (mijnPlek) rij.sort((a,b) => (a.km==null?1e9:a.km) - (b.km==null?1e9:b.km));
    const isApplied = (v) => myApps.some(a => a.func === v.func && a.company === v.bedrijf);
    const landOpts = '<option value="">'+T('vac.overal','Overal')+'</option>' +
      vacLanden.map(l => '<option value="'+l.code+'"'+(l.code===vacLand?' selected':'')+'>'+(VLAG[l.code]||'')+' '+esc(l.naam)+'</option>').join('');
    let h = '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">'+T('vac.k','Werk en vacatures')+'</div>'+
      '<select id="vacLand" style="background:var(--card2);color:var(--txt,#fff);border:1px solid var(--line);border-radius:999px;padding:0.3rem 0.6rem;font-size:0.72rem;">'+landOpts+'</select></div>';
    if (!rij.length){
      h += '<div style="margin-top:0.6rem;font-size:0.82rem;color:var(--muted);">'+T('vac.leeg','Nu geen open vacatures die bij u passen. Kijk gerust later nog eens.')+'</div>'+
        '<button class="rahul-leeg-knop" data-rahul-leeg="Zoek werk dat bij mijn profiel past en help me solliciteren" style="margin-top:0.5rem;">'+T('vac.leegdoe','Laat Rahul werk zoeken dat past')+'</button>';
    } else {
      h += '<div style="margin-top:0.7rem;display:flex;flex-direction:column;gap:0.6rem;">'+ rij.slice(0,20).map(({v,km})=>{
        const al = isApplied(v);
        const meta = [ VACSOORT[v.soort]||v.soort, (VLAG[v.land]||'')+' '+(v.landNaam||''), v.plaats||v.stad, km!=null?(''+Geo.tekst(km)):'' ].filter(x=>x&&x.trim()).join(' · ');
        return '<div style="border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.85rem;">'+
          '<div style="display:flex;align-items:flex-start;gap:0.5rem;justify-content:space-between;">'+
          '<div style="min-width:0;"><b style="font-size:0.9rem;">'+esc(v.func)+'</b>'+
          '<div style="font-size:0.74rem;color:var(--rtg-leesgoud,var(--gold));font-weight:600;">'+esc(v.bedrijf)+'</div>'+
          '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.15rem;">'+esc(meta)+'</div></div>'+
          (al ? '<span style="flex-shrink:0;font-size:0.6rem;letter-spacing:0.06em;text-transform:uppercase;color:#4CAF7D;border:1px solid #4CAF7D;border-radius:999px;padding:0.15rem 0.5rem;">'+T('vac.verstuurd','verstuurd')+'</span>'
               : '<button class="vbtn" style="flex-shrink:0;width:auto;padding:0.4rem 0.8rem;font-size:0.74rem;" data-vac="'+v.id+'" data-sup="'+v.supplierCode+'">'+T('vac.sol','Solliciteer')+'</button>')+
          '</div>'+
          (v.omschrijving?'<div style="font-size:0.74rem;color:var(--muted);margin-top:0.4rem;line-height:1.4;">'+esc(v.omschrijving)+'</div>':'')+
          '</div>';
      }).join('')+'</div>';
    }
    el.innerHTML = h;
    const sel = $('#vacLand'); if (sel) sel.addEventListener('change', () => { vacLand = sel.value; loadVacatures(); });
    el.querySelectorAll('[data-vac]').forEach(b => b.addEventListener('click', () => applyVac(b.dataset.sup, b.dataset.vac)));
  }
  async function applyVac(supplierCode, vacatureId){
    const v = vacs.find(x => x.id === vacatureId);
    try {
      await API.call('/member/apply', { supplierCode, vacatureId });
      toast(T('cv.applied','Sollicitatie verstuurd, met uw RTG-cv erbij.'));
      if (v) myApps.unshift({ company: v.bedrijf, func: v.func, status: 'nieuw', at: new Date().toISOString() });
      renderVacatures(); renderCvCard();
    } catch(e){
      toast(e.message);
      if (/cv/i.test(e.message)) openCvSheet();
    }
  }

  /* ---------- chat met de werkgever (na uitnodigen/aannemen) ----------
     De sollicitant en de werkgever maken hier samen een afspraak om langs te
     komen. Berichten worden automatisch naar de gekozen taal vertaald. */
  let apChatId = null, apChatTimer = null;
  function apMsgHtml(m){
    const mij = m.van === 'sollicitant';
