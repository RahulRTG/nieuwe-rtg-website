#!/usr/bin/env node
/* ============================================================================
   DE LEDENKRUISPROEF -- ziet de ledenkruis (scripts/lib/ledenkruis.js) een lek?

   Een meter die niet kan uitslaan, is geen meter (BEWIJSMACHINE.md par. 6a). De
   ledenkruis heeft twee keer groen gestaan op een lek dat een tegenlezer erin
   bracht, en elke keer was de oorzaak een andere klasse blindheid:

     M1   een handeling op A's OBJECT die bij een ander slaagt (deel() zocht in
          alle ledgers) -- het antwoord droeg niets van A.
     M3b  de codenaam was huisbreed uitgezonderd en alleen de titel was een
          merkteken -- een route die de reizen van anderen teruggaf zonder titel.
     N1   "hij stuurde het zelf": het adres stond in het lijf van de ander, dus
          een kring/mail die de kring van A teruggaf telde niet.
     N2-4 vrije velden zonder merkteken (plek en notitie, `voor`, ontvangers en
          het id van een moment).

   Deze proef brengt elk van die lekken WEER aan in de bron, draait
   `bevoegdronde --alleen=<rij>`, en eist DEFECT. Daarna wordt de bron
   byte voor byte teruggezet. Omdat hij de bron muteert, pakt hij het afbouwslot
   (scripts/afbouw-slot.js), net als de mutatiemotor.

   ZWAAR, en daarom niet in de gewone CI: elke mutatie start een server en een
   browser (een paar minuten per stuk). De oordeelsfuncties per klasse staan wel
   in CI, in test/ledenkruis.test.js; dit is de live-replay die bewijst dat de
   hele weg (zaai, browser, naspelen, oordeel) de mutatie ziet.

   Draai:  node scripts/ledenkruisproef.js            (alle)
           node scripts/ledenkruisproef.js N1 M1      (een paar)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');

const MUTATIES = {
  M1: { rij: 'link:loopbaan', bestand: 'server/kern/carriereledger/deel.js', vervang: [
    ["    const f = feit(key, scho(fid, 20));\n    if (!f) return { status: 404, error: 'Dit feit staat niet in uw ledger.' };",
      "    const eig = Object.keys(eigen.kijk('carriereLedger') || {}).find((k) => feit(k, scho(fid, 20))) || key;\n    const f = feit(eig, scho(fid, 20)); key = eig;\n    if (!f) return { status: 404, error: 'Dit feit staat niet in uw ledger.' };"]] },
  M3b: { rij: 'link:reizen', bestand: 'server/kern/veiligheid/moment.js', vervang: [
    ['function mijn(handle) { return {momenten:lijst().filter(m=>m.handle===handle&&actief(m)).map(eigenBeeld)',
      'function mijn(handle) { return {momenten:lijst().filter(m=>actief(m)).map(m=>Object.assign(eigenBeeld(m),{titel:undefined,codenaam:codenaam(m.handle)}))']] },
  N1: { rij: 'link:ik', bestand: 'server/kern/veiligheid/kring.js', vervang: [
    ['function mailToevoegen(handle, adres) {', 'let laatste = null;\n  function mailToevoegen(handle, adres) {\n    laatste = handle;'],
    ['if (!mijn) return { status: 200, ok: true, kring: kringToon(handle) };\n    mijn.mails',
      'if (!mijn) return { status: 200, ok: true, kring: kringToon(laatste || handle) };\n    mijn.mails']] },
  N2: { rij: 'link:wonen', bestand: 'server/kern/woningonderhoud.js', vervang: [
    ['String(b.gemaaktAt).localeCompare(String(a.gemaaktAt))).map(veilig) };',
      "String(b.gemaaktAt).localeCompare(String(a.gemaaktAt))).map(veilig),\n      urgentInDeBuurt: Object.values(eigen.kijk('woningOnderhoud') || {}).flat().filter(m => m.urgentie === 'hoog').map(m => ({ plek: m.plek, notitie: m.notitie, status: m.status })) };"]] },
  N3: { rij: 'link:loopbaan', bestand: 'server/kern/carriereledger/deel.js', vervang: [
    ['return kijk().filter(r => r.issuer === key).map(', 'return kijk().map(']] },
  N4: { rij: 'link:reizen', bestand: 'server/kern/veiligheid/moment.js', vervang: [
    ['voorMij:voorContact(handle)}; }',
      'voorMij:voorContact(handle),aankomend:lijst().filter(m=>actief(m)&&m.eta).map(m=>({id:m.id,tot:m.tot,ontvangers:m.ontvangers,plek:m.laatstePlek||null}))}; }']] }
};

function draai(naam) {
  const m = MUTATIES[naam];
  const p = path.join(WORTEL, m.bestand);
  const origineel = fs.readFileSync(p, 'utf8');
  let s = origineel;
  for (const [a, b] of m.vervang) {
    if (!s.includes(a)) return { naam, uitslag: 'NIET_TOEPASBAAR', reden: 'het stuk bron staat er niet meer: ' + a.slice(0, 60) };
    s = s.replace(a, b);
  }
  fs.writeFileSync(p, s);
  try {
    let uit;
    try {
      uit = execFileSync(process.execPath, [path.join(__dirname, 'bevoegdronde.js'), '--alleen=' + m.rij],
        { cwd: WORTEL, maxBuffer: 1e8, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    } catch (e) { uit = String(e.stdout || ''); }
    const regel = uit.split('\n').find((l) => l.startsWith('{"functie":"' + m.rij + '"'));
    if (!regel) return { naam, uitslag: 'GEEN_UITSLAG', reden: 'de bevoegdronde gaf geen regel voor ' + m.rij };
    const j = JSON.parse(regel);
    return { naam, rij: m.rij, uitslag: j.status, kruis: j.ledenkruis && j.ledenkruis.status,
      reden: (j.ledenkruis && j.ledenkruis.reden) || j.reden };
  } finally {
    fs.writeFileSync(p, origineel);
  }
}

if (require.main === module) {
  const vrij = require('./afbouw-slot').pak('ledenkruisproef');
  void vrij;
  const gevraagd = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const namen = gevraagd.length ? gevraagd : Object.keys(MUTATIES);
  let mis = 0;
  for (const n of namen) {
    if (!MUTATIES[n]) { console.error('onbekende mutatie ' + n); process.exit(2); }
    const u = draai(n);
    const goed = u.uitslag === 'GEBLOKKEERD_DOOR_DEFECT';
    if (!goed) mis++;
    console.log((goed ? 'DEFECT    ' : 'BLIND     ') + n + ' (' + (u.rij || '?') + '): ' + String(u.reden || '').slice(0, 200));
  }
  console.log(mis ? mis + ' mutatie(s) bleven onopgemerkt: de ledenkruis is blind' : 'Elke mutatie geeft DEFECT.');
  process.exit(mis ? 1 : 0);
}

module.exports = { MUTATIES };
