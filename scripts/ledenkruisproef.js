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
     X2   A's letterlijke tijdstip bij een ander (gemaaktAt van een melding).
     X3   A's tekst in HOOFDLETTERS bij een ander.
     X4   A's gegevens in een antwoordKOP in plaats van in de body.
     X5   een OMLEIDING (302) met A's id en titel in de Location.
     X7   een schrijfactie op A's deelcode (scope leeg) die alleen te zien is
          doordat de lezer de scope toont.
     X9   opzoeken op WAARDE: kring/mail {weg} haalt het adres uit elke kring --
          een regressie van het vervangen van A's tekst door een eigen waarde.

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

const REQ = 'req' + 'uire';

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
      'voorMij:voorContact(handle),aankomend:lijst().filter(m=>actief(m)&&m.eta).map(m=>({id:m.id,tot:m.tot,ontvangers:m.ontvangers,plek:m.laatstePlek||null}))}; }']] },
  /* De derde tegenlezing (ab6528086). */
  X2: { rij: 'link:wonen', bestand: 'server/kern/woningonderhoud.js', vervang: [
    ["String(b.gemaaktAt).localeCompare(String(a.gemaaktAt))).map(veilig) };",
      "String(b.gemaaktAt).localeCompare(String(a.gemaaktAt))).map(veilig), buurt: (() => { const al = Object.entries(eigen.kijk('woningOnderhoud') || {}).filter(([k]) => k !== key).flatMap(([, v]) => v).filter(m => m.urgentie === 'hoog'); return { laatste: al.map(m => m.gemaaktAt).sort().pop() || null }; })() };"]] },
  X3: { rij: 'link:loopbaan', bestand: 'server/kern/carriereledger/index.js', vervang: [
    /* `REQ` in plaats van het woord zelf: anders leest de keuring hier een
       require van een bestand dat in scripts/ niet bestaat. */
    ["const { mijn, feit } = " + REQ + "('./projectie')({ reeksKijk, naam });",
      "const _p = " + REQ + "('./projectie')({ reeksKijk, naam }); const feit = _p.feit;\n  const mijn = (k) => Object.assign(_p.mijn(k), { elders: Object.keys(kijk()).filter((x) => x !== k).flatMap((x) => ((kijk()[x] || {}).regels || []).filter((r) => r.kapitaal === 'vermogen').map((r) => String(r.wat || '').toUpperCase() + ' / ' + String(r.toelichting || '').slice(0, 22))) });"]] },
  X4: { rij: 'link:reizen', bestand: 'server/kern/veiligheid/moment.js', vervang: [
    ['function mijn(handle) { return {momenten:', 'function mijn(handle) { const _r = mijn0(handle); Object.defineProperty(_r, "_buren", { enumerable: false, value: lijst().filter((m) => actief(m) && m.handle !== handle).map((m) => m.id + ":" + m.eta + ":" + m.ontvangers.map((r) => r.id).join("|")).join(",") }); return _r; }\n  function mijn0(handle) { return {momenten:']],
    extra: [['server/routes/veiligheid.js',
      "app.post('/api/veiligheid/moment', auth, (req, res) => uit(res, kern.momentMijn(mij(req))));",
      "app.post('/api/veiligheid/moment', auth, (req, res) => { const r = kern.momentMijn(mij(req)); if (r && r._buren) res.set('RTG-Buren', r._buren); uit(res, r); });"]] },
  X5: { rij: 'link:wonen', bestand: 'server/routes/home.js', vervang: [
    ["app.post('/api/home/onderhoud', auth, (req, res) => res.json(woningOnderhoud.lijst(req.session.key)));",
      "app.post('/api/home/onderhoud', auth, (req, res) => { const l = woningOnderhoud.lijst(req.session.key); if (!l.meldingen.length && woningOnderhoud.ander) { const a = woningOnderhoud.ander(req.session.key); if (a) return res.redirect(302, '/apps/wonen.html?voorbeeld=' + a.id + '&t=' + encodeURIComponent(a.titel)); } res.json(l); });"]],
    extra: [['server/kern/woningonderhoud.js', "return { woningOnderhoud: { lijst, meld, annuleer } };",
      "function ander(key) { return Object.entries(eigen.kijk('woningOnderhoud') || {}).filter(([k]) => k !== key).flatMap(([, v]) => v)[0] || null; }\n  return { woningOnderhoud: { lijst, meld, annuleer, ander } };"]] },
  X7: { rij: 'link:loopbaan', bestand: 'server/kern/carriereledger/deel.js', vervang: [
    ['    const rij = bak().find(r => r.id === scho(did, 20) && r.issuer === key);',
      '    const vr = bak().find(r => r.id === scho(did, 20));\n    if (vr && vr.issuer !== key) { vr.scope = []; save(); }\n    const rij = bak().find(r => r.id === scho(did, 20) && r.issuer === key);']] },
  X9: { rij: 'link:ik', bestand: 'server/kern/veiligheid/kring.js', vervang: [
    ["    const mijn = k[handle];\n    if (!mijn) return { status: 200, ok: true, kring: kringToon(handle) };\n    mijn.mails = mijn.mails.filter(m => m !== String(adres || '').toLowerCase());",
      "    for (const x of Object.values(k)) if (x && Array.isArray(x.mails)) x.mails = x.mails.filter(m => m !== String(adres || '').toLowerCase());\n    const mijn = k[handle];\n    if (!mijn) return { status: 200, ok: true, kring: kringToon(handle) };\n    mijn.mails = mijn.mails.filter(m => m !== String(adres || '').toLowerCase());"]] }
};

/* Alle vervangingen van een mutatie als [bestand, oud, nieuw]: de hoofdbron en
   eventueel een tweede bestand (een route die een kop zet, X4). */
function stukken(m) {
  return m.vervang.map(([a, b]) => [m.bestand, a, b]).concat(m.extra || []);
}

function draai(naam) {
  const m = MUTATIES[naam];
  const origineel = {};
  for (const [bestand, a, b] of stukken(m)) {
    const p = path.join(WORTEL, bestand);
    if (!(p in origineel)) origineel[p] = fs.readFileSync(p, 'utf8');
    const s = fs.readFileSync(p, 'utf8');
    if (!s.includes(a)) {
      for (const [q, o] of Object.entries(origineel)) fs.writeFileSync(q, o);
      return { naam, uitslag: 'NIET_TOEPASBAAR', reden: 'het stuk bron staat er niet meer in ' + bestand + ': ' + a.slice(0, 60) };
    }
    fs.writeFileSync(p, s.replace(a, b));
  }
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
    for (const [p, o] of Object.entries(origineel)) fs.writeFileSync(p, o);
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

module.exports = { MUTATIES, stukken };
