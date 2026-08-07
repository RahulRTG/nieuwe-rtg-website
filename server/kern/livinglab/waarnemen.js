/* RTF Living Lab, deel "waarnemen": het ruwe materiaal. Observaties, datasets
   en de reflectie.

   ./bewijs.js ernaast WEEGT; dit bestand VERZAMELT. De scheiding is niet
   cosmetisch: een observatie hoort geen conclusie te zijn, en door het
   invoerveld kort te houden en er geen bewijsgraad aan te hangen, blijft dat
   verschil ook in de praktijk staan.

   Een observatie mag van een bewoner komen -- dat is het punt van een Living
   Lab. Wie hem instuurt via zijn labpas, komt binnen op de alias die uit die pas
   volgt (routes/livinglab/bewoner.js), nooit op een alias uit het lijf.

   DE REFLECTIE IS HIER GEEN VRIJ TEKSTVELD maar een lijst met een SOORT erbij:
   tegenviel, misging, onverwacht, herzien. Dat is met opzet, want dit is precies
   het onderdeel dat verdwijnt zodra het optioneel voelt -- en het is tegelijk
   het onderdeel waar dit lab het meeste aan hecht: ./cyclus.js laat een studie
   niet naar de resultaten zonder reflectie, en ./spel.js beloont `misging` en
   `herzien` zwaarder dan welke andere handeling ook.

   Afgesplitst uit ./bewijs.js toen die de 10 KB passeerde. */
'use strict';

const kader = require('./kader');

module.exports = (ctx) => {
  const { nu, rid, schoon, getal, audit, vindStudie, save } = ctx;

  /* ---------- observaties ----------
     Ruw, met wie het zag en wanneer. Een observatie mag van een bewoner komen;
     dat is het punt van een Living Lab. Wat er NIET in hoort is een conclusie --
     daar is het veld `wat` te kort voor, met opzet. */
  function observatieBij(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    if (s.dossier.ethiek.stilgelegd) return { status: 409, error: 'Dit onderzoek is stilgelegd; er wordt nu niets verzameld.' };
    b = b || {};
    const wat = schoon(b.wat, 500);
    if (wat.length < 3) return { status: 400, error: 'Wat heeft u waargenomen?' };
    if (s.dossier.observaties.length >= 50000) return { status: 400, error: 'Dit onderzoek heeft genoeg observaties; verwerk ze eerst tot een dataset.' };
    const o = { id: rid(), wat, waar: schoon(b.waar, 120), meetmoment: getal(b.meetmoment, 0, 500) || null,
      door: schoon(b.door, 40) || schoon(wie, 40) || 'onbekend',
      methode: (kader.methode(b.methode) || {}).methode || null, at: nu() };
    s.dossier.observaties.unshift(o);
    /* Let op wat hier NIET gebeurt: een observatie levert géén punten op. Alleen
       de twee methoden waarbij iemand echt iets doet -- een mens spreken, een
       prototype laten testen -- tellen mee. Zie de kop van ./spel.js. */
    if (o.methode === 'interview') ctx.spel.beloon(s, 'interview', o.door);
    if (o.methode === 'prototype' || o.methode === 'gebruikerstest') ctx.spel.beloon(s, 'prototype', o.door);
    save();
    return { ok: true, observatie: o, totaal: s.dossier.observaties.length };
  }

  function datasetBij(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const naam = schoon(b.naam, 120);
    if (naam.length < 3) return { status: 400, error: 'Hoe heet deze dataset?' };
    if (s.dossier.datasets.length >= 500) return { status: 400, error: 'Het datasetregister van dit onderzoek zit vol.' };
    const d = { id: rid(), naam, beschrijving: schoon(b.beschrijving, 500),
      rijen: getal(b.rijen, 0, 100000000), herkomst: schoon(b.herkomst, 200),
      versie: getal(b.versie, 1, 1000) || 1, door: schoon(wie, 80) || 'lab', at: nu() };
    s.dossier.datasets.unshift(d);
    audit(s.labId, 'bewijs.dataset', wie, s.id, naam);
    save();
    return { ok: true, dataset: d };
  }

  /* De reflectie: wat ging mis, wat viel tegen, wat hadden we niet verwacht.
     Een eigen lijst en geen vrij tekstveld, want dit is precies het onderdeel
     dat verdwijnt zodra het optioneel voelt. `soort` dwingt de vraag. */
  const REFLECTIE = ['tegenviel', 'misging', 'onverwacht', 'herzien'];
  function reflectieBij(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const soort = REFLECTIE.includes(b.soort) ? b.soort : null;
    if (!soort) return { status: 400, error: 'Kies: ' + REFLECTIE.join(', ') + '.' };
    const tekst = schoon(b.tekst, 600);
    if (tekst.length < 10) return { status: 400, error: 'Wat viel er op? Schrijf het op zoals het was.' };
    if (s.dossier.reflectie.length >= 200) return { status: 400, error: 'De reflectielijst zit vol.' };
    s.dossier.reflectie.unshift({ id: rid(), soort, tekst, door: schoon(wie, 80) || 'lab', at: nu() });
    if (soort === 'misging' || soort === 'onverwacht') ctx.spel.beloon(s, 'misging', wie);
    if (soort === 'herzien') ctx.spel.beloon(s, 'herzien', wie);
    audit(s.labId, 'bewijs.reflectie', wie, s.id, soort);
    save();
    return { ok: true, reflectie: s.dossier.reflectie };
  }

  return { observatieBij, datasetBij, reflectieBij, REFLECTIE };
};
