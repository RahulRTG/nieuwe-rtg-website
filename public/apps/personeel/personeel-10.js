/* de dorpschat, en de leeftijdscheck die ja of nee zegt en nooit gegevens */
    const pdc = wrap.querySelector('#pkDorpChat');
    if (pdc) pdc.addEventListener('click', () => openTab('team'));
    // de leeftijdscheck: de paspoort-bevestiging geeft ja/nee, nooit gegevens
    wrap.querySelectorAll('[data-pklft]').forEach(b => b.addEventListener('click', async () => {
      const inp = wrap.querySelector('#pkLftIn'), uit = wrap.querySelector('#pkLftUit');
      const codenaam = (inp && inp.value || '').trim();
      if (!codenaam){ toast(T('pd.lft.leeg','Vul de codenaam van de gast in.')); return; }
      const min = Number(b.dataset.pklft);
      try {
        const r = await API.call('/supplier/paspoort/vraag', { codenaam, niveau: 'bevestiging', minLeeftijd: min });
        const ok = r.bevestiging && r.bevestiging.voldoetLeeftijd === true;
        if (navigator.vibrate) navigator.vibrate(ok ? 80 : [200, 80, 200]);
        uit.innerHTML = ok
          ? '<b style="color:var(--rtg-leesgroen,var(--green,#7ecb8f));font-size:1rem;">'+esc(codenaam)+' '+T('pd.lft.ja','is')+' '+min+'+</b>'
          : '<b style="color:#E36385;font-size:1rem;">'+esc(codenaam)+' '+T('pd.lft.nee','is NIET aantoonbaar')+' '+min+'+</b>';
      } catch(e){ uit.innerHTML = '<b style="color:#E36385;">'+esc(e.message)+'</b>'; }
    }));
    wrap.querySelectorAll('[data-pkdmeter]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/dorp/drukte', { afdeling: pkDorpKant, stand: b.dataset.pkdmeter }); pkToolsKant = null; pkLaadTools(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-pkdsnelknop]').forEach(b => b.addEventListener('click', async () => {
      const afd = pkDorp && (pkDorp.afdelingen.find(a => a.key === pkDorpKant) || pkDorp.afdelingen[0]);
      if (!afd) return;
      const waar = prompt(afd.waarHint) || '';
      try { await API.call('/supplier/dorp/post', { afdeling: afd.key, waar, tekst: b.dataset.pkdsnelknop }); toast(afd.icon+' '+T('pd.dorp.gezet','Staat op de lijst.')); pkDorpAt = 0; pkToolsKant = null; pkLaadDorp(); }
      catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-pkdverder]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/dorp/verder', { id: b.dataset.pkdverder }); pkDorpAt = 0; pkToolsKant = null; pkLaadDorp(); } catch(e){ toast(e.message); }
    }));
    // doorsturen: de post reist naar een andere afdeling, met het spoor erbij
    wrap.querySelectorAll('[data-pkdstuur]').forEach(b => b.addEventListener('click', async () => {
      if (!pkDorp) return;
      const naar = prompt(T('pd.dorp.stuurwaar','Naar welke afdeling?')+' ('+pkDorp.afdelingen.map(a=>a.key).join(', ')+')');
      if (!naar) return;
      try {
        await API.call('/supplier/dorp/stuurdoor', { id: b.dataset.pkdstuur, naar: naar.trim().toLowerCase() });
        toast('↪ '+T('pd.dorp.gestuurd','Doorgestuurd.'));
        pkDorpAt = 0; pkToolsKant = null; pkLaadDorp();
      } catch(e){ toast(e.message); }
    }));
    // de buurt: een tik zet de naam alvast in de wens
    if (pkDorpKant === 'concierge') pkLaadBuurt();
    wrap.querySelectorAll('[data-pkdbuurt]').forEach(b => b.addEventListener('click', async () => {
      const afd = pkDorp && pkDorp.afdelingen.find(a => a.key === 'concierge');
      const waar = prompt(afd ? afd.waarHint : 'Kamer') || '';
      const tekst = prompt(T('pd.dorp.regelwat','Wat regelen we bij')+' '+b.dataset.pkdbuurt+' ('+b.dataset.soort+', '+b.dataset.km+' km)?');
      if (!tekst) return;
      try {
        await API.call('/supplier/dorp/post', { afdeling: 'concierge', waar, tekst: b.dataset.pkdbuurt+': '+tekst });
        toast(''+T('pd.dorp.gezet','Staat op de lijst.'));
        pkDorpAt = 0; pkToolsKant = null; pkLaadDorp();
      } catch(e){ toast(e.message); }
    }));
    const dn = wrap.querySelector('[data-pkdnieuw]'); if (dn) dn.addEventListener('click', async () => {
      const afd = pkDorp && (pkDorp.afdelingen.find(a => a.key === pkDorpKant) || pkDorp.afdelingen[0]);
      if (!afd) return;
      const waar = prompt(afd.waarHint) || '';
      const tekst = prompt(afd.watHint);
      if (!tekst) return;
      try { await API.call('/supplier/dorp/post', { afdeling: afd.key, waar, tekst }); toast(afd.icon+' '+T('pd.dorp.gezet','Staat op de lijst.')); pkDorpAt = 0; pkToolsKant = null; pkLaadDorp(); }
      catch(e){ toast(e.message); }
    });
    wrap.querySelectorAll('[data-khk]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/room/hk', { id: b.dataset.khk, status: b.dataset.st }); await refresh(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-vrij]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/room/vrij', { id: b.dataset.vrij, op: b.dataset.op === 'aan' }); toast(b.dataset.op==='aan' ? ''+T('hk.vrijtoast','Vrijgegeven; de receptie ziet het direct.') : T('hk.vrijaf','Vrijgave intrekken')); await refresh(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-defect]').forEach(b => b.addEventListener('click', async () => {
      const note = prompt(T('hk.defectq','Wat is er kapot?'), '');
      if (note === null) return;
      try { await API.call('/supplier/room/hk', { id: b.dataset.defect, status: 'defect', note }); await refresh(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-mb]').forEach(b => b.addEventListener('click', () => {
      mbOpen = mbOpen === b.dataset.mb ? null : b.dataset.mb;
      mbTel = {};
      renderKamers();
    }));
    wrap.querySelectorAll('[data-mbplus]').forEach(b => b.addEventListener('click', () => { mbTel[b.dataset.mbplus] = (mbTel[b.dataset.mbplus]||0)+1; renderKamers(); }));
    wrap.querySelectorAll('[data-mbmin]').forEach(b => b.addEventListener('click', () => { mbTel[b.dataset.mbmin] = Math.max(0,(mbTel[b.dataset.mbmin]||0)-1); renderKamers(); }));
