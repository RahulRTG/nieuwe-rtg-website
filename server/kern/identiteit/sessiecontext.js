/* ============================================================================
   MIJN RTG, blok 1: DE POORT -- wat er werkelijk een sessie in komt.

   De ontwerpregel van dit bestand staat in MIJNRTG.md par. 2 en luidt:

     Een sessie draagt genoeg context om vertrouwen te kunnen BEWIJZEN,
     en repliceert zo weinig mogelijk toestand.

   Dat is geen stijlvoorkeur. Een sessie in dit huis reist over een bus naar
   andere processen (kern/sessies.js, kanaal rtg:sessies:v1) en wordt gespiegeld
   in db.data. Alles wat je erin zet, verlaat dus het proces en overleeft een
   herstart. Een volledig IP-adres of een GPS-punt in de sessie is daarmee geen
   veld maar een replicatie van een persoonsgegeven over een netwerk.

   VANDAAR DRIE SOORTEN, en niet een platte bak velden:

     claim        een vastgestelde waarheid over deze sessie (authenticator,
                  toestel, context). Draagt ALTIJD een herkomst -- zie onder.
     binding      een verwijzing naar een sleutel of een registratie elders.
                  Bewijst dat er iets aan vastzit, zonder het mee te nemen.
     verwijzing   een sleutel naar een dossier dat ELDERS leeft (risico,
                  bewijs). De sessie draagt de ref, nooit de inhoud.

   DE HERKOMSTEIS. Elke claim beantwoordt vijf vragen: waar kwam ik vandaan,
   wanneer ben ik vastgesteld, met welke methode, welke regelversie gold, en ben
   ik sindsdien opnieuw bevestigd. Zonder die vijf is een claim geen claim maar
   een bewering, en dan is elk scherm dat hem toont een SCHERMLEUGEN.json-regel
   in wording.

   DE GRAAD KOMT UIT DE METHODE, en wordt nooit met de hand gezet. Dat is de
   huisregel van BESTUUR.md: de laag die iets toont, meet het niet. Daar hoort
   de tweede helft bij die net zo hard is -- VERVALLEN BEWIJS IS GEEN BEWIJS --
   en die staat hier als `verval` per veld, niet als een losse instelling.

   WAT HIER MET OPZET NIET IN KAN. Zie VERBODEN in ./sessievelden.js. Die lijst is geen
   waarschuwing maar een grendel: een onbekend veld wordt geweigerd, en een
   verboden veld wordt geweigerd met de reden erbij. Fail-closed, want een
   allowlist die je kunt omzeilen door een veld te verzinnen is een suggestie.
   ========================================================================== */
'use strict';
const klok = require('../../lib/klok');

const { GRADEN, METHODEN, VELDEN, VERBODEN } = require('./sessievelden');
const isSleutel = (v) => typeof v === 'string' && /^[A-Za-z0-9_:-]{1,64}$/.test(v);
const isTekst   = (v) => typeof v === 'string' && v.length > 0 && v.length <= 64;
const isGetal   = (v) => Number.isFinite(v);
const CONTROLE  = { sleutel: isSleutel, tekst: isTekst, getal: isGetal };

/* Een herkomst is pas een herkomst als alle vijf de vragen beantwoord zijn. */
function herkomstOk(h) {
  if (!h || typeof h !== 'object') return false;
  if (!isTekst(h.bron)) return false;
  if (!METHODEN[h.methode]) return false;
  if (!Number.isFinite(new Date(h.vastgesteldOp || 0).getTime()) || !h.vastgesteldOp) return false;
  if (!isTekst(h.regelversie)) return false;
  if (h.bevestigdOp != null && !Number.isFinite(new Date(h.bevestigdOp).getTime())) return false;
  return true;
}

/* DE GRAAD VAN EEN CLAIM, op een gegeven moment.

   Twee dingen bepalen hem: de methode (hoe sterk is dit vastgesteld) en de
   ouderdom (geldt dat nog). Vervallen bewijs zakt naar `vermoed` en niet naar
   `onbekend`: wij hebben het wel degelijk ooit gemeten, we weten alleen niet of
   het nu nog zo is. Dat verschil is precies wat een scherm hoort te tonen. */
function graadVan(claim, nu = klok.nu()) {
  return graadMet(claim, VELDEN[claim && claim.veld], nu);
}

/* DEZELFDE REGEL, met de velddefinitie als argument.

   Hij bestaat apart omdat er sinds het weghalen van `risico` geen enkel veld
   meer een `verval` draagt (zie ./sessievelden.js). Zonder deze ingang zou de
   regel "vervallen bewijs is geen bewijs" alleen nog bestaan als code die niets
   raakt -- en dan is er niets dat hem overeind houdt tot de dag dat er weer een
   claim bijkomt die over de huidige toestand van de wereld gaat. */
function graadMet(claim, veld, nu = klok.nu()) {
  if (!claim || !claim.herkomst || !herkomstOk(claim.herkomst)) {
    return { graad: 'onbekend', reden: 'geen herkomst vastgelegd' };
  }
  const basis = METHODEN[claim.herkomst.methode].graad;
  const verval = veld && veld.verval;
  if (!verval) return { graad: basis, reden: METHODEN[claim.herkomst.methode].uitleg };
  const peil = claim.herkomst.bevestigdOp || claim.herkomst.vastgesteldOp;
  const ouderdom = nu - new Date(peil).getTime();
  if (ouderdom <= verval) {
    return { graad: basis, reden: METHODEN[claim.herkomst.methode].uitleg, ouderdomMs: ouderdom };
  }
  const gezakt = GRADEN.indexOf(basis) > GRADEN.indexOf('vermoed') ? 'vermoed' : basis;
  return { graad: gezakt, vervallen: true, ouderdomMs: ouderdom,
    reden: 'vastgesteld als ' + basis + ', maar de geldigheid is verlopen -- vervallen bewijs is geen bewijs' };
}

/* DE POORT. Bouwt een gecontroleerde context uit ruwe invoer en zegt per
   geweigerd veld waarom. Weigeren is hier stil noch stiekem: de aanroeper krijgt
   `geweigerd` terug en kan dat loggen. */
function bouw(ruw) {
  const context = {};
  const geweigerd = [];
  if (!ruw || typeof ruw !== 'object' || Array.isArray(ruw)) {
    return { context, geweigerd: [{ veld: '(geheel)', reden: 'geen object' }] };
  }
  for (const [naam, waarde] of Object.entries(ruw)) {
    if (VERBODEN[naam]) { geweigerd.push({ veld: naam, reden: VERBODEN[naam], verboden: true }); continue; }
    const veld = VELDEN[naam];
    if (!veld) { geweigerd.push({ veld: naam, reden: 'onbekend veld; de lijst in kern/identiteit/sessiecontext.js is gesloten' }); continue; }
    if (!waarde || typeof waarde !== 'object') { geweigerd.push({ veld: naam, reden: 'geen object' }); continue; }
    if (!herkomstOk(waarde.herkomst)) {
      geweigerd.push({ veld: naam, reden: 'geen geldige herkomst (bron, methode, vastgesteldOp, regelversie)' });
      continue;
    }
    const schoon = {};
    let stuk = null;
    for (const [sleutel, soort] of Object.entries(veld.vorm)) {
      const v = waarde[sleutel];
      if (v === undefined || v === null) continue;      // een veld mag onvolledig zijn
      if (!CONTROLE[soort](v)) { stuk = sleutel + ' is geen geldige ' + soort; break; }
      schoon[sleutel] = v;
    }
    if (stuk) { geweigerd.push({ veld: naam, reden: stuk }); continue; }
    if (!Object.keys(schoon).length) { geweigerd.push({ veld: naam, reden: 'geen enkele waarde binnen de vorm' }); continue; }
    schoon.herkomst = {
      bron: waarde.herkomst.bron,
      methode: waarde.herkomst.methode,
      vastgesteldOp: waarde.herkomst.vastgesteldOp,
      regelversie: waarde.herkomst.regelversie
    };
    if (waarde.herkomst.bevestigdOp) schoon.herkomst.bevestigdOp = waarde.herkomst.bevestigdOp;
    context[naam] = schoon;
  }
  return { context, geweigerd };
}

/* DE STAND van een hele sessiecontext: per veld de graad, met de ouderdom erbij.
   Dit is wat MIJN STAND later leest -- en het is met opzet GEEN samengesteld
   cijfer. Zie MIJNRTG.md par. 4: LAT-regel 11 en check.js regel 48 verbieden
   het ene groene getal, omdat 82% verbergt of het ontbrekende de herstelroute is. */
function stand(context, nu = klok.nu()) {
  const uit = {};
  for (const naam of Object.keys(VELDEN)) {
    const claim = context && context[naam];
    uit[naam] = claim
      ? Object.assign({ aanwezig: true }, graadVan(Object.assign({ veld: naam }, claim), nu))
      : { aanwezig: false, graad: 'onbekend', reden: 'nooit vastgesteld voor deze sessie' };
  }
  return uit;
}

module.exports = { VELDEN, VERBODEN, METHODEN, GRADEN, bouw, stand, graadVan, graadMet, herkomstOk };
