/* Vonk: de plek van een profiel is een VAK van 5 km, nooit een punt
   (NAVIGATIE.md N21).

   WAAROM. Een datingprofiel bewaarde de precieze coordinaat die de telefoon
   doorgaf, zonder termijn en buiten de vergeetroute. Voor wat Vonk ermee doet
   -- "valt deze persoon binnen mijn straal" en "welke tafel ligt ongeveer in
   het midden" -- is dat punt nooit nodig geweest: de kleinste straal is 5 km.
   Een punt in een datingprofiel is bovendien precies het gegeven waarmee een
   vreemde iemands huis kan vinden. Dus wordt het punt bij binnenkomst op een
   raster gelegd en blijft alleen de naam van het vak over; het punt zelf komt
   nooit in de opslag.

   HET RASTER. Rijen van 5 km noord-zuid; per rij kolommen van 5 km oost-west,
   gerekend op de breedte van het midden van die rij (anders worden de vakken
   richting de pool smaller dan 5 km en wordt het vak weer bijna een punt). Het
   vak heet `v5:<rij>:<kolom>`. Afstand wordt gerekend tussen de MIDDENS van
   twee vakken: dat is een benadering met een fout van hooguit een paar km, en
   dat is de bedoeling -- nauwkeuriger dan een vak zegt een profiel niets.

   Er komt geen cijfer op een mens uit (ONTMOETEN.md par. 4.4): dit bestand
   rekent een plek en een afstand, niets anders. */
'use strict';

const KM = 5;
const GRAAD_KM = 111.32;                  // km per breedtegraad
const DLAT = KM / GRAAD_KM;

function dlngOp(midLat) {
  return DLAT / Math.max(Math.cos(midLat * Math.PI / 180), 0.01);
}

/* Punt -> vaknaam, of null als het punt geen punt op aarde is. */
function vakVanPunt(lat, lng) {
  lat = Number(lat); lng = Number(lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const rij = Math.floor(Math.min(lat, 89.99) / DLAT);
  const kol = Math.floor(lng / dlngOp((rij + 0.5) * DLAT));
  return 'v' + KM + ':' + rij + ':' + kol;
}

/* Vaknaam -> het midden van het vak ({lat,lng}), of null. Het midden wordt
   ALLEEN gerekend om een afstand te kunnen meten en wordt nergens bewaard. */
function middenVan(vak) {
  const m = /^v5:(-?\d+):(-?\d+)$/.exec(String(vak || ''));
  if (!m) return null;
  const midLat = (Number(m[1]) + 0.5) * DLAT;
  return { lat: midLat, lng: (Number(m[2]) + 0.5) * dlngOp(midLat) };
}

/* De plek van een profiel om mee te rekenen. Een profiel van VOOR N21 kan nog
   een punt dragen; dat wordt hier niet gelezen maar door vakMigreer weggehaald. */
const plekVan = p => (p && p.vak ? middenVan(p.vak) : null);

/* Een profiel van voor N21: het punt wordt een vak en het punt verdwijnt. */
function vakMigreer(p) {
  if (!p || (!('lat' in p) && !('lng' in p))) return false;
  if (!p.vak) p.vak = vakVanPunt(p.lat, p.lng);
  delete p.lat; delete p.lng;
  return true;
}

/* Alle profielen in een keer. `migreerEenmaal` doet dat een keer per
   Vonk-opslag (per proces, en opnieuw als de opslag wordt vervangen). */
function migreerAlle(profielen) {
  let n = 0;
  for (const p of Object.values(profielen || {})) if (vakMigreer(p)) n++;
  return n;
}
const gemigreerd = new WeakSet();
function migreerEenmaal(vonk, save) {
  if (!vonk || gemigreerd.has(vonk)) return;
  gemigreerd.add(vonk);
  if (migreerAlle(vonk.profielen)) save();
}

/* Twee profielen als paar om een plek in het midden te zoeken: de middens van
   hun vakken, met hun datewens erbij, en het midden daartussen -- of null. */
function paar(pa, pb) {
  const a = plekVan(pa), b = plekVan(pb);
  if (!a || !b) return null;
  return { a: { ...a, datewens: pa.datewens }, b: { ...b, datewens: pb.datewens },
    mid: { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 } };
}

/* Bij het opslaan van een profiel: alleen het vak blijft, nooit het punt, en
   wie Vonk uitzet laat geen plek achter -- aanzetten vraagt een nieuwe. */
function vakBijOpslaan(p, lat, lng) {
  const vak = vakVanPunt(lat, lng);
  if (vak) p.vak = vak;
  vakMigreer(p);
  if (!p.actief) delete p.vak;
}

module.exports = { vakVanPunt, middenVan, plekVan, vakMigreer, migreerAlle, migreerEenmaal, vakBijOpslaan, paar, KM };
