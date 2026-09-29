/* Samen doen: het DoeNetwerk op het scherm Wat speelt er (POLITIEK.md par. 6).

   Een actie begint bij wie de kwestie heeft, en alleen als hij zelf aanvinkt dat
   andere leden het onderwerp dan zien, zonder zijn naam. Anderen sluiten ZELF
   aan; er gaat geen uitnodiging en geen herinnering uit. De lijst toont
   aantallen en nooit wie er meedoet. De eindstand samen-opgelost legt het
   kantoor vast, op naam: deze kant legt alleen het resultaat vast.

   Leest window.KwestiesScherm (token, esc, dag, teken) uit kwesties.html. */
(function () {
  'use strict';
  const S = window.KwestiesScherm;
  if (!S) return;
  const $ = s => document.querySelector(s);
  const esc = S.esc;
  const api = (pad, body) => fetch('/api/member/democratie/actie/' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S.token() },
    body: JSON.stringify(body || {})
  }).then(async r => {
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) throw new Error(d.error || 'Er ging iets mis.');
    return d;
  });

  function zeg(tekst, goed) {
    $('#samenMelding').innerHTML = tekst ? '<div class="melder ruimte' + (goed ? ' goed' : '') + '">' + esc(tekst) + '</div>' : '';
  }

  const ANTWOORD = { ja: 'Ik kom', misschien: 'Misschien', nee: 'Ik kom niet' };

  function bijeenkomst(a) {
    const b = a.bijeenkomst;
    if (!b) return a.ikStartte && a.stand === 'open' ? '<p class="ronde">Nog geen bijeenkomst gepland.</p>' : '';
    if (b.afgelast) return '<p class="ronde">De bijeenkomst van ' + esc(S.dag(b.datum)) + ' is afgelast' +
      (b.afgelast.reden ? ': ' + esc(b.afgelast.reden) : '') + '.</p>';
    let h = '<p class="ronde"><b>Bijeenkomst:</b> ' + esc(S.dag(b.datum)) + (b.tijd ? ' om ' + esc(b.tijd) : '') + ', ' + esc(b.waar) +
      '. ' + esc(b.ja) + ' komen' + (b.plaatsen ? ' van ' + esc(b.plaatsen) + ' plaatsen' + (b.vol ? ', vol' : '') : '') +
      (b.misschien ? ', ' + esc(b.misschien) + ' misschien' : '') + '.</p>';
    if (a.ikDoeMee && a.stand === 'open') {
      h += '<div class="rij ruimte" role="group" aria-label="Kom je?">' + Object.keys(ANTWOORD).map(w =>
        '<button class="kknop" type="button" data-antwoord="' + w + '" data-id="' + esc(a.id) + '" aria-pressed="' +
        (b.mijnAntwoord === w) + '">' + ANTWOORD[w] + '</button>').join('') + '</div>';
    }
    return h;
  }

  function beheer(a) {
    if (!a.ikStartte || a.stand !== 'open') return '';
    const id = esc(a.id);
    return '<details class="ruimte"><summary class="kknop">Beheer deze actie</summary>' +
      '<div class="rij ruimte"><input class="kveld" type="date" data-plan-datum="' + id + '" aria-label="Datum">' +
      '<input class="kveld" type="time" data-plan-tijd="' + id + '" aria-label="Tijd">' +
      '<input class="kveld" data-plan-waar="' + id + '" maxlength="120" placeholder="Waar komen jullie samen?" aria-label="Waar">' +
      '<input class="kveld" type="number" min="1" max="500" data-plan-plaatsen="' + id + '" placeholder="Plaatsen (mag leeg)" aria-label="Aantal plaatsen">' +
      '<button class="kknop" type="button" data-plan="' + id + '">Plan bijeenkomst</button>' +
      (a.bijeenkomst && !a.bijeenkomst.afgelast ? '<button class="kknop" type="button" data-afgelast="' + id + '">Gelast af</button>' : '') + '</div>' +
      '<label class="uitleg ruimte" for="res-' + id + '">Wat hebben jullie bereikt? Het kantoor leest dit en legt dan de uitkomst vast.</label>' +
      '<textarea class="kveld ruimte" id="res-' + id + '" maxlength="1000"></textarea>' +
      '<div class="rij ruimte"><button class="kknop vol" type="button" data-resultaat="' + id + '">Resultaat vastleggen</button></div>' +
      '<div class="rij ruimte"><input class="kveld" data-stop-reden="' + id + '" maxlength="300" placeholder="Waarom stopt de actie?" aria-label="Reden om te stoppen">' +
      '<button class="kknop" type="button" data-stop="' + id + '">Stop de actie</button></div></details>';
  }

  function kaart(a) {
    const k = a.kwestie || {};
    const status = a.stand === 'klaar' ? 'Resultaat vastgelegd' : (a.ikDoeMee ? 'Je doet mee' : 'Open');
    return '<div class="kwestie" data-actie="' + esc(a.id) + '"><div class="rij"><div class="kern"><b>' + esc(a.wat) + '</b>' +
      '<div class="meta">Bij: ' + esc(k.onderwerp || '') + (k.gebied ? ' · ' + esc(k.gebied) : '') + ' · ' + esc(a.deelnemers) +
      (a.deelnemers === 1 ? ' doet mee' : ' doen mee') + '</div></div>' +
      '<span class="stand' + (a.stand === 'klaar' ? ' klaar' : '') + '">' + esc(status) + '</span></div>' +
      (a.rollen && a.rollen.length ? '<p class="ronde">Nodig: ' + a.rollen.map(esc).join(', ') + '.</p>' : '') +
      bijeenkomst(a) +
      (a.resultaat ? '<div class="uitkomst"><p><b>Bereikt:</b> ' + esc(a.resultaat.tekst) + '</p></div>' : '') +
      (a.stand === 'open' ? '<div class="rij ruimte">' +
        (!a.ikDoeMee ? '<button class="kknop vol" type="button" data-aansluit="' + esc(a.id) + '">Doe mee</button>' : '') +
        (a.ikDoeMee && !a.ikStartte ? '<button class="kknop" type="button" data-verlaat="' + esc(a.id) + '">Toch niet</button>' : '') +
        '</div>' : '') + beheer(a) +
      (k.id ? '<div class="rij ruimte"><button class="kknop" type="button" data-voorstellen="' + esc(k.id) + '">Voorstellen van partijen</button></div>' +
        '<div data-voorstellen-bij="' + esc(k.id) + '"></div>' : '') + '</div>';
  }

  async function teken() {
    try {
      const l = (await api('lijst')).acties || [];
      $('#acties').innerHTML = l.length ? l.map(kaart).join('')
        : '<div class="leeg">Er loopt nog geen actie. Heb je zelf een kwestie, dan kun je er hieronder samen iets van maken.</div>';
    } catch (e) { $('#acties').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; }
  }

  async function doe(pad, body, klaar) {
    try { await api(pad, body); zeg(klaar, true); await teken(); S.teken(); }
    catch (e) { zeg(e.message); }
  }
  /* De voorstellen van partijen bij de kwestie van een actie: een actie maakt het
     onderwerp openbaar, dus elk lid mag ze lezen. Zelfde weergave als overal. */
  async function voorstellen(kid) {
    const plek = document.querySelector('[data-voorstellen-bij="' + kid + '"]');
    try {
      const r = await fetch('/api/member/democratie/kwestie/voorstellen', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S.token() }, body: JSON.stringify({ id: kid }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) throw new Error(d.error || 'Er ging iets mis.');
      plek.innerHTML = window.VoorstelBeeld.html(d, esc) || '<p class="ronde">Er staat nog geen partij in het register.</p>';
      const open = plek.querySelector('details');
      if (open) open.open = true;
    } catch (e) { plek.innerHTML = '<p class="ronde">' + esc(e.message) + '</p>'; }
  }
  const veld = (sel) => { const el = document.querySelector(sel); return el ? el.value.trim() : ''; };

  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('button');
    if (!t) return;
    const d = t.dataset;
    if (d.samen) {
      $('#samenStart').classList.remove('verborgen');
      $('#samenKwestie').value = d.samen;
      $('#samenWat').focus();
    } else if (t.id === 'samenBegin') {
      doe('start', { kwestie: $('#samenKwestie').value, wat: $('#samenWat').value.trim(),
        rollen: $('#samenRollen').value, zichtbaar: $('#samenZichtbaar').checked }, 'De actie staat open. Anderen kunnen nu zelf aansluiten.')
        .then(() => { if (!$('#samenMelding .goed')) return; $('#samenStart').classList.add('verborgen'); $('#samenWat').value = ''; $('#samenRollen').value = ''; $('#samenZichtbaar').checked = false; });
    } else if (d.aansluit) doe('aansluit', { id: d.aansluit }, 'Je doet mee. De uitkomst van de kwestie komt ook bij jou terug.');
    else if (d.verlaat) doe('verlaat', { id: d.verlaat }, 'Je doet niet meer mee. De uitkomst krijg je nog wel.');
    else if (d.antwoord) doe('antwoord', { id: d.id, wat: d.antwoord }, 'Je antwoord staat erbij.');
    else if (d.plan) doe('plan', { id: d.plan, datum: veld('[data-plan-datum="' + d.plan + '"]'), tijd: veld('[data-plan-tijd="' + d.plan + '"]'),
      waar: veld('[data-plan-waar="' + d.plan + '"]'), plaatsen: veld('[data-plan-plaatsen="' + d.plan + '"]') }, 'De bijeenkomst staat in de lijst.');
    else if (d.afgelast) doe('afgelast', { id: d.afgelast }, 'De bijeenkomst is afgelast.');
    else if (d.resultaat) doe('resultaat', { id: d.resultaat, tekst: veld('#res-' + d.resultaat) }, 'Het resultaat staat bij je kwestie. Het kantoor legt de uitkomst vast.');
    else if (d.voorstellen) voorstellen(d.voorstellen);
    else if (d.stop) doe('stop', { id: d.stop, reden: veld('[data-stop-reden="' + d.stop + '"]') }, 'De actie is gestopt. Je kwestie loopt gewoon door.');
  });

  window.KwestiesScherm.acties = teken;
  if (S.token()) teken();
})();
