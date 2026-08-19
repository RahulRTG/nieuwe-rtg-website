    el.querySelectorAll('[data-dpost]').forEach(elp => {
      const knop = elp.querySelector('.js-dverder');
      if (knop) knop.addEventListener('click', async () => {
        try { await API.call('/supplier/dorp/verder', { id: elp.dataset.dpost }); renderDorp(); } catch(e){ toast(e.message); }
      });
      // afdelingen praten met elkaar: de post reist door, met het spoor erbij
      const stuurKnop = elp.querySelector('.js-dstuur');
      if (stuurKnop) stuurKnop.addEventListener('click', async () => {
        const naar = window.prompt(T('dorp.stuurwaar','Naar welke afdeling?')+' ('+d.afdelingen.map(a=>a.key).join(', ')+')');
        if (!naar) return;
        try {
          const r = await API.call('/supplier/dorp/stuurdoor', { id: elp.dataset.dpost, naar: naar.trim().toLowerCase() });
          const doel = d.afdelingen.find(a => a.key === r.post.afdeling);
          toast((doel?doel.icon+' ':'')+T('dorp.gestuurd','Doorgestuurd naar')+' '+(doel?doel.label:r.post.afdeling)+'.');
          renderDorp();
        } catch(e){ toast(e.message); }
      });
    });
    // de buurt: een tik zet de naam alvast in de wens van de concierge
    el.querySelectorAll('.js-dbuurt').forEach(b => b.addEventListener('click', () => {
      const inp = el.querySelector('#dorpTekst');
      if (inp){ inp.value = T('dorp.regelbij','Regel bij')+' '+b.dataset.naam+' ('+b.dataset.soort+', '+b.dataset.km+' km): '; inp.focus(); }
    }));
    // de leeftijdscheck: de paspoort-bevestiging geeft ja/nee, nooit gegevens
    el.querySelectorAll('.js-dlft').forEach(b => b.addEventListener('click', async () => {
      const inp = el.querySelector('#dorpLftIn'), uit = el.querySelector('#dorpLftUit');
      const codenaam = (inp && inp.value || '').trim();
      if (!codenaam){ toast(T('dorp.lft.leeg','Vul de codenaam van de gast in.')); return; }
      const min = Number(b.dataset.min);
      try {
        const r = await API.call('/supplier/paspoort/vraag', { codenaam, niveau: 'bevestiging', minLeeftijd: min });
        const ok = r.bevestiging && r.bevestiging.voldoetLeeftijd === true;
        uit.innerHTML = ok
          ? '<b style="color:var(--rtg-leesgroen,var(--green,#7ecb8f));font-size:1rem;">'+esc(codenaam)+' '+T('dorp.lft.ja','is')+' '+min+'+</b>'
          : '<b style="color:var(--burgundy,#C23A5E);font-size:1rem;">'+esc(codenaam)+' '+T('dorp.lft.nee','is NIET aantoonbaar')+' '+min+'+</b>';
      } catch(e){ uit.innerHTML = '<b style="color:var(--burgundy,#C23A5E);">'+esc(e.message)+'</b>'; }
    }));
    // het logmoment: een tik en het staat geklokt als afgeronde post
    el.querySelectorAll('.js-dactie').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/dorp/post', { afdeling: dorpKant, waar: '', tekst: b.dataset.tekst, directKlaar: true }); toast(afd.icon+' '+T('dorp.geklokt','Geklokt.')); renderDorp(); }
      catch(e){ toast(e.message); }
    }));
    // de meter van de afdeling: drukte, voorraad, seizoen
    el.querySelectorAll('[data-meter]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/dorp/drukte', { afdeling: dorpKant, stand: b.dataset.meter }); renderDorp(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-dsnel').forEach(b => b.addEventListener('click', () => {
      const inp = el.querySelector('#dorpTekst');
      if (inp){ inp.value = b.dataset.snel+' '; inp.focus(); }
    }));
    const add = el.querySelector('#dorpAdd'); if (add) add.addEventListener('click', async () => {
      const waar = el.querySelector('#dorpWaar').value.trim();
      const tekst = el.querySelector('#dorpTekst').value.trim();
      if (!tekst){ toast(T('dorp.vul','Schrijf kort op wat er speelt.')); return; }
      try { await API.call('/supplier/dorp/post', { afdeling: dorpKant, waar, tekst }); toast(afd.icon+' '+T('dorp.gezet','Staat op de lijst van')+' '+afd.label+'.'); renderDorp(); }
      catch(e){ toast(e.message); }
    });
  }

  // ---- minibar-telling per kamer ----
  let mbRoom = null;       // gekozen kamer
  let mbQty = {};          // artikel-id -> gebruikt aantal
  function renderMinibar(){
    const el = $('#minibarWrap'); if (!el) return;
    const mb = state.minibar;
    if (!mb){ el.innerHTML = ''; return; }
    const rooms = (state.rooms || []).map(r => r.name);
    if (mbRoom && !rooms.includes(mbRoom)) mbRoom = null;

    // telling invoeren
    let html = '<div class="card"><div class="tt-h">' + T('mb.count','Telling invoeren') + '</div>';
    html += '<div class="mb-rooms">' + rooms.map(r => {
      const done = mb.countedToday.includes(r);
      return '<button class="mb-room' + (mbRoom === r ? ' on' : '') + '" data-mbroom="' + r.replace(/"/g,'&quot;') + '">' + (done ? '✓ ' : '') + r + '</button>';
    }).join('') + '</div>';
    if (mbRoom){
      html += '<div style="margin-top:0.8rem;font-size:0.74rem;color:var(--soft);">' + T('mb.howmany','Hoeveel is er gebruikt uit') + ' ' + mbRoom + '?</div>';
      html += mb.catalog.map(m => {
        const q = mbQty[m.id] || 0;
        return '<div class="mb-item"><div class="mi"><b>' + m.name + '</b><span>' + eur(m.price) + '</span></div>' +
          '<div class="qty"><button data-mbmin="' + m.id + '">−</button><b>' + q + '</b><button data-mbplus="' + m.id + '">+</button></div></div>';
      }).join('');
      const total = mb.catalog.reduce((s, m) => s + m.price * (mbQty[m.id] || 0), 0);
      html += '<button class="bigbtn" id="mbSubmit">' + (total > 0
        ? T('mb.register','Registreer telling') + ', ' + eur(total) + ' ' + T('mb.toroom','op de kamer')
        : T('mb.registerzero','Registreer: niets gebruikt')) + '</button>';
    }
    html += '</div>';

    // vandaag-overzicht
    const notCounted = rooms.filter(r => !mb.countedToday.includes(r));
    html += '<div class="card"><div class="tt-h">' + T('mb.today','Vandaag geteld') + ' (' + mb.countedToday.length + '/' + rooms.length + ')</div>' +
      (notCounted.length
        ? '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--amber);">' + T('mb.todo','Nog tellen:') + ' ' + notCounted.join(', ') + '</div>'
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--rtg-leesgroen,var(--green));">✓ ' + T('mb.alldone','Alle kamers zijn vandaag geteld.') + '</div>') +
      (mb.recent.length ? mb.recent.map(e =>
        '<div class="pos-sale"><div><b>' + e.room + '</b><span>' + (e.items.length ? e.items.map(i => i.qty + 'x ' + i.name).join(', ') : T('mb.nothing','niets gebruikt')) + ' · ' + e.actor + ' · ' + timeAgo(e.at) + '</span></div>' +
        '<div class="amt" style="font-family:\'Bodoni Moda\',serif;">' + (e.total ? eur(e.total) : '') + '</div></div>').join('') : '') +
      '</div>';

    // catalogus
    html += '<div class="card"><div class="tt-h">' + T('mb.catalog','Catalogus') + '</div>' +
      mb.catalog.map(m => '<div class="pos-sale"><div><b>' + m.name + '</b></div><div class="row-mid-gap"><span class="amt" style="font-family:\'Bodoni Moda\',serif;">' + eur(m.price) + '</span><button class="rr-del" data-mbdel="' + m.id + '">✕</button></div></div>').join('') +
      '<div class="tt-add"><input id="mbName" placeholder="' + T('mb.newitem','Nieuw artikel') + '" style="flex:2;min-width:110px;"><input id="mbPrice" type="number" inputmode="decimal" placeholder="€" style="flex:1;min-width:60px;"><button id="mbAdd">' + T('team.add','Toevoegen') + '</button></div></div>';

    el.innerHTML = html;
    el.querySelectorAll('[data-mbroom]').forEach(b => b.addEventListener('click', () => { mbRoom = b.dataset.mbroom; mbQty = {}; renderMinibar(); openTab('minibar'); }));
    el.querySelectorAll('[data-mbplus]').forEach(b => b.addEventListener('click', () => { mbQty[b.dataset.mbplus] = (mbQty[b.dataset.mbplus] || 0) + 1; renderMinibar(); openTab('minibar'); }));
    el.querySelectorAll('[data-mbmin]').forEach(b => b.addEventListener('click', () => { mbQty[b.dataset.mbmin] = Math.max(0, (mbQty[b.dataset.mbmin] || 0) - 1); renderMinibar(); openTab('minibar'); }));
    const sub = $('#mbSubmit'); if (sub) sub.addEventListener('click', submitMinibar);
    el.querySelectorAll('[data-mbdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/minibar/item/remove', { id: b.dataset.mbdel }); await refresh(); openTab('minibar'); } catch(e){ toast(e.message); }
    }));
    const add = $('#mbAdd'); if (add) add.addEventListener('click', async () => {
      const name = $('#mbName').value.trim(), price = Number($('#mbPrice').value);
      if (!name || !(price > 0)){ toast(T('mb.fill','Vul een artikel en prijs in.')); return; }
      try { await API.call('/supplier/minibar/item/add', { name, price }); toast(T('mb.added','Artikel toegevoegd.')); await refresh(); openTab('minibar'); } catch(e){ toast(e.message); }
    });
  }
  async function submitMinibar(){
    if (!mbRoom) return;
