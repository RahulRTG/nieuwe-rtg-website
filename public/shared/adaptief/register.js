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
  /* De grammatica keurt de andere helft: gebaren, gewicht en de verplichte reden
     bij een verhindering. Hij mag ontbreken -- dan blijft een gedeclareerd
     gewicht STAAN (met het gebrek `gewichtloos`) en gaat alles wat niet licht is
     dicht: een zware handeling mag nooit stil als lichte doorgaan. */
  var gram = w.RTGGrammatica || null;
  var V = w.RTGAdaptiefVorm;
  if (!V) return;                          // zonder de vorm geen register

  var caps = {}, gebrek = [], gemeld = {};
  var luisterCtx = [];
  var nu = { bron: '', titel: '', acties: [], selectie: false, staat: {}, rail: [], sleutel: '' };

  /* De vorm van het apparaat woont in ./vorm.js (afgesplitst op de grens van
     10 KB); het register geeft hem door onder zijn eigen naam. */
  var vorm = V.vorm;

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
    var bevindingen = leer.keur([c]).concat(gram ? gram.keur([c]) : []);
    if (!gram && c.gewicht && c.gewicht !== 'licht') {
      bevindingen.push({ soort: 'gewichtloos', id: c.id,
        wat: 'gewicht "' + c.gewicht + '" gedeclareerd zonder grammatica-laag' });
    }
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
      try { return k + JSON.stringify(c.staat[k], function (s, v) { return typeof v === 'function' ? 'f' : v; }); }
      catch (e) { return k; }
    }).join(',');
    var rl = (c.rail || []).map(function (x) { return x && (x.sleutel + ':' + x.tekst + ':' + x.staat); }).join(',');
    return [c.bron, c.titel, c.selectie ? 's' : '-', (c.acties || []).join('|'), st, rl,
      JSON.stringify(c.object || null), c.activiteit || ''].join('|~|');
  }
  function context(c) {
    if (c === undefined) return nu;
    var v = { bron: String((c && c.bron) || ''), titel: String((c && c.titel) || ''),
      acties: (c && Array.isArray(c.acties) ? c.acties : []).slice(),
      selectie: !!(c && c.selectie), staat: (c && c.staat) || {},
      rail: (c && Array.isArray(c.rail) ? c.rail : []),
      object: (c && c.object && typeof c.object === 'object') ? c.object : null,
      activiteit: String((c && c.activiteit) || '') };
    v.sleutel = sleutelVan(v);
    if (v.sleutel === nu.sleutel) return nu;
    nu = v;
    luisterCtx.slice().forEach(function (f) { try { f(nu); } catch (e) {} });
    return nu;
  }
  /* Een vertrekkend scherm kan alleen zijn eigen context wissen. */
  function wisContext(bron) {
    if (bron && nu.bron && nu.bron !== bron) return nu;   // niet andermans context wissen
    return context({});
  }

  /* Uitvoeren gaat uitsluitend via het id van een capability. */
  /* EEN VERHINDERDE HANDELING WORDT HIER GEWEIGERD EN NIET ALLEEN GRIJS
     GETEKEND. Een knop die er uitgeschakeld uitziet maar bij een toetsaanslag of
     via de orb alsnog draait, is geen beperking maar een lek. */
  function mag(id) {
    var c = caps[id];
    if (!c) return false;
    var st = nu.staat && nu.staat[id];
    return !((st && st.verhinderd) || c.verhinderd);
  }
  function doe(id, arg) {
    var c = caps[id];
    if (!c || typeof c.doe !== 'function') return false;
    if (!mag(id)) return false;
    try { var result = c.doe(arg); if (result && typeof result.then === 'function') return result; } catch (e) { if (w.console) w.console.error('[adaptief] ' + id, e); return false; }
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
        groep: c.groep, primair: c.primair, presentaties: p, diepte: leer.diepte(c, vm),
        gewicht: c.gewicht };
      if (st && st.aan !== undefined) it.aan = !!st.aan;
      /* EEN VERHINDERING KOMT UIT DE CONTEXT ALS HIJ ER IS, ANDERS UIT DE
         DECLARATIE. Dat onderscheid is nodig: "extern delen mag niet" kan een
         vaste eigenschap van de handeling zijn (beleid) of van dit ene stuk
         (classificatie). Het tweede weet alleen het scherm, op dit moment. */
      var h = (st && st.verhinderd) || c.verhinderd;
      if (h && gram) it.verhinderd = gram.verhindering(h);
      /* WAT ER IN DE BEVESTIGING KOMT TE STAAN, is net zo goed context: aan wie
         je deelt en om welk bedrag het gaat, hangt van dit moment af en niet van
         de declaratie. Zonder dit zou de lade "Gaat naar" leeg laten -- en dan is
         het weer een "weet u het zeker?" zonder inhoud. */
      if (st && st.bevestiging) it.bevestiging = st.bevestiging;
      if (st && typeof st.ongedaan === 'function') it.ongedaan = st.ongedaan;
      return it;
    }).filter(Boolean);
  }

  w.RTGAdaptief = {
    vorm: vorm,
    raakmaat: leer.RAAK,
    opVorm: V.opVorm,
    declareer: declareer,
    declareerAlle: declareerAlle,
    capability: function (id) { return caps[id] || null; },
    capabilities: function () { return Object.keys(caps).map(function (k) { return caps[k]; }); },
    context: context,
    wisContext: wisContext,
    opContext: function (f) { if (typeof f !== 'function') return function () {};
      luisterCtx.push(f); f(nu); return function () { var i = luisterCtx.indexOf(f); if (i >= 0) luisterCtx.splice(i, 1); }; },
    voorNu: voorNu,
    doe: doe,
    mag: mag,
    gebreken: function () { return gebrek.slice(); }
  };
})(window, document);
