    const fooi = fooiKeus === 'p5' ? Math.round(o.total * 5) / 100
      : fooiKeus === 'p10' ? Math.round(o.total * 10) / 100
      : fooiKeus === 'e5' ? 5 : 0;
    payWithFaceId(eur(o.total + fooi), async () => {
      await API.call('/order/pay', { ref: o.ref, fooi });
      return o;
    }, { message: () => T('app.paidto','Betaald aan') + ' ' + o.supplierName + '.' + (fooi ? ' 💛 ' + eur(fooi) + ' ' + T('erv.fooivoorteam','fooi voor het team.') : ''), after: () => renderTerPlaatse() });
  }

  $('#msClose').addEventListener('click', () => { $('#menu-sheet').classList.remove('open'); $('#menu-scrim').classList.remove('open'); });
  $('#menu-scrim').addEventListener('click', () => { $('#menu-sheet').classList.remove('open'); $('#menu-scrim').classList.remove('open'); });

  /* ---------- cv-builder + solliciteren via RTG ---------- */
  let myCv = null, myCvReady = false, myApps = [];
  const APPLY_FUNCS = {
    restaurant: ['Bediening','Keuken','Gastheer/gastvrouw','Afwas'],
    bar:        ['Bediening','Bar','Keuken','Security'],
    club:       ['Bediening','Bar','Security'],
    hotel:      ['Receptie','Housekeeping','Roomservice','Onderhoud','Security'],
    apartment:  ['Beheer','Housekeeping','Onderhoud'],
    taxi:       ['Taxi centrale','Chauffeur'],
    jet:        ['Operations','Crew','Piloot']
  };
  async function loadCv(){
    if (!API.live) return;
    try { const d = await API.call('/cv/get'); myCv = d.cv; myCvReady = d.ready; renderCvCard(); } catch(e){}
  }
  function renderCvCard(){
    const el = $('#homeCv'); if (!el) return;
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
          (a.chatId ? '<button class="chatb" style="width:auto;padding:0.2rem 0.55rem;font-size:0.7rem;" data-apchat="'+a.chatId+'" data-apco="'+encodeURIComponent(a.company)+'">💬 '+T('cv.chat','Chat')+'</button>' : '')+
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
  const VLAG = { NL:'🇳🇱', BE:'🇧🇪', DE:'🇩🇪', FR:'🇫🇷', ES:'🇪🇸', JP:'🇯🇵' };
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
    const landOpts = '<option value="">🌍 '+T('vac.overal','Overal')+'</option>' +
      vacLanden.map(l => '<option value="'+l.code+'"'+(l.code===vacLand?' selected':'')+'>'+(VLAG[l.code]||'🏳️')+' '+esc(l.naam)+'</option>').join('');
    let h = '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">💼 '+T('vac.k','Werk en vacatures')+'</div>'+
      '<select id="vacLand" style="background:var(--card2);color:var(--txt,#fff);border:1px solid var(--line);border-radius:999px;padding:0.3rem 0.6rem;font-size:0.72rem;">'+landOpts+'</select></div>';
