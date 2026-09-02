/* ============================================================================
   SPRAAK NAAR TEKST: JE EIGEN MICROFOON, JE EIGEN KEUZE.

   WAAROM DIT ER IS. TOEGANKELIJK.md en check.js regel 49 zeggen het al een tijd
   zo hard als het is: acht live vormen -- zes gesprekken en twee uitzendingen --
   hebben geen weg naar tekst. shared/meelezen.js zette daar een halve deur
   (een baan waarin deelnemers MEETYPEN) en liet de andere helft open:
   `voed(regel, { bron: 'machine' })`. Dit is die herkenner.

   DE ENIGE REGEL DIE HET ONTWERP DRAAGT: JE TRANSCRIBEERT JEZELF.

   Deze module luistert naar de MICROFOON van wie hem aanzet, nooit naar het
   binnenkomende geluid van de ander. Dat is geen technische beperking die we
   goedpraten maar de kern van het ontwerp:

     - je geeft alleen je eigen stem weg, nooit die van iemand anders;
     - er is geen enkele stand waarin dit huis het gesprek van twee leden
       opneemt om er tekst van te maken.

   De herkenning gebeurt op het TOESTEL (de Web Speech API). In sommige browsers
   gaat het geluid daarbij naar een server van de browserleverancier -- Chrome
   doet dat. Daarom staat dit UIT tot iemand hem zelf aanzet, staat er bij het
   aanzetten wat er gebeurt, en gaat er nooit geluid naar RTG. Dezelfde afspraak
   als RTG Memo.

   WAT DIT NIET OPLOST, en dat hoort er even groot bij te staan. Het is geen
   ondertiteling die er altijd is: zet de ander hem niet aan, dan is er van
   diens spraak nog steeds geen tekst, en een toestel zonder Web Speech API
   (Firefox) kan het helemaal niet -- dan zegt de knop dat hij niet kan, met de
   reden. WCAG 1.2.4 vraagt ondertiteling bij LIVE media en wordt hiermee dus
   niet gehaald; check.js regel 49 telt deze acht nog steeds als OPEN. De
   afhankelijkheid is verplaatst en verkleind, niet weggenomen.

   ALLEEN AFGERONDE ZINNEN. `interimResults` staat uit: een tussenstand die bij
   elk woord verandert is in een `aria-live`-baan onleesbaar, want een
   schermlezer begint elke keer opnieuw.
   ========================================================================== */
(function (w, d) {
  'use strict';

  function motor() { return w.SpeechRecognition || w.webkitSpeechRecognition || null; }

  /* Waarom het NIET kan, in gewone taal: een verhindering draagt altijd een
     reden (GRAMMATICA.md). */
  function waarom() {
    if (!motor()) return 'Deze browser kan geen spraak omzetten naar tekst. Chrome of Edge kan het wel.';
    if (!w.isSecureContext) return 'Spraakherkenning werkt alleen op een beveiligde verbinding (https).';
    return null;
  }

  function beschikbaar() { return waarom() === null; }

  /* De taal van de PAGINA en niet van het toestel: een RTG-scherm in het
     Nederlands hoort niet naar Engels te luisteren omdat iemands telefoon zo
     staat. Geen lang-attribuut? Dan Nederlands. */
  function taalVanPagina() {
    var l = (d.documentElement && d.documentElement.lang) || '';
    if (!l) return 'nl-NL';
    return l.indexOf('-') > 0 ? l : l + '-' + l.toUpperCase();
  }

  /* EEN LUISTERAAR. opRegel(tekst): een afgeronde zin. opStand(aan, reden): de
     stand veranderde. taal: overschrijft die van de pagina. `start()` mag pas na
     een tik -- browsers weigeren een herkenner die uit zichzelf begint. */
  function maak(opties) {
    opties = opties || {};
    var Motor = motor();
    var sr = null;
    var wil = false;          // wat de gebruiker wil: aan of uit
    var loopt = false;        // wat de browser doet

    function zeg(aan, reden) {
      if (typeof opties.opStand === 'function') { try { opties.opStand(aan, reden || null); } catch (e) {} }
    }

    function bouw() {
      var r = new Motor();
      r.lang = opties.taal || taalVanPagina();
      r.continuous = true;
      r.interimResults = false;   // zie de kop: alleen afgeronde zinnen
      r.maxAlternatives = 1;
      r.onresult = function (e) {
        for (var i = e.resultIndex; i < e.results.length; i++) {
          if (!e.results[i].isFinal) continue;
          var t = String((e.results[i][0] && e.results[i][0].transcript) || '').replace(/\s+/g, ' ').trim();
          if (t && typeof opties.opRegel === 'function') { try { opties.opRegel(t); } catch (err) {} }
        }
      };
      /* EEN HERKENNER STOPT UIT ZICHZELF na een stilte, en dat is de vorm
         waarin deze functie het stilst kapot kan gaan: het lampje staat aan,
         de gebruiker denkt dat hij gevolgd wordt, en er komt niets meer. Dus
         starten we opnieuw zolang de gebruiker hem AAN wil hebben -- en zodra
         dat niet lukt zeggen we dat, in plaats van stil te blijven staan. */
      r.onend = function () {
        loopt = false;
        if (!wil) { zeg(false, null); return; }
        try { r.start(); loopt = true; } catch (e) { wil = false; zeg(false, 'De herkenning stopte en kwam niet terug.'); }
      };
      r.onerror = function (e) {
        var code = (e && e.error) || '';
        if (code === 'no-speech' || code === 'aborted') return;   // geen storing: er werd even niets gezegd
        wil = false; loopt = false;
        zeg(false, code === 'not-allowed' || code === 'service-not-allowed'
          ? 'De browser gaf geen toegang tot de microfoon voor spraakherkenning.'
          : 'De spraakherkenning gaf een storing (' + (code || 'onbekend') + ').');
      };
      return r;
    }

    return {
      get aan() { return wil; },
      get luistert() { return loopt; },
      start: function () {
        var nee = waarom();
        if (nee) { zeg(false, nee); return false; }
        if (wil) return true;
        wil = true;
        try { sr = sr || bouw(); sr.start(); loopt = true; zeg(true, null); return true; }
        catch (e) { wil = false; loopt = false; zeg(false, 'De spraakherkenning wilde niet starten.'); return false; }
      },
      stop: function () {
        wil = false;
        if (sr) { try { sr.stop(); } catch (e) {} }
        loopt = false;
        zeg(false, null);
      }
    };
  }

  /* DE BEDIENING: twee knoppen en een standregel, op EEN plek.
     shared/meelezen.js hangt ze in zijn kop; ze wonen hier omdat die module over
     een baan met tekst gaat en niet over een microfoon. `zend(regel, bron)` is
     de enige weg naar buiten -- de aanroeper bepaalt wat er met een regel
     gebeurt, deze module weet daar niets van. */
  function koppel(opties) {
    opties = opties || {};
    var kop = opties.kop;
    var zend = typeof opties.zend === 'function' ? opties.zend : function () {};
    var stijl = opties.knopStijl || '';
    if (!kop) return null;

    /* UIT IS DE STARTSTAND, en dat is geen voorzichtigheid maar het ontwerp:
       spraakherkenning die vanzelf begint is een microfoon die meeluistert
       zonder dat iemand daarom vroeg. */
    var spraakKnop = d.createElement('button');
    spraakKnop.type = 'button';
    spraakKnop.className = 'meelees-spraak';
    spraakKnop.textContent = 'Spreek mee';
    spraakKnop.setAttribute('aria-pressed', 'false');
    spraakKnop.style.cssText = stijl;
    kop.appendChild(spraakKnop);

    /* VRAGEN OM LIVE TEKST. Wie doof is heeft niets aan zijn eigen herkenner --
       hij heeft die van de ander nodig. Dit is de enige nette weg daarheen:
       vragen. Het is met opzet GEEN schakelaar die de microfoon van iemand
       anders aanzet; LIFE.md par. 4 -- alles wat een tweede persoon bereikt
       wordt klaargezet en nooit automatisch. Het verzoek gaat als een gewone
       regel door dezelfde baan, dus er komt geen tweede kanaal bij. */
    var vraagKnop = d.createElement('button');
    vraagKnop.type = 'button';
    vraagKnop.className = 'meelees-vraag';
    vraagKnop.textContent = 'Vraag om live tekst';
    vraagKnop.style.cssText = stijl;
    kop.appendChild(vraagKnop);

    /* De stand in WOORDEN en niet in een kleurtje: "het lampje staat aan" is
       voor wie niet ziet geen mededeling. */
    var stand = d.createElement('p');
    stand.className = 'meelees-stand';
    stand.setAttribute('role', 'status');
    stand.hidden = true;
    stand.style.cssText = 'margin:.3rem 0 0;font-size:.82rem;opacity:.75;';
    if (kop.parentNode) kop.parentNode.insertBefore(stand, kop.nextSibling);

    var luisteraar = null;
    function meld(tekst) { stand.textContent = tekst || ''; stand.hidden = !tekst; }

    spraakKnop.addEventListener('click', function () {
      if (luisteraar && luisteraar.aan) { luisteraar.stop(); return; }
      if (!luisteraar) {
        luisteraar = maak({
          opRegel: function (regel) { zend(regel, 'machine'); },
          opStand: function (aan, reden) {
            spraakKnop.setAttribute('aria-pressed', aan ? 'true' : 'false');
            spraakKnop.textContent = aan ? 'Stop met spreken' : 'Spreek mee';
            meld(reden || (aan
              ? 'Je eigen stem wordt op dit toestel omgezet naar tekst en verschijnt hierboven. Alleen jouw microfoon.'
              : ''));
          }
        });
      }
      if (typeof opties.open === 'function') { try { opties.open(); } catch (e) {} }
      luisteraar.start();
    });

    /* METEEN zeggen dat hij niet kan, en waarom -- niet pas na een tik
       (GRAMMATICA.md). ZICHTBAAR en niet alleen in een `title`: dat was de
       eerste vorm en test/spraaktekst.test.js haalde hem eruit, want een tooltip
       op een UITGESCHAKELDE knop bereikt met een toetsenbord of een schermlezer
       precies de mensen niet voor wie deze knop bestaat. */
    if (!beschikbaar()) {
      spraakKnop.disabled = true;
      spraakKnop.title = waarom() || '';
      spraakKnop.style.opacity = '.55';
      meld(waarom());
    }

    vraagKnop.addEventListener('click', function () {
      if (typeof opties.open === 'function') { try { opties.open(); } catch (e) {} }
      zend('Ik lees mee. Zet je "Spreek mee" aan, dan verschijnt wat je zegt hier als tekst.', 'mens');
    });

    return {
      get aan() { return !!(luisteraar && luisteraar.aan); },
      stop: function () { if (luisteraar && luisteraar.aan) luisteraar.stop(); }
    };
  }

  w.RTGSpraakTekst = { beschikbaar: beschikbaar, waarom: waarom, maak: maak, koppel: koppel,
    taalVanPagina: taalVanPagina };
}(window, document));
