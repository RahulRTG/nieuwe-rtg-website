/* RTG Kassa: DE BON DIE NIET WEG KON.

   HORECA.md zegt dat elke locatie moet blijven werken zonder internet. Tot nu
   toe deed de kassa dat niet: viel de verbinding weg, dan gaf `pos/sale` een
   netwerkfout, verdween de bon en telde de omzet nooit mee. Een kassa die bij
   een haperende lijn stilstaat, dwingt een zaak om op papier te gaan werken --
   en dat papier komt zelden terug in de boekhouding.

   HET GEVAARLIJKE DEEL IS NIET DE WACHTRIJ MAAR DE HERHALING. Een wachtrij is
   per definitie iets dat opnieuw verstuurt, en `pos/sale` ontdubbelde niets:
   twee keer versturen gaf twee bonnen, twee keer voorraadafboeking en twee
   facturen. Die kant is eerst gerepareerd (kern/kassa/herhaling.js,
   test/kassa-herhaling.test.js); pas daarna mocht dit bestaan.

   VIJF REGELS DIE HIER GELDEN, en die allemaal een reden hebben:

   1. DE SLEUTEL WORDT EEN KEER GEMAAKT, bij het afrekenen, en gaat MEE de
      wachtrij in. Wie hem bij elke poging opnieuw maakt, heeft geen
      idempotentie maar een generator van dubbele omzet. Dit is de enige regel
      waar de hele wachtrij op staat.
   2. RTG PAY GAAT NOOIT IN DE WACHTRIJ. Contant geld ligt in de la en pin gaat
      buiten ons om; die zijn echt gebeurd en mogen later aankomen. Een
      RTG-betaalcode moet gecontroleerd worden op het moment zelf -- een bon
      "afgerekend" noemen terwijl niemand weet of de code geldig was, is een
      belofte die we niet kunnen waarmaken.
   3. ER GAAT PAS IETS WEG ALS DE SERVER HET BEVESTIGT. Een netwerkfout laat de
      bon staan. Een fout van de server zelf (een geweigerde bon, een conflict)
      haalt hem uit de rij en zet hem apart met de reden erbij: zichtbaar
      vastgelopen is beter dan stil weg.
   4. EEN VOOR EEN EN OUDSTE EERST. Alles tegelijk versturen bij het herstellen
      van de lijn geeft een storm en verliest de volgorde van de avond.
   5. VOL IS VOL, EN DAT ZEGGEN WE. Bij de bovengrens weigert de kassa een
      nieuwe offline bon in plaats van stilletjes de oudste te vergeten.

   WAT DIT NIET REPAREERT. De tijd op de bon blijft de tijd van AANKOMST bij de
   server; het moment waarop de kassa hem opstelde reist mee als `offlineVanaf`
   en staat op de bon, maar bepaalt niets. De client mag de datum van omzet niet
   kunnen kiezen -- dat is precies de knop waarmee je een dagrapport verplaatst. */
(function () {
  'use strict';
  var SLEUTEL = 'rtg_kassa_wachtrij';
  var VAST = 'rtg_kassa_vastgelopen';
  var MAX = 200;
  var HERPROBEER_MS = 20000;
  // alleen deze betaalwijzen mogen wachten; zie regel 2 hierboven
  var MAG_WACHTEN = ['contant', 'pin', 'tafel'];

  function lees(sleutel) {
    try { var t = localStorage.getItem(sleutel); return t ? (JSON.parse(t) || []) : []; }
    catch (e) { return []; }
  }
  function schrijf(sleutel, lijst) {
    try { localStorage.setItem(sleutel, JSON.stringify(lijst)); return true; }
    catch (e) { return false; }
  }

  var W = {
    _token: null,
    _bezig: false,
    _bijWijziging: function () {},

    /* De kassa geeft zijn token mee: hij kan tussentijds verlopen, en dan hoort
       de wachtrij te blijven staan tot iemand opnieuw inlogt. */
    zet: function (token, bijWijziging) {
      W._token = token;
      if (bijWijziging) W._bijWijziging = bijWijziging;
      window.addEventListener('online', W.leeg);
      setInterval(function () { if (W.rij().length) W.leeg(); }, HERPROBEER_MS);
      W._bijWijziging(W.stand());
      if (W.rij().length) W.leeg();
    },

    rij: function () { return lees(SLEUTEL); },
    vastgelopen: function () { return lees(VAST); },
    stand: function () { return { wacht: W.rij().length, vast: W.vastgelopen().length }; },

    /* Het enige pad waarlangs de kassa afrekent. Lukt het verzoek, dan komt het
       antwoord van de server terug. Ketst het af op het NETWERK, dan gaat de
       bon in de rij en komt er `{ gewacht: true }` terug. Weigert de SERVER de
       bon, dan gooit dit door -- dat is geen storing maar een antwoord. */
    verstuur: function (body) {
      return W._stuur(body).catch(function (e) {
        if (!e || !e.netwerk) throw e;
        if (MAG_WACHTEN.indexOf(body.method) < 0) throw e;
        var r = W.rij();
        if (r.length >= MAX) throw new Error('De wachtrij zit vol (' + MAX + ' bonnen). Herstel eerst de verbinding.');
        /* HIER staat de sleutel al in `body`: hij is bij het afrekenen gemaakt
           en wordt nooit meer vervangen. Zie regel 1. */
        r.push({ body: body, opgesteld: new Date().toISOString(), pogingen: 0 });
        if (!schrijf(SLEUTEL, r)) throw new Error('Deze kassa kan niets bewaren; de bon is niet geregistreerd.');
        W._bijWijziging(W.stand());
        return { gewacht: true };
      });
    },

    /* Een voor een, oudste eerst (regel 4). Stopt bij de eerste netwerkfout:
       de lijn is dan nog steeds weg en doorgaan levert alleen meer fouten. */
    leeg: function () {
      if (W._bezig || !W._token) return Promise.resolve(W.stand());
      W._bezig = true;
      var stap = function () {
        var r = W.rij();
        if (!r.length) return Promise.resolve();
        var post = r[0];
        return W._stuur(Object.assign({}, post.body, { offlineVanaf: post.opgesteld })).then(function () {
          var l = lees(SLEUTEL); l.shift(); schrijf(SLEUTEL, l);
          W._bijWijziging(W.stand());
          return stap();
        }).catch(function (e) {
          if (e && e.netwerk) return; // de lijn is nog weg; laat alles staan
          // de server heeft geantwoord en wil deze bon niet: apart zetten met de reden
          var l = lees(SLEUTEL); var weg = l.shift(); schrijf(SLEUTEL, l);
          var v = lees(VAST);
          v.push({ body: weg.body, opgesteld: weg.opgesteld, reden: (e && e.message) || 'Onbekende fout' });
          schrijf(VAST, v.slice(-MAX));
          W._bijWijziging(W.stand());
          return stap();
        });
      };
      return stap().then(function () { W._bezig = false; return W.stand(); },
        function () { W._bezig = false; return W.stand(); });
    },

    // een vastgelopen bon wegstrepen doet een mens, met de reden voor ogen
    vergeet: function (i) {
      var v = lees(VAST); v.splice(i, 1); schrijf(VAST, v); W._bijWijziging(W.stand());
    },

    /* De enige plek waar een netwerkfout van een serverantwoord wordt
       onderscheiden: een afgeketste fetch krijgt `.netwerk = true`. Zonder dat
       onderscheid komt een geweigerde bon in de wachtrij en blijft hij daar
       eeuwig rondgaan. */
    _stuur: function (body) {
      return fetch('/api/supplier/pos/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + W._token },
        body: JSON.stringify(body)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (d) {
          if (res.ok) return d;
          /* 502/503/504 komen van een tussenlaag, niet van de kassalaag: die
             tellen als "de lijn is weg" en niet als "deze bon deugt niet". */
          if (res.status >= 502 && res.status <= 504) { var g = new Error('De server is even niet bereikbaar.'); g.netwerk = true; throw g; }
          throw new Error(d.error || 'Er ging iets mis.');
        });
      }, function () {
        var e = new Error('Geen verbinding.'); e.netwerk = true; throw e;
      });
    }
  };

  window.RTGKassaWachtrij = W;
})();
