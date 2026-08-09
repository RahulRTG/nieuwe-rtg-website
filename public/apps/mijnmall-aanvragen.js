/* Mijn Mall, deel twee: de eigen aanvragen van een lid.

   Wat niemand aanbiedt, kun je vragen. Dit scherm toont je openstaande vragen
   en de reacties erop, en laat je er een kiezen. Kiezen BOEKT NIETS: de zaak
   krijgt bericht en neemt contact op via de gewone weg, en dat staat er ook bij.

   Staat apart van mijnmall.js omdat dat bestand op de bestandsgrens liep; de
   naad zat er al tussen de lijsten en de aanvragen. Deelt $, esc, euro, meld en
   api met het hoofdbestand, dat eerder wordt geladen. */

/* ---------- aanvragen ---------- */

async function tekenAanvragen() {
  let d;
  try { d = await api('/api/mall/aanvragen/mijn', {}); } catch (e) { return; }
  if (!d.aanvragen.length) { $('#aanvragen').innerHTML = '<div class="leeg">Nog geen aanvragen uitgezet.</div>'; return; }
  $('#aanvragen').innerHTML = d.aanvragen.map((a) =>
    '<div class="kaart">' +
      '<div class="rij strak"><h3>' + esc(a.wat) + '</h3>' +
        '<span class="meta">' + esc(a.status) + ' &middot; ' + esc(a.plek || '') + (a.wanneer ? ' &middot; ' + esc(a.wanneer) : '') + '</span>' +
        '<span class="duw"></span>' +
        (a.status === 'open' ? '<button class="knop stil sluit" data-id="' + esc(a.id) + '" type="button">Sluiten</button>' : '') +
      '</div>' +
      (a.budget ? '<div class="meta">budget ' + euro(a.budget) + '</div>' : '') +
      (a.reacties.length
        ? a.reacties.map((r) =>
            '<div class="regel"><div><b>' + esc(r.zaak) + '</b>' +
            '<div class="oms">' + esc(r.tekst) + '</div>' +
            (r.prijs ? '<div class="meta">' + euro(r.prijs) + '</div>' : '') +
            (r.gekozen ? '<div class="meta goed">Gekozen; de zaak neemt contact op. Er is nog niets geboekt of betaald.</div>' : '') +
            '</div><div class="op">' +
            (a.status === 'open' ? '<button class="knop kies" data-id="' + esc(a.id) + '" data-code="' + esc(r.code) + '" type="button">Kiezen</button>' : '') +
            '</div></div>').join('')
        : '<div class="meta ruim">Nog geen reacties. Zaken in dit vak en deze plaats zien uw vraag.</div>') +
    '</div>').join('');

  $('#aanvragen').querySelectorAll('.sluit').forEach((b) => b.addEventListener('click', async () => {
    try { await api('/api/mall/aanvraag/sluit', { id: b.dataset.id }); meld('Gesloten.'); tekenAanvragen(); }
    catch (e) { meld(e.message); }
  }));
  $('#aanvragen').querySelectorAll('.kies').forEach((b) => b.addEventListener('click', async () => {
    try { const r = await api('/api/mall/aanvraag/kies', { id: b.dataset.id, code: b.dataset.code }); meld(r.opmerking); tekenAanvragen(); }
    catch (e) { meld(e.message); }
  }));
}
