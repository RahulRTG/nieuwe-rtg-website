'use strict';

/* De tijd komt van de tijdmachine (server/lib/klok.js) en niet van het
   besturingssysteem. Wie rechtstreeks aan het OS vraagt hoe laat het is, doet
   niet mee aan RTG_KLOK en is dus niet te beproeven op een schrikkeldag, een
   zomertijdgrens of een verlopen mandaat -- en dan is de tijdmachine precies
   zoveel waard als het aantal modules dat meedoet (scripts/klok.js). */
const klok = require('../../lib/klok');

const crypto = require('crypto');
const WM = require('./world-model');
const rond = n => Math.round(n * 10) / 10;

function analyse(l) {
  const vraag = l.verwacht;
  const cap = l.capaciteit;
  const persCap = l.medewerkers * 10;
  const druk = vraag / Math.max(1, Math.min(cap, persCap));
  const wacht = Math.max(0, (druk - .72) * 38);
  const herstel = Math.max(0, (druk - .82) * 55);
  const bar = druk * (100 / (Number(l.stations.bar) || 100));
  const keuken = druk * (100 / (Number(l.stations.keuken) || 100));
  const risico = [];
  if (vraag > (Number(l.stations.ontbijt) || 100)) risico.push({ as: 'ontbijt', ernst: 80, tekst: 'Ontbijtbuffet is structureel ondercapaciteit in het piekvenster.' });
  if (druk > 1) risico.push({ as: 'capaciteit', ernst: Math.min(100, Math.round(druk * 72)), tekst: 'Verwacht volume overschrijdt de berekende dienstcapaciteit.' });
  if (l.terras && l.regenKans > .35 && vraag > l.capaciteit - l.terras) risico.push({ as: 'weer', ernst: Math.round(l.regenKans * 100), tekst: 'Terrasafhankelijkheid geeft herplaatsingsrisico bij regen.' });
  const cert = l.certificaten.filter(c => c.dagen <= 21);
  if (cert.length) risico.push({ as: 'compliance', ernst: 55 + cert.length * 5, tekst: cert.length + ' certificaten verlopen binnen 21 dagen.' });
  return { locatieId: l.id, naam: l.naam, stad: l.stad, loonkosten: l.medewerkers * 340, wachttijdMin: rond(wacht), herstelPct: rond(herstel), keuken: keuken > 1 ? 'kritisch' : keuken > .82 ? 'aandacht' : 'stabiel', bar: bar > 1 ? 'kritisch' : bar > .82 ? 'aandacht' : 'stabiel', risico: risico.sort((a, b) => b.ernst - a.ernst) };
}

function briefing(w, vraag) {
  const k = WM.keur(w);
  if (!k.geldig) return { error: k.fouten.join('; ') };
  const locaties = w.locaties.map(analyse).filter(x => x.risico.length).sort((a, b) => b.risico[0].ernst - a.risico[0].ernst);
  const menselijkeSignalen = ((w.human && w.human.signalen) || []).map(s => ({
    locatie: 'Menselijke situatie',
    stad: s.zone || 'locatie',
    prioriteit: s.niveau === 'acuut' ? 100 : s.niveau === 'hoog' ? 85 : 65,
    bevinding: s.tekst,
    overig: [],
    menselijkeBeslissingVereist: true
  }));
  const operationeel = locaties.map(x => ({ locatie: x.naam, stad: x.stad, prioriteit: x.risico[0].ernst, bevinding: x.risico[0].tekst, overig: x.risico.slice(1) }));
  const antwoord = menselijkeSignalen.concat(operationeel).sort((a, b) => b.prioriteit - a.prioriteit).slice(0, 5);
  return { vraag: String(vraag || 'Wat kan ons pijn doen?'), wereld: w.id, modelVersie: w.modelVersie, antwoord, stil: w.locaties.length - locaties.length, uitleg: 'Alleen materiële uitzonderingen; locaties zonder bevinding blijven stil. Menselijke situaties vragen altijd om menselijke beoordeling.' };
}

function vergelijk(w, id, varianten) {
  const basis = w.locaties.find(l => l.id === id);
  if (!basis) return { error: 'Locatie niet gevonden.' };
  const b = analyse(basis);
  const runs = (varianten || []).map(v => {
    const r = WM.wijzig(w, Object.assign({ locatieId: id }, v));
    const a = analyse(r.wereld.locaties.find(x => x.id === id));
    return { naam: v.naam || 'Variant', verandering: v, uitkomst: a, verschil: { loonkosten: a.loonkosten - b.loonkosten, wachttijdMin: rond(a.wachttijdMin - b.wachttijdMin), herstelPct: rond(a.herstelPct - b.herstelPct) } };
  });
  return { seed: w.seed, locatie: basis.naam, basis: b, runs, let: 'Dezelfde uitgangswereld en seed; alleen de opgegeven keuze verandert. De mens beslist.' };
}

function bewijs(w, d) {
  d = d || {};
  const basisInvarianten = ['Geen dubbele geldboeking', 'Geen automatische allergie-override', 'Geen schrijfrecht naar productie'];
  const vast = { soort: 'Hospitality Simulation Evidence', modelVersie: w.modelVersie, wereld: w.id, seed: w.seed, rtgVersie: d.rtgVersie || 'onbekend', configuratie: d.configuratie || 'synthetisch', runs: Math.max(1, Number(d.runs) || 1), scenariofamilies: d.scenariofamilies || [], injecties: d.injecties || {}, invarianten: d.invarianten || basisInvarianten.concat((w.human && w.human.invarianten) || []), overtredingen: d.overtredingen || [], onzekerheden: w.aannames, beperkingen: w.beperkingen, gegenereerdAt: d.at || klok.datum().toISOString() };
  vast.vingerafdruk = crypto.createHash('sha256').update(JSON.stringify(vast)).digest('hex');
  return vast;
}

module.exports = { analyse, briefing, vergelijk, bewijs };
