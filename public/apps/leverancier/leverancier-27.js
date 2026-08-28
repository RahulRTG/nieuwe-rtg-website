/* de weekbeschikbaarheid opslaan */
    if (opslaan) opslaan.addEventListener('click', async () => {
      const dagen = {};
      el.querySelectorAll('[data-wvdag]').forEach(rij => {
        const d = rij.dataset.wvdag;
        const knop = rij.querySelector('[data-wvdicht]');
        if (knop.textContent.trim() === T('wv.dicht','Dicht')) { dagen[d] = { dicht: true }; return; }
        const van = rij.querySelector('.wv-van').value, tot = rij.querySelector('.wv-tot').value;
        dagen[d] = (van && tot) ? { van, tot } : { dicht: false }; // leeg = weer altijd open
      });
      const perStaff = {};
      el.querySelectorAll('[data-wvps]').forEach(rij => {
        perStaff[rij.dataset.wvps] = {
          stand: rij.querySelector('.wvps-stand').value,
          van: rij.querySelector('.wvps-van').value, tot: rij.querySelector('.wvps-tot').value,
          thuiswerk: rij.querySelector('[data-wvthuis]').dataset.wvthuis === '1'
        };
      });
      try { await API.call('/supplier/werkvenster', { dagen, perStaff }); toast(''+T('wv.bewaard','Werkvenster bewaard.')); boData = null; await refresh(); }
      catch(e){ toast(e.message); }
    });
  }
  // ---- navigatie: vijf vaste knoppen, de rest overzichtelijk onder "Meer" ----
  const MAIN_TABS = ['home', 'kassa', 'ai', 'gchat', 'meer'];
  // de spiegel-koppeling met het tweede scherm: welke werkplek hoort bij welke tab
  const SPIEGEL_WERK = { keuken: 'keuken', bar: 'bar', bediening: 'serveren', kassa: 'kassa',
    tafels: 'gasten', gasten: 'gasten', rooms: 'kamers', dorp: 'serveren' };
  let spiegelKanaal = null;
  try { spiegelKanaal = new BroadcastChannel('rtg-scherm'); } catch (e) {}
  function zendSpiegel(tab){
    const werk = SPIEGEL_WERK[tab]; if (!werk || !spiegelKanaal) return;
    try { spiegelKanaal.postMessage({ type: 'werkplek', werk }); } catch (e) {}
  }
  function buildTabs(){
    $('#tabbar').innerHTML = MAIN_TABS.map((k,i) =>
      '<button data-tab="'+k+'"'+(i===0?' class="active"':'')+'><svg viewBox="0 0 24 24">'+TABDEF[k].svg+'</svg>'+T('tab.'+k, TABDEF[k].label)+'</button>'
    ).join('');
    document.querySelectorAll('.tabbar button').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab, true)));
  }
  function openTab(tab, focusView){
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view===tab));
    const hi = MAIN_TABS.includes(tab) ? tab : 'meer';
    document.querySelectorAll('.tabbar button').forEach(b => {
      const on = b.dataset.tab===hi;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); // schermlezer meldt de actieve tab
    });
    $('#content').scrollTop = 0;
    // het tweede scherm (spiegel-modus) volgt de werkplek van dit hoofdscherm:
    // we zenden de best passende werkplek uit over een BroadcastChannel.
    zendSpiegel(tab);
    // Alleen bij een echte klik de focus naar de nieuwe weergave verplaatsen, zodat
    // toetsenbord- en schermlezergebruikers meelopen (niet bij programmatische wissels).
    if (focusView){
      const v = document.querySelector('.view[data-view="'+tab+'"]');
      if (v){ v.setAttribute('tabindex','-1'); v.focus({ preventScroll: true }); }
    }
  }
  // ---- vastgoed: de slimme makelaars-backoffice ----
  let vg = null;
  const PAND_ST = { 'beschikbaar':'beschikbaar', 'onder-optie':'onder optie', 'verkocht':'verkocht', 'verhuurd':'verhuurd' };
  async function laadVastgoed(){
    if (!has('vastgoed') || !API.live) return;
    try { vg = await API.call('/supplier/vastgoed/overzicht', {}); } catch(e){ vg = { stats:{}, panden:[], aanbiedingen:[], bezichtigingen:[], biedingen:[] }; }
    renderVastgoed();
  }
  const geld = n => '\u20AC ' + Number(n||0).toLocaleString('nl-NL');
  function renderVastgoed(){
    const el = $('#vgWrap'); if (!el) return;
    if (!has('vastgoed')){ el.innerHTML = ''; return; }
    if (!vg){ el.innerHTML = '<div class="empty">\u2026</div>'; laadVastgoed(); return; }
    const canEdit = actor().manager;
    const st = vg.stats || {};
    const sel = 'style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"';
    let html = '';
    // dashboard
    html += '<div class="card"><div class="tt-h">'+T('vg.dash','Portefeuille')+'</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-top:0.6rem;">'+
      [[st.beschikbaar||0, T('vg.beschikbaar','beschikbaar')],[st.onderOptie||0, T('vg.optie','onder optie')],[st.verkocht||0, T('vg.verkocht','verkocht/verhuurd')],
       [st.openBezichtigingen||0, T('vg.bez','open bezichtigingen')],[st.openBiedingen||0, T('vg.bod','open biedingen')],[st.totaal||0, T('vg.totaal','panden')]]
      .map(c => '<div style="background:var(--card2,var(--card));border:1px solid var(--line);border-radius:0;padding:0.6rem;text-align:center;"><div style="font-size:1.3rem;font-weight:700;color:var(--rtg-leesgoud,var(--gold));">'+c[0]+'</div><div style="font-size:0.64rem;color:var(--soft);text-transform:uppercase;letter-spacing:0.06em;">'+c[1]+'</div></div>').join('')+
      '</div><div style="margin-top:0.6rem;font-size:0.78rem;color:var(--muted);">'+T('vg.waarde','Portefeuillewaarde (koop):')+' <b style="color:var(--rtg-leesgoud,var(--gold));">'+geld(st.portefeuille)+'</b></div></div>';
    // open biedingen
    const openBod = (vg.biedingen||[]).filter(b => b.status === 'open');
    if (openBod.length) html += '<div class="card"><div class="tt-h">\uD83D\uDCB0 '+T('vg.biedingen','Biedingen')+' ('+openBod.length+')</div>'+
      openBod.map(b => '<div class="mitem"><div class="r1"><span class="nm">'+esc(b.codename)+' \u00B7 '+esc(b.pand)+'</span><span class="pr">'+geld(b.bedrag)+'</span></div>'+
        (canEdit?'<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;"><button class="obtn primary" data-bod="'+b.ref+'" data-actie="accepteren">'+T('vg.accept','Accepteren')+'</button>'+
        '<button class="obtn" data-bod="'+b.ref+'" data-actie="tegenbod">'+T('vg.tegen','Tegenbod')+'</button>'+
        '<button class="obtn" data-bod="'+b.ref+'" data-actie="afwijzen">'+T('vg.afwijs','Afwijzen')+'</button></div>':'')+'</div>').join('')+'</div>';
    // open bezichtigingen
    const openBez = (vg.bezichtigingen||[]).filter(b => b.status === 'aangevraagd');
    if (openBez.length) html += '<div class="card"><div class="tt-h">\uD83D\uDC41\uFE0F '+T('vg.bezichtigingen','Bezichtigingen')+' ('+openBez.length+')</div>'+
      openBez.map(b => '<div class="mitem"><div class="r1"><span class="nm">'+esc(b.codename)+' \u00B7 '+esc(b.pand)+'</span></div>'+
        (b.wens?'<div class="ds">'+T('vg.wens','wens')+': '+esc(b.wens)+'</div>':'')+
        '<div style="margin-top:0.4rem;display:flex;gap:0.4rem;"><button class="obtn primary" data-bezbev="'+b.ref+'">'+T('vg.bevestig','Bevestig + keyless')+'</button>'+
        '<button class="obtn" data-bezafw="'+b.ref+'">'+T('vg.afwijs','Afwijzen')+'</button></div></div>').join('')+'</div>';
