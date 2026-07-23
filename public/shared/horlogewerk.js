/* Het RTG-uurwerk: de pure, wiskundig kloppende mechaniek van het RTG-horloge.
   Geen beeld, geen canvas -- alleen de exacte tijd- en tandwiel-meetkunde, zodat
   de wijzers en het gaande werk tot op de milliseconde kloppen (foutmarge 0,0).
   Draait ook in Node en is streng getoetst (test/horlogewerk.test.js).

   Het gaande werk is een echt Zwitsers treintje op 28.800 halveslagen/uur (4 Hz):
     midden-rad  (minuutwiel):  1 omwenteling / 3600 s
       -> derde rad (tussenrad)
         -> vierde rad (secondewiel): 1 omwenteling / 60 s
           -> ankerrad (echappement)
     wijzerwerk (motion work): minuut -> uur = 12:1  (1 omwenteling / 43200 s)

   De tandverhoudingen zijn zo gekozen dat de perioden EXACT kloppen:
     (Zmidden/Pderde)*(Zderde/Pvierde) = (75/10)*(80/10) = 60  => vierde = 60x midden => 60 s
     ankerrad: (Zvierde/Panker) = (84/7) = 12  => 0,2 omw/s => 20 tanden * 0,2 = 4 osc/s = 4 Hz
     wijzerwerk: (Zminuutrad/Zrondsel)*(Zuurrad/Pminuutrad) = (36/12)*(40/10) = 12 */
(function (root) {
  'use strict';

  // de tandtellingen van het echte gaande werk (Z = wiel, P = rondsel/pinion)
  var TREIN = {
    midden: { Z: 75, periode: 3600 },     // minuutwiel: 1 omw / uur
    derdeRondsel: 10, derde: { Z: 80 },
    vierdeRondsel: 10, vierde: { Z: 84, periode: 60 },  // secondewiel: 1 omw / minuut
    ankerRondsel: 7, anker: { Z: 20 },
    balansHz: 4,                          // 4 Hz oscillatie = 28.800 halveslagen/uur
    // wijzerwerk (motion work): rondsel op het middenrad -> minuutrad -> uurrad
    wijzerwerk: { rondsel: 12, minuutrad: 36, minuutRondsel: 10, uurrad: 40 }
  };

  // de exacte wijzerhoeken (graden, met de klok mee vanaf 12 uur), tot op de ms
  function wijzerHoeken(d) {
    var ms = d.getMilliseconds();
    var s = d.getSeconds() + ms / 1000;
    var m = d.getMinutes() + s / 60;
    var u = (d.getHours() % 12) + m / 60;
    return { seconde: s * 6, minuut: m * 6, uur: u * 30 };
  }

  // de afgeleide, exact narekenbare perioden en frequentie uit de tandtellingen
  function narekenen(t) {
    t = t || TREIN;
    var middenNaarVierde = (t.midden.Z / t.derdeRondsel) * (t.derde.Z / t.vierdeRondsel);
    var vierdePeriode = t.midden.periode / middenNaarVierde;                 // s per omw van het secondewiel
    var ankerOmwPerS = (1 / vierdePeriode) * (t.vierde.Z / t.ankerRondsel);  // omw/s van het ankerrad
    var oscPerS = ankerOmwPerS * t.anker.Z;                                  // 1 tand per oscillatie
    var vph = oscPerS * 2 * 3600;                                            // halveslagen (beats) per uur
    var wijzerVerh = (t.wijzerwerk.minuutrad / t.wijzerwerk.rondsel) * (t.wijzerwerk.uurrad / t.wijzerwerk.minuutRondsel);
    var uurPeriode = t.midden.periode * wijzerVerh;                          // s per omw van het uurrad
    return {
      middenNaarVierde: middenNaarVierde,     // = 60
      vierdePeriode: vierdePeriode,           // = 60 s
      ankerOmwPerS: ankerOmwPerS,             // = 0,2
      oscPerS: oscPerS,                       // = 4 (Hz)
      vph: vph,                               // = 28800
      wijzerVerh: wijzerVerh,                 // = 12
      uurPeriode: uurPeriode                  // = 43200 s
    };
  }

  // de exacte radhoeken op tijd d (graden). De wijzers zijn geankerd aan de echte
  // tijd; de raderen volgen de exacte tandverhoudingen en draaien om en om tegen.
  function radHoeken(d, t) {
    t = t || TREIN;
    var tSec = d.getTime() / 1000;                          // absolute seconden
    var w = wijzerHoeken(d);
    var midden = (tSec / t.midden.periode) * 360;           // minuutwiel, met de klok mee
    var derde = -midden * (t.midden.Z / t.derdeRondsel);    // tegengesteld, sneller
    var vierde = w.seconde;                                 // = secondewiel, exact op de seconde
    var anker = -vierde * (t.vierde.Z / t.ankerRondsel);    // tegengesteld ankerrad
    var uur = (tSec / narekenen(t).uurPeriode) * 360;       // uurrad
    var mod = function (a) { return ((a % 360) + 360) % 360; };
    return {
      midden: mod(midden), derde: mod(derde), vierde: mod(vierde),
      anker: mod(anker), uur: mod(uur)
    };
  }

  // de onrust: zuivere sinus op de balansfrequentie; amplitude in graden
  function onrust(d, amplitude) {
    var f = TREIN.balansHz;
    var tSec = d.getTime() / 1000;
    return (amplitude || 260) * Math.sin(tSec * 2 * Math.PI * f);
  }

  var api = { TREIN: TREIN, wijzerHoeken: wijzerHoeken, narekenen: narekenen, radHoeken: radHoeken, onrust: onrust };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.RTGHorlogewerk = api;
})(typeof self !== 'undefined' ? self : this);
