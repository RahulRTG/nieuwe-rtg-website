/* Het werkbord (Trello-stijl), als gedeelde module voor alle RTG-apps:
   de leverancier-app, de PDA en de Business Pass gebruiken exact dezelfde
   weergave en bediening, zodat niemand hoeft te wennen.

   Gebruik:
     BordenUI.mount(container, {
       laad: () => API...('/borden'),          // -> { borden: [...] }
       doe:  (body) => API...('/bord', body),  // acties: maak, hernoem, leden, weg,
                                               // lijst, lijst-bewerk, kaart,
                                               // kaart-bewerk, kaart-zet, kaart-weg
       teamleden: () => [{id,name}] | null,    // null = geen ledenkeuze (Business Pass)
       kanBeheren: () => bool,                 // borden verwijderen / groep wijzigen
       T, toast
     });
   Roep .refresh() aan bij een SSE-sync; het open bord blijft open. */
(function (w) {
  'use strict';
  var doc = w.document;
  if (doc && doc.documentElement && !doc.documentElement.hasAttribute('data-ds') && !doc.getElementById('rtgDsRuntimeCss')) {
    var link = doc.createElement('link');
    link.id = 'rtgDsRuntimeCss'; link.rel = 'stylesheet'; link.href = '/ds/rtg-ds.css';
    doc.head.appendChild(link);
  }
  function esc(x){ return String(x == null ? '' : x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  var VUILNIS = '<svg class="bd-vuil" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>';

  const init = n => String(n||'?').trim().split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();

  function mount(el, opt){
    el.classList.add('ds-borden');
    const T = opt.T || ((k, nl) => nl);
    const toast = opt.toast || (() => {});
    let borden = [], open = null, groepOpen = false;

    async function doe(body){
      try { await opt.doe(body); await laad(); }
      catch (e) { toast(e.message); }
    }
    async function laad(){
      try { borden = (await opt.laad()).borden || []; } catch (e) { borden = []; }
      if (open && !borden.find(b => b.id === open)) open = null;
      if (!open && borden.length) open = borden[0].id;
      render();
    }

    function kaartHtml(b, l, k, li){
      const laat = k.due && !k.klaar && k.due < new Date().toISOString().slice(0,10);
      const team = opt.teamleden ? (opt.teamleden() || []) : [];
      const namen = (k.leden||[]).map(id => { const m = team.find(t=>t.id===id); return m ? m.name : null; }).filter(Boolean);
      return '<div class="bd-kaart'+(k.klaar?' klaar':'')+'">'+
        '<b>'+esc(k.titel)+'</b>'+
        (k.notitie ? '<div class="bd-notitie">'+esc(k.notitie)+'</div>' : '')+
        '<div class="mt">'+
          (k.due ? '<span class="bd-due'+(laat?' laat':'')+'">'+esc(k.due)+(laat?' · '+T('bd.laat','te laat'):'')+'</span>' : '')+
          namen.map(n => '<span class="bd-av" title="'+esc(n)+'">'+esc(init(n))+'</span>').join('')+
        '</div>'+
        '<div class="bd-knopjes">'+
          (li>0 ? '<button data-zet="'+k.id+'" data-naar="'+b.lijsten[li-1].id+'" title="'+T('bd.links','naar links')+'">◀</button>' : '')+
          (li<b.lijsten.length-1 ? '<button data-zet="'+k.id+'" data-naar="'+b.lijsten[li+1].id+'" title="'+T('bd.rechts','naar rechts')+'">▶</button>' : '')+
          '<button data-klaar="'+k.id+'" data-nu="'+(k.klaar?'0':'1')+'">'+(k.klaar?'↺':'✓')+'</button>'+
          '<button data-bewerk="'+k.id+'">✎</button>'+
          '<button data-kweg="'+k.id+'" title="'+T('bd.weg2','verwijderen')+'">'+VUILNIS+'</button>'+
        '</div></div>';
    }

    function render(){
      const b = borden.find(x => x.id === open) || null;
      const team = opt.teamleden ? (opt.teamleden() || []) : null;
      let html = '<div class="bd-chips">'+
        borden.map(x => '<button class="bd-chip'+(x.id===open?' aan':'')+'" data-open="'+x.id+'">'+esc(x.naam)+
          ((x.leden||[]).length?' · '+x.leden.length+' '+T('bd.leden','leden'):'')+'</button>').join('')+
        '<button class="bd-chip" data-nieuw>＋ '+T('bd.nieuw','Nieuw bord')+'</button></div>';
      if (b){
        if (opt.kanBeheren && opt.kanBeheren()){
          html += '<div class="bd-groep">'+
            (team && team.length ? T('bd.groep','Groep (leeg = hele team):')+' '+
              team.map(m => '<label><input type="checkbox" data-lid="'+m.id+'"'+((b.leden||[]).includes(m.id)?' checked':'')+'> '+esc(m.name)+'</label>').join('') : '')+
            '<button class="bd-chip bd-bweg" data-bweg>'+T('bd.weg','Bord weg')+'</button></div>';
        }
        html += '<div class="bd-kolommen">'+
          b.lijsten.map((l, li) => '<div class="bd-kolom"><div class="kop"><span>'+esc(l.naam)+' · '+l.kaarten.length+'</span>'+
            (!l.kaarten.length?'<button class="bd-kopknop" data-lweg="'+l.id+'" title="'+T('bd.weg2','verwijderen')+'">'+VUILNIS+'</button>':'')+'</div>'+
            l.kaarten.map(k => kaartHtml(b, l, k, li)).join('')+
            '<button class="bd-add" data-plus="'+l.id+'">＋ '+T('bd.kaart','Kaart')+'</button>'+
          '</div>').join('')+
          '<div class="bd-kolom"><button class="bd-add" data-lijst>＋ '+T('bd.lijst','Lijst')+'</button></div>'+
        '</div>';
      } else {
        html += '<div class="bd-leeg">'+T('bd.leeg','Nog geen borden. Maak het eerste bord voor uw team of project.')+'</div>';
      }
      el.innerHTML = html;
      bind(b);
    }
/* de knoppen op een bord binden */
    function bind(b){
      el.querySelectorAll('[data-open]').forEach(x => x.addEventListener('click', () => { open = x.dataset.open; render(); }));
      const nieuw = el.querySelector('[data-nieuw]');
      if (nieuw) nieuw.addEventListener('click', async () => {
        const naam = prompt(T('bd.naamq','Naam van het bord?'), '');
        if (naam) { await doe({ actie: 'maak', naam }); }
      });
      if (!b) return;
      el.querySelectorAll('[data-lid]').forEach(x => x.addEventListener('change', () => {
        const leden = [...el.querySelectorAll('[data-lid]')].filter(c => c.checked).map(c => parseInt(c.dataset.lid, 10));
        doe({ actie: 'leden', id: b.id, leden });
      }));
      const bweg = el.querySelector('[data-bweg]');
      if (bweg) bweg.addEventListener('click', () => { if (confirm(T('bd.wegq','Dit bord en alle kaarten verwijderen?'))) doe({ actie: 'weg', id: b.id }); });
      const lijst = el.querySelector('[data-lijst]');
      if (lijst) lijst.addEventListener('click', () => {
        const naam = prompt(T('bd.lijstq','Naam van de lijst?'), '');
        if (naam) doe({ actie: 'lijst', id: b.id, naam });
      });
      el.querySelectorAll('[data-lweg]').forEach(x => x.addEventListener('click', () => doe({ actie: 'lijst-bewerk', id: b.id, lijstId: x.dataset.lweg, weg: true })));
      el.querySelectorAll('[data-plus]').forEach(x => x.addEventListener('click', () => {
        const titel = prompt(T('bd.kaartq','Wat moet er gebeuren?'), '');
        if (titel) doe({ actie: 'kaart', id: b.id, lijstId: x.dataset.plus, titel });
      }));
      el.querySelectorAll('[data-zet]').forEach(x => x.addEventListener('click', () => doe({ actie: 'kaart-zet', id: b.id, kaartId: x.dataset.zet, naarLijstId: x.dataset.naar })));
      el.querySelectorAll('[data-klaar]').forEach(x => x.addEventListener('click', () => doe({ actie: 'kaart-bewerk', id: b.id, kaartId: x.dataset.klaar, klaar: x.dataset.nu === '1' })));
      el.querySelectorAll('[data-kweg]').forEach(x => x.addEventListener('click', () => doe({ actie: 'kaart-weg', id: b.id, kaartId: x.dataset.kweg })));
      el.querySelectorAll('[data-bewerk]').forEach(x => x.addEventListener('click', () => {
        const k = b.lijsten.flatMap(l => l.kaarten).find(k2 => k2.id === x.dataset.bewerk);
        if (!k) return;
        const titel = prompt(T('bd.titelq','Titel:'), k.titel); if (titel === null) return;
        const notitie = prompt(T('bd.notq','Notitie (mag leeg):'), k.notitie || ''); if (notitie === null) return;
        const due = prompt(T('bd.dueq','Deadline (JJJJ-MM-DD, leeg = geen):'), k.due || ''); if (due === null) return;
        const body = { actie: 'kaart-bewerk', id: b.id, kaartId: k.id, titel, notitie, due };
        if (opt.teamleden){
          const team = opt.teamleden() || [];
          if (team.length){
            const wie = prompt(T('bd.wieq','Wie erop? Nummers met komma ertussen:\n') + team.map(m => m.id + ' = ' + m.name).join('\n'), (k.leden||[]).join(','));
            if (wie !== null) body.leden = wie.split(',').map(s => parseInt(s.trim(), 10)).filter(Number.isFinite);
          }
        }
        doe(body);
      }));
    }

    laad();
    return { refresh: laad };
  }

  w.BordenUI = { mount };
})(window);
