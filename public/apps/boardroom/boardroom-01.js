/* De boardroom van het lid: haalt het schakelbord op (/api/member/boardroom) en
   laat elke functie aan/uitzetten. Geen inline handlers (nonce-CSP); de
   schakelaars praten meteen met de server, zodat de stand overal meereist.

   Vier dingen die dit scherm serieus maken in plaats van een rij vinkjes:

   1. HET ZEGT WAT ER GEBEURT. Lukt een schakeling niet, dan springt de knop
      niet stilletjes terug: er staat waarom. Een instelling die soms wel en
      soms niet blijft staan, zonder uitleg, is erger dan geen instelling.

   2. HET WEET VAN JE ANDERE TOESTEL. Elk bord draagt een versie; die sturen we
      mee. Heeft je telefoon ondertussen iets omgezet, dan krijgen we de verse
      stand terug in plaats van dat we die overschrijven, en zeggen we het.

   3. BEHEERD IS ZICHTBAAR. Wat RTG platform-breed heeft dichtgezet, staat er
      grijs bij met de reden. Zichtbaar en niet te schakelen, in plaats van een
      knop die niets doet.

   4. ER IS EEN SPOOR. Onderaan staat wat er is veranderd en wanneer -- ook wat
      een ouder op het bord van een kind heeft omgezet.

   Toegankelijk: elke schakelaar is een echte role="switch" met aria-checked, en
   uitkomsten gaan door een aria-live-gebied, zodat een schermlezer meekrijgt
   wat er verandert. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var bordNu = null;      // het laatst ontvangen bord (met versie)
  var bezig = false;

  function token() { try { return localStorage.getItem('rtg_member_token') || ''; } catch (e) { return ''; } }
  function post(pad, body) {
    return fetch(pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d || {} }; });
    });
  }

  var meldTimer = null;
  function zeg(tekst, soort) {
    var el = $('melder');
    if (!el) return;
    el.textContent = tekst || '';
    el.className = 'melder' + (tekst ? ' zien' : '') + (soort ? ' ' + soort : '');
    if (meldTimer) clearTimeout(meldTimer);
    if (tekst) meldTimer = setTimeout(function () { el.className = 'melder'; el.textContent = ''; }, 6000);
  }

  /* Eén plek waar een antwoord van de server wordt gelezen. Een botsing (409 met
     een vers bord) is geen fout maar nieuws: we tonen de verse stand. */
  function verwerk(r, gelukt) {
    if (r.d && r.d.bord) { bordNu = r.d.bord; teken(); }
    if (r.status === 200) { if (gelukt) zeg(gelukt, 'goed'); return true; }
    if (r.d && r.d.conflict) { zeg(r.d.error || 'Je boardroom is elders gewijzigd; dit is de verse stand.', 'let'); return false; }
    if (r.status === 429) { zeg(r.d.error || 'Even wachten, er gingen te veel wijzigingen achter elkaar.', 'let'); return false; }
    zeg((r.d && r.d.error) || 'Dat lukte niet. Probeer het zo opnieuw.', 'fout');
    return false;
  }

  function schakel(fn) {
    var knop = document.createElement('button');
    knop.type = 'button';
    knop.className = 'sw';
    knop.setAttribute('role', 'switch');
    knop.setAttribute('aria-checked', fn.aan ? 'true' : 'false');
    knop.setAttribute('aria-label', fn.naam);
    var track = document.createElement('span'); track.className = 'track';
    var dot = document.createElement('span'); dot.className = 'dot';
    knop.appendChild(track); knop.appendChild(dot);

    if (fn.beheerd || fn.vast) {
      knop.disabled = true;
      knop.title = fn.beheerd ? fn.reden : 'Hoort bij de basis van je toestel.';
      return knop;
    }
    knop.addEventListener('click', function () {
      if (bezig) return;
      var naar = knop.getAttribute('aria-checked') !== 'true';
      bezig = true; knop.disabled = true;
      post('/api/member/boardroom/zet', { id: fn.id, aan: naar, versie: bordNu ? bordNu.versie : undefined })
        .then(function (r) { verwerk(r, '"' + fn.naam + '" staat nu ' + (naar ? 'aan' : 'uit') + '.'); })
        .catch(function () { zeg('Geen verbinding. Je wijziging is niet bewaard.', 'fout'); })
        .then(function () { bezig = false; knop.disabled = false; });
    });
    return knop;
  }

  function rij(fn) {
    var r = document.createElement('div');
    r.className = 'fn' + (fn.beheerd ? ' beheerd' : '');
    var t = document.createElement('div'); t.className = 'tekst';
    var n = document.createElement('div'); n.className = 'naam'; n.textContent = fn.naam;
    if (fn.beheerd) { var b = document.createElement('span'); b.className = 'merk'; b.textContent = 'beheerd door RTG'; n.appendChild(b); }
    else if (fn.vast) { var v = document.createElement('span'); v.className = 'merk'; v.textContent = 'altijd aan'; n.appendChild(v); }
    t.appendChild(n);
    var uitleg = fn.beheerd ? fn.reden : fn.uitleg;
    if (uitleg) { var u = document.createElement('div'); u.className = 'uit'; u.textContent = uitleg; t.appendChild(u); }
    r.appendChild(t);
    r.appendChild(schakel(fn));
    return r;
  }

  function allesUit(aan) {
    if (bezig || !bordNu) return;
    var standen = {};
    bordNu.categorieen.forEach(function (c) {
      c.functies.forEach(function (f) { if (!f.beheerd && !f.vast) standen[f.id] = aan; });
    });
    bezig = true;
    post('/api/member/boardroom/zetveel', { standen: standen, versie: bordNu.versie })
      .then(function (r) {
        verwerk(r, r.d && r.d.gewijzigd
          ? r.d.gewijzigd + ' functie(s) staan nu ' + (aan ? 'aan' : 'uit') + '.'
          : 'Er viel niets om te zetten.');
      })
      .catch(function () { zeg('Geen verbinding. Er is niets veranderd.', 'fout'); })
      .then(function () { bezig = false; });
  }

  function herstel() {
    if (bezig || !bordNu) return;
    bezig = true;
    post('/api/member/boardroom/herstel', { versie: bordNu.versie })
      .then(function (r) {
        verwerk(r, r.d && r.d.hersteld
          ? r.d.hersteld + ' functie(s) terug op de standaard.'
          : 'Alles stond al op de standaard.');
      })
      .catch(function () { zeg('Geen verbinding. Er is niets veranderd.', 'fout'); })
      .then(function () { bezig = false; });
  }

  function acties() {
    var wrap = document.createElement('div'); wrap.className = 'acties';
    [['Alles aan', function () { allesUit(true); }],
     ['Alles uit', function () { allesUit(false); }],
     ['Terug naar standaard', herstel]
    ].forEach(function (a) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'knop';
      b.textContent = a[0];
      b.addEventListener('click', a[1]);
      wrap.appendChild(b);
    });
    return wrap;
  }

  function teken() {
    var doel = $('bord'); if (!doel || !bordNu) return;
    doel.textContent = '';
    doel.appendChild(acties());
    (bordNu.categorieen || []).forEach(function (cat) {
      var g = document.createElement('section'); g.className = 'groep';
      var h = document.createElement('h2'); h.textContent = cat.naam; g.appendChild(h);
      if (cat.uitleg) { var gu = document.createElement('div'); gu.className = 'gu'; gu.textContent = cat.uitleg; g.appendChild(gu); }
      cat.functies.forEach(function (fn) { g.appendChild(rij(fn)); });
      doel.appendChild(g);
    });
    tekenVoet();
    laadLogboek();
  }

