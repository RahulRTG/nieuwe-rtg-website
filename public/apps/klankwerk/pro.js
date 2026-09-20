/* De professionele laag van RTG Music Studio: mastering, presets, een echte
   bewerkingsgeschiedenis en studiosneltoetsen. Alles blijft gewone trackdata;
   er is geen apart betaald of onbewerkbaar bestandsformaat. */
(function () {
  'use strict';
  var B = window.RTGKlankwerk;
  if (!B) return;
  var $ = function (s) { return document.querySelector(s); };
  var kopie = function (v) { return JSON.parse(JSON.stringify(v)); };
  var geschiedenis = [], positie = -1, wacht = null, actiefId = null, herstelt = false;
  var undo = $('#undoKnop'), redo = $('#redoKnop');

  function gelijk(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function knoppen() {
    if (undo) undo.disabled = !(wacht || positie > 0);
    if (redo) redo.disabled = positie >= geschiedenis.length - 1;
  }
  function legVast() {
    clearTimeout(wacht); wacht = null;
    var t = B.track(); if (!t) return;
    var nu = kopie(t);
    if (positie >= 0 && gelijk(geschiedenis[positie], nu)) return knoppen();
    geschiedenis = geschiedenis.slice(0, positie + 1);
    geschiedenis.push(nu);
    if (geschiedenis.length > 80) geschiedenis.shift();
    positie = geschiedenis.length - 1; knoppen();
  }
  function planMoment() {
    if (herstelt || !B.track()) return;
    clearTimeout(wacht); wacht = setTimeout(legVast, 180); knoppen();
  }
  function ga(delta) {
    legVast();
    var doel = positie + delta;
    if (doel < 0 || doel >= geschiedenis.length) return;
    positie = doel; herstelt = true; B.stop(); B.herstel(geschiedenis[positie]); herstelt = false;
    knoppen(); B.zeg(delta < 0 ? 'Ongedaan gemaakt.' : 'Opnieuw toegepast.');
  }
  if (undo) undo.addEventListener('click', function () { ga(-1); });
  if (redo) redo.addEventListener('click', function () { ga(1); });
  B.bijWijziging(planMoment);

  var velden = [
    { id: 'tSwing', veld: 'swing', uit: 'swingWaarde', toon: function (v) { return Math.round(v * 100) + '%'; } },
    { id: 'masterGain', veld: 'masterGain', uit: 'masterGainWaarde', toon: function (v) { return Math.round(v * 100) + '%'; } },
    { id: 'masterLaag', veld: 'masterLaag', uit: 'masterLaagWaarde', toon: db },
    { id: 'masterMidden', veld: 'masterMidden', uit: 'masterMiddenWaarde', toon: db },
    { id: 'masterHoog', veld: 'masterHoog', uit: 'masterHoogWaarde', toon: db },
    { id: 'masterDrive', veld: 'masterDrive', uit: 'masterDriveWaarde', toon: function (v) { return Math.round(v * 100) + '%'; } }
  ];
  function db(v) { return (Number(v) > 0 ? '+' : '') + Number(v) + ' dB'; }
  function waarde(t, v) {
    var terug = { swing: 0, masterGain: .8, masterLaag: 0, masterMidden: 0, masterHoog: 0, masterDrive: .35 };
    return t[v.veld] != null ? Number(t[v.veld]) : terug[v.veld];
  }
  function toonMaster(t) {
    velden.forEach(function (v) {
      var el = $('#' + v.id), uit = $('#' + v.uit); if (!el) return;
      el.value = waarde(t, v); if (uit) uit.value = v.toon(el.value);
    });
  }
  velden.forEach(function (v) {
    var el = $('#' + v.id), uit = $('#' + v.uit); if (!el) return;
    el.addEventListener('input', function () {
      var t = B.track(); if (!t) return;
      t[v.veld] = Number(el.value); if (uit) uit.value = v.toon(el.value);
      if ($('#masterPreset')) $('#masterPreset').value = 'eigen';
      B.gewijzigd();
    });
  });

  var presets = {
    warm:  { masterGain:.82, masterLaag:3, masterMidden:1, masterHoog:-1, masterDrive:.38 },
    helder:{ masterGain:.78, masterLaag:-1, masterMidden:1, masterHoog:4, masterDrive:.25 },
    club:  { masterGain:.88, masterLaag:5, masterMidden:-2, masterHoog:2, masterDrive:.68 },
    film:  { masterGain:.8, masterLaag:2, masterMidden:-1, masterHoog:3, masterDrive:.48 }
  };
  if ($('#masterPreset')) $('#masterPreset').addEventListener('change', function () {
    var p = presets[this.value], t = B.track(); if (!p || !t) return;
    Object.keys(p).forEach(function (naam) { t[naam] = p[naam]; });
    toonMaster(t); B.gewijzigd(); B.zeg('Mastering-startpunt toegepast. Alle regelaars blijven vrij bewerkbaar.');
  });

  B.bijOpenen(function (t) {
    toonMaster(t);
    if (t.id !== actiefId) {
      actiefId = t.id; geschiedenis = [kopie(t)]; positie = 0; clearTimeout(wacht); wacht = null;
    } else if (positie >= 0 && !herstelt) {
      geschiedenis[positie] = kopie(t);
    }
    knoppen();
  });

  var speel = $('#speel'), stop = $('#stopKnop');
  if (speel) speel.addEventListener('click', function () { speel.classList.add('is-playing'); });
  if (stop) stop.addEventListener('click', function () { if (speel) speel.classList.remove('is-playing'); });
  document.addEventListener('keydown', function (e) {
    var invoer = /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '');
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault(); ga(e.shiftKey ? 1 : -1); return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault(); B.bewaar().then(function () { B.zeg('Bewaard.'); }); return;
    }
    if (!invoer && e.code === 'Space') {
      e.preventDefault();
      if (window.RTGStudioMotor && RTGStudioMotor.speelt()) stop.click(); else speel.click();
    }
  });
})();
