/* Muisvrij bedienen, deel 2: de balk.

   Een vaste strook onderaan met een veld, en daarboven het gesprek. Dit is de
   ENE ingang: typen of praten, en er gebeurt iets. De zinsontleding zit in
   shared/handenvrij.js, het gesprek in handenvrij-chat.js en het luisteren en
   terugpraten in handenvrij-mond.js. Die twee haalt dit bestand erbij; ze krijgen
   een gedeelde kamer mee (doe/zeg/vak) en vullen er hun eigen kant in.

   Twee dingen die hier bewust zo staan:
   - de plekken op de pagina worden bij ELKE opdracht opnieuw opgehaald, niet een
     keer bij het laden. In dit OS wisselen schermen en tabs voortdurend; een
     lijst van een minuut oud wijst naar knoppen die er niet meer zijn.
   - een letter tikken waar dan ook belandt in de balk. Zonder dat blijf je toch
     eerst met de muis naar het veld gaan, en dan is de hele opzet zinloos. */
(function (root) {
  'use strict';
  if (root.__handenvrijBalk) return; root.__handenvrijBalk = true;
  var api = root.Handenvrij;
  if (!api || !api.versta) return;                 // deel 1 hoort er te zijn

  var memTok = null, supTok = null;
  try { memTok = localStorage.getItem('rtg_member_token'); } catch (e) {}
  try { supTok = localStorage.getItem('rtg_sup_token'); } catch (e) {}
  if (!memTok && !supTok) return;
  var pad = memTok ? '/api/fluister' : '/api/supplier/ai';
  var tok = memTok || supTok;

  var STEM = 'rtg_handenvrij_stem';
  var lezen = function (k, standaard) { try { var v = localStorage.getItem(k); return v == null ? standaard : v === '1'; } catch (e) { return standaard; } };
  var zetten = function (k, v) { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) {} };
  var stemAan = lezen(STEM, true);


  var balk = document.createElement('div');
  balk.className = 'hv-balk hv-weg';
  balk.innerHTML = '<form><input type="text" maxlength="300" autocomplete="off" spellcheck="false"' +
    ' aria-label="Zeg of typ wat er moet gebeuren" placeholder="Zeg of typ het">' +
    '<button class="hv-k hv-go" type="submit" aria-label="Versturen">→</button></form>' +
    '<button class="hv-k" type="button" data-mond aria-pressed="false" hidden>Mond</button>' +
    '<button class="hv-k" type="button" data-stem aria-pressed="true">Stem</button>';
  var chat = document.createElement('div');
  chat.className = 'hv-chat'; chat.hidden = true;
  chat.setAttribute('role', 'log'); chat.setAttribute('aria-live', 'polite');
  chat.setAttribute('aria-label', 'Gesprek met Rahul');

  var form = balk.querySelector('form'), inp = balk.querySelector('input');
  var knMond = balk.querySelector('[data-mond]'), knStem = balk.querySelector('[data-stem]');

  /* Let op: als de pagina al geladen is, draait klaar() HIER, tijdens het inlezen
     van dit bestand. Alles wat verderop met var/function wordt neergezet bestaat
     dan nog niet. Een aanroep naar de gedeelde kamer hoort hier dus niet: die
     wierp een TypeError, waarna de rest van de module (inclusief de toets-luister)
     nooit meer werd opgezet. Het gesprek laadt zichzelf, in handenvrij-chat.js. */
  /* Oproepen en wegleggen. De onderrand (shared/randen.js) zoekt hiernaar via
     window.RTGRahul.open; is er op deze pagina al een andere Rahul-balk, dan
     laat die zijn eigen open() staan en blijft deze weg. Zo staat er nooit
     meer dan een. */
  function haalOp() {
    balk.classList.remove('hv-weg');
    var w = document.querySelector('.hv-werk'); if (w) w.classList.remove('hv-weg');
    document.body.classList.remove('hv-opgeruimd');
    if (inp) inp.focus();
  }
  function legWeg() {
    balk.classList.add('hv-weg'); chat.classList.add('hv-weg');
    var w = document.querySelector('.hv-werk'); if (w) w.classList.add('hv-weg');
    document.body.classList.add('hv-opgeruimd');
  }

  function klaar() {
    if (balk.parentNode || !document.body) return;
    document.body.appendChild(chat); document.body.appendChild(balk);
    document.body.classList.add('hv-ruimte', 'hv-opgeruimd');
    knStem.setAttribute('aria-pressed', String(stemAan));
    root.RTGRahul = root.RTGRahul || {};
    if (!root.RTGRahul.open) { root.RTGRahul.open = haalOp; root.RTGRahul.sluit = legWeg; }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') legWeg(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', klaar);
  else klaar();

  /* ---------- antwoorden ----------
     Een antwoord is een beurt in het gesprek, geen regel die de vorige wist.
     Het tekenen zit in handenvrij-chat.js; hier alleen de bedoeling. */
  function zeg(tekst, hardop) {
    if (kamer.beurt) kamer.beurt('rahul', tekst);
    if (hardop && stemAan && kamer.spreek) kamer.spreek(tekst);
  }

  /* ---------- de plekken op deze pagina ----------
     Wat een pagina zelf aanmeldt met Handenvrij.plek() gaat voor. Daarnaast rapen
     we op wat er toch al staat: alles met data-plek, de tabs en de navigatielinks.
     Zo werkt spraaknavigatie ook op de 150+ pagina's die hier niets van weten. */
  var eigen = [];
  function plekken() {
    var lijst = eigen.slice(), gezien = {};
    eigen.forEach(function (p) { gezien[api.kaal(p.naam)] = 1; });
    var kies = '[data-plek],[role="tab"],.tab,.tabbtn,nav a[href],[data-tab]';
    [].forEach.call(document.querySelectorAll(kies), function (el) {
      if (el.hidden || el.getAttribute('aria-hidden') === 'true') return;
      var naam = el.getAttribute('data-plek') || (el.textContent || '').trim();
      var k = api.kaal(naam);
      if (!k || k.length > 40 || gezien[k]) return;
      gezien[k] = 1;
      lijst.push({ naam: naam, doen: function () { el.click(); el.scrollIntoView({ block: 'nearest' }); } });
    });
    return lijst;
  }

  /* ---------- een bedoeling uitvoeren ----------
     hardop=true betekent: dit kwam van de MOND. Dat is niet alleen "praat het
     antwoord terug", het bepaalt ook of de geldpoort ingrijpt. */
  function doe(zin, hardop) {
    // staat er een geld-bevestiging open, dan is "ja"/"nee" daar het antwoord op
    if (hardop && kamer.geldAntwoord && kamer.geldAntwoord(zin)) return;
    var b = api.versta(zin, plekken());
    switch (b.soort) {
      case 'niets': return;
      case 'ga': zeg(b.plek.naam, hardop); try { b.plek.doen(); } catch (e) { zeg('Dat lukte niet.', hardop); } return;
      case 'terug': history.back(); return;
      case 'vooruit': history.forward(); return;
      case 'sluit': dicht(); inp.value = ''; inp.blur(); return;
      case 'omhoog': root.scrollBy({ top: -Math.round(innerHeight * 0.8), behavior: 'smooth' }); return;
      case 'omlaag': root.scrollBy({ top: Math.round(innerHeight * 0.8), behavior: 'smooth' }); return;
      case 'begin': root.scrollTo({ top: 0, behavior: 'smooth' }); return;
      case 'eind': root.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); return;
      case 'stil': stelStem(false); zeg('Goed, ik hou het bij tekst.', false); return;
      case 'luid': stelStem(true); zeg('Ik praat weer mee.', true); return;
      case 'lijst': zeg(lijstTekst(), hardop); return;
      default: vraagRahul(b.zin, hardop);
    }
  }
  function lijstTekst() {
    var namen = plekken().slice(0, 14).map(function (p) { return p.naam; });
    return namen.length
      ? 'Hier kun je naartoe: ' + namen.join(', ') + '. En verder: terug, omhoog, omlaag, sluit, stil. Al het andere doe ik zelf. ' + geldRegel()
      : 'Op deze pagina vind ik geen vaste plekken. Zeg gewoon wat er moet gebeuren. ' + geldRegel();
  }
  function geldRegel() {
    return (kamer.geldAan && kamer.geldAan())
      ? 'Geld en boekingen mogen met de mond, met een bevestiging per opdracht.'
      : 'Geld en boekingen typ je; dat doe ik niet op je woord alleen.';
  }
  function stelStem(aan) {
    stemAan = !!aan; zetten(STEM, stemAan);
    knStem.setAttribute('aria-pressed', String(stemAan));
    if (!stemAan && kamer.zwijg) kamer.zwijg();
  }

