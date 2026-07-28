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
