(function (w) {
'use strict';
/* Mijn reizen en Persoonlijk vliegen, op het RTG Design System: Detail (de
   instapkaart, met groot beeld) en Taak (een charter aanvragen). De
   instapcode is tabgebonden: de server geeft haar een keer uit, dit tabblad
   bewaart haar in sessionStorage, en Mijn reizen geeft haar nooit terug. */
w.RTGVluchtMomenten = function (c) {
  const { $, esc, api, meld, datum, leeg, herlaad } = c;
  let MIJN = null;
  const passSleutel = id => 'rtg_airport_boarding_pass_session_' + String(id || '');
  function bewaarPass(id, code) { try { sessionStorage.setItem(passSleutel(id), String(code || '')); } catch (e) {} }
  function leesPass(id) { try { return sessionStorage.getItem(passSleutel(id)) || ''; } catch (e) { return ''; } }
  function vergeetPass(id) { try { sessionStorage.removeItem(passSleutel(id)); } catch (e) {} }
  const ICOON = { tijd: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>', gate: '<path d="M5 20V5h14v15M9 20v-6h6v6"/>', stoel: '<path d="M7 4v9h10M7 13l-1 7m11-7 1 7M10 4h4"/>', koffer: '<rect x="5" y="7" width="14" height="12" rx="1"/><path d="M9 7V4h6v3"/>', let: '<path d="M12 4 3 20h18zM12 10v4m0 3v.5"/>' };
  const gegeven = (i, tekst) => '<li class="ds-detail__gegeven"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICOON[i] + '</svg><span>' + tekst + '</span></li>';
  function instapkaart(b) {
    const v = b.vlucht, code = leesPass(b.id), pass = b.pass || {}, actief = pass.stand === 'actief';
    return '<article class="ds-kaart" data-instapkaart="' + esc(b.id) + '"><img class="ds-detail__beeld" src="/images/worlds/heritage/travel-heritage-v2.jpg" alt=""><div class="ds-detail__inhoud">' +
      '<p class="ds-label">Instapkaart</p><h3 class="ds-titel">' + esc(v.nummer) + '</h3><p class="ds-meta">naar ' + esc(v.bestemming) + ' · ' + datum(v.datum) + '</p>' +
      '<ul class="ds-detail__gegevens">' + gegeven('tijd', 'Vertrek ' + esc(v.tijd)) + gegeven('gate', 'Gate ' + esc(v.gate)) + gegeven('stoel', 'Stoel ' + esc(b.stoel)) +
      gegeven('koffer', b.koffers.length + (b.koffers.length === 1 ? ' koffer' : ' koffers') + (b.koffers.length ? ': ' + b.koffers.map(k => esc(k.tag) + ' (' + esc(k.status) + (k.band ? ' · band ' + esc(k.band) : '') + ')').join(', ') : '')) +
      (v.vertraging ? gegeven('let', 'Let op: +' + esc(v.vertraging.minuten) + ' min · ' + esc(v.vertraging.reden)) : '') + '</ul>' +
      (code && actief ? '<p class="ds-titel" data-pass-code>' + esc(code) + '</p><p class="ds-meta">Deze code staat alleen in dit browsertabblad. Laat haar zien bij security en de gate.</p>'
        : '<p class="ds-meta">De geheime code wordt niet door Mijn reizen teruggegeven. Geef een nieuwe uit als u haar niet meer op dit toestel heeft.</p>') +
      ((!code || !actief) && !v.geannuleerd ? '<button class="ds-knop ds-knop--primair ds-knop--breed" type="button" data-roteer="' + esc(b.id) + '" data-rotatie="' + esc(pass.rotatie || 0) + '" data-ds-actie="Nieuwe instapcode">Nieuwe instapcode</button>' : '') +
      (actief ? '<button class="ds-knop ds-knop--stil ds-knop--breed" type="button" data-intrek="' + esc(b.id) + '" data-rotatie="' + esc(pass.rotatie || 0) + '">Code intrekken</button>' : '') +
      '</div></article>';
  }
  function boeking(b) {
    const v = b.vlucht, kan = v.status === 'inchecken';
    return '<article class="ds-kaart"><div class="ds-kaart__inhoud"><p class="ds-label">' + esc(v.nummer) + '</p><h3 class="ds-kaart__titel">' + esc(v.tijd) + ' · ' + esc(v.bestemming) + '</h3>' +
      '<p class="ds-meta">' + datum(v.datum) + ' · boeking ' + esc(b.id) + '</p><p class="ds-detail__status">' + esc(v.geannuleerd ? 'geannuleerd' : v.status) + '</p>' +
      (kan ? '<label class="ds-veld"><svg class="ds-veld__icoon" viewBox="0 0 24 24" aria-hidden="true">' + ICOON.koffer + '</svg><span><span class="ds-veld__label">Bagage</span><select class="ds-veld__invoer" data-kof="' + esc(b.id) + '"><option value="0">Geen koffer</option><option value="1">1 koffer</option><option value="2">2 koffers</option><option value="3">3 koffers</option></select></span><span></span></label>' +
        '<div><button class="ds-knop ds-knop--primair" type="button" data-in="' + esc(b.id) + '" data-ds-actie="Inchecken">Inchecken</button></div>'
        : v.geannuleerd ? '' : '<p class="ds-meta">Inchecken kan zodra het open staat.</p>') + '</div></article>';
  }
  async function laadMijn() {
    let d; try { d = await api('/mijn'); } catch (e) { $('#inhoud').innerHTML = leeg(esc(e.message)); return; }
    MIJN = d;
    const pas = d.boekingen.some(b => b.status === 'ingecheckt');
    document.body.dataset.dsSchermtype = pas ? 'detail' : 'collectie';
    $('#inhoud').innerHTML = '<div class="ds-schermkop"><div><p class="ds-label">Mijn reizen</p><h2 class="ds-kaart__titel">Klaar om in te stappen.</h2></div><span class="ds-meta">' + d.boekingen.length + (d.boekingen.length === 1 ? ' vlucht' : ' vluchten') + '</span></div>' +
      (d.boekingen.length ? '<div class="ds-collectie__raster">' + d.boekingen.map(b => b.status === 'ingecheckt' ? instapkaart(b) : boeking(b)).join('') + '</div>'
        : '<div class="ds-status ds-status--binnen"><h2 class="ds-status__titel">Nog geen reizen.</h2><p class="ds-status__tekst">Kies eerst een vlucht, of vraag persoonlijk vervoer aan.</p><button class="ds-knop ds-knop--primair ds-status__actie" type="button" data-naar="bord">Vluchten</button></div>');
    document.querySelectorAll('[data-in]').forEach(b => b.addEventListener('click', async () => {
      const kof = document.querySelector('[data-kof="' + b.dataset.in + '"]');
      try { const r = await api('/incheck', { id: b.dataset.in, koffers: kof ? kof.value : 0 });
        bewaarPass(b.dataset.in, r.pass.code); meld('Ingecheckt; de boarding-passcode is eenmalig uitgegeven.'); laadMijn(); } catch (e) { meld(e.message); }
    }));
    document.querySelectorAll('[data-roteer]').forEach(b => b.addEventListener('click', async () => {
      try { const r = await api('/pass/roteer', { id: b.dataset.roteer, rotatie: Number(b.dataset.rotatie) });
        bewaarPass(b.dataset.roteer, r.pass.code); meld('Nieuwe boarding-passcode eenmalig uitgegeven.'); laadMijn(); } catch (e) { meld(e.message); }
    }));
    document.querySelectorAll('[data-intrek]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Deze boarding-passcode direct intrekken?')) return;
      try { await api('/pass/intrek', { id: b.dataset.intrek, rotatie: Number(b.dataset.rotatie) });
        vergeetPass(b.dataset.intrek); meld('Boarding-passcode ingetrokken.'); laadMijn(); } catch (e) { meld(e.message); }
    }));
  }
  const veld = (label, invoer, icoon) => '<label class="ds-veld"><svg class="ds-veld__icoon" viewBox="0 0 24 24" aria-hidden="true">' + icoon + '</svg><span><span class="ds-veld__label">' + label + '</span>' + invoer + '</span><span></span></label>';
  async function laadCharter() {
    let d; try { d = await api('/mijn'); } catch (e) { $('#inhoud').innerHTML = leeg(esc(e.message)); return; }
    MIJN = d;
    const aanvragen = d.charters || [];
    $('#inhoud').innerHTML = '<section class="ds-taak">' +
      '<div class="ds-kaart ds-kaart--beeld"><img class="ds-kaart__beeld" src="/campagne/jet.jpg" alt=""><div class="ds-kaart__inhoud"><p class="ds-kaart__titel">Privéjet of helikopter</p><p class="ds-kaart__sub">Operations bevestigt persoonlijk.</p></div></div>' +
      '<p class="ds-label">Uw aanvraag</p><div class="ds-velden" role="radiogroup" aria-label="Soort vlucht">' +
      '<label class="ds-veld"><svg class="ds-veld__icoon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 14l18-6-6 12-2-5z"/></svg><span class="ds-veld__label">Privéjet</span><input type="radio" name="chSoort" value="privejet" checked></label>' +
      '<label class="ds-veld"><svg class="ds-veld__icoon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M12 6v4M6 10h10a3 3 0 0 1 0 6H8zM8 19h10"/></svg><span class="ds-veld__label">Helikopter</span><input type="radio" name="chSoort" value="helikopter"></label></div>' +
      '<div class="ds-velden">' + veld('Bestemming', '<input class="ds-veld__invoer" id="chBest" placeholder="Waar wilt u heen?" maxlength="60">', '<path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>') +
      veld('Datum', '<input class="ds-veld__invoer" id="chDatum" type="date">', ICOON.tijd) + veld('Tijd', '<input class="ds-veld__invoer" id="chTijd" type="time" value="12:00">', ICOON.tijd) + '</div>' +
      '<button class="ds-knop ds-knop--primair ds-knop--breed ds-taak__actie" type="button" id="chVraag" data-ds-actie="Vraag persoonlijk aan">Vraag persoonlijk aan</button><p class="ds-meta">Geen automatische belofte. Eerst persoonlijke bevestiging door Operations.</p>' +
      (aanvragen.length ? '<h3 class="ds-kaart__titel">Uw aanvragen</h3><ul class="ds-lijst">' + aanvragen.map(x => '<li class="ds-lijst__rij"><span></span><span><span class="ds-lijst__titel">' + esc(x.code) + ' · ' + esc(x.bestemming) + '</span><span class="ds-lijst__tekst">' + esc(x.soort) + ' · ' + datum(x.datum) + ' ' + esc(x.tijd) + '</span></span><span class="ds-lijst__tijd">' + esc(x.status) + (x.vlucht ? ' · ' + esc(x.vlucht) : '') + '</span></li>').join('') + '</ul>' : '') + '</section>';
    $('#chDatum').value = new Date().toISOString().slice(0, 10);
    $('#chVraag').addEventListener('click', async () => {
      const soort = document.querySelector('[name="chSoort"]:checked').value;
      try { const r = await api('/charter', { soort, bestemming: $('#chBest').value, datum: $('#chDatum').value, tijd: $('#chTijd').value });
        meld('Aangevraagd (' + r.charter.code + '); Operations bevestigt persoonlijk.'); herlaad(); } catch (e) { meld(e.message); }
    });
  }
  return { laadMijn, laadCharter, mijn: () => MIJN };
};
})(window);
