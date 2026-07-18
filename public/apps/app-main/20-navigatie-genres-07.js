      if (wens === null) return;
      try { await API.call('/vastgoed/interesse', { supplierCode: code, pandId: pid, wens }); toast(T('vg.m.intok','De makelaar krijgt uw aanvraag en bevestigt een moment.')); laadVastgoed(); }
      catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-vgbod]').forEach(b => b.addEventListener('click', async () => {
      const [code, pid] = b.dataset.vgbod.split(':');
      const bod = prompt(T('vg.m.bodvraag','Uw bod in euro:'));
      if (!bod) return;
      try { await API.call('/vastgoed/bod', { supplierCode: code, pandId: pid, bedrag: Number(bod) }); toast(T('vg.m.bodok','Uw bod is verstuurd naar de makelaar.')); laadVastgoed(); }
      catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-vgkey]').forEach(b => b.addEventListener('click', async () => {
      try { const r = await API.call('/vastgoed/keyless', { ref: b.dataset.vgkey }); toast('\uD83D\uDD13 '+T('vg.m.geopend','De deur is open. Code: ')+r.code); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- contracten: digitaal ondertekenen ---------- */  /* ---------- contracten: digitaal ondertekenen ---------- */
  async function laadContracten(){
    if (!API.live) return;
    let lijst = [];
    try { lijst = (await API.call('/contracten/mijn')).contracten || []; } catch(e){}
    const el = $('#conMijn'); if (!el) return;
    const open = lijst.filter(c => c.status !== 'geweigerd');
    if (!open.length){ el.innerHTML = ''; return; }
    el.innerHTML = open.map(c =>
      '<div class="card" style="border-color:'+(c.getekendDoorMij?'rgba(91,185,140,0.4)':'rgba(208,172,87,0.5)')+';">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:'+(c.getekendDoorMij?'var(--green)':'var(--gold)')+';">\uD83D\uDCDD '+esc(c.supplierName)+' \u00B7 '+T('con.'+c.soort, c.soort)+'</div>'+
      '<div style="margin-top:0.35rem;font-size:0.92rem;"><b>'+esc(c.titel)+'</b></div>'+
      (c.velden && c.velden.length ? '<div style="margin-top:0.2rem;font-size:0.76rem;color:var(--muted);">'+c.velden.map(v=>esc(v.label)+': '+esc(v.waarde)).join(' \u00B7 ')+'</div>' : '')+
      '<details style="margin-top:0.4rem;"><summary style="cursor:pointer;font-size:0.74rem;color:var(--gold);">'+T('con.lees','Lees de voorwaarden')+'</summary><div style="font-size:0.8rem;color:var(--muted);white-space:pre-wrap;margin-top:0.35rem;">'+escT(c.tekst)+'</div></details>'+
      (c.getekendDoorMij
        ? '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--green);">\u2705 '+(c.status==='getekend'?T('con.klaar','Getekend door beide partijen.'):T('con.wacht','U tekende; de zaak tekent nog.'))+'</div>'
        : '<div style="margin-top:0.6rem;display:flex;gap:0.5rem;"><button class="bz-groot" style="flex:1;" data-conteken="'+c.ref+'">'+T('con.teken','Ondertekenen')+'</button><button class="bz-btn" data-conweiger="'+c.ref+'">'+T('con.weiger','Weiger')+'</button></div>')+
      '</div>').join('');
    document.querySelectorAll('[data-conteken]').forEach(b => b.addEventListener('click', async () => {
      const naam = prompt(T('con.tekenvraag','Typ uw naam om digitaal te ondertekenen. Zo gaat u akkoord met de voorwaarden.'));
      if (!naam) return;
      try { await API.call('/contract/teken', { ref: b.dataset.conteken, naam, akkoord: true }); toast(T('con.tekenok','Getekend. Bedankt!')); laadContracten(); }
      catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-conweiger]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm(T('con.weigervraag','Dit contract weigeren?'))) return;
      try { await API.call('/contract/weiger', { ref: b.dataset.conweiger }); toast(T('con.weigerok','Geweigerd.')); laadContracten(); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- bestellen: de ophaal/bezorgdienst ---------- */
  let bzPartners = [], bzZaak = null, bzMand = {}, bzLevering = 'bezorgen', bzGeo = null, bzAdresW = '';
  async function laadBestellen(){
    if (!API.live) return;
    try { bzPartners = (await API.call('/bezorg/partners')).partners || []; } catch(e){ bzPartners = []; }
    renderBestellen();
    laadBzMijn();
  }

  // De exclusieve autoshowroom: bekijken, proefrit, kopen (bod/inruil/concierge)
  async function laadShowroom(){
    const el = $('#showroom'); if (!el || !API.live) return;
    if (user && user.tier === 'guest'){ el.innerHTML = ''; return; }
    let d, mijn;
    try { d = await API.call('/verkoop/showroom'); mijn = await API.call('/verkoop/mijn'); } catch(e){ el.innerHTML = ''; return; }
    const autos = d.autos || [];
    const deals = (mijn.deals || []).filter(x => !['gereden','afgeleverd','afgewezen','geannuleerd'].includes(x.status));
    if (!autos.length && !deals.length){ el.innerHTML = ''; return; }
    let h = '<h3 style="margin:1.6rem 0 0.3rem;font-size:1rem;">🚗 ' + T('vk.h','Autoshowroom') + '</h3><p class="sub" style="margin-bottom:0.6rem;">' + T('vk.sub','Exclusieve occasions. Proefrit, bod of inruil.') + '</p>';
    for (const d2 of deals){
      h += '<div style="border:1px solid var(--gold);border-radius:14px;padding:0.7rem 0.9rem;margin-bottom:0.7rem;"><div style="font-size:0.7rem;color:var(--gold);text-transform:uppercase;letter-spacing:0.08em;">' + (d2.soort==='koop'?'🔑 '+T('vk.koop','Koop'):'🚗 '+T('vk.proefritk','Proefrit')) + ' · ' + escT(d2.status) + '</div>' +
        '<div style="font-size:0.86rem;margin-top:0.2rem;">' + escT(d2.autoNaam) + (d2.prijs?' · € ' + d2.prijs.toLocaleString('nl-NL'):'') + (d2.moment?' · ' + escT(d2.moment):'') + '</div>' +
        (d2.soort==='koop' && d2.status==='aanvaard' ? '<button class="js-vkteken" data-ref="' + d2.ref + '" style="margin-top:0.5rem;background:var(--gold);color:#000;border:none;border-radius:10px;padding:0.5rem 0.9rem;font-weight:600;font-family:inherit;cursor:pointer;">✍️ ' + T('vk.teken','Koopcontract tekenen') + '</button>' : '') + '</div>';
    }
    h += autos.slice(0,20).map(a => '<div style="border:1px solid var(--line);border-radius:16px;padding:0.85rem;margin-bottom:0.7rem;" data-av="' + a.id + '">' +
      '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><b style="font-size:0.95rem;">' + (a.vip?'★ ':'') + escT(a.naam) + '</b><span style="font-weight:600;">€ ' + a.prijs.toLocaleString('nl-NL') + '</span></div>' +
      '<div class="sub">' + a.km.toLocaleString('nl-NL') + ' km · ' + escT(a.brandstof) + ' · ' + escT(a.transmissie) + (a.vermogenPk?' · ' + a.vermogenPk + ' pk':'') + (a.garantieMnd?' · ' + a.garantieMnd + ' mnd garantie':'') + '</div>' +
      (a.opties && a.opties.length ? '<div class="sub" style="margin-top:0.2rem;">' + a.opties.slice(0,4).map(escT).join(' · ') + '</div>' : '') +
      '<div style="display:flex;gap:0.4rem;margin-top:0.6rem;">' +
      '<button class="js-vkproef" data-code="' + a.supplierCode + '" data-id="' + a.id + '" style="flex:1;background:none;border:1px solid var(--gold);border-radius:10px;padding:0.45rem;color:var(--gold);font-weight:600;font-family:inherit;cursor:pointer;">' + T('vk.proefritk','Proefrit') + '</button>' +
      '<button class="js-vkkoop" data-code="' + a.supplierCode + '" data-id="' + a.id + '" data-prijs="' + a.prijs + '" data-naam="' + escAttr(a.naam) + '" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:10px;padding:0.45rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('vk.bodknop','Bod / kopen') + '</button>' +
      '</div></div>').join('');
    el.innerHTML = h;
    el.querySelectorAll('.js-vkteken').forEach(b => b.addEventListener('click', async () => {
      const naam = prompt(T('vk.tekennaam','Typ uw naam om het koopcontract te tekenen:')); if (!naam) return;
      try { await API.call('/verkoop/teken', { ref: b.dataset.ref, naam }); toast('✍️ ' + T('vk.getekend','Getekend. De zaak levert de auto af.')); laadShowroom(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-vkproef').forEach(b => b.addEventListener('click', async () => {
      const wens = prompt(T('vk.wens','Wanneer wilt u proefrijden? (bv. zaterdagochtend)')) || '';
      try { await API.call('/verkoop/proefrit', { supplierCode: b.dataset.code, autoId: b.dataset.id, wens }); toast('🚗 ' + T('vk.proefok','Proefrit aangevraagd. De zaak plant hem in.')); laadShowroom(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-vkkoop').forEach(b => b.addEventListener('click', async () => {
      const bod = prompt(T('vk.bodvraag','Uw bod in € (leeg = vraagprijs):'), b.dataset.prijs);
      if (bod === null) return;
      const wilInruil = confirm(T('vk.inruilvraag','Wilt u een auto inruilen?'));
      let inruil = null;
      if (wilInruil){ const merk = prompt(T('vk.inmerk','Merk + model van uw inruilauto:')); if (merk){ const jaar = prompt(T('vk.injaar','Bouwjaar?'),''); const km = prompt(T('vk.inkm','Kilometerstand?'),''); inruil = { merk, model: '', jaar, km }; } }
      const concierge = confirm(T('vk.concvraag','Concierge-aflevering op uw adres?'));
