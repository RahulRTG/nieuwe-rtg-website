    // Vakwerk Pro: offertes beantwoorden, werkbonnen schrijven, klantnotities
    // bewaren en onderhoudsherinneringen sturen (alles op codenaam)
    el.querySelectorAll('[data-vpbied]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.vpbied;
      const p = el.querySelector('[data-vpprijs="'+id+'"]'), t2 = el.querySelector('[data-vptoel="'+id+'"]');
      try { await API.call('/supplier/vak/offerte/antwoord', { id, prijs: p && p.value, toelichting: t2 && t2.value });
        vakPro = null; vakData = null; kantoorMsg = ''+T('vp.biedok','Offerte verstuurd; het lid krijgt bericht en kan akkoord geven.'); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-vpwei]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/vak/offerte/weiger', { id: b.dataset.vpwei });
        vakPro = null; vakData = null; kantoorMsg = ''+T('vp.weiok','Afgewezen; het lid krijgt netjes bericht.'); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-vpwb]').forEach(b => b.addEventListener('click', async () => {
      const ref = b.dataset.vpwb;
      const w = el.querySelector('[data-vpwbw="'+ref+'"]'), m = el.querySelector('[data-vpwbm="'+ref+'"]');
      try { await API.call('/supplier/vak/werkbon', { ref, werk: w && w.value, materiaal: m && m.value });
        vakPro = null; vakData = null; kantoorMsg = ''+T('vp.wbok','Werkbon opgeslagen; het lid ziet hem bij de boeking.'); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-vpnzet]').forEach(b => b.addEventListener('click', async () => {
      const cn = b.dataset.vpnzet;
      const inp = el.querySelector('[data-vpnin="'+cn+'"]');
      try { await API.call('/supplier/vak/klantnotitie', { codenaam: cn, tekst: inp && inp.value });
        vakPro = null; kantoorMsg = ''+T('vp.notok','Notitie bewaard.'); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-vpher]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/vak/onderhoud/herinner', { codenaam: b.dataset.vpher, dienstId: b.dataset.vpherd });
        vakPro = null; vakData = null; kantoorMsg = ''+T('vp.herok','Herinnering gestuurd, een keer per 30 dagen.'); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-vphzet]').forEach(b => b.addEventListener('click', async () => {
      const inp = el.querySelector('[data-vphin="'+b.dataset.vphzet+'"]');
      try { await API.call('/supplier/vak/dienst/herhaal', { id: b.dataset.vphzet, mnd: inp && inp.value });
        kantoorMsg = ''+T('vp.herhok','Herhaal-interval bewaard.'); await refresh(); } catch(e){ toast(e.message); }
    }));
    // Vakwerk Pro laag 2: ritme stoppen, wachtende uitnodigen, capaciteit
    el.querySelectorAll('[data-vprstop]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/vak/ritme/stop', { id: b.dataset.vprstop });
        vakPro = null; vakData = null; kantoorMsg = ''+T('vp.rstopok','Vaste afspraak gestopt; het lid krijgt bericht.'); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-vpwnodig]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/vak/wachtlijst/uitnodig', { id: b.dataset.vpwnodig });
        vakPro = null; kantoorMsg = ''+T('vp.nodigok','Seintje gestuurd; het lid boekt zelf.'); await refresh(); } catch(e){ toast(e.message); }
    }));
    const vpCapBtn = el.querySelector('#vpCapZet'); if (vpCapBtn) vpCapBtn.addEventListener('click', async () => {
      try { const r = await API.call('/supplier/vak/capaciteit', { capaciteit: el.querySelector('#vpCap').value });
        vakUren = r.uren; kantoorMsg = ''+T('vp.capok','Capaciteit bewaard; de tijdvakken rekenen er direct mee.'); await refresh(); } catch(e){ toast(e.message); }
    });
