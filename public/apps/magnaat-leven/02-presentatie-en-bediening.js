  /* Wie een eigen hoofdactie heeft (#vnHoofd, data-hoofdactie), zegt ook zelf
     waar je bent (EDGE.md par. 8, besluit 11). De adaptieve laag laadt met
     defer, dus bij de eerste tekening kan hij er nog niet zijn: daarom ook bij
     DOMContentLoaded. */
  function meldContext() {
    if (window.RTGAdaptief) window.RTGAdaptief.context({ bron: 'spel.magnaat', titel: 'Magnaat' });
  }
  document.addEventListener('DOMContentLoaded', meldContext);

  function tekenVandaag(s) {
    var v = s.vandaag;
    q('#vnDag').textContent = s.dagNaam + ', dag ' + s.dag;
    q('#vnKas').textContent = euro(s.geld.bank);
    q('#vnAandacht').innerHTML = v.aandacht.map(function (x) { return '<li class="vn-a vn-s-' + esc(x.soort) + '">' + esc(x.tekst) + '</li>'; }).join('');
    var hoofd = q('#vnHoofd'), eerste = v.volgende[0];
    hoofd.hidden = !eerste;
    hoofd.textContent = eerste ? eerste.label : '';
    meldContext();
    q('#vnActies').innerHTML = v.volgende.slice(1).map(function (a, n) {
      return '<button type="button" class="btn" data-vn-actie="' + (n + 1) + '">' + esc(a.label) + '</button>';
    }).join('');
    q('#vnWaarom').innerHTML = v.volgende.map(function (a) { return '<li><b>' + esc(a.label) + '</b> ' + esc(a.waarom) + '</li>'; }).join('');
    var a = KEUZE == null ? null : v.volgende[KEUZE];
    q('#vnInvoer').hidden = !a;
    q('#vnInvoer').innerHTML = a ? invoerVoor(a) : '';
    tekenAgenda(s);
    /* De laatste acht meteen; de rest achter een klik, anders is Vandaag op een telefoon vooral geschiedenis. */
    var li = function (m) { return '<li class="vn-m vn-s-' + esc(m.soort) + '"><small>dag ' + esc(m.dag) + '</small>' + esc(m.tekst) + '</li>'; };
    q('#vnMeldingen').innerHTML = v.meldingen.slice(0, 8).map(li).join('') + (v.meldingen.length > 8
      ? '<li><details class="vn-meer"><summary>Eerder (' + (v.meldingen.length - 8) + ')</summary><ol class="vn-meldingen">' + v.meldingen.slice(8).map(li).join('') + '</ol></details></li>' : '');
    q('#vnRtg').innerHTML = s.rtg.map(function (r) {
      return '<div class="vn-rtg"><b>' + esc(r.naam) + '</b><small>verscheen op dag ' + esc(r.dag) + ' · ' + esc(r.waarom) + '</small></div>'; }).join('');
  }

  function teken(s) {
    if (!(s && typeof s.dagNaam === 'string' && Number.isFinite(s.dag) && s.geld && Number.isFinite(s.geld.bank) &&
      s.vandaag && Array.isArray(s.vandaag.aandacht) && Array.isArray(s.vandaag.volgende) &&
      s.vandaag.aandacht.every(function(x){ return x && typeof x.soort==='string' && typeof x.tekst==='string'; }) &&
      s.vandaag.volgende.every(function(a){ return a && typeof a.label==='string' && typeof a.waarom==='string'; }) &&
      Array.isArray(s.vandaag.meldingen) && s.vandaag.meldingen.every(function(m){return m && typeof m.tekst==='string' && typeof m.soort==='string' && Number.isFinite(m.dag);}) &&
      Array.isArray(s.vandaag.agenda) && s.vandaag.agenda.every(function(d){ return d && typeof d.naam==='string' && Number.isFinite(d.dag) && Number.isFinite(d.rest) &&
        Array.isArray(d.items) && d.items.every(function(x){return x && typeof x.naam==='string' && typeof x.wat==='string' && Number.isFinite(x.minuten);}) &&
        Array.isArray(d.betalingen) && d.betalingen.every(function(p){return p && typeof p.naam==='string' && Number.isFinite(p.bedrag);}); }) &&
      Array.isArray(s.rtg) && s.rtg.every(function(r){return r && typeof r.naam==='string' && Number.isFinite(r.dag);}) &&
      s.werk && s.netwerk && Array.isArray(s.netwerk.contacten) && s.wereld)) {
      nietBeschikbaar(); return;
    }
    herstel.hidden = true; meldFout('');
    eigenBlokkades.forEach(function(b){ b.disabled=false; }); eigenBlokkades.clear();
    LEVEN = s;
    tekenVandaag(s);
    var hulp = { q: q, esc: esc, euro: euro, duur: duur };
    if (window.RTGMagnaatLevenSchermen) window.RTGMagnaatLevenSchermen.teken(s, hulp);
    if (window.RTGMagnaatLevenBedrijf) window.RTGMagnaatLevenBedrijf.teken(s, hulp);
    if (window.RTGMagnaatLevenVerhaal) window.RTGMagnaatLevenVerhaal.teken(s, hulp);
    klok(s);
  }

  document.addEventListener('change', function (e) {
    if (e.target.id === 'vnTempo') doe({ actie: 'tempo', stand: e.target.value });
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-vn-actie],[data-vn-doe],[data-vn-schrap],[data-vn-opnieuw]');
    if (!t || !LEVEN) return;
    /* Opnieuw beginnen gooit een leven weg en kan niet terug: de eerste tik vraagt
       het, de tweede doet het. */
    if (t.dataset.vnOpnieuw != null) {
      if (t.dataset.zeker) { var nv = q('#vnNiveau'), ns = q('#vnStart'); doe({ actie: 'opnieuw', zeker: true, moeilijkheid: nv ? nv.value : undefined, begin: ns ? ns.value : undefined }); return; }
      t.dataset.zeker = '1';
      t.textContent = 'Ja, gooi dit leven weg en begin opnieuw';
      return;
    }
    if (t.dataset.vnSchrap) { var p = t.dataset.vnSchrap.split(':'); doe({ actie: 'schrap', dag: Number(p[0]), index: Number(p[1]) }); return; }
    if (t.dataset.vnActie != null) {
      var n = Number(t.dataset.vnActie), a = LEVEN.vandaag.volgende[n];
      if (!a) return;
      if (vrijeInvoer(a)) { doe(lichaam(a)); return; }
      KEUZE = n; tekenVandaag(LEVEN); return;
    }
    var gekozen = LEVEN.vandaag.volgende[KEUZE];
    if (gekozen) doe(lichaam(gekozen));
  });
  window.RTGMagnaatLeven = { laad: laad };
  laad();
}());
