/* RTG Route Intelligence -- de uitlegbare laag boven de eigen A*-motor.

   Deze laag voorspelt niets met een taalmodel. Verkeer, voertuig, rust en
   energie worden deterministisch in etappekosten vertaald; daardoor is iedere
   gekozen route opnieuw te rekenen en uit te leggen. Externe kaartleveranciers
   kunnen later dezelfde genormaliseerde signalen leveren zonder dat het
   besluit of de reizigerscontext naar hen verhuist. */
'use strict';

const PROFIELEN = {
  slim:   { naam: 'RTG Slim', verkeer: 1.25, incident: 1.15, hoofd: 0.92, afstand: 1, bocht: 0.25 },
  snel:   { naam: 'Snelste', verkeer: 1.05, incident: 1, hoofd: 0.82, afstand: 1, bocht: 0 },
  rustig: { naam: 'Comfort', verkeer: 1.45, incident: 1.55, hoofd: 1.18, afstand: 1.03, bocht: 1.5 },
  zeker:  { naam: 'Zeker', verkeer: 1.65, incident: 1.85, hoofd: 0.96, afstand: 1.02, bocht: 0.5 },
  eco:    { naam: 'Electric', verkeer: 1.35, incident: 1.25, hoofd: 0.98, afstand: 0.94, bocht: 0.35 }
};
const SNELHEID = { auto: 13.9, ev: 13.9, fiets: 4.4, lopen: 1.4 };
const ERNST_FACTOR = { 1: 1.08, 2: 1.18, 3: 1.38, 4: 1.8, 5: 2.5 };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const profielVan = naam => PROFIELEN[naam] ? naam : 'slim';
const rand = n => Math.round(n * 10) / 10;
const randMin = sec => Math.max(1, Math.round(sec / 60));

function dichtbijEtappe(meters, melding, a, b) {
  const straal = clamp(Number(melding.straalM) || 450, 80, 3000);
  const midden = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
  return meters(melding, midden) <= straal || meters(melding, a) <= straal || meters(melding, b) <= straal;
}

function signaalFactor(melding, profiel) {
  const soort = String(melding.soort || 'file');
  if (soort === 'afsluiting') return Infinity;
  const ernst = clamp(Math.round(Number(melding.ernst) || (soort === 'file' ? 3 : 2)), 1, 5);
  let basis = ERNST_FACTOR[ernst];
  if (soort === 'ongeval' || soort === 'object') basis += 0.3;
  if (soort === 'wegwerk') basis += 0.18;
  if (soort === 'weer') basis += 0.24;
  return 1 + (basis - 1) * profiel.incident;
}

function kostenfunctie({ profiel, modus, meldingen, meters, eerderPad }) {
  const p = PROFIELEN[profielVan(profiel)];
  const snelheid = SNELHEID[modus] || SNELHEID.auto;
  const gebruikt = eerderPad || new Set();
  return (e, van, naar) => {
    let factor = e.hoofd ? p.hoofd : 1;
    for (const m of meldingen) {
      if (!dichtbijEtappe(meters, m, van, naar)) continue;
      const f = signaalFactor(m, p);
      if (!Number.isFinite(f)) return Infinity;
      factor *= 1 + (f - 1) * p.verkeer;
    }
    /* Een alternatief moet werkelijk een alternatief zijn. Een kleine overlap-
       prijs laat hem dezelfde goede corridors gebruiken waar dat logisch is,
       maar voorkomt twee identieke kaarten met een ander etiket. */
    if (gebruikt.has(e.id)) factor *= 1.22;
    const bochtRust = Number.isFinite(van.r) && Number.isFinite(naar.r)
      && Math.abs(van.r - naar.r) && Math.abs(van.c - naar.c) ? p.bocht : 0;
    /* NWB-kanten dragen een eigen basistijd op grond van wegcategorie en FRC.
       Voor fiets en lopen blijft de voertuigsnelheid leidend; een snelwegtempo
       mag een wandelroute uiteraard niet versnellen. */
    const basis = ['auto', 'ev'].includes(modus) && Number.isFinite(e.kost) ? e.kost : e.m / snelheid;
    return basis * factor * p.afstand + bochtRust;
  };
}

function padIds(pad, grid) {
  const uit = new Set();
  for (let i = 1; i < pad.length; i++) {
    if (pad[i]._edgeId) { uit.add(String(pad[i]._edgeId)); continue; }
    const a = pad[i - 1].r * grid + pad[i - 1].c;
    const b = pad[i].r * grid + pad[i].c;
    uit.add(Math.min(a, b) + ':' + Math.max(a, b));
  }
  return uit;
}

function signalenLangs(poly, meldingen, meters) {
  return meldingen.filter(m => {
    for (let i = 1; i < poly.length; i++) if (dichtbijEtappe(meters, m, poly[i - 1], poly[i])) return true;
    return false;
  });
}

function meetRoute({ poly, stappen, modus, profiel, meldingen, meters, vertrekAt, accuProcent, bereikKm }) {
  const p = PROFIELEN[profielVan(profiel)];
  const snelheid = SNELHEID[modus] || SNELHEID.auto;
  let afstandM = 0, basisSec = 0, actueelSec = 0;
  const langs = signalenLangs(poly, meldingen, meters);
  for (let i = 1; i < poly.length; i++) {
    const m = meters(poly[i - 1], poly[i]);
    const stapSec = Number(poly[i]._seconden) > 0 ? Number(poly[i]._seconden) : m / snelheid;
    afstandM += m; basisSec += stapSec;
    let factor = 1;
    for (const s of langs) if (dichtbijEtappe(meters, s, poly[i - 1], poly[i])) {
      const f = signaalFactor(s, p);
      factor *= Number.isFinite(f) ? 1 + (f - 1) * p.verkeer : 4;
    }
    actueelSec += stapSec * factor;
  }
  const vertragingSec = Math.max(0, actueelSec - basisSec);
  const live = langs.filter(x => x.bron === 'partner' || x.bron === 'netwerk').length;
  const vertrouwen = clamp(Math.round(96 - langs.length * 3 + Math.min(4, live * 2)), 72, 99);
  const bochten = Math.max(0, (stappen || []).length - 2);
  const comfort = clamp(Math.round(98 - bochten * 2.2 - langs.length * 2.5 + (profiel === 'rustig' ? 5 : 0)), 60, 99);
  const km = afstandM / 1000;
  const kwh = modus === 'ev' ? rand(km * 0.19 + vertragingSec / 3600 * 0.35) : null;
  const vertrek = vertrekAt && Number.isFinite(new Date(vertrekAt).getTime()) ? new Date(vertrekAt) : new Date();
  const etaMin = randMin(actueelSec);
  const aankomst = new Date(vertrek.getTime() + etaMin * 60000).toISOString();
  const margeKm = Number.isFinite(Number(bereikKm)) ? rand(Number(bereikKm) - km) : null;
  const ladenNodig = modus === 'ev' && margeKm != null && margeKm < Math.max(12, km * 0.2);
  const verkeersbeeld = langs.some(x => ['afsluiting', 'ongeval'].includes(x.soort)) ? 'verstoord'
    : vertragingSec >= 300 ? 'druk' : vertragingSec >= 90 ? 'oplopend' : 'rustig';
  const reden = profiel === 'rustig' ? 'Minder verkeersdruk en minder onrustige passages.'
    : profiel === 'eco' ? 'Laagste geschatte energieverbruik met voldoende marge.'
    : profiel === 'zeker' ? 'Grootste aankomstzekerheid rond actuele signalen.'
    : langs.length ? 'Snelste betrouwbare route op basis van live signalen.'
    : 'Snelste route op het eigen wegennet; geen actieve hinder gevonden.';
  return {
    profiel: profielVan(profiel), naam: p.naam, afstandM: Math.round(afstandM), etaMin,
    basisMin: randMin(basisSec), vertragingMin: Math.round(vertragingSec / 60), aankomstAt: aankomst,
    vertrouwen, comfort, verkeersbeeld, signalen: langs.length,
    energie: kwh == null ? null : { kwh, accuProcent: Number.isFinite(Number(accuProcent)) ? clamp(Number(accuProcent), 0, 100) : null, margeKm, ladenNodig },
    advies: { titel: langs.length ? 'Route intelligence actief' : 'Vrije doorgang', reden }
  };
}

function routeSleutel(crypto, poly) {
  const bron = poly.map(p => p.lat.toFixed(5) + ',' + p.lng.toFixed(5)).join('|');
  return 'rtg-' + crypto.createHash('sha256').update(bron).digest('hex').slice(0, 12);
}

module.exports = { PROFIELEN, profielVan, kostenfunctie, padIds, meetRoute, routeSleutel };
