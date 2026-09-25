/* DE POORTEN VAN DE TOESTELREKENLAAG -- zes die uitsluiten, en een die kiest.
   TOESTEL.md par. 9.1.

   Een rekentaak (een TAAKCONTRACT) kan op meer dan een manier worden gedaan:
   op het toestel met WebGPU of WASM, op de eigen modelserver van RTG, of niet.
   Elke manier is een KANDIDAAT. Deze module zegt welke kandidaat het wordt.

   DE VORM IS DE REGEL. Zes poorten sluiten uit en wegen niets:

     beleid      mag deze taak hier gedaan worden?
     privacy     mag de invoer deze PLAATS bereiken (huisslot en lidslot)?
     techniek    kan deze techniek de taak doen?
     uitvoerder  is de uitvoerder hier aanwezig?
     kwaliteit   haalt hij de GEMETEN minimumkwaliteit?
     last        past hij in starttijd, geheugen, rekentijd en batterij?

   Pas wat alle zes haalt, komt bij de zevende: kosten, de enige die KIEST.
   Een kandidaat die ergens is afgevallen, bestaat voor de kostenstap niet --
   er is geen functie die een kandidaat een getal geeft over alle eigenschappen
   heen, dus kan een kostenvoordeel ook nooit een privacy- of kwaliteitsgrens
   compenseren. test/toestel-poorten.test.js houdt dat vast met willekeurige
   kandidaten: een afgevallen kandidaat wordt nooit gekozen.

   Elke uitsluiting draagt haar reden in woorden. Valt alles af, dan is de
   uitslag "kan hier niet", met per kandidaat waar en waarom -- nooit een stille
   uitwijk naar een plaats die een eerdere poort verbood.

   Puur: geen DOM, geen opslag, geen netwerk. In de browser window.RTGToestelPoorten,
   in Node via require. */
(function (root, fabriek) {
  'use strict';
  var api = fabriek();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RTGToestelPoorten = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var PLAATSEN = Object.freeze(['toestel', 'rtg-omgeving', 'extern']);
  var POORTEN = Object.freeze(['beleid', 'privacy', 'techniek', 'uitvoerder', 'kwaliteit', 'last']);

  function lijst(x) { return Array.isArray(x) ? x : []; }
  function getal(x) { return typeof x === 'number' && isFinite(x); }

  /* Elke poort: (contract, kandidaat, context) -> null (door) of een reden. */
  var TOETS = {
    beleid: function (c, k, ctx) {
      /* Faalt dicht: een taak zonder uitgesproken beleid mag niets. */
      var b = ctx && ctx.beleid && ctx.beleid[c.taak];
      if (b !== true) return 'er is geen beleid dat deze taak hier toestaat';
      return null;
    },
    privacy: function (c, k, ctx) {
      if (PLAATSEN.indexOf(k.plaats) < 0) return 'onbekende plaats: ' + k.plaats;
      if (lijst(c.plaatsen).indexOf(k.plaats) < 0)
        return 'het taakcontract staat de plaats ' + k.plaats + ' niet toe';
      var huis = ctx && ctx.huis || {};
      if (k.plaats === 'extern' && huis.externUit === true) return 'het huis heeft externe verwerking uitgezet';
      if (huis.aiUit === true && k.plaats !== 'toestel')
        return 'het huis heeft modelverwerking op zijn servers uitgezet';
      /* Het slot van het lid: "dit toestel nooit verlaten". Het strengste wint. */
      var lid = ctx && ctx.lid || {};
      if (lid.alleenToestel === true && k.plaats !== 'toestel')
        return 'het lid heeft gekozen dat deze taak het toestel niet verlaat';
      return null;
    },
    techniek: function (c, k) {
      if (lijst(c.technieken).indexOf(k.techniek) < 0)
        return 'de techniek ' + k.techniek + ' kan deze taak volgens het contract niet doen';
      return null;
    },
    uitvoerder: function (c, k) {
      if (k.beschikbaar !== true) return k.nietBeschikbaar || 'de uitvoerder is hier niet aanwezig';
      return null;
    },
    kwaliteit: function (c, k) {
      var eis = c.kwaliteit;
      if (!eis) return 'het contract noemt geen minimumkwaliteit, en dan is er niets om te halen';
      var m = k.kwaliteit && k.kwaliteit[eis.maat];
      if (!m || !getal(m.waarde)) return 'de kwaliteit (' + eis.maat + ') is voor deze uitvoerder niet gemeten';
      if (eis.graad && m.graad !== eis.graad) return 'de kwaliteit is ' + (m.graad || 'onbekend') + ' en niet ' + eis.graad;
      if (getal(eis.max) && m.waarde > eis.max) return eis.maat + ' ' + m.waarde + ' is boven de grens ' + eis.max;
      if (getal(eis.min) && m.waarde < eis.min) return eis.maat + ' ' + m.waarde + ' is onder de grens ' + eis.min;
      return null;
    },
    last: function (c, k, ctx) {
      var l = k.last || {}, g = c.last || {};
      if (k.plaats !== 'toestel') return null; // de last op het toestel geldt voor het toestel
      if (getal(g.startMaxMs)) {
        if (!getal(l.startMs)) return 'de starttijd is op dit toestel niet gemeten';
        if (l.startMs > g.startMaxMs) return 'de starttijd ' + l.startMs + ' ms is boven ' + g.startMaxMs + ' ms';
      }
      if (getal(g.geheugenMaxMb) && getal(l.geheugenMb) && l.geheugenMb > g.geheugenMaxMb)
        return 'het geheugen ' + l.geheugenMb + ' MB is boven ' + g.geheugenMaxMb + ' MB';
      if (getal(g.modelMaxMb) && getal(l.modelMb) && l.modelMb > g.modelMaxMb)
        return 'het model ' + l.modelMb + ' MB is boven ' + g.modelMaxMb + ' MB';
      var t = ctx && ctx.toestel || {};
      if (t.vertraagd === true) return 'het toestel wordt trager bij herhaling; zwaar werk stopt voor deze sessie';
      if (g.zwaar === true) {
        /* Batterij is alleen in Chromium te zien. Ontbreekt het signaal, dan de
           strengste aanname: geen zwaar werk (TOESTEL.md par. 9.4). */
        var b = t.batterij;
        if (!b || typeof b.laadt !== 'boolean') return 'de batterij is hier niet te zien; zwaar werk alleen waar dat wel kan';
        if (!b.laadt && !(getal(b.niveau) && getal(g.batterijMin) && b.niveau >= g.batterijMin))
          return 'het toestel laadt niet en de batterij is te laag voor zwaar werk';
      }
      if (t.spaarBatterij === true && g.zwaar === true) return 'het lid spaart zijn batterij';
      return null;
    }
  };

  /* Kosten: de enige stap die kiest, en alleen tussen wie alles haalde.
     Een onbekend bedrag is geen nul: zo'n kandidaat komt achter wie een
     bedrag heeft, met de reden erbij. Gelijk bedrag: vaste volgorde op id,
     want een keuze die per keer anders uitvalt is geen keuze. */
  function kiesOpKosten(over) {
    var gesorteerd = over.slice().sort(function (a, b) {
      var ka = getal(a.kosten), kb = getal(b.kosten);
      if (ka && kb && a.kosten !== b.kosten) return a.kosten - b.kosten;
      if (ka !== kb) return ka ? -1 : 1;
      return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
    });
    var k = gesorteerd[0];
    return { kandidaat: k, reden: getal(k.kosten)
      ? 'de goedkoopste van ' + over.length + ' die alle poorten haalden'
      : 'geen van de overgebleven kandidaten heeft een bekend bedrag; vaste volgorde op naam' };
  }

  function kies(contract, kandidaten, context) {
    var c = contract || {}, uitgesloten = [], over = [];
    lijst(kandidaten).forEach(function (k) {
      if (!k || typeof k !== 'object') return;
      for (var i = 0; i < POORTEN.length; i++) {
        var reden = TOETS[POORTEN[i]](c, k, context || {});
        if (reden) { uitgesloten.push({ id: k.id, poort: POORTEN[i], reden: reden }); return; }
      }
      over.push(k);
    });
    if (!over.length) {
      return { gekozen: null, taak: c.taak || null, uitgesloten: uitgesloten,
        reden: 'deze taak kan hier niet: geen enkele kandidaat haalde alle poorten' };
    }
    var keus = kiesOpKosten(over);
    return { gekozen: keus.kandidaat, taak: c.taak || null, uitgesloten: uitgesloten, reden: keus.reden };
  }

  return Object.freeze({ PLAATSEN: PLAATSEN, POORTEN: POORTEN, kies: kies });
}));
