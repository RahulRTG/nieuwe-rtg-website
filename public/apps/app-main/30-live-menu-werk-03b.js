  /* Het "Sparren met Rahul"-blok in het Rahul-paneel: samen een idee beter
     maken (niet om zijn gelijk te halen), en geparkeerde gedachten waar hij op
     een rustig moment op terugkomt. Als losse helper afgesplitst van
     30-live-menu-werk-03.js, zodat beide parts in de 5-10 KB-band blijven. */
  function sparBlokHtml(sparLijst){
    return '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.6rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">💭 ' + T('spar.h','Sparren met Rahul') + '</div>' +
      '<div style="font-size:0.68rem;color:var(--soft);margin-top:0.25rem;">' + T('spar.d','Hij denkt mee om je idee beter te maken, niet om zijn gelijk te halen. Parkeer een gedachte; als je rustig thuis bent met een lege agenda komt hij er zelf op terug.') + '</div>' +
      ((sparLijst || []).length
        ? '<div style="display:flex;flex-direction:column;gap:0.4rem;margin-top:0.5rem;">' + sparLijst.map(s =>
            '<div style="border:1px solid var(--line);border-radius:12px;padding:0.5rem 0.65rem;">' +
            '<div style="font-size:0.78rem;line-height:1.4;">' + esc(s.tekst) + '</div>' +
            '<div style="display:flex;gap:0.4rem;margin-top:0.4rem;">' +
              '<button class="chip js-sparchat" data-t="' + esc(s.tekst) + '" style="font-size:0.68rem;">💬 ' + T('spar.nu','Spar nu') + '</button>' +
              '<button class="chip js-spardone" data-id="' + esc(s.id) + '" style="font-size:0.68rem;">✓ ' + T('spar.klaar','Besproken') + '</button>' +
              '<button class="chip js-sparweg" data-id="' + esc(s.id) + '" style="font-size:0.68rem;">✕ ' + T('spar.weg','Weg') + '</button>' +
            '</div></div>').join('') + '</div>'
        : '') +
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;">' +
        '<input id="sparIn" placeholder="' + T('spar.plho','Waar wil je later over sparren?') + '" style="flex:1;min-width:0;background:var(--card2,#1B1817);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.65rem;font-size:0.76rem;color:var(--txt);outline:none;font-family:inherit;">' +
        '<button class="chip" id="sparPark" style="flex-shrink:0;">' + T('spar.park','Parkeer') + '</button>' +
      '</div>' +
    '</div>';
  }
  function bindSparBlok(el){
    // nu erover praten, of het onderwerp als besproken/weg zetten
    el.querySelectorAll('.js-sparchat').forEach(b => b.addEventListener('click', () => {
      const tegel = document.querySelector('.os-app[data-tab="ai"]'); if (tegel) tegel.click();
      if (typeof ask === 'function') ask(T('spar.over','Spar met me over') + ': ' + b.dataset.t);
    }));
    el.querySelectorAll('.js-spardone').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/spar/status', { id: b.dataset.id, status: 'besproken' }); renderFluister(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-sparweg').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/spar/status', { id: b.dataset.id, status: 'weg' }); renderFluister(); } catch(e){ toast(e.message); }
    }));
    const sparPark = el.querySelector('#sparPark'), sparIn = el.querySelector('#sparIn');
    if (sparPark && sparIn) {
      const park = async () => {
        const tekst = sparIn.value.trim(); if (!tekst) return;
        try { await API.call('/spar/parkeer', { tekst }); sparIn.value = ''; toast('💭 ' + T('spar.geparkeerd','Geparkeerd. Rahul komt er op een rustig moment op terug.')); renderFluister(); } catch(e){ toast(e.message); }
      };
      sparPark.addEventListener('click', park);
      sparIn.addEventListener('keydown', e => { if (e.key === 'Enter') park(); });
    }
  }
