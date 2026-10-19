/* RTG One: EEN HERHAALSLEUTEL DIE EEN CRASH OVERLEEFT.

   Een scherm stuurt per formulier een `idem`; komt hetzelfde verzoek terug (een
   tweede tik, of opnieuw na een afgebroken verbinding of een herstart), dan
   krijgt de medewerker het object dat al bestond, met `herhaald`, en geen
   tweede. De sleutel staat in dezelfde opslag als het object (db.data.rtgOne)
   en wordt in dezelfde save weggeschreven: een geheugenlaag ervoor vergat hem
   bij een stroomstoring, en dan stond een belofte er na de herhaling twee keer
   (gevonden door scripts/lib/voltooi/rtgone.js, 19 oktober 2026). De sleutel
   hoort bij de medewerker: dezelfde sleutel van een ander is een eigen verzoek.
   En dezelfde sleutel bij een ANDER verzoek (andere inhoud) is geen herhaling
   maar een fout: 409, zodat een sleutel nooit stil een ander object teruggeeft. */
'use strict';

const IDEM_MAX = 2000;

/* Wat het verzoek IS: het lijf zonder de sleutel, met vaste veldvolgorde. */
function vingerafdruk(body) {
  const b = Object.assign({}, body || {}); delete b.idem;
  return JSON.stringify(Object.keys(b).sort().map(k => [k, b[k]]));
}

/* `idem` geeft de route mee (routes/rtgone.js leest hem uit het lijf): de
   route beslist welke sleutel geldt, en staat daarom in
   middleware/idempotentie-eigen.js. */
module.exports = ({ S, save, vind, nu }) => function eenmalig(soort, lijst, body, wie, maak, idem) {
  const sleutel = String(idem || '').slice(0, 80);
  if (!sleutel) return maak();
  const s = S();
  if (!s.idem || typeof s.idem !== 'object' || Array.isArray(s.idem)) s.idem = {};
  const k = soort + '|' + String(wie || 'kantoor').slice(0, 100) + '|' + sleutel;
  const vinger = vingerafdruk(body);
  const eerder = s.idem[k] && vind(s[lijst], s.idem[k].id);
  if (eerder && s.idem[k].vinger && s.idem[k].vinger !== vinger) {
    return { status: 409, error: 'Deze herhaalsleutel hoort bij een ander verzoek; er is niets vastgelegd.' };
  }
  if (eerder) return { ok: true, [soort]: eerder, herhaald: true };
  const r = maak();
  if (r && r.ok && r[soort]) {
    s.idem[k] = { id: r[soort].id, at: nu(), vinger };
    const sleutels = Object.keys(s.idem);
    if (sleutels.length > IDEM_MAX) for (const oud of sleutels.slice(0, sleutels.length - IDEM_MAX)) delete s.idem[oud];
    save();
  }
  return r;
};
