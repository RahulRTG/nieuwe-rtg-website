const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const path = require('path');
const functies = require('../server/functies');
const maakScanner = require('../server/kern/magnaat-capabilities');
const maakControle = require('../server/kern/magnaat-controle');

const root = path.join(__dirname, '..');

function omgeving() {
  const wereld = {};
  const graph = maakScanner({ root, functies }).scan();
  let saves = 0;
  let tijd = 1700000000000;
  const controle = maakControle({
    wereldState: () => wereld, getGraph: () => graph, crypto,
    save: () => { saves += 1; }, nu: () => ++tijd
  });
  return { wereld, graph, controle, saves: () => saves };
}

const boardroom = { key: 'user-eigenaar', boardroom: true, rol: 'Boardroom-regisseur' };
const serviceMedewerker = { key: 'user-service', kantoorId: 'klantenservice', rol: 'Klantenservice-medewerker' };
const serviceCoordinator = { key: 'user-coordinator', kantoorId: 'klantenservice', rol: 'Klantenservice-coördinator' };
const serviceTrainee = { key: 'user-trainee', kantoorId: 'klantenservice', rol: 'Trainee' };

test('letterlijk iedere API, scherm, functievlag en procesfamilie heeft één controlepunt', () => {
  const { graph, controle } = omgeving();
  const d = controle.overzicht(boardroom, { limiet: 10 });
  assert.equal(d.dekking.api, graph.endpoints.length);
  assert.equal(d.dekking.schermen, graph.apps.length);
  assert.equal(d.dekking.functies, functies.FUNCTIES.length);
  assert.equal(d.dekking.werkprocessen, graph.workflows.length);
  assert.equal(d.dekking.totaal, graph.endpoints.length + graph.apps.length + functies.FUNCTIES.length + graph.workflows.length);
  assert.equal(d.dekking.gekoppeld, d.dekking.totaal);
  assert.equal(d.dekking.percentage, 100);
  assert.ok(d.dekking.totaal >= 2500);
  assert.equal(new Set(graph.controlepunten.map(p => p.id)).size, graph.controlepunten.length);
});

test('een kantoor ziet alleen zijn eigen punten en een medewerker kan niet schakelen', () => {
  const { controle } = omgeving();
  const d = controle.overzicht(serviceMedewerker, { limiet: 100 });
  assert.ok(d.samenvatting.totaal > 0);
  assert.ok(d.punten.every(p => p.kantoor.id === 'klantenservice'));
  assert.ok(d.punten.every(p => p.rechten.magZien));
  const fout = controle.zet(serviceMedewerker, d.punten[0].id, { aan: false });
  assert.equal(fout.status, 403);
  const trainee = controle.overzicht(serviceTrainee, { limiet: 10 });
  assert.ok(trainee.punten.every(p => !p.rechten.magUitvoeren));
});

test('een coördinator beheert groen en geel in het eigen kantoor maar nooit rode punten', () => {
  const { graph, controle } = omgeving();
  const groen = graph.controlepunten.find(p => p.kantoor.id === 'klantenservice' && p.risico !== 'rood');
  const uit = controle.zet(serviceCoordinator, groen.id, { aan: false });
  assert.equal(uit.ok, true);
  assert.equal(uit.punt.aan, false);
  assert.equal(uit.punt.status, 'gestopt');
  assert.equal(uit.punt.productieGewijzigd, false);
  const rood = graph.controlepunten.find(p => p.risico === 'rood');
  const verkeerdeCoordinator = { key: 'coordinator-rood', kantoorId: rood.kantoor.id, rol: rood.kantoor.naam + '-coördinator' };
  const geweigerd = controle.zet(verkeerdeCoordinator, rood.id, { status: 'onderhoud' });
  assert.equal(geweigerd.status, 403);
});

test('de boardroom kan rode punten bedienen en de verantwoordelijke ruimte herstellen', () => {
  const { graph, controle } = omgeving();
  const punt = graph.controlepunten.find(p => p.risico === 'rood' && p.kantoor.id !== 'intern');
  const oudKantoor = punt.kantoor.id;
  const r = controle.zet(boardroom, punt.id, { kantoorId: 'intern', rol: 'Intern & IT-coördinator', status: 'aandacht' });
  assert.equal(r.ok, true);
  assert.equal(r.punt.kantoor.id, 'intern');
  assert.equal(r.punt.rol, 'Intern & IT-coördinator');
  assert.equal(r.punt.status, 'aandacht');
  assert.equal(r.punt.productieGewijzigd, false);
  const oudOverzicht = controle.overzicht({ key: 'oud', kantoorId: oudKantoor, rol: punt.kantoor.naam + '-coördinator' }, { limiet: 100 });
  const nieuwOverzicht = controle.overzicht({ key: 'nieuw', kantoorId: 'intern', rol: 'Intern & IT-coördinator' }, { limiet: 100 });
  assert.equal(oudOverzicht.punten.some(p => p.id === punt.id), false);
  assert.equal(nieuwOverzicht.punten.some(p => p.id === punt.id), true);
});

test('coördinatoren maken taken en alleen de toegewezen kantoorrol rondt ze met bewijs af', () => {
  const { graph, controle } = omgeving();
  const punt = graph.controlepunten.find(p => p.kantoor.id === 'klantenservice' && p.risico !== 'rood');
  const gemaakt = controle.taakMaak(serviceCoordinator, punt.id, {
    toegewezenRol: 'Klantenservice-medewerker', prioriteit: 'hoog',
    titel: 'Controleer deze servicefunctie'
  });
  assert.equal(gemaakt.ok, true);
  assert.equal(gemaakt.taak.status, 'open');
  const ander = controle.taakZet({ key: 'hr', kantoorId: 'hr', rol: 'HR-medewerker' }, gemaakt.taak.id, 'klaar', 'Alles is goed getest.');
  assert.equal(ander.status, 403);
  const zonderBewijs = controle.taakZet(serviceMedewerker, gemaakt.taak.id, 'klaar', 'kort');
  assert.equal(zonderBewijs.status, 400);
  const klaar = controle.taakZet(serviceMedewerker, gemaakt.taak.id, 'klaar', 'Werking, grensgeval en overdracht zijn in de trainingskopie getest.');
  assert.equal(klaar.ok, true);
  assert.equal(klaar.taak.status, 'klaar');
  assert.equal(klaar.punt.teststatus, 'geslaagd');
  const eigen = controle.overzicht(serviceMedewerker, { limiet: 10 });
  assert.equal(eigen.taken.some(t => t.id === gemaakt.taak.id), true);
});

test('filters en paginering houden duizenden knoppen beheersbaar', () => {
  const { controle } = omgeving();
  const bank = controle.overzicht(boardroom, { kantoorId: 'bank', soort: 'api', zoek: 'rekening', pagina: 1, limiet: 10 });
  assert.equal(bank.punten.length <= 10, true);
  assert.ok(bank.punten.every(p => p.kantoor.id === 'bank' && p.soort === 'api'));
  assert.ok(bank.punten.every(p => [p.naam, p.route, p.sleutel].join(' ').toLowerCase().includes('rekening')));
  assert.ok(bank.paginering.totaal >= bank.punten.length);
});

test('een medewerker test veilig de echte bedrading van een eigen ingeschakeld codepunt', () => {
  const { graph, controle } = omgeving();
  const punt = graph.controlepunten.find(p => p.kantoor.id === 'klantenservice' && p.soort === 'api' && p.risico !== 'rood');
  const getest = controle.zelftest(serviceMedewerker, punt.id);
  assert.equal(getest.ok, true);
  assert.equal(getest.geslaagd, true);
  assert.ok(getest.controles.length >= 5);
  assert.match(getest.bewijs, /productie is niet aangeroepen/i);
  assert.equal(getest.punt.teststatus, 'geslaagd');
  controle.zet(serviceCoordinator, punt.id, { aan: false });
  assert.equal(controle.zelftest(serviceMedewerker, punt.id).status, 423);
  const anderPunt = graph.controlepunten.find(p => p.kantoor.id === 'klantenservice' && p.id !== punt.id);
  assert.equal(controle.zelftest(serviceTrainee, anderPunt.id).status, 403);
});

test('de veilige zelftest slaagt voor ieder automatisch gevonden codepunt', () => {
  const { graph, controle } = omgeving();
  for (const punt of graph.controlepunten) {
    const resultaat = controle.zelftest(boardroom, punt.id);
    assert.equal(resultaat.geslaagd, true, punt.naam + ' moet volledig bedraad zijn');
  }
});
