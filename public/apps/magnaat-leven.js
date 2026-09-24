/* Magnaat Van Nul (V1 From Zero) in de Magnaat-app: Vandaag, Wereld, Werk,
   Geld, Netwerk en Mijn bedrijf -- dat laatste pas als er een onderneming is.

   Dit scherm REKENT NIETS. Elk bedrag, elke dag en elke mogelijke handeling komt
   van de server (/api/member/magnaat/leven/*), en een weigering komt met haar
   reden terug. De handelingen die nu zin hebben staan in de duimbalk; de eerste
   is de hoofdactie van de Edge. De klok rekent bij op de server: dit scherm
   vraagt alleen opnieuw als er volgens de server een nieuwe dag is. */
(function () {
  'use strict';
  var TOKEN = localStorage.getItem('rtg_member_token');
  if (!TOKEN) return;
  var q = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = new Intl.NumberFormat(document.documentElement.lang || undefined, { style: 'currency', currency: 'EUR' });
  var euro = function (c) { return fmt.format((Number(c) || 0) / 100); };
  var LEVEN = null, KEUZE = null, KLOK = null;
  var FASE = { lead: 'zoekt iets', offerte: 'offerte verstuurd', tegenbod: 'doet een tegenbod', opdracht: 'opdracht loopt',
    klaar: 'werk af, nog factureren', gefactureerd: 'factuur open', betaald: 'betaald', afgewezen: 'geen deal' };

  function vraag(pad, body) {
    return fetch('/api/member/magnaat/leven/' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || 'Van Nul kon dit niet doen.');
        return d;
      }); });
  }
  function meldFout(t) { var e = q('#vnFout'); e.textContent = t; e.hidden = !t; }

  function laad() { return vraag('staat').then(teken).catch(function (e) { meldFout(e.message); }); }
  function doe(body) {
    meldFout('');
    return vraag('actie', body).then(function (s) { KEUZE = null; teken(s); }).catch(function (e) { meldFout(e.message); });
  }

  function klok(s) {
    clearTimeout(KLOK);
    KLOK = setTimeout(laad, Math.max(1000, s.volgendeDagOver + 500));
    var min = Math.ceil(s.volgendeDagOver / 60000);
    q('#vnKlok').textContent = (s.weekend ? 'Weekend' : 'Werkdag') + ' · nog ' + s.uren + ' vrije uur · een nieuwe dag over ' + min + ' min';
  }

  function regels(rijen) {
    return rijen.map(function (r) { return '<div class="vn-regel"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b></div>'; }).join('');
  }

  function invoerVoor(a) {
    var i = a.invoer || {}, velden = '';
    if (i.aanbod) velden += '<select id="vnAanbod">' + LEVEN.wereld.aanbod.map(function (x) {
      return '<option value="' + esc(x.id) + '">' + esc(x.naam) + ' · ' + esc(x.software) + ' ' + euro(x.softwareKosten) + '/mnd</option>'; }).join('') + '</select>';
    if (i.bedrag) velden += '<label>Bedrag in hele euro\'s <input id="vnBedrag" type="number" min="1" step="1" inputmode="numeric"></label>';
    if (i.uren) velden += '<label>Uren <input id="vnUren" type="number" min="1" step="1" value="' + LEVEN.uren + '"></label>';
    if (i.naam) velden += '<label>Naam van je onderneming <input id="vnNaam" maxlength="60"></label>';
    if (i.keuze) {
      return '<p>' + esc(a.waarom) + '</p><div class="vn-knoppen"><button class="btn primary" data-vn-keuze="accepteer">Accepteer</button>' +
        '<label>of een tegenvoorstel <input id="vnBedrag" type="number" min="1" step="1"></label><button class="btn" data-vn-keuze="tegen">Stuur tegenvoorstel</button>' +
        '<button class="btn subtle" data-vn-keuze="weiger">Weiger</button></div>';
    }
    return '<p>' + esc(a.waarom) + '</p><div class="vn-velden">' + velden + '</div><button class="btn primary" data-vn-doe>' + esc(a.label) + '</button>';
  }
  function lichaam(a, keuze) {
    var b = { actie: a.actie }, i = a.invoer || {}, v = function (s) { var e = q(s); return e ? e.value : undefined; };
    if (i.deal) b.deal = i.deal;
    if (i.aanbod) b.aanbod = v('#vnAanbod');
    if (i.bedrag) b.bedrag = Number(v('#vnBedrag'));
    if (i.uren) b.uren = Number(v('#vnUren'));
    if (i.naam) b.naam = v('#vnNaam');
    if (keuze) { b.keuze = keuze; if (keuze === 'tegen') b.bedrag = Number(v('#vnBedrag')); }
    return b;
  }

  function tekenVandaag(s) {
    var v = s.vandaag;
    q('#vnDag').textContent = s.dag;
    q('#vnKas').textContent = euro(s.geld.kas);
    q('#vnKas').classList.toggle('vn-rood', s.geld.kas < 0);
    q('#vnNood').hidden = !v.rood;
    /* De hoofdactie is EEN vaste knop die de Edge overneemt; alleen zijn tekst en
       doel wisselen. Een nieuwe knop per tekening liet de oude in de Edge staan. */
    var hoofd = q('#vnHoofd'), eerste = v.volgende[0];
    hoofd.hidden = !eerste;
    hoofd.textContent = eerste ? eerste.label : '';
    q('#vnActies').innerHTML = v.volgende.length ? v.volgende.slice(1).map(function (a, n) {
      return '<button type="button" class="btn" data-vn-actie="' + (n + 1) + '">' + esc(a.label) + '</button>';
    }).join('') : '<p class="vn-rust">Niets dat nu moet. Wacht op de volgende dag, of kijk rond in je wereld.</p>';
    q('#vnWaarom').innerHTML = v.volgende.map(function (a) { return '<li><b>' + esc(a.label) + '</b> ' + esc(a.waarom) + '</li>'; }).join('');
    var a = KEUZE == null ? null : v.volgende[KEUZE];
    q('#vnInvoer').hidden = !a;
    q('#vnInvoer').innerHTML = a ? invoerVoor(a) : '';
    q('#vnMeldingen').innerHTML = v.meldingen.map(function (m) {
      return '<li class="vn-m vn-s-' + esc(m.soort) + '"><small>dag ' + esc(m.dag) + '</small>' + esc(m.tekst) + '</li>'; }).join('');
    q('#vnRtg').innerHTML = s.rtg.map(function (r) {
      return '<div class="vn-rtg"><b>' + esc(r.naam) + '</b><small>verscheen op dag ' + esc(r.dag) + ' · ' + esc(r.waarom) + '</small></div>'; }).join('');
  }

  function tekenRest(s) {
    q('#vnWereld').innerHTML = '<div class="eyebrow">Van Nul · jouw stad</div><h3>' + esc(s.wereld.stad) + '</h3>' +
      '<p>Wat je naast je baan kunt beginnen, en wat de software ervoor kost.</p>' +
      regels(s.wereld.aanbod.map(function (x) { return [x.naam + (x.gekozen ? ' (jouw project)' : ''), esc(x.software) + ' · ' + euro(x.softwareKosten) + '/mnd']; }));
    var w = s.werk;
    q('#vnWerk').innerHTML = '<div class="eyebrow">Van Nul · je werk</div><h3>' + esc(w.baan.functie) + ' bij ' + esc(w.baan.werkgever) + '</h3>' +
      regels([['Loon, netto op de 25e', euro(w.baan.loon)], ['Eigen project', w.project ? esc(w.project.naam) : 'nog niet begonnen']]) +
      (w.opdrachten.length ? regels(w.opdrachten.map(function (o) { return [o.klant, (o.urenGedaan || 0) + ' van ' + o.uren + ' uur · ' + FASE[o.fase]]; })) : '');
    var g = s.geld;
    q('#vnGeld').innerHTML = regels([['Op je rekening', euro(g.kas)], ['Nog te ontvangen', euro(g.openstaand)],
      ['Lening bij familie', g.lening ? euro(g.lening.restant) + ' open' : 'geen']]) +
      '<h3>Elke maand</h3>' + regels([['Loon', euro(g.vast.loon)], ['Huur', '-' + euro(g.vast.huur)], ['Vaste lasten', '-' + euro(g.vast.vasteLasten)],
        ['Boodschappen en vervoer', '-' + euro(g.vast.levenPerMaand)], ['Software', '-' + euro(g.vast.software)]]) +
      '<h3>Laatste boekingen</h3>' + regels(g.recent.map(function (r) { return [r.datum + ' · ' + r.omschrijving, ((r.labels || []).indexOf('uit') >= 0 ? '-' : '') + euro(r.bedrag)]; })) +
      '<p class="vn-rust">' + (g.klopt ? 'Je saldo is gelijk aan je rekening in het grootboek.' : 'Let op: je saldo wijkt af van het grootboek.') + '</p>';
    q('#vnNetwerk').innerHTML = s.netwerk.contacten.length ? regels(s.netwerk.contacten.map(function (c) {
      return [c.klant + (c.via ? ' (via ' + c.via + ')' : ''), FASE[c.fase] + (c.bedrag ? ' · ' + euro(c.bedrag) : '')]; }))
      : '<p class="vn-rust">Je kent nog niemand die iets zoekt wat jij doet. Begin een project en ga netwerken.</p>';
    var b = s.bedrijf;
    q('#vnNavBedrijf').hidden = !b;
    q('#vnBedrijf').innerHTML = b ? '<h3>' + esc(b.naam) + '</h3><p>Ingeschreven op dag ' + esc(b.sinds) + '.</p>' +
      regels([['Omzet', euro(b.omzet)], ['Openstaand', euro(b.openstaand)]]) + '<h3>Facturen</h3>' +
      regels(b.facturen.map(function (f) { return [f.nummer + ' · ' + f.klant, euro(f.bedrag) + ' · ' + (f.betaaldOp ? 'betaald op dag ' + f.betaaldOp : f.teLaat ? f.teLaat + ' dagen te laat' : 'vervalt dag ' + f.vervaldag)]; }))
      : '';
  }

  function teken(s) { LEVEN = s; tekenVandaag(s); tekenRest(s); klok(s); }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-vn-actie],[data-vn-doe],[data-vn-keuze]');
    if (!t || !LEVEN) return;
    if (t.dataset.vnActie != null) {
      var n = Number(t.dataset.vnActie), a = LEVEN.vandaag.volgende[n];
      if (!a.invoer) { doe({ actie: a.actie }); return; }
      KEUZE = n; tekenVandaag(LEVEN); return;
    }
    var gekozen = LEVEN.vandaag.volgende[KEUZE];
    if (gekozen) doe(lichaam(gekozen, t.dataset.vnKeuze));
  });
  laad();
}());
