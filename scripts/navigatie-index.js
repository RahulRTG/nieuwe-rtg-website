#!/usr/bin/env node
/* ============================================================================
   DE GEBIEDSINDEX -- wat kan RTG aanbieden, en onder welke naam.

   Dit script schrijft `RTG_DATA_DIR/navigatie/gebieden.json`: de lijst gebieden
   die de BRON kan leveren. server/kern/navigatie/gebieden.js leest hem en zet
   hem naast de schijf; daar staat ook waarom "aangeboden" geen dekking is.

   DE TWEE HELFTEN ZIJN MET OPZET GESCHEIDEN, en dat is geen nette opzet maar
   een eerlijkheidskwestie:

     OPHALEN   het netwerk. Hier NIET te bewijzen: de uitgaande proxy van deze
               omgeving weigert download.geofabrik.de en planet.openstreetmap.org
               met een 403 op de CONNECT. Wie beweert dat het ophalen werkt,
               beweert iets wat hier niemand heeft gezien.
     ONTLEDEN  de tekst naar een index. Wel te bewijzen, en dat gebeurt ook:
               test/navigatie-index.test.js voert `leesBronindex()` op een
               vaste GeoJSON uit test/fixtures/.

   Wat de fixture NIET bewijst is dat de echte bron er zo uitziet. Hij is
   gemaakt naar de gedocumenteerde vorm van Geofabriks `index-v1.json` (een
   FeatureCollection met per gebied `id`, `name`, `parent` en `urls`), en de
   graad daarvan is dus `vermoed` en niet `gemeten`. Draai je het script op de
   echte bron en klopt een veld niet, dan hoort de fixture bijgewerkt te worden
   -- niet de bewering.

   EEN BRON-ID IS GEEN BESTANDSNAAM, en die vertaling hoort HIER en nergens
   anders. De ids van de bron dragen schuine strepen (`europe/netherlands`) en
   een gebiedscode wordt een bestandsnaam. server/kern/navigatie/pakket.js
   weigert daarom alles wat geen veilige code is -- fail closed, en dat is de
   reparatie van een pad dat de datamap uit liep. Maar weigeren is niet
   vertalen: alleen de schrijver van deze index kan zien dat twee ids op
   dezelfde naam uitkomen, want alleen hij ziet ze allemaal tegelijk.

   BIJ EEN BOTSING VALLEN ZE ALLEBEI AF. Een van de twee laten winnen is
   willekeur op sorteervolgorde, en het gevolg is erger dan een gemist gebied:
   een lid downloadt dan een pakket dat volgens het scherm over Zuid-Holland
   gaat en in werkelijkheid een ander gebied bevat. Allebei weigeren MET de
   naam van de twee ids is het enige antwoord dat niemand misleidt.

   DRAAIEN

     node scripts/navigatie-index.js --bron <bestand>   (ontleden, geen netwerk)
     node scripts/navigatie-index.js                    (ophalen en ontleden)
     node scripts/navigatie-index.js --uit <pad>
   ========================================================================== */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
/* DE VEILIGE-CODEREGEL WOONT IN DE KERN en wordt hier niet nagetypt: een tweede
   regex zou een dag later net iets anders toelaten dan de poort die hem moet
   tegenhouden (LAT.md regel 4). */
const { codeVeilig } = require('../server/kern/navigatie/pakket');

const BRON_URL = 'https://download.geofabrik.de/index-v1.json';
/* De hele Geofabrik-uitsnede van OpenStreetMap staat onder ODbL 1.0, en die
   licentie EIST naamsvermelding. Daarom staat hij op de index en niet per
   gebied: een plicht die per rij wordt overgetypt, raakt een rij kwijt.
   server/kern/navigatie/gebieden.js valt per gebied op deze twee terug en zijn
   `mag()` weigert een pakket zonder vermelding. */
const LICENTIE = 'ODbL 1.0';
const NAAMSVERMELDING = 'Kaartgegevens (c) OpenStreetMap-bijdragers, ODbL 1.0';

const DATA_DIR = process.env.RTG_DATA_DIR || path.join(__dirname, '..', 'server', 'data');
const waarde = (naam) => { const i = process.argv.indexOf(naam); return i >= 0 ? String(process.argv[i + 1] || '') : ''; };

/* Van bron-id naar gebiedscode. Schuine strepen worden koppeltekens; verder
   wordt er NIETS weggepoetst. Tekens stilletjes verwijderen maakt van twee
   verschillende ids een gelijke naam, en dat is precies de botsing die we
   hieronder weigeren -- dan zou dit script hem zelf veroorzaken. */
function codeUitId(id) {
  const c = String(id || '').trim().toLowerCase().replace(/\//g, '-');
  return codeVeilig(c) ? c : null;
}

/* Het omhullende vak uit een GeoJSON-geometrie. Loopt alle coordinaten na en
   kent geen geometrietype: een ring is een lijst punten, en dieper genest is
   nog steeds een lijst punten. Zonder bruikbare geometrie komt er `null` en
   geen 0-vak -- een vak van niets zou "past nergens" gaan betekenen in plaats
   van "wij weten het niet", en gebiedkeuze.js kent daar de grond `geen-vak`
   al voor. Let op de volgorde: GeoJSON is [lng, lat]. */
function vakUitGeometrie(geom) {
  let lat0 = Infinity, lat1 = -Infinity, lng0 = Infinity, lng1 = -Infinity, n = 0;
  const loop = (x) => {
    if (!Array.isArray(x)) return;
    if (x.length >= 2 && typeof x[0] === 'number' && typeof x[1] === 'number') {
      const lng = x[0], lat = x[1];
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
      lat0 = Math.min(lat0, lat); lat1 = Math.max(lat1, lat);
      lng0 = Math.min(lng0, lng); lng1 = Math.max(lng1, lng);
      n++;
      return;
    }
    for (const d of x) loop(d);
  };
  loop(geom && geom.coordinates);
  if (n < 2 || !(lat0 < lat1) || !(lng0 < lng1)) return null;
  return { lat0, lat1, lng0, lng1 };
}

const eigenschappen = (f) => (f && f.properties) || {};
const pbfVan = (p) => {
  const u = p.urls || {};
  return typeof u.pbf === 'string' ? u.pbf : (typeof u['pbf-internal'] === 'string' ? u['pbf-internal'] : null);
};

/* ONTLEDEN. Geeft altijd drie dingen terug: de gebieden, de GEWEIGERDE ids met
   hun reden, en (als er niets te ontleden was) een reden. Nooit een lege lijst
   zonder woord erbij: dat leest als "de bron heeft niets". */
function leesBronindex(tekst, opties) {
  const bronUrl = (opties && opties.bron) || BRON_URL;
  let j = null;
  try { j = JSON.parse(String(tekst)); }
  catch (e) { return { gebieden: [], geweigerd: [], reden: 'De bronindex is geen geldige JSON (' + e.message + '); hij wordt niet geraden.' }; }
  const rij = Array.isArray(j && j.features) ? j.features : [];
  if (!rij.length) {
    return { gebieden: [], geweigerd: [], reden: 'De bronindex draagt geen enkel gebied (geen `features`). ' +
      'Dat is iets anders dan een bron zonder gebieden, dus er wordt niets weggeschreven.' };
  }

  const geweigerd = [];
  const kandidaten = [];
  for (const f of rij) {
    const p = eigenschappen(f);
    const id = String(p.id || '').trim();
    const naam = String(p.name || '').trim();
    if (!id || !naam) { geweigerd.push({ id: id || '(zonder id)', code: null, reden: 'zonder-id-of-naam' }); continue; }
    const code = codeUitId(id);
    if (!code) { geweigerd.push({ id, code: null, reden: 'code-onveilig' }); continue; }
    kandidaten.push({ id, code, naam, ouderId: String(p.parent || '').trim() || null, geom: f && f.geometry, pbf: pbfVan(p) });
  }

  /* De botsing: twee ids die op dezelfde code uitkomen. Allebei eruit, met de
     twee ids in de reden -- zie de kop voor waarom er geen winnaar is. */
  const perCode = new Map();
  for (const k of kandidaten) {
    if (!perCode.has(k.code)) perCode.set(k.code, []);
    perCode.get(k.code).push(k);
  }
  const gebieden = [];
  for (const [code, groep] of perCode) {
    if (groep.length > 1) {
      const ids = groep.map(g => g.id).sort();
      for (const g of groep) geweigerd.push({ id: g.id, code, reden: 'code-botsing met ' + ids.filter(x => x !== g.id).join(', ') });
      continue;
    }
    const k = groep[0];
    gebieden.push({
      code,
      naam: k.naam,
      /* De bron zegt niet of iets een stad of een land is, dus dit script
         beweert het niet: alles is `land` tenzij een latere bron het wel weet.
         Een gok hier zou op het scherm van een lid als een feit langskomen. */
      soort: 'land',
      ouder: k.ouderId ? codeUitId(k.ouderId) : null,
      vak: vakUitGeometrie(k.geom),
      /* HET DOWNLOADADRES HEET NIET `bron`, EN DAT IS EEN REPARATIE. De index
         draagt boven aan het bestand al een `bron` (waar de index zelf
         vandaan komt), en kern/navigatie/gebieden.js laat elk gebied daarop
         terugvallen. Een gebied ZONDER pbf-adres erfde daardoor de index-URL
         en zag eruit als een gebied dat te bouwen was. Twee betekenissen op
         een naam, precies wat SEMANTIEK.json meet -- nu twee namen. */
      downloadAdres: k.pbf,
      /* Het formaat van de bron staat niet in de index; dat vergt een HEAD per
         gebied. Daarom `null` en geen 0 -- een nul zou op het scherm van een
         lid "gratis" betekenen. */
      bronBytes: null
    });
  }
  gebieden.sort((a, b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
  geweigerd.sort((a, b) => String(a.id) < String(b.id) ? -1 : 1);
  return { gebieden, geweigerd, bron: bronUrl, licentie: LICENTIE, naamsvermelding: NAAMSVERMELDING,
    gelezenAt: new Date().toISOString() };
}

/* OPHALEN. Apart gehouden en hier niet beproefd: de proxy van deze omgeving
   weigert de bron. Een fout wordt daarom doorgegeven en niet weggeslikt --
   stilte zou als "de bron heeft niets" landen. */
async function haal(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('De bronindex is niet op te halen: HTTP ' + r.status + ' van ' + url);
  return await r.text();
}

async function main() {
  const bronBestand = waarde('--bron');
  const uit = path.resolve(waarde('--uit') || path.join(DATA_DIR, 'navigatie', 'gebieden.json'));
  const tekst = bronBestand ? fs.readFileSync(path.resolve(bronBestand), 'utf8') : await haal(BRON_URL);
  const index = leesBronindex(tekst, { bron: bronBestand ? path.resolve(bronBestand) : BRON_URL });
  if (index.reden) { console.error('[gebieden] ' + index.reden); process.exitCode = 1; return; }
  fs.mkdirSync(path.dirname(uit), { recursive: true });
  fs.writeFileSync(uit, JSON.stringify(index, null, 2) + '\n');
  console.log('[gebieden] ' + index.gebieden.length + ' gebied(en) geschreven naar ' + uit);
  console.log('[gebieden] licentie ' + LICENTIE + ', met naamsvermelding; ' +
    index.gebieden.filter(g => !g.vak).length + ' zonder vak, ' +
    index.gebieden.filter(g => !g.bron).length + ' zonder downloadadres.');
  if (index.geweigerd.length) {
    console.log('[gebieden] ' + index.geweigerd.length + ' geweigerd (nooit stil):');
    for (const w of index.geweigerd.slice(0, 20)) console.log('  - ' + w.id + ': ' + w.reden);
  }
}

module.exports = { codeUitId, vakUitGeometrie, leesBronindex, LICENTIE, NAAMSVERMELDING, BRON_URL };

if (require.main === module) main().catch(e => { console.error('[gebieden] ' + e.message); process.exit(1); });
