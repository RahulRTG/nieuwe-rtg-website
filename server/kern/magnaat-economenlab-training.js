'use strict';

const B = require('./magnaat-economenlab-basis');
const R = require('./magnaat-economenlab-rapport');
const { HYPOTHESEN, MAATREGELEN, RICHTINGEN, INDICATOREN, RELEVANT, PASSEND,
  getal, rond, cent, pct, tekst, zorgStaat, rekeningSaldo } = B;

function valideerAnalyse(e, invoer) {
  const fout = error => ({ error, status: 400 });
  const hypothese = tekst(invoer.hypothese, 30), maatregel = tekst(invoer.maatregel, 40);
  if (!HYPOTHESEN.includes(hypothese)) return fout('Kies een economische hypothese.');
  if (!MAATREGELEN.includes(maatregel)) return fout('Kies een uitvoerbare maatregel.');
  const geldig = new Set(INDICATOREN.map(x => x[0]));
  const indicatoren = [...new Set(Array.isArray(invoer.indicatoren) ? invoer.indicatoren.map(String).filter(x => geldig.has(x)) : [])];
  if (indicatoren.length < 2) return fout('Onderbouw de analyse met minimaal twee gemeten indicatoren.');
  const velden = [
    ['causaleKeten', 45, 700, 'Beschrijf de causale keten in minimaal 45 tekens.'],
    ['alternatief', 25, 500, 'Benoem een serieus alternatief.'],
    ['opportunityCost', 25, 500, 'Benoem de opportunity cost.'],
    ['risico', 25, 500, 'Benoem het belangrijkste risico.']
  ];
  const uit = { hypothese, maatregel, indicatoren };
  for (const [naam, min, max, melding] of velden) {
    uit[naam] = tekst(invoer[naam], max);
    if (uit[naam].length < min) return fout(melding);
  }
  for (const naam of ['omzetRichting', 'winstRichting', 'kasRichting']) {
    uit[naam] = tekst(invoer[naam], 12);
    if (!RICHTINGEN.includes(uit[naam])) return fout('Kies een richting voor omzet, winst en kas.');
  }
  const omzet = Number(invoer.verwachteOmzet), winst = Number(invoer.verwachteWinst);
  const inflatie = Number(invoer.verwachteInflatie), zekerheid = Number(invoer.zekerheid);
  if (!Number.isFinite(omzet) || omzet < 0 || omzet > 50000000) return fout('De omzetverwachting moet tussen 0 en 50.000.000 euro liggen.');
  if (!Number.isFinite(winst) || winst < -50000000 || winst > 50000000) return fout('De winstverwachting moet tussen -50.000.000 en 50.000.000 euro liggen.');
  if (!Number.isFinite(inflatie) || inflatie < -5 || inflatie > 30) return fout('De inflatieverwachting moet tussen -5% en 30% liggen.');
  if (!Number.isFinite(zekerheid) || zekerheid < 50 || zekerheid > 95) return fout('Zekerheid moet tussen 50% en 95% liggen.');
  uit.voorspelling = { omzet: cent(omzet), winst: cent(winst), inflatie: pct(inflatie), zekerheid: rond(zekerheid) };
  return { waarde: uit };
}

function dienAnalyse(e, actor, invoer) {
  const geldig = valideerAnalyse(e, invoer || {});
  if (geldig.error) return geldig;
  const a = geldig.waarde, juist = R.diagnose(e, e.bedrijven.praktijk), relevant = new Set(RELEVANT[juist] || []);
  const bewijsRaak = a.indicatoren.filter(x => relevant.has(x)).length;
  const dimensies = {
    diagnose: a.hypothese === juist ? 20 : (RELEVANT[a.hypothese] || []).some(x => relevant.has(x)) ? 8 : 0,
    bewijs: Math.min(15, bewijsRaak * 6 + Math.min(3, a.indicatoren.length - 2)),
    causaliteit: Math.min(15, 8 + Math.floor(a.causaleKeten.length / 90)),
    besluit: (PASSEND[a.hypothese] || []).includes(a.maatregel) ? 10 : 4,
    alternatief: Math.min(5, 3 + Math.floor(a.alternatief.length / 120)),
    opportunityCost: Math.min(5, 3 + Math.floor(a.opportunityCost.length / 120)),
    onzekerheid: a.voorspelling.zekerheid <= 90 ? 5 : 2
  };
  const voorlopig = Object.values(dimensies).reduce((t, n) => t + n, 0), sleutel = tekst(actor, 180) || 'anonieme-econoom';
  const bestaandeLijst = zorgStaat(e).analyses[sleutel] || [];
  const analyse = {
    id: 'EA-' + e.dag + '-' + String(bestaandeLijst.length + 1).padStart(3, '0'),
    dag: e.dag, doelDag: e.dag + 1, status: 'wacht-op-realisatie', hypothese: a.hypothese,
    maatregel: a.maatregel, indicatoren: a.indicatoren, causaleKeten: a.causaleKeten,
    alternatief: a.alternatief, opportunityCost: a.opportunityCost, risico: a.risico,
    richtingen: { omzet: a.omzetRichting, winst: a.winstRichting, kas: a.kasRichting },
    voorspelling: a.voorspelling, juisteDiagnose: juist, dimensies, scoreVoorlopig: voorlopig,
    score: voorlopig, maximum: 100,
    feedback: [
      a.hypothese === juist ? 'De diagnose past bij de bindende beperking.' : 'Vergelijk uw hypothese na de realisatie met de bindende beperking.',
      bewijsRaak >= 2 ? 'De gekozen indicatoren dragen de redenering.' : 'Minstens twee gekozen indicatoren horen rechtstreeks bij de gemeten beperking.'
    ]
  };
  const lijst = zorgStaat(e).analyses[sleutel] || (e.economen.analyses[sleutel] = []);
  const bestaand = lijst.findIndex(x => x.dag === e.dag);
  if (bestaand >= 0) lijst[bestaand] = analyse; else lijst.push(analyse);
  if (lijst.length > 60) lijst.splice(0, lijst.length - 60);
  return { ok: true, analyse: R.publiekAnalyse(analyse) };
}

function richting(n, marge) {
  if (n > marge) return 'stijgt';
  if (n < -marge) return 'daalt';
  return 'gelijk';
}
function nauwkeurigheid(verwacht, werkelijk, punten, schaal) {
  const fout = Math.abs(getal(verwacht) - getal(werkelijk));
  return Math.max(0, Math.round(punten * (1 - fout / Math.max(1, getal(schaal)))));
}
function verwerkDag(e) {
  const b = e.bedrijven.praktijk, hist = e.historie || [], vorige = hist.length > 1 ? hist[hist.length - 2].bedrijven.praktijk : null;
  const omzetVerschil = b.omzetVandaag - (vorige ? vorige.omzet : 0), winstVerschil = b.winstVandaag - (vorige ? vorige.winst : 0);
  const kas = rekeningSaldo(e, b.id + '.kas'), kasVerschil = kas - (vorige ? vorige.kas : kas);
  for (const lijst of Object.values(zorgStaat(e).analyses)) for (const a of lijst) {
    if (a.status !== 'wacht-op-realisatie' || a.doelDag !== e.dag) continue;
    const uitkomst = { omzet: b.omzetVandaag, winst: b.winstVandaag, inflatie: e.macro.inflatie, kas };
    const richtingPunten = [
      a.richtingen.omzet === richting(omzetVerschil, Math.max(100, Math.abs(b.omzetVandaag) * .01)),
      a.richtingen.winst === richting(winstVerschil, Math.max(100, Math.abs(b.omzetVandaag) * .01)),
      a.richtingen.kas === richting(kasVerschil, Math.max(100, Math.abs(kas) * .005))
    ].filter(Boolean).length;
    const forecast = {
      omzet: nauwkeurigheid(a.voorspelling.omzet, uitkomst.omzet, 8, Math.max(1, uitkomst.omzet)),
      winst: nauwkeurigheid(a.voorspelling.winst, uitkomst.winst, 8, Math.max(1, Math.abs(uitkomst.winst), Math.abs(uitkomst.omzet) * .2)),
      inflatie: nauwkeurigheid(a.voorspelling.inflatie, uitkomst.inflatie, 3, 3), richting: richtingPunten * 2
    };
    const basisFout = (Math.abs(a.voorspelling.omzet - uitkomst.omzet) / Math.max(1, uitkomst.omzet) +
      Math.abs(a.voorspelling.winst - uitkomst.winst) / Math.max(1, Math.abs(uitkomst.winst), Math.abs(uitkomst.omzet) * .2)) / 2;
    forecast.kalibratie = (a.voorspelling.zekerheid >= 80 && basisFout > .25) ||
      (a.voorspelling.zekerheid <= 60 && basisFout < .08) ? 0 : 1;
    a.dimensies.voorspelling = Math.min(25, Object.values(forecast).reduce((t, n) => t + n, 0));
    a.score = Math.min(100, a.scoreVoorlopig + a.dimensies.voorspelling);
    a.status = 'beoordeeld';
    a.uitkomst = uitkomst;
    a.forecastPunten = forecast;
    a.feedback.push('Voorspelfout is tegen de gerealiseerde dag gemeten; richting en niveau tellen afzonderlijk.');
  }
}

module.exports = { dienAnalyse, verwerkDag, valideerAnalyse };
