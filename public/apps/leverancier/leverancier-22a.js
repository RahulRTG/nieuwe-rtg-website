    // schakelaars van de zaak: elke functie aan of uit, direct doorgevoerd
    wireFuncBlok(el);
    bindWerkvenster(el);
    el.querySelectorAll('[data-kopt]').forEach(b => b.addEventListener('click', async () => {
      const k = b.dataset.kopt, v = b.dataset.val === '1';
      b.disabled = true;
      try {
        if (k === 'ordersOpen' || k === 'reservationsOpen') await API.call('/supplier/settings', { [k]: v });
        else await API.call('/supplier/settings', { opties: { [k]: v } });
        boData = null;
        await refresh();
      } catch(e){ toast(e.message); b.disabled = false; }
    }));
    const bb = el.querySelector('#boBrief'); if (bb) bb.addEventListener('click', () => {
      const t2 = el.querySelector('#boBriefTxt');
      if (!t2) return;
      t2.textContent = (boData && boData.briefing) || '';
      t2.style.display = t2.style.display === 'none' ? 'block' : 'none';
    });
    // de kantoorvleugel (los script): 3D-weekskyline + het drukklare Weekrapport
    if (window.RTGZaakKantoor) RTGZaakKantoor.bind(el, { boData: boData, vwData: vwData, T: T, S: S, toast: toast, esc: esc, eur: eur, lang: lang });
    // hr-plus (los script): de volle HR-kamer op de eigen API
    if (window.RTGZaakHR) RTGZaakHR.bind(el, { api: (p, b) => API.call(p, b), T: T, esc: esc, toast: toast, staff: (state && state.staff) || [] });
    // pr-plus (los script): planner, nieuwsbrief, bereik + Persdossier
    if (window.RTGZaakPR) RTGZaakPR.bind(el, { api: (p, b) => API.call(p, b), T: T, esc: esc, toast: toast, S: S, lang: lang, mktData: mktData, fotos: (state && state.photos) || [] });
    if (window.RTGZaakPuls) RTGZaakPuls.bind(el, { api: (p, b) => API.call(p, b), T: T, esc: esc, toast: toast, S: S });
    // de generieke kamer-laag: Kamerrapport (print) + Rahul-advies in elke kamer
    if (window.RTGZaakKamer) RTGZaakKamer.bind(el, { api: (p, b) => API.call(p, b), T: T, esc: esc, toast: toast, S: S, lang: lang, sectie: kantoorSec,
      label: ((el.querySelector('[data-ksec="' + kantoorSec + '"]') || {}).textContent || kantoorSec).trim() });
    // synergie: tekenen, stoppen en een nieuwe deal voorstellen
    const synVer = async () => { boData = null; synData = null; await refresh(); };
    el.querySelectorAll('[data-synkans]').forEach(b => b.addEventListener('click', async () => {
      const k = ((vwData && vwData.dealkansen) || [])[Number(b.dataset.synkans)];
      if (!k) return;
      try {
        await API.call('/supplier/synergie/maak', { naam: k.voorstel.naam,
          omschrijving: T('sy.kansoms','Voorgesteld door de dealvinder op basis van combinatiegedrag van gasten.'),
          prijsCenten: k.voorstel.prijsCenten, aandelen: k.voorstel.aandelen });
        toast(''+T('sy.voorgesteld','Voorgesteld; de partner tekent in het eigen kantoor.'));
        await synVer();
      } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-synja]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/synergie/reageer', { id: b.dataset.synja, akkoord: true }); toast(''+T('sy.ok','Getekend.')); await synVer(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-synnee]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/synergie/reageer', { id: b.dataset.synnee, akkoord: false }); await synVer(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-synstop]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/synergie/stop', { id: b.dataset.synstop }); await synVer(); } catch(e){ toast(e.message); }
    }));
    const sm = el.querySelector('#synMaak'); if (sm) sm.addEventListener('click', async () => {
      const w = id => (el.querySelector(id) || {}).value || '';
      const totaal = Math.round(parseFloat(String(w('#synPrijs')).replace(',', '.')) * 100);
      const mijn = Math.round(parseFloat(String(w('#synMijn')).replace(',', '.')) * 100);
      if (!(totaal > 0) || !(mijn >= 0) || mijn > totaal) { toast(T('sy.bedrag','Controleer de bedragen.')); return; }
      try {
        await API.call('/supplier/synergie/maak', { naam: w('#synNaam'),
          prijsCenten: totaal, aandelen: [
            { code: (S && S.code) || '', centen: mijn },
            { code: String(w('#synPartner')).toUpperCase().trim(), centen: totaal - mijn }
          ] });
        toast(''+T('sy.voorgesteld','Voorgesteld; de partner tekent in het eigen kantoor.'));
        await synVer();
      } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-khire]').forEach(b => b.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/apply/decide', { id: b.dataset.khire, action: 'aannemen' });
        kantoorMsg = '\u2705 '+T('kt.hired','Aangenomen.')+' <b>'+escT(d.invite.naam)+'</b> '+T('kt.hired.geef','meldt zich zelf aan met bedrijfsnaam')+' <b>'+escT(d.bedrijf)+'</b> + '+T('kt.invite.code','Kassacode')+' <b style="color:var(--rtg-leesgoud,var(--gold));font-family:monospace;letter-spacing:0.14em;">'+escT(d.invite.kassacode)+'</b>';
        invData = null;
        await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kreset]').forEach(b => b.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/staff/reset-pin', { staffId: b.dataset.kreset });
        kantoorMsg = '\ud83d\udd11 '+T('kt.resetdone','Code gereset voor')+' <b>'+escT(d.staff.name)+'</b> \u00b7 '+T('kt.newpin','nieuwe pincode')+': <b style="color:var(--rtg-leesgoud,var(--gold));">'+escT(d.pin)+'</b> ('+T('kt.pinonce','geef eenmalig door')+')';
        await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kinv]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/staff/invite/intrek', { kassacode: b.dataset.kinv });
        invData = null; toast(T('kt.ingetrokken','Uitnodiging ingetrokken.')); renderStation(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kno]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/apply/decide', { id: b.dataset.kno, action: 'afwijzen' }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/staff/remove', { staffId: b.dataset.kdel }); await refresh(); } catch(e){ toast(e.message); }
    }));
