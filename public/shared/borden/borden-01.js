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
  function esc(x){ return String(x == null ? '' : x).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

  function stijl(){
    if (document.getElementById('bordStijl')) return;
    const s = document.createElement('style');
    s.id = 'bordStijl';
    s.textContent =
      '.bd-chips{display:flex;gap:0.45rem;flex-wrap:wrap;margin-top:0.8rem;}' +
      '.bd-chip{background:var(--card,#151312);border:1px solid var(--line,rgba(255,255,255,0.09));border-radius:999px;padding:0.45rem 0.9rem;font-size:0.76rem;color:var(--txt,#F4F1EC);cursor:pointer;}' +
      '.bd-chip.aan{border-color:var(--gold,#A98F1C);color:var(--gold,#A98F1C);font-weight:600;}' +
      '.bd-kolommen{display:flex;gap:0.7rem;overflow-x:auto;padding:0.9rem 0 1rem;align-items:flex-start;}' +
      '.bd-kolom{background:var(--card,#151312);border:1px solid var(--line,rgba(255,255,255,0.09));border-radius:14px;padding:0.7rem;min-width:230px;max-width:260px;flex-shrink:0;}' +
      '.bd-kolom .kop{display:flex;justify-content:space-between;align-items:center;gap:0.4rem;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft,rgba(244,241,236,0.62));font-weight:700;padding:0 0.2rem 0.5rem;}' +
      '.bd-kaart{background:var(--card2,#1B1817);border:1px solid var(--line,rgba(255,255,255,0.09));border-radius:10px;padding:0.55rem 0.65rem;margin-bottom:0.45rem;font-size:0.82rem;}' +
      '.bd-kaart.klaar{opacity:0.55;}.bd-kaart.klaar b{text-decoration:line-through;}' +
      '.bd-kaart b{display:block;font-weight:600;line-height:1.35;}' +
      '.bd-kaart .mt{display:flex;gap:0.35rem;align-items:center;flex-wrap:wrap;margin-top:0.35rem;font-size:0.62rem;color:var(--soft,rgba(244,241,236,0.62));}' +
      '.bd-due{border:1px solid var(--line,rgba(255,255,255,0.09));border-radius:999px;padding:0.1rem 0.45rem;}' +
      '.bd-due.laat{color:#FF8589;border-color:rgba(229,72,77,0.5);}' +
      '.bd-av{display:inline-flex;align-items:center;justify-content:center;background:var(--card,#151312);border:1px solid var(--gold,#A98F1C);color:var(--gold,#A98F1C);border-radius:50%;width:1.25rem;height:1.25rem;font-size:0.55rem;font-weight:700;}' +
      '.bd-knopjes{display:flex;gap:0.25rem;margin-top:0.4rem;}' +
      '.bd-knopjes button{background:none;border:1px solid var(--line,rgba(255,255,255,0.09));border-radius:7px;color:var(--soft,rgba(244,241,236,0.62));font-size:0.68rem;padding:0.18rem 0.42rem;cursor:pointer;}' +
      '.bd-knopjes button:hover{color:var(--txt,#F4F1EC);border-color:var(--gold,#A98F1C);}' +
      '.bd-add{width:100%;background:none;border:1px dashed var(--line,rgba(255,255,255,0.16));border-radius:10px;color:var(--soft,rgba(244,241,236,0.62));font-size:0.76rem;padding:0.5rem;cursor:pointer;}' +
      '.bd-in{width:100%;background:var(--card2,#1B1817);border:1px solid var(--line,rgba(255,255,255,0.09));border-radius:10px;padding:0.5rem 0.6rem;font-size:0.82rem;color:var(--txt,#F4F1EC);outline:none;margin-bottom:0.4rem;}' +
      '.bd-groep{font-size:0.72rem;color:var(--soft,rgba(244,241,236,0.62));margin-top:0.3rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;}' +
      '.bd-groep label{display:inline-flex;gap:0.25rem;align-items:center;cursor:pointer;}';
    document.head.appendChild(s);
  }
  const init = n => String(n||'?').trim().split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();

  function mount(el, opt){
    stijl();
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
        (k.notitie ? '<div style="font-size:0.72rem;color:var(--soft);margin-top:0.2rem;white-space:pre-wrap;">'+esc(k.notitie)+'</div>' : '')+
        '<div class="mt">'+
          (k.due ? '<span class="bd-due'+(laat?' laat':'')+'">📅 '+esc(k.due)+(laat?' · '+T('bd.laat','te laat'):'')+'</span>' : '')+
          namen.map(n => '<span class="bd-av" title="'+esc(n)+'">'+esc(init(n))+'</span>').join('')+
        '</div>'+
        '<div class="bd-knopjes">'+
          (li>0 ? '<button data-zet="'+k.id+'" data-naar="'+b.lijsten[li-1].id+'" title="'+T('bd.links','naar links')+'">◀</button>' : '')+
          (li<b.lijsten.length-1 ? '<button data-zet="'+k.id+'" data-naar="'+b.lijsten[li+1].id+'" title="'+T('bd.rechts','naar rechts')+'">▶</button>' : '')+
          '<button data-klaar="'+k.id+'" data-nu="'+(k.klaar?'0':'1')+'">'+(k.klaar?'↺':'✓')+'</button>'+
          '<button data-bewerk="'+k.id+'">✎</button>'+
          '<button data-kweg="'+k.id+'">🗑</button>'+
        '</div></div>';
    }

    function render(){
      const b = borden.find(x => x.id === open) || null;
      const team = opt.teamleden ? (opt.teamleden() || []) : null;
      let html = '<div class="bd-chips">'+
        borden.map(x => '<button class="bd-chip'+(x.id===open?' aan':'')+'" data-open="'+x.id+'">'+esc(x.naam)+
          ((x.leden||[]).length?' · '+x.leden.length+' 👤':'')+'</button>').join('')+
        '<button class="bd-chip" data-nieuw>＋ '+T('bd.nieuw','Nieuw bord')+'</button></div>';
      if (b){
        if (opt.kanBeheren && opt.kanBeheren()){
          html += '<div class="bd-groep">'+
            (team && team.length ? T('bd.groep','Groep (leeg = hele team):')+' '+
              team.map(m => '<label><input type="checkbox" data-lid="'+m.id+'"'+((b.leden||[]).includes(m.id)?' checked':'')+'> '+esc(m.name)+'</label>').join('') : '')+
            '<button class="bd-chip" data-bweg style="margin-left:auto;">🗑 '+T('bd.weg','Bord weg')+'</button></div>';
        }
        html += '<div class="bd-kolommen">'+
          b.lijsten.map((l, li) => '<div class="bd-kolom"><div class="kop"><span>'+esc(l.naam)+' · '+l.kaarten.length+'</span>'+
            (!l.kaarten.length?'<button data-lweg="'+l.id+'" style="background:none;border:none;color:var(--soft);cursor:pointer;">🗑</button>':'')+'</div>'+
            l.kaarten.map(k => kaartHtml(b, l, k, li)).join('')+
            '<button class="bd-add" data-plus="'+l.id+'">＋ '+T('bd.kaart','Kaart')+'</button>'+
          '</div>').join('')+
          '<div class="bd-kolom"><button class="bd-add" data-lijst>＋ '+T('bd.lijst','Lijst')+'</button></div>'+
        '</div>';
      } else {
        html += '<div style="margin-top:1rem;font-size:0.84rem;color:var(--soft);">'+T('bd.leeg','Nog geen borden. Maak het eerste bord voor uw team of project.')+'</div>';
      }
      el.innerHTML = html;
      bind(b);
    }

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
