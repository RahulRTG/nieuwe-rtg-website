/* DE REGIE VAN DE ZAAK -- één weergave, twee huizen.

   Dit scherm hangt in de zaak-app (leverancier.html) én in de personeels-app
   (personeel.html, de PDA). Dat is met opzet één module en geen twee: de
   uitzonderingenrij die een medewerker op de vloer ziet, MOET dezelfde lijst
   zijn die de manager op kantoor ziet. Twee implementaties van hetzelfde
   scherm lopen uiteen -- niet misschien, maar zeker, en dan wijst de een naar
   de ander.

   WAT WEL VERSCHILT IS DE WEERGAVE, niet de inhoud. Met `compact: true` wordt
   het een telefoonscherm: één kolom, grote raakvlakken, en alleen de drie
   dingen die je met een duim doet -- kijken wat er speelt, iets op de lijst
   zetten, en een uitzondering oppakken. Instellingen en het spoor staan daar
   niet; die horen op een scherm waar je bij zit.

   EN HET SCHERM VERZINT NIETS OVER RECHTEN. Wat een medewerker mag, bepaalt de
   server (managerOnly). Dit scherm vraagt het één keer op en verbergt wat niet
   mag -- maar als het zich zou vergissen, weigert de server alsnog. Een knop
   verbergen is netheid; de grendel zit aan de andere kant. */
(function (w, d) {
  'use strict';
  if (w.RTGZaakCommand) return;

  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  };
  var MND = ['', 'jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  function tijd(s) {
    if (!s) return '';
    var x = new Date(s);
    if (isNaN(x)) return String(s).slice(0, 16);
    return x.getDate() + ' ' + MND[x.getMonth() + 1] + ' ' + x.getHours() + ':' + String(x.getMinutes()).padStart(2, '0');
  }
  var NIVEAU = { auto: 'vanzelf', assist: 'met hulp', hand: 'zelf doen' };
  function nv(n) { return '<span class="zc-nv zc-' + esc(n) + '">' + esc(NIVEAU[n] || n) + '</span>'; }

  var CSS =
    '.zc{font-family:Inter,system-ui,sans-serif;color:var(--txt,#F4F1EC);}' +
    '.zc h3{font-family:"Bodoni Moda",Georgia,serif;font-weight:500;font-size:1.05rem;margin:0 0 .3rem;}' +
    '.zc .zc-rail{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:1rem;}' +
    '.zc .zc-rail button{background:transparent;border:1px solid var(--line,rgba(255,255,255,.16));border-radius:999px;' +
      'color:inherit;font:inherit;font-size:.8rem;padding:.4rem .9rem;cursor:pointer;}' +
    '.zc .zc-rail button[aria-current]{background:var(--card2,rgba(255,255,255,.06));border-color:var(--gold,#A98F1C);}' +
    '.zc .zc-kaart{background:var(--card,rgba(255,255,255,.04));border:1px solid var(--line,rgba(255,255,255,.16));' +
      'border-radius:14px;padding:.9rem 1rem;margin-bottom:.7rem;}' +
    '.zc .zc-meta{font-size:.76rem;color:var(--soft,rgba(244,241,236,.55));line-height:1.5;}' +
    '.zc .zc-rij{display:flex;gap:.45rem;flex-wrap:wrap;align-items:center;margin-top:.6rem;}' +
    '.zc .zc-knop{background:transparent;border:1px solid var(--line,rgba(255,255,255,.16));border-radius:999px;' +
      'color:inherit;font:inherit;font-size:.8rem;padding:.4rem .85rem;cursor:pointer;}' +
    '.zc .zc-knop.vol{background:var(--gold,#A98F1C);border-color:var(--gold,#A98F1C);color:#1C1608;font-weight:600;}' +
    '.zc .zc-knop:disabled{opacity:.45;cursor:default;}' +
    '.zc .zc-veld{background:var(--card2,rgba(255,255,255,.06));border:1px solid var(--line,rgba(255,255,255,.16));' +
      'border-radius:10px;color:inherit;font:inherit;font-size:.85rem;padding:.45rem .7rem;}' +
    '.zc .zc-tegels{display:grid;grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr));gap:.6rem;margin-bottom:.9rem;}' +
    '.zc .zc-tegel{background:var(--card,rgba(255,255,255,.04));border:1px solid var(--line,rgba(255,255,255,.16));' +
      'border-radius:12px;padding:.7rem .8rem;}' +
    '.zc .zc-tegel b{display:block;font-family:"Bodoni Moda",Georgia,serif;font-size:1.5rem;font-variant-numeric:tabular-nums;}' +
    '.zc .zc-tegel span{display:block;font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;' +
      'color:var(--soft,rgba(244,241,236,.55));}' +
    '.zc .zc-sig{border-left:3px solid var(--line,rgba(255,255,255,.16));padding-left:.7rem;margin:.55rem 0;}' +
    '.zc .zc-sig.rood{border-left-color:#C23A5E;} .zc .zc-sig.amber{border-left-color:#C99A2E;}' +
    '.zc .zc-nv{display:inline-block;font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;' +
      'border:1px solid var(--line,rgba(255,255,255,.16));border-radius:999px;padding:.05rem .45rem;}' +
    '.zc .zc-auto{border-color:#4C9A75;color:#4C9A75;} .zc .zc-assist{border-color:#C99A2E;color:#C99A2E;}' +
    '.zc .zc-hand{border-color:#C23A5E;color:#C23A5E;}' +
    '.zc .zc-leeg{color:var(--soft,rgba(244,241,236,.55));padding:1.6rem 0;font-size:.88rem;}' +
    /* de duimstand: één kolom, grotere raakvlakken, geen tabelwerk */
    '.zc.zc-klein .zc-tegels{grid-template-columns:1fr 1fr;}' +
    '.zc.zc-klein .zc-knop{padding:.6rem 1rem;font-size:.85rem;}' +
    '.zc.zc-klein .zc-rail button{padding:.55rem 1rem;font-size:.85rem;}';

  var stijlGezet = false;
  function stijl() {
    if (stijlGezet) return;
    stijlGezet = true;
    var s = d.createElement('style'); s.textContent = CSS;
    (d.head || d.documentElement).appendChild(s);
  }

  w.RTGZaakCommand = { esc: esc, tijd: tijd, nv: nv, stijl: stijl, delen: {} };
})(window, document);
/* De Regie van de zaak, deel 2: de werkplekken zelf.

   VIER OP EEN GROOT SCHERM, DRIE OP EEN TELEFOON. Wat er op de telefoon
   ontbreekt (instellingen, spoor) is niet weggelaten omdat het onbelangrijk is
   maar omdat je het niet met een duim doet tussen twee tafels door.

   ELKE LIJST ZEGT WAT HIJ NIET WEET. Nul signalen is "er wacht niets op u" en
   niet een leeg vlak; nul te herstellen gevallen is "er staat niets scheef".
   Een leeg scherm zonder tekst laat je twijfelen of het geladen heeft. */
(function (w, d) {
  'use strict';
  var Z = w.RTGZaakCommand;
  if (!Z || Z.toon) return;
  var esc = Z.esc, tijd = Z.tijd, nv = Z.nv;

  function toon(el, opties) {
    Z.stijl();
    var o = opties || {};
    var api = o.api;                      // (pad, body) -> Promise
    var compact = !!o.compact;
    /* `mag` komt van het huis dat dit scherm ophangt: de zaak-app weet of de
       ingelogde persoon manager is. Verbergen is netheid -- de grendel zit op de
       server (managerOnly), dus een vergissing hier geeft hooguit een knop die
       een nette weigering oplevert, nooit een handeling die niet mocht. */
    var S = { werkplek: 'nu', start: null, zoekterm: '', object: null, plan: null, mag: o.mag !== false };

    var WERKPLEKKEN;
    WERKPLEKKEN = compact
      ? [['nu', 'Nu'], ['lijst', 'Lijst'], ['zoek', 'Zoeken']]
      : [['nu', 'Nu'], ['lijst', 'Uitzonderingen'], ['recht', 'Rechtzetten'], ['zoek', 'Zoeken'], ['regels', 'Instellingen']];

    el.className = 'zc' + (compact ? ' zc-klein' : '');
    el.innerHTML = '<div class="zc-rail"></div><div class="zc-vak"><div class="zc-leeg">Laden…</div></div>';
    var rail = el.querySelector('.zc-rail'), vak = el.querySelector('.zc-vak');

    function melden(t) { if (o.meld) o.meld(t); }
    function railTeken() {
      rail.innerHTML = WERKPLEKKEN.map(function (p) {
        return '<button data-w="' + p[0] + '"' + (S.werkplek === p[0] ? ' aria-current="page"' : '') + '>' + esc(p[1]) + '</button>';
      }).join('');
      rail.querySelectorAll('[data-w]').forEach(function (b) {
        b.onclick = function () { S.werkplek = b.dataset.w; railTeken(); teken(); };
      });
    }

    function ververs() {
      return api('start').then(function (dd) { S.start = dd; return dd; });
    }

    /* EEN TABEL EN GEEN KETEN VAN IFS, en dat is hier geen stijlkwestie: de
       werkplekken staan in twee bestanden (dit deel en deel 3), en die zijn
       twee aparte omhulsels. Een `if (x === 'zoek') return zoek()` zou hier
       verwijzen naar een naam die in dit omhulsel niet bestaat -- een fout die
       pas valt op het moment dat iemand op die knop drukt, en die geen enkele
       servertoets ziet. Deel 3 hangt zijn tekenaars in deze tabel. */
    var TEKENAARS = {};
    function teken() {
      var f = TEKENAARS[S.werkplek];
      if (!f) { vak.innerHTML = '<div class="zc-leeg">Die werkplek bestaat niet.</div>'; return; }
      try { f(); } catch (e) { vak.innerHTML = '<div class="zc-leeg">Dit scherm kon niet worden getekend: ' + esc(e.message) + '</div>'; }
    }

    /* ---- Nu: wat er speelt ---- */
    function nu() {
      var st = S.start;
      if (!st) { vak.innerHTML = '<div class="zc-leeg">Laden…</div>'; return; }
      var p = st.puls;
      var u = '<div class="zc-tegels">' +
        tegel(p.stand, 'stand') + tegel(p.signalen.length, 'wacht op u') +
        tegel(p.herstel.kandidaten, 'recht te zetten') + tegel(p.uitzonderingen.open, 'op de lijst') + '</div>';

      u += '<div class="zc-kaart"><h3>Wat op u wacht</h3>';
      if (!p.signalen.length) u += '<p class="zc-meta">Er wacht niets op u. Dat is een uitslag, geen leeg scherm.</p>';
      for (var i = 0; i < p.signalen.length; i++) {
        var s = p.signalen[i];
        u += '<div class="zc-sig ' + esc(s.niveau) + '"><div>' + esc(s.nl) + '</div>' +
          '<div class="zc-meta">' + esc(s.beslissing) + '</div>' +
          '<div class="zc-rij"><button class="zc-knop" data-sig="' + esc(s.id) + '">Zet op de lijst</button></div></div>';
      }
      u += '</div>';

      if (p.herstel.kandidaten) {
        u += '<div class="zc-kaart"><h3>Recht te zetten</h3>' +
          '<p class="zc-meta">Dit gaat alleen over de administratie: een status die achterloopt op wat er al gebeurd is. ' +
          'Er verandert niets aan uw werk, alleen aan wat het systeem erover zegt.</p>';
        for (var j = 0; j < p.herstel.lijst.length; j++) {
          var rb = p.herstel.lijst[j];
          if (!rb.kandidaten) continue;
          u += '<div class="zc-sig"><div><b>' + rb.kandidaten + '×</b> ' + esc(rb.naam) + ' ' + nv(rb.oordeel.niveau) + '</div>' +
            '<div class="zc-meta">' + esc(rb.wat) + '</div></div>';
        }
        if (!compact && S.mag) u += '<div class="zc-rij"><button class="zc-knop vol" data-alles="1">Zet alles recht wat veilig kan</button></div>';
        u += '</div>';
      }
      vak.innerHTML = u;
      bindNu();
    }
    function tegel(v, l) { return '<div class="zc-tegel"><b>' + esc(v) + '</b><span>' + esc(l) + '</span></div>'; }

    function bindNu() {
      vak.querySelectorAll('[data-sig]').forEach(function (b) {
        b.onclick = function () {
          b.disabled = true;
          api('signaal/oppakken', { id: b.dataset.sig })
            .then(function (r) { melden(r.bestond ? 'Stond al op de lijst.' : 'Op de lijst gezet.'); return ververs(); })
            .then(function () { S.werkplek = 'lijst'; railTeken(); teken(); })
            .catch(function (e) { b.disabled = false; melden(e.message); });
        };
      });
      var alles = vak.querySelector('[data-alles]');
      if (alles) alles.onclick = function () {
        var reden = prompt('Waarom zet u dit recht? (komt in het spoor van de zaak)');
        if (!reden) return;
        alles.disabled = true;
        api('operator/plan', { q: 'wat kan er rechtgezet worden?' })
          .then(function (r) { return api('operator/uitvoeren', { plan: r.plan.id, reden: reden }); })
          .then(function (r) { melden(r.hersteld + ' rechtgezet.'); return ververs(); })
          .then(teken)
          .catch(function (e) { alles.disabled = false; melden(e.message); });
      };
    }

    /* ---- de uitzonderingenrij ---- */
    function lijst() {
      vak.innerHTML = '<div class="zc-leeg">Laden…</div>';
      api('zaken', { max: 40 }).then(function (dd) {
        var u = '';
        if (dd.leerpunten && dd.leerpunten.length && !compact) {
          u += '<div class="zc-kaart"><h3>Wat zich herhaalt</h3>';
          u += dd.leerpunten.map(function (l) {
            return '<div class="zc-sig"><b>' + esc(l.oorzaak) + ' → ' + esc(l.besluit) + '</b> <span class="zc-meta">' + l.aantal + '×</span></div>';
          }).join('');
          u += '</div>';
        }
        if (!dd.zaken.length) u += '<div class="zc-leeg">Niets op de lijst. Alles wat er was, is afgehandeld.</div>';
        u += dd.zaken.map(function (z) {
          return '<div class="zc-kaart"><h3>' + esc(z.titel) + '</h3>' +
            '<p class="zc-meta">' + esc(z.status) + (z.eigenaar ? ' · ' + esc(z.eigenaar) : ' · nog niemand') +
            ' · geopend ' + esc(tijd(z.at)) + ' · termijn ' + esc(tijd(z.termijn)) + '</p>' +
            (z.besluit ? '<p class="zc-meta">Besluit: ' + esc(z.besluit.keuze) + ' -- ' + esc(z.besluit.reden) + '</p>'
              : '<div class="zc-rij">' +
                (z.eigenaar ? '' : '<button class="zc-knop" data-neem="' + esc(z.id) + '">Ik pak hem op</button>') +
                (S.mag ? '<input class="zc-veld" data-k="' + esc(z.id) + '" placeholder="besluit" style="min-width:8rem;">' +
                  '<input class="zc-veld" data-r="' + esc(z.id) + '" placeholder="waarom" style="flex:1;min-width:9rem;">' +
                  '<button class="zc-knop vol" data-bes="' + esc(z.id) + '">Klaar</button>' : '') +
                '</div>') +
            '</div>';
        }).join('');
        vak.innerHTML = u;
        vak.querySelectorAll('[data-neem]').forEach(function (b) {
          b.onclick = function () { api('zaak/neem', { id: b.dataset.neem }).then(function () { melden('Opgepakt.'); lijst(); }).catch(function (e) { melden(e.message); }); };
        });
        vak.querySelectorAll('[data-bes]').forEach(function (b) {
          b.onclick = function () {
            var id = b.dataset.bes;
            api('zaak/besluit', { id: id, keuze: vak.querySelector('[data-k="' + id + '"]').value,
              reden: vak.querySelector('[data-r="' + id + '"]').value })
              .then(function () { melden('Afgehandeld.'); return ververs(); }).then(lijst).catch(function (e) { melden(e.message); });
          };
        });
      }).catch(function (e) { vak.innerHTML = '<div class="zc-leeg">' + esc(e.message) + '</div>'; });
    }

    TEKENAARS.nu = nu;
    TEKENAARS.lijst = lijst;

    /* De rest van de werkplekken (zoeken, dossier, rechtzetten, instellingen)
       staat in deel 3. Ontbreekt dat deel, dan blijven Nu en de lijst gewoon
       werken en verdwijnen de andere knoppen -- beter een kleiner scherm dan
       een scherm dat op de eerste klik omvalt. */
    if (typeof Z.delen.rest === 'function') {
      Z.delen.rest({ el: el, vak: vak, S: S, api: api, compact: compact, TEKENAARS: TEKENAARS,
        teken: teken, railTeken: railTeken, ververs: ververs, melden: melden, tegel: tegel });
    } else {
      WERKPLEKKEN = WERKPLEKKEN.filter(function (p) { return TEKENAARS[p[0]]; });
    }

    railTeken();
    ververs().then(function () { teken(); }).catch(function (e) {
      vak.innerHTML = '<div class="zc-leeg">De regie kon niet laden: ' + esc(e.message) + '</div>';
    });
    return { ververs: function () { return ververs().then(teken); } };
  }

  Z.toon = toon;
})(window, document);
/* De Regie van de zaak, deel 3: zoeken en het objectdossier.

   HET DOSSIER IS DE REDEN DAT DIT SCHERM BESTAAT. Een bestelling opzoeken kan
   in de orderlijst ook; wat hier bij komt is de SAMENHANG -- welke andere
   dingen van deze zaak aan dit ene object hangen, en wat er precies mee
   gebeurd is, in volgorde, met wie het deed. Dat stond tot nu toe verspreid
   over zes tabbladen.

   EN HET ZEGT WAT HET NIET WEET. Is de samenhangscan tegen zijn grens gelopen,
   dan staat dat er. Wat hier NIET kan staan is iets van een andere zaak: dit
   scherm vraagt het aan een register dat de buurman niet kent.

   Rechtzetten en de regels staan in deel 4. */
(function (w) {
  'use strict';
  var Z = w.RTGZaakCommand;
  if (!Z) return;
  var esc = Z.esc, tijd = Z.tijd, nv = Z.nv;

  Z.delen.rest = function (b) {
    var vak = b.vak, S = b.S, api = b.api, T = b.TEKENAARS;

    /* ---- zoeken binnen de eigen zaak ---- */
    T.zoek = function () {
      vak.innerHTML = '<div class="zc-kaart"><h3>Zoek in uw zaak</h3>' +
        '<p class="zc-meta">Bestelnummer, tafel, kamer, naam of status. Alleen wat van uw zaak is.</p>' +
        '<div class="zc-rij"><input class="zc-veld" id="zcQ" placeholder="zoeken…" style="flex:1;min-width:10rem;" value="' + esc(S.zoekterm) + '">' +
        '<button class="zc-knop vol" id="zcGa">Zoek</button></div></div><div id="zcUit"></div>';
      var inp = vak.querySelector('#zcQ');
      var doe = function () {
        S.zoekterm = inp.value;
        if (!S.zoekterm.trim()) return;
        vak.querySelector('#zcUit').innerHTML = '<div class="zc-leeg">Zoeken…</div>';
        api('zoek', { q: S.zoekterm }).then(function (d) {
          vak.querySelector('#zcUit').innerHTML = zoekuit(d);
          vak.querySelectorAll('#zcUit [data-t]').forEach(function (x) {
            x.onclick = function () { S.object = { type: x.dataset.t, id: x.dataset.i, data: null }; S.werkplek = 'object'; b.teken(); };
          });
        }).catch(function (e) { vak.querySelector('#zcUit').innerHTML = '<div class="zc-leeg">' + esc(e.message) + '</div>'; });
      };
      vak.querySelector('#zcGa').onclick = doe;
      inp.onkeydown = function (e) { if (e.key === 'Enter') doe(); };
      if (S.zoekterm.trim()) doe();
    };

    function zoekuit(d) {
      if (d.kort) return '<div class="zc-leeg">Een zoekterm van minstens twee tekens, graag.</div>';
      if (!d.groepen.length) {
        return '<div class="zc-kaart"><h3>Niets gevonden</h3><p class="zc-meta">Er is gekeken in: ' +
          esc((d.bereik || []).map(function (x) { return x.meervoud; }).join(', ')) + '.</p></div>';
      }
      return d.groepen.map(function (g) {
        return '<div class="zc-kaart"><h3>' + esc(g.label) + ' <span class="zc-meta">· ' + g.totaal + '</span></h3>' +
          g.rijen.map(function (r) {
            return '<div class="zc-sig"><button class="zc-knop" data-t="' + esc(r.type) + '" data-i="' + esc(r.id) + '" ' +
              'style="border:none;padding:0;text-align:left;"><b>' + esc(r.titel) + '</b></button>' +
              (r.sub ? '<div class="zc-meta">' + esc(r.sub) + '</div>' : '') + '</div>';
          }).join('') + '</div>';
      }).join('');
    }

    /* ---- het objectdossier ---- */
    T.object = function () {
      var o = S.object;
      if (!o) { vak.innerHTML = '<div class="zc-leeg">Geen object gekozen.</div>'; return; }
      if (!o.data) {
        vak.innerHTML = '<div class="zc-leeg">Dossier laden…</div>';
        api('object', { type: o.type, id: o.id }).then(function (d) { o.data = d; b.teken(); })
          .catch(function (e) { vak.innerHTML = '<div class="zc-leeg">' + esc(e.message) + '</div>'; });
        return;
      }
      var d = o.data;
      var u = '<button class="zc-knop" id="zcTerug">← terug</button>' +
        '<div class="zc-kaart" style="margin-top:.7rem;"><h3>' + esc(d.object.titel) + '</h3>' +
        '<p class="zc-meta">' + esc(d.object.label) + ' ' + esc(d.object.id) + (d.object.sub ? ' · ' + esc(d.object.sub) : '') + '</p></div>';

      u += '<div class="zc-kaart"><h3>Wat er kan</h3>';
      u += d.acties.map(function (a) {
        return '<div class="zc-sig"><div><b>' + esc(a.naam) + '</b> ' + nv(a.niveau) + '</div>' +
          '<div class="zc-meta">' + esc(a.waaromNiet || a.wat) + '</div>' +
          (a.soort === 'runbook' && a.past && S.mag ? '<div class="zc-rij">' +
            '<button class="zc-knop" data-rb="' + esc(a.id) + '" data-droog="1">Eerst tonen</button>' +
            '<button class="zc-knop vol" data-rb="' + esc(a.id) + '">Rechtzetten</button></div>' : '') + '</div>';
      }).join('') + '</div>';

      u += '<div class="zc-kaart"><h3>Wat er gebeurd is</h3>';
      if (!d.tijdlijn.length) u += '<p class="zc-meta">Nog niets vastgelegd.</p>';
      u += d.tijdlijn.slice(0, 25).map(function (r) {
        return '<div class="zc-sig"><span class="zc-meta">' + esc(tijd(r.at)) + '</span> · ' + esc(r.wat) +
          (r.door ? ' <span class="zc-meta">door ' + esc(r.door) + '</span>' : '') + '</div>';
      }).join('') + '</div>';

      u += '<div class="zc-kaart"><h3>Hangt hieraan</h3>';
      if (!d.afhankelijkheden.length) u += '<p class="zc-meta">Niets van uw zaak verwijst hiernaar.</p>';
      u += d.afhankelijkheden.map(function (g) {
        return '<div class="zc-sig"><b>' + esc(g.label) + '</b> <span class="zc-meta">' + g.totaal + '</span><div class="zc-meta">' +
          g.rijen.map(function (x) { return '<button class="zc-knop" data-t="' + esc(x.type) + '" data-i="' + esc(x.id) + '" style="border:none;padding:0;font-size:.78rem;">' + esc(x.titel) + '</button>'; }).join(' · ') +
          '</div></div>';
      }).join('');
      if (d.afhankelijkhedenOnvolledig) u += '<p class="zc-meta">Let op: een lijst was groter dan de scangrens; dit overzicht is niet volledig.</p>';
      u += '</div>';

      vak.innerHTML = u;
      vak.querySelector('#zcTerug').onclick = function () { S.werkplek = 'zoek'; b.railTeken(); b.teken(); };
      vak.querySelectorAll('[data-t]').forEach(function (x) {
        x.onclick = function () { S.object = { type: x.dataset.t, id: x.dataset.i, data: null }; b.teken(); };
      });
      vak.querySelectorAll('[data-rb]').forEach(function (x) {
        x.onclick = function () {
          var droog = x.dataset.droog === '1';
          var reden = droog ? '' : prompt('Waarom zet u dit recht?');
          if (!droog && !reden) return;
          api('runbook/voer', { id: x.dataset.rb, droog: droog, reden: reden, alleen: [o.id], menselijkAkkoord: !droog })
            .then(function (r) {
              b.melden(droog ? ('Zou ' + r.run.geraakt + ' geval(len) wijzigen.') : (r.run.geraakt + ' rechtgezet.'));
              if (!droog) { o.data = null; return b.ververs(); }
            }).then(function () { b.teken(); })
            .catch(function (e) { b.melden(e.message); });
        };
      });
    };
  };
})(window);
/* De Regie van de zaak, deel 4: rechtzetten en de regels.

   DIT ZIJN DE TWEE SCHERMEN WAAR IETS VERANDERT, en daarom staan ze apart van
   het kijken (deel 3). Rechtzetten laat eerst zien wat er zou gebeuren en pas
   daarna doen -- de volgorde van de knoppen is de volgorde van het werk. De
   regels zijn die van deze zaak alleen, met een versie per wijziging en één
   knop terug.

   Beide hangen zichzelf in dezelfde tekenaarstabel als deel 3. */
(function (w) {
  'use strict';
  var Z = w.RTGZaakCommand;
  if (!Z) return;
  var esc = Z.esc, tijd = Z.tijd, nv = Z.nv;

  var vorige = Z.delen.rest;
  Z.delen.rest = function (b) {
    if (vorige) vorige(b);
    var vak = b.vak, S = b.S, api = b.api, T = b.TEKENAARS;

    /* ---- rechtzetten: de recepten en de laatste rondes ---- */
    T.recht = function () {
      vak.innerHTML = '<div class="zc-leeg">Laden…</div>';
      Promise.all([api('runbooks'), api('runs', { n: 10 })]).then(function (r) {
        var u = r[0].runbooks.map(function (rb) {
          return '<div class="zc-kaart"><h3>' + esc(rb.naam) + ' ' + nv(rb.oordeel.niveau) + '</h3>' +
            '<p class="zc-meta">' + esc(rb.wat) + '</p>' +
            '<div class="zc-rij"><b>' + rb.kandidaten + '</b><span class="zc-meta">geval(len) nu</span>' +
            (rb.kandidaten ? '<button class="zc-knop" data-droog="' + esc(rb.id) + '">Eerst tonen</button>' +
              (S.mag ? '<button class="zc-knop vol" data-voer="' + esc(rb.id) + '">Rechtzetten</button>' : '') : '') +
            '</div><div class="zc-meta" id="zcD-' + esc(rb.id) + '"></div></div>';
        }).join('');
        u += '<div class="zc-kaart"><h3>Laatste rondes</h3>';
        if (!r[1].runs.length) u += '<p class="zc-meta">Er is nog niets rechtgezet.</p>';
        u += r[1].runs.map(function (x) {
          return '<div class="zc-sig"><div>' + esc(x.naam) + ' <span class="zc-meta">· ' + esc(tijd(x.at)) + ' · ' +
            (x.droog ? 'alleen getoond' : x.geraakt + ' gewijzigd') + ' · ' + esc(x.door) + '</span></div>' +
            (!x.droog && !x.teruggedraaid && S.mag ? '<div class="zc-rij"><button class="zc-knop" data-terug="' + esc(x.id) + '">Terugzetten</button></div>' : '') +
            (x.teruggedraaid ? '<div class="zc-meta">teruggezet door ' + esc(x.terugDoor) + '</div>' : '') + '</div>';
        }).join('') + '</div>';
        vak.innerHTML = u;
        vak.querySelectorAll('[data-droog]').forEach(function (x) {
          x.onclick = function () {
            api('runbook/voer', { id: x.dataset.droog, droog: true }).then(function (rr) {
              vak.querySelector('#zcD-' + x.dataset.droog).innerHTML =
                '<div style="margin-top:.5rem;">' + rr.run.geraakt + ' van ' + rr.run.totaalKandidaten + ' zouden wijzigen:<br>' +
                rr.run.voorbeelden.map(function (v) { return esc(v.titel) + ': ' + esc(v.van) + ' → ' + esc(v.naar); }).join('<br>') + '</div>';
            }).catch(function (e) { b.melden(e.message); });
          };
        });
        vak.querySelectorAll('[data-voer]').forEach(function (x) {
          x.onclick = function () {
            var reden = prompt('Waarom zet u dit recht?');
            if (!reden) return;
            api('runbook/voer', { id: x.dataset.voer, droog: false, reden: reden, menselijkAkkoord: true })
              .then(function (rr) { b.melden(rr.run.geraakt + ' rechtgezet.'); return b.ververs(); })
              .then(function () { T.recht(); }).catch(function (e) { b.melden(e.message); });
          };
        });
        vak.querySelectorAll('[data-terug]').forEach(function (x) {
          x.onclick = function () {
            var reden = prompt('Waarom zet u deze ronde terug?');
            if (!reden) return;
            api('runbook/terug', { run: x.dataset.terug, reden: reden })
              .then(function (rr) { b.melden(rr.teruggezet + ' teruggezet, ' + rr.overgeslagen + ' overgeslagen.'); return b.ververs(); })
              .then(function () { T.recht(); }).catch(function (e) { b.melden(e.message); });
          };
        });
      }).catch(function (e) { vak.innerHTML = '<div class="zc-leeg">' + esc(e.message) + '</div>'; });
    };

    /* ---- de regels van de zaak ---- */
    T.regels = function () {
      vak.innerHTML = '<div class="zc-leeg">Laden…</div>';
      api('beleid').then(function (d) {
        vak.innerHTML = '<div class="zc-kaart"><h3>De regels van uw zaak</h3>' +
          '<p class="zc-meta">Deze grenzen bepalen wat de assistent zelf mag rechtzetten en wanneer iets een signaal wordt. ' +
          'Ze gelden alleen voor uw zaak. Elke wijziging krijgt een versie en een regel in uw spoor; er is altijd één knop terug.</p></div>' +
          d.regels.map(function (g) {
            return '<div class="zc-kaart"><h3>' + esc(g.wat) + '</h3>' +
              '<p class="zc-meta">' + esc(g.id) + ' · versie ' + g.versie + (g.sinds ? ' · sinds ' + esc(tijd(g.sinds)) + ' door ' + esc(g.door) : ' · startwaarde') + '</p>' +
              '<div class="zc-rij"><b>' + esc(String(g.waarde)) + '</b><span class="zc-meta">' + esc(g.eenheid) + '</span>' +
              '<input class="zc-veld" data-n="' + esc(g.id) + '" placeholder="nieuw" style="width:6rem;">' +
              '<input class="zc-veld" data-w="' + esc(g.id) + '" placeholder="waarom" style="flex:1;min-width:8rem;">' +
              '<button class="zc-knop vol" data-zet="' + esc(g.id) + '">Zetten</button>' +
              (g.versies > 1 ? '<button class="zc-knop" data-terug2="' + esc(g.id) + '">Eén terug</button>' : '') + '</div></div>';
          }).join('');
        vak.querySelectorAll('[data-zet]').forEach(function (x) {
          x.onclick = function () {
            var id = x.dataset.zet, v = vak.querySelector('[data-n="' + id + '"]').value;
            if (v === '') { b.melden('Vul een nieuwe waarde in.'); return; }
            var waarde = v === 'true' ? true : v === 'false' ? false : isNaN(Number(v)) ? v : Number(v);
            api('beleid/zet', { id: id, waarde: waarde, reden: vak.querySelector('[data-w="' + id + '"]').value })
              .then(function () { b.melden('Gezet.'); return b.ververs(); }).then(function () { T.regels(); })
              .catch(function (e) { b.melden(e.message); });
          };
        });
        vak.querySelectorAll('[data-terug2]').forEach(function (x) {
          x.onclick = function () {
            var reden = prompt('Waarom zet u deze regel terug?');
            if (!reden) return;
            api('beleid/terug', { id: x.dataset.terug2, reden: reden })
              .then(function () { b.melden('Teruggezet.'); return b.ververs(); }).then(function () { T.regels(); })
              .catch(function (e) { b.melden(e.message); });
          };
        });
      }).catch(function (e) { vak.innerHTML = '<div class="zc-leeg">' + esc(e.message) + '</div>'; });
    };
  };
})(window);
