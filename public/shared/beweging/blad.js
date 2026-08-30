/* HET REGISTER EN HET BLAD: een pagina is data.

   WAAROM DIT BESTAAT. De verleiding bij dit soort schermen is om per pagina
   opnieuw te beginnen: eigen opmaak, eigen animatiecode, eigen getallen. Bij
   honderd productgebieden zijn dat honderd bewegingslagen die elk apart kapot
   kunnen. Hier is een pagina een LIJST SCENES, en een scene is een SOORT plus
   inhoud. De beweging komt uit het register en niet uit het blad.

   Wat een nieuw scherm dus kost: een configuratie. Niet een animatiebestand.

     RTGBewegingBlad.bouw(document.querySelector('main'), [
       { soort: 'hero', bovenschrift: 'RTG', titel: 'Een systeem voor alles.' },
       { soort: 'split', titel: 'Werk anders.', tekst: '...', beeld: '/x.webp' }
     ]);

   Wie een soort mist, zet hem in REGISTER hieronder -- dat is de enige plek
   waar een nieuwe bewegingsvorm hoort te ontstaan. */
(function () {
  'use strict';
  if (window.RTGBewegingBlad) return;

  function el(tag, klas, tekst) {
    var n = document.createElement(tag);
    if (klas) n.className = klas;
    if (tekst != null) n.textContent = tekst;
    return n;
  }

  /* Beeld of video, met de luie-laadhaak van de motor erop. Een scene die
     alleen tekst heeft krijgt geen leeg blok: afwezig is afwezig. */
  function visueel(scene) {
    if (!scene.beeld && !scene.video) return null;
    var houder = el('div', 'bw-beeld');
    houder.setAttribute('data-beweeg', 'beeld');
    var n;
    if (scene.video) {
      n = document.createElement('video');
      n.muted = true; n.loop = true; n.playsInline = true;
      n.setAttribute('playsinline', '');
      n.preload = 'metadata';
      n.dataset.bron = scene.video;
    } else {
      n = document.createElement('img');
      n.src = scene.beeld;
      n.loading = 'lazy';
      n.decoding = 'async';
    }
    /* Leeg alt: het beeld is sfeer, de boodschap staat in de kop. Draagt een
       scene inhoud in het beeld, dan hoort daar een `beeldtekst` bij en die
       wordt hier overgenomen -- zie TOEGANKELIJK.md. */
    if (n.tagName === 'IMG') n.alt = scene.beeldtekst || '';
    else if (scene.beeldtekst) n.setAttribute('aria-label', scene.beeldtekst);
    houder.appendChild(n);
    return houder;
  }

  function kop(scene, klas) {
    var blok = el('div', klas || 'bw-tekst');
    blok.setAttribute('data-beweeg', 'tekst');
    if (scene.bovenschrift) blok.appendChild(el('p', 'bw-bovenschrift', scene.bovenschrift));
    if (scene.titel) {
      var h = el(scene.niveau === 1 ? 'h1' : 'h2', 'bw-titel');
      h.textContent = scene.titel;
      blok.appendChild(h);
    }
    if (scene.tekst) blok.appendChild(el('p', 'bw-lopend', scene.tekst));
    /* EEN SCENE MAG EEN DEUR HEBBEN. Zonder dit is een bewegend scherm een
       folder: mooi, en je kunt er niets vanaf. De deur is een echte link met
       een echt adres -- geen knop die iets belooft dat er niet is. */
    if (scene.adres) {
      var a = el('a', 'bw-deur', scene.deur || 'Openen');
      a.href = scene.adres;
      blok.appendChild(a);
    }
    return blok;
  }

  /* ------------------------------------------------------------ register --
     Per soort: hoe hij eruitziet, en hoe hij beweegt. De getallen staan hier
     EEN keer; een scene mag ze overschrijven met `bewegingen`, maar hoeft dat
     niet -- en dat verschil is precies wat honderd losse bewegingslagen
     voorkomt. */
  var REGISTER = {
    /* Het openingsscherm: tekst staat, beeld komt naar de lezer toe. */
    hero: {
      hoogte: 250,
      bouw: function (scene) {
        var wrap = el('div', 'bw-kleef bw-hero');
        wrap.appendChild(kop({ ...scene, niveau: 1 }));
        var v = visueel(scene); if (v) wrap.appendChild(v);
        return wrap;
      },
      bewegingen: [
        { element: 'tekst', y: { van: 0, naar: -60, start: 0.25, eind: 1 },
          opacity: { van: 1, naar: 0.15, start: 0.45, eind: 0.95 }, wisselt: 'beeld' },
        { element: 'beeld', schaal: { van: 1, naar: 1.18, start: 0, eind: 1 },
          y: { van: 40, naar: -40, start: 0, eind: 1, versnelling: 'lineair' } }
      ]
    },

    /* Tekst links, beeld rechts -- het beeld schuift binnen en groeit. */
    split: {
      hoogte: 300,
      bouw: function (scene) {
        var wrap = el('div', 'bw-kleef bw-split');
        wrap.appendChild(kop(scene));
        var v = visueel(scene); if (v) wrap.appendChild(v);
        return wrap;
      },
      bewegingen: [
        /* De tekst is er bijna meteen. Een binnenkomende scene die zijn eerste
           kwart leeg is, leest als een gat in de pagina en niet als opbouw --
           dat gat stond er, en dit is de maat waarop het weg is. */
        { element: 'tekst', y: { van: 40, naar: 0, start: 0, eind: 0.22 },
          opacity: { van: 0, naar: 1, start: 0, eind: 0.12 } },
        { element: 'beeld', x: { van: 160, naar: 0, start: 0.05, eind: 0.55 },
          schaal: { van: 0.86, naar: 1.12, start: 0.15, eind: 0.9 },
          opacity: { van: 0, naar: 1, start: 0.05, eind: 0.3 } }
      ]
    },

    /* Een vlak dat vanuit een rand opengaat. Geen gordijn met ronde hoeken:
       dit huis heeft geen ronde hoeken (CLAUDE.md), dus de vorm is een strakke
       snede en dat is hier een merkregel en geen beperking. */
    onthulling: {
      hoogte: 280,
      bouw: function (scene) {
        var wrap = el('div', 'bw-kleef bw-onthulling');
        var v = visueel(scene); if (v) wrap.appendChild(v);
        wrap.appendChild(kop(scene, 'bw-tekst bw-over'));
        return wrap;
      },
      bewegingen: [
        { element: 'beeld', onthul: { van: 100, naar: 0, start: 0, eind: 0.6 },
          schaal: { van: 1.15, naar: 1, start: 0, eind: 0.8 } },
        { element: 'tekst', opacity: { van: 0, naar: 1, start: 0.45, eind: 0.7 },
          y: { van: 30, naar: 0, start: 0.45, eind: 0.75 } }
      ]
    },

    /* Het product zelf, dat naar de lezer toe draait. */
    toestel: {
      hoogte: 300,
      bouw: function (scene) {
        var wrap = el('div', 'bw-kleef bw-toestel');
        wrap.appendChild(kop(scene));
        var toestel = el('div', 'bw-toestelrand');
        toestel.setAttribute('data-beweeg', 'beeld');
        var scherm = el('div', 'bw-toestelscherm');
        var v = visueel(scene);
        if (v) { v.removeAttribute('data-beweeg'); scherm.appendChild(v); }
        toestel.appendChild(scherm);
        wrap.appendChild(toestel);
        return wrap;
      },
      bewegingen: [
        { element: 'beeld', kantel: { van: -14, naar: 0, start: 0, eind: 0.7 },
          schaal: { van: 0.86, naar: 1.02, start: 0, eind: 0.8 },
          y: { van: 60, naar: 0, start: 0, eind: 0.5 } },
        { element: 'tekst', opacity: { van: 0, naar: 1, start: 0, eind: 0.1 } }
      ]
    },

    /* Twee boodschappen op dezelfde plek: de een gaat weg, de ander komt.
       Dit is de enige soort waarin iets naar opacity 0 mag -- en hij noemt
       zijn tegenhanger, precies zoals de keuring eist. */
    tekstwissel: {
      hoogte: 250,
      bouw: function (scene) {
        var wrap = el('div', 'bw-kleef bw-wissel');
        var a = kop({ titel: scene.titel, bovenschrift: scene.bovenschrift });
        /* De deur hoort bij de TWEEDE boodschap: die blijft staan. Zat hij op
           de eerste, dan verdwijnt hij met dat blok mee -- de scene had dan een
           adres in zijn configuratie en geen link op het scherm, en dat viel
           alleen op door de gerenderde pagina te tellen. */
        var b = kop({ titel: scene.tweedeTitel, tekst: scene.tekst,
          adres: scene.adres, deur: scene.deur });
        b.setAttribute('data-beweeg', 'tekst2');
        wrap.appendChild(a); wrap.appendChild(b);
        var v = visueel(scene); if (v) wrap.appendChild(v);
        return wrap;
      },
      bewegingen: [
        { element: 'tekst', opacity: { van: 1, naar: 0, start: 0.35, eind: 0.55 },
          y: { van: 0, naar: -40, start: 0.35, eind: 0.6 }, wisselt: 'tekst2' },
        { element: 'tekst2', opacity: { van: 0, naar: 1, start: 0.5, eind: 0.7 },
          y: { van: 40, naar: 0, start: 0.5, eind: 0.75 } },
        { element: 'beeld', schaal: { van: 1, naar: 1.12, start: 0, eind: 1 } }
      ]
    },

    /* Beeldvullend, met de tekst erin. De rustigste van allemaal: hier hoort
       het beeld het werk te doen. */
    volscherm: {
      hoogte: 220,
      bouw: function (scene) {
        var wrap = el('div', 'bw-kleef bw-vol');
        var v = visueel(scene); if (v) wrap.appendChild(v);
        wrap.appendChild(kop(scene, 'bw-tekst bw-over'));
        return wrap;
      },
      bewegingen: [
        { element: 'beeld', schaal: { van: 1.12, naar: 1, start: 0, eind: 1 } },
        { element: 'tekst', opacity: { van: 0, naar: 1, start: 0, eind: 0.15 } }
      ]
    }
  };

  /* ---------------------------------------------------------------- bouw -- */
  function bouwScene(scene) {
    var soort = REGISTER[scene.soort];
    if (!soort) {
      console.warn('[beweging] onbekende scene-soort `' + scene.soort + '` -- ' +
        'bekend zijn: ' + Object.keys(REGISTER).join(', '));
      return null;
    }
    var sectie = el('section', 'bw-scene');
    sectie.dataset.soort = scene.soort;
    sectie.appendChild(soort.bouw(scene));
    var decl = {
      soort: scene.soort,
      hoogte: scene.hoogte || soort.hoogte,
      bewegingen: scene.bewegingen || soort.bewegingen,
      bij: scene.bij
    };
    return { sectie: sectie, decl: decl };
  }

  function bouw(houder, pagina) {
    if (!houder) return [];
    var gebouwd = [];
    (pagina || []).forEach(function (scene) {
      var s = bouwScene(scene);
      if (!s) return;
      houder.appendChild(s.sectie);
      gebouwd.push(window.RTGBeweging.neem(s.sectie, s.decl));
    });
    window.RTGBeweging.onthullen(houder);
    window.RTGBeweging.media(houder);
    return gebouwd;
  }

  window.RTGBewegingBlad = { bouw: bouw, REGISTER: REGISTER, soorten: Object.keys(REGISTER) };
})();
