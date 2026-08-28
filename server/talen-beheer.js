/* De beheerde laag van het wereldtalenregister: standaard/migratie,
   Boardroom-schakelaars en de actieve lijst voor alle taalkiezers. */
'use strict';

module.exports = function bouwTalenBeheer({ TALEN, BASIS, STANDAARD, STANDAARD_VERSIE, bestaat }) {
  return function maakTalen({ db, save }) {
    const eigen = require('./kern/eigencollectie')({ db, domein: 'talen-beheer', bezit: { talen: 'kaart' } });
    function actieveSet() {
      let veranderd = false;
      const t = eigen.bak('talen');
      if (!Array.isArray(t.actief)) {
        t.actief = STANDAARD.slice(); t.standaardVersie = STANDAARD_VERSIE;
        veranderd = true;
      } else if (t.standaardVersie !== STANDAARD_VERSIE) {
        /* Bestaande installaties met precies de voormalige standaard (nl/en)
           krijgen de nieuwe wereldstand eenmalig. Een installatie met een
           afwijkende lijst heeft al een bewuste beheerkeuze en blijft intact. */
        const oud = t.actief;
        if (oud.length === BASIS.length && BASIS.every(c => oud.includes(c)))
          t.actief = STANDAARD.slice();
        t.standaardVersie = STANDAARD_VERSIE;
        veranderd = true;
      }
      for (const b of BASIS) if (!t.actief.includes(b)) {
        t.actief.push(b); veranderd = true;
      }
      if (veranderd && typeof save === 'function') save();
      return t.actief;
    }
    function isActief(code) { return actieveSet().includes(String(code || '').toLowerCase()); }
    function alle() {
      const set = new Set(actieveSet());
      return TALEN.map(t => ({ code: t.code, naam: t.naam, en: t.en, aan: set.has(t.code), basis: BASIS.includes(t.code) }));
    }
    function actieve() {
      const set = new Set(actieveSet());
      return TALEN.filter(t => set.has(t.code)).map(t => ({ code: t.code, naam: t.naam, en: t.en }));
    }
    function handtekening() { return actieveSet().slice().sort().join(','); }
    function zet(code, aan) {
      code = String(code || '').toLowerCase();
      if (!bestaat(code)) return { error: 'Deze taal kennen we niet.', status: 404 };
      if (!aan && BASIS.includes(code)) return { error: 'Nederlands en Engels zijn de basistalen en blijven altijd aan.', status: 409 };
      const set = actieveSet();
      const i = set.indexOf(code);
      if (aan && i === -1) set.push(code);
      if (!aan && i !== -1) set.splice(i, 1);
      save();
      return { ok: true, code, aan: set.includes(code) };
    }
    function taalVan(bodyLang) {
      const code = String(bodyLang || '').toLowerCase();
      return isActief(code) ? code : 'nl';
    }
    return { alle, actieve, isActief, zet, taalVan, handtekening };
  };
};
