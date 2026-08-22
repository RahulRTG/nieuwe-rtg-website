/* De volle HR-kamer van de zaak (hr-plus): inwerktrajecten met afvinkbare
   stappen, groeigesprekken (alleen management en de medewerker zelf),
   certificaten & bevoegdheden met verloopbewaking, en dienstjaren.
   Losstaand naast de bundel: deel 16z zet een wortel-div neer en de app
   geeft bij het binden zijn context door (api, i18n, team). */
(function(){
  'use strict';
  let ctx = null, data = null, bezig = false, openGesprek = null;
  const T = (k, nl) => (ctx && ctx.T) ? ctx.T(k, nl) : nl;
  const esc = s => (ctx && ctx.esc) ? ctx.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FASEN = { dag1: ['hr2.dag1', 'Dag 1'], week1: ['hr2.week1', 'Week 1'], maand1: ['hr2.maand1', 'Maand 1'] };

  async function laad(){
    if (bezig || !ctx) return;
    bezig = true;
    try { data = await ctx.api('/supplier/hr/overzicht', {}); }
    catch(e){ data = { error: e.message }; }
    bezig = false;
    teken();
  }

  function staffKeus(id){
    return '<select class="st-in" id="' + id + '">' + (ctx.staff || []).map(s =>
      '<option value="' + s.id + '">' + esc(s.name) + (s.func ? ' (' + esc(s.func) + ')' : '') + '</option>').join('') + '</select>';
  }

  function kaartInwerk(){
    const open = (data.inwerk || []).filter(t => !t.klaarOp);
    const klaar = (data.inwerk || []).filter(t => t.klaarOp);
    let h = '<div class="tkc" style="grid-column:1/-1;"><h3>' + T('hr2.inwerk', 'Inwerktrajecten') + (open.length ? ' (' + open.length + ')' : '') + '</h3>' +
      '<div class="tkc-who">' + T('hr2.inwerk.s', 'Elke nieuwe collega een vaste route: dag 1, week 1, maand 1. De medewerker vinkt mee vanuit de eigen app.') + '</div>';
    for (const t of open){
      const n = t.stappen.filter(s => s.klaar).length;
      h += '<div style="border:1px solid var(--line);border-radius:0;padding:0.6rem 0.8rem;margin-top:0.5rem;">' +
        '<div class="st-row" style="padding:0;"><b>' + esc(t.name) + '</b><span class="sub">' + n + '/' + t.stappen.length + '</span></div>';
      for (const fase of ['dag1', 'week1', 'maand1']){
        const st2 = t.stappen.filter(s => s.fase === fase);
        if (!st2.length) continue;
        h += '<div class="sub" style="text-transform:uppercase;letter-spacing:0.1em;font-size:0.58rem;margin-top:0.45rem;">' + T(FASEN[fase][0], FASEN[fase][1]) + '</div>' +
          st2.map(s => '<button class="obtn' + (s.klaar ? '' : ' ghost') + '" data-hrvink="' + t.id + '" data-stap="' + s.id + '" style="display:block;width:100%;text-align:left;margin-top:0.25rem;font-size:0.76rem;">' + (s.klaar ? '✓ ' : '○ ') + esc(s.tekst) + '</button>').join('');
      }
      h += '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input class="st-in h-flex1" data-hrstapin="' + t.id + '" placeholder="' + T('hr2.stap', 'Eigen stap toevoegen') + '">' +
        '<button class="obtn" data-hrstap="' + t.id + '">+</button></div></div>';
    }
    const zonder = (ctx.staff || []).filter(s => !open.some(t => t.staffId === s.id));
    if (zonder.length){
      h += '<div style="display:flex;gap:0.4rem;margin-top:0.6rem;"><select class="st-in h-flex1" id="hrStartWie">' +
        zonder.map(s => '<option value="' + s.id + '">' + esc(s.name) + '</option>').join('') + '</select>' +
        '<button class="obtn primary" id="hrStart">' + T('hr2.start', 'Start traject') + '</button></div>';
    }
    if (klaar.length) h += '<div class="tkc-who h-mt50">✓ ' + klaar.length + ' ' + T('hr2.afgerond', 'traject(en) afgerond.') + '</div>';
    return h + '</div>';
  }

  function kaartGesprekken(){
    const g = data.gesprekken || [];
    let h = '<div class="tkc"><h3>' + T('hr2.gesprek', 'Groeigesprekken') + '</h3>' +
      '<div class="tkc-who">' + T('hr2.gesprek.s', 'Vast ritme, geen scores: wat gaat goed, wat heeft aandacht, welke afspraken. Alleen management en de medewerker zelf zien dit.') + '</div>' +
      g.slice(-8).reverse().map(x => '<div class="st-row" style="cursor:pointer;" data-hropen="' + x.id + '"><span>' + esc(x.name) + '<span class="sub">' + esc(x.datum) + ' · ' + esc(x.onderwerp) + '</span></span><span class="sub">' + (openGesprek === x.id ? '−' : '+') + '</span></div>' +
        (openGesprek === x.id ? '<div class="tkc-who" style="border-left:2px solid var(--gold);padding-left:0.7rem;">' + esc(x.verslag) + (x.afspraken ? '<br><b>' + T('hr2.afspraken', 'Afspraken') + ':</b> ' + esc(x.afspraken) : '') + '</div>' : '')).join('');
    h += '<div class="st-form h-mt50">' + staffKeus('hrGwie') +
      '<input class="st-in" id="hrGond" placeholder="' + T('hr2.onderwerp', 'Onderwerp, bijv. eerste kwartaal') + '">' +
      '<textarea class="st-in" id="hrGver" placeholder="' + T('hr2.verslag', 'Verslag: wat gaat goed, wat heeft aandacht') + '" style="min-height:56px;resize:vertical;"></textarea>' +
      '<input class="st-in" id="hrGafs" placeholder="' + T('hr2.afspraken', 'Afspraken') + '">' +
      '<button class="obtn primary" id="hrGopslaan" style="align-self:flex-start;">' + T('hr2.vastleggen', 'Leg gesprek vast') + '</button></div></div>';
    return h;
  }

  function kaartCertificaten(){
    const c = data.certificaten || [];
    const verloopKleur = v => v.verlopen ? 'color:var(--warn,#C0392B);' : 'color:var(--rtg-leesgoud,var(--gold));';
    const verlopend = data.verlopend || [];
    let h = '<div class="tkc"><h3>' + T('hr2.cert', 'Certificaten & bevoegdheden') + '</h3>' +
      '<div class="tkc-who">' + T('hr2.cert.s', 'EHBO, BHV, allergenen: wie mag wat, en wanneer het verloopt.') + '</div>' +
      (verlopend.length ? verlopend.map(v => '<div class="st-row"><span><b>' + esc(v.name) + '</b> · ' + esc(v.soort) + '</span><span class="sub" style="' + verloopKleur(v) + '">' + (v.verlopen ? T('hr2.verlopen', 'verlopen') : T('hr2.verloopt', 'verloopt') + ' ' + esc(v.verlooptOp)) + '</span></div>').join('') : '') +
      c.slice(-10).reverse().map(x => '<div class="st-row"><span>' + esc(x.name) + '<span class="sub">' + esc(x.soort) + (x.verlooptOp ? ' · t/m ' + esc(x.verlooptOp) : '') + '</span></span>' +
        '<button class="obtn warn" data-hrcweg="' + x.id + '">✕</button></div>').join('');
    h += '<div class="st-form h-mt50">' + staffKeus('hrCwie') +
      '<input class="st-in" id="hrCsoort" placeholder="' + T('hr2.soort', 'Soort, bijv. EHBO of BHV') + '">' +
      '<div style="display:flex;gap:0.4rem;"><input class="st-in h-flex1" id="hrCtot" type="date" title="' + T('hr2.verloopt', 'verloopt') + '"></div>' +
      '<button class="obtn primary" id="hrCnieuw" style="align-self:flex-start;">' + T('hr2.toevoegen', 'Voeg toe') + '</button></div></div>';
    return h;
  }

  function kaartDienst(){
    return '<div class="tkc"><h3>' + T('hr2.dienst', 'Dienstjaren') + '</h3>' +
      '<div class="tkc-who">' + T('hr2.dienst.s', 'Wie hoe lang aan boord is, en wanneer het volgende werkjubileum valt.') + '</div>' +
      (data.dienst || []).map(d => '<div class="st-row"><span>' + esc(d.name) + '<span class="sub">' + T('hr2.sinds', 'sinds') + ' ' + esc(d.sinds) + (d.jaren ? ' · ' + d.jaren + ' ' + T('hr2.jaar', 'jaar') : '') + '</span></span>' +
        '<span class="sub">✶ ' + esc(d.volgendJubileum) + '</span></div>').join('') + '</div>';
  }

  function teken(){
    const w = document.getElementById('hrPlusWortel');
    if (!w) return;
    if (!data){ w.innerHTML = '<div class="tkc" style="grid-column:1/-1;"><h3>HR</h3><div class="tkc-who">' + T('kt.laden', 'Laden...') + '</div></div>'; return; }
    if (data.error){ w.innerHTML = '<div class="tkc" style="grid-column:1/-1;"><h3>HR</h3><div class="tkc-who">' + esc(data.error) + '</div></div>'; return; }
    w.innerHTML = kaartInwerk() + kaartGesprekken() + kaartCertificaten() + kaartDienst();
  }

  async function doe(pad, body){
    try { await ctx.api(pad, body); data = null; await laad(); }
    catch(e){ if (ctx.toast) ctx.toast(e.message); }
  }

  function klik(e){
    const q = sel => e.target.closest(sel);
    let b;
    if ((b = q('[data-hrvink]'))) return doe('/supplier/hr/inwerk/vink', { trajectId: b.dataset.hrvink, stapId: b.dataset.stap });
    if ((b = q('[data-hrstap]'))){
      const inp = document.querySelector('[data-hrstapin="' + b.dataset.hrstap + '"]');
      if (inp && inp.value.trim()) return doe('/supplier/hr/inwerk/stap', { trajectId: b.dataset.hrstap, tekst: inp.value, fase: 'week1' });
      return;
    }
    if ((b = q('[data-hrcweg]'))) return doe('/supplier/hr/certificaat/weg', { id: b.dataset.hrcweg });
    if ((b = q('[data-hropen]'))){ openGesprek = openGesprek === b.dataset.hropen ? null : b.dataset.hropen; teken(); return; }
    if (q('#hrStart')){ const s = document.getElementById('hrStartWie'); if (s) return doe('/supplier/hr/inwerk/start', { staffId: Number(s.value) }); }
    if (q('#hrGopslaan')){
      const v = id => (document.getElementById(id) || {}).value || '';
      if (!v('hrGver').trim()){ if (ctx.toast) ctx.toast(T('hr2.leeg', 'Schrijf eerst een kort verslag.')); return; }
      return doe('/supplier/hr/gesprek', { staffId: Number(v('hrGwie')), onderwerp: v('hrGond'), verslag: v('hrGver'), afspraken: v('hrGafs') });
    }
    if (q('#hrCnieuw')){
      const v = id => (document.getElementById(id) || {}).value || '';
      if (!v('hrCsoort').trim()){ if (ctx.toast) ctx.toast(T('hr2.soortleeg', 'Geef het certificaat een naam.')); return; }
      return doe('/supplier/hr/certificaat', { staffId: Number(v('hrCwie')), soort: v('hrCsoort'), verlooptOp: v('hrCtot') });
    }
  }

  window.RTGZaakHR = {
    bind: function(el, c){
      ctx = c || ctx;
      const w = el.querySelector('#hrPlusWortel');
      if (!w) return;
      if (!w.dataset.gebonden){ w.dataset.gebonden = '1'; w.addEventListener('click', klik); }
      if (data) teken();
      laad();
    }
  };
})();
