/* RTG Concern: DE INHAALSLAG VOOR DIENSTVERBANDEN (ARBEID.md par. 7a).

   Wie al in het personeelsregister van een zaak stond voordat een aanname
   vanzelf een dienstverband werd, heeft er geen -- en de loonrun meldt hem
   daarom. Dit blok toont per zaak op een vestiging het VOORSTEL van de server
   (/api/concern/vestiging/inhaal) en legt pas iets vast als de
   eigenaar zelf mensen heeft aangevinkt (/api/concern/vestiging/inhaal/bevestig).

   DRIE DINGEN MET OPZET:
   - geen vinkje staat vooraf aan. Een dienstverband op iemands naam is een
     verklaring van een werkgever; "alles aan, klik op ja" maakt er een reflex
     van (GRAMMATICA.md: twintig bevestigingen leren mensen op ja drukken);
   - het scherm rekent niets zelf. Wie er in het voorstel staat, wie al binnen
     is en wie geen account heeft, komt uit het antwoord van de server;
   - een knop zonder keuze is geen grijze knop: hij zegt waarom er niets
     gebeurt (een verhindering draagt altijd een reden). */
'use strict';
(function () {
  function vak(vestigingen, esc) {
    const plekken = [];
    for (const v of (vestigingen || [])) {
      if (!v.open) continue;
      for (const u of (v.units || [])) if (!u.weg) plekken.push({ v, u });
    }
    if (!plekken.length) return '';
    const rijen = plekken.map(({ v, u }) =>
      '<div class="regel"><strong>' + esc(u.naam || u.code) + '</strong>' +
      '<span class="meta">' + esc(v.naam) + '</span><span class="sp"></span>' +
      '<button class="knop" data-inhaal-ves="' + esc(v.id) + '" data-inhaal-code="' + esc(u.code) + '">' +
      'Wie mist een dienstverband?</button></div>').join('');
    return '<div class="vak" id="inhaalVak"><h2>Dienstverbanden inhalen</h2>' +
      '<p class="subtxt">Wie in het team van een zaak stond voordat een aanname vanzelf een ' +
      'dienstverband werd, heeft er nog geen. Bekijk per zaak wie het betreft en kies zelf; ' +
      'er wordt niets vastgelegd zonder uw keuze.</p>' +
      '<div class="lijst">' + rijen + '</div><div id="inhaalPaneel" class="r10"></div></div>';
  }

  function paneel(r, esc) {
    const tel = '<p class="subtxt">' + (r.voorstel.length
      ? r.voorstel.length + ' ' + (r.voorstel.length === 1 ? 'persoon heeft' : 'mensen hebben') + ' nog geen dienstverband.'
      : 'Iedereen met een eigen account heeft hier al een dienstverband.') +
      (r.alBinnen ? ' ' + r.alBinnen + ' al vastgelegd.' : '') +
      (r.zonderAccount ? ' ' + r.zonderAccount + ' zonder eigen RTG-account; voor hen kan het niet, want een dienstverband hangt aan een account.' : '') +
      '</p>';
    if (!r.voorstel.length) return tel;
    const keuzes = r.voorstel.map(p =>
      '<label class="regel"><input type="checkbox" data-inhaal-staff="' + esc(p.staffId) + '"> ' +
      '<strong>' + esc(p.naam || ('Personeelsnummer ' + p.staffId)) + '</strong>' +
      '<span class="meta">' + esc(p.rol) + '</span></label>').join('');
    return tel + '<div class="lijst">' + keuzes + '</div>' +
      '<div class="rij r8"><button class="knop prim" id="inhaalDoe">Leg dienstverband vast voor wie ik koos</button></div>';
  }

  function knopen({ api, meld, herlaad, esc, $ }) {
    const vakEl = $('#inhaalVak'); if (!vakEl) return;
    let huidig = null;
    vakEl.addEventListener('click', async (ev) => {
      const toon = ev.target.closest('[data-inhaal-ves]');
      if (toon) {
        huidig = { vestiging: toon.getAttribute('data-inhaal-ves'), code: toon.getAttribute('data-inhaal-code') };
        try { $('#inhaalPaneel').innerHTML = paneel(await api('vestiging/inhaal', huidig), esc); }
        catch (e) { meld(e.message); }
        return;
      }
      if (ev.target.id !== 'inhaalDoe' || !huidig) return;
      const keuze = [...vakEl.querySelectorAll('[data-inhaal-staff]:checked')].map(x => Number(x.getAttribute('data-inhaal-staff')));
      if (!keuze.length) { meld('Vink eerst aan wie een dienstverband krijgt; zonder keuze wordt er niets vastgelegd.'); return; }
      try {
        const r = await api('vestiging/inhaal/bevestig', Object.assign({ keuze }, huidig));
        const mis = (r.overgeslagen || []).map(o => o.reden).filter(Boolean);
        meld(r.gemaakt.length + ' dienstverband' + (r.gemaakt.length === 1 ? '' : 'en') + ' vastgelegd.' +
          (mis.length ? ' Niet gelukt: ' + mis.join('; ') : ''));
        await herlaad();
      } catch (e) { meld(e.message); }
    });
  }

  window.ConcernInhaal = { vak, knopen };
})();
