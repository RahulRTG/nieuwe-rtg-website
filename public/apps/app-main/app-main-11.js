    if (d.kind === 'accept'){
      const pc = maakPc();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      API.call('/member/call', { toKey: call.withKey, kind: 'offer', payload: offer }).catch(()=>{});
    } else if (d.kind === 'offer'){
      const pc = maakPc();
      await pc.setRemoteDescription(d.payload);
      await flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      API.call('/member/call', { toKey: call.withKey, kind: 'answer', payload: answer }).catch(()=>{});
    } else if (d.kind === 'answer'){
      await call.pc.setRemoteDescription(d.payload);
      await flushIce();
    } else if (d.kind === 'ice'){
      if (call.pc && call.pc.remoteDescription) { try { await call.pc.addIceCandidate(d.payload); } catch(e){} }
      else call.pendingIce.push(d.payload);
    } else if (d.kind === 'hangup' || d.kind === 'decline' || d.kind === 'busy'){
      toast(d.kind === 'busy' ? T('sal.bezet','In gesprek.') : d.kind === 'decline' ? T('sal.geweigerd','Oproep geweigerd.') : T('sal.opgehangen','Gesprek beëindigd.'));
      eindeGesprek(false);
    }
  }

  function opSociaal(d){
    if (d.kind === 'request'){ toast('' + d.from + ' ' + T('sal.wilverbinden','wil verbinden')); loadSocial(); }
    else if (d.kind === 'accepted'){ toast('' + d.by + ' ' + T('sal.accepteerde','accepteerde uw verzoek')); loadSocial(); }
    else if (d.kind === 'dm'){
      if (dmWith === d.from && $('#dm-sheet').classList.contains('open')){
        dmToevoegen({ from: d.from, text: d.text, post: d.post, at: d.at });
        API.call('/member/dm', { withKey: d.from }).catch(()=>{}); // gelezen
      } else {
        toast('' + d.codename + ': ' + (d.text || '↗').slice(0, 60));
        loadSocial();
      }
    }
  }


  /* seam voor de RTG OS-laag: de eigen Bellen-, Videobellen- en Snaps-apps
     openen hiermee een kiezer en starten dan direct het gesprek of de snap */
  window.RTGSocial = {
    ok: () => socialOK,
    lijst: () => (social.connections || []),
    bel: (key, naam, video) => snelBel(key, naam, video),
    snap: key => snapKies(key)
  };

  /* ---- het salongesprek: jouw Rahul kletst met die van je vriend ----

     Een gimmick, en zo staat het er ook. De knop zit in de kop van de DM,
     want daar zit je al met precies die ene persoon.

     Twee dingen die hier bewust in het scherm staan en niet alleen in de
     server: de schakelaar (standaard uit) en de zin dat alle plekken
     verzonnen zijn. Wie niet weet dat er iets over zijn dag verteld wordt,
     heeft geen keuze gemaakt, en dan is "aan" geen toestemming. */
  let kletsAan = false;

  async function kletsLaad(){
    try {
      const d = await API.call('/klets', {});
      kletsAan = !!d.aan;
      return d;
    } catch(e){ return { aan: false, gesprekken: [], uitleg: '' }; }
  }

  function kletsTekenLeeg(d){
    $('#kletsBody').innerHTML =
      '<p class="stil" style="font-size:.82rem;color:var(--soft);line-height:1.6;">' + escT(d.uitleg || '') + '</p>' +
      '<label style="display:flex;gap:.6rem;align-items:flex-start;margin:.9rem 0;font-size:.85rem;">' +
        '<input type="checkbox" id="kletsSchakel"' + (kletsAan ? ' checked' : '') + ' style="margin-top:.2rem;">' +
        '<span>Rahul mag met de Rahul van mijn vrienden kletsen over hoe mijn dag was.' +
        '<br><span style="color:var(--soft);font-size:.78rem;">Uit te zetten wanneer je wilt. Zolang het uit staat, gebeurt er niets.</span></span>' +
      '</label>' +
      '<button class="knop" id="kletsGo"' + (kletsAan ? '' : ' disabled') + '>Laat ze kletsen</button>' +
      (d.gesprekken && d.gesprekken.length
        ? '<div style="margin-top:1rem;border-top:1px solid var(--line);padding-top:.8rem;">' +
          d.gesprekken.slice(0, 8).map(g =>
            '<button class="klets-eerder" data-klets="' + escT(g.id) + '" style="display:block;width:100%;text-align:left;background:none;border:0;color:inherit;padding:.5rem 0;font:inherit;cursor:pointer;">' +
            '<b style="font-size:.78rem;color:var(--gold);">' + escT(g.metCodenaam) + '</b>' +
            '<span style="display:block;font-size:.82rem;color:var(--soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escT(g.eerste) + '</span></button>'
          ).join('') + '</div>'
        : '');
    const schakel = $('#kletsSchakel');
    if (schakel) schakel.addEventListener('change', async () => {
      try { const r = await API.call('/klets/zet', { aan: schakel.checked }); kletsAan = !!r.aan; $('#kletsGo').disabled = !kletsAan; }
      catch(e){ toast(e.message); schakel.checked = kletsAan; }
    });
    const go = $('#kletsGo');
    if (go) go.addEventListener('click', kletsStart);
    $('#kletsBody').querySelectorAll('[data-klets]').forEach(b => b.addEventListener('click', async () => {
      try { kletsToon(await API.call('/klets/gesprek', { id: b.dataset.klets })); } catch(e){ toast(e.message); }
    }));
  }

  function kletsToon(g){
    $('#kletsBody').innerHTML =
      '<div class="klets-draad">' + (g.beurten || []).map(b =>
        '<div class="dm-m' + (b.mij ? ' mine' : '') + '">' + escT(b.tekst) + '</div>').join('') + '</div>' +
      '<p style="font-size:.75rem;color:var(--soft);line-height:1.6;margin-top:.9rem;">' + escT(g.noot || '') +
      (g.echt ? '' : ' Dit is een demogesprek: er staat geen AI-sleutel ingesteld.') + '</p>' +
      '<button class="knop" id="kletsTerug" style="margin-top:.7rem;">Terug</button>';
    const t = $('#kletsTerug');
    if (t) t.addEventListener('click', async () => kletsTekenLeeg(await kletsLaad()));
  }

  async function kletsStart(){
    if (!dmWith) return;
    const go = $('#kletsGo');
    if (go) { go.disabled = true; go.textContent = 'Ze zijn bezig...'; }
    try { kletsToon(await API.call('/klets/start', { vriend: dmWith })); }
    catch(e){ toast(e.message); if (go) { go.disabled = false; go.textContent = 'Laat ze kletsen'; } }
  }

  async function kletsOpen(){
    if (!dmWith) return;
    $('#kletsNaam').textContent = dmNaam || '';
    $('#klets-sheet').classList.add('open'); $('#klets-scrim').classList.add('open');
    $('#kletsBody').innerHTML = '<p style="color:var(--soft);font-size:.85rem;">Laden...</p>';
    kletsTekenLeeg(await kletsLaad());
  }
  const kletsDicht = () => { $('#klets-sheet').classList.remove('open'); $('#klets-scrim').classList.remove('open'); };
  if ($('#dmKlets')) $('#dmKlets').addEventListener('click', kletsOpen);
  if ($('#kletsClose')) $('#kletsClose').addEventListener('click', kletsDicht);
  if ($('#klets-scrim')) $('#klets-scrim').addEventListener('click', kletsDicht);
  /* ---------- live updates ---------- */

  // een scherm werkt zichzelf bij zonder page-refresh
  async function syncScope(scope){
    if (!API.live) return;
    try {
      const data = await API.call('/state');
      applyState(data.state);
    } catch (e) { return; }
    if (scope === 'payments'){ renderPay(); renderHome(); renderTrip(); }
    else if (scope === 'salon'){ renderSalon(); renderHome(); }
    else if (scope === 'orders'){ renderTerPlaatse(); if (user.tier === 'guest') loadGuestHistory(); }
        else if (scope === 'gchat'){ if (pchat) loadPChat(); }
    else if (scope === 'apply'){ renderCvCard(); if (apChatId) laadApplyChat(); }
    else if (scope === 'chat'){ if (user.account) renderChat(); }
    else if (scope === 'tickets'){ laadTickets(); }
    else if (scope === 'huur'){ laadVerhuur(); }
    else if (scope === 'charter'){ laadCharter(); }
    else if (scope === 'groothandel'){ laadBoodschappen(); }
    else if (scope === 'verkoop'){ laadShowroom(); }
    else if (scope === 'contract'){ laadContracten(); }
    else if (scope === 'vastgoed'){ laadVastgoed(); }
    else if (scope === 'care'){ laadCare(); }
    else if (scope === 'live'){ renderLive(); laadTickets(); }
    else if (scope === 'paspoort'){ laadPaspoortInbox(); }
    else if (scope === 'ontmoeting'){ laadOntmoet(); }
    else { renderPay(); renderHome(); renderTrip(); renderSalon(); renderTerPlaatse(); if (user.account) renderChat(); laadPaspoortInbox(); laadOntmoet(); }
  }

  function timeAgo(iso){
    const s = Math.max(1, Math.round((Date.now() - new Date(iso)) / 1000));
    if (s < 60) return T('t.now','zojuist');
    const ago = T('t.ago',' geleden');
    const m = Math.round(s / 60);
    if (m < 60) return m + T('t.min',' min') + ago;
    const h = Math.round(m / 60);
    if (h < 24) return h + T('t.hour',' uur') + ago;
    return Math.round(h / 24) + T('t.days',' dag(en)') + ago;
  }

  function renderBell(){
    const R = window.RTGRealtime;
    if (!R) return;
    const n = R.unread();
    const badge = $('#bellBadge');
    badge.style.display = n > 0 ? 'flex' : 'none';
    badge.textContent = n > 9 ? '9+' : n;
    /* De bel zelf staat verborgen (de statusbalk is leeg); zijn teller staat op
       de tegel in het bedieningspaneel. Hier bijgewerkt en niet daar, want dit
       is de plek die weet hoeveel er ligt -- twee tellers die elkaar naschrijven
       is precies hoe ze uit elkaar gaan lopen. */
    const ccTel = $('#osCcBelTel');
    if (ccTel){ ccTel.hidden = n <= 0; ccTel.textContent = n > 0 ? (n > 9 ? '9+' : n) : ''; }
    const list = $('#notifList');
