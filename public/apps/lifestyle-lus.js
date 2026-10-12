/* Het Privékantoor, de kant van het LID in de concierge-lus (CONCIERGE.md).

   De lus stond sinds 30 september 2026 in de server (kern/bureau/lus*.js) en
   had geen scherm, dus voor een mens bestond hij niet (BETROUWBAARHEID.md). Dit
   bestand hangt hem in het tabblad Zaken van apps/lifestyle.html, dat de
   eigenaar is van concierge.privekantoor (SCHERMEIGENAAR.json). Er komt dus
   geen tweede scherm bij: een wens is een zaak, en zaken staan daar al.

   Wat het lid hier kan, en niet meer dan dat:
     - een wens in één zin vertellen       /api/member/bureau/lus/intake
     - zijn zaak terugzien                  /api/member/bureau/lus/zaak
     - over een voorstel beslissen          /api/member/bureau/lus/beslis
     - de verrassing aan- of uitzetten      /api/member/bureau/lus/verrassing
     - iets laten weten                     /api/member/bureau/lus/toelichting

   Drie dingen die hier vastliggen:

   1. HET LID ZIET ZIJN STUKJE, NIET DE WERKVLOER. Alles komt uit lusLid() in
      kern/bureau/lus-wens.js: de eigenaar, een zin die klopt, het voorstel als
      dat er ligt en de tijden. Niet de mogelijkheden die het kantoor afwoog.
   2. DE VERRASSING WORDT NOOIT DOOR HET SCHERM UITGEZET. Staat het vinkje niet
      aan, dan gaat het veld niet mee -- anders zou een niet-aangevinkt vakje de
      verrassing overschrijven die de server uit de zin las (CON-08).
   3. EEN VERLOPEN VOORSTEL HEEFT GEEN AKKOORDKNOP. De server weigert het toch
      (CON-09), maar een knop die altijd faalt is een deur die van buiten open
      lijkt. De reden staat er in plaats van de knop.

   Gebruikt de globale helpers van lifestyle.html ($, esc, api, meld, euro);
   alles staat in een IIFE zodat er niets op het hoogste niveau window-namen
   overschaduwt. */
(function () {
  'use strict';

  var sleutel = null;      // een per formulier: een dubbeltik levert geen tweede diner op
  var vragen = {};         // id -> wat de intake nog niet zeker wist
  var STAND = { vastgehouden: 'Vastgehouden', verlopen: 'Verlopen', 'zonder-termijn': 'Aangeboden', gekozen: 'Gekozen', afgewezen: 'Niet gekozen' };

  function nieuweSleutel() { sleutel = window.RTGId('lus'); }

  function intakeKaart() {
    if (!sleutel) nieuweSleutel();
    return '<div class="kaart" id="lusIntake"><h2>Vraag het De Rechterhand</h2>'
      + '<div class="sub">Vertelt u in één zin wat u wilt. Wij lezen er de dag, de plaats en het gezelschap uit; '
      + 'wat wij niet zeker weten, vragen wij u in plaats van het te raden.</div>'
      + '<label class="lbl" for="lusZin">Uw wens</label>'
      + '<textarea class="veld" id="lusZin" maxlength="1200" placeholder="Mijn vrouw is morgen jarig. We zijn in Amsterdam, ze weet van niets. Diner om 20 uur, geen noten."></textarea>'
      + '<div class="rij"><div><label class="lbl" for="lusRuimte">Speelruimte in tijd</label>'
      + '<select class="veld" id="lusRuimte"><option value="0">Precies zoals gevraagd</option><option value="15">15 minuten</option>'
      + '<option value="30" selected>30 minuten</option><option value="60">een uur</option><option value="120">twee uur</option></select></div>'
      + '<div><label class="lbl" for="lusGrens">Budget voor deze gelegenheid (euro)</label>'
      + '<input class="veld" id="lusGrens" type="number" min="0" placeholder="Leeg: uw vaste grens"></div></div>'
      + '<label class="fijn mt"><input type="checkbox" id="lusVerrassing"> Dit is een verrassing: er gaat niets naar uw gezin of een gedeeld kanaal.</label>'
      + '<div class="fijner">Binnen uw mandaat en de speelruimte zetten wij het voor u vast. Daarbuiten leggen wij u een concreet voorstel voor.</div>'
      + '<div class="mt-m"><button class="knop" id="lusVraag">Vraag het ons</button></div></div>';
  }

  /* Het lid ziet bij een zaak uit de lus een knop; het voorstel staat erbij als het er ligt. */
  function regel(z) {
    if (z.werkwijze !== 'voorstel') return '';
    return '<div class="knoprij"><button class="knop klein stil js-lus" data-id="' + esc(z.id) + '">'
      + (z.voorstel ? 'Bekijk het voorstel' : 'Bekijk de zaak') + '</button></div>'
      + '<div class="lus-detail" data-lus="' + esc(z.id) + '"></div>';
  }

  function tekenDetail(el, d) {
    var eig = d.eigenaar && d.eigenaar.naam ? esc(d.eigenaar.naam) + ' (' + esc(d.eigenaar.rol) + ') regelt dit voor u.'
      : 'Een van onze mensen regelt dit voor u' + (d.eigenaar && d.eigenaar.rol ? ' (' + esc(d.eigenaar.rol) + ')' : '') + '.';
    var h = '<div class="kaart mt-s lus-zaak">'
      + '<div class="meta">' + eig + '</div>'
      + '<div class="briefkop">' + esc(d.bericht && d.bericht.tekst) + '</div>';
    var v = d.voorstel;
    if (v) {
      var verlopen = v.stand === 'verlopen';
      h += '<div class="kaart let mt-s"><h2>Wij leggen u iets voor</h2>'
        + '<div class="meta"><b>' + esc(v.wat) + '</b>' + (v.van ? ' om ' + esc(v.van) : '')
        + (v.bedragCenten ? ' · ' + euro(v.bedragCenten) : '') + '</div>'
        + '<div class="fijn mt">Waarom wij het u vragen: ' + esc(v.reden) + '</div>'
        + '<div class="fijner">' + esc(STAND[v.stand] || v.stand)
        + (v.geldigTot && !verlopen ? ' tot ' + esc(String(v.geldigTot).slice(11, 16)) + ' UTC' : '') + '</div>'
        + (verlopen
          ? '<div class="fijner rood">Dit aanbod geldt niet meer. Wij zoeken opnieuw; u hoeft niets te doen.</div>'
          : '<div class="knoprij"><button class="knop klein js-lus-ja">Akkoord</button>'
            + '<button class="knop klein stil js-lus-nee">Liever niet</button></div>')
        + '</div>';
    }
    var q = vragen[d.id] || [];
    if (q.length) {
      h += '<div class="mt-s"><div class="lbl">Wat wij nog niet zeker weten</div>'
        + q.map(function (x) { return '<div class="meta">' + esc(x.vraag) + '</div>'; }).join('')
        + '<div class="fijner">Laat het ons hieronder weten; wij vullen het niet zelf in.</div></div>';
    }
    if ((d.tijdlijn || []).length) {
      h += '<div class="mt-s"><div class="lbl">Uw programma</div>'
        + d.tijdlijn.map(function (r) { return '<div class="meta">' + esc(r.van) + ' tot ' + esc(r.tot) + ' · ' + esc(r.wat) + '</div>'; }).join('')
        + '</div>';
    }
    h += '<div class="mt-s"><div class="lbl">Verrassing</div><div class="meta">'
      + (d.verrassing ? 'Aan: er gaat niets naar uw gezin of een gedeeld kanaal.' : 'Uit.')
      + '</div><div class="knoprij"><button class="knop klein stil js-lus-verr" data-aan="' + (d.verrassing ? '0' : '1') + '">'
      + (d.verrassing ? 'Het is geen verrassing meer' : 'Maak er een verrassing van') + '</button></div></div>'
      + '<label class="lbl">Laat ons iets weten</label><textarea class="veld js-lus-tekst" maxlength="600" placeholder="Een wens, een antwoord, een verandering."></textarea>'
      + '<div class="knoprij"><button class="knop klein js-lus-stuur">Versturen</button></div></div>';
    el.innerHTML = h;

    var id = d.id;
    var beslis = function (akkoord) {
      return async function () {
        this.disabled = true;
        var bericht;
        try {
          var r = await api('lus/beslis', { id: id, akkoord: akkoord });
          bericht = r.vastgezet ? 'Vastgezet. Wij regelen de rest.' : 'Genoteerd. Wij zoeken verder.';
        } catch (e) { bericht = e.message; }
        await window.RTGLusLid.open(id);
        meld(bericht);
      };
    };
    var ja = el.querySelector('.js-lus-ja'), nee = el.querySelector('.js-lus-nee');
    if (ja) ja.onclick = beslis(true);
    if (nee) nee.onclick = beslis(false);
    el.querySelector('.js-lus-verr').onclick = async function () {
      this.disabled = true;
      try { await api('lus/verrassing', { id: id, aan: this.dataset.aan === '1' }); window.RTGLusLid.open(id); }
      catch (e) { meld(e.message); this.disabled = false; }
    };
    el.querySelector('.js-lus-stuur').onclick = async function () {
      var t = el.querySelector('.js-lus-tekst').value.trim();
      if (!t) return meld('Wat wilt u ons laten weten?');
      this.disabled = true; // een toelichting is met opzet elke keer een nieuwe regel: niet twee keer drukken
      try { await api('lus/toelichting', { id: id, tekst: t }); meld('Ontvangen. U hoeft het niet nog eens te vertellen.'); window.RTGLusLid.open(id); }
      catch (e) { meld(e.message); this.disabled = false; }
    };
  }

  async function open(id) {
    var el = document.querySelector('.lus-detail[data-lus="' + CSS.escape(id) + '"]');
    if (!el) return;
    try { tekenDetail(el, await api('lus/zaak', { id: id })); }
    catch (e) { el.innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; }
  }

  function bind(herlaad) {
    var k = document.getElementById('lusVraag');
    if (k) k.onclick = async function () {
      var zin = document.getElementById('lusZin').value.trim();
      if (!zin) return meld('Vertel ons in een zin wat u wilt.');
      var body = { zin: zin, sleutel: sleutel, speelruimteMin: Number(document.getElementById('lusRuimte').value) || 0 };
      var g = document.getElementById('lusGrens').value;
      if (g !== '' && Number(g) >= 0) body.grensCenten = Math.round(Number(g) * 100);
      if (document.getElementById('lusVerrassing').checked) body.verrassing = true; // nooit false meesturen: zie regel 2
      this.disabled = true;
      try {
        var r = await api('lus/intake', body);
        vragen[r.zaak.id] = r.vragen || [];
        nieuweSleutel();
        meld(r.herhaald ? 'Dit hadden wij al van u ontvangen.' : 'Ontvangen. Wij gaan ermee aan de slag.');
        await herlaad();
        open(r.zaak.id);
      } catch (e) { meld(e.message); this.disabled = false; }
    };
    document.querySelectorAll('.js-lus').forEach(function (b) {
      b.onclick = function () { open(b.dataset.id); };
    });
  }

  window.RTGLusLid = { intakeKaart: intakeKaart, regel: regel, bind: bind, open: open };
})();
