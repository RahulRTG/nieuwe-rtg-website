  /* ---- backoffice, vervolg van deel 01 ----
     Geknipt op een TOP-NIVEAU grens binnen dezelfde IIFE: de delen worden
     achter elkaar geplakt, dus het resultaat is letter voor letter hetzelfde
     bestand. Geknipt omdat deel 01 door de 10 KB van keuringsregel 13 ging
     nadat de bewaarverzoek-knop erbij kwam. */
  // ---- aanmeldingen per pas: de AI deed alles, alleen ja/nee is aan het personeel ----
  async function loadAanmeldingen(){
    const el = document.getElementById('aanmeldingen'); if (!el) return;
    let lijst = [];
    try { lijst = (await call('/aanmelding/lijst', { status: 'in behandeling' })).aanmeldingen || []; } catch(e){ return; }
    el.innerHTML = lijst.length ? lijst.map(a => {
      const gedaan = (a.reis || []).map(s => s.naam).join(' · ');
      const uitnod = a.viaUitnodiging ? ' <span style="color:var(--gold);font-size:0.7rem;">op uitnodiging</span>' : '';
      return '<div class="vrow" data-id="'+a.id+'">' +
        '<div class="vi"><div class="nm">'+escHtml(a.naam)+' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(a.pasNaam)+'</span>'+uitnod+'</div>' +
          '<div class="sub">'+escHtml(a.contact||'')+'</div>' +
          '<div class="sub" style="color:var(--soft);">'+T('bo.aanmklaar','AI klaar')+': '+escHtml(gedaan)+'</div></div>' +
        '<button class="vbtn ok" data-ok>'+T('bo.accept','Accepteren')+'</button>' +
        '<button class="vbtn no" data-no>'+T('bo.reject','Afwijzen')+'</button>' +
      '</div>';
    }).join('') : '<div class="empty">'+T('bo.noaanm','Geen openstaande aanmeldingen.')+'</div>';
    el.querySelectorAll('.vrow').forEach(row => {
      const id = row.dataset.id;
      row.querySelector('[data-ok]').addEventListener('click', () => beslisAanm(id, 'geaccepteerd'));
      row.querySelector('[data-no]').addEventListener('click', () => beslisAanm(id, 'afgewezen'));
    });
    // de lopende lidmaatschapsbetalingen: na een akkoord loopt de bijdrage 12
    // maanden automatisch, met de 30%-foundationsplit (20% lokaal, 10% RTF).
    try {
      const b = await call('/aanmelding/betalingen', {});
      const eur = n => '€ ' + (Math.round(Number(n))).toLocaleString('nl-NL');
      if (b && b.aantalLeden) {
        el.insertAdjacentHTML('beforeend',
          '<div style="margin-top:.7rem;border-top:1px solid var(--line,#2a2a2a);padding-top:.6rem;font-size:0.8rem;color:var(--soft);line-height:1.7;">' +
          '<b style="color:var(--txt);">'+b.aantalLeden+'</b> '+T('bo.aanmlopend','lopende lidmaatschap(pen), 12 maanden automatisch.')+'<br>' +
          T('bo.aanmnaarfound','Per jaar naar de RTFoundation')+': <b style="color:var(--gold);">'+eur(b.totaal.foundation)+'</b> ('+
          T('bo.aanmlokaal','20% lokaal')+' '+eur(b.totaal.lokaal)+' &middot; '+T('bo.aanmrtf','10% RTF')+' '+eur(b.totaal.rtf)+')</div>');
      }
    } catch(e){}
  }
  async function beslisAanm(id, besluit){
    try { await call('/aanmelding/beslis', { id, besluit }); } catch(e){ alert(e.message); return; }
    loadAanmeldingen();
  }

