/* VUL HET SCHERM -- elke app mag ook rand tot rand.

   Op een breed scherm staat een RTG-app in een kader: het leden-OS als een
   gecentreerde tablet van 820px, een losse app-pagina als een omkaderde kaart.
   Dat is de rustige standaard en die blijft. Maar soms wil je het hele scherm:
   een kaart, een agenda, De Salon, een film. Dan hoort de app op te rekken tot
   de randen van het beeldscherm.

   Wat er WEL blijft staan: de topbalk, het dock en de randgebaren. Rand tot rand
   maakt de app groter, geen kiosk -- je moet altijd terug kunnen zonder te
   zoeken. Alleen het kader zelf gaat weg.

   De bestaande pagina's houden één schakelaar:
     - een DS-scherm/werkruimte  -> html.ds-volscherm, centrale DS-presentatie
     - het leden-OS (#shell)      -> body.rtg-vol
     - een losse app-pagina (main) -> html.rtg-vol
   De keuze blijft op dit toestel staan en geldt voor alle apps, zodat het
   niet per scherm opnieuw ingesteld hoeft te worden.

   Het bedieningspaneel (shared/bediening.js) zet er een rij voor neer; verder
   is er geen knop, precies zoals de rest van deze laag. */
(function (w, d) {
  'use strict';
  if (w.RTGVol) return;

  var SLEUTEL = 'rtg_volscherm';
  var isDs = d.documentElement.hasAttribute('data-ds');
  var aan = false;
  try { aan = localStorage.getItem(SLEUTEL) === '1'; } catch (e) {}

  /* Niet-DS-hosts hebben nog ongelayerde, pagina-eigen shellregels. Hun
     bestaande compatibiliteitsregel blijft daarom exact lokaal totdat die
     host zelf is gemigreerd. Een nieuw legacyblad zou een tweede eigenaar
     maken; DS-hosts komen nooit in deze functie en gebruiken uitsluitend de
     centrale component public/ds/componenten/volscherm.css. */
  function stijl() {
    if (document.documentElement.hasAttribute('data-ds')) return;
    if (d.getElementById('volCss')) return;
    var s = d.createElement('style'); s.id = 'volCss';
    s.textContent =
      'body.rtg-vol #shell{max-width:none !important;width:100% !important;height:100dvh !important;' +
        'max-height:none !important;border:none !important;border-radius:0;box-shadow:none !important;}' +
      'body.rtg-vol{padding:0 !important;}' +
      'html.rtg-vol body > main{max-width:none !important;margin:0 !important;border:none !important;' +
        'border-radius:0;box-shadow:none !important;min-height:100dvh;resize:none !important;' +
        'max-height:none !important;}' +
      '@media (prefers-reduced-motion: no-preference){' +
        '#shell,body > main{transition:max-width var(--rust-lang,.46s) var(--rust-ease,ease),' +
        'width var(--rust-lang,.46s) var(--rust-ease,ease),' +
        'height var(--rust-lang,.46s) var(--rust-ease,ease),' +
        'border-radius var(--rust-lang,.46s) var(--rust-ease,ease);}}';
    (d.head || d.documentElement).appendChild(s);
  }

  /* Het DS-doel blijft bestaan na verhuizen in de werkruimte. De oude
     presentaties houden hun eigen shell/main en dezelfde vlag.
     Kan geen van beide, dan doet deze laag niets (een telefoon heeft geen
     kader om los te laten -- daar is alles al rand tot rand). */
  function doel() {
    if (isDs) {
      if (d.documentElement.classList.contains('ds-ingebed')) return null;
      return d.querySelector('body > main, .ds-wereldwerkruimte > .wd-shell') ? 'ds' : null;
    }
    if (d.getElementById('shell')) return 'body';
    if (d.querySelector('body > main')) return 'html';
    return null;
  }

  function pas() {
    if (isDs) {
      // De voorkeur blijft aan het document hangen als de werkruimte main verhuist.
      d.documentElement.classList.toggle('ds-volscherm', aan && !d.documentElement.classList.contains('ds-ingebed'));
      return;
    }
    var waar = doel();
    if (!waar) return;
    stijl();
    var el = waar === 'body' ? d.body : d.documentElement;
    el.classList.toggle('rtg-vol', aan);
  }

  function zet(nieuw) {
    aan = !!nieuw;
    try { localStorage.setItem(SLEUTEL, aan ? '1' : '0'); } catch (e) {}
    pas();
  }

  w.RTGVol = {
    aan: function () { return aan; },
    zet: zet,
    wissel: function () { zet(!aan); },
    // een kader is er alleen op een breed scherm; op de telefoon valt er niets
    // te vullen en heeft de rij in het paneel dus geen zin
    mogelijk: function () {
      var grens = isDs && d.body && d.body.classList.contains('ds-wereldwerkruimte') ? 1000 : 520;
      return !!doel() && w.matchMedia('(min-width: ' + grens + 'px)').matches;
    }
  };

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', pas);
  else pas();
})(window, document);
