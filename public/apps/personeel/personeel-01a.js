  // ---- het kantoorgebouw (Zuidas) op zak: receptie, facilitair, concierge ----
  let pdGeb = null;
  const heeftGebouw = () => !!(state && state.supplier && (state.supplier.caps || []).includes('gebouw'));
  async function laadGebouwPda(){
    if (!heeftGebouw()) return;
    try { pdGeb = await API.call('/supplier/gebouw', {}); } catch(e){ pdGeb = null; }
    renderGebouwPda();
  }
  function renderGebouwPda(){
    const tabBtn = document.getElementById('tabGebouw');
    if (tabBtn) tabBtn.style.display = heeftGebouw() ? '' : 'none';
    const wrap = $('#gebouwPdaWrap'); if (!wrap) return;
    if (!heeftGebouw()){ wrap.innerHTML = ''; return; }
    if (!pdGeb){ wrap.innerHTML = '<div class="card">…</div>'; laadGebouwPda(); return; }
    const d = pdGeb;
    const MELD = { schoonmaak: 'Schoonmaak', onderhoud: 'Onderhoud', catering: 'Catering' };
    const JET = { concierge: 'Concierge', chauffeur: 'Chauffeur', 'jet-transfer': 'Jet-transfer', lounge: 'Executive lounge' };
    let html = '';
    // de receptie: wie staat er voor de balie
    const verwacht = (d.bezoekers||[]).filter(b => b.status !== 'vertrokken');
    html += '<div class="card"><div class="k">'+T('pd.geb.receptie','Receptie')+' ('+verwacht.length+')</div>'+
      (verwacht.length ? verwacht.map(b => '<div class="task"><div class="t"><b>'+esc(b.naam)+'</b><span>'+esc(b.voorWie)+' · '+esc(b.status)+(b.badge?' · '+esc(b.badge):'')+'</span></div>'+
        (b.status==='verwacht' ? '<button class="abtn" data-pgbin="'+b.id+'">'+T('pd.geb.binnen','Binnen')+'</button>' : '<button class="abtn" data-pgweg="'+b.id+'" style="background:var(--card2);color:var(--txt);border:1px solid var(--line);">'+T('pd.geb.weg','Weg')+'</button>')+'</div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.geb.rustig','Geen bezoekers in de rij.')+'</div>')+'</div>';
    // facilitair: de meldingen van het huis
    const open = (d.meldingen||[]).filter(m => m.status !== 'klaar');
    html += '<div class="card"><div class="k">'+T('pd.geb.fac','Facilitair')+' ('+open.length+')</div>'+
      (open.length ? open.map(m => '<div class="task"><div class="t"><b>'+esc(m.tekst)+'</b><span>'+MELD[m.soort]+' · '+T('pd.geb.verd','verdieping')+' '+m.verdieping+' · '+esc(m.status)+'</span></div>'+
        (m.status==='open' ? '<button class="abtn" data-pgmb="'+m.id+'">'+T('pd.geb.pak','Pak op')+'</button>' : '<button class="abtn" data-pgmk="'+m.id+'">'+T('pd.geb.klaar','Klaar')+'</button>')+'</div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.geb.oporde','Het huis is op orde.')+'</div>')+'</div>';
    // valet en de jetset-diensten voor de concierge
    const valet = (d.valet||[]).filter(v => v.status !== 'klaar');
    const jetset = (d.jetset||[]).filter(j => j.status !== 'afgerond');
    html += '<div class="card"><div class="k">'+T('pd.geb.jetset','Concierge en jetset')+' ('+(valet.length+jetset.length)+')</div>'+
      valet.map(v => '<div class="task"><div class="t"><b>'+esc(v.wie)+'</b><span>'+T('pd.geb.valet','valet')+' · '+esc(v.status)+'</span></div>'+
        (v.status==='gevraagd' ? '<button class="abtn" data-pgvv="'+v.id+'">'+T('pd.geb.voorrijden','Voorrijden')+'</button>' : '<button class="abtn" data-pgvk="'+v.id+'">'+T('pd.geb.klaar','Klaar')+'</button>')+'</div>').join('')+
      jetset.map(j => '<div class="task"><div class="t"><b>'+JET[j.soort]+' · '+esc(j.voorWie)+'</b><span>'+esc(j.wens)+' · '+esc(j.moment)+' · '+esc(j.status)+'</span></div>'+
        (j.status==='aangevraagd' ? '<button class="abtn" data-pgjb="'+j.id+'">'+T('pd.geb.bevestig','Bevestig')+'</button>' : '<button class="abtn" data-pgja="'+j.id+'">'+T('pd.geb.afgerond','Afgerond')+'</button>')+'</div>').join('')+
      ((valet.length+jetset.length) ? '' : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.geb.geenjetset','Geen open verzoeken.')+'</div>')+'</div>';
    wrap.innerHTML = html;
    const doe = (sel, body) => wrap.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', async () => {
      const { pad, data } = body(b.dataset);
      try { await API.call(pad, data); laadGebouwPda(); } catch(e){ toast(e.message); }
    }));
    doe('data-pgbin', ds => ({ pad: '/supplier/gebouw/bezoeker/status', data: { id: ds.pgbin, status: 'binnen' } }));
    doe('data-pgweg', ds => ({ pad: '/supplier/gebouw/bezoeker/status', data: { id: ds.pgweg, status: 'vertrokken' } }));
    doe('data-pgmb', ds => ({ pad: '/supplier/gebouw/melding/status', data: { id: ds.pgmb, status: 'bezig' } }));
    doe('data-pgmk', ds => ({ pad: '/supplier/gebouw/melding/status', data: { id: ds.pgmk, status: 'klaar' } }));
    doe('data-pgvv', ds => ({ pad: '/supplier/gebouw/valet/status', data: { id: ds.pgvv, status: 'voorgereden' } }));
    doe('data-pgvk', ds => ({ pad: '/supplier/gebouw/valet/status', data: { id: ds.pgvk, status: 'klaar' } }));
    doe('data-pgjb', ds => ({ pad: '/supplier/gebouw/jetset/status', data: { id: ds.pgjb, status: 'bevestigd' } }));
    doe('data-pgja', ds => ({ pad: '/supplier/gebouw/jetset/status', data: { id: ds.pgja, status: 'afgerond' } }));
  }

