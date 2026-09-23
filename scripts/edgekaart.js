#!/usr/bin/env node
/* ============================================================================
   DE EDGEKAART -- wie in de Edge-lagen schrijft, beslist en leest, en welke
   kanalen nergens aankomen.

   WAAROM. De Edge is in drie rondes gegroeid (casco, Edge 2, de adaptieve balk)
   bovenop de grammatica van shared/adaptief/, en elke ronde kreeg er een eigen
   register, standmachine, wereldbepaling of hoofdactie bij. Stap 0 van RTG Edge
   3.0 is niet bouwen maar weten wie wat bezit. shared/edge/blikveld.js leest de
   werkelijkheid al als EEN projectie; deze kaart zegt welke bestanden die
   werkelijkheid maken, en waar dat dubbel gebeurt.

   TWEE HELFTEN, en ze liegen op verschillende manieren:

     VERKLAARD  KAART hieronder: per bestand een laag, rollen met een CITAAT, en
                verantwoordelijkheden uit een gesloten woordenlijst. De grendel:
                elk citaat moet LETTERLIJK in het bestand staan, anders zakt dit
                script -- een verklaring die niet meer bij de code past, is een
                verouderde kaart. Elk citaat hangt aan het ETIKET waar het over
                gaat, en elk etiket s of b heeft zo'n citaat (zie DRAAGT). En
                elke dubbele eigenaar moet een verklaring in WAAROM hebben, en
                elke verklaring een dubbele eigenaar.
     GEMETEN    per bestand, op de bron ZONDER commentaar (scripts/lib/bron.js):
                globals, events, data-attributen op body/html, opslagsleutels en
                fetch-paden. Plus de dode kanalen over heel public/, en drie
                AFGELEIDE controles die de verklaring aan de code houden: wie het
                tweede register vult, wie de wereld en wie de Edge 2-stand op
                body zet, staat erop (zie DE AFGELEIDE CONTROLES).

   WAT HET NIET DOET. Het oordeelt niet of een dubbele eigenaar fout is -- dat
   beslist een mens. Het leest alleen LETTERLIJKE namen; een naam die wordt
   samengesteld, komt onder `dynamisch` en wordt niet geraden. Een wrapper als
   emit(naam) wordt EEN niveau diep gevolgd, en een lus over een lijst letterlijke
   namen ook; verder niet. Een attribuut via een alias of CONTRACT-veld heet
   `(dynamisch)`. Het voert niets uit.

   Draai:  node scripts/edgekaart.js             (schrijft EDGEKAART.json)
           node scripts/edgekaart.js --controle  (zakt als het register achterloopt)
           node scripts/edgekaart.js --stil      (alleen de samenvattingsregel)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');
const { zonderCommentaar, stukken } = require('./lib/bron');
const { bundels } = require('./bundel');

const WORTEL = path.join(__dirname, '..');
const UIT = path.join(WORTEL, 'EDGEKAART.json');
const LAGEN = ['grammatica-kern', 'grammatica-render', 'trust', 'brug', 'adaptieve-balk', 'edge-casco',
  'edge-2', 'schil', 'continuiteit', 'blikveld', 'afnemer', 'laden'];
const ROLLEN = ['schrijft', 'leest', 'projecteert', 'beslist', 'rendert', 'bewaart'];
const NAMEN = ['capability-register', 'vluchtige-context', 'wereld', 'identiteit', 'presence', 'trust-rail',
  'voortzetting', 'hoofdactie', 'gewicht', 'waarom', 'zichtbaarheidsstand', 'onderbalk', 'bevoegdheid',
  'gebaar-drempel'];
const ALS = { s: 'schrijver', b: 'beslisser', l: 'lezer' };

/* WELKE ROL WELK ETIKET KAN DRAGEN. Een citaat hangt aan precies een etiket
   ('naam:letter'), of zegt met '-' dat het over geen van de veertien namen gaat
   (een lader, een icoonpad, een stap in de geschiedenis).

   Dit is de tabel, uitgeschreven omdat de vier rollen tussen schrijven en lezen
   anders dubbelzinnig zijn:
     schrijft     s, of l als het de toestand van een ander voedt via diens API
     beslist      b, of l als het een beslissing van het domein is die via de
                  API van de eigenaar binnenkomt (Office die delen verhindert)
     rendert      s als het de toestand zelf maakt (de knop, de balk), l als het
                  die van een ander toont
     projecteert  s als het de toestand zelf afleidt (een eigen strook), l als het
                  hem uit een ander leest
     bewaart      s als het zijn eigen opslag houdt, l via die van een ander
     leest        alleen l
   Wat geen rol kan: een lezing maakt niemand eigenaar, een schrijfhandeling is
   geen beslissing, en een beslissing is geen schrijver.

   Waarom het etiket aan het citaat hangt en niet los ernaast: toen ze los
   stonden, verlaagde het weghalen van alleen een etiket de schuld zonder een
   enkele keurfout (EDGE.md par. 1). Nu staat het citaat er nog en wijst het naar
   een etiket dat er niet meer is. */
const DRAAGT = { schrijft: 'sl', beslist: 'bl', rendert: 'sl', projecteert: 'sl', bewaart: 'sl', leest: 'l' };

/* DE VERKLARING. [pad, laag, 'naam:letters', rollen], en elke rol is
   [rol, etiket, wat, citaat]. Een pad zonder public/ ervoor woont in
   public/shared/. s = schrijver (houdt of zet de toestand ZELF), b = beslisser
   (kiest de uitkomst), l = lezer (leest haar, of voedt haar via de API van de
   eigenaar -- wie via declareer of setPresence schrijft, is geen eigenaar). Een
   uitzondering, met opzet: wie het TWEEDE register vult (registerAction op de
   Edge-kern), staat er als schrijver op. Dat register moet leeg (ronde 2), en
   alleen zo ziet de kaart wie het nog vult. */
const KAART = [
  ['adaptief.js', 'grammatica-kern', 'capability-register:b gewicht:b', [
    ['schrijft', '-', 'de leer als globale', 'root.RTGAdaptiefLeer = leer;'],
    ['beslist', 'capability-register:b', 'keuring: bureau wel, telefoon niet', 'if (opBureau && !(c.vormen.telefoon || []).length) {'],
    ['beslist', 'gewicht:b', 'standaardgewicht licht', "c.gewicht = (spec && spec.gewicht) || 'licht';"]]],
  ['adaptief/register.js', 'grammatica-kern', 'capability-register:s vluchtige-context:sb gewicht:l waarom:b', [
    ['schrijft', 'capability-register:s', 'declaratie, laatste wint', 'caps[c.id] = c;'],
    ['schrijft', 'vluchtige-context:s', 'context naar de luisteraars', 'luisterCtx.slice().forEach(function (f) { try { f(nu); } catch (e) {} });'],
    ['beslist', 'vluchtige-context:b', 'slikt een gelijke context', 'if (v.sleutel === nu.sleutel) return nu;'],
    ['leest', 'gewicht:l', 'zonder grammatica een gebrek; het gewicht blijft', "if (!gram && c.gewicht && c.gewicht !== 'licht') {"],
    ['beslist', 'waarom:b', 'verhinderd gaat niet door', 'return !((st && st.verhinderd) || c.verhinderd);']]],
  ['adaptief/grammatica.js', 'grammatica-kern', 'gewicht:sb waarom:sb gebaar-drempel:s', [
    ['schrijft', 'gewicht:s', 'de vijf trappen', 'var GEWICHT = {'],
    ['beslist', 'gewicht:b', 'terug zonder weg terug is bewust', "return g === 'terug' && !kanTerug ? 'bewust' : g;"],
    ['schrijft', 'waarom:s', 'de vijf bronnen van een verhindering', 'var BRONNEN = {'],
    ['beslist', 'waarom:b', 'onbekende bron wordt toestand', "var bron = BRONNEN[v.bron] ? v.bron : 'toestand';"],
    ['schrijft', 'gewicht:s', 'vasthoudduur per trap', 'var VASTHOUD = { zwaar: 900, plechtig: 1200 };'],
    ['schrijft', 'gebaar-drempel:s', 'de drempels van de gebaren', 'var DREMPELS = { lang: 480, stil: 8, omhoog: 44, diep: 150, veeg: 36, sluit: 90,']]],
  ['adaptief/diepte.js', 'grammatica-render', 'gebaar-drempel:l onderbalk:l capability-register:l', [
    ['leest', 'capability-register:l', 'items uit het register', 'return (w.RTGAdaptief && w.RTGAdaptief.voorNu()) || [];'],
    ['leest', 'gebaar-drempel:l', 'de trekdrempels uit de tabel', 'var EERSTE = D.omhoog, TWEEDE = D.diep;'],
    ['schrijft', 'onderbalk:l', 'trekstand op .cmd-balk', "b.dataset.trek = ver >= TWEEDE ? 'twee' : (ver >= EERSTE ? 'een' : '');"]]],
  ['adaptief/balk.js', 'grammatica-render', 'onderbalk:sb capability-register:l vluchtige-context:l wereld:l', [
    ['rendert', 'onderbalk:s', 'de contextzone in .cmd-balk', "zone.className = 'cmd-acties';"],
    ['beslist', 'onderbalk:b', 'contextacties, anders werelden', 'if (!items.length && !panes().length && !vastBladen)'],
    ['schrijft', 'capability-register:l', 'rij voor de adaptieve Edge', 'o.root.rtgEdgeItems = function () { return laatsteRij.slice(); };']]],
  ['adaptief/balkknop.js', 'grammatica-render', 'gewicht:b waarom:b gebaar-drempel:l', [
    ['beslist', 'waarom:b', 'verhinderd legt uit', 'if (it.verhinderd) { uitleg(it); return; }'],
    ['beslist', 'gewicht:b', 'zonder gewichtlaag alleen licht', "if ((it.gewicht || 'licht') !== 'licht') {"],
    ['leest', 'gebaar-drempel:l', 'lang drukken uit de tabel', 'klok = w.setTimeout(function () { klok = null; uitleg(it); }, D.lang);']]],
  ['adaptief/orb.js', 'grammatica-render', 'gewicht:b waarom:b gebaar-drempel:l capability-register:l', [
    ['beslist', 'waarom:b', 'splitst kan en kan niet', 'kan: items.filter(function (x) { return !x.verhinderd; }),'],
    ['beslist', 'gewicht:b', 'zonder gewichtlaag alleen licht', "if ((it.gewicht || 'licht') !== 'licht') return;"],
    ['leest', 'gebaar-drempel:l', 'lang drukken uit de tabel', 'return g && g.DREMPELS && g.DREMPELS.lang;']]],
  ['adaptief/lagen.js', 'grammatica-render', 'gebaar-drempel:l', [
    ['rendert', '-', 'lade, paneel of taak', "var wortel = el('div', 'rtg-laag rtg-laag-' + soort);"],
    ['leest', 'gebaar-drempel:l', 'de sluitveeg uit de tabel', 'if (y > D.sluit) sluit();'],
    ['schrijft', '-', 'een stap in de geschiedenis', "w.history.pushState({ rtgLaag: ++teller }, '')"]]],
  ['adaptief/vasthoud.js', 'grammatica-render', 'gebaar-drempel:l', [
    ['beslist', '-', 'vol vasthouden bevestigt', 'if (deel >= 1) { stop(); af(); return; }'],
    ['leest', 'gebaar-drempel:l', 'loslaten onder de poging telt niet', 'if (ver <= D.poging) return;']]],
  ['adaptief/gewicht.js', 'trust', 'gewicht:bl waarom:l trust-rail:l gebaar-drempel:l', [
    ['beslist', 'gewicht:b', 'de weg per trap', "if (g === 'bewust') return bewust(it, bev);"],
    ['beslist', 'gewicht:b', 'compensatie is nooit ongedaan maken', "if (cap && cap.herstel === 'compensatie' && it.ongedaan)"],
    ['leest', 'gewicht:l', 'het effectieve gewicht', "var g = gram.effectief(it.gewicht, typeof it.ongedaan === 'function');"],
    ['schrijft', 'trust-rail:l', 'melding achteraf in de rail', 'r.meld({ tekst: tekst, ongedaan: ongedaan });'],
    ['leest', 'gewicht:l', 'vasthoudduur uit de grammatica', "duur: gram.VASTHOUD[plechtigStap ? 'plechtig' : 'zwaar'],"]]],
  ['adaptief/waarom.js', 'trust', 'waarom:sb gewicht:l', [
    ['schrijft', 'waarom:s', 'tweede lijst van de vijf bronnen', 'var BRONWOORD = {'],
    ['beslist', 'waarom:b', 'eigen stap, los of niets aan te doen', "else regel(lijf, 'Hier kunt u zelf niets aan veranderen.', 'wm-stap');"],
    ['projecteert', 'gewicht:l', 'belofte volgt het effectieve gewicht', "regel(lijf, BELOFTE[gram && gram.effectief ? gram.effectief(it.gewicht"]]],
  ['adaptief/rail.js', 'trust', 'trust-rail:sb vluchtige-context:l', [
    ['leest', 'vluchtige-context:l', 'de rail uit de context', 'var uit = (ctx && Array.isArray(ctx.rail) ? ctx.rail : []).slice();'],
    ['leest', '-', 'meet zelf de verbinding', 'if (w.navigator && w.navigator.onLine === false) {'],
    ['beslist', 'trust-rail:b', 'strook weg als er niets is', 'r.hidden = !uit.length && !melding;'],
    ['schrijft', 'trust-rail:s', 'de rail-API', 'w.RTGRail = { teken: teken, zet: zet, meld: meld, wis: wisMelding,']]],
  ['adaptief/brug.js', 'brug', 'vluchtige-context:bl capability-register:l gewicht:b', [
    ['beslist', 'vluchtige-context:b', 'alleen het actieve blad levert', 'if (frame !== actiefFrame()) return;'],
    ['schrijft', 'capability-register:l', 'herdeclareert met een postbode', 'A.declareer({ id: c.id, naam: c.naam, label: c.label, groep: c.groep'],
    ['beslist', 'gewicht:b', 'standaard licht over de grens', "gewicht: c.gewicht || 'licht',"],
    ['schrijft', 'vluchtige-context:l', 'zet de context bovenin', 'A.context(ctx);']]],
  ['rtg-adaptive-edge.js', 'adaptieve-balk', 'presence:s identiteit:s voortzetting:s zichtbaarheidsstand:sb onderbalk:s capability-register:l vluchtige-context:l', [
    ['schrijft', 'presence:s', 'presence in het eigen model', 'rt.model.presence = input && input.label ?'],
    ['schrijft', 'identiteit:s', 'identiteit in het eigen model', 'rt.model.identity = acting ?'],
    ['schrijft', 'voortzetting:s', 'voortzetting in het eigen model', 'rt.model.continuation = input && input.title ?'],
    ['schrijft', 'zichtbaarheidsstand:s', 'balkstand op body', 'd.body.dataset.rtgAdaptiveState = rt.model.state;'],
    ['beslist', 'zichtbaarheidsstand:b', 'Edge 2 compact wordt peek', "else if (state === 'compact') setState('peek', 'auto');"],
    ['schrijft', 'onderbalk:s', 'klaar-vlag; CSS zet de onderbalk weg', "d.body.dataset.rtgAdaptiveReady = 'true';"],
    ['leest', 'capability-register:l', 'een tik op het tweede register via de kern', 'if (custom && custom.run) return K.voer(custom, w);']]],
  ['rtg-adaptive-edge-core.js', 'adaptieve-balk', 'capability-register:sb bevoegdheid:b zichtbaarheidsstand:b gewicht:bl', [
    ['schrijft', 'capability-register:s', 'tweede register, laatste wint', 'state.registry[id] = { id: id'],
    ['beslist', 'gewicht:b', 'alleen licht in dit register', "if (item.confirm || (item.gewicht && item.gewicht !== 'licht')) {"],
    ['leest', 'gewicht:l', 'een tik langs de gewichtlaag', "return w.RTGGewicht.voer({ id: e.id, naam: e.label, gewicht: 'licht', doe: e.run })"],
    ['beslist', 'capability-register:b', 'ids buiten het patroon eruit', 'if (!state || !/^[a-z][a-z0-9-]{1,39}$/.test(id)) return false;'],
    ['beslist', 'bevoegdheid:b', 'allowed: boolean of functie', "typeof item.allowed === 'function' ? !!item.allowed()"],
    ['beslist', 'zichtbaarheidsstand:b', 'vier balkstanden', "var STATES = Object.freeze(['peek', 'dock', 'deck', 'expanded']);"]]],
  ['rtg-adaptive-edge-controls.js', 'adaptieve-balk', 'capability-register:bl hoofdactie:s vluchtige-context:l', [
    ['leest', 'capability-register:l', 'handelingen via het blikveld', 'if (w.RTGEdgeBlikveld) return w.RTGEdgeBlikveld.acties();'],
    ['beslist', 'capability-register:b', 'welke paginaknop geoogst wordt', 'if (label(el) && available(el, root) && (!tab || !tabs.has(tab))'],
    ['rendert', 'hoofdactie:s', 'verhuist de hoofdactie in het blad', 'rt.primarySlot = primary; rt.sheet.appendChild(primary);'],
    ['rendert', 'vluchtige-context:l', 'bladtitel uit RTGAdaptief', 'if (A && A.context().titel) rt.sheetTitle.textContent = A.context().titel;']]],
  ['rtg-adaptive-edge-input.js', 'adaptieve-balk', 'gebaar-drempel:l zichtbaarheidsstand:bl capability-register:l', [
    ['leest', 'gebaar-drempel:l', 'veeg opzij wisselt deck, drempel uit de tabel', 'if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > D.veeg)'],
    ['leest', 'gebaar-drempel:l', 'lang drukken uit de tabel', '}, D.lang);'],
    ['beslist', 'zichtbaarheidsstand:b', 'auto-peek bij scrollen', "if (moved < 8 || rt.manual || rt.model.state === 'expanded') return;"],
    ['leest', 'zichtbaarheidsstand:l', 'de gebaarversheid van Edge 2, alleen waar Edge 2 draait', 'if (gebaar && !e2.gestureFresh(gebaar)) return;'],
    ['beslist', 'zichtbaarheidsstand:b', 'omhoog naar RTGDiepte', 'if (-dy >= D.diep) depth.tweede(); else depth.eerste();']]],
  ['rtg-adaptive-edge-loader.js', 'laden', '', [
    ['beslist', '-', 'overslaan als de global bestaat', 'if (global && w[global]) { done(true); return; }'],
    ['schrijft', '-', 'start de Edge na de keten', 'w.RTGAdaptiveEdge.start(d, w);']]],
  ['rtg-adaptive-edge-signals.js', 'adaptieve-balk', 'presence:b hoofdactie:l capability-register:s', [
    ['leest', 'hoofdactie:l', 'eenmalig de hoofdactie', "knop = d.querySelector('[data-rtg-edge-primary]:not([hidden])');"],
    ['schrijft', 'capability-register:s', "'primary' in het tweede register", "api.registerAction({ id: 'primary', label: label.slice(0, 80), allowed: !knop.disabled });"],
    ['beslist', 'presence:b', 'pending wordt presence', "if (staat === 'pending') api.setPresence({ label: label + ' wordt uitgevoerd'"]]],
  ['rtg-adaptive-edge-claim.js', 'adaptieve-balk', 'onderbalk:sb', [
    ['beslist', 'onderbalk:b', 'alleen vaste of plakkende balken', "if (stijl.position !== 'fixed' && stijl.position !== 'sticky') return false;"],
    ['schrijft', 'onderbalk:s', 'markeert de geclaimde balken', 'winnaars.forEach(function (el) { el.classList.add(EIGEN); });']]],
  ['rtg-edge-system.js', 'edge-casco', 'wereld:sb vluchtige-context:s hoofdactie:s', [
    ['beslist', 'wereld:b', 'wereld: gevraagd, anders work', "var key = o.world || 'work', cfg = C[key] || C.work;"],
    ['schrijft', 'wereld:s', 'wereld op body', 'd.body.dataset.rtgWorld = key;'],
    ['schrijft', 'vluchtige-context:s', 'eigen context', 'A.ctx = Object.assign({}, A.ctx, c || {});'],
    ['schrijft', 'hoofdactie:s', 'tekst van de hoofdactie', 'hoofdactie.hidden = !hoofdtekst; hoofdactie.textContent = hoofdtekst;']]],
  ['rtg-edge-library.js', 'edge-casco', 'hoofdactie:s onderbalk:s trust-rail:sb wereld:l', [
    ['rendert', 'hoofdactie:s', 'de hoofdactieknop', '<div class="rtg-edge-action"><button type="button" data-rtg-edge-primary></button></div>'],
    ['rendert', 'onderbalk:s', 'de onderbalk van de casco', '<footer class="rtg-edge-bottom">'],
    ['leest', '-', 'peilt gereedheid', "fetch('/api/ready', { cache: 'no-store' })"],
    ['beslist', 'trust-rail:b', 'Beveiligd, TEST of Beperkt', "magnaat ? 'TEST' : ok ? 'Beveiligd' : 'Beperkt';"],
    ['schrijft', 'trust-rail:s', 'eigen gezondheidsvlag op de statusknop', "state.parentNode.dataset.edgeHealth = state.textContent === 'Beveiligd' ? 'ok' : 'waiting';"],
    ['projecteert', 'wereld:l', 'vaste wereldvolgorde', "var ORDE = ['living', 'work', 'travel', 'foundation'];"]]],
  ['rtg-edge-worlds.js', 'edge-casco', 'wereld:s', [
    ['schrijft', 'wereld:s', 'wereldcatalogi naast MAPPEN', 'w.RTGEdgeWorlds = {'],
    ['projecteert', 'wereld:s', 'rail uit ids, onbekend valt stil weg', 'meta.tools = rail.map(function (id) { return alles.find(']]],
  ['rtg-edge-icons.js', 'edge-casco', '', [
    ['schrijft', '-', 'gedeelde icoonpaden', 'w.RTGEdgeIcons = {']]],
  ['rtg-edge-appbar.js', 'edge-casco', 'onderbalk:sb', [
    ['beslist', 'onderbalk:b', 'welke paginabalk mee gaat', "return el.hasAttribute('data-rtg-edge-bar') || (el.parentElement === d.body"],
    ['rendert', 'onderbalk:s', 'verhuist de balk zelf', 'rt.slot.appendChild(el);'],
    ['schrijft', 'onderbalk:s', 'de Edge bezit een appbalk', "rt.body.setAttribute('data-rtg-edge-appbar', 'true');"]]],
  ['rtg-edge-command.js', 'edge-casco', 'onderbalk:sb', [
    ['beslist', 'onderbalk:b', 'neemt het menu tot 999 px', "var media = venster.matchMedia('(max-width:999px)')"],
    ['schrijft', 'onderbalk:s', 'claimt de menuknop', "menu.setAttribute('data-rtg-command-owner', 'true');"]]],
  ['rtg-edge-preferences.js', 'edge-casco', 'onderbalk:bl voortzetting:l', [
    ['beslist', 'onderbalk:b', 'layoutknop weg buiten de werkruimte', "if (!e.workspace) e.root.querySelector('.rtg-edge-layout').hidden = true;"],
    ['schrijft', 'onderbalk:l', 'contexttoken voor Edge 2', "w.RTGEdge2.registerContext(tokens.concat('world-shell'));"],
    ['bewaart', 'voortzetting:l', 'dichtheid via de routecontext', 'if (w.RTGRouteMemory) w.RTGRouteMemory.save();']]],
  ['rtg-edge-smart-menu/rtg-edge-smart-menu-00.js', 'edge-casco', 'wereld:b voortzetting:sb onderbalk:l', [
    ['beslist', 'wereld:b', 'het blad gaat voor de casco', "var cfgBlad = blad !== 'geen' && w.RTGEdgeWorlds && w.RTGEdgeWorlds[blad];"],
    ['bewaart', 'voortzetting:s', 'recent bij elke lezing', 'sessionStorage.setItem(OPSLAG, nu);'],
    ['beslist', 'voortzetting:b', 'geen vorige: de publieke ingang', "vorige = cfg ? cfg.huis || cfg.home : '/apps/app.html';"],
    ['leest', 'onderbalk:l', 'appbalken als lokale acties', "root.querySelectorAll('.rtg-edge-appslot .rtg-edge-owned-bar a[href]"]]],
  ['rtg-edge-smart-menu/rtg-edge-smart-menu-01.js', 'edge-casco', 'wereld:l', [
    ['beslist', 'wereld:l', 'Heel RTG thuis, Hier elders', "gezicht(rt, wereldHome() ? 'all' : 'here', false);"],
    ['schrijft', '-', 'menuknop wijst naar de index', "menu.setAttribute('aria-controls', index.id);"]]],
  ['rtg-edge-2.js', 'edge-2', 'zichtbaarheidsstand:sb onderbalk:s', [
    ['schrijft', 'zichtbaarheidsstand:s', 'Edge 2-stand op body', 'rt.state=stand;rt.body.setAttribute(CONTRACT.state,stand);'],
    ['beslist', 'zichtbaarheidsstand:b', 'handmatig wint van automatiek', "if(bron==='auto'&&rt.manual)return rt.state;"],
    ['bewaart', 'zichtbaarheidsstand:s', 'handmatige stand per pad', 'voorkeurSchrijf(opslag(rt.win),stand,rt.win.location&&rt.win.location.href);'],
    ['rendert', 'onderbalk:s', 'paginabalken naar het contextpaneel', "el.setAttribute('data-rtg-edge-2-contextual',b.token);slot.appendChild(el);"]]],
  ['rtg-edge-2-context.js', 'edge-2', 'zichtbaarheidsstand:b onderbalk:b gebaar-drempel:b', [
    ['beslist', 'zichtbaarheidsstand:b', 'omlaag compact, omhoog overview', "return delta>0?'compact':'overview';"],
    ['beslist', 'gebaar-drempel:b', 'onder 14 px telt niet', 'Math.abs(delta)<14'],
    ['beslist', 'gebaar-drempel:b', 'een gebaar is 1500 ms vers', 'var GESTURE_MS=1500;'],
    ['beslist', 'onderbalk:b', 'auto: alle twaalf balktokens', "if(raw==='auto')return{ok:true,auto:true,tokens:Object.keys(CONTEXT)};"]]],
  ['rtg-edge-2-loader.js', 'laden', 'hoofdactie:sb zichtbaarheidsstand:sb gebaar-drempel:l', [
    ['beslist', 'hoofdactie:b', 'hoofdactie per hard pad', "if (pad === '/apps/rtg.html') {"],
    ['schrijft', 'hoofdactie:s', 'muteert het object van de casco', 'e.onAction = doe; e.ctx.actie = tekst; k.hidden = false; k.textContent = tekst;'],
    ['schrijft', 'zichtbaarheidsstand:s', 'standaardstand overview', "b.setAttribute('data-rtg-edge-2-state', 'overview');"],
    ['beslist', 'zichtbaarheidsstand:b', 'tweede autoregel voor .wk-stage', "if (nu <= 32 || verschil < -14) w.RTGEdge2.setState('overview'"],
    ['leest', 'gebaar-drempel:l', 'de gebaarversheid van Edge 2', 'if (!w.RTGEdge2.gestureFresh(gebaar)) return;'],
    ['schrijft', 'zichtbaarheidsstand:s', 'vensterboolean: een dialoog is open', "if (open) b.setAttribute(VENSTER_ATTR, 'true'); else b.removeAttribute(VENSTER_ATTR);"]]],
  ['rtg-edge-2-reveal.js', 'edge-2', 'zichtbaarheidsstand:l', [
    ['rendert', 'zichtbaarheidsstand:l', 'herstelgrepen boven en onder', "knop.className = 'rtg-edge-2-edge-reveal rtg-edge-2-edge-reveal--' + kant[0];"],
    ['schrijft', 'zichtbaarheidsstand:l', 'terug naar overview via de API', "if (win.RTGEdge2) win.RTGEdge2.setState('overview', { source: 'edge' });"],
    ['schrijft', '-', 'theme-color, ook in rtg-themas.js', 'meta.content = kleur;']]],
  ['randen.js', 'laden', 'wereld:sbl', [
    ['leest', 'wereld:l', 'statische wereld is leidend', '.includes(d.body.dataset.rtgWorld)) wereld = d.body.dataset.rtgWorld;'],
    ['beslist', 'wereld:b', 'eigen padlijst voor de wereld', "else if (['/apps/reizen.html'].includes(pad)) wereld = 'travel';"],
    ['schrijft', 'wereld:s', 'wereld op body in een frame', 'd.body.dataset.rtgWorld = wereld;'],
    ['beslist', '-', 'start de ene Edge', "laad('/shared/rtg-edge-system.js', 'RTGEdge', function (systeemKlaar) {"]]],
  ['rtg-themas.js', 'schil', 'zichtbaarheidsstand:l', [
    ['leest', 'zichtbaarheidsstand:l', 'hertelt bij elke Edge 2-stand', "'data-rtg-edge-2', 'data-rtg-edge-2-rendered', 'data-rtg-edge-2-state',"],
    ['schrijft', '-', 'theme-color, ook in reveal.js', "if (meta) meta.setAttribute('content', bovenrand(th));"],
    ['bewaart', '-', 'het gekozen thema', "localStorage.setItem(KEY, geldig(t) || 'onyx')"]]],
  ['basis/basis-01ac-edge.js', 'laden', 'wereld:l', [
    ['beslist', 'wereld:l', 'randen.js alleen bij een wereld', "indexOf(b.getAttribute('data-rtg-world')) < 0) return;"]]],
  ['basis/basis-01ad-intelligence.js', 'laden', '', [
    ['beslist', '-', 'laadt controllers die ontbreken', 'if (window[bron[1]] || document.querySelector(']]],
  ['basis/basis-01aa-continue.js', 'laden', '', [
    ['beslist', '-', 'laadt de Continue Key', "if (!window.RTGContinueKey && !document.getElementById('rtgContinueKeyJs') &&"]]],
  ['command.js', 'schil', 'bevoegdheid:b identiteit:l', [
    ['beslist', 'bevoegdheid:b', 'sessie en dichte intakepoort', 'function mag(){return aangemeld()&&poortDicht()}'],
    ['leest', 'identiteit:l', 'sessiestand van app-main', "return !!(app&&app.classList.contains('active'))"],
    ['beslist', '-', 'vangt Home van de Edge af', 'if(!a||!mag()||!tafel)return;e.preventDefault();e.stopPropagation();thuis()']]],
  ['command/werktafel.js', 'schil', 'onderbalk:s voortzetting:bl vluchtige-context:l', [
    ['rendert', 'onderbalk:s', 'bladen in de Command-balk', "b.className='cmd-balkblad'+(i===actief?' actief':'');"],
    ['beslist', 'voortzetting:b', 'hooguit twee bladen', 'if(panes.length>=2)verwijder(actief>=0?actief:0);'],
    ['bewaart', 'voortzetting:l', 'bladen bij elke sync', 'w.RTGCommandGeheugen.schrijf(panes,actief);'],
    ['leest', 'voortzetting:l', 'hervat de laatste bladen', 'var g=w.RTGCommandGeheugen.lees();if(!g)return;']]],
  ['command/bladstand.js', 'schil', 'wereld:sbl', [
    ['leest', 'wereld:l', 'de echte plek van het blad', 'wereld=id.classify(pad)'],
    ['beslist', 'wereld:b', 'vier werelden of geen', "if(WERELDEN.indexOf(wereld)<0)wereld='geen';"],
    ['schrijft', 'wereld:s', 'wereldlabel op body', "d.body.setAttribute('data-rtg-blad-wereld',wereld)"],
    ['schrijft', '-', 'wachtpost in de geschiedenis', "w.history.pushState({rtgWerktafel:1},'')"]]],
  ['command/geheugen.js', 'schil', 'voortzetting:sb', [
    ['bewaart', 'voortzetting:s', 'hooguit twee bladen', 'else w.localStorage.setItem(SLEUTEL, JSON.stringify('],
    ['beslist', 'voortzetting:b', 'alleen paden binnen het huis', "b.url.charAt(0) === '/' && b.url.charAt(1) !== '/'"]]],
  ['rtg-world-identity.js', 'continuiteit', 'wereld:s', [
    ['schrijft', 'wereld:s', 'wereld op body uit het MANIFEST', "body.setAttribute('data-rtg-world', wereld);"]]],
  ['rtg-world-start.js', 'laden', '', [
    ['leest', '-', 'wacht op het renderstempel', "body.getAttribute('data-rtg-edge-2-rendered')==='true'"],
    ['schrijft', '-', 'klaar-vlag op body', "body.setAttribute('data-rtg-world-start','ready');"]]],
  /* De Second Screen stond hier als schrijver en beslisser van de
     zichtbaarheidsstand. Zijn stand (peek, panel, workspace, focus) gaat over de
     bank van de schil (.cmd-bank) en niet over de Edge: een INDELINGSCORRECTIE in
     ronde 2, geen samenvoeging (EDGE.md par. 1). */
  ['interface/second-screen.js', 'schil', 'vluchtige-context:l', [
    ['leest', 'vluchtige-context:l', 'context van het bovendocument', 'return w.RTGAdaptief && w.RTGAdaptief.context ? w.RTGAdaptief.context() : {};']]],
  ['interface/second-screen-modules.js', 'schil', 'vluchtige-context:l', [
    ['leest', 'vluchtige-context:l', 'Nu relevant: de titel uit RTGAdaptief', 'function laatsteContext() { return (A && A.context && A.context()) || laatste || {}; }']]],
  ['interface/workspace-context.js', 'schil', 'vluchtige-context:sb', [
    ['schrijft', 'vluchtige-context:s', 'een eigen current naast RTGAdaptief', "current = next; var change = { value: get(), reason: reason || 'host-update' };"],
    ['beslist', 'vluchtige-context:b', 'slikt een gelijke context', 'var next = clean(value); if (JSON.stringify(next) === JSON.stringify(current)) return get();']]],
  ['interface/world-desktop-frame.js', 'schil', 'capability-register:l onderbalk:l identiteit:l', [
    ['projecteert', 'capability-register:l', 'oogst handelingen uit het frame', 'var A = scope.win.RTGAdaptief, items = A && A.voorNu ? A.voorNu() : [];'],
    ['schrijft', 'onderbalk:l', 'laat de Edge frame-balken claimen', 'if (w.RTGAdaptiveEdgeClaim) w.RTGAdaptiveEdgeClaim.claim(doc, win);'],
    ['beslist', '-', 'hooguit vier frames', "if (!x && entries.length >= 4) { o.announce(U.value('limit')); return false; }"],
    ['leest', 'identiteit:l', 'herlaadt bij een sessiewissel', "e.key === 'rtg_member_token' || e.key === 'rtf_sessie'"]]],
  ['interface/world-desktop-home.js', 'schil', 'capability-register:s wereld:sl', [
    ['leest', 'wereld:l', 'de wereld van het bureau', 'world = d.body.dataset.worldHome'],
    ['schrijft', 'wereld:s', 'wereldlabel in het merk van de Edge', 'label.translate = false; brand.appendChild(label);'],
    ['schrijft', 'capability-register:s', "'home' in het tweede register", "w.RTGAdaptiveEdge.registerAction({ id: 'home', label: U.value('overview'), run: function () {"]]],
  ['rtg-continue-key-core.js', 'continuiteit', 'hoofdactie:sb', [
    ['rendert', 'hoofdactie:s', 'herbouwt de hoofdactieknop', "b.appendChild(houder); zetAttr(b, 'data-rtg-morph-action', '');"],
    ['beslist', 'hoofdactie:b', 'is de hoofdactie bruikbaar', "if (s && (s.display === 'none' || s.visibility === 'hidden'"],
    ['bewaart', 'hoofdactie:s', 'anker globaal', 's.setItem(STORAGE, waarde); return true;']]],
  ['rtg-continue-key.js', 'continuiteit', 'hoofdactie:sb zichtbaarheidsstand:l', [
    ['beslist', 'hoofdactie:b', 'alleen bij precies een hoofdactie', 'if (gevonden.length !== 1) return null;'],
    ['schrijft', 'hoofdactie:s', 'anker op de hoofdactieknop', "C.setAttr(rt.button, 'data-rtg-key-anchor', waarde);"],
    ['leest', 'zichtbaarheidsstand:l', 'Edge 2 focus sluit de kiezer', "(body.getAttribute('data-rtg-edge-2-state') === 'focus' ||"]]],
  ['rtg-route-memory-core.js', 'continuiteit', 'voortzetting:sb', [
    ['bewaart', 'voortzetting:s', 'routecontext naar de opslag', 'storage.setItem(KEY, JSON.stringify(rows)); return true;'],
    ['beslist', 'voortzetting:b', '24 uur geldig', 'row.at > now + 60000 || row.at <= now - TTL'],
    ['beslist', 'voortzetting:b', 'hooguit 24 routes of 64 KB', 'while (rows.length > MAX || JSON.stringify(rows).length > BYTES) rows.shift();']]],
  ['rtg-route-memory.js', 'continuiteit', 'voortzetting:bl hoofdactie:l', [
    ['bewaart', 'voortzetting:l', 'naar sessionStorage', 'return C.writeStorage(win.sessionStorage, path, state);'],
    ['beslist', 'voortzetting:b', 'elke interactie breekt herstel af', 'interrupted = true; stopRestore(); queueSave();'],
    ['schrijft', 'hoofdactie:l', 'anker via de publieke API', 'anchorDone = true; win.RTGContinueKey.setPosition(saved.anchor);']]],
  ['rtg-daily.js', 'afnemer', 'onderbalk:s bevoegdheid:b', [
    ['rendert', 'onderbalk:s', 'exportbalk als Edge-balk', "host.setAttribute('data-rtg-edge-bar', ''); d.body.appendChild(host);"],
    ['beslist', 'bevoegdheid:b', 'gast: knoppen in Edge-balken uit', "if (state === 'guest') d.querySelectorAll('[data-rtg-edge-bar]')"],
    ['schrijft', '-', 'paginastand op body', 'd.body.dataset.dailyState = state;']]],
  ['social-intelligence-runtime.js', 'afnemer', 'capability-register:s trust-rail:s', [
    ['schrijft', 'capability-register:s', "'social-context' in het tweede register", "edge.registerAction({ id: 'social-context', label: 'Sociale context bekijken'"],
    ['schrijft', 'capability-register:s', 'overschrijft het actiedeck', "edge.setProjection({ deck: 'actions', actions: ['social-context'] });"],
    ['projecteert', 'trust-rail:s', 'verbinding uit het protocol', "? (location.protocol === 'https:' ? 'ONLINE / TLS' : 'ONLINE / LOCAL')"]]],
  /* De gebaarlaag van de lijsten (shared/gebaar.js, op elk scherm met basis.js)
     stond tot ronde 2 niet op de kaart, en daardoor leek gebaar-drempel na ronde 1
     een eigenaar te hebben. Sinds stap 10 leest gebaar-03b lang drukken en stil
     uit DREMPELS, en brengt gebaar-01 de grammatica zelf mee. gebaar-02 houdt
     RICHTING en STIL (andere gebaren, een eigen meting), en de borgtijd blijft
     800 tot ronde 3 (besluit K-borg, EDGE.md par. 8). */
  ['gebaar/gebaar-01.js', 'afnemer', 'gebaar-drempel:l', [
    ['leest', 'gebaar-drempel:l', 'de tabel bij elk gebaar, nooit bewaard', 'function drempels() { var G = window.RTGGrammatica; return G && G.DREMPELS; }'],
    ['beslist', '-', 'laadt de grammatica alleen als hij er niet is', "if (window.RTGGrammatica || d.querySelector('script[src*=\"shared/adaptief/grammatica.js\"]')) return;"]]],
  ['gebaar/gebaar-02.js', 'afnemer', 'gebaar-drempel:b', [
    ['beslist', 'gebaar-drempel:b', 'eigen richtingsdrempel naast DREMPELS', 'var RICHTING = 8;'],
    ['beslist', 'gebaar-drempel:b', 'eigen stilte voor de klik erna', 'var STIL = 6;']]],
  ['gebaar/gebaar-03b.js', 'afnemer', 'gebaar-drempel:l gewicht:b', [
    ['leest', 'gebaar-drempel:l', 'lang drukken uit DREMPELS.lang', '}, D.lang);'],
    ['leest', 'gebaar-drempel:l', 'stilte uit DREMPELS.stil', 'langStil = D.stil;'],
    ['leest', 'gebaar-drempel:l', 'scherp vervalt na DREMPELS.herbevestig', 'scherp = setTimeout(bot, D.herbevestig);'],
    ['beslist', 'gewicht:b', 'eigen borgtijd naast VASTHOUD, tot ronde 3 (K-borg)', 'var BORGTIJD = 800;']]],
  ['edge/blikveld.js', 'blikveld', 'capability-register:l vluchtige-context:l wereld:l identiteit:l presence:l trust-rail:l voortzetting:l hoofdactie:l gewicht:l waarom:l bevoegdheid:l', [
    ['projecteert', '-', 'een leesbeeld; schrijft niets', 'return { versie: 1, op: t, velden: velden, acties: gedaan, gebreken: gebreken };'],
    ['leest', 'hoofdactie:l', 'de hoofdactie via zijn lezer', "H && typeof H.lees === 'function' ? H.lees(w) : null"],
    ['leest', 'capability-register:l', 'het tweede register erbij', "gedaan.push({ id: a.id, naam: a.label, herkomst: 'edge-compat'"],
    ['projecteert', 'bevoegdheid:l', 'bevoegdheid zonder bron', "bevoegdheid: veld(null, 'geen', 'geen', t,"]]],
  ['edge/blikveld-hoofdactie.js', 'blikveld', 'hoofdactie:l', [
    ['leest', 'hoofdactie:l', 'het actieve blad, alleen lezend', "querySelector('#rtgCommand .cmd-pane.actief iframe')"],
    ['leest', 'hoofdactie:l', 'twee hoofdactiebronnen naast elkaar', "edgeLabel !== tekstVan(scherm[0])) gebreken.push('hoofdactie-dubbel')"],
    ['projecteert', 'hoofdactie:l', 'herkomst blad of scherm', "herkomst: b ? 'blad:data-hoofdactie' : 'scherm:data-hoofdactie'"]]],
  ['edge/actiestaat.js', 'blikveld', 'gewicht:bl waarom:b bevoegdheid:l', [
    ['leest', 'gewicht:l', 'hetzelfde effectieve gewicht', 'var gewicht = G && gram.effectief ? gram.effectief(gevraagd, kanOngedaan) : String(gevraagd);'],
    ['beslist', 'gewicht:b', 'zonder tabel gaat zwaar dicht', "} else if (!G && gewicht !== 'licht') {"],
    ['beslist', 'bevoegdheid:l', 'alleen een serveroordeel telt', "if (i.oordeel.bron === 'server' && OORDEEL.indexOf(i.oordeel.uitkomst) >= 0)"],
    ['beslist', 'waarom:b', 'redenloos krijgt een vangnetzin', "gebreken.push('redenloos');"]]],
  ['public/apps/office/adaptief.js', 'afnemer', 'capability-register:l vluchtige-context:l', [
    ['schrijft', 'vluchtige-context:l', 'Office-context naar het register', 'A.context({ bron: bron, titel: titel(), acties:'],
    ['schrijft', 'capability-register:l', 'werkbalkknop als capability', 'A.declareer({ id: id, naam: naamVan(b), label: labelVan(b)'],
    ['schrijft', 'vluchtige-context:l', 'wist ieders context', 'if (!bron || !knoppen.length) { A.wisContext(); return; }']]],
  ['public/apps/office/adaptief-staat.js', 'afnemer', 'trust-rail:l gewicht:l waarom:l capability-register:l', [
    ['projecteert', 'trust-rail:l', 'rail-onderdeel classificatie', "uit.push({ sleutel: 'classificatie', tekst: CLASSNAAM[k] || k,"],
    ['beslist', 'waarom:l', 'strikt: delen verhinderd', "var dicht = k === 'strikt';"],
    ['beslist', 'gewicht:l', 'delen weegt bewust', "gewicht: 'bewust',"]]],
  ['public/apps/office/adaptief-pres.js', 'afnemer', 'capability-register:l', [
    ['schrijft', 'capability-register:l', 'indeling als lade-capability', "A.declareer({ id: 'office.pres.indeling', naam: 'Indeling'"],
    ['schrijft', '-', 'change op het echte element', "kies.dispatchEvent(new w.Event('change', { bubbles: true }));"]]],
  ['public/apps/bestanden/adaptief.js', 'afnemer', 'capability-register:l vluchtige-context:l gewicht:l trust-rail:l', [
    ['schrijft', 'vluchtige-context:l', 'bestandscontext', "A.context({ bron: 'bestanden', titel: f.naam || 'Bestand',"],
    ['beslist', 'trust-rail:l', 'ruimte pas boven 80%', 'if (deel >= 0.8) {'],
    ['beslist', 'gewicht:l', 'gewicht hangt aan de toestand', "zet('bestanden.voorgoed', 'Voorgoed weg',"]]],
  ['public/apps/reizen-veilig.js', 'afnemer', 'capability-register:l vluchtige-context:l identiteit:l', [
    ['schrijft', 'capability-register:l', 'zes bankhandelingen', "A.declareer({id:'reisveilig.'+item[0],naam:item[1],label:item[1]"],
    ['schrijft', 'capability-register:l', 'actiesleutel om te ontdubbelen', "b.dataset.rtgActionKey='reisveilig.'+p.id;"],
    ['leest', 'identiteit:l', 'het ledentoken', "function token(){try{return localStorage.getItem('rtg_member_token')}"]]],
  ['public/apps/reizen-performance.js', 'afnemer', 'vluchtige-context:l capability-register:l identiteit:l', [
    ['schrijft', 'vluchtige-context:l', 'titel in de context van de casco', 'w.RTGEdge.setContext({ title: bladNaam });'],
    ['schrijft', 'vluchtige-context:l', 'en in die van het register', "A.context({ bron: 'reizen.tabs', titel: 'TravelOS',"],
    ['beslist', 'vluchtige-context:l', 'alleen in een frame', 'if (!A || w.parent === w) return;']]],
  /* Twee schermen zetten de Edge 2-stand zelf op body, buiten setState om. */
  ['public/apps/werk/command-entry.js', 'afnemer', 'zichtbaarheidsstand:sl', [
    ['schrijft', 'zichtbaarheidsstand:s', 'Edge 2-stand op body bij het laden (de verklaring)', "document.body.setAttribute('data-rtg-edge-2-state', 'overview');"],
    ['schrijft', 'zichtbaarheidsstand:l', 'een hashwissel vraagt de poort als automatiek; handmatig wint', "edge2.setState('overview', { source: 'auto' });"]]],
  ['public/apps/foundation/os-publiek.html', 'afnemer', 'zichtbaarheidsstand:s', [
    ['schrijft', 'zichtbaarheidsstand:s', 'Edge 2-stand op body bij een stadswissel', "document.body.setAttribute('data-rtg-edge-2-state', 'overview');"]]],
  /* De landing (index.html in de wortel) draait de adaptieve Edge met een eigen
     host, vult het tweede register en zet de wereld per scene. */
  ['public/site/start/experience-edge.js', 'afnemer', 'capability-register:s wereld:s', [
    ['schrijft', 'capability-register:s', 'zeven ids zonder run', 'edge.registerAction({ id: id, label: id, allowed: false });'],
    ['schrijft', 'capability-register:s', 'de scenerijen met een run', "edge.registerAction({ id: 'experience-action-' + i, label: item.label, run: function () {"],
    ['schrijft', 'capability-register:s', 'op alle vijf decks', 'edge.setProjection({ deck: deck, actions: ids });'],
    ['schrijft', 'wereld:s', 'wereld op body per scene', "d.body.dataset.rtgWorld = active.id === 'werelden' ? X.currentWorld() : active.dataset.tone;"]]],
  ['public/site/start/experience.js', 'afnemer', 'wereld:s', [
    ['schrijft', 'wereld:s', 'wereld op body in de werelden-scene', 'd.body.dataset.rtgWorld = currentWorld;']]],
  ['public/site/start/experience-graph.js', 'afnemer', 'wereld:s', [
    ['schrijft', 'wereld:s', 'wereld op body bij een keuze in de graaf', 'd.body.dataset.rtgWorld = id;']]]
];

/* Waarom een dubbele eigenaar dubbel is. Afgeleid wordt WIE; dit zegt WAAROM.
   Een dubbele zonder regel hier, of een regel zonder dubbele, laat het script
   zakken: dan is de verklaring bij de afleiding achtergebleven. */
const WAAROM = {
  'capability-register': 'Twee registers met elk een eigen poort: RTGAdaptief (declareer, keuring via de leer en de grammatica) en de Edge-Core (registerAction, id-patroon, allowed); sinds ronde 1 kent de Edge-Core alleen licht en voert hij uit langs RTGGewicht.voer, maar hij houdt die handelingen nog op een tweede plek bij, gevuld door vijf producenten: zijn eigen standaardingangen, Signals (primary), de sociale runtime (social-context), het wereldbureau (home) en de landing (zeven ids zonder run plus de scenerijen); leeg in ronde 2. De controls oogsten paginaknoppen als derde bron.',
  'vluchtige-context': 'Drie contextmodellen: RTGAdaptief.context() (bron, titel, acties, selectie), RTGEdge.active.ctx (scope, titel, actie, tool) en RTGWorkspaceContext (een eigen current, gevoed uit de eerste, met een eigen ontdubbeling); reizen-performance.js voedt de eerste twee allebei, en wie de context mag zetten beslissen het register (sleutel, bron bij wissen), de brug (actief blad) en de werkruimte (gelijk wordt geslikt) elk apart.',
  wereld: 'De huidige wereld wordt op vier plekken BEPAALD: de casco (key, anders work), randen.js (eigen padlijst), bladstand.js (het actieve blad) en de wereldcatalogus naast MAPPEN; het slimme menu laat het blad voorgaan op de casco. GESCHREVEN wordt hij op meer: rtg-world-identity.js bakt hem uit het MANIFEST op body, het wereldbureau zet zijn label in het merk van de Edge, en de landing zet hem per scene vanuit drie scripts.',
  'trust-rail': 'Verbinding en beveiliging worden op drie plekken zelf afgeleid en elk op een eigen strook getoond: RTGRail (navigator.onLine), het statuspaneel van de casco (/api/ready, Beveiligd) en de Intelligence-strook (protocol als ONLINE / TLS); geen van drie leest een ander.',
  voortzetting: 'Vier geheugens voor waar was ik: continueWith (alleen in het model van de Edge), de werktafelbladen (localStorage), de routecontext (sessionStorage, 24 uur) en Recent bezocht van het slimme menu (sessionStorage); geen van vier leest een ander.',
  hoofdactie: 'De library maakt de knop, de casco en de Edge 2-loader (padtabel) zetten tekst en actie, de Continue Key herbouwt inhoud en anker en de controls verhuizen hem; het scherm wijst intussen zijn eigen data-hoofdactie aan, en het blikveld meldt het verschil als hoofdactie-dubbel.',
  gewicht: 'De tabel en de regel voor het effectieve gewicht staan in grammatica.js (gewicht.js en actiestaat.js delen hem), maar de toepassing verschilt per plek: twee keer een eigen standaard licht voor een ONTBREKEND gewicht (adaptief.js, brug.js; register.js laat het gewicht sinds ronde 1 staan), de regel voor zonder gewichtlaag staat drie keer apart (balkknop, orb en actiestaat gaan elk zelf dicht), de Edge-Core laat in zijn tweede register alleen licht toe, en de gebaarlaag houdt een eigen borgtijd van 800 ms naast VASTHOUD (die blijft tot ronde 3, besluit K-borg).',
  'gebaar-drempel': 'DREMPELS in grammatica.js is de tabel, en zes herkenners lezen hem. Twee plekken beslissen met eigen maten: de gebaarversheid van Edge 2 (1500 ms, 14 px) en de gebaarlaag van de lijsten (RICHTING 8 en STIL 6 in gebaar-02, voor veeg of scroll en de klik erna -- andere gebaren, die een eigen meting vragen). Lang drukken en stil in gebaar-03b lezen sinds ronde 2, stap 10 de tabel, en gebaar-01 brengt de grammatica zelf mee.',
  waarom: 'De vijf bronnen staan twee keer (BRONNEN in grammatica.js, BRONWOORD in waarom.js), en verhinderd-gaat-niet-door wordt beslist in register.js, balkknop.js, orb.js en actiestaat.js naast de uitleg in grammatica.js en waarom.js.',
  zichtbaarheidsstand: 'Drie standmachines voor wat er van de Edge te zien is: Edge 2 (overview/compact/focus) met een tweede autoregel en een vensterboolean in de loader, de adaptieve balk (peek/dock/deck/expanded) die Edge 2 eenrichting volgt en sinds ronde 2 zijn gebaarversheid leest; ze delen geen stand. De Edge 1-vouwstand is in ronde 2 weggehaald. Daarnaast zetten twee schermen de Edge 2-stand zelf op body: FoundationOS bij een stadswissel, Work alleen nog bij het laden (een hashwissel gaat sinds ronde 2 via setState als automatiek, zodat een handmatige keuze wint). De Second Screen stond hier tot ronde 2 en is eraf: zijn stand gaat over de bank van de schil, niet over de Edge.',
  onderbalk: 'Wie onderin staat, beslissen de Command-balk, de voet van de casco, de adaptieve balk die die voet wegzet, de appbalk en de claim die elk paginabalken overnemen, Edge 2 die ze naar het contextpaneel haalt, RTGDaily die zelf een Edge-balk ophangt, en het Edge-commando dat de menuknop tot 999 px claimt.',
  bevoegdheid: 'Drie plekken in de client beslissen wat mag (de sessiegrendel van de werktafel, allowed van de Edge-Core, de gastblokkade van RTGDaily), terwijl er geen serverroute is die per principal een oordeel geeft -- het blikveld zegt dat hardop.',
};

const pad = p => p.startsWith('public/') ? p : 'public/shared/' + p;
const lees = p => { try { return fs.readFileSync(path.join(WORTEL, p), 'utf8'); } catch (e) { return null; } };
const uniek = a => [...new Set(a)].sort();

/* ---------------------------------------------------------------- DE GRENDEL */
function keur() {
  const fouten = [];
  for (const [p, laag, v, rollen] of KAART) {
    const bron = lees(pad(p));
    if (bron === null) { fouten.push(pad(p) + ': bestand ontbreekt'); continue; }
    if (!LAGEN.includes(laag)) fouten.push(pad(p) + ': onbekende laag ' + laag);
    const etiketten = new Set();
    for (const t of v.split(' ').filter(Boolean)) {
      const [naam, letters] = t.split(':');
      if (!NAMEN.includes(naam) || !/^[sbl]+$/.test(letters || '')) fouten.push(pad(p) + ': onbekende verantwoordelijkheid ' + t);
      else for (const l of letters) etiketten.add(naam + ':' + l);
    }
    /* Het citaat moet in de CODE staan en niet in een opmerking erover: anders
       blijft de kaart groen nadat de geciteerde regel is weggehaald, zolang de
       kop hem nog noemt (gevonden door de tegenlezer van 23 september 2026). */
    const code = kaal(pad(p), bron), gedragen = new Set();
    for (const r of rollen) {
      const [rol, etiket, , citaat] = r;
      if (r.length !== 4) { fouten.push(pad(p) + ': een rol is [rol, etiket, wat, citaat], deze heeft ' + r.length + ' velden'); continue; }
      if (!ROLLEN.includes(rol)) fouten.push(pad(p) + ': onbekende rol ' + rol);
      if (citaat.length > 100 || citaat.includes('\n') || !code.includes(citaat)) fouten.push(pad(p) + ': citaat staat er niet (meer) in de code: ' + citaat);
      /* De binding, in beide richtingen. Het citaat wijst naar een etiket dat
         in deze rij staat, met een letter die zijn rol kan dragen; en hieronder
         heeft elk etiket s of b minstens een citaat dat het draagt. */
      if (etiket === '-') continue;
      const [naam, letter] = String(etiket).split(':');
      if (!NAMEN.includes(naam) || !/^[sbl]$/.test(letter || '')) fouten.push(pad(p) + ': onbekend etiket op een citaat: ' + etiket);
      else if (!(DRAAGT[rol] || '').includes(letter)) fouten.push(pad(p) + ': een citaat dat ' + rol + ' draagt geen ' + ALS[letter] + ' (' + etiket + ')');
      else if (!etiketten.has(etiket)) fouten.push(pad(p) + ': citaat hangt aan ' + etiket + ', en dat etiket staat niet in de rij: ' + citaat);
      else gedragen.add(etiket);
    }
    for (const e of etiketten) {
      if (!e.endsWith(':l') && !gedragen.has(e)) fouten.push(pad(p) + ': etiket ' + e + ' heeft geen citaat dat het draagt');
    }
  }
  return fouten;
}

/* ------------------------------------------------------------ DE BRONLEZER */
function kaal(p, bron) {
  if (!p.endsWith('.html')) return zonderCommentaar(bron);
  return stukken(bron).map(s => s.soort === 'script' ? zonderCommentaar(s.tekst)
    : s.soort === 'style' ? '' : s.tekst.replace(/<!--[\s\S]*?-->/g, ' ')).join('');
}
/* De argumenten van een aanroep die op `i` (na het haakje) begint, op diepte 0. */
function argumenten(s, i) {
  const uit = []; let diep = 0, begin = i;
  for (; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') { const j = s.indexOf(c, i + 1); if (j < 0) break; i = j; continue; }
    if ('([{'.includes(c)) diep++;
    else if (')]}'.includes(c)) { if (diep === 0) { uit.push(s.slice(begin, i).trim()); return uit; } diep--; }
    else if (c === ',' && diep === 0) { uit.push(s.slice(begin, i).trim()); begin = i + 1; }
  }
  return uit;
}
const letterlijk = a => { const m = /^(['"`])([^'"`$\n]*)\1$/.exec(a || ''); return m ? m[2] : null; };
/* Een naam die geen letterlijke tekst is: een niveau diep volgen (een lus over
   letterlijke namen, of een wrapper als emit(naam)), anders `dynamisch`. */
function lus(s, pos, arg) {
  const voor = s.slice(Math.max(0, pos - 600), pos);
  const m = [...voor.matchAll(new RegExp('\\[([^\\[\\]]*)\\]\\s*\\.forEach\\(\\s*(?:function\\s*\\(\\s*' + arg + '\\b|\\(?\\s*' + arg + '\\s*\\)?\\s*=>)', 'g'))].pop();
  if (!m) return null;
  const n = argumenten(m[1] + ')', 0).map(letterlijk);
  return n.every(x => x !== null) ? n : null;
}
function volg(s, pos, arg) {
  if (!/^[\w$]+$/.test(arg)) return null;
  const c = constante(s, arg);
  if (c) return [c];
  const l = lus(s, pos, arg);
  if (l) return l;
  const fn = [...s.slice(Math.max(0, pos - 600), pos).matchAll(/function\s+([\w$]+)\s*\(([^)]*)\)|([\w$]+)\s*=\s*function\s*\(([^)]*)\)/g)]
    .map(m => ({ naam: m[1] || m[3], params: (m[2] !== undefined ? m[2] : m[4] || '').split(',').map(x => x.trim()) }))
    .filter(f => f.params.includes(arg)).pop();
  if (!fn) return null;
  /* Een wrapper die ook als WAARDE het bestand uit gaat (`{ emit: emit }`,
     `api.emit(...)`), wordt ook buiten dit bestand aangeroepen: die namen zien we
     niet, dus dynamisch en niet een lege lijst. */
  const naamRe = fn.naam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp('\\.' + naamRe + '\\(|[:,=(]\\s*' + naamRe + '\\s*[,})\\]]').test(s)) return null;
  const k = fn.params.indexOf(arg), namen = [];
  for (const m of s.matchAll(new RegExp('(^|[^\\w$.])' + naamRe + '\\(', 'g'))) {
    if (/function\s*$/.test(s.slice(Math.max(0, m.index - 12), m.index + m[1].length))) continue;
    const a = argumenten(s, m.index + m[0].length)[k];
    const n = letterlijk(a) !== null ? [letterlijk(a)] : /^[\w$]+$/.test(a || '') && lus(s, m.index, a);
    if (!n) return null;
    namen.push(...n);
  }
  return namen.length ? namen : null;
}
function events(p, s) {
  const zendt = [], luistert = [], dynamisch = [];
  const lees1 = (re, soort, doel) => {
    for (const m of s.matchAll(re)) {
      const pos = m.index + m[0].length, a = argumenten(s, pos)[0] || '';
      const naam = letterlijk(a);
      if (naam !== null) { doel.push(naam); continue; }
      const gevolgd = volg(s, m.index, a);
      if (gevolgd) doel.push(...gevolgd); else dynamisch.push({ pad: p, soort, uitdrukking: a.slice(0, 60) });
    }
  };
  lees1(/new\s+(?:[\w$]+\.)?(?:CustomEvent|Event)\(\s*/g, 'zendt', zendt);
  lees1(/\baddEventListener\(\s*/g, 'luistert', luistert);
  return { zendt: uniek(zendt), luistert: uniek(luistert.filter(n => n.startsWith('rtg'))), dynamisch };
}
/* Alleen een CONSTANTE (hoofdletters): een lusvariabele als `n` heet elders in
   het bestand misschien ook zo, en dan zou dit raden. */
const constante = (s, naam) => { if (!/^[A-Z][A-Z0-9_]*$/.test(naam)) return null; const m = new RegExp('\\b' + naam + '\\s*=\\s*([\'"])([^\'"\\n]+)\\1').exec(s); return m ? m[2] : null; };
/* De data-attributen die een bestand op body of html zet, of op een alias
   daarvan. Apart, omdat de afgeleide controles hieronder alleen dit nodig hebben
   en dezelfde lezer moeten gebruiken als `gemeten` (geen tweede parser). */
function lijfAttributen(s) {
  const alias = new Set([...s.matchAll(/\b([\w$]+)\s*=\s*(?:[\w$]+\.)*(?:body|documentElement)\b(?!\s*[.(\w])/g)].map(m => m[1]));
  const lijf = r => /(^|\.)(body|documentElement)$/.test(r) || alias.has(r);
  const attributen = [];
  for (const m of s.matchAll(/([\w$.]+)\.setAttribute\(\s*/g)) {
    if (!lijf(m[1])) continue;
    const a = argumenten(s, m.index + m[0].length)[0] || '', n = letterlijk(a) !== null ? letterlijk(a) : constante(s, a);
    if (n === null) attributen.push('(dynamisch) ' + a.slice(0, 40)); else if (n.startsWith('data-')) attributen.push(n);
  }
  for (const m of s.matchAll(/([\w$.]+)\.dataset\.([\w$]+)\s*=(?!=)/g)) {
    if (lijf(m[1])) attributen.push('data-' + m[2].replace(/[A-Z]/g, c => '-' + c.toLowerCase()));
  }
  return uniek(attributen);
}
function meet(p, s) {
  const globals = [...s.matchAll(/\b(?:w|window|root|g)\.(RTG[\w$]*)\s*=(?!=)/g)].map(m => m[1]);
  const opslag = [];
  for (const m of s.matchAll(/([\w$.()]+)\.(?:getItem|setItem|removeItem)\(\s*/g)) {
    const a = argumenten(s, m.index + m[0].length)[0] || '';
    const soort = /sessionStorage\)?$/.test(m[1]) ? 'sessionStorage' : /localStorage\)?$/.test(m[1]) ? 'localStorage' : 'onbekend';
    const sleutel = letterlijk(a) !== null ? letterlijk(a) : /^[\w$]+$/.test(a) && constante(s, a);
    opslag.push(soort + ' ' + (sleutel || '(dynamisch) ' + a.slice(0, 40)));
  }
  const fetchen = [...s.matchAll(/\bfetch\(\s*['"`](\/api\/[^'"`$?]*)/g)].map(m => m[1]);
  const ev = events(p, s);
  return { globals: uniek(globals), zendt: ev.zendt, luistert: ev.luistert, attributen: lijfAttributen(s),
    opslag: uniek(opslag), fetch: uniek(fetchen) };
}

/* ------------------------------------------------------- DE DODE KANALEN
   Over heel public/ plus de landing in de wortel. public/dist is een geminifieerde
   kopie, en een bundel (scripts/bundel.js) is byte voor byte de som van zijn
   delen: die zouden elke naam twee keer tellen, en de delen zijn wat de kaart
   hierboven noemt. */
function bestanden(dir, uit) {
  for (const e of fs.readdirSync(path.join(WORTEL, dir), { withFileTypes: true })) {
    const p = dir + '/' + e.name;
    if (e.isDirectory()) { if (p !== 'public/dist') bestanden(p, uit); } else if (/\.(js|html)$/.test(e.name) && !/\.min\.js$/.test(e.name)) uit.push(p);
  }
  return uit;
}
/* De wandeling: elk bestand met zijn bron zonder commentaar, een keer gelezen en
   gedeeld door de dode kanalen en de afgeleide controles hieronder. */
function wandeling() {
  const bundel = new Set(Object.keys(bundels).map(k => 'public/' + k));
  return bestanden('public', ['index.html']).filter(p => !bundel.has(p)).sort().map(p => [p, kaal(p, lees(p) || '')]);
}
function kanalen(lijst = wandeling()) {
  const zenders = {}, luisteraars = {}, dynamisch = [];
  for (const [p, code] of lijst) {
    const e = events(p, code);
    e.zendt.filter(n => n.startsWith('rtg')).forEach(n => (zenders[n] = zenders[n] || []).push(p));
    e.luistert.forEach(n => (luisteraars[n] = luisteraars[n] || []).push(p));
    dynamisch.push(...e.dynamisch);
  }
  return {
    /* Levend = een rtg-naam met zender EN luisteraar. Staat hier zodat "nul dood"
       nooit groen is doordat de wandeling niets zag (LAT regel 9). */
    levend: Object.keys(zenders).filter(n => luisteraars[n]).length,
    luisterZonderZender: Object.keys(luisteraars).filter(n => !zenders[n]).sort().map(n => ({ naam: n, luisteraars: luisteraars[n] })),
    zendZonderLuisteraar: Object.keys(zenders).filter(n => !luisteraars[n]).sort().map(n => ({ naam: n, zenders: zenders[n] })),
    dynamisch: dynamisch.sort((a, b) => (a.pad + a.soort + a.uitdrukking).localeCompare(b.pad + b.soort + b.uitdrukking))
  };
}

/* ------------------------------------------------ DE AFGELEIDE CONTROLES
   De KAART is verklaard: een mens zet een bestand erop, en wat hij niet ziet,
   staat er niet op. Zo stond de gebaarlaag er na ronde 1 niet op, en leek een
   verantwoordelijkheid een eigenaar te hebben die er twee had. Daarom leiden
   drie controles de schrijvers LEXICAAL af uit dezelfde wandeling als de dode
   kanalen, en leggen ze naast de kaart:

     1  wie registerAction aanroept op de Edge-kern, staat erop als schrijver van
        capability-register, met die aanroep als citaat -- en andersom. Zo kan
        "het tweede register is leeg" (ronde 2) BEWEZEN worden: deze lijst op nul.
     2  wie data-rtg-world op body zet, staat erop als wereld:s.
     3  wie data-rtg-edge-2-state op body zet, staat erop als zichtbaarheidsstand:s.

   Een ONDERGRENS, en dat staat erbij in plaats van eromheen: een aanroep via een
   samengestelde naam (edge['registerAction'], een doorgegeven functie) en een
   attribuut via een variabele of een CONTRACT-veld ontsnappen. Voor 2 en 3 is
   dat bekend: rtg-edge-2.js zet zijn stand via CONTRACT.state en staat er om die
   reden met de hand op. De controles leggen daarom alleen een ondergrens aan de
   kaart op (wie de lezer vindt, moet erop), niet een bovengrens.

   De ontvangers heten per plek anders: de landing en de sociale runtime noemen
   RTGAdaptiveEdge `edge`, Signals `api`, het wereldbureau `w.RTGAdaptiveEdge`.
   Een ontvanger die niet op RTGAdaptiveEdge eindigt en in geen van beide
   lijsten staat, laat de controle zakken -- raden wat een naam is, doet hij niet.
   Elke uitzondering noemt het bestand en de reden, en een uitzondering die niets
   meer uitzondert zakt ook (net als een WAAROM zonder dubbele eigenaar). */
const ONTVANGERS = ['edge', 'api'];   // plus elke naam die op RTGAdaptiveEdge eindigt
const ANDERE_REGISTERS = [
  { pad: 'public/shared/interface/workspace-broker.js', ontvanger: 'registries',
    reden: 'het actieregister van de werkruimtemodules (workspace-registries.js), met manifest, permissie en audit; deelt alleen de naam' },
  { pad: 'public/shared/interface/workspace-module-host.js', ontvanger: 'o',
    reden: 'de broker van de werkruimte (workspace-broker.js), hetzelfde moduleregister; deelt alleen de naam' }
];
/* Een schrijver zonder lader is geen eigenaar. Of de lader ontbreekt, wordt bij
   elke meting opnieuw nagekeken: noemt een bestand in de wandeling de naam, dan
   vervalt de uitzondering en zakt de controle. */
const ZONDER_LADER = ['public/site/platform-controller.js', 'public/site/platform-app.js'];
const ATTR = { wereld: 'data-rtg-world', zichtbaarheidsstand: 'data-rtg-edge-2-state' };

function afgeleid(lijst = wandeling()) {
  const fouten = [], gevonden = { registerAction: [], wereld: [], zichtbaarheidsstand: [] }, uitgezonderd = [];
  const schrijver = (vol, naam) => KAART.some(([p, , v]) => pad(p) === vol &&
    v.split(' ').some(t => t.split(':')[0] === naam && (t.split(':')[1] || '').includes('s')));
  const benut = new Set();
  for (const [p, code] of lijst) {
    if (code.includes('registerAction')) for (const m of code.matchAll(/([\w$.]+)\s*\.\s*registerAction\s*\(/g)) {
      const ontv = m[1], ander = ANDERE_REGISTERS.find(a => a.pad === p && a.ontvanger === ontv);
      if (ander) benut.add(ander);
      else if (ONTVANGERS.includes(ontv) || /(^|\.)RTGAdaptiveEdge$/.test(ontv)) { if (!gevonden.registerAction.includes(p)) gevonden.registerAction.push(p); }
      else fouten.push(p + ': registerAction op een onbekende ontvanger `' + ontv + '`; zet hem in ONTVANGERS of, met reden, in ANDERE_REGISTERS');
    }
    /* Alleen lezen waar een van de namen als TEKST staat (tussen aanhalingstekens,
       ook in een constante) of als dataset-veld: iets anders vindt lijfAttributen
       niet, en zo slaat de lezer de schermen over die de wereld alleen als
       attribuut in hun opmaak dragen. */
    if (!/['"`]data-rtg-world['"`]|\.rtgWorld\s*=|['"`]data-rtg-edge-2-state['"`]/.test(code)) continue;
    const attr = lijfAttributen(code);
    for (const naam of Object.keys(ATTR)) {
      if (!attr.includes(ATTR[naam])) continue;
      if (naam === 'wereld' && ZONDER_LADER.includes(p)) { uitgezonderd.push(p); continue; }
      gevonden[naam].push(p);
    }
  }
  /* 1: gelijk, in beide richtingen. Op de kaart telt alleen een schrijver van
     capability-register WAARVAN een citaat de aanroep zelf is. */
  const kaart1 = KAART.filter(([, , , rollen]) => rollen.some(([, e, , c]) => e === 'capability-register:s' && /\.\s*registerAction\s*\(/.test(c)))
    .map(([p]) => pad(p)).sort();
  for (const p of gevonden.registerAction) if (!kaart1.includes(p)) fouten.push(p + ': roept registerAction aan op de Edge-kern en staat niet op de kaart als schrijver van capability-register met die aanroep als citaat');
  for (const p of kaart1) if (!gevonden.registerAction.includes(p)) fouten.push(p + ': staat op de kaart als schrijver via registerAction, maar de lezer vindt de aanroep niet');
  /* 2 en 3: wie de lezer vindt, staat erop met de s. */
  for (const naam of Object.keys(ATTR)) {
    for (const p of gevonden[naam]) if (!schrijver(p, naam)) fouten.push(p + ': zet ' + ATTR[naam] + ' op body en staat niet op de kaart als ' + naam + ':s');
  }
  for (const a of ANDERE_REGISTERS) if (!benut.has(a)) fouten.push(a.pad + ': uitzondering voor `' + a.ontvanger + '.registerAction` zonder aanroep; haal hem weg');
  for (const p of ZONDER_LADER) {
    if (!uitgezonderd.includes(p)) fouten.push(p + ': uitzondering zonder lader, maar het bestand zet de wereld niet (meer); haal hem weg');
    const naam = p.split('/').pop();
    const lader = lijst.find(([q, code]) => q !== p && code.includes(naam));
    if (lader) fouten.push(p + ': staat als zonder lader uitgezonderd, maar ' + lader[0] + ' noemt ' + naam);
  }
  for (const k of Object.keys(gevonden)) gevonden[k].sort();
  return { fouten, gevonden, uitgezonderd: uitgezonderd.sort(), andereRegisters: ANDERE_REGISTERS.map(a => a.pad + ' (' + a.ontvanger + ')') };
}

/* ------------------------------------------------------------ DE AFLEIDING */
function bouw(wand = wandeling()) {
  const lijst = KAART.map(([p, laag, v, rollen]) => {
    const vol = pad(p), bron = lees(vol);
    const verantwoordelijkheden = v.split(' ').filter(Boolean).flatMap(t => {
      const [naam, letters] = t.split(':');
      return [...letters].map(l => ({ naam, als: ALS[l] }));
    }).sort((a, b) => (a.naam + a.als).localeCompare(b.naam + b.als));
    return { pad: vol, laag, rollen: rollen.map(([rol, etiket, wat, citaat]) => ({ rol, etiket: etiket === '-' ? null : etiket, wat, citaat })),
      verantwoordelijkheden, gemeten: meet(vol, kaal(vol, bron)) };
  }).sort((a, b) => a.pad.localeCompare(b.pad));
  const verantwoordelijkheden = {};
  for (const naam of [...NAMEN].sort()) {
    const wie = als => lijst.filter(b => b.verantwoordelijkheden.some(v => v.naam === naam && v.als === als)).map(b => b.pad);
    verantwoordelijkheden[naam] = { schrijvers: wie('schrijver'), beslissers: wie('beslisser'), lezers: wie('lezer') };
  }
  const dubbeleEigenaars = Object.keys(verantwoordelijkheden)
    .filter(n => verantwoordelijkheden[n].schrijvers.length > 1 || verantwoordelijkheden[n].beslissers.length > 1)
    .map(n => ({ naam: n, schrijvers: verantwoordelijkheden[n].schrijvers, beslissers: verantwoordelijkheden[n].beslissers, waarom: WAAROM[n] || null }));
  const lagen = {};
  for (const l of [...LAGEN].sort()) lagen[l] = lijst.filter(b => b.laag === l).map(b => b.pad);
  const { levend, ...dodeKanalen } = kanalen(wand);
  const af = afgeleid(wand);
  return {
    uitleg: 'Gemaakt met scripts/edgekaart.js; de methode staat in de kop. Rollen en verantwoordelijkheden zijn VERKLAARD en elk citaat staat letterlijk in zijn bestand. ' +
      'Elk citaat hangt aan het etiket (naam:letter) waar het over gaat, of aan null als het over geen van de veertien gaat; elk etiket s of b heeft minstens een citaat. ' +
      'schrijver = houdt of zet de toestand zelf; beslisser = kiest de uitkomst; lezer = leest haar of voedt haar via de API van de eigenaar. ' +
      '`gemeten` komt uit de bron zonder commentaar en kent alleen letterlijke namen: attributen alleen op body/html of een alias daarvan, opslag `onbekend` als de opslag niet letterlijk local- of sessionStorage heet. ' +
      'dodeKanalen gaat over rtg-events in public/ (zonder public/dist, .min.js en bundels, wel hun delen) plus index.html; een naam in luisterZonderZender kan nog een zender hebben onder `dynamisch`. ' +
      '`afgeleid` is wat de lexicale lezer over dezelfde wandeling vindt en naast de kaart legt: wie registerAction aanroept op de Edge-kern, wie data-rtg-world en wie data-rtg-edge-2-state op body zet. Een ondergrens: een samengestelde naam ontsnapt. ' +
      'Een dubbele eigenaar is een vondst en geen oordeel.',
    bestanden: lijst, verantwoordelijkheden, lagen, dubbeleEigenaars, dodeKanalen,
    afgeleid: { registerAction: af.gevonden.registerAction, wereld: af.gevonden.wereld, zichtbaarheidsstand: af.gevonden.zichtbaarheidsstand,
      zonderLader: af.uitgezonderd, andereRegisters: af.andereRegisters },
    telling: { bestanden: lijst.length, rollen: lijst.reduce((n, b) => n + b.rollen.length, 0), dubbeleEigenaars: dubbeleEigenaars.length,
      dodeKanalen: dodeKanalen.luisterZonderZender.length + dodeKanalen.zendZonderLuisteraar.length, levendeKanalen: levend }
  };
}

function main() {
  const argv = process.argv.slice(2), stil = argv.includes('--stil');
  const fouten = keur();
  if (fouten.length) {
    console.error('EDGEKAART: de verklaring past niet meer bij de code (' + fouten.length + '):');
    fouten.forEach(f => console.error('  ' + f));
    process.exitCode = 1; return;
  }
  const wand = wandeling(), af = afgeleid(wand);
  if (af.fouten.length) {
    console.error('EDGEKAART: de kaart mist wat de lezer in de code vindt (' + af.fouten.length + '):');
    af.fouten.forEach(f => console.error('  ' + f));
    process.exitCode = 1; return;
  }
  const r = bouw(wand);
  const zonder = r.dubbeleEigenaars.filter(d => !d.waarom).map(d => d.naam);
  const los = Object.keys(WAAROM).filter(n => !r.dubbeleEigenaars.some(d => d.naam === n));
  if (zonder.length || los.length) {
    if (zonder.length) console.error('EDGEKAART: dubbele eigenaar zonder WAAROM: ' + zonder.join(', '));
    if (los.length) console.error('EDGEKAART: WAAROM zonder dubbele eigenaar: ' + los.join(', '));
    process.exitCode = 1; return;
  }
  const t = r.telling, dk = r.dodeKanalen;
  const regel = 'EDGEKAART: ' + t.bestanden + ' bestanden, ' + t.rollen + ' rollen, ' + t.dubbeleEigenaars + ' dubbele eigenaars, ' +
    t.dodeKanalen + ' dode kanalen (' + dk.luisterZonderZender.length + ' luisteren zonder zender, ' +
    dk.zendZonderLuisteraar.length + ' zenden zonder luisteraar), ' + t.levendeKanalen + ' levend, ' + dk.dynamisch.length + ' dynamisch';
  if (argv.includes('--controle')) {
    /* Ontbreken en onleesbaar zijn twee toestanden, en geen van beide is "loopt
       achter" (scripts/stillezing.js): ze zakken allebei, met hun eigen reden. */
    let oud;
    try { oud = JSON.parse(fs.readFileSync(UIT, 'utf8')); }
    catch (e) {
      console.error(e.code === 'ENOENT' ? 'EDGEKAART.json bestaat niet. Draai: npm run edgekaart'
        : 'EDGEKAART.json is ONLEESBAAR (' + e.message + '). Draai: npm run edgekaart');
      process.exitCode = 1; return;
    }
    delete oud.stempel;
    if (JSON.stringify(oud) !== JSON.stringify(r)) {
      console.error('EDGEKAART.json loopt achter op de code. Draai: npm run edgekaart');
      process.exitCode = 1; return;
    }
    console.log(regel + ' -- EDGEKAART.json is bij.');
    return;
  }
  fs.writeFileSync(UIT, JSON.stringify(Object.assign({ stempel: stempel() }, r), null, 2) + '\n');
  console.log(regel);
  if (stil) return;
  for (const d of r.dubbeleEigenaars) console.log('  dubbel ' + d.naam + ': ' + d.schrijvers.length + ' schrijvers, ' + d.beslissers.length + ' beslissers');
  for (const k of dk.luisterZonderZender) console.log('  luistert zonder zender: ' + k.naam);
  for (const k of dk.zendZonderLuisteraar) console.log('  zendt zonder luisteraar: ' + k.naam);
  for (const k of dk.dynamisch) console.log('  dynamisch (' + k.soort + '): ' + k.pad + ' ' + k.uitdrukking);
}

if (require.main === module) main();
module.exports = { KAART, WAAROM, DRAAGT, ROLLEN, ONTVANGERS, ANDERE_REGISTERS, ZONDER_LADER, keur, afgeleid, wandeling, bouw, events, meet };
