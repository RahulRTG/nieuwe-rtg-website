  /* ----------------------------------------------- objecten tussen apps --
     Stap 7 uit WERKRUIMTE.md. Niet alleen surfaces bewegen; de OBJECTEN
     bewegen door RTG heen: een reis naar de Agenda, een persoon naar een
     uitnodiging, een factuur naar een boeking.

     TWEE REGELS, en die maken het verschil met "een desktop met vensters".

     1. EEN SLEEP IS EEN VOORSTEL, GEEN HANDELING. Loslaten toont wat er gaat
        gebeuren en wie het uitvoert; bevestigen doet een mens. Dezelfde drempel
        als bij geld en bij Rahul (CLAUDE.md). Zonder die stap is een uitschieter
        met de muis een afspraak in iemands agenda.

     2. DE SCHIL DRAAGT EEN VERWIJZING, NOOIT EEN DOSSIER. Hetzelfde als bij
        Context Linking (par. 5): de ontvanger doet de handeling met ZIJN eigen
        sessie en ZIJN eigen rechten. De schil weet niet wat een reis is en mag
        dat ook niet weten -- anders kruipt domeinkennis in de vensterlaag.

     Wat een verwijzing WEL mag dragen: soort, id, label, en een klein aantal
     `velden` die de verzender al op het scherm had staan. Dat is geen
     sluiproute: het is dezelfde gebruiker, in dezelfde browser, die dat net zelf
     zag staan. Wat er NOOIT in mag: iets wat de verzender zelf niet toonde.

     HET GESPREK, in vier berichten (alle vier same-origin postMessage):
       app  -> schil   sleep-start   {object:{soort,id,label,velden}}
       schil-> app     sleep-kan     {object}          "kun jij hier iets mee?"
       app  -> schil   sleep-kan-ja  {wat:'...'}       "ja: ik zet er een afspraak van"
       schil-> app     sleep-doe     {object}          pas NA bevestiging door een mens
     Een app die niet antwoordt, is geen doelwit. Zwijgen is nee. */

  var sleepObject = null;      // wat er nu gesleept wordt
  var sleepDoel = null;        // de surface waar de muis boven hangt
  var sleepAanbod = {};        // surface-id -> wat die surface ermee zou doen

  function surfaceVanVenster(bron) {
    for (var i = 0; i < schil.surfaces.length; i++) {
      var f = schil.surfaces[i].el.querySelector('iframe');
      if (f && f.contentWindow === bron) return schil.surfaces[i];
    }
    return null;
  }

  function naarSurface(s, bericht) {
    var f = s.el.querySelector('iframe');
    if (!f || !f.contentWindow) return;
    try { f.contentWindow.postMessage(bericht, location.origin); } catch (e) { /* laadt nog */ }
  }

  /* Bij het oppakken vragen we ALLE andere surfaces of ze er iets mee kunnen.
     Vooraf en niet bij het loslaten: zo kan de schil tijdens het slepen laten
     zien welke surfaces oplichten, en weet de gebruiker waar hij heen kan
     voordat hij loslaat. */
  /* EEN VANGVLAK OVER DE HELE RUIMTE, zolang er gesleept wordt.
     Een surface draait als eigen pagina in een iframe, en zodra de cursor daar
     boven hangt gaan de pointer-events NAAR DAT FRAME. De schil zag de muis dan
     niet meer bewegen en wist bij loslaten niet waar hij was: je sleepte iets
     naar de agenda en er gebeurde niets. Dit doorzichtige vlak vangt de
     beweging op zolang het slepen duurt, en verdwijnt daarna meteen -- want een
     vlak dat blijft liggen maakt elke app onklikbaar. */
  function vangvlak(aan) {
    var v = schil.vak.querySelector('.rtg-sleepvangst');
    if (aan) {
      if (!v) v = el('div', 'rtg-sleepvangst', schil.vak);
      v.setAttribute('data-aan', '');
    } else if (v) { v.removeAttribute('data-aan'); }
  }

  function sleepStart(vanSurface, object) {
    sleepObject = object;
    sleepAanbod = {};
    schil.vak.setAttribute('data-sleept-object', '');
    vangvlak(true);
    schil.surfaces.forEach(function (s) {
      if (s === vanSurface) return;
      naarSurface(s, { rtg: 'sleep-kan', object: object });
    });
    d.addEventListener('pointermove', sleepBeweeg);
    d.addEventListener('pointerup', sleepLos);
  }

  function sleepKanJa(s, wat) {
    if (!sleepObject || !wat) return;
    sleepAanbod[s.id] = String(wat).slice(0, 120);
    s.el.setAttribute('data-kan-vangen', '');
    var tab = tabVanSurface(s);
    if (tab) tab.setAttribute('data-kan-vangen', '');
  }

  function tabVanSurface(s) {
    if (!schil.tabs) return null;
    var tabs = schil.tabs.querySelectorAll('.rtg-tab[data-id]');
    for (var i = 0; i < tabs.length; i++) if (tabs[i].dataset.id === s.id) return tabs[i];
    return null;
  }

  function surfaceOp(x, y) {
    /* In de standaard Werk OS-weergave staat maar een appvlak tegelijk open.
       De overige apps zijn bereikbaar via hun zichtbare tab. Een tab die door
       de ontvangende app als doel is aanvaard, is daarom een volwaardig
       sleepdoel: zo hoeft de gebruiker een app niet eerst te openen en het
       object daarna opnieuw op te pakken. */
    if (schil.tabs) {
      var tabs = schil.tabs.querySelectorAll('.rtg-tab[data-id][data-kan-vangen]');
      for (var t = tabs.length - 1; t >= 0; t--) {
        var tr = tabs[t].getBoundingClientRect();
        if (x >= tr.left && x <= tr.right && y >= tr.top && y <= tr.bottom) return vind(tabs[t].dataset.id);
      }
    }
    for (var i = schil.surfaces.length - 1; i >= 0; i--) {
      var stijl = w.getComputedStyle(schil.surfaces[i].el);
      if (stijl.visibility === 'hidden' || stijl.display === 'none' || stijl.pointerEvents === 'none') continue;
      var r = schil.surfaces[i].el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return schil.surfaces[i];
    }
    return null;
  }

  function sleepBeweeg(e) {
    var s = surfaceOp(e.clientX, e.clientY);
    var nieuw = (s && sleepAanbod[s.id]) ? s : null;
    if (nieuw === sleepDoel) return;
    if (sleepDoel) {
      sleepDoel.el.removeAttribute('data-vangt');
      var oudTab = tabVanSurface(sleepDoel);
      if (oudTab) oudTab.removeAttribute('data-vangt');
    }
    sleepDoel = nieuw;
    if (sleepDoel) {
      sleepDoel.el.setAttribute('data-vangt', '');
      var nieuwTab = tabVanSurface(sleepDoel);
      if (nieuwTab) nieuwTab.setAttribute('data-vangt', '');
    }
  }

  function sleepLos() {
    d.removeEventListener('pointermove', sleepBeweeg);
    d.removeEventListener('pointerup', sleepLos);
    schil.vak.removeAttribute('data-sleept-object');
    vangvlak(false);
    schil.surfaces.forEach(function (s) {
      s.el.removeAttribute('data-kan-vangen'); s.el.removeAttribute('data-vangt');
    });
    if (schil.tabs) schil.tabs.querySelectorAll('[data-kan-vangen],[data-vangt]').forEach(function (tab) {
      tab.removeAttribute('data-kan-vangen'); tab.removeAttribute('data-vangt');
    });
    var doel = sleepDoel, object = sleepObject;
    sleepDoel = null;
    if (!doel || !object) { sleepObject = null; return; }
    toonVoorstel(doel, object, sleepAanbod[doel.id]);
  }

  /* HET VOORSTEL. Hier staat wat er gaat gebeuren, met WELK object en door
     WELKE app -- en niets gebeurt tot een mens op bevestigen drukt. */
  function toonVoorstel(doel, object, wat) {
    var vak = schil.vak.querySelector('.rtg-voorstel') || el('div', 'rtg-voorstel', schil.vak);
    vak.innerHTML =
      '<div class="doos" role="dialog" aria-modal="true" aria-label="Voorstel">' +
        '<p class="wat"></p>' +
        '<p class="wie"></p>' +
        '<div class="knoppen">' +
          '<button type="button" data-doe="nee">Annuleren</button>' +
          '<button type="button" data-doe="ja" class="vol">Bevestigen</button>' +
        '</div>' +
      '</div>';
    vak.querySelector('.wat').textContent = (object.label || object.soort) + ': ' + wat;
    vak.querySelector('.wie').textContent = 'Uitgevoerd door ' + doel.naam + ', met uw rechten daar.';
    vak.setAttribute('data-aan', '');
    var weg = function () { vak.removeAttribute('data-aan'); vak.innerHTML = ''; sleepObject = null; };
    vak.querySelector('[data-doe="nee"]').addEventListener('click', weg);
    vak.querySelector('[data-doe="ja"]').addEventListener('click', function () {
      naarSurface(doel, { rtg: 'sleep-doe', object: object });
      maakActief(doel);
      weg();
    });
    vak.querySelector('[data-doe="ja"]').focus();
  }

  /* Wat een app mag sturen, en wat er van gelezen wordt. Alles wordt gekapt:
     een verwijzing hoort klein te zijn, en een app die er een dossier in propt
     krijgt hem afgekapt in plaats van dat de schil hem doorgeeft. */
  function schoneVerwijzing(o) {
    if (!o || !o.id) return null;
    var velden = {};
    var bron = o.velden && typeof o.velden === 'object' ? o.velden : {};
    var namen = Object.keys(bron).slice(0, 8);
    namen.forEach(function (n) { velden[String(n).slice(0, 24)] = String(bron[n] == null ? '' : bron[n]).slice(0, 120); });
    return {
      soort: String(o.soort || '').slice(0, 32),
      id: String(o.id).slice(0, 64),
      label: String(o.label || '').slice(0, 120),
      velden: velden
    };
  }
