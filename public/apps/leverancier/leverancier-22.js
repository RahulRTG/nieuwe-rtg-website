/* de instellingen van de zaak opslaan */
    const fnS = el.querySelector('#fnSave'); if (fnS) fnS.addEventListener('click', async () => {
      try {
        await API.call('/supplier/settings', { land: el.querySelector('#fnLand').value, uurloon: Number(el.querySelector('#fnUur').value) });
        finData = null; finMsg = '';
        await refresh();
      } catch(e){ toast(e.message); }
    });
    const fnP = el.querySelector('#fnPdf'); if (fnP) fnP.addEventListener('click', () => dlBestand('/supplier/finance/export', { formaat: 'pdf' }, 'RTG-boekhouding.pdf'));
    const fnC = el.querySelector('#fnCsv'); if (fnC) fnC.addEventListener('click', () => dlBestand('/supplier/finance/export', { formaat: 'csv' }, 'RTG-boekhouding.csv'));
    btwBedrading(el); // de knoppen van de btw-aangifte; zie leverancier-12a.js
    const gS = el.querySelector('#gcSell'); if (gS) gS.addEventListener('click', async () => {
      /* TWEE MAATREGELEN, EN ZE DOEN VERSCHILLENDE DINGEN (TAKEN.md 4.60).
         De knop op slot vangt de DUBBELTIK: twee klikken binnen een seconde
         sturen niet twee verzoeken. De idem-sleutel vangt de HERHALING van
         dezelfde poging -- een hapering, of iemand die na een timeout opnieuw
         probeert terwijl het verzoek wel is aangekomen. Zonder de sleutel gaf
         dat een tweede cadeaukaart met saldo, en die is gewoon inwisselbaar. */
      if (gS.disabled) return;
      gS.disabled = true;
      try {
        const d = await API.call('/supplier/giftcard/sell',
          { bedrag: Number(el.querySelector('#gcBedrag').value), idem: RTGIdem('gc') });
        finMsg = ''+T('fn.gcklaar','Cadeaukaart verkocht. Geef deze code mee:')+' <b style="color:var(--gold);">'+d.kaart.code+'</b> (€ '+d.kaart.bedrag+')';
        finData = null;
        renderStation();   // hertekent het scherm, dus de knop komt vers terug
      } catch(e){ gS.disabled = false; toast(e.message); }
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
      box.innerHTML = '<div class="tkc-who h-mt60">' + T('fn.advbezig', 'Ik kijk naar uw cijfers…') + '</div>';
      try {
        const d = await API.call('/supplier/accountant/adviezen', {});
        box.innerHTML = (d.intro ? '<div style="font-size:0.82rem;margin:0.5rem 0;line-height:1.6;">' + esc(d.intro) + '</div>' : '') +
          (d.adviezen || []).map(a => '<div style="border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.8rem;margin-top:0.5rem;"><b style="color:var(--gold);font-size:0.8rem;">' + esc(a.titel) + '</b><div style="font-size:0.8rem;color:var(--soft);margin-top:0.25rem;line-height:1.5;">' + esc(a.tekst) + '</div></div>').join('');
      } catch(e){ box.innerHTML = '<div class="tkc-who">' + esc(e.message) + '</div>'; }
    });
