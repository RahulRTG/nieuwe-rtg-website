const test = require('node:test');
const assert = require('node:assert/strict');
const maak = require('../server/kern/magnaat-economie');

function motor() {
  const wereld = {};
  const economie = maak({ wereldState: () => wereld, save: () => {} });
  return { wereld, economie };
}

function goedeAnalyse(overzicht, extra = {}) {
  return Object.assign({
    hypothese: 'productiviteit', maatregel: 'training-investeren',
    indicatoren: ['capaciteit', 'benutting', 'marge'],
    causaleKeten: 'Training verhoogt menselijk kapitaal, daarna capaciteit en kwaliteit; via verkoop en kostprijs verandert het nettoresultaat.',
    alternatief: 'De prijs ongemoeid laten en eerst een dag extra meten is het serieuze alternatief.',
    opportunityCost: 'Het trainingsbudget kan dezelfde dag niet als liquiditeitsbuffer worden aangehouden.',
    risico: 'De productiviteitswinst kan later of kleiner zijn dan de investering veronderstelt.',
    omzetRichting: 'stijgt', winstRichting: 'stijgt', kasRichting: 'daalt',
    verwachteOmzet: overzicht.strategie.omzetVandaag / 100,
    verwachteWinst: overzicht.strategie.winstVandaag / 100,
    verwachteInflatie: overzicht.macro.inflatie,
    zekerheid: 70
  }, extra);
}

test('voorraad staat als actief op een sluitende economische balans', () => {
  const { economie } = motor();
  const lab = economie.overzicht('econoom-a').economenlab;
  assert.ok(lab.balans.activa.voorraad > 0);
  assert.equal(lab.balans.controle.verschil, 0);
  assert.equal(lab.balans.controle.inBalans, true);
});

test('inkoop kapitaliseert voorraad en verkoop boekt de kostprijs in de resultatenrekening', () => {
  const { wereld, economie } = motor();
  const dag = economie.volgendeDag('econoom-a', 'voorraad-dag-1');
  const lab = dag.economenlab;
  assert.ok(lab.resultatenrekening.kostprijs > 0);
  assert.equal(lab.resultatenrekening.nettoresultaat, dag.strategie.winstVandaag);
  assert.equal(lab.balans.controle.verschil, 0);
  assert.equal(lab.kasstroom.controle, 0);
  assert.equal(lab.kasstroom.begin + lab.kasstroom.mutatie, lab.kasstroom.eind);
  const inkoop = wereld.economie.journaal.find(j => j.sleutel === 'dag:1:inkoop:praktijk');
  const kostprijs = wereld.economie.journaal.find(j => j.sleutel === 'dag:1:kostprijs:praktijk');
  assert.ok(inkoop.regels.some(r => r.rekening === 'praktijk.voorraad' && r.debet > 0));
  assert.ok(kostprijs.regels.some(r => r.rekening === 'praktijk.voorraad' && r.credit > 0));
});

test('een econoom moet hypothese, gemeten bewijs, causaliteit en onzekerheid vastleggen', () => {
  const { economie } = motor();
  const fout = economie.analyse('econoom-a', { hypothese: 'vraag', maatregel: 'prijs-verlagen' });
  assert.equal(fout.status, 400);
  assert.match(fout.error, /indicatoren/i);
  const goed = economie.analyse('econoom-a', goedeAnalyse(economie.overzicht('econoom-a')));
  assert.equal(goed.ingediend.status, 'wacht-op-realisatie');
  assert.ok(goed.ingediend.scoreVoorlopig > 0);
  assert.equal(goed.economenlab.laatsteAnalyse.status, 'wacht-op-realisatie');
});

test('de volgende dag ijkt de forecast en maakt de trainingsscore definitief', () => {
  const { economie } = motor();
  economie.analyse('econoom-a', goedeAnalyse(economie.overzicht('econoom-a')));
  const dag = economie.volgendeDag('econoom-a', 'forecast-dag-1');
  const a = dag.economenlab.laatsteAnalyse;
  assert.equal(a.status, 'beoordeeld');
  assert.equal(a.doelDag, 1);
  assert.ok(a.uitkomst && Number.isFinite(a.uitkomst.omzet));
  assert.ok(a.dimensies.voorspelling >= 0 && a.dimensies.voorspelling <= 25);
  assert.ok(a.score >= a.scoreVoorlopig && a.score <= 100);
});

test('analyses zijn persoonlijk terwijl de economische realisatie gedeeld blijft', () => {
  const { economie } = motor();
  economie.analyse('econoom-a', goedeAnalyse(economie.overzicht('econoom-a')));
  assert.ok(economie.overzicht('econoom-a').economenlab.laatsteAnalyse);
  assert.equal(economie.overzicht('econoom-b').economenlab.laatsteAnalyse, null);
  const dag = economie.volgendeDag('econoom-b', 'gedeelde-dag-1');
  assert.equal(dag.dag, 1);
  assert.equal(economie.overzicht('econoom-a').economenlab.laatsteAnalyse.status, 'beoordeeld');
});

test('de prijs-volume-brug sluit exact aan op de omzetverandering', () => {
  const { economie } = motor();
  economie.volgendeDag('econoom-a', 'brug-dag-1');
  economie.beslis('econoom-a', { prijs: 99 });
  const dag = economie.volgendeDag('econoom-a', 'brug-dag-2');
  assert.equal(dag.economenlab.prijsVolumeBrug.beschikbaar, true);
  assert.equal(dag.economenlab.prijsVolumeBrug.controle, 0);
});
