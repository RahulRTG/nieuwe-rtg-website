/* RTG: DE WACHTRIJ -- één mechanisme voor werk dat niet weg kon.

   WAAROM DIT GEDEELD IS. De kassa kreeg als eerste een offline-rij
   (apps/kassa/wachtrij.js). Toen de horeca er ook een nodig had, waren er twee
   mogelijkheden: een tweede rij schrijven, of erkennen dat "werk dat niet weg
   kon" overal hetzelfde probleem is. Twee rijen lopen uiteen op de dag dat
   iemand er een repareert, en dan verdubbelt de ene wel omzet en de andere niet
   (LAT-regel 4).

   ZES REGELS, en ze komen allemaal uit de kassa-rij omdat ze daar al met een
   mutatie zijn nagerekend:

   1. DE SLEUTEL WORDT EEN KEER GEMAAKT en gaat MEE de rij in. Wie hem bij elke
      poging opnieuw maakt, heeft geen vangnet maar een verdubbelaar. Dit is de
      enige regel waar de hele rij op staat, en de aanroeper is ervoor
      verantwoordelijk: hij zet de sleutel in het pakket VOORDAT hij verstuurt.
   2. NIET ALLES MAG WACHTEN. De aanroeper zegt met `mag(pakket)` wat er in de
      rij mag. Bij de kassa is dat contant en pin maar nooit een RTG-betaalcode
      (die moet nu gecontroleerd worden); in de horeca is dat een opgenomen
      bestelling maar geen betaling.
   3. ER GAAT PAS IETS WEG ALS DE SERVER HET BEVESTIGT. Een netwerkfout laat het
      staan; een fout van de server zelf haalt het uit de rij en zet het apart
      MET de reden. Zichtbaar vastgelopen is beter dan stil weg.
   4. EEN VOOR EEN EN OUDSTE EERST. Alles tegelijk versturen bij het herstellen
      van de lijn geeft een storm en verliest de volgorde van de avond.
   5. VOL IS VOL, EN DAT ZEGGEN WE. Bij de bovengrens weigert de rij nieuw werk
      in plaats van stilletjes het oudste te vergeten.
   6. EEN PAKKET HOORT BIJ DE ZAAK WAAR HET IS OPGESTELD. De rij staat op het
      TOESTEL en de zaak komt uit het token; wordt er tussendoor bij een andere
      zaak ingelogd, dan zou een wachtend pakket op de boeken van die andere
      zaak landen. Zulke pakketten blijven staan tot iemand weer bij de eigen
      zaak inlogt.

   EEN 502/503/504 VAN EEN TUSSENLAAG telt als storing en niet als oordeel: de
   toepassing heeft het pakket dan nooit gezien. */
(function () {
  'use strict';
  if (window.RTGWachtrij) return;

  var MAX = 200;
  var HERPROBEER_MS = 20000;

  function lees(sleutel) {
    try { var t = localStorage.getItem(sleutel); return t ? (JSON.parse(t) || []) : []; }
    catch (e) { return []; }
  }
  function schrijf(sleutel, lijst) {
    try { localStorage.setItem(sleutel, JSON.stringify(lijst)); return true; }
    catch (e) { return false; }
  }

  /* `opties`: { naam, pad, token, mag, vol }
       naam   de sleutel in localStorage (de rij heet <naam> en <naam>-vast)
       pad    het endpoint waar een pakket heen gaat
       token  het bearer-token van dit toestel
       mag    (pakket) -> mag dit wachten? standaard: alles
       vol    de tekst bij een volle rij */
  function maak(opties) {
    var o = opties || {};
    var SLEUTEL = o.naam, VAST = o.naam + '-vast';

    var W = {
      _zaak: null,
      _bezig: false,
      _bijWijziging: function () {},

      start: function (bijWijziging) {
        if (bijWijziging) W._bijWijziging = bijWijziging;
        window.addEventListener('online', W.leeg);
        setInterval(function () { if (W.rij().length) W.leeg(); }, HERPROBEER_MS);
        W._bijWijziging(W.stand());
        if (W.rij().length) W.leeg();
      },

      /* De naam van de zaak komt pas binnen als het scherm zijn instellingen
         heeft opgehaald, dus apart (regel 6). */
      zaak: function (naam) {
        W._zaak = naam || null;
        W._bijWijziging(W.stand());
        if (W.rij().length) W.leeg();
      },

      rij: function () { return lees(SLEUTEL); },
      vastgelopen: function () { return lees(VAST); },
      vreemd: function () {
        if (!W._zaak) return [];
        return W.rij().filter(function (p) { return p.zaak && p.zaak !== W._zaak; });
      },
      stand: function () {
        var v = W.vreemd();
        return { wacht: W.rij().length - v.length, vast: W.vastgelopen().length,
          vreemd: v.length, vreemdeZaak: v.length ? v[0].zaak : null };
      },

      /* Het enige pad waarlangs dit scherm verstuurt. Lukt het, dan komt het
         antwoord van de server terug. Ketst het af op het NETWERK en mag dit
         pakket wachten, dan komt er `{ gewacht: true }`. Weigert de SERVER het,
         dan gooit dit door -- dat is geen storing maar een antwoord. */
      verstuur: function (pakket) {
        return W._stuur(pakket).catch(function (e) {
          if (!e || !e.netwerk) throw e;
          if (typeof o.mag === 'function' && !o.mag(pakket)) throw e;
          var r = W.rij();
          if (r.length >= MAX) throw new Error(o.vol || ('De wachtrij zit vol (' + MAX + '). Herstel eerst de verbinding.'));
          // de sleutel zit AL in het pakket (regel 1) en wordt hier nooit gezet
          r.push({ body: pakket, zaak: W._zaak || null, opgesteld: new Date().toISOString() });
          if (!schrijf(SLEUTEL, r)) throw new Error('Dit toestel kan niets bewaren; er is niets geregistreerd.');
          W._bijWijziging(W.stand());
          return { gewacht: true };
        });
      },

      leeg: function () {
        if (W._bezig) return Promise.resolve(W.stand());
        W._bezig = true;
        var stap = function () {
          var r = W.rij();
          if (!r.length) return Promise.resolve();
          var post = r[0];
          // regel 6: nooit een pakket van de ene zaak op de boeken van de andere
          if (post.zaak && W._zaak && post.zaak !== W._zaak) return Promise.resolve();
          return W._stuur(Object.assign({}, post.body, { offlineVanaf: post.opgesteld })).then(function () {
            var l = lees(SLEUTEL); l.shift(); schrijf(SLEUTEL, l);
            W._bijWijziging(W.stand());
            return stap();
          }).catch(function (e) {
            if (e && e.netwerk) return;                 // de lijn is nog weg
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

      vergeet: function (i) {
        var v = lees(VAST); v.splice(i, 1); schrijf(VAST, v); W._bijWijziging(W.stand());
      },

      /* De enige plek waar een netwerkfout van een serverantwoord wordt
         onderscheiden: een afgeketste fetch krijgt `.netwerk = true`. Zonder dat
         onderscheid komt een geweigerd pakket in de rij en blijft het daar
         eeuwig rondgaan. */
      _stuur: function (pakket) {
        return fetch(o.pad, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + o.token },
          body: JSON.stringify(pakket)
        }).then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (d) {
            if (res.ok) return d;
            if (res.status >= 502 && res.status <= 504) {
              var g = new Error('De server is even niet bereikbaar.'); g.netwerk = true; throw g;
            }
            throw new Error(d.error || 'Er ging iets mis.');
          });
        }, function () {
          var e = new Error('Geen verbinding.'); e.netwerk = true; throw e;
        });
      }
    };
    return W;
  }

  window.RTGWachtrij = { maak: maak, MAX: MAX };
})();
