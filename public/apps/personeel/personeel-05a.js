    $('#kaTerug').addEventListener('click', stepSector);
    const toonDienst = () => {
      $('#kaMeld').hidden = !!kaDienst;
      $('#kaDienstBlok').hidden = !kaDienst;
      if (kaDienst) $('#kaDienstTekst').textContent = '' + kaDienst.naam + ' ' + T('pd.ka.aangemeld','is aangemeld') + ' (' + kaDienst.waar + ', ' + kaDienst.kamer + ').';
    };
    const laadWie = async () => {
      try {
        const d = await kaApi('dienst');
        $('#kaWie').innerHTML = d.aangemeld.length ? d.aangemeld.map(x =>
          '<div class="task"><span class="ic">'+(x.waar==='thuis'?'':'')+'</span><div class="t"><b>'+esc(x.naam)+'</b><span>'+esc(x.kamer)+'</span></div></div>').join('')
          : '<div style="color:var(--soft);font-size:0.8rem;">'+T('pd.ka.niemand','Nog niemand aangemeld.')+'</div>';
      } catch(e){}
    };
    const laadChat = async () => {
      try {
        const kamer = kaDienst ? kaDienst.kamer : $('#kaKamer').value;
        if (!kamer) return;
        const d = await kaApi('kachat', { kamer });
        $('#kaChat').innerHTML = d.berichten.length ? d.berichten.slice(-25).map(m =>
          '<div style="padding:0.25rem 0;border-bottom:1px solid var(--line);"><b style="color:var(--gold);">'+esc(m.naam)+'</b> '+esc(m.tekst||'')+(m.foto?' ':'')+'</div>').join('')
          : '<div style="color:var(--soft);font-size:0.8rem;">'+T('pd.ka.stil','Nog stil hier.')+'</div>';
        $('#kaChat').scrollTop = $('#kaChat').scrollHeight;
      } catch(e){}
    };
    $('#kaMeldGo').addEventListener('click', async () => {
      $('#kaMFout').textContent = '';
      try {
        const d = await kaApi('dienst/in', { naam: $('#kaNaam').value, kamer: $('#kaKamer').value, waar: $('#kaWaar').value });
        kaDienst = d.dienst;
        try { localStorage.setItem('rtg_kantoor_dienst', JSON.stringify(kaDienst)); localStorage.setItem('rtg_kantoor_naam', kaDienst.naam); } catch(e){}
        toonDienst(); laadWie();
      } catch(e){ $('#kaMFout').textContent = e.message; }
    });
    $('#kaAfmeld').addEventListener('click', async () => {
      try { await kaApi('dienst/uit', { id: kaDienst.id }); } catch(e){}
      kaDienst = null; try { localStorage.removeItem('rtg_kantoor_dienst'); } catch(e){}
      toonDienst(); laadWie();
    });
    const stuur = async () => {
      try {
        await kaApi('kachat/stuur', { kamer: kaDienst ? kaDienst.kamer : $('#kaKamer').value, naam: (kaDienst && kaDienst.naam) || $('#kaNaam').value || T('pd.ka.collega','collega'), tekst: $('#kaTekst').value });
        $('#kaTekst').value = ''; laadChat();
      } catch(e){}
    };
    $('#kaStuur').addEventListener('click', stuur);
    $('#kaTekst').addEventListener('keydown', e => { if (e.key === 'Enter') stuur(); });
    toonDienst(); laadWie(); laadChat();
    kantoorStop();
    kaTimer = setInterval(() => { if (!document.hidden && document.getElementById('kaChat')) { laadWie(); laadChat(); } else kantoorStop(); }, 8000);
  }

  function enter(){
    $('#gate').style.display = 'none';
    $('#app').classList.add('active');
    $('#meName').textContent = me.name;
    const bedrijfNaam = (BEDRIJVEN[code] && BEDRIJVEN[code].name) || (state && state.supplier && state.supplier.name) || code;
    $('#meSub').textContent = bedrijfNaam + ' · ' + (me.role==='manager'?'Manager':T('pd.staff','Medewerker'));
    renderAll();
    laadZaken().then(renderAll);
    laadZorgbalie();
    laadMeldkamerPda();
    startStream();
    // de moedertaal van dit personeelslid: het hele scherm en de taken volgen
    if (window.MoederTaal) MoederTaal.start((p, b) => API.call(p, b), renderAll);
  }
  function renderAll(){ renderToday(); renderRooster(); renderTaken(); renderKeuken(); renderKamers(); renderHulp(); renderRitten(); renderBezorgen(); renderEntree(); renderWinkel(); renderVaart(); renderVerkoop(); renderBevPda(); renderBoer(); renderGebouwPda(); renderMarinaPda(); renderPolisPda(); renderZorgbalie(); renderMeldkamerPda(); renderBorden(); renderTeam(); }

  /* ---- Borden: hetzelfde werkbord als in de leverancier-app (shared/borden.js) ---- */
  let pdBordenUI = null;
  function renderBorden(){
