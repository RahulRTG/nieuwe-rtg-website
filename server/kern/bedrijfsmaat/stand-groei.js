/* DRIE MATEN UIT DE BESLUITEN VAN 29 SEPTEMBER 2026 (C17, C18, C19), elk uit
   een lijst die een ander bezit en die hier alleen wordt gelezen.

   C17 zaken per genre   een zaak telt als zij TOEGELATEN is (in het
                         zakenregister en niet geschorst of beeindigd) en in de
                         maand iets DEED via RTG: minstens een verzoek door haar
                         eigen deur, zoals de kostenmeter dat per drager telt
                         (`zaak:CODE`). Aanmelden is geen gebruik.
   C18 contract verlengd een contract telt als verlengd als het na zijn einddatum
                         doorloopt: een overgang naar VERLENGD in de maand. De
                         noemer is elk contract dat in die maand op zijn
                         beslismoment kwam: verlengd plus geeindigd.
   C19 transactievolume  wat zaken in de maand via RTG Pay ontvingen, ZONDER btw:
                         de subtotalen van de facturen met betaalwijze `rtg`. Geld
                         van de zaak, nooit omzet van RTG (die verdient niets aan
                         een boeking).

   Alle drie gaan langs de groepspoort van hun eigen klasse, en geen van drieen
   raadt: waar een bron ontbreekt, staat de reden. */
'use strict';

const { toon, groepeer, KLASSEN } = require('./poort');
const { DEFINITIES } = require('./definities');

const ZAKEN = { privacy: 'zaken', minGroep: 5 }, LEDEN = { privacy: 'leden', minGroep: 10 };
const GESLOTEN = new Set(['geschorst', 'beeindigd']);
const lijst = (x) => (Array.isArray(x) ? x : []);
const inMaand = (t, m) => typeof t === 'string' && t.slice(0, 7) === m;
const niet = (waarom) => ({ stand: 'NIET_UIT_TE_REKENEN', waarde: null, waarom });

module.exports = ({ m, maat, kosten, lees }) => {
  const l = lees || {};
  const lezen = (f) => { try { return typeof f === 'function' ? f() : null; } catch (e) { return null; } };

  function zakenPerGenre() {
    const zaken = lezen(l.zaken), k = typeof kosten === 'function' ? kosten() : null;
    if (!Array.isArray(zaken)) return niet('Het zakenregister is niet beschikbaar.');
    if (!k || typeof k.alleDragers !== 'function') return niet('De kostenmeter is niet beschikbaar; zonder die is niet te zien wie iets deed.');
    const actief = new Set();
    for (const r of k.alleDragers(m)) { const w = k.ontleed(r.drager); if (w.soort === 'zaak') actief.add(w.id); }
    const per = {};
    for (const z of zaken) {
      if (!z || !z.code || GESLOTEN.has(z.partnerStatus) || !actief.has(z.code)) continue;
      const g = z.type || 'onbekend';
      per[g] = (per[g] || 0) + 1;
    }
    const rijen = Object.entries(per).sort((a, b) => a[0].localeCompare(b[0])).map(([genre, aantal]) => ({ genre, aantal }));
    return { stand: 'PER_GENRE', waarde: null, eenheid: 'zaken', perGenre: groepeer(rijen, { grens: KLASSEN.zaken.grens, benoemd: true }) };
  }

  function contractVerlengd() {
    const contracten = lezen(l.contracten);
    if (!Array.isArray(contracten)) return niet('Het contractregister is niet beschikbaar.');
    let verlengd = 0, geeindigd = 0;
    for (const c of contracten) for (const v of lijst(c && c.verloop)) {
      if (!inMaand(v.at, m)) continue;
      if (v.naar === 'VERLENGD') verlengd++;
      else if (v.naar === 'GEEINDIGD') geeindigd++;
    }
    const noemer = verlengd + geeindigd;
    if (!noemer) return niet('In deze maand kwam geen enkel contract op zijn beslismoment.');
    const t = toon(LEDEN, { waarde: verlengd / noemer, n: noemer });
    return t.stand === 'TOONBAAR' ? Object.assign(t, { verlengd, eenheid: 'aandeel van de contracten op hun beslismoment' }) : t;
  }

  function transactievolume() {
    const facturen = lezen(l.facturen);
    if (!Array.isArray(facturen)) return niet('Het factuurregister is niet beschikbaar.');
    const zaken = new Set();
    let centen = 0, btwCenten = 0;
    for (const f of facturen) {
      if (!f || f.methode !== 'rtg' || !f.verkoper || !f.verkoper.code || !inMaand(f.at, m)) continue;
      zaken.add(f.verkoper.code);
      centen += Math.round(Number(f.subtotaal) * 100) || 0;
      btwCenten += Math.round(Number(f.btwBedrag) * 100) || 0;
    }
    const t = toon(ZAKEN, { waarde: centen, n: zaken.size });
    return t.stand === 'TOONBAAR' ? Object.assign(t, { eenheid: 'eurocent, zonder btw', btwCenten }) : t;
  }

  const m3 = (id, def, uit, dekt, graad) => Object.assign(maat(id, def, uit, dekt), { graad });
  return [
    m3('groei.zaken-per-genre', DEFINITIES.zakenPerGenre, zakenPerGenre(),
      ['Toegelaten is de stand van nu, niet die van de maand.', 'Een zaak die alleen via een medewerker-app of de kassa werkte, telt mee zolang die langs haar eigen deur ging; wat buiten RTG om gebeurde, niet.'], 'gemeten'),
    m3('retentie.contract-verlengd', DEFINITIES.contractVerlengd, contractVerlengd(),
      ['Alleen de contractuele treden (Lifestyle, Business); de meeste betalende leden hebben een pas zonder contract.'], 'gemeten'),
    m3('geld.transactievolume', DEFINITIES.transactievolume, transactievolume(),
      ['Geld van de zaken, geen omzet van RTG.', 'Alleen betalingen waar een factuur met betaalwijze RTG bij hoort; terugbetalingen staan niet als creditnota in het register en gaan er niet vanaf.'], 'gemeten')
  ];
};
