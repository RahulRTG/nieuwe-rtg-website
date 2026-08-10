/* Onderneming-deelmodule "bestuur-handelingen": wat het bestuursregister
   VERANDERT.

   Los van ./bestuur.js omdat dat bestand over de 10 kB van het modulebeleid
   ging, en langs dezelfde naad als ./beeld.js en ./levensloop.js: daar wordt
   gelezen, hier wordt geschreven. Elke handeling hieronder eindigt met het
   verse beeld, zodat een scherm nooit zelf hoeft na te vragen wat er nu staat.

   De grendels staan NIET hier maar in ./bestuur.js, in `mag()`. Dat is met
   opzet: een tweede plek die bepaalt wat een rechtsvorm mag, is een tweede
   waarheid -- en die wint een keer van de eerste. */
'use strict';

const RV = require('./rechtsvorm');

const rond1 = (n) => Math.round(Number(n) * 10) / 10;

module.exports = ({ save, scho, mag, bak, zittend, bestuur, ROLLEN }) => {

  function bestuurderZet(o, body) {
    const m = mag(o);
    if (!m.bestuur) return { status: 409, error: 'Deze rechtsvorm heeft geen bestuur.' };
    const codenaam = scho((body || {}).codenaam, 60);
    if (codenaam.length < 2) return { status: 400, error: 'Geef de codenaam van de bestuurder op.' };
    const rol = String((body || {}).rol || 'bestuurder');
    if (!ROLLEN[rol]) return { status: 400, error: 'Deze rol kennen wij niet.', rollen: Object.keys(ROLLEN) };
    const b = bak(o);
    if (zittend(b).some(x => x.codenaam === codenaam)) {
      return { status: 409, error: 'Deze persoon staat al in het bestuur.' };
    }
    b.bestuurders.push({ id: 'B' + (b.bestuurders.length + 1) + '-' + Date.now().toString(36),
      codenaam, rol, sinds: new Date().toISOString().slice(0, 10), tot: null });
    save();
    return Object.assign({ ok: true }, bestuur(o));
  }

  /* Aftreden en niet wissen: wie er ooit bestuurder was, was dat -- en juist
     die geschiedenis is waar een aansprakelijkheidsvraag over gaat. */
  function bestuurderAf(o, id) {
    const b = bak(o);
    const x = b.bestuurders.find(y => y.id === String(id || '') && !y.tot);
    if (!x) return { status: 404, error: 'Deze bestuurder staat niet in uw register.' };
    x.tot = new Date().toISOString().slice(0, 10);
    save();
    return Object.assign({ ok: true }, bestuur(o));
  }

  function aandeelZet(o, body) {
    const m = mag(o);
    if (!m.aandelen) {
      const rv = RV.rechtsvormVan(o.rechtsvorm);
      return { status: 409,
        error: 'Een ' + (rv ? rv.label.toLowerCase() : 'onderneming zonder rechtsvorm') + ' kent geen aandelen.',
        uitleg: 'Dat is geen instelling maar een eigenschap van de rechtsvorm; zie kern/onderneming/rechtsvorm.js.' };
    }
    const codenaam = scho((body || {}).codenaam, 60);
    if (codenaam.length < 2) return { status: 400, error: 'Geef de codenaam van de aandeelhouder op.' };
    const p = rond1(Number((body || {}).percentage));
    if (!Number.isFinite(p) || p <= 0 || p > 100) {
      return { status: 400, error: 'Een belang ligt boven nul en op ten hoogste 100 procent.' };
    }
    const b = bak(o);
    const bestaand = b.aandelen.find(a => a.codenaam === codenaam);
    const anderen = b.aandelen.filter(a => a.codenaam !== codenaam)
      .reduce((n, a) => n + a.percentage, 0);
    if (rond1(anderen + p) > 100) {
      return { status: 409, error: 'Samen komt dat boven de 100 procent uit.',
        alUitgegeven: rond1(anderen), ruimte: rond1(100 - anderen) };
    }
    if (bestaand) { bestaand.percentage = p; bestaand.soort = scho((body || {}).soort, 40) || bestaand.soort; }
    else {
      b.aandelen.push({ id: 'A' + (b.aandelen.length + 1) + '-' + Date.now().toString(36),
        codenaam, percentage: p, soort: scho((body || {}).soort, 40) || 'gewoon' });
    }
    save();
    return Object.assign({ ok: true }, bestuur(o));
  }

  function aandeelWeg(o, id) {
    const b = bak(o);
    const i = b.aandelen.findIndex(a => a.id === String(id || ''));
    if (i < 0) return { status: 404, error: 'Dit belang staat niet in uw register.' };
    b.aandelen.splice(i, 1);
    save();
    return Object.assign({ ok: true }, bestuur(o));
  }


  return { bestuurderZet, bestuurderAf, aandeelZet, aandeelWeg };
};
