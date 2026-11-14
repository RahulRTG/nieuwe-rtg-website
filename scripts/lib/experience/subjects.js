/* Bestaande inventaris- en signaturelezers; geen tweede catalogus. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const identity=require('../../../public/shared/rtg-world-identity');
const {files}=require('./compiler');
const {MAPPEN}=require('../wereldregister');
const {rijen,meetIngang}=require('../../appwerkt');
const {CONTRACT}=require('../appcontract');
const json=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const routeFor=(file,root)=>'/' + path.relative(path.join(root,'public'),file).replace(/\\/g,'/');
// APPWERKT houdt knoppen en expliciete navigatielinks afzonderlijk bij. Beide
// vormen horen wel in de Experience-inventaris: een app met nul knoppen kan
// meerdere echte documentkeuzes hebben. Deze projectie levert geen bewijs.
function interactionInventory(observation) {
  if (!observation) return null;
  const inventory={source:'APPWERKT.json',found:observation.gevonden,
    touched:(observation.aangeraakt||[]).slice(),untouched:(observation.onaangeraakt||[]).slice()};
  const navigation=observation.navigatie;
  if (navigation === undefined) return inventory;
  if (!navigation || !Number.isInteger(navigation.gevonden) || navigation.gevonden<0 ||
      !Array.isArray(navigation.aangeraakt) || !Array.isArray(navigation.onbewezen) || !Array.isArray(navigation.fouten) ||
      navigation.aangeraakt.some(link=>!link || typeof link.naam!=='string' || !link.naam.trim()) ||
      navigation.aangeraakt.length!==navigation.geklikt || navigation.geklikt>navigation.gevonden) {
    inventory.untouched.push('APPWERKT-navigatieinventaris is onvolledig of ongeldig');
    return inventory;
  }
  inventory.found+=navigation.gevonden;
  inventory.touched.push(...navigation.aangeraakt.map(link=>link.naam));
  inventory.untouched.push(...navigation.onbewezen,...navigation.fouten);
  if (navigation.geklikt!==navigation.gevonden) inventory.untouched.push('APPWERKT heeft niet alle navigatielinks aangeraakt');
  return inventory;
}

function appInventory(root = path.join(__dirname,'..','..','..')) {
  const rows = rijen();
  const measured = json(path.join(root,'APPWERKT.json')).regels || [];
  return rows.map(row => {
    const map = MAPPEN.find(entry => entry.naam === row.wereld && entry.items.includes(row.functie));
    const destination = meetIngang(row);
    const observation = measured.find(item => item.functie === row.functie && item.wereld === row.wereld);
    return {
      id: 'app:' + (map ? map.sleutel : 'unknown') + ':' + row.functie,
      function: row.functie,
      name: row.app,
      world: row.wereld,
      persona: row.persona,
      destination: destination ? destination.bestemming : null,
      entry: destination ? destination.pad : null,
      interactionInventory: interactionInventory(observation)
    };
  }).sort((a,b) => a.id.localeCompare(b.id));
}

function screenInventory(root) {
  const owners = json(path.join(root,'SCHERMEIGENAAR.json')).schermen;
  return files(path.join(root,'public/apps')).filter(file => file.endsWith('.html')).map(file => {
    const route = routeFor(file, root);
    const world = identity.classify(route);
    const owner = owners[route.replace(/^\//,'')] || null;
    return {id:'screen:' + route, route, world, profile:world === 'redirect' ? 'redirect' : 'interface',owner};
  }).sort((a,b) => a.route.localeCompare(b.route));
}

function signatureErrors(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['signature is geen object'];
  const required = ['identity','purpose','composition','motion','interactionDensity','interactions','humanTasks'];
  const errors = required.filter(key => value[key] === undefined).map(key => 'mist ' + key);
  for (const key of ['identity','purpose','composition','motion']) if (value[key] !== undefined && (typeof value[key] !== 'string' || !value[key].trim())) errors.push(key + ' is leeg');
  if (value.interactionDensity !== undefined && !['quiet','balanced','dense'].includes(value.interactionDensity)) errors.push('interactionDensity is ongeldig');
  if (value.interactions !== undefined && (!Array.isArray(value.interactions) || value.interactions.some(action=>!action || typeof action.id!=='string' || !action.id.trim() || typeof action.label!=='string' || !action.label.trim()))) errors.push('interactions is ongeldig');
  if (Array.isArray(value.interactions) && new Set(value.interactions.map(action=>action&&action.id)).size !== value.interactions.length) errors.push('interactions bevat dubbele ids');
  if (Array.isArray(value.interactions) && !value.interactions.length && (!value.noInteractions || !value.noInteractions.decision || !value.noInteractions.reason)) errors.push('lege interactions mist gemotiveerd noInteractions-besluit');
  if (value.humanTasks !== undefined && (!Array.isArray(value.humanTasks) || !value.humanTasks.length || value.humanTasks.some(task=>typeof task!=='string'||!task.trim()))) errors.push('humanTasks is leeg of ongeldig');
  for (const key of ['additionalStates','additionalDevices']) if (value[key] !== undefined && (!Array.isArray(value[key]) || value[key].some(item=>typeof item!=='string'||!item.trim()))) errors.push(key + ' is ongeldig');
  return errors;
}

/* Een signature blijft expliciet eigenaar van identiteit, compositie, beweging,
   dichtheid en menselijke taken. Alleen gegevens die elders al canoniek
   bestaan mogen declaratief worden overgenomen. Zo ontstaat geen tweede kopie
   van het productdoel of de actuele APPWERKT-bedieningsnoemer. */
function resolveSources(kind, subject, declared) {
  const value=structuredClone(declared),errors=[],derived=[];
  if (value.purpose && typeof value.purpose==='object' && !Array.isArray(value.purpose)) {
    if (kind!=='app' || value.purpose.source!=='appcontract' || Object.keys(value.purpose).length!==1) {
      errors.push('purpose-bron is ongeldig');
    } else {
      const purpose=CONTRACT[subject.function]?.belofte;
      if (typeof purpose!=='string' || !purpose.trim()) errors.push('appcontract mist een productbelofte');
      else { value.purpose=purpose;derived.push('purpose:appcontract'); }
    }
  }
  if (value.interactions && typeof value.interactions==='object' && !Array.isArray(value.interactions)) {
    if (kind!=='app' || value.interactions.source!=='APPWERKT' || Object.keys(value.interactions).length!==1) {
      errors.push('interactiebron is ongeldig');
    } else if (!subject.interactionInventory || subject.interactionInventory.source!=='APPWERKT.json') {
      errors.push('APPWERKT-interactieinventaris ontbreekt');
    } else if (subject.interactionInventory.untouched.length) {
      errors.push('APPWERKT heeft nog onaangeraakte interacties');
    } else if (subject.interactionInventory.touched.length!==subject.interactionInventory.found) {
      errors.push('APPWERKT-interactieinventaris heeft geen volledige noemer');
    } else {
      value.interactions=subject.interactionInventory.touched.map((label,index)=>({
        id:'appwerkt-'+String(index+1).padStart(3,'0'),label
      }));
      derived.push('interactions:APPWERKT.json');
    }
  }
  return {value,errors,derived};
}

function signatureFor(signatures, kind, subject) {
  const source = kind === 'app' ? signatures.apps : signatures.screens;
  const key = kind === 'app' ? subject.id : subject.route;
  const declared = source && source[key];
  if (!declared) return {status:'NOT_TESTED',source:null,reason:'Experience Signature ontbreekt'};
  const resolved=resolveSources(kind,subject,declared),errors=resolved.errors.concat(signatureErrors(resolved.value));
  if (kind === 'app' && subject.interactionInventory) {
    // Een ongeldige of nog niet volledig afleidbare bron blijft BLOCKED. Laat
    // de aanvullende noemercontrole dan niet zelf crashen op het bronobject.
    const actions = Array.isArray(resolved.value.interactions) ? resolved.value.interactions : [];
    const labels = new Set(actions.map(action=>action.label));
    const missing = subject.interactionInventory.touched.filter(label=>!labels.has(label));
    if (actions.length < subject.interactionInventory.found) errors.push('signature bevat minder interacties dan APPWERKT vond');
    if (missing.length) errors.push('signature mist APPWERKT-interacties: ' + missing.join(', '));
    if (subject.interactionInventory.untouched.length) errors.push('APPWERKT heeft nog onaangeraakte interacties');
  }
  if (errors.length) return {status:'BLOCKED',source:'experience-architecture/signatures.json',reason:errors.join('; '),value:resolved.value};
  return {status:'DECLARED',source:'experience-architecture/signatures.json',value:resolved.value,
    ...(resolved.derived.length?{derivedFrom:resolved.derived}: {})};
}

module.exports={appInventory,interactionInventory,screenInventory,signatureFor};
