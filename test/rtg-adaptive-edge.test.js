'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const lees = naam => fs.readFileSync(path.join(ROOT, naam), 'utf8');
const kern = require('../public/shared/rtg-adaptive-edge-core.js');
const VIEW = lees('public/shared/rtg-adaptive-edge.js');
const SERVICES = lees('public/shared/rtg-adaptive-edge-services.js');
const VISUAL = lees('public/shared/rtg-adaptive-edge-visual.js');
const CONTROLS = lees('public/shared/rtg-adaptive-edge-controls.js');
const CINEMA = lees('public/shared/rtg-adaptive-edge-cinema.js');
const INPUT = lees('public/shared/rtg-adaptive-edge-input.js');
const CSS = lees('public/shared/rtg-adaptive-edge.css');
const LOADER = lees('public/shared/rtg-edge-2-loader.js');
const ADAPTIVE_LOADER = lees('public/shared/rtg-adaptive-edge-loader.js');
const SIGNALS = lees('public/shared/rtg-adaptive-edge-signals.js');
const EDITORIAL = lees('public/shared/rtg-editorial-v4.css');
const SW = lees('public/sw.js');
const APPWERKT = lees('scripts/appwerkt.js');
const MAGNAAT = lees('public/apps/magnaat.html');
const PERSONAL_IMAGES = lees('public/shared/interface/personal-images.js');
const PERSONAL_IMAGE_EDITOR = lees('public/shared/interface/personal-image-editor.js');
const DESKTOP_FRAME = lees('public/shared/interface/world-desktop-frame.js');

test('Adaptive Edge heeft vier toestanden en zeven swipebare decks', () => {
  assert.deepEqual(kern.STATES, ['peek', 'dock', 'deck', 'expanded']);
  assert.deepEqual(kern.DECKS, ['home', 'apps', 'object', 'context', 'actions', 'connect', 'rahul']);
  assert.equal(kern.nextDeck('home', 1), 'apps');
  assert.equal(kern.nextDeck('home', -1), 'rahul');
  assert.equal(kern.nextDeck('rahul', 1), 'home');
  assert.equal(kern.normState('onbekend'), 'dock');
  assert.equal(kern.presence('peek'), 'idle');
  assert.equal(kern.presence('dock'), 'active');
  assert.equal(kern.presence('deck'), 'contextual');
  assert.equal(kern.presence('expanded'), 'expanded');
  assert.equal(kern.presence('expanded', 'focus'), 'immersive');
  assert.deepEqual(kern.view('peek', 'quiet'), {
    state: 'peek', automatic: true, motion: 'quiet', presence: 'idle'
  });
  assert.deepEqual(kern.view('peek', 'auto'), {
    state: 'peek', automatic: true, motion: 'reading', presence: 'idle'
  });
});

/* HET BLAD HEEFT GEEN EIGEN LIJST MEER (EDGE.md par. 11, ronde 2 stap 17 en 18).
   Er stond een tweede register naast RTGAdaptief met zeven vaste
   snelkoppelingen; die zijn weg (besluit K-bladlijst) en het register met hen.
   Een verhinderde handeling met haar reden woont nu alleen in
   adaptief/balkknop.js. DE MUTATIES, elk nagetrokken: zet K.defaults terug in
   start() (toets 1 en 2 zakken), en zet de registratie in signals.js terug
   (toets 2 zakt). De vorm van de API bewaakt test/edgeregister-leeg.test.js. */
test('na een verse start draagt de Edge-kern geen handelingen', () => {
  const model = kern.model();
  const snap = kern.momentopname();
  assert.equal(snap.acties, undefined, 'de momentopname kent geen acties meer');
  assert.equal(model.registry, undefined, 'het model heeft geen register');
  assert.doesNotMatch(VIEW, /K\.defaults\(|K\.actions\(|model\.registry/, 'het blad vult geen eigen lijst');
});

test('de hoofdactie wordt niet meer als snelkoppeling geregistreerd; de voortgang blijft', () => {
  assert.doesNotMatch(SIGNALS, /registerAction\(/, 'signals.js registreert de hoofdactie niet meer');
  assert.match(SIGNALS, /api\.setPresence\(/, 'de voortgangsmelding blijft');
  assert.doesNotMatch(VIEW, /K\.defaults\(/);
});

test('appbediening die de Edge overneemt behoudt haar app-herkomst', () => {
  const appRoots = CONTROLS.match(/var APP='([^']+)'/);
  assert.ok(appRoots, 'de appbronnen moeten expliciet afgebakend zijn');
  for (const selector of ['.rtm-nav', '.mv-navigatie', '.roomrail', '.rolechoice', '.rtd-dossieracties', '.rtd-besluitacties']) {
    assert.ok(appRoots[1].includes(selector), selector + ' ontbreekt als appbron');
    assert.ok(APPWERKT.includes(selector + ' button'), selector + ' ontbreekt in de Edge-opener van APPWERKT');
  }
  assert.ok(appRoots[1].includes('[data-rtg-platform-chrome]'),
    'app-eigen suitenavigatie moet via dezelfde Edge bedienbaar blijven');
  assert.ok(!appRoots[1].includes('[data-rtg-edge-controls]'), 'universele Edge-bediening is geen appbediening');
  assert.match(CONTROLS, /if\s*\(src\.app\)\s*b\.dataset\.rtgAdaptiveControl\s*=\s*'app'/);
  assert.doesNotMatch(CONTROLS, /RTGDesktopFrame\.controls\(c, srcButtons\)\) return/,
    'een actieve desktopwerkplek mag de bediening van haar host niet verdringen');
  assert.match(CONTROLS, /'aria-haspopup'/, 'een gekloonde dialoogopener behoudt zijn semantiek');
  assert.match(CONTROLS, /el\.innerText\|\|el\.textContent/,
    'Edge-labels behouden zichtbare woordgrenzen tussen geneste tekstelementen');
  assert.match(CONTROLS, /el\.href\?'route:'\+el\.href:'control:'\+lbl\(el\)/,
    'een gekloonde navigatielink behoudt een route-identiteit over tekst- en framewissels');
  assert.match(APPWERKT, /el\.id \|\| el\.getAttribute\('data-rtg-adaptive-source'\)/,
    'de bron en haar Edge-kloon moeten als dezelfde handeling tellen');
  assert.match(APPWERKT, /replace\(\/\\s\+\/g, ' '\)\.trim\(\)/,
    'verschillen in tekstlayout mogen een Edge-kloon niet als tweede handeling tellen');
  assert.match(APPWERKT, /rtgAdaptiveState === 'expanded'[\s\S]{0,180}setState\('dock'\)/,
    'na de laatste appkloon sluit de meter de Edge voor de volgende paginaactie');
  assert.match(APPWERKT, /Number\(!hoofdactie\(a\)\) - Number\(!hoofdactie\(b\)\)[\s\S]{0,500}Number\(!edgeApp\(a\)\) - Number\(!edgeApp\(b\)\)/,
    'een primaire schermactie wordt aangeraakt voordat een Edge-actie haar toestand kan vervangen');
  assert.match(APPWERKT, /onbewezenMerken\(\)\.length === 0/,
    'Edge-dialoogopeners worden pas herhaald nadat alle bekende paginaacties werkelijk zijn aangeraakt');
  assert.match(APPWERKT, /RTGDesktopFrame\.isOpen[\s\S]{0,260}!desktopOpen/,
    'een open DesktopFrame blijft de publieke heropenroute naar zijn Edge-acties');
  assert.match(DESKTOP_FRAME, /rtgAdaptiveSource = 'desktop-item:' \+ item\.id[\s\S]{0,80}rtgAdaptiveRoute = 'true'/,
    'DesktopFrame-secties dragen een stabiele bron en herhaalbare standroute');
  assert.match(DESKTOP_FRAME, /rtgAdaptiveControl = 'app'/,
    'bediening uit het actieve appframe blijft als appbediening herkenbaar');
  assert.match(DESKTOP_FRAME, /el\.tagName === 'A'[\s\S]{0,100}rtgAdaptiveRoute = 'true'/,
    'een app-link in DesktopFrame blijft een herhaalbare route naar zijn bediening');
  assert.match(APPWERKT, /\[data-rtg-adaptive-route\]/,
    'APPWERKT kan een DesktopFrame-sectie opnieuw openen voor een resterende actie');
  assert.match(APPWERKT, /if \(!k\.edgeApp\)[\s\S]{0,400}RTGAdaptiveEdge\.setState\('dock'\)/,
    'een gewone paginaactie sluit eerst een nog uitgeklapt appdeck');
  assert.match(APPWERKT, /behoudHuidigeStand = !vervolg\.klaar/,
    'nieuwe vervolgbediening blijft zichtbaar voordat het Edge-deck opnieuw opent');
  assert.match(APPWERKT, /data-bweg[\s\S]{0,300}upload\|bestand kiezen/,
    'verwijderen en de systeembestandskiezer komen na gewone paneelbediening');
  assert.match(APPWERKT, /Number\(!hoofdopener\(a\)\)[\s\S]{0,160}Number\(!dialoogOpener\(a\)\)[\s\S]{0,160}Number\(!standNavigatie\(a\)\)/,
    'een onafgewerkte dialoog wordt vóór algemene standnavigatie heropend');
  assert.match(APPWERKT, /heropenGeslotenDialoog = !nogModaal/,
    'een gesloten dialoog met resterende bekende bediening wordt meteen heropend');
  assert.match(APPWERKT, /const geraakt = document\.querySelector\('\[data-appwerkt="1"\]'\)[\s\S]{0,100}!geraakt\.disabled/,
    'een asynchrone modale actie bereikt een stabiele open of gesloten stand');
  assert.match(APPWERKT, /querySelectorAll\('\[aria-haspopup="dialog"\]'\)[\s\S]{0,220}timeout: 1500/,
    'de publieke dialoogopener mag na opslag één rendercyclus terugkeren');
  assert.match(APPWERKT, /waitForEvent\('filechooser'/,
    'de meter wacht op de echte systeembestandskiezer');
  assert.match(APPWERKT, /chooser\.setFiles\(\[\]\)/,
    'de geopende systeembestandskiezer wordt gecontroleerd geannuleerd');
  assert.match(APPWERKT, /async function markeerBekendeDialoogopener/,
    'meerdere slotacties gebruiken opnieuw dezelfde zichtbare dialoogopener');
  assert.match(APPWERKT, /await page\.click\('\[data-appwerkt="1"\]'/,
    'ook een heropende dialoogroute gebruikt de gewone browserklik');
  assert.match(APPWERKT, /annuleer\|annuleren\|cancel/,
    'annuleren sluit een dialoog pas nadat de overige bediening is aangeraakt');
  assert.match(PERSONAL_IMAGES, /button\.setAttribute\('aria-haspopup', 'dialog'\)/,
    'de beeldbewerker is als heropenbare dialoog herkenbaar voor gebruiker en meter');
  assert.match(PERSONAL_IMAGE_EDITOR, /save\.dataset\.dialogResult = 'save'/,
    'Opslaan publiceert dat het de beeldbewerker bij succes afsluit');
  assert.match(MAGNAAT, /padding-bottom:calc\((?:2|3)rem \+ var\(--rtg-adaptive-inset,0px\)\)/,
    'lange Magnaat-schermen reserveren de echte Edge-inset voor hun laatste actie');
});

test('de Edge toont geen generieke foutmelding naast contextuele bediening', () => {
  assert.doesNotMatch(VIEW, /Voor deze context zijn geen veilige acties beschikbaar/);
  assert.match(VIEW, /if \(rt\.renderControls\) rt\.renderControls\(\)/);
  assert.match(VIEW, /Services\.modes\(rt\)/);
});

test('de uitvoerder van de Edge kent geen window.confirm meer (vorm; het gedrag bewijst edgeblikveld.e2e.js)', () => {
  assert.doesNotMatch(VIEW, /confirm\(/);
});

test('een expliciete hostactie wint van het generieke contextblad', () => {
  const host = VIEW.indexOf("if (rt.edge.onEdgeAction && rt.edge.onEdgeAction(action) === true) return true;");
  const generic = VIEW.indexOf("if (action === 'context' || action === 'primary')");
  assert.ok(host >= 0 && host < generic, 'de gedeelde Edge hoort eerst de actie van zijn host uit te voeren');
});

test('één zwevend oppervlak vervangt de oude zichtbare onderrand', () => {
  assert.match(CSS, /data-rtg-adaptive-ready="true"\] \.rtg-edge-bottom\{display:none!important\}/);
  assert.match(CSS, /width:min\(720px,calc\(100% - var\(--edge-side\) - var\(--rtg-safe-left\) - var\(--rtg-safe-right\) - 28px\)\)/);
  assert.match(CSS, /max-height:min\(620px,calc\(100dvh - var\(--rtg-adaptive-inset\) - var\(--rtg-safe-top\) - 16px\)\)/);
  assert.match(CSS, /grid-template-columns:repeat\(5,minmax\(44px,1fr\)\)/);
  assert.match(CSS, /\.rtg-adaptive-item\{[^}]*min-width:44px;min-height:54px/);
  assert.match(CSS, /backdrop-filter:blur\(24px\) saturate\(1\.3\)/);
  assert.match(CSS, /background:var\(--edge-bar-bg\)/);
  assert.match(CSS, /--edge-bar-accent:var\(--rtg-world-metal,#ebcc94\)/);
  assert.match(SERVICES, /class="rtg-adaptive-lips"/);
  assert.doesNotMatch(SERVICES, /rtg-adaptive-lips[^\n]+(?:circle|ellipse)/);
  assert.doesNotMatch(VIEW, /rtg-adaptive-caption/);
  assert.match(CSS, /data-rtg-adaptive-state="peek"[^}]*width:136px;height:50px/);
  assert.doesNotMatch(VIEW, /Mandaat gecontroleerd/);
  assert.match(VIEW, /Controle bij uitvoering/);
  assert.match(CSS, /\.rtg-adaptive-sheet \.rtg-edge-2-context-slot :is\([^}]+grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(CSS, /\.scrim\.open\[role="dialog"\]/);
  assert.match(CSS, /\.hv-balk:not\(\.hv-weg\)/);
  assert.doesNotMatch(CSS, /grid-template-columns:minmax\(108px,1fr\)/,
    'desktop krijgt geen tweede Edge-geometrie');
  assert.match(VISUAL, /rtg-adaptive-item-copy/);
  assert.match(VISUAL, /Vraag of regel iets/);
});

test('swipe, hold, toetsenbord en haptiek delen dezelfde invoerlaag', () => {
  assert.match(INPUT, /pointerdown/);
  assert.match(INPUT, /pointermove/);
  assert.match(INPUT, /pointerup/);
  assert.match(INPUT, /lastX = event\.clientX; lastY = event\.clientY/);
  assert.match(INPUT, /event \? event\.clientY : lastY/);
  /* De drempels zelf staan in de grammatica (test/drempels.test.js); hier alleen
     dat de invoerlaag ze leest en geen eigen getal draagt. */
  assert.match(INPUT, /-dy >= D\.omhoog/);
  assert.match(INPUT, /dy > D\.veeg/);
  assert.match(INPUT, /\}, D\.lang\);/);
  assert.match(INPUT, /handlers\.rahul\(\)/);
  assert.match(INPUT, /Alt|altKey/);
  assert.match(INPUT, /metaKey \|\| event\.ctrlKey/);
  assert.match(INPUT, /toLowerCase\(\) === 'k'/);
  assert.match(INPUT, /navigator\.vibrate\(8\)/);
  assert.match(INPUT, /listen\(rt\.doc, 'scroll'/);
  assert.match(INPUT, /handlers\.state\(delta > 0 \? 'peek' : 'dock', 'auto'\)/);
});

test('Adaptive Edge laadt fail-closed na de bestaande Edge en is offline aanwezig', () => {
  const bronnen = ['/shared/rtg-adaptive-edge-loader.js'];
  const adaptieveBronnen = ['/shared/rtg-adaptive-edge.css', '/shared/rtg-adaptive-edge-core.js',
    '/shared/rtg-adaptive-edge-controls.js', '/shared/rtg-adaptive-edge-input.js', '/shared/rtg-adaptive-edge-surface.js', '/shared/rtg-adaptive-edge-services.js', '/shared/rtg-adaptive-edge.js', '/shared/rtg-adaptive-edge-signals.js',
    '/shared/rtg-adaptive-edge-visual.js', '/shared/rtg-adaptive-edge-cinema.js',
    '/shared/adaptief/grammatica.js', '/shared/edge/actiestaat.js', '/shared/edge/blikveld-hoofdactie.js', '/shared/edge/blikveld.js'];
  for (const bron of bronnen) {
    assert.ok(LOADER.includes(bron), bron + ' ontbreekt in de loader');
    assert.ok(SW.includes(bron), bron + ' ontbreekt in de offline schil');
  }
  for (const bron of adaptieveBronnen) {
    assert.ok(ADAPTIVE_LOADER.includes(bron), bron + ' ontbreekt in de adaptieve loader');
    assert.ok(SW.includes(bron), bron + ' ontbreekt in de offline schil');
  }
  const edgeStart = LOADER.indexOf('w.RTGEdge2.start(d, w)');
  const adaptiveStart = LOADER.indexOf('RTGAdaptiveEdgeLoader.start(d, w)', edgeStart);
  assert.ok(edgeStart >= 0 && adaptiveStart > edgeStart);
  assert.match(ADAPTIVE_LOADER, /if \(!vorm\) return/);
  assert.match(ADAPTIVE_LOADER, /if \(!kern\) return/);
  assert.match(ADAPTIVE_LOADER, /if \(!invoer\) return/);
  /* De signaallaag luistert naar niets: vijf luisteraars zonder zender zijn in
     ronde 1 weggehaald (EDGE.md par. 10). Wie een scherm iets laat melden,
     gebruikt de directe API (setIdentity, setPresence, continueWith). */
  assert.doesNotMatch(SIGNALS, /addEventListener\(/);
});

test('alle Adaptive Edge-browsermodules blijven onder de productlimiet', () => {
  for (const naam of ['rtg-adaptive-edge-loader.js', 'rtg-adaptive-edge-core.js', 'rtg-adaptive-edge-controls.js', 'rtg-adaptive-edge-input.js', 'rtg-adaptive-edge-services.js', 'rtg-adaptive-edge-visual.js', 'rtg-adaptive-edge-cinema.js', 'rtg-adaptive-edge.js', 'rtg-adaptive-edge-signals.js']) {
    assert.ok(fs.statSync(path.join(ROOT, 'public/shared', naam)).size < 10 * 1024, naam + ' is te groot');
  }
});

test('beeld, apps, objecten en communicatie zijn toestanden van dezelfde Edge', () => {
  assert.match(VISUAL, /app:travel/);
  assert.match(VISUAL, /rtg-edge-object-thumb/);
  assert.match(VISUAL, /incoming|call/);
  assert.match(VISUAL, /kind==='mail'/);
  assert.match(VISUAL, /kind==='chat'/);
  assert.match(VISUAL, /rtg-edge-visual-action/);
  assert.match(VIEW, /RTGAdaptiveEdgeVisual\.button/);
  assert.match(EDITORIAL, /\.rtg-edge-live__avatar/);
  assert.match(EDITORIAL, /\.rtg-edge-app-icon--photos/);
  assert.match(CINEMA, /rtg-edge-cinema__story/);
  assert.match(CINEMA, /travel-inspiration\.webp/);
  assert.match(CONTROLS, /RTGAdaptiveEdgeCinema\.render\(c,rt\.model\)/);
  assert.match(CINEMA, /Open filmisch RTG-overzicht/);
  assert.doesNotMatch(CINEMA, /rtg-adaptive-bar/,
    'de filmische laag kaapt de universele Rahul-knop niet');
  assert.match(SERVICES, /command\.dataset\.stand==='open'&&command\.querySelector\('\.cmd-vraagvorm'\)/,
    'de bestaande Command-werktafel blijft een directe Rahul-invoer');
});


test('invoerlaag behandelt geneste scroll en verwijdert alle luisteraars bij teardown', () => {
  const vm = require('node:vm');
  class Target {
    constructor() { this.events = new Map(); this.scrollTop = 0; this.style = { removeProperty() {} }; }
    addEventListener(type, fn, options) { this.events.set(type, { fn, options }); }
    removeEventListener(type, fn) { if (this.events.get(type)?.fn === fn) this.events.delete(type); }
    contains() { return false; }
  }
  const doc = new Target(), bar = new Target(), nested = new Target(), states = [];
  const win = { Element: Target, scrollY: 0, setTimeout() { return 1; }, clearTimeout() {} };
  vm.runInNewContext(INPUT, { window: win });
  const rt = { doc, bar, win, host: { dataset: {}, contains() { return false; } },
    edge: { root: { contains() { return false; } } }, model: { state: 'dock' } };
  const cleanup = win.RTGAdaptiveEdgeInput.bind(rt, { state(...args) { states.push(args); } });
  assert.equal(doc.events.get('scroll').options.capture, true, 'nested scrollers require capture');
  nested.scrollTop = 60;
  doc.events.get('scroll').fn({ target: nested });
  assert.deepEqual(states, [['peek', 'auto']]);
  nested.scrollTop = 20;
  doc.events.get('scroll').fn({ target: nested });
  assert.deepEqual(states[1], ['dock', 'auto']);
  rt.model.state = 'expanded'; nested.scrollTop = 100;
  doc.events.get('scroll').fn({ target: nested });
  assert.equal(states.length, 2, 'an open sheet must not disappear while being used');
  assert.ok(bar.events.size >= 5);
  cleanup();
  assert.equal(doc.events.size, 0);
  assert.equal(bar.events.size, 0);
});

test('de volledige Edge blijft standaard zichtbaar en bewaart een raakvlak van 44px', () => {
  assert.doesNotMatch(INPUT, /handlers\.state\('peek',\s*'quiet'\)/);
  assert.doesNotMatch(INPUT, /setTimeout\(function\(\)\{[^}]*handlers\.state\('peek'/);
  assert.match(INPUT, /listen\(rt\.bar,'pointerenter',wake\)/);
  assert.match(INPUT, /listen\(rt\.bar,'pointerleave',quiet\)/);
  assert.match(INPUT, /listen\(rt\.bar,'focusin',wake\)/);
  assert.match(INPUT, /handlers\.state\(delta > 0 \? 'peek' : 'dock', 'auto'\)/);
  assert.match(CSS, /data-rtg-adaptive-ready="true"\] \.rtg-adaptive-edge\[data-rtg-adaptive-presence="idle"\]\{width:88px;height:48px/);
  assert.match(CSS, /data-rtg-adaptive-presence="idle"\][\s\S]+?\.rtg-adaptive-item:nth-child\(3\)\{min-width:44px;min-height:44px/);
  assert.match(CSS, /prefers-contrast:more\)\{\.rtg-adaptive-edge\[data-rtg-adaptive-presence="idle"\]/);
  assert.match(CSS, /@media\(prefers-reduced-motion:reduce\)\{\.rtg-adaptive-edge,\.rtg-adaptive-bar\{transition:none!important\}\}/);
  assert.match(CSS, /env\(safe-area-inset-bottom,0px\)/);
  assert.match(EDITORIAL, /\.rtg-adaptive-bar\{[\s\S]*?height:64px!important/);
  assert.match(EDITORIAL, /@media\(forced-colors:active\)\{\.rtg-v4-header,[\s\S]*?background:Canvas!important/);
});

test('de definitieve editorial laag is centraal; de oude lagen blijven alleen als grondbrug', () => {
  const heritage = lees('public/shared/rtg-heritage.css');
  const basisBron = lees('public/shared/basis/basis-01.js');
  const basis = lees('public/shared/basis.js');
  assert.doesNotMatch(heritage, /rtg-editorial-v4\.css/);
  /* Universele V4 legt papier onder elk scherm; de editoriale systeemlaag
     draagt daaronder nog de tokenbruggen van de oudere schermen. De
     cinematische laag blijft uit: die is een volledige layoutlaag (signatuur,
     Command, werkruimte) en geen contrastbrug (18 oktober 2026). */
  assert.match(heritage, /@import url\('\.\/rtg-editorial-system\.css'\)/);
  assert.doesNotMatch(heritage, /rtg-cinematic-system\.css/);
  assert.match(basisBron, /blad\.href = '\/shared\/rtg-editorial-v4\.css'/);
  assert.match(basisBron, /laadEditorialBlad\(\)/);
  assert.match(basis, /\['rtg-editorial-v4', 'RTGEditorialV4'\]/);
});

test('www bepaalt de vaste kaders van app, header en Edge in editorial v4', () => {
  const heritage = lees('public/shared/rtg-heritage.css');
  const css = lees('public/shared/rtg-editorial-v4.css');
  assert.match(heritage, /--rtg-frame-mobile:16px/);
  assert.match(heritage, /--rtg-header-mobile:64px/);
  assert.match(heritage, /--rtg-edge-mobile-height:64px/);
  assert.match(heritage, /--rtg-edge-desktop-width:660px/);
  assert.match(css, /\.wd-shell\{[^}]*width:min\(calc\(100% - 2 \* var\(--v4-frame\)\),var\(--v4-wide\)\)!important/);
  assert.match(css, /\.rtg-adaptive-bar\{[^}]*inset-inline:clamp\(12px,3vw,24px\)!important;[^}]*max-width:620px!important/);
  assert.match(css, /--edge-bar-bg:rgba\(10,10,9,\.9\)!important/);
  assert.match(css, /border:1px solid rgba\(217,188,137,\.55\)!important/);
});

test('alle vier werelden gebruiken bestaande lokale editorial productiebeelden', () => {
  const css = lees('public/shared/rtg-editorial-v4.css');
  const images = ['living-home.webp', 'travel-inspiration.webp', 'company-technology.webp', 'foundation-care.webp'];
  for (const image of images) {
    const relative = `public/images/editorial/${image}`;
    assert.equal(fs.existsSync(path.join(ROOT, relative)), true, `${relative} ontbreekt`);
    assert.match(css, new RegExp(image.replace('.', '\\.') ));
  }
});

test('de editorial runtime classificeert bestaande schermen en tekent geen tweede Edge', () => {
  const source = lees('public/shared/rtg-editorial-v4.js');
  assert.match(source, /body\.dataset\.rtgEditorialV4 = 'true'/);
  assert.match(source, /var kind = classify/);
  assert.match(source, /body\.dataset\.rtgV4Kind = kind/);
  assert.doesNotMatch(source, /createElement\(['"](?:nav|aside)['"]\)/);
  assert.doesNotMatch(source, /rtg-adaptive-edge[^\n]*createElement/);
});

test('native canvassen krijgen alleen een vaste veilige viewport', () => {
  const source = lees('public/shared/rtg-editorial-v4-model.js');
  const css = lees('public/shared/rtg-editorial-v4.css');
  assert.match(source, /canvas \|\| declared === 'canvas' \|\| declared === 'immersive'/);
  assert.match(css, /data-rtg-v4-kind="canvas"/);
  assert.match(css, /\[data-rtg-native-canvas\]/);
});
