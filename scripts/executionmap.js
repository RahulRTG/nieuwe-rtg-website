#!/usr/bin/env node
/* DE CAPABILITY-COMPILER -- EXECUTION_MAP.json, EXECUTIE.md blok 1.

   EEN PROJECTIE, NOOIT EEN BRON. Alles hieronder wordt AFGELEID uit registers
   die al bestaan: de routes en hun herhaalbaarheid uit IDEMPROEF.json, de
   bereikbaarheid voor de AI uit kern/stuur/beleid.js, de bewijsstand uit
   VERTROUWEN.json, en de gezagstrede uit scripts/gezagsnoemer.js. Er staat in
   dit bestand geen enkele eigenschap die iemand met de hand heeft ingevuld.

   Dat is geen stijlkeuze. CAPABILITEIT.json telde 21 losse capability-lijsten in
   dit huis, met 249 leden waarvan 92% in precies een lijst woont. Een
   handgeschreven executiekaart wordt binnen een jaar de 22e. Daarom drie
   handhavingen, en alle drie zakt de bouw erop:

     met de hand gewijzigd                 -> rood (de hercompilatie verschilt)
     generator gewijzigd zonder bronwijziging -> rood (idem, en dat is de bedoeling:
                                              een projectie die verandert zonder
                                              dat de bron veranderde, is geen
                                              projectie meer)
     twee bronnen die elkaar tegenspreken  -> ONBEPAALD, nooit stil een winnaar

   DIE DERDE IS GEEN THEORIE. IDEMPROEF.json bevat 86 keer dezelfde route+rol
   twee keer, en in 28 gevallen met een ANDER oordeel over herhaalbaarheid --
   "beschermd" naast "ongemeten". Een compiler die de laatste regel wint, zet
   daar een hard antwoord neer dat niemand heeft vastgesteld. Ze staan hier als
   `ONBEPAALD` met beide waarden erbij.

   ELK VELD DRAAGT ZIJN HERKOMST: waarde, bron, en of hij is afgeleid. Bij een
   conflict of een ontbrekende bron staat er `ONBEPAALD` met de reden. Er staat
   nooit een getal of een oordeel waar er geen is -- dezelfde regel die KOSTEN.md
   hard maakt ("geen tarief is een REDEN, geen nul") en die bon.js toepast.

   WAT ER BEWUST ONBEPAALD BLIJFT, met de reden in de kaart zelf: risico (dat
   rekent kern/command/risico.js per GEVAL uit, met bedrag en aantal -- statisch
   bestaat het niet), herstel (geen register kent de tegenhanger van een route;
   EXECUTIE.md blok 5) en kosten (KOSTEN.md meet verbruik, niet routes). Een
   kaart die die drie invult, verzint ze.

   Draaien: npm run executionmap   /   npm run executionmap:controle */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { beleidVoor } = require('../server/kern/stuur/beleid');
const { PROJECTIES } = require('./gezagsnoemer');

const WORTEL = path.join(__dirname, '..');
const ROLLEN = ['member', 'supplier', 'staff'];
const UIT = 'EXECUTION_MAP.json';

/* De bronnen, met hun vingerafdruk: verandert er een, dan hoort de kaart mee te
   veranderen -- en verandert er geen, dan mag de kaart NIET veranderen. */
const BRONNEN = ['IDEMPROEF.json', 'VERTROUWEN.json',
  'server/kern/stuur/beleid.js', 'scripts/gezagsnoemer.js', 'scripts/executionmap.js'];

function vingerafdruk(bestand) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(path.join(WORTEL, bestand))).digest('hex').slice(0, 16); }
  catch (e) { return null; }
}

/* DE HERKOMST STAAT PER VELDSOORT EN NIET PER RIJ, en dat is geen bezuiniging op
   de waarheid: elke `bewijs`-waarde komt uit VERTROUWEN.json, elke `bereikbaar`
   uit beleid.js -- die herkomst is een eigenschap van het VELD en niet van de
   route. Per rij herhalen kostte 6,7 MB en voegde geen enkel feit toe. Wat wel
   per rij staat, staat per rij: een afwijkende reden, en elke ONBEPAALD. */
const VELDEN = {
  bereikbaar: { bron: 'server/kern/stuur/beleid.js', afgeleid: true,
    wat: 'wat de AI met deze route mag: lezen, klein, voorstel of verboden' },
  noemer: { bron: 'scripts/gezagsnoemer.js', afgeleid: true,
    wat: 'de gedeelde gezagstrede van die bereikbaarheid; de projectie staat in de noemer' },
  bewijs: { bron: 'VERTROUWEN.json', afgeleid: true,
    wat: 'de vervalstaat: bewezen, verschaald, verzwakt, geschorst of ongemeten' },
  herhaling: { bron: 'IDEMPROEF.json', afgeleid: true,
    wat: 'wat een tweede identieke aanroep doet: beschermd, onbeschermd of ongemeten' },
  risico: { bron: 'server/kern/command/risico.js', afgeleid: false, waarde: 'ONBEPAALD',
    reden: 'risico wordt per GEVAL berekend uit bedrag, aantal en omkeerbaarheid; statisch bestaat het niet' },
  herstel: { bron: null, afgeleid: false, waarde: 'ONBEPAALD',
    reden: 'geen register kent de tegenhanger van een route (EXECUTIE.md blok 5)' },
  kosten: { bron: null, afgeleid: false, waarde: 'ONBEPAALD',
    reden: 'KOSTEN.md meet verbruik per aanroep, niet per route' }
};

/* De vertaling van elke gezagstrede van beleid.js naar de gedeelde noemer, uit
   de projectie zelf. Een tweede tabel hier zou binnen een maand iets anders
   zeggen dan scripts/gezagsnoemer.js; deze wordt eruit AFGELEID. */
function noemerlegenda() {
  const p = PROJECTIES.find(x => x.bestand === 'server/kern/stuur/beleid.js');
  const uit = {};
  for (const [trede, v] of Object.entries((p && p.treden) || {}))
    uit[trede] = { noemer: Array.isArray(v.noemer) ? v.noemer.join('|') : v.noemer, grond: v.grond };
  return uit;
}

function bouw() {
  let idem, vert;
  try { idem = JSON.parse(fs.readFileSync(path.join(WORTEL, 'IDEMPROEF.json'), 'utf8')); }
  catch (e) { return { fout: 'IDEMPROEF.json ontbreekt -- draai eerst: npm run idemproef' }; }
  try { vert = JSON.parse(fs.readFileSync(path.join(WORTEL, 'VERTROUWEN.json'), 'utf8')); }
  catch (e) { return { fout: 'VERTROUWEN.json ontbreekt -- draai eerst: npm run vertrouwen' }; }

  /* Herhaalbaarheid per (methode, pad, rol). Meerdere metingen die HETZELFDE
     zeggen zijn geen conflict; meerdere die iets anders zeggen wel. */
  const herhaling = new Map();
  for (const r of (idem.perRoute || [])) {
    if (!r || !r.pad) continue;
    const k = r.methode + ' ' + r.pad + ' ' + (r.rol || '');
    if (!herhaling.has(k)) herhaling.set(k, new Set());
    herhaling.get(k).add(r.idempotentie || 'ongemeten');
  }

  const paden = [...new Set((idem.perRoute || [])
    .filter(r => r && r.methode === 'POST' && typeof r.pad === 'string').map(r => r.pad))].sort();
  const rolVan = new Map();
  for (const r of (idem.perRoute || [])) if (r && r.pad && r.rol) rolVan.set(r.pad, r.rol);

  const capabilities = [];
  let conflicten = 0, bereikbaar = 0;
  for (const pad of paden) {
    const bron = rolVan.get(pad) || '';
    const k = 'POST ' + pad + ' ' + bron;
    const gemeten = [...(herhaling.get(k) || [])].sort();
    const rij = { pad, rol: bron };

    if (gemeten.length > 1) {
      conflicten++;
      rij.herhaling = 'ONBEPAALD';
      rij.herhalingReden = 'het register spreekt zichzelf tegen: ' + gemeten.join(' en ') +
        '. Een winnaar kiezen zou een oordeel neerzetten dat niemand heeft vastgesteld.';
    } else rij.herhaling = gemeten[0] || 'ongemeten';

    const staat = (vert.perRoute || {})['POST ' + pad];
    if (staat) { rij.bewijs = staat.staat; if (staat.reden) rij.bewijsReden = staat.reden; }
    else { rij.bewijs = 'ONBEPAALD'; rij.bewijsReden = 'deze route staat niet in het vervalregister'; }

    const bereik = {};
    for (const rol of ROLLEN) {
      const b = beleidVoor(pad, rol);
      bereik[rol] = b.niveau;
      if (b.niveau !== 'verboden') bereikbaar++;
    }
    /* Een route die geen enkele rol mag bedienen, draagt drie keer hetzelfde
       woord. Dat is 3282 keer dezelfde regel; hij staat er als EEN vlag. */
    rij.bereik = ROLLEN.every(r => bereik[r] === 'verboden') ? 'verboden' : bereik;
    capabilities.push(rij);
  }

  const kaart = {
    uitleg: 'Afgeleide executiekaart: per route wat de AI ermee mag, wat het bewijs eronder zegt ' +
      'en of een herhaling schade doet. De herkomst staat per veldsoort in `velden`, de vertaling ' +
      'naar de gedeelde gezagsnoemer in `noemer`. NOOIT met de hand wijzigen: ' +
      'npm run executionmap:controle zakt erop.',
    bronnen: Object.fromEntries(BRONNEN.map(b => [b, vingerafdruk(b)])),
    velden: VELDEN,
    noemer: noemerlegenda(),
    telling: { capabilities: capabilities.length, bereikbaarPerRol: bereikbaar, conflicten },
    capabilities
  };
  return kaart;
}

function tekst(kaart) { return JSON.stringify(kaart, null, 1) + '\n'; }

function main() {
  const controle = process.argv.includes('--controle');
  const kaart = bouw();
  if (kaart.fout) { console.error(kaart.fout); process.exit(2); }
  const nieuw = tekst(kaart);
  const pad = path.join(WORTEL, UIT);
  let bestaand = null;
  try { bestaand = fs.readFileSync(pad, 'utf8'); } catch (e) {}

  console.log('DE CAPABILITY-COMPILER\n');
  console.log('  ' + kaart.telling.capabilities + ' routes, ' +
    kaart.telling.bereikbaarPerRol + ' (rol, route)-paren die de AI mag bedienen');
  console.log('  ' + kaart.telling.conflicten + ' route(s) waarover een bron zichzelf tegenspreekt -> ONBEPAALD');
  for (const [b, v] of Object.entries(kaart.bronnen))
    console.log('    ' + (v || 'ONTBREEKT').padEnd(18) + b);

  if (controle) {
    if (bestaand === null) { console.error('\nNIET OK: ' + UIT + ' bestaat niet. Draai: npm run executionmap'); process.exit(1); }
    if (bestaand !== nieuw) {
      console.error('\nNIET OK: ' + UIT + ' is niet gelijk aan wat de bronnen nu opleveren.');
      console.error('Of het bestand is met de hand gewijzigd, of de generator is veranderd zonder dat');
      console.error('een bron veranderde. Beide horen te zakken. Draai: npm run executionmap');
      process.exit(1);
    }
    console.log('\nDe kaart is byte voor byte gelijk aan wat de bronnen opleveren.');
    return;
  }
  fs.writeFileSync(pad, nieuw);
  console.log('\n' + UIT + ' geschreven (' + Math.round(nieuw.length / 1024) + ' KB).');
}

if (require.main === module) main();
module.exports = { bouw, tekst, BRONNEN, ROLLEN };
