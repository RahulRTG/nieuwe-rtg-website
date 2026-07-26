    const fnS = el.querySelector('#fnSave'); if (fnS) fnS.addEventListener('click', async () => {
      try {
        await API.call('/supplier/settings', { land: el.querySelector('#fnLand').value, uurloon: Number(el.querySelector('#fnUur').value) });
        finData = null; finMsg = '';
        await refresh();
      } catch(e){ toast(e.message); }
    });
    const fnP = el.querySelector('#fnPdf'); if (fnP) fnP.addEventListener('click', () => dlBestand('/supplier/finance/export', { formaat: 'pdf' }, 'RTG-boekhouding.pdf'));
    const fnC = el.querySelector('#fnCsv'); if (fnC) fnC.addEventListener('click', () => dlBestand('/supplier/finance/export', { formaat: 'csv' }, 'RTG-boekhouding.csv'));
    const gS = el.querySelector('#gcSell'); if (gS) gS.addEventListener('click', async () => {
      try {
        const d = await API.call('/supplier/giftcard/sell', { bedrag: Number(el.querySelector('#gcBedrag').value) });
        finMsg = ''+T('fn.gcklaar','Cadeaukaart verkocht. Geef deze code mee:')+' <b style="color:var(--gold);">'+d.kaart.code+'</b> (€ '+d.kaart.bedrag+')';
        finData = null;
        renderStation();
      } catch(e){ toast(e.message); }
    });
    const gR = el.querySelector('#gcRedeem'); if (gR) gR.addEventListener('click', async () => {
      try {
        const d = await API.call('/supplier/giftcard/redeem', { code: el.querySelector('#gcCode').value, bedrag: Number(el.querySelector('#gcInBedrag').value) });
        finMsg = ''+T('fn.gcgeind','Ingewisseld. Restsaldo op de kaart:')+' <b style="color:var(--gold);">€ '+d.saldo+'</b>';
        finData = null;
        renderStation();
      } catch(e){ toast(e.message); }
    });
    const aG = el.querySelector('#accGo'); if (aG) aG.addEventListener('click', async () => {
      const q = el.querySelector('#accQ').value.trim();
      if (!q) return;
      accAntwoord = '…';
      renderStation();
      try { accAntwoord = esc((await API.call('/supplier/accountant', { question: q })).answer); }
      catch(e){ accAntwoord = esc(e.message); }
      renderStation();
    });
    const aQ = el.querySelector('#accQ'); if (aQ) aQ.addEventListener('keydown', e => { if (e.key === 'Enter' && aG) aG.click(); });
    // branchevragen als klikbare chips
    const vBox = el.querySelector('#accVragen');
    if (vBox) API.call('/supplier/accountant/vragen', {}).then(d => {
      vBox.innerHTML = (d.vragen || []).map(q => '<button class="obtn js-accv" style="font-size:0.72rem;padding:0.3rem 0.7rem;">' + esc(q) + '</button>').join('');
      vBox.querySelectorAll('.js-accv').forEach(b => b.addEventListener('click', () => { const q = el.querySelector('#accQ'); q.value = b.textContent; if (aG) aG.click(); }));
    }).catch(() => {});
    // proactieve adviezen op de eigen cijfers
    const adv = el.querySelector('#accAdvies');
    if (adv) adv.addEventListener('click', async () => {
      const box = el.querySelector('#accAdv');
      box.innerHTML = '<div class="tkc-who" style="margin-top:0.6rem;">' + T('fn.advbezig', 'Ik kijk naar uw cijfers…') + '</div>';
      try {
        const d = await API.call('/supplier/accountant/adviezen', {});
        box.innerHTML = (d.intro ? '<div style="font-size:0.82rem;margin:0.6rem 0;line-height:1.6;">' + esc(d.intro) + '</div>' : '') +
          (d.adviezen || []).map(a => '<div style="border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.8rem;margin-top:0.5rem;"><b style="color:var(--gold);font-size:0.8rem;">' + esc(a.titel) + '</b><div style="font-size:0.8rem;color:var(--soft);margin-top:0.2rem;line-height:1.5;">' + esc(a.tekst) + '</div></div>').join('');
      } catch(e){ box.innerHTML = '<div class="tkc-who">' + esc(e.message) + '</div>'; }
    });
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
        kantoorMsg = '\u2705 '+T('kt.hired','Aangenomen.')+' <b>'+escT(d.invite.naam)+'</b> '+T('kt.hired.geef','meldt zich zelf aan met bedrijfsnaam')+' <b>'+escT(d.bedrijf)+'</b> + '+T('kt.invite.code','Kassacode')+' <b style="color:var(--gold);font-family:monospace;letter-spacing:0.14em;">'+escT(d.invite.kassacode)+'</b>';
        invData = null;
        await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kreset]').forEach(b => b.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/staff/reset-pin', { staffId: b.dataset.kreset });
        kantoorMsg = '\ud83d\udd11 '+T('kt.resetdone','Code gereset voor')+' <b>'+escT(d.staff.name)+'</b> \u00b7 '+T('kt.newpin','nieuwe pincode')+': <b style="color:var(--gold);">'+escT(d.pin)+'</b> ('+T('kt.pinonce','geef eenmalig door')+')';
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
