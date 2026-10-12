/* HET TAAKBEELD OP DE EDGE -- hoe een beurt van Rahul aan het stuur eruitziet
   onder zijn antwoord (EDGE.md par. 14.4, stap 2).

   Dit bestand VERZINT NIETS. Het taakbeeld komt van de server
   (server/kern/stuur/taakbeeld.js): de stand van elke stap komt uit het
   beleid of uit een echte uitvoering, en wat het model aanleverde draagt
   `herkomst: 'model'`. Hier wordt het alleen getekend, en alles als TEKST
   (textContent), nooit als opmaak: een doel of uitkomst komt uit een model.

   Wat er staat, in de volgorde waarin een mens het leest:
     - wat Rahul begreep (de vraag, en het scherm als de server dat afleidde);
     - het voorstel, als "Rahul stelt voor" -- nooit als iets dat gebeurd is;
     - per stap: uitgevoerd, wacht op uw bevestiging, geblokkeerd (met de
       reden), of beschikbaar;
     - de grens: wat hiervan werkelijk is gebeurd.

   Levert window.RTGEdgeTaakbeeld.teken(taak, document) -> element of null, en
   in node module.exports. Zonder plan en zonder uitvoering tekent het niets:
   een leeg kader zou een taak suggereren die er niet is. */
(function (root, fabriek) {
  'use strict';
  var api = fabriek();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (root) root.RTGEdgeTaakbeeld = api;
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var WOORD = {
    UITGEVOERD: 'uitgevoerd',
    WACHT: 'wacht op uw bevestiging',
    GEBLOKKEERD: 'geblokkeerd',
    GEWEIGERD: 'niet gelukt',
    BESCHIKBAAR: 'voorgesteld'
  };

  /* Een regel is een span met een regeleinde ervoor: de draad is pre-wrap, en de
     spiegel in de schilbalk (shared/command/praat.js) leest textContent --
     zonder echte regeleinden liepen de stappen daar in elkaar over. */
  function regel(d, cls, tekst) {
    var e = d.createElement('span');
    e.className = 'os-taak-regel ' + cls;
    e.textContent = tekst;
    return e;
  }

  /* Een stap als een regel tekst. De stand komt van de server; staat er een
     onbekende stand, dan zegt de regel dat en raadt hij niets. */
  function stapTekst(s) {
    var w = WOORD[s.staat] || 'stand onbekend';
    /* Nooit een pad: wat een mens leest is de bedoeling van de stap, en als die
       er niet is "een stap". Het pad staat in het antwoord voor wie nakijkt. */
    var wat = (s.uitkomst && s.uitkomst.tekst) || 'een stap';
    var t = wat + ' -- ' + w;
    if (s.staat === 'BESCHIKBAAR' && s.bevestiging === 'mens') t += ' (vraagt uw bevestiging)';
    if (s.staat === 'GEBLOKKEERD') t += ': ' + (s.voorMens || 'dit kan nu niet');
    return t;
  }

  /* Een concept: wat een domein uit de vraag herkende, met wat bekend is, wat
     aangenomen is en wat nog ontbreekt. Het tekent velden en geen domein: er
     staat hier geen reiswoord. */
  function conceptRegels(c) {
    var r = [];
    if (!c || !c.titel) return r;
    r.push({ cls: 'doel', tekst: c.titel });
    (c.velden || []).forEach(function (v) {
      r.push({ cls: 'veld' + (v.aanname ? ' aanname' : ''),
        tekst: v.naam + ': ' + v.waarde + (v.aanname ? ' (aangenomen: ' + v.aanname + '; pas aan als dat niet klopt)' : '') });
    });
    if (c.ontbreekt && c.ontbreekt.length) r.push({ cls: 'ontbreekt', tekst: 'Nog nodig: ' + c.ontbreekt.join(', ') });
    if (c.volgende) r.push({ cls: 'volgende', tekst: c.volgende });
    return r;
  }

  /* De regels zelf, zonder DOM: dezelfde volgorde en dezelfde woorden voor de
     draad in de schil (teken) en de notitie van de Rahul-tab
     (rahul-tab/helpers.js). Een tweede opsomming van de standen zou een tweede
     waarheid zijn. */
  function regels(taak) {
    if (!taak) return [];
    var plan = taak.plan, uit = taak.uitgevoerd || [], r = [], b = taak.begrepen || {};
    if (!plan && !uit.length && !taak.concept) return [];
    /* Het onderwerp alleen als de vraag erover GAAT; een open aanvraag die bij
       een nieuwe vraag op het scherm staat, wordt niet het onderwerp. */
    if (b.onderwerp && (b.relatie === 'over' || b.relatie === 'wijzig'))
      r.push({ cls: 'begrepen', tekst: (b.relatie === 'wijzig' ? 'Wijziging van ' : 'Over ') + b.onderwerp });
    r = r.concat(conceptRegels(taak.concept));
    if (plan) {
      if (plan.doel && plan.doel.tekst) r.push({ cls: 'doel', tekst: 'Rahul stelt voor: ' + plan.doel.tekst });
      (plan.stappen || []).forEach(function (s) {
        r.push({ cls: 'stap staat-' + String(s.staat || 'onbekend').toLowerCase(), tekst: stapTekst(s) });
      });
      if (!plan.uitvoerbaar && plan.nietUitvoerbaarVoorMens)
        r.push({ cls: 'bezwaar', tekst: plan.nietUitvoerbaarVoorMens });
    }
    /* Wat werkelijk gebeurde en niet in het plan stond, staat er ook: een
       uitvoering die je niet ziet, bestaat voor de mens niet. */
    var inPlan = plan ? (plan.stappen || []).map(function (s) { return s.capability; }) : [];
    uit.forEach(function (u) { if (inPlan.indexOf(u.pad) < 0) r.push({ cls: 'stap staat-uitgevoerd', tekst: 'een stap -- uitgevoerd' }); });
    if (taak.grens) r.push({ cls: 'grens', tekst: taak.grens });
    return r;
  }

  function teken(taak, d) {
    var r = regels(taak);
    if (!r.length || !d) return null;
    var e = d.createElement('div');
    e.className = 'os-taak';
    e.setAttribute('role', 'group');
    e.setAttribute('aria-label', 'Wat Rahul begreep en voorstelt');
    r.forEach(function (x) {
      if (e.firstChild) e.appendChild(d.createTextNode('\n'));
      e.appendChild(regel(d, x.cls, x.tekst));
    });
    return e;
  }

  return { teken: teken, regels: regels, conceptRegels: conceptRegels, stapTekst: stapTekst, WOORD: WOORD };
}));
