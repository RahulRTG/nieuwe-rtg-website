#!/usr/bin/env node
/* ============================================================================
   DE IJKING VAN HET INVOERSPOOR OP EEN ECHTE GENERATOR (ARCHITECTOPDRACHT.md,
   fase 2)

   test/invoerspoor.test.js bewijst het mechanisme op een proefgenerator. Dit
   script stelt de vraag op een echte: klopt de gemeten invoer van DEZE
   generator? Drie proeven, en de uitslag is pas iets waard als ze alle drie
   lopen zoals verwacht.

     een   te smal?    wijzig N bestanden die NIET in de gemeten invoer staan
                       en genereer opnieuw. De inhoud (zonder stempel) moet
                       byte voor byte gelijk blijven. Verschilt hij, dan las de
                       generator iets wat het spoor niet zag, en is zijn
                       versheid niet te vertrouwen.
     twee  reageert?   wijzig een bestand dat WEL gelezen werd. De versheid
                       tegen de werkboom moet `mogelijk-verouderd` worden.
     mutatie           haal dat bestand uit de lijst (alsof het spoor het
                       gemist had) en wijzig het zo dat de uitkomst verandert.
                       Proef een moet dat nu zien: de uitvoer verandert terwijl
                       het bestand "buiten de invoer" stond. Ziet hij het niet,
                       dan kan proef een niet uitslaan en bewijst hij niets.

   Het script laat niets achter: elke wijziging wordt teruggezet met git, en
   het begint alleen op een schone boom.

   Draai:  node scripts/invoerijking.js symbolen SYMBOLEN.json
           node scripts/invoerijking.js schermroutes SCHERMROUTES.json --n=12
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { invoerVersheid } = require('./lib/invoerspoor');

const WORTEL = path.join(__dirname, '..');
const [opdracht, register] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const N = Number((process.argv.find((a) => a.startsWith('--n=')) || '--n=8').slice(4));
if (!opdracht || !register) { console.error('gebruik: node scripts/invoerijking.js <npm-opdracht> <REGISTER.json> [--n=8]'); process.exit(2); }

const git = (...a) => execFileSync('git', a, { cwd: WORTEL, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
if (git('status', '--porcelain')) { console.error('de boom is niet schoon; de ijking begint alleen op een schone boom'); process.exit(2); }

const leesInhoud = () => {
  const j = JSON.parse(fs.readFileSync(path.join(WORTEL, register), 'utf8'));
  delete j.stempel;
  return JSON.stringify(j);
};
const genereer = () => {
  const r = spawnSync('npm', ['run', '-s', opdracht], { cwd: WORTEL, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(opdracht + ' faalde: ' + (r.stderr || '').slice(-400));
};
const terug = () => git('checkout', '--', '.');

const stempel = JSON.parse(fs.readFileSync(path.join(WORTEL, register), 'utf8')).stempel;
const inv = stempel && stempel.invoer;
if (!inv) { console.error(register + ' draagt geen gemeten invoer'); process.exit(2); }
const gelezen = new Set(inv.bestanden.concat(inv.bestaat));
const basis = leesInhoud();
const uitslag = { register, opdracht, een: null, twee: null, mutatie: null };

/* Een wijziging die voor elk teksttype onschuldig is maar de bytes verandert. */
const TEKST = /\.(js|md|html|css|txt)$/;
const plak = (p, t) => fs.appendFileSync(path.join(WORTEL, p), t);

try {
  /* PROEF EEN: N bestanden buiten de invoer, verspreid over de boom. */
  const buiten = git('ls-files').split('\n')
    .filter((p) => TEKST.test(p) && !gelezen.has(p) && p !== register && !p.startsWith('node_modules/'));
  const stap = Math.max(1, Math.floor(buiten.length / N));
  const gekozen = buiten.filter((_, i) => i % stap === 0).slice(0, N);
  for (const p of gekozen) plak(p, p.endsWith('.html') ? '\n<!-- ijking -->\n' : '\n// ijking\n');
  genereer();
  uitslag.een = { gewijzigd: gekozen, gelijk: leesInhoud() === basis };
  terug();

  /* PROEF TWEE en de MUTATIE: een gelezen bestand dat de uitkomst bepaalt. */
  const kandidaat = inv.bestanden.find((p) => /^server\/kern\/.*\.js$/.test(p)) ||
    inv.bestanden.find((p) => /^public\/.*\.html$/.test(p)) || inv.bestanden.find((p) => TEKST.test(p));
  const inhoudelijk = kandidaat.endsWith('.html')
    ? '\n<script>fetch("/api/ijking/invoerspoor")</script>\n'
    : '\nfunction ijkingInvoerspoor() { return ijkingInvoerspoorAnder(); }\nfunction ijkingInvoerspoorAnder() { return 1; }\nmodule.exports.ijkingInvoerspoor = ijkingInvoerspoor;\n';
  plak(kandidaat, inhoudelijk);
  const v = invoerVersheid(stempel, { tegen: 'werkboom' });
  uitslag.twee = { bestand: kandidaat, stand: v.stand };

  genereer();
  const veranderd = leesInhoud() !== basis;
  const smal = JSON.parse(JSON.stringify(stempel));
  smal.invoer.bestanden = smal.invoer.bestanden.filter((p) => p !== kandidaat);
  const vSmal = invoerVersheid(smal, { tegen: 'werkboom' });
  /* Met de smalle lijst zegt de versheid "actueel" terwijl de uitkomst
     veranderde: dat is precies wat proef een moet vangen. */
  uitslag.mutatie = { bestand: kandidaat, uitvoerVeranderd: veranderd, versheidMetSmalleLijst: vSmal.stand,
    proefEenSlaatUit: veranderd && vSmal.stand === 'actueel' };
} finally {
  terug();
}

const ok = uitslag.een.gelijk && uitslag.twee.stand === 'mogelijk-verouderd' && uitslag.mutatie.proefEenSlaatUit;
console.log(JSON.stringify(uitslag, null, 1));
console.log(ok ? 'IJKING GESLAAGD: de gemeten invoer is niet te smal op ' + uitslag.een.gewijzigd.length +
  ' proefbestanden, reageert op een echte wijziging, en een gemiste invoer wordt gezien'
  : 'IJKING NIET GESLAAGD');
process.exit(ok ? 0 : 1);
