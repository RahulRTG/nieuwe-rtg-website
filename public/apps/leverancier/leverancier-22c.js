    // binds van de WERKVLOER (sectie 'werkvloer' in het Kantoor)
    el.querySelectorAll('[data-wvtab]').forEach(b => b.addEventListener('click', () => { wvTab = b.dataset.wvtab; renderStation(); }));

    const wvVerse = () => { wvData = null; renderStation(); };
    const wvM = el.querySelector('#wvMaak'); if (wvM) wvM.addEventListener('click', async () => {
      try {
        const soort = el.querySelector('#wvSoort').value;
        const r = await API.call('/werkvloer/koppel/maak', { soort,
          titel: el.querySelector('#wvTitel').value,
          bedrag: Number(el.querySelector('#wvBedrag').value) || 0,
          ref: el.querySelector('#wvRef').value, vanScherm: 'bureau' });
        kantoorMsg = '✓ ' + T('wv.klaar', 'Staat klaar op het andere scherm.') + ' ' + r.uitleg;
        wvVerse();
      } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-wvbet]').forEach(b => b.addEventListener('click', async () => {
      const ref = prompt(T('wv.betref', 'Betaalkenmerk (bijvoorbeeld het RTG Pay-nummer):'));
      if (ref === null) return;
      try { await API.call('/werkvloer/koppel/betaald', { id: b.dataset.wvbet, ref, hoe: 'RTG Pay' });
        kantoorMsg = '✓ ' + T('wv.betaald', 'Genoteerd als betaald.'); wvVerse(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-wvann]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/werkvloer/koppel/annuleer', { id: b.dataset.wvann }); wvVerse(); } catch(e){ toast(e.message); }
    }));

    const wvT = el.querySelector('#wvTafelZet'); if (wvT) wvT.addEventListener('click', async () => {
      const n = Math.max(1, Math.min(30, Number(el.querySelector('#wvGasten').value) || 1));
      const gasten = []; for (let i = 1; i <= n; i++) gasten.push({ stoel: i });
      try {
        await API.call('/werkvloer/tafel', { tafel: { tafel: el.querySelector('#wvTafel').value,
          event: el.querySelector('#wvEvent').value, gasten } });
        kantoorMsg = '✓ ' + T('wv.tafelgezet', 'De tafel staat op de lijst; vul de wensen per stoel aan op de telefoon.');
        wvVerse();
      } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-wvkaart]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/werkvloer/bedieningskaart', { id: b.dataset.wvkaart });
        kantoorMsg = T('wv.tafel', 'Tafel') + ' ' + d.tafel + ': ' + d.stoelen.map(s => s.naam + ' (' + s.regel + ')').join(' | ');
        renderStation();
      } catch(e){ toast(e.message); }
    }));

    const wvC = el.querySelector('#wvChkMaak'); if (wvC) wvC.addEventListener('click', async () => {
      try {
        await API.call('/werkvloer/checklijst', { lijst: {
          titel: el.querySelector('#wvChkTitel').value,
          event: el.querySelector('#wvChkEvent').value,
          items: String(el.querySelector('#wvChkItems').value || '').split(',').map(s => s.trim()).filter(Boolean),
          gedeeld: String(el.querySelector('#wvChkDeel').value || '').split(',').map(s => s.trim()).filter(Boolean) } });
        kantoorMsg = '✓ ' + T('wv.chkklaar', 'De lijst staat er; wie meedoet ziet hem op zijn eigen scherm.');
        wvVerse();
      } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-wvvink]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/werkvloer/checklijst/vink', { id: b.dataset.wvvink, item: b.dataset.wvitem, aan: b.dataset.wvaan === '1' });
        wvVerse(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-wvdeel]').forEach(b => b.addEventListener('click', async () => {
      const met = prompt(T('wv.deelvraag', 'Met wie deel je deze lijst? (namen, gescheiden door een komma; leeg = het hele team)'));
      if (met === null) return;
      try { await API.call('/werkvloer/checklijst/deel', { id: b.dataset.wvdeel, met: met.split(',').map(s => s.trim()).filter(Boolean) });
        wvVerse(); } catch(e){ toast(e.message); }
    }));
