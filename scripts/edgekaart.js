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
                verouderde kaart. En elke dubbele eigenaar moet een verklaring in
                WAAROM hebben, en elke verklaring een dubbele eigenaar.
     GEMETEN    per bestand, op de bron ZONDER commentaar (scripts/lib/bron.js):
                globals, events, data-attributen op body/html, opslagsleutels en
                fetch-paden. Plus de dode kanalen over heel public/.

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

/* DE VERKLARING. [pad, laag, 'naam:letters', rollen]. Een pad zonder public/
   ervoor woont in public/shared/. s = schrijver (houdt of zet de toestand
   ZELF), b = beslisser (kiest de uitkomst), l = lezer (leest haar, of voedt haar
   via de API van de eigenaar -- wie via declareer of setPresence schrijft, is
   geen eigenaar). Een uitzondering, met opzet: wie het TWEEDE register vult
   (registerAction op de Edge-kern), staat er als schrijver op. Dat register moet
   leeg (ronde 2), en alleen zo ziet de kaart wie het nog vult. */
const KAART = [
  ['adaptief.js', 'grammatica-kern', 'capability-register:b gewicht:b', [
    ['schrijft', 'de leer als globale', 'root.RTGAdaptiefLeer = leer;'],
    ['beslist', 'keuring: bureau wel, telefoon niet', 'if (opBureau && !(c.vormen.telefoon || []).length) {'],
    ['beslist', 'standaardgewicht licht', "c.gewicht = (spec && spec.gewicht) || 'licht';"]]],
  ['adaptief/register.js', 'grammatica-kern', 'capability-register:s vluchtige-context:sb gewicht:l waarom:b', [
    ['schrijft', 'declaratie, laatste wint', 'caps[c.id] = c;'],
    ['schrijft', 'context naar de luisteraars', 'luisterCtx.slice().forEach(function (f) { try { f(nu); } catch (e) {} });'],
    ['beslist', 'slikt een gelijke context', 'if (v.sleutel === nu.sleutel) return nu;'],
    ['leest', 'zonder grammatica een gebrek; het gewicht blijft', "if (!gram && c.gewicht && c.gewicht !== 'licht') {"],
    ['beslist', 'verhinderd gaat niet door', 'return !((st && st.verhinderd) || c.verhinderd);']]],
  ['adaptief/grammatica.js', 'grammatica-kern', 'gewicht:sb waarom:sb gebaar-drempel:s', [
    ['schrijft', 'de vijf trappen', 'var GEWICHT = {'],
    ['beslist', 'terug zonder weg terug is bewust', "return g === 'terug' && !kanTerug ? 'bewust' : g;"],
    ['schrijft', 'de vijf bronnen van een verhindering', 'var BRONNEN = {'],
    ['beslist', 'onbekende bron wordt toestand', "var bron = BRONNEN[v.bron] ? v.bron : 'toestand';"],
    ['schrijft', 'vasthoudduur per trap', 'var VASTHOUD = { zwaar: 900, plechtig: 1200 };'],
    ['schrijft', 'de drempels van de gebaren', 'var DREMPELS = { lang: 480, stil: 8, omhoog: 44, diep: 150, veeg: 36, sluit: 90,']]],
  ['adaptief/diepte.js', 'grammatica-render', 'gebaar-drempel:l onderbalk:l capability-register:l', [
    ['leest', 'items uit het register', 'return (w.RTGAdaptief && w.RTGAdaptief.voorNu()) || [];'],
    ['leest', 'de trekdrempels uit de tabel', 'var EERSTE = D.omhoog, TWEEDE = D.diep;'],
    ['schrijft', 'trekstand op .cmd-balk', "b.dataset.trek = ver >= TWEEDE ? 'twee' : (ver >= EERSTE ? 'een' : '');"]]],
  ['adaptief/balk.js', 'grammatica-render', 'onderbalk:sb capability-register:l vluchtige-context:l wereld:l', [
    ['rendert', 'de contextzone in .cmd-balk', "zone.className = 'cmd-acties';"],
    ['beslist', 'contextacties, anders werelden', 'if (!items.length && !panes().length && !vastBladen)'],
    ['schrijft', 'rij voor de adaptieve Edge', 'o.root.rtgEdgeItems = function () { return laatsteRij.slice(); };']]],
  ['adaptief/balkknop.js', 'grammatica-render', 'gewicht:b waarom:b gebaar-drempel:l', [
    ['beslist', 'verhinderd legt uit', 'if (it.verhinderd) { uitleg(it); return; }'],
    ['beslist', 'zonder gewichtlaag alleen licht', "if ((it.gewicht || 'licht') !== 'licht') {"],
    ['leest', 'lang drukken uit de tabel', 'klok = w.setTimeout(function () { klok = null; uitleg(it); }, D.lang);']]],
  ['adaptief/orb.js', 'grammatica-render', 'gewicht:b waarom:b gebaar-drempel:l capability-register:l', [
    ['beslist', 'splitst kan en kan niet', 'kan: items.filter(function (x) { return !x.verhinderd; }),'],
    ['beslist', 'zonder gewichtlaag alleen licht', "if ((it.gewicht || 'licht') !== 'licht') return;"],
    ['leest', 'lang drukken uit de tabel', 'return g && g.DREMPELS && g.DREMPELS.lang;']]],
  ['adaptief/lagen.js', 'grammatica-render', 'gebaar-drempel:l', [
    ['rendert', 'lade, paneel of taak', "var wortel = el('div', 'rtg-laag rtg-laag-' + soort);"],
    ['leest', 'de sluitveeg uit de tabel', 'if (y > D.sluit) sluit();'],
    ['schrijft', 'een stap in de geschiedenis', "w.history.pushState({ rtgLaag: ++teller }, '')"]]],
  ['adaptief/vasthoud.js', 'grammatica-render', 'gebaar-drempel:l', [
    ['beslist', 'vol vasthouden bevestigt', 'if (deel >= 1) { stop(); af(); return; }'],
    ['leest', 'loslaten onder de poging telt niet', 'if (ver <= D.poging) return;']]],
  ['adaptief/gewicht.js', 'trust', 'gewicht:bl waarom:l trust-rail:l gebaar-drempel:l', [
    ['beslist', 'de weg per trap', "if (g === 'bewust') return bewust(it, bev);"],
    ['beslist', 'compensatie is nooit ongedaan maken', "if (cap && cap.herstel === 'compensatie' && it.ongedaan)"],
    ['leest', 'het effectieve gewicht', "var g = gram.effectief(it.gewicht, typeof it.ongedaan === 'function');"],
    ['schrijft', 'melding achteraf in de rail', 'r.meld({ tekst: tekst, ongedaan: ongedaan });'],
    ['leest', 'vasthoudduur uit de grammatica', "duur: gram.VASTHOUD[plechtigStap ? 'plechtig' : 'zwaar'],"]]],
  ['adaptief/waarom.js', 'trust', 'waarom:sb gewicht:l', [
    ['schrijft', 'tweede lijst van de vijf bronnen', 'var BRONWOORD = {'],
    ['beslist', 'eigen stap, los of niets aan te doen', "else regel(lijf, 'Hier kunt u zelf niets aan veranderen.', 'wm-stap');"],
    ['projecteert', 'belofte volgt het effectieve gewicht', "regel(lijf, BELOFTE[gram && gram.effectief ? gram.effectief(it.gewicht"]]],
  ['adaptief/rail.js', 'trust', 'trust-rail:sb vluchtige-context:l', [
    ['leest', 'de rail uit de context', 'var uit = (ctx && Array.isArray(ctx.rail) ? ctx.rail : []).slice();'],
    ['leest', 'meet zelf de verbinding', 'if (w.navigator && w.navigator.onLine === false) {'],
    ['beslist', 'strook weg als er niets is', 'r.hidden = !uit.length && !melding;'],
    ['schrijft', 'de rail-API', 'w.RTGRail = { teken: teken, zet: zet, meld: meld, wis: wisMelding,']]],
  ['adaptief/brug.js', 'brug', 'vluchtige-context:bl capability-register:l gewicht:b', [
    ['beslist', 'alleen het actieve blad levert', 'if (frame !== actiefFrame()) return;'],
    ['schrijft', 'herdeclareert met een postbode', 'A.declareer({ id: c.id, naam: c.naam, label: c.label, groep: c.groep'],
    ['beslist', 'standaard licht over de grens', "gewicht: c.gewicht || 'licht',"],
    ['schrijft', 'zet de context bovenin', 'A.context(ctx);']]],
  ['rtg-adaptive-edge.js', 'adaptieve-balk', 'presence:s identiteit:s voortzetting:s zichtbaarheidsstand:sb onderbalk:s capability-register:l vluchtige-context:l', [
    ['schrijft', 'presence in het eigen model', 'rt.model.presence = input && input.label ?'],
    ['schrijft', 'identiteit in het eigen model', 'rt.model.identity = acting ?'],
    ['schrijft', 'voortzetting in het eigen model', 'rt.model.continuation = input && input.title ?'],
    ['schrijft', 'balkstand op body', 'd.body.dataset.rtgAdaptiveState = rt.model.state;'],
    ['beslist', 'Edge 2 compact wordt peek', "else if (state === 'compact') setState('peek', 'auto');"],
    ['schrijft', 'klaar-vlag; CSS zet de onderbalk weg', "d.body.dataset.rtgAdaptiveReady = 'true';"],
    ['leest', 'een tik op het tweede register via de kern', 'if (custom && custom.run) return K.voer(custom, w);']]],
  ['rtg-adaptive-edge-core.js', 'adaptieve-balk', 'capability-register:sb bevoegdheid:b zichtbaarheidsstand:b gewicht:bl', [
    ['schrijft', 'tweede register, laatste wint', 'state.registry[id] = { id: id'],
    ['beslist', 'alleen licht in dit register', "if (item.confirm || (item.gewicht && item.gewicht !== 'licht')) {"],
    ['leest', 'een tik langs de gewichtlaag', "return w.RTGGewicht.voer({ id: e.id, naam: e.label, gewicht: 'licht', doe: e.run })"],
    ['beslist', 'ids buiten het patroon eruit', 'if (!state || !/^[a-z][a-z0-9-]{1,39}$/.test(id)) return false;'],
    ['beslist', 'allowed: boolean of functie', "typeof item.allowed === 'function' ? !!item.allowed()"],
    ['beslist', 'vier balkstanden', "var STATES = Object.freeze(['peek', 'dock', 'deck', 'expanded']);"]]],
  ['rtg-adaptive-edge-controls.js', 'adaptieve-balk', 'capability-register:bl hoofdactie:s vluchtige-context:l', [
    ['leest', 'handelingen via het blikveld', 'if (w.RTGEdgeBlikveld) return w.RTGEdgeBlikveld.acties();'],
    ['beslist', 'welke paginaknop geoogst wordt', 'if (label(el) && available(el, root) && (!tab || !tabs.has(tab))'],
    ['rendert', 'verhuist de hoofdactie in het blad', 'rt.primarySlot = primary; rt.sheet.appendChild(primary);'],
    ['rendert', 'bladtitel uit RTGAdaptief', 'if (A && A.context().titel) rt.sheetTitle.textContent = A.context().titel;']]],
  ['rtg-adaptive-edge-input.js', 'adaptieve-balk', 'gebaar-drempel:l zichtbaarheidsstand:b capability-register:l', [
    ['leest', 'veeg opzij wisselt deck, drempel uit de tabel', 'if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > D.veeg)'],
    ['leest', 'lang drukken uit de tabel', '}, D.lang);'],
    ['beslist', 'auto-peek bij scrollen', "if (moved < 8 || rt.manual || rt.model.state === 'expanded') return;"],
    ['beslist', 'omhoog naar RTGDiepte', 'if (-dy >= D.diep) depth.tweede(); else depth.eerste();']]],
  ['rtg-adaptive-edge-loader.js', 'laden', '', [
    ['beslist', 'overslaan als de global bestaat', 'if (global && w[global]) { done(true); return; }'],
    ['schrijft', 'start de Edge na de keten', 'w.RTGAdaptiveEdge.start(d, w);']]],
  ['rtg-adaptive-edge-signals.js', 'adaptieve-balk', 'presence:b hoofdactie:l capability-register:s', [
    ['leest', 'eenmalig de hoofdactie', "knop = d.querySelector('[data-rtg-edge-primary]:not([hidden])');"],
    ['schrijft', "'primary' in het tweede register", "api.registerAction({ id: 'primary', label: label.slice(0, 80), allowed: !knop.disabled });"],
    ['beslist', 'pending wordt presence', "if (staat === 'pending') api.setPresence({ label: label + ' wordt uitgevoerd'"]]],
  ['rtg-adaptive-edge-claim.js', 'adaptieve-balk', 'onderbalk:sb', [
    ['beslist', 'alleen vaste of plakkende balken', "if (stijl.position !== 'fixed' && stijl.position !== 'sticky') return false;"],
    ['schrijft', 'markeert de geclaimde balken', 'winnaars.forEach(function (el) { el.classList.add(EIGEN); });']]],
  ['rtg-edge-system.js', 'edge-casco', 'wereld:sb vluchtige-context:s hoofdactie:s zichtbaarheidsstand:s', [
    ['beslist', 'wereld: gevraagd, anders work', "var key = o.world || 'work', cfg = C[key] || C.work;"],
    ['schrijft', 'wereld op body', 'd.body.dataset.rtgWorld = key;'],
    ['schrijft', 'eigen context', 'A.ctx = Object.assign({}, A.ctx, c || {});'],
    ['schrijft', 'tekst van de hoofdactie', 'hoofdactie.hidden = !hoofdtekst; hoofdactie.textContent = hoofdtekst;'],
    ['schrijft', 'Edge 1-vouwstand', "d.body.classList.add('rtg-edge-fold')"]]],
  ['rtg-edge-library.js', 'edge-casco', 'hoofdactie:s onderbalk:s trust-rail:sb wereld:l', [
    ['rendert', 'de hoofdactieknop', '<div class="rtg-edge-action"><button type="button" data-rtg-edge-primary></button></div>'],
    ['rendert', 'de onderbalk van de casco', '<footer class="rtg-edge-bottom">'],
    ['leest', 'peilt gereedheid', "fetch('/api/ready', { cache: 'no-store' })"],
    ['beslist', 'Beveiligd, TEST of Beperkt', "magnaat ? 'TEST' : ok ? 'Beveiligd' : 'Beperkt';"],
    ['schrijft', 'eigen gezondheidsvlag op de statusknop', "state.parentNode.dataset.edgeHealth = state.textContent === 'Beveiligd' ? 'ok' : 'waiting';"],
    ['projecteert', 'vaste wereldvolgorde', "var ORDE = ['living', 'work', 'travel', 'foundation'];"]]],
  ['rtg-edge-worlds.js', 'edge-casco', 'wereld:s', [
    ['schrijft', 'wereldcatalogi naast MAPPEN', 'w.RTGEdgeWorlds = {'],
    ['projecteert', 'rail uit ids, onbekend valt stil weg', 'meta.tools = rail.map(function (id) { return alles.find(']]],
  ['rtg-edge-icons.js', 'edge-casco', '', [
    ['schrijft', 'gedeelde icoonpaden', 'w.RTGEdgeIcons = {']]],
  ['rtg-edge-appbar.js', 'edge-casco', 'onderbalk:sb', [
    ['beslist', 'welke paginabalk mee gaat', "return el.hasAttribute('data-rtg-edge-bar') || (el.parentElement === d.body"],
    ['rendert', 'verhuist de balk zelf', 'rt.slot.appendChild(el);'],
    ['schrijft', 'de Edge bezit een appbalk', "rt.body.setAttribute('data-rtg-edge-appbar', 'true');"]]],
  ['rtg-edge-command.js', 'edge-casco', 'onderbalk:sb', [
    ['beslist', 'neemt het menu tot 999 px', "var media = venster.matchMedia('(max-width:999px)')"],
    ['schrijft', 'claimt de menuknop', "menu.setAttribute('data-rtg-command-owner', 'true');"]]],
  ['rtg-edge-preferences.js', 'edge-casco', 'onderbalk:bl voortzetting:l', [
    ['beslist', 'layoutknop weg buiten de werkruimte', "if (!e.workspace) e.root.querySelector('.rtg-edge-layout').hidden = true;"],
    ['schrijft', 'contexttoken voor Edge 2', "w.RTGEdge2.registerContext(tokens.concat('world-shell'));"],
    ['bewaart', 'dichtheid via de routecontext', 'if (w.RTGRouteMemory) w.RTGRouteMemory.save();']]],
  ['rtg-edge-smart-menu/rtg-edge-smart-menu-00.js', 'edge-casco', 'wereld:b voortzetting:sb onderbalk:l', [
    ['beslist', 'het blad gaat voor de casco', "var cfgBlad = blad !== 'geen' && w.RTGEdgeWorlds && w.RTGEdgeWorlds[blad];"],
    ['bewaart', 'recent bij elke lezing', 'sessionStorage.setItem(OPSLAG, nu);'],
    ['beslist', 'geen vorige: de publieke ingang', "vorige = cfg ? cfg.huis || cfg.home : '/apps/app.html';"],
    ['leest', 'appbalken als lokale acties', "root.querySelectorAll('.rtg-edge-appslot .rtg-edge-owned-bar a[href]"]]],
  ['rtg-edge-smart-menu/rtg-edge-smart-menu-01.js', 'edge-casco', 'wereld:l', [
    ['beslist', 'Heel RTG thuis, Hier elders', "gezicht(rt, wereldHome() ? 'all' : 'here', false);"],
    ['schrijft', 'menuknop wijst naar de index', "menu.setAttribute('aria-controls', index.id);"]]],
  ['rtg-edge-2.js', 'edge-2', 'zichtbaarheidsstand:sb onderbalk:s', [
    ['schrijft', 'Edge 2-stand op body', 'rt.state=stand;rt.body.setAttribute(CONTRACT.state,stand);'],
    ['beslist', 'handmatig wint van automatiek', "if(bron==='auto'&&rt.manual)return rt.state;"],
    ['bewaart', 'handmatige stand per pad', 'voorkeurSchrijf(opslag(rt.win),stand,rt.win.location&&rt.win.location.href);'],
    ['rendert', 'paginabalken naar het contextpaneel', "el.setAttribute('data-rtg-edge-2-contextual',b.token);slot.appendChild(el);"]]],
  ['rtg-edge-2-context.js', 'edge-2', 'zichtbaarheidsstand:b onderbalk:b gebaar-drempel:b', [
    ['beslist', 'omlaag compact, omhoog overview', "return delta>0?'compact':'overview';"],
    ['beslist', 'onder 14 px telt niet', 'Math.abs(delta)<14'],
    ['beslist', 'een gebaar is 1500 ms vers', 'var GESTURE_MS=1500;'],
    ['beslist', 'auto: alle twaalf balktokens', "if(raw==='auto')return{ok:true,auto:true,tokens:Object.keys(CONTEXT)};"]]],
  ['rtg-edge-2-loader.js', 'laden', 'hoofdactie:sb zichtbaarheidsstand:sb gebaar-drempel:l', [
    ['beslist', 'hoofdactie per hard pad', "if (pad === '/apps/rtg.html') {"],
    ['schrijft', 'muteert het object van de casco', 'e.onAction = doe; e.ctx.actie = tekst; k.hidden = false; k.textContent = tekst;'],
    ['schrijft', 'standaardstand overview', "b.setAttribute('data-rtg-edge-2-state', 'overview');"],
    ['beslist', 'tweede autoregel voor .wk-stage', "if (nu <= 32 || verschil < -14) w.RTGEdge2.setState('overview'"],
    ['leest', 'de gebaarversheid van Edge 2', 'if (!w.RTGEdge2.gestureFresh(gebaar)) return;'],
    ['schrijft', 'vensterboolean: een dialoog is open', "if (open) b.setAttribute(VENSTER_ATTR, 'true'); else b.removeAttribute(VENSTER_ATTR);"]]],
  ['rtg-edge-2-reveal.js', 'edge-2', 'zichtbaarheidsstand:l', [
    ['rendert', 'herstelgrepen boven en onder', "knop.className = 'rtg-edge-2-edge-reveal rtg-edge-2-edge-reveal--' + kant[0];"],
    ['schrijft', 'terug naar overview via de API', "if (win.RTGEdge2) win.RTGEdge2.setState('overview', { source: 'edge' });"],
    ['schrijft', 'theme-color, ook in rtg-themas.js', 'meta.content = kleur;']]],
  ['randen.js', 'laden', 'wereld:sbl', [
    ['leest', 'statische wereld is leidend', '.includes(d.body.dataset.rtgWorld)) wereld = d.body.dataset.rtgWorld;'],
    ['beslist', 'eigen padlijst voor de wereld', "else if (['/apps/reizen.html'].includes(pad)) wereld = 'travel';"],
    ['schrijft', 'wereld op body in een frame', 'd.body.dataset.rtgWorld = wereld;'],
    ['beslist', 'start de ene Edge', "laad('/shared/rtg-edge-system.js', 'RTGEdge', function (systeemKlaar) {"]]],
  ['rtg-themas.js', 'schil', 'zichtbaarheidsstand:l', [
    ['leest', 'hertelt bij elke Edge 2-stand', "'data-rtg-edge-2', 'data-rtg-edge-2-rendered', 'data-rtg-edge-2-state',"],
    ['schrijft', 'theme-color, ook in reveal.js', "if (meta) meta.setAttribute('content', bovenrand(th));"],
    ['bewaart', 'het gekozen thema', "localStorage.setItem(KEY, geldig(t) || 'onyx')"]]],
  ['basis/basis-01ac-edge.js', 'laden', 'wereld:l', [
    ['beslist', 'randen.js alleen bij een wereld', "indexOf(b.getAttribute('data-rtg-world')) < 0) return;"]]],
  ['basis/basis-01ad-intelligence.js', 'laden', '', [
    ['beslist', 'laadt controllers die ontbreken', 'if (window[bron[1]] || document.querySelector(']]],
  ['basis/basis-01aa-continue.js', 'laden', '', [
    ['beslist', 'laadt de Continue Key', "if (!window.RTGContinueKey && !document.getElementById('rtgContinueKeyJs') &&"]]],
  ['command.js', 'schil', 'bevoegdheid:b identiteit:l', [
    ['beslist', 'sessie en dichte intakepoort', 'function mag(){return aangemeld()&&poortDicht()}'],
    ['leest', 'sessiestand van app-main', "return !!(app&&app.classList.contains('active'))"],
    ['beslist', 'vangt Home van de Edge af', 'if(!a||!mag()||!tafel)return;e.preventDefault();e.stopPropagation();thuis()']]],
  ['command/werktafel.js', 'schil', 'onderbalk:s voortzetting:bl vluchtige-context:l', [
    ['rendert', 'bladen in de Command-balk', "b.className='cmd-balkblad'+(i===actief?' actief':'');"],
    ['beslist', 'hooguit twee bladen', 'if(panes.length>=2)verwijder(actief>=0?actief:0);'],
    ['bewaart', 'bladen bij elke sync', 'w.RTGCommandGeheugen.schrijf(panes,actief);'],
    ['leest', 'hervat de laatste bladen', 'var g=w.RTGCommandGeheugen.lees();if(!g)return;']]],
  ['command/bladstand.js', 'schil', 'wereld:sbl', [
    ['leest', 'de echte plek van het blad', 'wereld=id.classify(pad)'],
    ['beslist', 'vier werelden of geen', "if(WERELDEN.indexOf(wereld)<0)wereld='geen';"],
    ['schrijft', 'wereldlabel op body', "d.body.setAttribute('data-rtg-blad-wereld',wereld)"],
    ['schrijft', 'wachtpost in de geschiedenis', "w.history.pushState({rtgWerktafel:1},'')"]]],
  ['command/geheugen.js', 'schil', 'voortzetting:sb', [
    ['bewaart', 'hooguit twee bladen', 'else w.localStorage.setItem(SLEUTEL, JSON.stringify('],
    ['beslist', 'alleen paden binnen het huis', "b.url.charAt(0) === '/' && b.url.charAt(1) !== '/'"]]],
  ['rtg-world-identity.js', 'continuiteit', 'wereld:s', [
    ['schrijft', 'wereld op body uit het MANIFEST', "body.setAttribute('data-rtg-world', wereld);"]]],
  ['rtg-world-start.js', 'laden', '', [
    ['leest', 'wacht op het renderstempel', "body.getAttribute('data-rtg-edge-2-rendered')==='true'"],
    ['schrijft', 'klaar-vlag op body', "body.setAttribute('data-rtg-world-start','ready');"]]],
  /* De Second Screen stond hier als schrijver en beslisser van de
     zichtbaarheidsstand. Zijn stand (peek, panel, workspace, focus) gaat over de
     bank van de schil (.cmd-bank) en niet over de Edge: een INDELINGSCORRECTIE in
     ronde 2, geen samenvoeging (EDGE.md par. 1). */
  ['interface/second-screen.js', 'schil', 'vluchtige-context:l', [
    ['leest', 'context van het bovendocument', 'return w.RTGAdaptief && w.RTGAdaptief.context ? w.RTGAdaptief.context() : {};']]],
  ['interface/second-screen-modules.js', 'schil', 'vluchtige-context:l', [
    ['leest', 'Nu relevant: de titel uit RTGAdaptief', 'function laatsteContext() { return (A && A.context && A.context()) || laatste || {}; }']]],
  ['interface/workspace-context.js', 'schil', 'vluchtige-context:sb', [
    ['schrijft', 'een eigen current naast RTGAdaptief', "current = next; var change = { value: get(), reason: reason || 'host-update' };"],
    ['beslist', 'slikt een gelijke context', 'var next = clean(value); if (JSON.stringify(next) === JSON.stringify(current)) return get();']]],
  ['interface/world-desktop-frame.js', 'schil', 'capability-register:l onderbalk:l identiteit:l', [
    ['projecteert', 'oogst handelingen uit het frame', 'var A = scope.win.RTGAdaptief, items = A && A.voorNu ? A.voorNu() : [];'],
    ['schrijft', 'laat de Edge frame-balken claimen', 'if (w.RTGAdaptiveEdgeClaim) w.RTGAdaptiveEdgeClaim.claim(doc, win);'],
    ['beslist', 'hooguit vier frames', "if (!x && entries.length >= 4) { o.announce(U.value('limit')); return false; }"],
    ['leest', 'herlaadt bij een sessiewissel', "e.key === 'rtg_member_token' || e.key === 'rtf_sessie'"]]],
  ['interface/world-desktop-home.js', 'schil', 'capability-register:s wereld:sl', [
    ['leest', 'de wereld van het bureau', 'world = d.body.dataset.worldHome'],
    ['schrijft', 'wereldlabel in het merk van de Edge', 'label.translate = false; brand.appendChild(label);'],
    ['schrijft', "'home' in het tweede register", "w.RTGAdaptiveEdge.registerAction({ id: 'home', label: U.value('overview'), run: function () {"]]],
  ['rtg-continue-key-core.js', 'continuiteit', 'hoofdactie:sb', [
    ['rendert', 'herbouwt de hoofdactieknop', "b.appendChild(houder); zetAttr(b, 'data-rtg-morph-action', '');"],
    ['beslist', 'is de hoofdactie bruikbaar', "if (s && (s.display === 'none' || s.visibility === 'hidden'"],
    ['bewaart', 'anker globaal', 's.setItem(STORAGE, waarde); return true;']]],
  ['rtg-continue-key.js', 'continuiteit', 'hoofdactie:sb zichtbaarheidsstand:l', [
    ['beslist', 'alleen bij precies een hoofdactie', 'if (gevonden.length !== 1) return null;'],
    ['schrijft', 'anker op de hoofdactieknop', "C.setAttr(rt.button, 'data-rtg-key-anchor', waarde);"],
    ['leest', 'Edge 2 focus sluit de kiezer', "(body.getAttribute('data-rtg-edge-2-state') === 'focus' ||"]]],
  ['rtg-route-memory-core.js', 'continuiteit', 'voortzetting:sb', [
    ['bewaart', 'routecontext naar de opslag', 'storage.setItem(KEY, JSON.stringify(rows)); return true;'],
    ['beslist', '24 uur geldig', 'row.at > now + 60000 || row.at <= now - TTL'],
    ['beslist', 'hooguit 24 routes of 64 KB', 'while (rows.length > MAX || JSON.stringify(rows).length > BYTES) rows.shift();']]],
  ['rtg-route-memory.js', 'continuiteit', 'voortzetting:bl hoofdactie:l', [
    ['bewaart', 'naar sessionStorage', 'return C.writeStorage(win.sessionStorage, path, state);'],
    ['beslist', 'elke interactie breekt herstel af', 'interrupted = true; stopRestore(); queueSave();'],
    ['schrijft', 'anker via de publieke API', 'anchorDone = true; win.RTGContinueKey.setPosition(saved.anchor);']]],
  ['rtg-daily.js', 'afnemer', 'onderbalk:s bevoegdheid:b', [
    ['rendert', 'exportbalk als Edge-balk', "host.setAttribute('data-rtg-edge-bar', ''); d.body.appendChild(host);"],
    ['beslist', 'gast: knoppen in Edge-balken uit', "if (state === 'guest') d.querySelectorAll('[data-rtg-edge-bar]')"],
    ['schrijft', 'paginastand op body', 'd.body.dataset.dailyState = state;']]],
  ['social-intelligence-runtime.js', 'afnemer', 'capability-register:s trust-rail:s', [
    ['schrijft', "'social-context' in het tweede register", "edge.registerAction({ id: 'social-context', label: 'Sociale context bekijken'"],
    ['schrijft', 'overschrijft het actiedeck', "edge.setProjection({ deck: 'actions', actions: ['social-context'] });"],
    ['projecteert', 'verbinding uit het protocol', "? (location.protocol === 'https:' ? 'ONLINE / TLS' : 'ONLINE / LOCAL')"]]],
  /* De gebaarlaag van de lijsten (shared/gebaar.js, op elk scherm met basis.js)
     stond tot ronde 2 niet op de kaart, en daardoor leek gebaar-drempel na ronde 1
     een eigenaar te hebben. De code is niet veranderd; de kaart ziet hem nu. De
     borgtijd blijft 800 tot ronde 3 (besluit K-borg, EDGE.md par. 8). */
  ['gebaar/gebaar-02.js', 'afnemer', 'gebaar-drempel:b', [
    ['beslist', 'eigen richtingsdrempel naast DREMPELS', 'var RICHTING = 8;'],
    ['beslist', 'eigen stilte voor de klik erna', 'var STIL = 6;']]],
  ['gebaar/gebaar-03b.js', 'afnemer', 'gebaar-drempel:b gewicht:b', [
    ['beslist', 'eigen lang drukken naast DREMPELS.lang', '}, 520);'],
    ['beslist', 'eigen stilte per as naast DREMPELS.stil', 'Math.abs(e.clientX - g.x0) < 8 && Math.abs(e.clientY - g.y0) < 8) return;'],
    ['beslist', 'eigen borgtijd naast VASTHOUD, tot ronde 3', 'var BORGTIJD = 800;']]],
  ['edge/blikveld.js', 'blikveld', 'capability-register:l vluchtige-context:l wereld:l identiteit:l presence:l trust-rail:l voortzetting:l hoofdactie:l gewicht:l waarom:l bevoegdheid:l', [
    ['projecteert', 'een leesbeeld; schrijft niets', 'return { versie: 1, op: t, velden: velden, acties: gedaan, gebreken: gebreken };'],
    ['leest', 'de hoofdactie via zijn lezer', "H && typeof H.lees === 'function' ? H.lees(w) : null"],
    ['leest', 'het tweede register erbij', "gedaan.push({ id: a.id, naam: a.label, herkomst: 'edge-compat'"],
    ['projecteert', 'bevoegdheid zonder bron', "bevoegdheid: veld(null, 'geen', 'geen', t,"]]],
  ['edge/blikveld-hoofdactie.js', 'blikveld', 'hoofdactie:l', [
    ['leest', 'het actieve blad, alleen lezend', "querySelector('#rtgCommand .cmd-pane.actief iframe')"],
    ['leest', 'twee hoofdactiebronnen naast elkaar', "edgeLabel !== tekstVan(scherm[0])) gebreken.push('hoofdactie-dubbel')"],
    ['projecteert', 'herkomst blad of scherm', "herkomst: b ? 'blad:data-hoofdactie' : 'scherm:data-hoofdactie'"]]],
  ['edge/actiestaat.js', 'blikveld', 'gewicht:bl waarom:b bevoegdheid:l', [
    ['leest', 'hetzelfde effectieve gewicht', 'var gewicht = G && gram.effectief ? gram.effectief(gevraagd, kanOngedaan) : String(gevraagd);'],
    ['beslist', 'zonder tabel gaat zwaar dicht', "} else if (!G && gewicht !== 'licht') {"],
    ['beslist', 'alleen een serveroordeel telt', "if (i.oordeel.bron === 'server' && OORDEEL.indexOf(i.oordeel.uitkomst) >= 0)"],
    ['beslist', 'redenloos krijgt een vangnetzin', "gebreken.push('redenloos');"]]],
  ['public/apps/office/adaptief.js', 'afnemer', 'capability-register:l vluchtige-context:l', [
    ['schrijft', 'Office-context naar het register', 'A.context({ bron: bron, titel: titel(), acties:'],
    ['schrijft', 'werkbalkknop als capability', 'A.declareer({ id: id, naam: naamVan(b), label: labelVan(b)'],
    ['schrijft', 'wist ieders context', 'if (!bron || !knoppen.length) { A.wisContext(); return; }']]],
  ['public/apps/office/adaptief-staat.js', 'afnemer', 'trust-rail:l gewicht:l waarom:l capability-register:l', [
    ['projecteert', 'rail-onderdeel classificatie', "uit.push({ sleutel: 'classificatie', tekst: CLASSNAAM[k] || k,"],
    ['beslist', 'strikt: delen verhinderd', "var dicht = k === 'strikt';"],
    ['beslist', 'delen weegt bewust', "gewicht: 'bewust',"]]],
  ['public/apps/office/adaptief-pres.js', 'afnemer', 'capability-register:l', [
    ['schrijft', 'indeling als lade-capability', "A.declareer({ id: 'office.pres.indeling', naam: 'Indeling'"],
    ['schrijft', 'change op het echte element', "kies.dispatchEvent(new w.Event('change', { bubbles: true }));"]]],
  ['public/apps/bestanden/adaptief.js', 'afnemer', 'capability-register:l vluchtige-context:l gewicht:l trust-rail:l', [
    ['schrijft', 'bestandscontext', "A.context({ bron: 'bestanden', titel: f.naam || 'Bestand',"],
    ['beslist', 'ruimte pas boven 80%', 'if (deel >= 0.8) {'],
    ['beslist', 'gewicht hangt aan de toestand', "zet('bestanden.voorgoed', 'Voorgoed weg',"]]],
  ['public/apps/reizen-veilig.js', 'afnemer', 'capability-register:l vluchtige-context:l identiteit:l', [
    ['schrijft', 'zes bankhandelingen', "A.declareer({id:'reisveilig.'+item[0],naam:item[1],label:item[1]"],
    ['schrijft', 'actiesleutel om te ontdubbelen', "b.dataset.rtgActionKey='reisveilig.'+p.id;"],
    ['leest', 'het ledentoken', "function token(){try{return localStorage.getItem('rtg_member_token')}"]]],
  ['public/apps/reizen-performance.js', 'afnemer', 'vluchtige-context:l capability-register:l identiteit:l', [
    ['schrijft', 'titel in de context van de casco', 'w.RTGEdge.setContext({ title: bladNaam });'],
    ['schrijft', 'en in die van het register', "A.context({ bron: 'reizen.tabs', titel: 'TravelOS',"],
    ['beslist', 'alleen in een frame', 'if (!A || w.parent === w) return;']]],
  /* Twee schermen zetten de Edge 2-stand zelf op body, buiten setState om. */
  ['public/apps/werk/command-entry.js', 'afnemer', 'zichtbaarheidsstand:s', [
    ['schrijft', 'Edge 2-stand op body bij een hashwissel', "document.body.setAttribute('data-rtg-edge-2-state', 'overview');"]]],
  ['public/apps/foundation/os-publiek.html', 'afnemer', 'zichtbaarheidsstand:s', [
    ['schrijft', 'Edge 2-stand op body bij een stadswissel', "document.body.setAttribute('data-rtg-edge-2-state', 'overview');"]]],
  /* De landing (index.html in de wortel) draait de adaptieve Edge met een eigen
     host, vult het tweede register en zet de wereld per scene. */
  ['public/site/start/experience-edge.js', 'afnemer', 'capability-register:s wereld:s', [
    ['schrijft', 'zeven ids zonder run', 'edge.registerAction({ id: id, label: id, allowed: false });'],
    ['schrijft', 'de scenerijen met een run', "edge.registerAction({ id: 'experience-action-' + i, label: item.label, run: function () {"],
    ['schrijft', 'op alle vijf decks', 'edge.setProjection({ deck: deck, actions: ids });'],
    ['schrijft', 'wereld op body per scene', "d.body.dataset.rtgWorld = active.id === 'werelden' ? X.currentWorld() : active.dataset.tone;"]]],
  ['public/site/start/experience.js', 'afnemer', 'wereld:s', [
    ['schrijft', 'wereld op body in de werelden-scene', 'd.body.dataset.rtgWorld = currentWorld;']]],
  ['public/site/start/experience-graph.js', 'afnemer', 'wereld:s', [
    ['schrijft', 'wereld op body bij een keuze in de graaf', 'd.body.dataset.rtgWorld = id;']]]
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
  'gebaar-drempel': 'DREMPELS in grammatica.js is de tabel, en zes herkenners lezen hem. Twee plekken beslissen met eigen maten: de gebaarversheid van Edge 2 (1500 ms, 14 px) en de gebaarlaag van de lijsten (RICHTING 8 en STIL 6 in gebaar-02, lang drukken 520 ms en 8 px per as in gebaar-03b). Die laatste stond na ronde 1 niet op de kaart, waardoor deze verantwoordelijkheid een eigenaar leek te hebben; de code is niet veranderd, de kaart ziet hem nu.',
  waarom: 'De vijf bronnen staan twee keer (BRONNEN in grammatica.js, BRONWOORD in waarom.js), en verhinderd-gaat-niet-door wordt beslist in register.js, balkknop.js, orb.js en actiestaat.js naast de uitleg in grammatica.js en waarom.js.',
  zichtbaarheidsstand: 'Vier standmachines voor wat er van de Edge te zien is: Edge 2 (overview/compact/focus) met een tweede autoregel en een vensterboolean in de loader, de adaptieve balk (peek/dock/deck/expanded) die Edge 2 eenrichting volgt, en de Edge 1-vouwstand; ze delen geen stand. Daarnaast zetten twee schermen (Work en FoundationOS) de Edge 2-stand zelf op body, buiten setState om. De Second Screen stond hier tot ronde 2 en is eraf: zijn stand gaat over de bank van de schil, niet over de Edge.',
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
    for (const t of v.split(' ').filter(Boolean)) {
      const [naam, letters] = t.split(':');
      if (!NAMEN.includes(naam) || !/^[sbl]+$/.test(letters || '')) fouten.push(pad(p) + ': onbekende verantwoordelijkheid ' + t);
    }
    /* Het citaat moet in de CODE staan en niet in een opmerking erover: anders
       blijft de kaart groen nadat de geciteerde regel is weggehaald, zolang de
       kop hem nog noemt (gevonden door de tegenlezer van 23 september 2026). */
    const code = kaal(pad(p), bron);
    for (const [rol, , citaat] of rollen) {
      if (!ROLLEN.includes(rol)) fouten.push(pad(p) + ': onbekende rol ' + rol);
      if (citaat.length > 100 || citaat.includes('\n') || !code.includes(citaat)) fouten.push(pad(p) + ': citaat staat er niet (meer) in de code: ' + citaat);
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
function meet(p, s) {
  const globals = [...s.matchAll(/\b(?:w|window|root|g)\.(RTG[\w$]*)\s*=(?!=)/g)].map(m => m[1]);
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
  const opslag = [];
  for (const m of s.matchAll(/([\w$.()]+)\.(?:getItem|setItem|removeItem)\(\s*/g)) {
    const a = argumenten(s, m.index + m[0].length)[0] || '';
    const soort = /sessionStorage\)?$/.test(m[1]) ? 'sessionStorage' : /localStorage\)?$/.test(m[1]) ? 'localStorage' : 'onbekend';
    const sleutel = letterlijk(a) !== null ? letterlijk(a) : /^[\w$]+$/.test(a) && constante(s, a);
    opslag.push(soort + ' ' + (sleutel || '(dynamisch) ' + a.slice(0, 40)));
  }
  const fetchen = [...s.matchAll(/\bfetch\(\s*['"`](\/api\/[^'"`$?]*)/g)].map(m => m[1]);
  const ev = events(p, s);
  return { globals: uniek(globals), zendt: ev.zendt, luistert: ev.luistert, attributen: uniek(attributen),
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
function kanalen() {
  const bundel = new Set(Object.keys(bundels).map(k => 'public/' + k));
  const zenders = {}, luisteraars = {}, dynamisch = [];
  for (const p of bestanden('public', ['index.html']).filter(p => !bundel.has(p)).sort()) {
    const e = events(p, kaal(p, lees(p) || ''));
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

/* ------------------------------------------------------------ DE AFLEIDING */
function bouw() {
  const lijst = KAART.map(([p, laag, v, rollen]) => {
    const vol = pad(p), bron = lees(vol);
    const verantwoordelijkheden = v.split(' ').filter(Boolean).flatMap(t => {
      const [naam, letters] = t.split(':');
      return [...letters].map(l => ({ naam, als: ALS[l] }));
    }).sort((a, b) => (a.naam + a.als).localeCompare(b.naam + b.als));
    return { pad: vol, laag, rollen: rollen.map(([rol, wat, citaat]) => ({ rol, wat, citaat })),
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
  const { levend, ...dodeKanalen } = kanalen();
  return {
    uitleg: 'Gemaakt met scripts/edgekaart.js; de methode staat in de kop. Rollen en verantwoordelijkheden zijn VERKLAARD en elk citaat staat letterlijk in zijn bestand. ' +
      'schrijver = houdt of zet de toestand zelf; beslisser = kiest de uitkomst; lezer = leest haar of voedt haar via de API van de eigenaar. ' +
      '`gemeten` komt uit de bron zonder commentaar en kent alleen letterlijke namen: attributen alleen op body/html of een alias daarvan, opslag `onbekend` als de opslag niet letterlijk local- of sessionStorage heet. ' +
      'dodeKanalen gaat over rtg-events in public/ (zonder public/dist, .min.js en bundels, wel hun delen) plus index.html; een naam in luisterZonderZender kan nog een zender hebben onder `dynamisch`. ' +
      'Een dubbele eigenaar is een vondst en geen oordeel.',
    bestanden: lijst, verantwoordelijkheden, lagen, dubbeleEigenaars, dodeKanalen,
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
  const r = bouw();
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
module.exports = { KAART, WAAROM, keur, bouw, events, meet };
