#!/usr/bin/env node
/* ============================================================================
   DRAAIT WAT ER IS GEBOUWD? -- de laatste schakel van de release-provenance.

   SBOM.md sloot af met: "de gegevens zijn er nu wel, de controle nog niet."
   Dit is die controle. Hij vraagt een DRAAIENDE server welke build hij is
   (GET /api/health, het blok `bouw` uit server/bouwstempel.js) en legt die
   naast de materiaallijst van de release die er hoort te draaien.

   DRIE UITSLAGEN, EN "NIET VAST TE STELLEN" IS ER EEN VAN. Dat is geen
   verlegenheid maar de regel van BESTUUR.md: een bewering draagt haar
   bewijsgraad, en `onbekend` is een eersteklas uitslag naast `in orde` en
   `storing`. Een server zonder bouwstempel is niet verdacht -- hij is niet uit
   een release-image gestart, en dat hoort te staan zoals het is.

     gelijk               de bronafdruk van de server is die van deze release
     anders               hij draait iets anders, en dat is een alarm
     niet vast te stellen er is geen stempel om mee te vergelijken

   WAT EEN GELIJKE AFDRUK WEL EN NIET BEWIJST, en dit hoort erbij te staan want
   het is de verleiding van elk provenance-werktuig:

   WEL -- de BRONBOOM waaruit dit proces is gebouwd is byte voor byte dezelfde
   als die van deze release, pad inbegrepen (scripts/sbom.js).

   NIET -- dat het draaiende image verder ongewijzigd is. De basis-images staan
   op een tag en niet op een digest, er draait een Rust-binary die hier niet in
   de som zit, en niets is ondertekend. Wie meer wil weten dan "dezelfde bron",
   heeft een handtekening nodig; die staat als ontbrekend in SBOM.md.

   Draai:  node scripts/uitrolproef.js http://localhost:3000
           node scripts/uitrolproef.js https://... --afdruk sha256:...
   Zonder --afdruk wordt SBOM.json van deze werkkopie gebruikt.
   Afsluitcode: 0 gelijk, 1 anders, 2 niet vast te stellen.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');

/* De verwachte afdruk. Uit SBOM.json, of met de hand meegegeven -- dat tweede
   is wat een uitrolpijplijn doet: die kent de afdruk van het artefact dat hij
   net heeft gepubliceerd en hoeft de werkkopie er niet bij te hebben. */
function verwacht(argv) {
  const i = argv.indexOf('--afdruk');
  if (i >= 0 && argv[i + 1]) return { afdruk: argv[i + 1], bron: 'meegegeven' };
  try {
    const s = JSON.parse(fs.readFileSync(path.join(WORTEL, 'SBOM.json'), 'utf8'));
    return { afdruk: s.eigenCode && s.eigenCode.afdruk, bron: 'SBOM.json', commit: (s.product || {}).commit };
  } catch (e) { return { afdruk: null, bron: 'geen' }; }
}

async function haalStempel(basis) {
  const r = await fetch(basis.replace(/\/+$/, '') + '/api/health');
  if (!r.ok) throw new Error('de server antwoordde met ' + r.status + ' op /api/health');
  const b = await r.json();
  return b && b.bouw ? b.bouw : null;
}

/* Het oordeel. Bewust een pure functie met de twee waarden als invoer: zo is
   hij te toetsen zonder server, en dat is precies wat een oordeel over een
   veiligheidseigenschap nodig heeft. */
function oordeel(stempel, verwachteAfdruk) {
  if (!verwachteAfdruk) {
    return { stand: 'niet vast te stellen', code: 2,
      waarom: 'Er is geen verwachte afdruk: geef er een mee met --afdruk, of draai eerst npm run sbom.' };
  }
  if (!stempel || !stempel.vastgelegd || !stempel.bronAfdruk) {
    return { stand: 'niet vast te stellen', code: 2,
      waarom: (stempel && stempel.reden) ||
        'Deze server draagt geen bouwstempel; er valt niets te vergelijken.' };
  }
  if (stempel.bronAfdruk === verwachteAfdruk) {
    return { stand: 'gelijk', code: 0,
      waarom: 'De bronboom van deze server is byte voor byte die van deze release.',
      let: 'Dit zegt niets over de basis-images (die staan op een tag) en er is geen handtekening. Zie SBOM.md.' };
  }
  return { stand: 'anders', code: 1,
    waarom: 'Deze server draait een ANDERE bron dan de release die u verwacht.',
    draait: stempel.bronAfdruk, verwacht: verwachteAfdruk };
}

async function proef(basis, verwachteAfdruk) {
  let stempel = null, fout = null;
  try { stempel = await haalStempel(basis); } catch (e) { fout = e.message; }
  if (fout) return { stand: 'niet vast te stellen', code: 2, waarom: 'De server was niet te bereiken: ' + fout };
  return Object.assign(oordeel(stempel, verwachteAfdruk), { stempel });
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const basis = argv.find(a => /^https?:\/\//.test(a));
  if (!basis) {
    console.error('Geef het adres van de draaiende server, bijvoorbeeld:\n  node scripts/uitrolproef.js http://localhost:3000');
    process.exit(2);
  }
  const v = verwacht(argv);
  proef(basis, v.afdruk).then(u => {
    console.log('Verwacht: ' + (v.afdruk || '(geen)') + '  [' + v.bron + (v.commit ? ', commit ' + v.commit.slice(0, 12) : '') + ']');
    console.log('Draait:   ' + ((u.stempel && u.stempel.bronAfdruk) || '(geen stempel)'));
    console.log('');
    console.log('UITSLAG: ' + u.stand.toUpperCase());
    console.log('  ' + u.waarom);
    if (u.let) console.log('  Let op: ' + u.let);
    process.exit(u.code);
  }).catch(e => { console.error('onverwachte fout: ' + e.message); process.exit(2); });
}

module.exports = { oordeel, proef, verwacht };
