'use strict';
const B = require('./magnaat-economenlab-basis');
const { HYPOTHESEN, MAATREGELEN, RICHTINGEN, INDICATOREN, rond, pct, tekst, zorgStaat, rekeningSaldo, somRekeningen } = B;

function resultatenrekening(b) {
  const k = b.kostenUitsplitsing || {}, omzet = rond(b.omzetVandaag), kostprijs = rond(k.kostprijs), brutowinst = omzet - kostprijs;
  const bedrijfskosten = rond(k.loon) + rond(k.training) + rond(k.impact), bedrijfsresultaat = brutowinst - bedrijfskosten;
  const resultaatVoorBelasting = bedrijfsresultaat - rond(k.rente);
  return { omzet, kostprijs, brutowinst, loon: rond(k.loon), training: rond(k.training), impact: rond(k.impact),
    bedrijfsresultaat, rente: rond(k.rente), resultaatVoorBelasting, belasting: rond(k.belasting),
    nettoresultaat: resultaatVoorBelasting - rond(k.belasting) };
}
function balans(e, b) {
  const kas = Math.max(0, rekeningSaldo(e, b.id + '.kas')), voorraad = Math.max(0, rekeningSaldo(e, b.id + '.voorraad'));
  const schuld = Math.max(0, -rekeningSaldo(e, b.id + '.schuld')), ingebracht = Math.max(0, -rekeningSaldo(e, b.id + '.eigen-vermogen'));
  const opbrengsten = Math.max(0, -somRekeningen(e, b.id, 'opbrengsten')), kosten = Math.max(0, somRekeningen(e, b.id, 'kosten'));
  const ingehoudenResultaat = opbrengsten - kosten, activa = kas + voorraad, passiva = schuld + ingebracht + ingehoudenResultaat;
  return { activa: { kas, voorraad, totaal: activa }, passiva: { schuld, ingebracht, ingehoudenResultaat, totaal: passiva }, controle: { verschil: activa - passiva, inBalans: activa === passiva } };
}
function kasstroom(e, b) {
  let operationeel = 0, financiering = 0;
  for (const post of e.journaal || []) {
    if (post.dag !== e.dag) continue;
    const delta = (post.regels || []).filter(r => r.rekening === b.id + '.kas').reduce((t, r) => t + rond(r.debet) - rond(r.credit), 0);
    if ((post.labels || []).includes('krediet')) financiering += delta; else operationeel += delta;
  }
  const mutatie = operationeel + financiering, eind = Math.max(0, rekeningSaldo(e, b.id + '.kas'));
  return { operationeel, financiering, investering: 0, mutatie, begin: eind - mutatie, eind, controle: 0 };
}
function kengetallen(e, b) {
  const rr = resultatenrekening(b), totaalVerkoop = Object.values(e.bedrijven || {}).reduce((t, x) => t + rond(x.verkopenVandaag), 0);
  const dagkosten = Math.max(1, rond(b.kostenVandaag)), kas = Math.max(0, rekeningSaldo(e, b.id + '.kas'));
  return { brutomarge: pct(rr.omzet ? rr.brutowinst / rr.omzet * 100 : 0), nettomarge: pct(rr.omzet ? rr.nettoresultaat / rr.omzet * 100 : 0),
    arbeidsproductiviteit: rond(rr.omzet / Math.max(1, b.personeel)), marktaandeel: pct(totaalVerkoop ? b.verkopenVandaag / totaalVerkoop * 100 : 0),
    kasbufferDagen: pct(kas / dagkosten), schuldgraad: pct(Math.max(0, -rekeningSaldo(e, b.id + '.schuld')) / Math.max(1, kas + Math.max(0, rekeningSaldo(e, b.id + '.voorraad'))) * 100),
    voorraadOmloopDagen: pct(b.verkopenVandaag ? b.voorraad / b.verkopenVandaag : b.voorraad ? 999 : 0) };
}
function diagnose(e, b) {
  const k = kengetallen(e, b);
  if (k.kasbufferDagen < 3) return 'liquiditeit';
  if (b.levergraad < 85 || (b.voorraad < b.vraagVandaag * .35 && b.levergraad < 95)) return 'aanbod';
  if (b.personeel < b.personeelDoel && b.benutting >= 82) return 'arbeid';
  if (b.vraagVandaag > b.capaciteitVandaag && b.benutting >= 90) return 'capaciteit';
  const ander = Object.values(e.bedrijven || {}).find(x => x.id !== b.id);
  if (ander && b.prijs > ander.prijs * 1.15 && k.marktaandeel < 45) return 'prijs';
  if (b.vraagVandaag < b.capaciteitVandaag * .7) return 'vraag';
  return 'productiviteit';
}
function indicatorWaarden(e, b) {
  const k = kengetallen(e, b), w = { vraag: b.vraagVandaag, verkoop: b.verkopenVandaag, capaciteit: b.capaciteitVandaag,
    benutting: b.benutting, levergraad: b.levergraad, voorraad: b.voorraad, kasbuffer: k.kasbufferDagen,
    schuld: Math.max(0, -rekeningSaldo(e, b.id + '.schuld')), marge: k.nettomarge, marktaandeel: k.marktaandeel,
    werkloosheid: e.macro.werkloosheid, inflatie: e.macro.inflatie, rente: e.macro.rente };
  return INDICATOREN.map(([id, label, eenheid]) => ({ id, label, eenheid, waarde: w[id] }));
}
function opdracht(e) {
  return { id: 'econoom-dag-' + e.dag, dag: e.dag, doelDag: e.dag + 1, titel: 'Directiebriefing voor dag ' + (e.dag + 1),
    vraag: 'Wat is nu de bindende beperking, welke maatregel adviseert u en wat verwacht u morgen?',
    context: 'Gebruik minimaal twee gemeten indicatoren. Benoem de causale keten, een alternatief, opportunity cost en onzekerheid.',
    indicatoren: indicatorWaarden(e, e.bedrijven.praktijk), hypothesen: HYPOTHESEN.slice(), maatregelen: MAATREGELEN.slice(), richtingen: RICHTINGEN.slice() };
}
function prijsVolumeBrug(e) {
  const h = e.historie || [];
  if (h.length < 2) return { beschikbaar: false, uitleg: 'Na twee economische dagen wordt prijs- en volume-effect gescheiden.' };
  const voor = h[h.length - 2].bedrijven.praktijk, na = h[h.length - 1].bedrijven.praktijk;
  const prijsVoor = rond(voor.prijs), prijsNa = rond(na.prijs), qVoor = rond(voor.verkoop), qNa = rond(na.verkoop);
  const prijseffect = (prijsNa - prijsVoor) * qVoor, volumeEffect = (qNa - qVoor) * prijsVoor, interactie = (prijsNa - prijsVoor) * (qNa - qVoor);
  return { beschikbaar: true, omzetVerschil: rond(na.omzet - voor.omzet), prijseffect, volumeEffect, interactie, controle: rond(na.omzet - voor.omzet) - prijseffect - volumeEffect - interactie };
}
function publiekAnalyse(a) {
  if (!a) return null;
  return { id: a.id, dag: a.dag, doelDag: a.doelDag, status: a.status, hypothese: a.hypothese, maatregel: a.maatregel,
    indicatoren: a.indicatoren, richtingen: a.richtingen, voorspelling: a.voorspelling, uitkomst: a.uitkomst || null,
    dimensies: Object.assign({}, a.dimensies), scoreVoorlopig: a.scoreVoorlopig, score: a.score, maximum: a.maximum, feedback: a.feedback.slice() };
}
function rapport(e, actor) {
  const b = e.bedrijven.praktijk, sleutel = tekst(actor, 180) || 'anonieme-econoom';
  const analyses = (zorgStaat(e).analyses[sleutel] || []).slice(-8).reverse().map(publiekAnalyse);
  return { methode: 'hypothese → indicatoren → besluit → voorspelling → realisatie → forecastfout', opdracht: opdracht(e),
    resultatenrekening: resultatenrekening(b), balans: balans(e, b), kasstroom: kasstroom(e, b), kengetallen: kengetallen(e, b),
    prijsVolumeBrug: prijsVolumeBrug(e), analyses, laatsteAnalyse: analyses[0] || null,
    rubric: [['diagnose', 'Bindende beperking', 20], ['bewijs', 'Gemeten bewijs', 15], ['causaliteit', 'Causale keten', 15], ['besluit', 'Besluitlogica', 10], ['alternatief', 'Alternatief', 5], ['opportunityCost', 'Opportunity cost', 5], ['onzekerheid', 'Onzekerheid', 5], ['voorspelling', 'Forecast en kalibratie', 25]].map(x => ({ id: x[0], naam: x[1], punten: x[2] })),
    grenzen: ['Geen beleidskeuze is zonder context universeel juist.', 'Een voorspelling is een toetsbare verwachting, geen belofte.', 'Niet gemeten posten worden niet alsnog geraamd.'] };
}
module.exports = { rapport, resultatenrekening, balans, kasstroom, kengetallen, diagnose, opdracht, publiekAnalyse };
