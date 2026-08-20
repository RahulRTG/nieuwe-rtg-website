'use strict';
/* IS ELK SCHERM ERGENS VANDAAN TE BEREIKEN?

   Een scherm dat bestaat, gekeurd wordt, in de dekking meetelt en waar geen
   enkele weg heen loopt, is geen scherm maar een bestand. Dat is de stilste
   soort dood code: alle meters staan groen.

   HOE DIT MEET. Startpunt is de bank -- MAPPEN, inclusief Instellingen, dat een
   paneel is en geen wereld -- plus /apps/app.html en de RTF-jas. Daarna volgt
   het de verwijzingen tot er niets meer bijkomt.

   VIER DINGEN GINGEN HIER MIS VOORDAT HET GETAL KLOPTE, en ze staan hier omdat
   ze alle vier terugkomen zodra iemand dit herschrijft:

     1. Alleen de vier werelden als startpunt -> Instellingen viel eruit, en
        daarmee ik, veilig, passkeys en juridisch.
     2. Alleen absolute paden -> /apps/foundation/index.html linkt naar zijn
        vierenzestig schermen RELATIEF (`agenda.html`), dus die leken allemaal
        onbereikbaar.
     3. Alleen schermen als bron -> een verwijzing in app-main.js telde voor
        niets, terwijl app.html dat bestand laadt. Een script erft nu de
        bereikbaarheid van elk scherm dat hem insluit, en een bundelsnede erft
        van zijn bundel.
     4. Commentaar telde als verwijzing -> in dit huis staat de geschiedenis in
        de code, en "Was /apps/metier.html" betekent juist dat het weg is.

   Wat dit NIET ziet: een adres dat een script uit stukjes samenstelt. Het is
   dus een ONDERGRENS -- wie hier staat, is werkelijk nergens genoemd. */
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..', '..');
const PUB = path.join(WORTEL, 'public');

function zonderCommentaar(txt, isHtml) {
  let t = txt.replace(/\/\*[\s\S]*?\*\//g, ' ');
  if (isHtml) t = t.replace(/<!--[\s\S]*?-->/g, ' ');
  return t.replace(/^[ \t]*\/\/.*$/gm, ' ');
}

function bestanden(dir, uit) {
  for (const f of fs.readdirSync(dir)) {
    if (f === 'dist') continue;
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) bestanden(p, uit);
    else if (/\.(html|js)$/.test(f)) uit.push(p);
  }
  return uit;
}

/* WIE MET OPZET LOS STAAT, EN WAAROM. Landingspagina's en omleidingen worden
   niet aangetikt maar aangeleverd: met een QR-code op een tafel, met een link
   uit een pas, of vanaf een oud adres dat nog moet blijven werken.

   DIT REGISTER WOONT HIER EN NIET IN DE LEZERS. Het stond in scripts/check.js,
   terwijl test/bereikbaar.test.js zijn eigen lijst in BEREIK.json las -- en die
   twee liepen uit elkaar: festival-gast.html stond netjes hier ingeschreven en
   zakte tegelijk bij de toets, omdat die toets dit register niet kende. Twee
   registers voor een begrip is geen dubbele zekerheid maar een
   meningsverschil. */
const MAG_LOS = new Map([
  ['/apps/berichten.html', 'omleiding: Berichten is een stand van RTG Comm geworden; het pad blijft voor links van buiten'],
  ['/apps/codewoord.html', 'omleiding: Codewoord is een stand van RTG Veilig geworden'],
  ['/apps/thuisrust.html', 'omleiding: Thuisrust is een stand van RTG Veilig geworden'],
  ['/apps/thuiswacht.html', 'omleiding: Thuiswacht is een stand van RTG Veilig geworden'],
  ['/apps/vitaal.html', 'omleiding: Vitaal is een stand van RTG Veilig geworden'],
  ['/apps/metier.html', 'omleiding: Metier is een stand van RTG Geld geworden'],
  ['/apps/gast.html', 'landingspagina: je komt hier door een QR-code op een tafel of kamer te scannen, niet via een link'],
  ["/apps/festival-gast.html", "landingspagina: uw eigen kant van het festival. U komt hier met de pas die u al heeft (de code staat groot in beeld aan de poort) of via de link van uw groep -- niet via de bank. Het ORGANISATIEscherm /apps/festival.html hangt wel gewoon, bij de zaakschermen in de leverancier-app."],
  ["/apps/reisuitnodiging.html", "landingspagina: je komt hier via de link die het reisbureau of een reisgenoot je stuurt. Hem aan de bank hangen zou hem juist verkeerd maken -- de pagina bestaat om een reis over te nemen die IEMAND ANDERS voor je klaarzette (REIZEN.md, kern/reisuitnodiging.js), en zonder die link valt er niets te openen"]
]);

function meet() {
  const { alleSchermen } = require('../schermen');
  const reg = require('./wereldregister');
  const ALLE = alleSchermen();
  const inhoud = new Map(bestanden(PUB, []).map((p) => [p, zonderCommentaar(fs.readFileSync(p, 'utf8'), p.endsWith('.html'))]));

  const start = new Set(['/apps/app.html', '/apps/foundation/index.html']);
  for (const m of reg.MAPPEN) {
    if (m.wereld) start.add(reg.kaal(m.wereld));
    for (const it of m.items || []) {
      const l = reg.los(it);
      if (l.url && l.url.startsWith('/')) start.add(reg.kaal(l.url));
    }
  }

  /* welk scherm laadt welk script */
  const scriptVan = new Map();
  for (const [p, txt] of inhoud) {
    if (!p.endsWith('.html')) continue;
    const scherm = '/' + path.relative(PUB, p);
    for (const m of txt.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/g)) {
      const src = m[1].split('?')[0];
      if (!src.endsWith('.js')) continue;
      const rel = src.startsWith('/') ? src.slice(1)
        : path.posix.join(path.dirname(path.relative(PUB, p)), src);
      if (!scriptVan.has(rel)) scriptVan.set(rel, new Set());
      scriptVan.get(rel).add(scherm);
    }
  }
  const bronSchermen = (rel) => {
    if (scriptVan.has(rel)) return scriptVan.get(rel);
    const m = /^(.*)\/([^/]+)-[0-9]+[a-z]*\.js$/.exec(rel);
    if (m && scriptVan.has(m[1] + '.js')) return scriptVan.get(m[1] + '.js');
    const m2 = /^(.*)\/([^/]+)\/\2-.*\.js$/.exec(rel);
    if (m2 && scriptVan.has(m2[1] + '/' + m2[2] + '.js')) return scriptVan.get(m2[1] + '/' + m2[2] + '.js');
    return null;
  };

  const linktNaar = new Map();
  for (const doel of ALLE) {
    const eigen = path.join(PUB, doel.replace(/^\//, ''));
    const map = path.dirname(eigen), naam = path.basename(doel);
    const s = new Set();
    for (const [p, txt] of inhoud) {
      if (p === eigen) continue;
      const zelfdeMap = path.dirname(p) === map;
      if (txt.includes(doel) || (zelfdeMap && new RegExp('[\'"/]' + naam.replace('.', '\\.')).test(txt))) {
        s.add(path.relative(PUB, p));
      }
    }
    linktNaar.set(doel, s);
  }

  const bereikbaar = new Set([...start].filter((p) => ALLE.includes(p) || p === '/apps/app.html'));
  let gegroeid = true, ronde = 0;
  while (gegroeid && ronde < 8) {
    gegroeid = false; ronde++;
    for (const doel of ALLE) {
      if (bereikbaar.has(doel)) continue;
      let gevonden = false;
      for (const bron of linktNaar.get(doel)) {
        if (bereikbaar.has('/' + bron)) { gevonden = true; break; }
        const via = bron.endsWith('.js') ? bronSchermen(bron) : null;
        if (via) for (const sch of via) if (bereikbaar.has(sch)) { gevonden = true; break; }
        if (gevonden) break;
      }
      if (gevonden) { bereikbaar.add(doel); gegroeid = true; }
    }
  }
  return { totaal: ALLE.length, start: bereikbaar.size, wezen: ALLE.filter((p) => !bereikbaar.has(p)) };
}

module.exports = { meet, zonderCommentaar, MAG_LOS };
