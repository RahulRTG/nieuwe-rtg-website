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
    var wat = (s.uitkomst && s.uitkomst.tekst) || s.capability || 'stap';
    var t = wat + ' -- ' + w;
    if (s.staat === 'BESCHIKBAAR' && s.bevestiging === 'mens') t += ' (vraagt uw bevestiging)';
    if (s.staat === 'GEBLOKKEERD' && s.waarom) t += ': ' + s.waarom;
    return t;
  }

  /* De regels zelf, zonder DOM: dezelfde volgorde en dezelfde woorden voor de
     draad in de schil (teken) en de notitie van de Rahul-tab
     (rahul-tab/helpers.js). Een tweede opsomming van de standen zou een tweede
     waarheid zijn. */
  function regels(taak) {
    if (!taak) return [];
    var plan = taak.plan, uit = taak.uitgevoerd || [], r = [];
    if (!plan && !uit.length) return [];
    if (taak.begrepen && taak.begrepen.scherm) r.push({ cls: 'begrepen', tekst: 'Op uw scherm: ' + taak.begrepen.scherm });
    if (plan) {
      if (plan.doel && plan.doel.tekst) r.push({ cls: 'doel', tekst: 'Rahul stelt voor: ' + plan.doel.tekst });
      (plan.stappen || []).forEach(function (s) {
        r.push({ cls: 'stap staat-' + String(s.staat || 'onbekend').toLowerCase(), tekst: stapTekst(s) });
      });
      if (!plan.uitvoerbaar && plan.bezwaren && plan.bezwaren.length)
        r.push({ cls: 'bezwaar', tekst: 'Zo kan het niet: ' + plan.bezwaren[0] });
    }
    /* Wat werkelijk gebeurde en niet in het plan stond, staat er ook: een
       uitvoering die je niet ziet, bestaat voor de mens niet. */
    var inPlan = plan ? (plan.stappen || []).map(function (s) { return s.capability; }) : [];
    uit.forEach(function (u) { if (inPlan.indexOf(u.pad) < 0) r.push({ cls: 'stap staat-uitgevoerd', tekst: u.pad + ' -- uitgevoerd' }); });
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

  return { teken: teken, regels: regels, stapTekst: stapTekst, WOORD: WOORD };
}));
