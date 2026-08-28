#!/usr/bin/env node
/* Bouwt de lichte wereldatlas die altijd met TravelOS mee kan. Natural Earth
   is publiek domein; gedetailleerde straten en routes komen uit de lokale
   OSM-regiopakketten en niet uit dit overzichtsbestand. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const LANDEN = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';
const STEDEN = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_populated_places_simple.geojson';
const DOEL = path.join(__dirname, '..', 'public', 'data', 'wereld-atlas.json');
const rond = n => Math.round(Number(n) * 10000) / 10000;
function ringen(geometry) {
  if (!geometry) return [];
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  return polys.flatMap(poly => poly.slice(0, 1).map(ring => ring.map(p => [rond(p[0]), rond(p[1])])));
}
function midden(rings, props) {
  if (Number.isFinite(Number(props.LABEL_X)) && Number.isFinite(Number(props.LABEL_Y))) return { lng: +props.LABEL_X, lat: +props.LABEL_Y };
  let x0 = 180, x1 = -180, y0 = 90, y1 = -90;
  for (const ring of rings) for (const p of ring) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  return { lng: rond((x0 + x1) / 2), lat: rond((y0 + y1) / 2) };
}
async function json(url) { const r = await fetch(url); if (!r.ok) throw new Error('Download mislukt: HTTP ' + r.status); return r.json(); }

async function bouw() {
  const [landenBron, stedenBron] = await Promise.all([json(LANDEN), json(STEDEN)]);
  const landen = landenBron.features.map(f => { const lijnen = ringen(f.geometry), m = midden(lijnen, f.properties || {});
    return { naam: f.properties.ADMIN || f.properties.NAME, iso: f.properties.ISO_A2 || f.properties.ADM0_A3,
      continent: f.properties.CONTINENT || '', lat: rond(m.lat), lng: rond(m.lng), lijnen }; })
    .filter(x => x.naam && x.lijnen.length);
  const steden = stedenBron.features.map(f => { const p = f.properties || {}, c = f.geometry && f.geometry.coordinates || [];
    return { naam: p.NAMEPAR || p.NAME || p.namepar || p.name, land: p.ADM0NAME || p.SOV0NAME || p.adm0name || p.sov0name || '',
      iso: p.ISO_A2 || p.iso_a2 || '', lat: rond(c[1]), lng: rond(c[0]),
      rang: Math.max(1, 15 - Number(p.SCALERANK ?? p.scalerank ?? 9)) }; })
    .filter(x => x.naam && Number.isFinite(x.lat) && Number.isFinite(x.lng));
  const uit = { versie: 1, bron: 'Natural Earth 1:110m · RTG World Atlas', licentie: 'Public domain',
    bronUrls: [LANDEN, STEDEN], gebouwdAt: new Date().toISOString(), landen, steden };
  fs.mkdirSync(path.dirname(DOEL), { recursive: true }); fs.writeFileSync(DOEL, JSON.stringify(uit));
  console.log('[WORLD] ' + landen.length + ' landen en ' + steden.length + ' wereldsteden geschreven naar ' + DOEL);
}
if (require.main === module) bouw().catch(e => { console.error('[WORLD] ' + e.message); process.exitCode = 1; });

module.exports = { bouw, ringen };
