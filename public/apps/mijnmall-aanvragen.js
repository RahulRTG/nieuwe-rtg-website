/* Mijn Mall, deel twee: de eigen aanvragen van een lid.

   Wat niemand aanbiedt, kun je vragen. Dit scherm toont je openstaande vragen
   en de reacties erop, en laat je er een kiezen. Kiezen BOEKT NIETS: de zaak
   ontvangt het werk in haar werklijst; haar antwoord komt bij het lid terug.

   Staat apart van mijnmall.js omdat dat bestand op de bestandsgrens liep; de
   naad zat er al tussen de lijsten en de aanvragen. Deelt $, esc, euro, meld en
   api met het hoofdbestand, dat eerder wordt geladen. */

/* ---------- aanvragen ---------- */

async function tekenAanvragen() {
  window.RTGAanvraagEdgeWis();
  let d;
  try { d = await api('/api/mall/aanvragen/mijn', {}); } catch (e) { $('#aanvragen').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; return; }
  /* Zonder lijst geen "Nog geen aanvragen" -- dat zou beweren dat er niets is (LIEGRONDE.json). */
  if (!(d && Array.isArray(d.aanvragen))) { $('#aanvragen').innerHTML = '<div class="leeg">Het antwoord was onvolledig, dus dit kon niet worden geladen.</div>'; return; }
  if (!d.aanvragen.length) { $('#aanvragen').innerHTML = '<div class="leeg">Nog geen aanvragen uitgezet.</div>'; return; }
  $('#aanvragen').innerHTML = d.aanvragen.map((a) =>
    '<div class="kaart" data-aanvraag="' + esc(a.id) + '">' +
      '<div class="rij strak"><h3>' + esc(a.wat) + '</h3>' +
        '<span class="meta">' + esc(a.statusLabel) + ' &middot; ' + esc(a.plek || '') + (a.wanneer ? ' &middot; ' + esc(a.wanneer) : '') + '</span>' +
        '<span class="duw"></span>' +
        '<span class="aanvraag-acties"></span>' +
      '</div>' +
      (a.resultaat ? '<p class="oms">Antwoord van ' + esc(a.resultaat.door) + ': ' + esc(a.resultaat.tekst) + '</p>' : '') +
      (a.budget ? '<div class="meta">budget ' + euro(a.budget) + '</div>' : '') +
      (a.reacties.length
        ? a.reacties.map((r) =>
            '<div class="regel"><div><b>' + esc(r.zaak) + '</b>' +
            '<div class="oms">' + esc(r.tekst) + '</div>' +
            (r.prijs ? '<div class="meta">' + euro(r.prijs) + '</div>' : '') +
            (r.ingetrokken ? '<div class="meta">Reactie vervallen of ingetrokken.</div>' : '') +
            (r.gekozen ? '<div class="meta goed">Gekozen; uw aanvraag staat in de werklijst van deze zaak. Er is nog niets geboekt of betaald.</div>' : '') +
            '</div><div class="op">' +
            (!r.ingetrokken && (a.acties || []).some(x => x.id === 'kies') ? '<button class="knop kies" data-id="' + esc(a.id) + '" data-code="' + esc(r.code) + '" type="button">Kiezen</button>' : '') +
            '</div></div>').join('')
        : '<div class="meta ruim">Nog geen reacties. Zaken in dit vak en deze plaats zien uw vraag.</div>') +
    '</div>').join('');

  d.aanvragen.forEach(a => window.RTGAanvraagActies($('#aanvragen').querySelector('[data-aanvraag="' + a.id + '"] .aanvraag-acties'), a, { api, meld, ververs: tekenAanvragen }));
  $('#aanvragen').querySelectorAll('.kies').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try { const r = await api('/api/mall/aanvraag/kies', { id: b.dataset.id, code: b.dataset.code, versie: d.aanvragen.find(a => a.id === b.dataset.id).versie }); meld(r.opmerking); tekenAanvragen(); }
    catch (e) { meld(e.message); } finally { b.disabled = false; }
  }));
}
