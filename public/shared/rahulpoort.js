/* ============================================================================
   DE RAHUL-POORT -- inloggen als een gesprek, ook op de werkschermen.

   In de leden-app is de poort al van Rahul: geen formulier, maar een vraag per
   keer. Op de werkschermen (personeel, leverancier) stond nog het ouderwetse
   blok van twee velden onder elkaar met een knop eronder. Dit is dezelfde poort
   voor die schermen: Rahul stelt de vragen, jij geeft antwoord, en pas als hij
   alles heeft belt hij bij de server aan.

   WAT ER NIET GEBEURT. Er gaat geen letter van dit gesprek naar een taalmodel.
   De vragen staan hier vast in een lijstje; het antwoord op "uw wachtwoord?"
   gaat rechtstreeks naar dezelfde inlogroute als voorheen. Rahul is hier de
   VORM van het formulier, niet de portier: wie binnen mag beslist de server,
   precies als eerst. Dat is geen detail -- een AI die toegang uitdeelt is
   precies wat we in dit huis niet doen.

   GEBRUIK

     RTGPoort.gesprek(element, {
       groet:   'Goedemiddag.',                       // optioneel, de openingszin
       stappen: [
         { sleutel:'user', vraag:'Met wie heb ik het genoegen?', plho:'e-mail of gebruikersnaam',
           type:'text', autocomplete:'username' },
         { sleutel:'pass', vraag:'Dank u. En uw wachtwoord?', type:'password',
           autocomplete:'current-password' }
       ],
       klaar: async function (antw) { await inloggen(antw.user, antw.pass); },
       zijpaden: [ { tekst:'Aanmelden bij een bedrijf', doe: stepAanmelden } ]
     });

   Gooit `klaar` een fout, dan zegt Rahul die zin en vraagt hij de laatste stap
   opnieuw (een wachtwoordveld wordt daarbij leeggemaakt). Zo blijft het een
   gesprek in plaats van een rood blokje onder een formulier.

   TWEE SOORTEN STAPPEN, meer niet -- een poort waar je doorheen praat hoort
   simpel te blijven:

     type:'text' / 'password'   een regel om in te typen
     type:'keuze'               een keuze uit opties(antw) -> [{waarde,label}]

   Een stap mag daarnaast zelf iets OPHALEN voordat de volgende vraag komt:

     { sleutel:'code', vraag:'Van welk korps bent u?',
       doe: async (antw) => { lijst = await roster(antw.code); } }

   Gooit die `doe`, dan zegt Rahul het en staat dezelfde vraag er weer. Zo kan de
   ene vraag de opties van de volgende bepalen zonder dat de poort iets van de
   pagina hoeft te weten.

   ZINNEN MOGEN FUNCTIES ZIJN. Handig als de vertaaltabel van een pagina verderop
   in het document staat dan het script dat de poort opzet: `() => T('x','y')`
   wordt pas gelezen als de vraag in beeld komt, en opnieuw bij een taalwissel.

   De vormtaal komt uit de leden-poort: de zin groot en stil in Bodoni, daaronder
   een enkele regel met een dunne lijn eronder. Staat shared/mond.js op de
   pagina, dan beweegt Rahuls signatuurmond mee; is hij er niet, dan is er
   gewoon geen mond en verandert er verder niets.
   ========================================================================== */
(function (w, d) {
  'use strict';
  if (w.RTGPoort) return;

  var CSS =
    ".rp{display:flex;flex-direction:column;width:100%;}" +
    ".rp-mond{display:block;margin:0.2rem auto 0.1rem;width:200px;height:91px;}" +
    ".rp-zin{font-family:'Bodoni Moda',Georgia,serif;font-weight:400;font-size:1.12rem;line-height:1.65;" +
      "color:var(--txt,#F4F1EC);text-align:center;min-height:4.4rem;display:flex;align-items:center;" +
      "justify-content:center;padding:0.8rem 0.4rem 1rem;text-wrap:balance;animation:rpZin .5s ease;}" +
    "@keyframes rpZin{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}" +
    ".rp-rij{display:flex;align-items:center;border-bottom:1px solid var(--line,rgba(255,255,255,.1));" +
      "margin:0 .6rem;transition:border-color .2s;}" +
    ".rp-rij:focus-within{border-color:var(--burgundy,#C23A5E);}" +
    /* De lange staart van :not()'s is geen sierwerk. De UI-kit geeft ELK
       invoerveld een kaartje met rand en ronde hoeken, en doet dat met precies
       deze drie uitzonderingen erbij -- dus zo zwaar weegt die regel. Deze ene
       regel moet juist een kale lijn zijn: geen doosje, alleen een streep
       eronder. Met dezelfde staart plus onze eigen twee klassen wint hij, en
       hoeft er nergens !important aan te pas te komen. */
    ".rp .rp-rij input:not([type=range]):not([type=checkbox]):not([type=radio])" +
      "{flex:1;min-width:0;background:none;border:none;border-radius:0;outline:none;box-shadow:none;" +
      "color:var(--txt,#F4F1EC);" +
      "font-family:'Inter',system-ui,sans-serif;font-size:.95rem;text-align:center;padding:.75rem .4rem;}" +
    ".rp .rp-rij input:not([type=range]):not([type=checkbox]):not([type=radio]):focus" +
      "{border:none;box-shadow:none;}" +
    ".rp-rij input::placeholder{color:var(--soft,rgba(244,241,236,.6));}" +
    ".rp .rp-rij select{flex:1;min-width:0;background:none;border:none;border-radius:0;outline:none;box-shadow:none;" +
      "color:var(--txt,#F4F1EC);font-family:'Inter',system-ui,sans-serif;font-size:.95rem;" +
      "text-align:center;text-align-last:center;padding:.75rem .4rem;}" +
    ".rp .rp-rij select[hidden],.rp .rp-rij input[hidden]{display:none;}" +
    ".rp-rij button{background:none;border:none;cursor:pointer;color:var(--gold,#A98F1C);font-size:1.15rem;" +
      "padding:.4rem .2rem;opacity:0;transition:opacity .2s;font-family:inherit;}" +
    ".rp-rij:focus-within button,.rp-rij.vol button{opacity:.85;}" +
    ".rp-paden{margin-top:1.6rem;display:flex;flex-direction:column;gap:.7rem;align-items:center;}" +
    ".rp-pad{background:none;border:none;color:var(--muted,rgba(244,241,236,.7));font:inherit;font-size:.8rem;" +
      "cursor:pointer;text-decoration:underline;text-underline-offset:3px;padding:0;}" +
    ".rp-pad:hover{color:var(--gold,#A98F1C);}";

  function stijl() {
    if (d.getElementById('rpStijl')) return;
    var s = d.createElement('style'); s.id = 'rpStijl'; s.textContent = CSS;
    (d.head || d.documentElement).appendChild(s);
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function gesprek(el, opt) {
    if (!el || !opt || !opt.stappen || !opt.stappen.length) return null;
    stijl();
    var stappen = opt.stappen, antw = {}, i = 0, bezig = false;

    el.innerHTML =
      '<div class="rp">' +
      '<canvas class="rp-mond" width="440" height="200" aria-hidden="true"></canvas>' +
      '<div class="rp-zin" role="status" aria-live="polite"></div>' +
      '<div class="rp-rij"><select hidden aria-hidden="true"></select>' +
      '<input autocomplete="off" spellcheck="false">' +
      '<button type="button" aria-label="' + esc(opt.stuurLabel || 'Stuur') + '">&#8594;</button></div>' +
      '<div class="rp-paden"></div></div>';

    var zin = el.querySelector('.rp-zin');
    var rij = el.querySelector('.rp-rij');
    var inp = el.querySelector('.rp-rij input');
    var keus = el.querySelector('.rp-rij select');
    var go = el.querySelector('.rp-rij button');
    var paden = el.querySelector('.rp-paden');

    // de signatuurmond, als shared/mond.js er is; anders halen we het doek weg
    var mond = null, doek = el.querySelector('.rp-mond');
    if (w.RTGMond && w.RTGMond.maak) mond = w.RTGMond.maak(doek);
    else doek.parentNode.removeChild(doek);

    function zeg(tekst) {
      zin.textContent = tekst;
      if (mond && mond.praat) mond.praat(Math.min(4200, 420 + String(tekst).length * 38));
    }

    /* De zinnen mogen ook FUNCTIES zijn. Dat is er niet voor de sier: de
       vertaaltabel van een pagina staat soms verderop in het document dan het
       script dat de poort opzet, en dan zou Rahul in het Nederlands blijven
       hangen op een Engels scherm. Een functie wordt pas gelezen als de vraag
       in beeld komt, en bij het wisselen van taal opnieuw. */
    function lees(v) { return typeof v === 'function' ? v() : v; }

    /* Een stap is een tekstregel OF een keuze uit een lijst (type:'keuze', met
       opties() die [{waarde,label}] geeft). Meer smaken zijn er niet: een poort
       waar je doorheen praat hoort simpel te blijven. */
    function toonStap() {
      var s = stappen[i];
      zeg(lees(s.vraag));
      var isKeuze = s.type === 'keuze';
      keus.hidden = !isKeuze; keus.setAttribute('aria-hidden', isKeuze ? 'false' : 'true');
      inp.hidden = isKeuze;
      if (isKeuze) {
        var lijst = (typeof s.opties === 'function' ? s.opties(antw) : s.opties) || [];
        keus.innerHTML = '';
        lijst.forEach(function (o) {
          var op = d.createElement('option');
          op.value = o.waarde; op.textContent = o.label;
          keus.appendChild(op);
        });
        keus.setAttribute('aria-label', lees(s.vraag));
        rij.classList.add('vol');
        try { keus.focus(); } catch (e) {}
        return;
      }
      inp.type = s.type === 'password' ? 'password' : (s.type || 'text');
      inp.placeholder = lees(s.plho) || '';
      inp.setAttribute('aria-label', lees(s.vraag));
      inp.setAttribute('autocomplete', s.autocomplete || 'off');
      if (s.inputmode) inp.setAttribute('inputmode', s.inputmode); else inp.removeAttribute('inputmode');
      if (s.maxlength) inp.maxLength = s.maxlength; else inp.removeAttribute('maxlength');
      inp.value = '';
      rij.classList.remove('vol');
      try { inp.focus(); } catch (e) {}
    }

    /* Een fout is hier geen rood blokje maar gewoon iets dat Rahul zegt. Daarna
       staat dezelfde vraag er weer; bij een wachtwoord beginnen we het veld
       leeg, want het oude typwerk helpt je niet verder. */
    function misging(bericht) {
      zeg(bericht || 'Dat lukte niet. Probeert u het nog eens.');
      inp.value = '';
      rij.classList.remove('vol');
      try { inp.focus(); } catch (e) {}
    }

    async function verder() {
      if (bezig) return;
      var s = stappen[i];
      var waarde = s.type === 'keuze' ? keus.value : inp.value.trim();
      if (!waarde && !s.mag_leeg) { try { (s.type === 'keuze' ? keus : inp).focus(); } catch (e) {} return; }
      antw[s.sleutel] = waarde;
      /* Een stap mag zelf iets ophalen voordat de volgende vraag komt (de
         meldkamer haalt op de korpscode de lijst met mensen op). Gooit dat,
         dan zegt Rahul het en staat dezelfde vraag er weer. */
      var laatste = i >= stappen.length - 1;
      if (s.doe || laatste) {
        bezig = true; inp.disabled = true; keus.disabled = true; go.disabled = true;
        if (opt.wacht && laatste) zeg(lees(opt.wacht));
        try {
          if (s.doe) await s.doe(antw);
          if (laatste) await opt.klaar(antw);
          // gelukt en klaar: de pagina neemt het over (scherm wisselt)
          bezig = false; inp.disabled = false; keus.disabled = false; go.disabled = false;
          if (!laatste) { i++; return toonStap(); }
          return;
        } catch (err) {
          bezig = false; inp.disabled = false; keus.disabled = false; go.disabled = false;
          i = typeof err.stap === 'number' ? err.stap : i;
          return misging(err && err.message);
        }
      }
      i++; toonStap();
    }

    go.addEventListener('click', verder);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); verder(); } });
    keus.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); verder(); } });
    inp.addEventListener('input', function () { rij.classList.toggle('vol', !!inp.value); });

    var padKnoppen = [];
    (opt.zijpaden || []).forEach(function (p) {
      var b = d.createElement('button');
      b.type = 'button'; b.className = 'rp-pad'; b.textContent = lees(p.tekst);
      b.addEventListener('click', p.doe);
      paden.appendChild(b);
      padKnoppen.push({ knop: b, bron: p.tekst });
    });

    /* Opnieuw lezen zonder het gesprek te storen: de vraag en de zijpaden
       krijgen hun tekst weer, wat er getypt is blijft staan. Eenmaal vlak na
       het opbouwen (de vertaaltabel kan later in de pagina staan) en daarna bij
       elke taalwissel. */
    function hertaal() {
      if (!bezig) { zin.textContent = lees(stappen[i].vraag); inp.placeholder = lees(stappen[i].plho) || ''; }
      padKnoppen.forEach(function (p) { p.knop.textContent = lees(p.bron); });
    }
    setTimeout(hertaal, 0);
    w.addEventListener('rtglang', hertaal);

    if (opt.groet) { zeg(lees(opt.groet)); setTimeout(toonStap, 900); } else toonStap();
    return { zeg: zeg, misging: misging, hertaal: hertaal,
      opnieuw: function () { i = 0; antw = {}; toonStap(); } };
  }

  w.RTGPoort = { gesprek: gesprek };
})(window, document);
