/* het boekland van een zakelijk lid */
    if (user.tier !== 'business'){ wrap.innerHTML = ''; return; }
    let land = 'NL';
    try { land = localStorage.getItem('rtg_boekland') || 'NL'; } catch(e){}
    const landen = [['NL','Nederland'],['BE','Belgie'],['DE','Duitsland'],['FR','Frankrijk'],['ES','Spanje'],['JP','Japan']];
    wrap.innerHTML = '<div style="margin-top:1rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:1rem 1.1rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold);">' + T('bh2.h','AI-boekhouder · Business Pass') + '</div>' +
      '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem;line-height:1.5;">' + T('bh2.s','Kent per land de aftrekregels voor uw zakelijke reiskosten. Uw facturen staan al boekhoudklaar, met afboekcode en btw-specificatie.') + '</div>' +
      '<div style="display:flex;gap:0.5rem;margin-top:0.7rem;">' +
      '<select id="bhLand" style="background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.55rem;color:var(--txt);font-family:inherit;">' +
      landen.map(l => '<option value="' + l[0] + '"' + (l[0] === land ? ' selected' : '') + '>' + l[1] + '</option>').join('') + '</select>' +
      '<input id="bhQ" placeholder="' + T('bh2.ph','Bijv. kan ik dit diner terugvorderen?') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.55rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.8rem;">' +
      '<button id="bhGo" style="background:var(--knop);color:var(--knop-txt);border:none;border-radius:0;padding:0.55rem 0.95rem;font-size:0.74rem;font-weight:600;font-family:inherit;">' + T('bh2.vraag','Vraag') + '</button></div>' +
      '<div id="bhA" style="display:none;margin-top:0.7rem;border:1px solid var(--gold);border-radius:0;padding:0.7rem 0.9rem;font-size:0.78rem;line-height:1.6;color:var(--muted);"></div>' +
      // zzp-belastingtool: jaarwinst in, indicatie van aftrek, belasting en netto uit
      '<div style="margin-top:0.9rem;border-top:1px solid var(--line);padding-top:0.9rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold);">' + T('zzp.h','Zzp-belastingtool') + '</div>' +
      '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem;line-height:1.5;">' + T('zzp.s','Voor zelfstandigen: vul uw verwachte jaarwinst in voor een indicatie van uw belasting, nettowinst en wat u maandelijks opzij zet. Het land volgt de keuze hierboven.') + '</div>' +
      '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;">' +
      '<input id="zzpWinst" type="number" placeholder="' + T('zzp.winstph','Jaarwinst, bijv. 60000') + '" style="flex:1;background:var(--bg);border:1px solid var(--line);border-radius:0;padding:0.55rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.8rem;">' +
      '<button id="zzpGo" style="background:var(--knop);color:var(--knop-txt);border:none;border-radius:0;padding:0.55rem 0.95rem;font-size:0.74rem;font-weight:600;font-family:inherit;">' + T('zzp.reken','Reken') + '</button></div>' +
      '<div style="display:flex;gap:1rem;margin-top:0.5rem;font-size:0.72rem;color:var(--muted);flex-wrap:wrap;">' +
      '<label style="display:flex;align-items:center;gap:0.35rem;"><input type="checkbox" id="zzpUren" checked> ' + T('zzp.uren','Urencriterium (1.225 uur)') + '</label>' +
      '<label style="display:flex;align-items:center;gap:0.35rem;"><input type="checkbox" id="zzpStart"> ' + T('zzp.start','Startersaftrek') + '</label></div>' +
      '<div id="zzpRes" style="display:none;margin-top:0.7rem;border:1px solid var(--line);border-radius:0;padding:0.8rem 0.95rem;font-size:0.76rem;line-height:1.7;color:var(--muted);"></div></div></div>' +
      // Borden: dezelfde werkbord-module als de zaken gebruiken (shared/borden.js)
      '<div style="margin-top:1rem;background:var(--card);border:1px solid var(--line);border-radius:0;padding:1rem 1.1rem;">' +
      '<div style="font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold);">' + T('bd2.h','Borden · uw projecten') + '</div>' +
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
          '<div style="margin-top:0.55rem;padding-top:0.55rem;border-top:1px solid var(--line);color:var(--gold);">' + T('zzp.reserveer','Zet ~') + d.reserveerPct + '% ' + T('zzp.opzij','opzij: ongeveer') + ' ' + eur(d.perMaand) + ' ' + T('zzp.pm','per maand') + '.</div>' +
          '<div class="h-mt50">' + d.regels.map(r => '• ' + r).join('<br>') + '</div>' +
          '<div style="margin-top:0.5rem;font-size:0.64rem;color:var(--soft);">' + T('zzp.disc','Indicatie op jaarbasis; dit is voorlichting, geen bindend fiscaal advies.') + '</div>';
      } catch(e){ box.textContent = e.message; }
    });
  }

  /* ---------- AI ---------- */

  const chatHistory = [];

  function aiOpener(){
    const first = user.full.split(' ')[0];
    const lines = [ (lang()==='en'
      ? ('Good day' + (user.tier === 'business' ? '.' : ', ' + first + '.') + ' Your journey to ' + trip.dest + ' begins in ' + trip.days + ' days. I have already thought ahead:')
      : ('Goedendag' + (user.tier === 'business' ? '.' : ', ' + first + '.') + ' Uw reis naar ' + trip.dest + ' begint over ' + trip.days + ' dagen. Ik heb alvast vooruitgedacht:')) ];
    const open = invoices.filter(i => i.status === 'open');
    if (open.length){
      const sum = open.reduce((s,i) => s + i.netto + i.bijdrage, 0);
      lines.push(lang()==='en'
        ? ('• There ' + (open.length === 1 ? 'is 1 payment' : 'are ' + open.length + ' payments') + ' still open (' + eur(sum) + '). One tap in Payments and it is done.')
        : ('• Er ' + (open.length === 1 ? 'staat nog 1 betaling' : 'staan nog ' + open.length + ' betalingen') + ' open (' + eur(sum) + '). Eén tik in Betalen en het is geregeld.'));
    }
    const pending = trip.items.find(i => i.status === 'req');
    if (pending) lines.push(lang()==='en'
      ? ('• ' + pending.title.replace('Diner, ', 'Your table at ') + ' is still being requested; I am watching for the confirmation.')
      : ('• ' + pending.title.replace('Diner, ', 'Uw tafel bij ') + ' is nog in aanvraag; ik bewaak de bevestiging.'));
    lines.push(T('ai.opener.plan','• Zal ik vast een paklijst en een dagplan voor 14 oktober klaarzetten? Eén "ja" is genoeg.'));
    return lines.join('\n');
  }

  function aiAnswer(q){
    const l = q.toLowerCase().trim();
