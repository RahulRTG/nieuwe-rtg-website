/* ====================== RTG Accountkluis (OS) ======================
   Meerdere accounts op één toestel, met twee smaken tegelijk:

   1. SNEL WISSELEN. De kluis onthoudt per "wereld" (app-type: lid,
      leverancier, kantoor, personeel, foundation) welke accounts er op dit
      toestel bekend zijn, en welke de actieve is. Wisselen zet het token van
      het gekozen account terug op de plek waar de app het leest. Eén actief
      tegelijk, net als profielen bij Gmail of Netflix.

   2. ECHT TEGELIJK. Elke app leest zijn token normaal uit localStorage, dus
      twee vensters op hetzelfde toestel zouden hetzelfde account delen. De
      kluis lost dat op met een VENSTER-account: een venster dat onder een
      ander account draait, bewaart dat in sessionStorage (per tabblad/venster,
      niet gedeeld). huidigToken() kijkt eerst naar dat venster-account en pas
      daarna naar het actieve account. Zo draait venster A op account 1 en
      venster B tegelijk op account 2, zonder elkaar te overschrijven.

   Zuivere logica, geen UI: de OS-shell (werkos.js) en de apps gebruiken deze
   module. Werkt ook los in de node-tests, doordat de opslag injecteerbaar is.
   Insluiten vóór de app-scripts. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RTGAccounts = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // De bekende werelden. 'sleutel' is waar de app zijn sessie leest/schrijft;
  // 'vorm' is 'token' (een kale string) of 'sessie' (een JSON-object, zoals de
  // RTFoundation-app gebruikt). 'ingang' is de pagina om (een tweede venster
  // van) de app te openen.
  var WERELDEN = {
    lid:         { sleutel: 'rtg_member_token', vorm: 'token',  ingang: 'apps/app.html',              naam: 'RTG-lid' },
    leverancier: { sleutel: 'rtg_sup_token',    vorm: 'token',  ingang: 'apps/leverancier.html',      naam: 'Leverancier' },
    kantoor:     { sleutel: 'rtg_office_token', vorm: 'token',  ingang: 'apps/backoffice.html',       naam: 'Backoffice' },
    personeel:   { sleutel: 'rtg_pda_token',    vorm: 'token',  ingang: 'apps/personeel.html',        naam: 'Personeel' },
    foundation:  { sleutel: 'rtf_sessie',       vorm: 'sessie', ingang: 'apps/foundation/index.html', naam: 'RTFoundation' }
  };

  var KLUIS = 'rtg_accounts';          // localStorage: alle onthouden accounts (gedeeld)
  var VENSTER = 'rtg_venster_account'; // sessionStorage: dit venster draait onder dit account

  // Een opslag-achtig object in het geheugen, voor omgevingen zonder Web
  // Storage (de node-tests, of een venster waar storage geblokkeerd is).
  function geheugen() {
    var m = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; }
    };
  }

  function maak(opties) {
    opties = opties || {};
    var local = opties.local || (typeof localStorage !== 'undefined' ? localStorage : geheugen());
    var sessie = opties.sessie || (typeof sessionStorage !== 'undefined' ? sessionStorage : geheugen());
    var werelden = opties.werelden || WERELDEN;

    function geldig(w) { return Object.prototype.hasOwnProperty.call(werelden, String(w)); }
    function wereld(w) { return geldig(w) ? werelden[w] : null; }

    function lees() { try { return JSON.parse(local.getItem(KLUIS) || '{}') || {}; } catch (e) { return {}; } }
    function schrijf(d) { try { local.setItem(KLUIS, JSON.stringify(d)); } catch (e) {} }

    // Het vak van één wereld: { lijst: [account...], actief: id|null }.
    function vak(d, w) {
      if (!Object.prototype.hasOwnProperty.call(d, w)) d[w] = { lijst: [], actief: null };
      return d[w];
    }

    // Een account onthouden (of bijwerken als het id al bestaat). Het eerste
    // account van een wereld wordt meteen de actieve. Geeft het account terug.
    function voegToe(w, account) {
      if (!geldig(w) || !account || !account.token) return null;
      var id = String(account.id || account.token);
      var d = lees(); var v = vak(d, w);
      var bestaand = v.lijst.filter(function (a) { return a.id === id; })[0];
      var rec = bestaand || { id: id, at: Date.now() };
      rec.label = String(account.label || rec.label || id).slice(0, 60);
      rec.token = String(account.token);
      rec.extra = account.extra || rec.extra || null;
      rec.at = Date.now();
      if (!bestaand) v.lijst.push(rec);
      if (!v.actief) v.actief = id;
      schrijf(d);
      return rec;
    }

    function lijst(w) { return geldig(w) ? vak(lees(), w).lijst.slice() : []; }
    function actiefId(w) { return geldig(w) ? vak(lees(), w).actief : null; }
    function vind(w, id) { return lijst(w).filter(function (a) { return a.id === String(id); })[0] || null; }
    function actief(w) { var id = actiefId(w); return id ? vind(w, id) : null; }

    // Wisselen: maakt het gekozen account actief. Geeft het account terug, of
    // null als het niet bestaat.
    function wissel(w, id) {
      if (!geldig(w)) return null;
      var d = lees(); var v = vak(d, w);
      var rec = v.lijst.filter(function (a) { return a.id === String(id); })[0];
      if (!rec) return null;
      v.actief = rec.id;
      schrijf(d);
      return rec;
    }

    // Een account vergeten. Was het de actieve, dan schuift de actieve door
    // naar het eerstvolgende (of niets).
    function verwijder(w, id) {
      if (!geldig(w)) return false;
      var d = lees(); var v = vak(d, w);
      var voor = v.lijst.length;
      v.lijst = v.lijst.filter(function (a) { return a.id !== String(id); });
      if (v.actief === String(id)) v.actief = v.lijst.length ? v.lijst[0].id : null;
      schrijf(d);
      return v.lijst.length !== voor;
    }

    // ---- venster-account: dit venster draait bewust onder een ander account ----
    function zetVensterAccount(w, id) {
      if (!geldig(w)) return false;
      try { sessie.setItem(VENSTER, JSON.stringify({ wereld: String(w), id: String(id) })); } catch (e) { return false; }
      return true;
    }
    function vensterAccount() {
      try { var o = JSON.parse(sessie.getItem(VENSTER) || 'null'); return (o && geldig(o.wereld)) ? o : null; }
      catch (e) { return null; }
    }
    function wisVensterAccount() { try { sessie.removeItem(VENSTER); } catch (e) {} }

    // Het account dat DIT venster hoort te gebruiken: eerst het venster-account
    // (als het bij deze wereld hoort en nog bestaat), anders het actieve.
    function huidig(w) {
      var va = vensterAccount();
      if (va && va.wereld === String(w)) { var r = vind(w, va.id); if (r) return r; }
      return actief(w);
    }
    function huidigToken(w) { var r = huidig(w); return r ? r.token : null; }

    // De sessie van het huidige venster op de plek zetten waar de app leest.
    // Voor de 'token'-vorm een kale string in localStorage; voor de 'sessie'-
    // vorm het JSON-object uit account.extra. Geen huidig account = niets doen.
    function pasToe(w) {
      var info = wereld(w); var r = huidig(w);
      if (!info || !r) return false;
      try {
        if (info.vorm === 'sessie') local.setItem(info.sleutel, JSON.stringify(r.extra || {}));
        else local.setItem(info.sleutel, r.token);
      } catch (e) { return false; }
      return true;
    }

    // Een URL om (een tweede venster van) de app te openen onder een bepaald
    // account. De ontvangende pagina leest #rtgacc=wereld~id en roept
    // zetVensterAccount + pasToe aan.
    function vensterURL(w, id) {
      var info = wereld(w); if (!info) return null;
      return info.ingang + '#rtgacc=' + encodeURIComponent(String(w) + '~' + String(id));
    }

    // De ontvangende kant: leest de hash van een net geopend venster, zet het
    // venster-account en past het toe. Geeft de gekozen {wereld,id} terug.
    function leesVensterHash(hash) {
      var m = /[#&]rtgacc=([^&]+)/.exec(String(hash || ''));
      if (!m) return null;
      var deel = decodeURIComponent(m[1]).split('~');
      if (deel.length !== 2 || !geldig(deel[0])) return null;
      zetVensterAccount(deel[0], deel[1]);
      pasToe(deel[0]);
      return { wereld: deel[0], id: deel[1] };
    }

    return {
      WERELDEN: werelden,
      voegToe: voegToe, lijst: lijst, actief: actief, actiefId: actiefId, vind: vind,
      wissel: wissel, verwijder: verwijder,
      zetVensterAccount: zetVensterAccount, vensterAccount: vensterAccount, wisVensterAccount: wisVensterAccount,
      huidig: huidig, huidigToken: huidigToken, pasToe: pasToe,
      vensterURL: vensterURL, leesVensterHash: leesVensterHash
    };
  }

  return { maak: maak, WERELDEN: WERELDEN, _geheugen: geheugen };
});
