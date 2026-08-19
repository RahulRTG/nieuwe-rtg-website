/* HET REGISTER: welke capabilities er zijn, en welke er NU aan de beurt zijn.

   De leer staat in shared/adaptief.js -- maten, vormen, de keuring. Dit bestand
   is de levende kant ervan in een pagina: wie declareert, wie luistert, en wat
   de huidige context is.

   TWEE DINGEN, EN ZE ZIJN MET OPZET GESCHEIDEN.

   Een DECLARATIE is een blijvende afspraak: "commentaar toevoegen bestaat, en
   ziet er op bureau zo uit en op telefoon zo." Die verandert niet als je iets
   aanklikt.

   De CONTEXT is vluchtig: "je staat in een document, er is tekst geselecteerd,
   en deze vier handelingen zijn nu zinnig." Die verandert bij elke tik.

   De balk leest allebei: hij vraagt de context welke capabilities er nu spelen
   en het register hoe die er op DIT apparaat uitzien. Zo weet de balk niets van
   documenten en weet het document niets van de balk.

   WAT DEZE LAAG NIET DOET: iets verbergen. Een capability zonder vorm op deze
   telefoon is een GEBREK en geen instelling -- hij komt in gebreken() te staan
   en test/adaptief.test.js laat de bouw daarop zakken. Stil weglaten is precies
   de fout waar deze hele laag tegen is (LAT.md regel 3).

   Levert window.RTGAdaptief. */
(function (w, d) {
  'use strict';
  if (w.RTGAdaptief) return;
  var leer = w.RTGAdaptiefLeer;
  if (!leer) return;                       // zonder de leer geen register

  var caps = {}, gebrek = [], gemeld = {};
  var luisterVorm = [], luisterCtx = [];
  var nu = { bron: '', titel: '', acties: [], selectie: false, staat: {}, sleutel: '' };

  /* ------------------------------------------------------------- de vorm --
     Twee mediaqueries en geen resize-teller: de vorm verandert op een grens en
     niet op elke pixel. De grenzen komen uit de leer, zodat er geen tweede
     getal ontstaat naast dat in command.css (WERELD.md-fout in het klein: twee
     lijsten zijn twee waarheden).

     Hier stond eerst innerWidth bij het laden, één keer gemeten. Dat is dezelfde
     fout die de sterrenhemel en de gloed maakten (WERELD.md): meten op een
     moment in plaats van het scherm volgen. Draai je een telefoon, dan klopt een
     gemeten momentopname niet meer. */
  var mqBureau = w.matchMedia('(min-width:' + leer.MAAT.bureau + 'px)');
  var mqTablet = w.matchMedia('(min-width:' + leer.MAAT.tablet + 'px)');
  function vorm() { return mqBureau.matches ? 'bureau' : (mqTablet.matches ? 'tablet' : 'telefoon'); }
  var laatste = vorm();
  function hertoets() {
    var v = vorm();
    if (v === laatste) return;
    laatste = v;
    if (d.documentElement) d.documentElement.setAttribute('data-rtg-vorm', v);
    luisterVorm.slice().forEach(function (f) { try { f(v); } catch (e) {} });
  }
  [mqBureau, mqTablet].forEach(function (mq) {
    if (mq.addEventListener) mq.addEventListener('change', hertoets);
    else if (mq.addListener) mq.addListener(hertoets);
  });
  if (d.documentElement) d.documentElement.setAttribute('data-rtg-vorm', laatste);

  /* -------------------------------------------------------- declareren --
     Een declaratie mag twee keer binnenkomen (een app die herbouwt); de laatste
     wint, want anders zou een herbouw een oude handeling laten staan die naar
     weggehaalde DOM wijst.

     De keuring draait HIER en niet alleen in de toets, want een app kan zijn
     capabilities ook uitrekenen. Wat eruit komt gaat naar gebreken() en één keer
     per id naar de console -- één keer, want een app die bij elke selectie
     opnieuw declareert zou anders de console vullen en daarmee precies die
     melding onleesbaar maken. */
  function declareer(spec) {
    var c = leer.normaliseer(spec);
    if (!c.id) return null;
    var bevindingen = leer.keur([c]);
    if (bevindingen.length) {
      bevindingen.forEach(function (b) {
        gebrek.push(b);
        var s = b.soort + ':' + b.id;
        if (gemeld[s]) return;
        gemeld[s] = 1;
        if (w.console && w.console.warn) w.console.warn('[adaptief] ' + b.id + ': ' + b.wat);
      });
    }
    caps[c.id] = c;
    return c;
  }
  function declareerAlle(lijst) {
    return (Array.isArray(lijst) ? lijst : []).map(declareer).filter(Boolean);
  }

  /* --------------------------------------------------------- de context --
     Wat er NU speelt. `sleutel` is er zodat een luisteraar goedkoop kan zien of
     er iets veranderd is: dezelfde bron met dezelfde acties in dezelfde
     selectiestand hoeft de balk niet opnieuw te tekenen. Zonder dat hertekende
     de balk bij elke `selectionchange` -- en dan verliest een knop die je net
     aanraakt zijn eigen tikgebeurtenis. */
  function sleutelVan(c) {
    /* De STAND van een handeling ("vet staat aan") hoort bij de CONTEXT en niet
       bij de declaratie: dezelfde knop is in het ene document aan en in het
       andere uit. Stond hij in de declaratie, dan was elke cursorbeweging een
       nieuwe declaratie -- en dan is een declaratie geen afspraak meer. Hij telt
       dus mee in de sleutel, anders blijft een knop grijs terwijl hij aan staat. */
    var st = Object.keys(c.staat || {}).sort().map(function (k) {
      return k + (c.staat[k] && c.staat[k].aan ? '+' : '-');
    }).join(',');
    return [c.bron, c.titel, c.selectie ? 's' : '-', (c.acties || []).join('|'), st].join('|~|');
  }
  function context(c) {
    if (c === undefined) return nu;
    var v = { bron: String((c && c.bron) || ''), titel: String((c && c.titel) || ''),
      acties: (c && Array.isArray(c.acties) ? c.acties : []).slice(),
      selectie: !!(c && c.selectie), staat: (c && c.staat) || {} };
    v.sleutel = sleutelVan(v);
    if (v.sleutel === nu.sleutel) return nu;
    nu = v;
    luisterCtx.slice().forEach(function (f) { try { f(nu); } catch (e) {} });
    return nu;
  }
  /* Context WISSEN hoort een eigen handeling te zijn en geen lege aanroep: een
     app die zijn scherm verlaat moet de balk kunnen terugzetten naar "waar je
     bent", en dat is wat een lege context betekent. */
  function wisContext(bron) {
    if (bron && nu.bron && nu.bron !== bron) return nu;   // niet andermans context wissen
    return context({});
  }

  /* ---------------------------------------------------------- uitvoeren --
     De balk kent alleen ids. Wat er gebeurt staat bij de capability, en als daar
     niets staat gebeurt er niets -- geen fout, want een capability mag ook
     alleen een declaratie zijn die door de brug wordt uitgevoerd (in een frame,
     shared/adaptief/brug.js). */
  function doe(id, arg) {
    var c = caps[id];
    if (!c || typeof c.doe !== 'function') return false;
    try { c.doe(arg); } catch (e) { if (w.console) w.console.error('[adaptief] ' + id, e); return false; }
    return true;
  }

  /* De capabilities van de huidige context, in de vorm van DIT apparaat, van
     ondiep naar diep. Dit is het enige wat de balk hoeft te vragen. */
  function voorNu(v) {
    var vm = v || vorm();
    return (nu.acties || []).map(function (id) {
      var c = caps[id];
      if (!c) return null;
      var p = leer.presentaties(c, vm);
      if (!p.length) return null;          // geen vorm hier: gebreken() weet ervan
      var st = nu.staat && nu.staat[id];
      var it = { id: c.id, naam: c.naam, label: c.label || c.naam, teken: c.teken,
        groep: c.groep, primair: c.primair, presentaties: p, diepte: leer.diepte(c, vm) };
      if (st && st.aan !== undefined) it.aan = !!st.aan;
      return it;
    }).filter(Boolean);
  }

  w.RTGAdaptief = {
    vorm: vorm,
    raakmaat: leer.RAAK,
    opVorm: function (f) { if (typeof f === 'function') { luisterVorm.push(f); f(vorm()); } },
    declareer: declareer,
    declareerAlle: declareerAlle,
    capability: function (id) { return caps[id] || null; },
    capabilities: function () { return Object.keys(caps).map(function (k) { return caps[k]; }); },
    context: context,
    wisContext: wisContext,
    opContext: function (f) { if (typeof f === 'function') { luisterCtx.push(f); f(nu); } },
    voorNu: voorNu,
    doe: doe,
    gebreken: function () { return gebrek.slice(); }
  };
})(window, document);
