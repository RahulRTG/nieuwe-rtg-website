/* Mijn Mall, deel drie: bewaard, wat er sindsdien veranderde, wat je lopen
   hebt en het samengestelde aanbod.

   Vier blokken die een ding gemeen hebben: ze tonen wat er IS en dringen
   nergens aan. Dat is hier geen smaakkwestie maar de huisregel -- geen
   aftelklok, geen "nog 2 beschikbaar", geen suggestie die toevallig het duurst
   is. Drie plekken waar dat concreet wordt:

   1. Een prijs die zakte krijgt dezelfde opmaak als een prijs die steeg. Een
      groen uitroepteken bij het ene en niets bij het andere is aandrang met
      een kleurtje.
   2. Bij "wat je lopen hebt" staat GEEN knop om alles af te rekenen. Achter die
      regels zitten verschillende partijen met eigen bevestigingen; elke regel
      wijst naar het scherm dat hem werkelijk beheert.
   3. Een onvolledige bundel toont geen prijsvergelijk maar zijn waarschuwing.
      Doorrekenen zonder onderdeel laat iemand een korting kopen die hij niet
      krijgt.

   Deelt $, esc, euro, meld en api met mijnmall.js, dat eerder wordt geladen. */

/* ---------- bewaard ---------- */

async function tekenBewaard() {
  let d;
  try { d = await api('/api/mall/bewaard', {}); }
  catch (e) { $('#bewaard').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; return; }
  const regels = (d.lijst && d.lijst.regels) || [];
  if (!regels.length) {
    $('#bewaard').innerHTML = '<div class="leeg">Je hebt nog niets bewaard. In de Mall zet je met het hartje iets in deze lijst.</div>';
    return;
  }
  $('#bewaard').innerHTML = '<div class="kaart">' + regels.map((r) => {
    const a = r.aanbod;
    return '<div class="regel' + (r.vervallen ? ' vervallen' : '') + '">' +
      '<span>' + esc(r.titel) + (r.aanbieder ? ' <span class="meta">&middot; ' + esc(r.aanbieder) + '</span>' : '') + '</span>' +
      (r.vervallen
        ? '<span class="waarom">' + esc(r.reden || 'Staat niet meer in de Mall.') + '</span>'
        : '<span class="meta">' + (a && a.prijs ? esc(euro(a.prijs.bedrag)) : '') + '</span>') +
      '</div>';
  }).join('') + '</div>';
}

/* Wat er sinds het bewaren veranderde. Bewust GEEN melding en geen badge: je
   ziet dit wanneer je zelf kijkt. `zonderVergelijking` staat erbij omdat een
   overzicht dat de helft niet kon vergelijken, dat hoort te zeggen. */
async function tekenWijzigingen() {
  let d;
  try { d = await api('/api/mall/wijzigingen', {}); } catch (e) { return; }
  if (!d.wijzigingen.length) {
    $('#wijzigingen').innerHTML = d.bekeken
      ? '<div class="leeg">Er is niets veranderd aan wat je bewaarde.</div>' : '';
    return;
  }
  $('#wijzigingen').innerHTML = '<div class="kaart">' +
    '<h3>Veranderd sinds je het bewaarde</h3>' +
    d.wijzigingen.map((w) =>
      '<div class="regel">' +
        '<span>' + esc(w.titel) + ' <span class="meta">&middot; ' + esc(w.lijstNaam) + '</span></span>' +
        '<span class="meta">' + esc(w.tekst) +
          (w.soort === 'prijs' ? ' ' + esc(euro(w.was)) + ' &rarr; ' + esc(euro(w.nu)) : '') +
        '</span>' +
      '</div>').join('') +
    '<p class="oms">' + esc(d.opmerking) + '</p>' +
    (d.zonderVergelijking
      ? '<p class="oms meta">Van ' + d.zonderVergelijking + ' van de ' + d.bekeken +
        ' bewaarde regels konden we de beschikbaarheid niet vergelijken; daarover zeggen we dus niets.</p>'
      : '') +
    '</div>';
}

/* ---------- wat je lopen hebt ---------- */

async function tekenBestellingen() {
  let d;
  try { d = await api('/api/mall/bestellingen', {}); }
  catch (e) { $('#bestellingen').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; return; }

  // een kapotte bron eerst, en met naam: stil weglaten is hier het ergste
  const stuk = (d.stuk || []).length
    ? '<div class="kaart"><p class="oms">Van ' + (d.stuk || []).map((s) => esc(s.bron)).join(', ') +
      ' konden we op dit moment niets ophalen. De rest klopt wel.</p></div>'
    : '';

  if (!d.aantal) {
    $('#bestellingen').innerHTML = stuk + '<div class="leeg">Je hebt op dit moment niets lopen.</div>';
    return;
  }
  $('#bestellingen').innerHTML = stuk + '<div class="kaart">' +
    '<p class="oms meta">' + d.loopt + ' lopend &middot; ' + d.klaar + ' afgerond &middot; ' + d.afgezegd + ' afgezegd</p>' +
    d.bestellingen.map((r) =>
      '<div class="regel' + (r.stand === 'afgezegd' ? ' vervallen' : '') + '">' +
        '<span>' + esc(r.soortLabel) + ': ' + esc(r.titel) +
          ' <span class="meta">&middot; ' + esc(r.aanbieder) + '</span></span>' +
        '<span class="meta">' + esc(r.status) +
          (r.bedrag != null ? ' &middot; ' + esc(euro(r.bedrag)) : '') +
          (r.betaald === true ? ' &middot; betaald' : '') +
          ' &middot; <a href="' + esc(r.pagina) + '">bekijken</a></span>' +
      '</div>').join('') +
    '<p class="oms">' + esc(d.opmerking) + '</p>' +
    '</div>';
}

/* ---------- samengesteld aanbod ---------- */

async function tekenCollecties() {
  let d;
  try { d = await api('/api/mall/collecties', {}); }
  catch (e) { $('#collecties').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; return; }
  if (!d.aantal) {
    $('#collecties').innerHTML = '<div class="leeg">Er staat nu niets samengesteld' +
      (d.buitenTijd ? ' &mdash; ' + d.buitenTijd + ' viel(en) buiten de periode van vandaag.' : '.') + '</div>';
    return;
  }
  $('#collecties').innerHTML = d.collecties.map((c) =>
    '<div class="kaart">' +
      '<h3>' + esc(c.titel) + ' <span class="meta">&middot; ' + esc(c.soort) + '</span></h3>' +
      (c.uitleg ? '<p class="oms">' + esc(c.uitleg) + '</p>' : '') +
      (c.van ? '<p class="meta">' + esc(c.van) + (c.tot ? ' t/m ' + esc(c.tot) : '') + (c.tijd ? ' &middot; ' + esc(c.tijd) : '') + '</p>' : '') +
      c.regels.map((r) =>
        '<div class="regel' + (r.weg ? ' vervallen' : '') + '">' +
          '<span>' + esc(r.weg ? r.aanbodId : r.aanbod.titel) + '</span>' +
          (r.weg ? '<span class="waarom">' + esc(r.reden) + '</span>'
            : '<span class="meta">' + (r.aanbod.prijs ? esc(euro(r.aanbod.prijs.bedrag)) : '') + '</span>') +
        '</div>').join('') +
      /* Waarschuwing OF prijs, nooit allebei: een onvolledige bundel toont geen
         prijsvergelijk, want dan koopt iemand een korting die er niet is. */
      (c.waarschuwing
        ? '<p class="oms waarom">' + esc(c.waarschuwing) + '</p>'
        : (c.prijs
          ? '<p class="oms">Los ' + esc(euro(c.prijs.los)) + ', samen ' + esc(euro(c.prijs.bundel)) +
            '. <span class="meta">' + esc(c.prijs.uitleg) + '</span></p>'
          : '')) +
    '</div>').join('');
}

document.addEventListener('DOMContentLoaded', () => {
  tekenBewaard();
  tekenWijzigingen();
  tekenBestellingen();
  tekenCollecties();
});
