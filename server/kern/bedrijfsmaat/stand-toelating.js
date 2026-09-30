/* DRIE MATEN UIT DE BESLUITEN VAN 30 SEPTEMBER 2026 (C20, C21, C22), elk uit een
   lijst die een ander bezit en die hier alleen wordt gelezen.

   C20 toelating van zaken   de aanmeldingen met een bedrijf erin, per stand
                             (in behandeling, geaccepteerd, klaargezet, afgewezen),
                             plus de mediane doorlooptijd van aanvraag tot besluit
                             over de besluiten van de maand. Onder vijf zaken geen
                             getal, ook niet voor de doorlooptijd.
   C21 contract geeindigd    de contracten die aan het begin van de maand liepen en
                             in de maand GEEINDIGD bereikten, gedeeld door alle die
                             toen liepen. Geteld op CONTRACT en niet op lid: een
                             contract hangt aan een aanmelding, en de koppeling naar
                             een codenaam is met opzet niet gelegd.
   C22 btw van RTG zelf      een VOORBEREIDING per kwartaal uit de lidmaatschaps-
                             termijnen die in het kwartaal vervielen (factuurstelsel),
                             tegen het standaardtarief. Klasse `advies`: de
                             verbruiksfacturen staan per lid in de kluis en worden
                             niet gelezen, en of het deel voor de RTFoundation een
                             vergoeding is, beoordeelt een fiscalist. RTG dient nooit
                             zelf in.

   Geen van drieen raadt: waar een bron ontbreekt, staat de reden. */
'use strict';

const { toon, groepeer, KLASSEN } = require('./poort');
const { DEFINITIES } = require('./definities');
const { tariefVan } = require('../fiscaal/tarief');
const { zekerheid } = require('../fiscaal/zekerheid');

const ZAKEN = { privacy: 'zaken', minGroep: 5 }, LEDEN = { privacy: 'leden', minGroep: 10 };
const LOPEND = new Set(['ACTIEF', 'VERLENGBAAR', 'OPZEGGEND', 'VERLENGD']);
const lijst = (x) => (Array.isArray(x) ? x : []);
const niet = (waarom) => ({ stand: 'NIET_UIT_TE_REKENEN', waarde: null, waarom });
const DAG = 86400000;

function toelatingStand(a) {
  if (a.status === 'afgewezen') return 'afgewezen';
  if (a.status === 'geaccepteerd') return a.gezaakt ? 'klaargezet' : 'geaccepteerd';
  return 'in behandeling';
}

module.exports = ({ m, maat, lees }) => {
  const l = lees || {};
  const lezen = (f) => { try { return typeof f === 'function' ? f() : null; } catch (e) { return null; } };
  const begin = Date.parse(m + '-01T00:00:00Z');

  function toelating() {
    const alle = lezen(l.aanmeldingen);
    if (!Array.isArray(alle)) return niet('Het aanmeldregister is niet beschikbaar.');
    const zaken = alle.filter(a => a && a.bedrijf);
    const per = {};
    for (const a of zaken) { const s = toelatingStand(a); per[s] = (per[s] || 0) + 1; }
    const rijen = ['in behandeling', 'geaccepteerd', 'klaargezet', 'afgewezen'].map(naam => ({ naam, aantal: per[naam] || 0 }));
    const dagen = zaken.filter(a => a.besluit && String(a.besluit.at || '').slice(0, 7) === m)
      .map(a => (Date.parse(a.besluit.at) - Date.parse(a.at)) / DAG).filter(Number.isFinite).sort((x, y) => x - y);
    const mid = dagen.length ? (dagen.length % 2 ? dagen[(dagen.length - 1) / 2]
      : (dagen[dagen.length / 2 - 1] + dagen[dagen.length / 2]) / 2) : null;
    const doorloop = toon(ZAKEN, { waarde: mid == null ? null : Math.round(mid * 10) / 10, n: dagen.length });
    if (doorloop.stand === 'TOONBAAR') doorloop.eenheid = 'dagen, mediaan van aanvraag tot besluit';
    return { stand: 'PER_STAND', waarde: null, eenheid: 'aanvragen',
      perStand: groepeer(rijen, { grens: KLASSEN.zaken.grens, benoemd: true }), doorlooptijd: doorloop };
  }

  function contractGeeindigd() {
    const contracten = lezen(l.contracten);
    if (!Array.isArray(contracten)) return niet('Het contractregister is niet beschikbaar.');
    let liepen = 0, geeindigd = 0;
    for (const c of contracten) {
      const v = lijst(c && c.verloop);
      const voor = v.filter(x => Date.parse(x.at) < begin).pop();
      if (!voor || !LOPEND.has(voor.naar)) continue;
      liepen++;
      if (v.some(x => x.naar === 'GEEINDIGD' && String(x.at || '').slice(0, 7) === m)) geeindigd++;
    }
    if (!liepen) return niet('Aan het begin van deze maand liep er geen enkel contract.');
    const t = toon(LEDEN, { waarde: geeindigd / liepen, n: liepen });
    return t.stand === 'TOONBAAR' ? Object.assign(t, { geeindigd, eenheid: 'aandeel van de lopende contracten' }) : t;
  }

  function btwRtg() {
    const schemas = lezen(l.betaalschemas);
    if (!Array.isArray(schemas)) return niet('De betaalschema\'s van de aanmeldingen zijn niet beschikbaar.');
    const jaar = m.slice(0, 4), q = Math.floor((Number(m.slice(5, 7)) - 1) / 3);
    const maanden = [1, 2, 3].map(i => jaar + '-' + String(q * 3 + i).padStart(2, '0'));
    const pct = tariefVan(null, 'standaard');
    let grondslag = 0, termijnen = 0;
    for (const t of schemas.flatMap(r => lijst(r && r.termijnen))) {
      if (!maanden.includes(String(t.vervalt || '').slice(0, 7)) || !Number.isFinite(t.centen)) continue;
      grondslag += t.centen; termijnen++;
    }
    return { stand: 'VOORBEREIDING', waarde: Math.round(grondslag * pct / 100), eenheid: 'eurocent btw, per kwartaal',
      kwartaal: jaar + '-K' + (q + 1), grondslagCenten: grondslag, tarief: pct, termijnen,
      zekerheid: zekerheid('btw.rtg'), indienen: zekerheid('btw.verzenden') };
  }

  const m3 = (id, def, uit, dekt, graad) => Object.assign(maat(id, def, uit, dekt), { graad });
  return [
    m3('leveranciers.partners-toelating', DEFINITIES.toelating, toelating(),
      ['De stand is die van nu; de doorlooptijd gaat over de besluiten van de maand.',
        'Een bewijsstuk dat nog bij het kantoor ligt, staat hier onder in behandeling en niet apart.'], 'gemeten'),
    m3('churn.contract-geeindigd', DEFINITIES.contractGeeindigd, contractGeeindigd(),
      ['Geteld per contract en niet per lid; een lid met twee contracten telt twee keer.',
        'Alleen de contractuele treden; de meeste betalende leden hebben een pas zonder contract.'], 'gemeten'),
    m3('fiscaal.btw-rtg', DEFINITIES.btwRtg, btwRtg(),
      ['Een voorbereiding en geen aangifte: RTG dient nooit zelf in.',
        'De verbruiksfacturen staan per lid in de kluis en zitten er niet in.',
        'Of het deel voor de RTFoundation onder de vergoeding valt, beoordeelt een fiscalist.'], 'vermoed')
  ];
};
