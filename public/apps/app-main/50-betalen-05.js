      // Borden: dezelfde werkbord-module als de zaken gebruiken (shared/borden.js)
      '<div style="margin-top:1rem;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1rem 1.1rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold);">📋 ' + T('bd2.h','Borden · uw projecten') + '</div>' +
      '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem;line-height:1.5;">' + T('bd2.s','Hetzelfde werkbord als in de RTG-bedrijfsapps: lijsten en kaarten voor uw eigen projecten en administratie.') + '</div>' +
      '<div id="lidBordenWrap"></div></div>';
    if (window.BordenUI){
      if (lidBordenUI) lidBordenUI = null; // het element is zojuist opnieuw opgebouwd
      lidBordenUI = BordenUI.mount($('#lidBordenWrap'), {
        laad: () => API.call('/member/borden'),
        doe: b => API.call('/member/bord', b),
        teamleden: null,
        kanBeheren: () => true,
        T, toast
      });
    }
    const go = $('#bhGo');
    if (go) go.addEventListener('click', async () => {
      const q = $('#bhQ').value.trim();
      if (!q) return;
      try { localStorage.setItem('rtg_boekland', $('#bhLand').value); } catch(e){}
      const box = $('#bhA');
      box.style.display = 'block';
      box.textContent = '…';
      try { box.textContent = (await API.call('/member/accountant', { question: q, land: $('#bhLand').value })).answer; }
      catch(e){ box.textContent = e.message; }
    });
    const qi = $('#bhQ');
    if (qi) qi.addEventListener('keydown', e => { if (e.key === 'Enter' && go) go.click(); });
    const zg = $('#zzpGo');
    if (zg) zg.addEventListener('click', async () => {
      const winst = Math.round(Number($('#zzpWinst').value));
      const box = $('#zzpRes');
      if (!(winst > 0)) { toast(T('zzp.leeg','Vul eerst uw verwachte jaarwinst in.')); return; }
      try { localStorage.setItem('rtg_boekland', $('#bhLand').value); } catch(e){}
      box.style.display = 'block';
      box.textContent = '…';
      try {
        const d = await API.call('/member/zzp', { winst, land: $('#bhLand').value, urencriterium: $('#zzpUren').checked, starter: $('#zzpStart').checked });
        const rij = (l, v, sterk) => '<div style="display:flex;justify-content:space-between;gap:0.8rem;"><span>' + l + '</span><span style="flex-shrink:0;' + (sterk ? 'color:var(--txt);font-weight:600;' : '') + '">' + v + '</span></div>';
        box.innerHTML =
          '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);margin-bottom:0.35rem;">' + d.regime + ' · ' + d.landNaam + '</div>' +
          rij(T('zzp.winst','Jaarwinst'), eur(d.winst)) +
          d.posten.map(p2 => rij(p2.label, (p2.bedrag < 0 ? '- ' : '') + eur(Math.abs(p2.bedrag)))).join('') +
          rij(T('zzp.belastbaar','Belastbaar (na aftrek)'), eur(d.belastbaar)) +
          rij(T('zzp.teBetalen','Te betalen (indicatie)'), eur(d.belasting), true) +
          rij(T('zzp.netto','Netto over'), eur(d.netto), true) +
          '<div style="margin-top:0.55rem;padding-top:0.55rem;border-top:1px solid var(--line);color:var(--gold);">💡 ' + T('zzp.reserveer','Zet ~') + d.reserveerPct + '% ' + T('zzp.opzij','opzij: ongeveer') + ' ' + eur(d.perMaand) + ' ' + T('zzp.pm','per maand') + '.</div>' +
          '<div style="margin-top:0.5rem;">' + d.regels.map(r => '• ' + r).join('<br>') + '</div>' +
          '<div style="margin-top:0.5rem;font-size:0.64rem;color:var(--soft);">' + T('zzp.disc','Indicatie op jaarbasis; dit is voorlichting, geen bindend fiscaal advies.') + '</div>';
      } catch(e){ box.textContent = e.message; }
    });
  }

