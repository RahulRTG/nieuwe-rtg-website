/* DE GEDEELDE DOOS-SLEUTEL IN DE SCHADUW -- afgesplitst uit ./sleutels.js toen
   de sleutel per zaak (B12) dat bestand vulde.

   Langs welke weg kwam een geldige doos-aanroep, en welke dozen melden zich nog
   met de gedeelde sleutel (RTG_DOOS_SLEUTEL)? Een teller en geen journaal. Bij de
   GEDEELDE weg onthouden we ook de naam die de doos ZELF opgaf: een zelfopgave en
   geen identiteit. Per naam een regel; wat dertig dagen niet meer is gezien valt
   eraf, en er staan er nooit meer dan MAX_GEZIEN (wie de gedeelde sleutel heeft,
   kan namen verzinnen).

   In PRODUCTIE opent de gedeelde sleutel sinds B12 niets meer (routes/doos-wacht.js):
   daar telt hij dus alleen nog als afketser. De schakelaar hieronder (dicht/open)
   is er voor de omgevingen buiten productie. */
'use strict';

const NAAM = /^[a-z0-9][a-z0-9-]{1,39}$/;
const MAX_GEZIEN = 200, VERGEET = 30 * 86400000, VENSTER = 7 * 86400000;

module.exports = ({ db, save, nu, heeftEigen }) => {
  const tijd = nu || Date.now;
  const eigen = require('../eigencollectie')({ db, domein: 'kern/zaakdoos/sleutels-schaduw',
    bezit: { doosSleutelwegen: 'kaart', doosGedeeldGezien: 'kaart', doosGedeeldDicht: 'kaart' } });

  function telWeg(weg, opgegeven) {
    const k = eigen.bak('doosSleutelwegen');
    k[weg] = (k[weg] || 0) + 1;
    if (weg === 'gedeeld') {
      const g = eigen.bak('doosGedeeldGezien');
      const nuT = tijd();
      const n = String(opgegeven || '').trim().toLowerCase();
      const naam = NAAM.test(n) ? n : '(geen geldige naam)';
      for (const x of Object.keys(g)) if (nuT - Date.parse(g[x].laatst) > VERGEET) delete g[x];
      if (!g[naam] && Object.keys(g).length >= MAX_GEZIEN) {
        const oudste = Object.keys(g).sort((a, b) => Date.parse(g[a].laatst) - Date.parse(g[b].laatst))[0];
        delete g[oudste];
      }
      g[naam] = { laatst: new Date(nuT).toISOString(), aantal: ((g[naam] && g[naam].aantal) || 0) + 1 };
    }
    save();
  }

  function gedeeldeSleutel() {
    const d = eigen.kijk('doosGedeeldDicht') || {};
    return { dicht: d.dicht === true, door: d.door || null, at: d.at || null,
      productie: 'In productie opent de gedeelde sleutel niets, ongeacht deze stand.' };
  }

  function nogGedeeld() {
    const g = eigen.kijk('doosGedeeldGezien') || {};
    const nuT = tijd();
    return Object.keys(g).filter(n => nuT - Date.parse(g[n].laatst) <= VENSTER).sort()
      .map(n => ({ doos: n, laatst: g[n].laatst, aantal: g[n].aantal, heeftEigen: heeftEigen(n) }));
  }

  function overzicht() {
    return {
      nogGedeeld: nogGedeeld(),
      nogGedeeldUitleg: 'Dozen die de afgelopen zeven dagen met de gedeelde sleutel meldden, onder de naam die ze ZELF ' +
        'opgaven: een zelfopgave en geen identiteit. heeftEigen betekent dat er al een eigen sleutel voor die naam is ' +
        'uitgegeven maar nog niet op de doos staat. Zodra deze lijst leeg blijft, kan de gedeelde sleutel dicht.',
      wegen: Object.assign({ gedeeld: 0, eigen: 0 }, eigen.kijk('doosSleutelwegen') || {}),
      gedeeldeSleutel: gedeeldeSleutel(),
      uitleg: gedeeldeSleutel().dicht ? 'De gedeelde doos-sleutel is dicht: alleen een eigen sleutel per doos komt nog binnen.'
        : 'Buiten productie werkt de gedeelde doos-sleutel nog. Zodra nogGedeeld leeg blijft, kan de eigenaar hem dichtzetten.'
    };
  }

  /* Dichtzetten weigert zolang er de afgelopen zeven dagen nog een doos met de
     gedeelde sleutel meldde -- met de namen erbij. Weer openzetten kan altijd. */
  function gedeeldZet({ dicht, wie }) {
    if (typeof dicht !== 'boolean') return { status: 400, error: 'Zet de gedeelde sleutel dicht (true) of open (false).' };
    const nog = nogGedeeld();
    if (dicht && nog.length) return { status: 409, nogGedeeld: nog.map(x => x.doos),
      error: 'Nog niet: deze dozen meldden de afgelopen zeven dagen met de gedeelde sleutel: ' + nog.map(x => x.doos).join(', ') +
        '. Geef ze eerst een eigen sleutel en wacht tot ze die gebruiken.' };
    const d = eigen.bak('doosGedeeldDicht');
    d.dicht = dicht; d.door = wie || null; d.at = new Date(tijd()).toISOString();
    save();
    return Object.assign({ ok: true }, gedeeldeSleutel());
  }

  return { telWeg, gedeeldeSleutel, gedeeldZet, overzicht };
};
