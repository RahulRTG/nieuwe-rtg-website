/* Veilige Docker Compose-uitrol met automatische code-rollback.

   Voor de bouw worden de huidige app- en motor-images vastgelegd. Pas na een
   groene productie-releasepoort wordt gebouwd en gewisseld. Faalt build,
   start of healthcheck, dan krijgen de oude image-tags hun vorige image-id
   terug en start Compose die zonder herbouw. Datavolumes worden nooit gewist
   of teruggedraaid; schemawijzigingen moeten daarom achterwaarts compatibel
   blijven. */
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { eisSchoneReleasebron, leesProductiestatus } = require('./lib/productie-vrijgave');
const ROOT = path.join(__dirname, '..');
const ENV = path.join(ROOT, '.env.productie');
const RELEASE_MAP = path.join(ROOT, '.release');
const SERVICES = ['app', 'motor', 'sentinel'];
const BUILD_SERVICES = ['app', 'motor']; // Sentinel gebruikt bewust exact het app-image.

function voer(commando, args, opties = {}) {
  const r = cp.spawnSync(commando, args, { cwd: ROOT, encoding: opties.stil ? 'utf8' : undefined,
    stdio: opties.stil ? ['ignore', 'pipe', 'pipe'] : 'inherit', env: process.env });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(commando + ' ' + args.join(' ') + ' stopte met ' + r.status +
    (opties.stil && r.stderr ? ': ' + r.stderr.trim() : ''));
  return opties.stil ? String(r.stdout || '').trim() : '';
}

const composeArgs = (...args) => ['compose', '--env-file', '.env.productie', ...args];
function compose(args, opties) { return voer('docker', composeArgs(...args), opties); }

function geldigeImageId(id) { return /^sha256:[a-f0-9]{64}$/.test(String(id || '')); }
function geldigeTag(tag) { return /^[a-zA-Z0-9][a-zA-Z0-9._/:@-]{0,255}$/.test(String(tag || '')); }

function valideerBon(bon) {
  if (!bon || bon.formaat !== 'rtg-uitrol-v1' || !bon.images || typeof bon.images !== 'object')
    throw new Error('Onbekende of beschadigde uitrolbon.');
  for (const dienst of SERVICES) {
    const image = bon.images[dienst];
    if (!image) continue; // een eerste uitrol heeft nog niets om terug te zetten
    if (!geldigeImageId(image.id)) throw new Error('Ongeldige image-id voor ' + dienst + '.');
    if (!Array.isArray(image.tags) || !image.tags.length || image.tags.some(t => !geldigeTag(t)))
      throw new Error('Ongeldige image-tag voor ' + dienst + '.');
  }
  return bon;
}

function huidigImage(dienst) {
  const id = compose(['images', '-q', dienst], { stil: true }).split(/\s+/).filter(Boolean)[0];
  if (!id) return null;
  const volledig = id.startsWith('sha256:') ? id : voer('docker', ['image', 'inspect', '--format', '{{.Id}}', id], { stil: true });
  if (!geldigeImageId(volledig)) throw new Error('Docker gaf geen betrouwbare image-id voor ' + dienst + '.');
  const tagsTekst = voer('docker', ['image', 'inspect', '--format', '{{json .RepoTags}}', volledig], { stil: true });
  const tags = JSON.parse(tagsTekst || '[]').filter(geldigeTag);
  if (!tags.length) throw new Error('Het huidige ' + dienst + '-image heeft geen herstelbare tag.');
  return { id: volledig, tags };
}

function releaseHash() {
  try {
    const b = JSON.parse(fs.readFileSync(path.join(RELEASE_MAP, 'release-bewijs.json'), 'utf8'));
    return b.inhoudSha256 || null;
  } catch (e) { return null; }
}

/* Lees de hash van het bewijs UIT HET GEBOUWDE IMAGE, dus buiten de container
   die hem later moet bewaken. De pin gaat via Compose terug naar de runtime.
   Code met alleen schrijfrecht in de container kan bron en bewijs dan niet
   samen vervangen zonder dat de externe pin rood wordt. */
function bewijsPinVanImage(imageId) {
  const id = imageId || compose(['images', '-q', 'app'], { stil: true }).split(/\s+/).filter(Boolean)[0];
  if (!id) throw new Error('Het gebouwde app-image heeft geen image-id.');
  const regel = voer('docker', ['run', '--rm', '--entrypoint', 'sha256sum', id,
    '/app/release-bewijs.json'], { stil: true });
  const pin = String(regel).split(/\s+/)[0].toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(pin)) throw new Error('Kon de SHA-256-pin van het releasebewijs niet lezen.');
  return { pin, imageId: id };
}

function vulBonAan(doel, bon, bewijs) {
  bon.nieuweRelease = { imageId: bewijs.imageId, bewijsSha256: bewijs.pin };
  fs.writeFileSync(doel, JSON.stringify(bon, null, 2) + '\n', { mode: 0o600 });
}

function schrijfBon(images, productie) {
  fs.mkdirSync(RELEASE_MAP, { recursive: true });
  const gemaakt = new Date().toISOString();
  const naam = 'uitrol-' + gemaakt.replace(/[:.]/g, '-') + '.json';
  const bon = { formaat: 'rtg-uitrol-v1', gemaakt, releaseSha256: releaseHash(),
    productieStatusSha256: productie && productie.bewijsSha256 || null,
    productieCommit: productie && productie.commit || null, images };
  const doel = path.join(RELEASE_MAP, naam);
  fs.writeFileSync(doel, JSON.stringify(bon, null, 2) + '\n', { mode: 0o600 });
  return { bon, doel };
}

function herstel(bon) {
  valideerBon(bon);
  let aantal = 0;
  for (const dienst of SERVICES) {
    const image = bon.images[dienst];
    if (!image) continue;
    for (const tag of image.tags) voer('docker', ['image', 'tag', image.id, tag]);
    aantal += 1;
  }
  if (!aantal) throw new Error('Deze bon hoort bij een eerste uitrol en bevat geen vorig image.');
  /* Een teruggezette image krijgt zijn EIGEN bewijs-pin, nooit die van de
     mislukte nieuwe release. Anders zou een gezonde rollback onterecht rood
     staan of, erger, zou iemand waarschuwingen als normale rollbackruis leren
     negeren. Oude images zonder bewijs blijven herstelbaar, maar melden dat. */
  if (bon.images.app) {
    try { process.env.RTG_RELEASE_BEWIJS_SHA256 = bewijsPinVanImage(bon.images.app.id).pin; }
    catch (e) {
      delete process.env.RTG_RELEASE_BEWIJS_SHA256;
      console.warn('[uitrol] vorig app-image heeft geen leesbaar releasebewijs; de live controle meldt dit na rollback.');
    }
  }
  compose(['up', '-d', '--no-build', '--wait', ...SERVICES]);
  if (bon.images.sentinel || bon.images.app)
    compose(['exec', '-T', 'sentinel', '/app/rtg-sentinel', 'ctl', 'scan']);
  return aantal;
}

function eisEnv() {
  if (!fs.existsSync(ENV)) throw new Error('.env.productie ontbreekt; draai eerst npm run productie:installeer.');
  if (process.platform !== 'win32' && (fs.statSync(ENV).mode & 0o077))
    throw new Error('.env.productie is leesbaar voor anderen; zet rechten 600.');
}

function eisReleasebronOngewijzigd(commit) {
  const huidig = cp.spawnSync('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: ROOT, encoding: 'utf8'
  });
  if (huidig.error || huidig.status !== 0 || String(huidig.stdout || '').trim() !== commit)
    throw new Error('De Git-commit veranderde tijdens de productieproef.');
  const vuil = require('./lib/stempel').vuileBoom();
  if (!vuil) throw new Error('De releasebron kon na de productieproef niet opnieuw worden vastgesteld.');
  if (vuil.code.length) {
    throw new Error('De productieproef veranderde code buiten de releasecommit: ' +
      vuil.code.slice(0, 5).join(', ') + '.');
  }
  return { commit, bewijsbestanden: vuil.anders.length };
}

function hoofd() {
  if (process.argv.includes('--uitrollen'))
    throw new Error('Deze oude bouw-en-uitrolroute is gesloten; gebruik npm run live:golive, productie:status en daarna live:deploy.');
  eisEnv();
  const terug = process.argv.indexOf('--terug');
  if (terug >= 0) {
    const bestand = process.argv[terug + 1];
    if (!bestand) throw new Error('Gebruik: npm run deploy:terug -- .release/uitrol-...json');
    const bon = JSON.parse(fs.readFileSync(path.resolve(ROOT, bestand), 'utf8'));
    console.log('Herstel ' + herstel(bon) + ' vorige images; datavolumes zijn ongemoeid gelaten.');
    return;
  }
  throw new Error('Gebruik npm run deploy:terug -- .release/uitrol-...json, of live:rollback voor de huidige liveketen.');
}

if (require.main === module) {
  try { hoofd(); } catch (e) { console.error('[uitrol] ' + e.message); process.exitCode = 1; }
}

module.exports = { geldigeImageId, geldigeTag, valideerBon, eisSchoneReleasebron,
  eisReleasebronOngewijzigd, leesProductiestatus, SERVICES, BUILD_SERVICES };
