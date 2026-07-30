    // binds van het THUIS-KANTOOR (sectie 'thuis' in het Kantoor)
    el.querySelectorAll('[data-thok]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/thuis/beslis', { ref: b.dataset.thok, akkoord: true });
        kantoorMsg = '✓ ' + T('th.geaccepteerd', 'Aanvraag geaccepteerd; de gast krijgt de bevestiging (en bij keyless straks de deurcode).');
        thuisData = null; renderStation(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-thnee]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/thuis/beslis', { ref: b.dataset.thnee, akkoord: false });
        thuisData = null; renderStation(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-thuit]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/thuis/checkuit', { ref: b.dataset.thuit });
        kantoorMsg = '✓ ' + T('th.uitgecheckt', 'Uitgecheckt; de uitbetaling staat gepland en jullie kunnen elkaar een review geven.');
        thuisData = null; renderStation(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-thadv]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/supplier/thuis/prijsadvies', { id: b.dataset.thadv });
        const uitEl = el.querySelector('[data-thadvuit="' + b.dataset.thadv + '"]');
        if (uitEl) uitEl.textContent = T('th.advies', 'AI-prijsadvies') + ': ' + eur(d.advies) + ' (' + T('th.nu', 'nu') + ' ' + eur(d.huidig) + ', ' + T('th.bez2', 'bezetting') + ' ' + d.bezettingPct + '%). ' + d.uitleg;
      } catch(e){ toast(e.message); }
    }));
    /* de commerciele tak aan- of uitzetten; aan vraagt om het maandtarief
       voor langverblijf (leeg of 0 laten kan gewoon) */
    el.querySelectorAll('[data-thzak]').forEach(b => b.addEventListener('click', async () => {
      const aan = b.dataset.thzaan !== '1';
      let maand = 0;
      if (aan) {
        const inv = prompt(T('th.zvraag', 'Maandtarief voor langverblijf (vanaf 28 nachten), 0 = geen:'), '0');
        if (inv === null) return;
        maand = Number(inv) || 0;
      }
      try { await API.call('/supplier/thuis/zakelijk', { id: b.dataset.thzak, zakelijk: { aan, opFactuur: aan, maandprijs: maand } });
        kantoorMsg = '✓ ' + (aan ? T('th.zaan', 'Commercieel aanbod: de logies-btw van het land staat nu op de prijs en zakelijke gasten kunnen op factuur boeken.')
                                 : T('th.zuit2', 'Terug naar prive-verhuur: geen btw en geen commissie.'));
        thuisData = null; renderStation(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-thblok]').forEach(b => b.addEventListener('click', async () => {
      const van = prompt(T('th.blokvan', 'Blokkeer van (JJJJ-MM-DD):')); if (!van) return;
      const tot = prompt(T('th.bloktot', 'tot (JJJJ-MM-DD):')); if (!tot) return;
      try { await API.call('/supplier/thuis/blokkeer', { id: b.dataset.thblok, van, tot });
        kantoorMsg = '✓ ' + T('th.geblokt', 'Periode geblokkeerd in de kalender.');
        thuisData = null; renderStation(); } catch(e){ toast(e.message); }
    }));
    const thZ = el.querySelector('#thZet'); if (thZ) thZ.addEventListener('click', async () => {
      try {
        await API.call('/supplier/thuis/huis', { huis: {
          titel: el.querySelector('#thTitel').value, plaats: el.querySelector('#thPlaats').value,
          type: el.querySelector('#thType').value, prijs: Number(el.querySelector('#thPrijs').value),
          maxGasten: Number(el.querySelector('#thGasten').value),
          instant: el.querySelector('#thInstant').checked, keyless: el.querySelector('#thKeyless').checked,
          visual: Math.floor(Math.random() * 8) } });
        kantoorMsg = '✓ ' + T('th.livegezet', 'Het huis staat live op RTG Thuis, onder de zaaknaam.');
        thuisData = null; renderStation();
      } catch(e){ toast(e.message); }
    });
