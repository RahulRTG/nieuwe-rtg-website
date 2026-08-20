/* De volle PR-kamer van de zaak (pr-plus): campagneplanner (vooruit
   plannen, de server publiceert vanzelf), nieuwsbrief naar volgers via
   RTMAIL (hoogstens 1 per 7 dagen), en bereik per post. Losstaand naast
   de bundel: deel 21z zet een wortel-div neer in de marketing-kamer en de
   app geeft bij het binden zijn context door. Het drukklare Persdossier
   zit in leverancier-pr-dossier.js. */
(function(){
  'use strict';
  let ctx = null, data = null, bezig = false;
  const T = (k, nl) => (ctx && ctx.T) ? ctx.T(k, nl) : nl;
  const esc = s => (ctx && ctx.esc) ? ctx.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const wanneer = iso => { try { return new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch(e){ return iso; } };

  async function laad(){
    if (bezig || !ctx) return;
    bezig = true;
    try { data = await ctx.api('/supplier/pr/overzicht', {}); }
    catch(e){ data = { error: e.message }; }
    bezig = false;
    teken();
  }

  function kaartPlanner(){
    const gepland = (data.campagnes || []).filter(c => c.status === 'gepland');
    const geplaatst = (data.campagnes || []).filter(c => c.status === 'geplaatst').slice(-5).reverse();
    let h = '<div class="tkc" style="grid-column:1/-1;"><h3>' + T('pr2.plan', 'Campagneplanner') + (gepland.length ? ' (' + gepland.length + ')' : '') + '</h3>' +
      '<div class="tkc-who">' + T('pr2.plan.s', 'Plan posts en aanbiedingen vooruit; RTG publiceert ze vanzelf op het gekozen moment en uw volgers krijgen een melding.') + '</div>' +
      gepland.map(c => '<div class="st-row"><span>' + (c.soort === 'deal' ? '<b>' + esc(c.titel) + '</b> · ' : '') + esc(c.tekst).slice(0, 70) +
        '<span class="sub">' + T('pr2.gaat', 'gaat live') + ' ' + wanneer(c.publiceerOp) + '</span></span>' +
        '<button class="obtn warn" data-prweg="' + c.id + '">✕</button></div>').join('') +
      (geplaatst.length ? geplaatst.map(c => '<div class="st-row"><span style="opacity:0.65;">✓ ' + esc(c.soort === 'deal' ? c.titel : c.tekst).slice(0, 70) +
        '<span class="sub">' + T('pr2.live', 'live sinds') + ' ' + wanneer(c.geplaatstOp) + '</span></span></div>').join('') : '');
    h += '<div class="st-form h-mt50">' +
      '<select class="st-in" id="prSoort"><option value="post">' + T('pr2.post', 'Salon-post') + '</option><option value="deal">' + T('pr2.deal', 'Aanbieding (alleen leden)') + '</option></select>' +
      '<input class="st-in" id="prTitel" placeholder="' + T('pr2.titel', 'Titel (bij een aanbieding)') + '">' +
      '<textarea class="st-in" id="prTekst" placeholder="' + T('pr2.tekst', 'De tekst van de post of aanbieding') + '" style="min-height:56px;resize:vertical;"></textarea>' +
      '<input class="st-in" id="prOp" type="datetime-local">' +
      '<button class="obtn primary" id="prPlanGo" style="align-self:flex-start;">' + T('pr2.inplannen', 'Plan in') + '</button></div></div>';
    return h;
  }

  function kaartNieuwsbrief(){
    const nb = data.nieuwsbrief || {};
    let h = '<div class="tkc"><h3>' + T('pr2.brief', 'Nieuwsbrief aan volgers') + '</h3>' +
      '<div class="tkc-who">' + T('pr2.brief.s', 'Via RTMAIL, op codenaam, aan iedereen die uw zaak volgt. Hoogstens 1 per 7 dagen: zo blijft de brief welkom.') +
      ' · ' + (nb.volgers || 0) + ' ' + T('mk.volgers', 'Volgers').toLowerCase() + '</div>';
    if (nb.laatste) h += '<div class="st-row"><span>' + esc(nb.laatste.onderwerp) + '<span class="sub">' + wanneer(nb.laatste.at) + ' · ' + nb.laatste.verstuurd + ' ' + T('pr2.bezorgd', 'bezorgd') + '</span></span></div>';
    h += nb.magWeer
      ? '<div class="st-form h-mt50"><input class="st-in" id="prNbOnd" placeholder="' + T('pr2.onderwerp', 'Onderwerp') + '">' +
        '<textarea class="st-in" id="prNbTekst" placeholder="' + T('pr2.brieftekst', 'De brief zelf') + '" style="min-height:70px;resize:vertical;"></textarea>' +
        '<button class="obtn primary" id="prNbGo" style="align-self:flex-start;">' + T('pr2.verstuur', 'Verstuur aan alle volgers') + '</button></div>'
      : '<div class="tkc-who h-mt40">' + T('pr2.wacht', 'De volgende brief kan 7 dagen na de vorige.') + '</div>';
    return h + '</div>';
  }

  function kaartBereik(){
    const rijen = data.bereik || [];
    return '<div class="tkc"><h3>' + T('pr2.bereik', 'Bereik per bericht') + '</h3>' +
      '<div class="tkc-who">' + T('pr2.bereik.s', 'Wat uw laatste berichten losmaakten op De Salon.') + '</div>' +
      (rijen.length ? rijen.map(p => '<div class="st-row"><span>' + esc(p.tekst) +
        '<span class="sub">' + wanneer(p.at) + ' · ' + p.soort + '</span></span>' +
        '<span class="sub" style="text-align:right;font-variant-numeric:tabular-nums;">♥ ' + p.likes + ' · ' + p.reacties + ' ' + T('mk.reacties', 'Reacties').toLowerCase() +
        (p.claims != null ? '<br>' + p.claims + ' ' + T('mk.claims', 'geclaimd') : '') +
        (p.stemmen != null ? '<br>' + p.stemmen + ' ' + T('pr2.stemmen', 'stemmen') : '') + '</span></div>').join('')
        : '<div class="tkc-who">' + T('pr2.geen', 'Nog geen berichten geplaatst.') + '</div>') +
      '<button class="obtn ghost h-mt50" id="prDossier">' + T('pr2.dossier', 'Persdossier') + ' (print)</button></div>';
  }

  function teken(){
    const w = document.getElementById('prPlusWortel');
    if (!w) return;
    if (!data){ w.innerHTML = '<div class="tkc" style="grid-column:1/-1;"><h3>PR</h3><div class="tkc-who">' + T('kt.laden', 'Laden...') + '</div></div>'; return; }
    if (data.error){ w.innerHTML = '<div class="tkc" style="grid-column:1/-1;"><h3>PR</h3><div class="tkc-who">' + esc(data.error) + '</div></div>'; return; }
    w.innerHTML = kaartPlanner() + kaartNieuwsbrief() + kaartBereik();
  }

  async function doe(pad, body, melding){
    try {
      const d = await ctx.api(pad, body);
      if (melding && ctx.toast) ctx.toast(melding(d));
      data = null;
      await laad();
    } catch(e){ if (ctx.toast) ctx.toast(e.message); }
  }

  function klik(e){
    const q = sel => e.target.closest(sel);
    let b;
    if ((b = q('[data-prweg]'))) return doe('/supplier/pr/plan/weg', { id: b.dataset.prweg });
    if (q('#prPlanGo')){
      const v = id => (document.getElementById(id) || {}).value || '';
      if (!v('prTekst').trim() || !v('prOp')){ if (ctx.toast) ctx.toast(T('pr2.leeg', 'Schrijf een tekst en kies een moment.')); return; }
      return doe('/supplier/pr/plan', { soort: v('prSoort'), titel: v('prTitel'), tekst: v('prTekst'), publiceerOp: v('prOp') },
        () => T('pr2.geplandok', 'Ingepland; RTG publiceert vanzelf.'));
    }
    if (q('#prNbGo')){
      const v = id => (document.getElementById(id) || {}).value || '';
      if (!v('prNbOnd').trim() || !v('prNbTekst').trim()){ if (ctx.toast) ctx.toast(T('pr2.nbleeg', 'Geef de brief een onderwerp en een tekst.')); return; }
      return doe('/supplier/pr/nieuwsbrief', { onderwerp: v('prNbOnd'), tekst: v('prNbTekst') },
        d => T('pr2.verstuurd', 'Verstuurd aan') + ' ' + d.verstuurd + ' ' + T('mk.volgers', 'Volgers').toLowerCase() + '.');
    }
    if (q('#prDossier') && window.RTGPersdossier) return RTGPersdossier.open(ctx, data);
  }

  window.RTGZaakPR = {
    bind: function(el, c){
      ctx = c || ctx;
      const w = el.querySelector('#prPlusWortel');
      if (!w) return;
      if (!w.dataset.gebonden){ w.dataset.gebonden = '1'; w.addEventListener('click', klik); }
      if (data) teken();
      laad();
    }
  };
})();
