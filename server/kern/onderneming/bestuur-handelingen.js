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

const vandaag = () => new Date().toISOString().slice(0, 10);

module.exports = ({ save, scho, mag, bak, zittend, bestuur, ROLLEN, duidPersoon }) => {

  async function bestuurderZet(o, body) {
    const m = mag(o);
    if (!m.bestuur) return { status: 409, error: 'Deze rechtsvorm heeft geen bestuur.' };
    const rol = String((body || {}).rol || 'bestuurder');
    if (!ROLLEN[rol]) return { status: 400, error: 'Deze rol kennen wij niet.', rollen: Object.keys(ROLLEN) };
    /* Naar WIE wijst dit? Zie ./bestuur-persoon.js: een lid wordt opgezocht en
       krijgt zijn sleutel en niveau mee, iemand van buiten RTG moet met zoveel
       woorden als extern worden opgegeven, en een codenaam die geen van beide
       is wordt geweigerd -- dat is meestal een typefout. */
    const p = await duidPersoon(body, 'bestuurder');
    if (p.error) return p;
    const b = bak(o);
    if (zittend(b).some(x => x.codenaam === p.codenaam)) {
      return { status: 409, error: 'Deze persoon staat al in het bestuur.' };
    }
    b.bestuurders.push({ id: 'B' + (b.bestuurders.length + 1) + '-' + Date.now().toString(36),
      codenaam: p.codenaam, rol, bron: p.soort, key: p.key, niveauBij: p.niveauBij,
      sinds: vandaag(), tot: null });
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

  /* EEN BELANG WORDT NIET OVERSCHREVEN MAAR AFGESLOTEN, net als een bestuurder
     niet wordt gewist maar aftreedt. Dat stond hierboven al met zoveel woorden
     voor het bestuur -- "juist die geschiedenis is waar een
     aansprakelijkheidsvraag over gaat" -- en gold voor de aandelen niet: een
     nieuw percentage overschreef het oude en een verkocht belang werd uit de
     lijst gesneden. Terwijl de UBO juist UIT de aandelen volgt, en de vraag bij
     een geschil altijd is wie er WANNEER boven de drempel zat. Nu draagt een
     belang `sinds` en `tot`, en de open regels zijn de huidige verdeling. */
  const open = b => b.aandelen.filter(a => !a.tot);

  async function aandeelZet(o, body) {
    const m = mag(o);
    if (!m.aandelen) {
      const rv = RV.rechtsvormVan(o.rechtsvorm);
      return { status: 409,
        error: 'Een ' + (rv ? rv.label.toLowerCase() : 'onderneming zonder rechtsvorm') + ' kent geen aandelen.',
        uitleg: 'Dat is geen instelling maar een eigenschap van de rechtsvorm; zie kern/onderneming/rechtsvorm.js.' };
    }
    const pct = rond1(Number((body || {}).percentage));
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      return { status: 400, error: 'Een belang ligt boven nul en op ten hoogste 100 procent.' };
    }
    const p = await duidPersoon(body, 'aandeelhouder');
    if (p.error) return p;
    const b = bak(o);
    const bestaand = open(b).find(a => a.codenaam === p.codenaam);
    const anderen = open(b).filter(a => a.codenaam !== p.codenaam)
      .reduce((n, a) => n + a.percentage, 0);
    if (rond1(anderen + pct) > 100) {
      return { status: 409, error: 'Samen komt dat boven de 100 procent uit.',
        alUitgegeven: rond1(anderen), ruimte: rond1(100 - anderen) };
    }
    const soort = scho((body || {}).soort, 40) || (bestaand && bestaand.soort) || 'gewoon';
    if (bestaand) {
      if (bestaand.percentage === pct && bestaand.soort === soort) {
        return Object.assign({ ok: true }, bestuur(o));   // niets veranderd, geen lege regel in de historie
      }
      bestaand.tot = vandaag();
    }
    b.aandelen.push({ id: 'A' + (b.aandelen.length + 1) + '-' + Date.now().toString(36),
      codenaam: p.codenaam, percentage: pct, soort, bron: p.soort, key: p.key, niveauBij: p.niveauBij,
      sinds: vandaag(), tot: null });
    save();
    return Object.assign({ ok: true }, bestuur(o));
  }

  function aandeelWeg(o, id) {
    const b = bak(o);
    const a = open(b).find(x => x.id === String(id || ''));
    if (!a) return { status: 404, error: 'Dit belang staat niet in uw register.' };
    a.tot = vandaag();
    save();
    return Object.assign({ ok: true }, bestuur(o));
  }


  return { bestuurderZet, bestuurderAf, aandeelZet, aandeelWeg };
};
