'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const maak = require('../server/kern/magnaat-partnerstudio');

function omgeving() {
  const leveranciers = [
    { code: 'ACME', name: 'Acme Systems', type: 'software', city: 'Amsterdam', menu: [{ name: 'Operations Suite', cat: 'Software', price: 9900 }], rooms: [{ name: 'NOC Amsterdam', price: 500 }] },
    { code: 'NOVA', name: 'Nova Logistics', type: 'transport', city: 'Rotterdam', menu: [], rooms: [] }
  ];
  const db = { data: { suppliers: leveranciers } };
  let saves = 0;
  const studio = maak({ db, crypto, save: () => { saves += 1; }, findSupplier: code => leveranciers.find(x => x.code === code) }).magnaatPartnerstudio;
  return { db, studio, a: leveranciers[0], b: leveranciers[1], saves: () => saves };
}
function actor(naam = 'Directeur') { return { name: naam, manager: true }; }
function controleur(sleutel = 'user-22') { return { sleutel, naam: 'Onafhankelijke controleur', rol: 'controleur' }; }
function publicist(sleutel = 'user-1') { return { sleutel, naam: 'RTG-eigenaar', rol: 'publicist' }; }
function bouw(studio, leverancier) {
  let r = studio.overzicht(leverancier);
  r = studio.profielZet(leverancier, actor(), { versie: r.tweeling.versie, sector: 'Enterprise software', bedrijfsmodel: 'platform',
    omschrijving: 'Wij ondersteunen bedrijfskritische processen met een controleerbare operationele softwarelaag.',
    trainingsdoel: 'Medewerkers leren incidenten veilig analyseren, overdragen en aantoonbaar afsluiten.',
    merkInSpel: true, synthetischeDossiers: true, geheimenUitgesloten: true });
  r = studio.bouwsteenZet(leverancier, actor(), 'locatie', { versie: r.tweeling.versie, naam: 'Operations Center', plaats: leverancier.city, locatieSoort: 'kantoor' });
  r = studio.bouwsteenZet(leverancier, actor(), 'afdeling', { versie: r.tweeling.versie, naam: 'Operations', doel: 'Bewaakt continuiteit, kwaliteit en veilige overdracht.' });
  const afdelingId = r.tweeling.afdelingen[0].id;
  r = studio.bouwsteenZet(leverancier, actor(), 'rol', { versie: r.tweeling.versie, naam: 'Incident commander', afdelingId, rechten: ['bekijken', 'goedkeuren'] });
  const rolId = r.tweeling.rollen[0].id;
  r = studio.bouwsteenZet(leverancier, actor(), 'aanbod', { versie: r.tweeling.versie, naam: 'Operations Suite', categorie: 'Software', eenheid: 'tenant' });
  r = studio.bouwsteenZet(leverancier, actor(), 'werkproces', { versie: r.tweeling.versie, naam: 'Incident veilig afhandelen', afdelingId, rolId,
    doel: 'Herstel met bewijs en eigenaar', stappen: ['Controleer impact en bevoegdheid', 'Stabiliseer de dienstverlening', 'Wijs een eigenaar toe', 'Leg bewijs en controlemoment vast'] });
  return r;
}
function slaagProef(studio, leverancier) {
  let r = studio.proefStart(leverancier, actor());
  for (const keuze of [1, 0, 1, 2]) r = studio.proefAntwoord(leverancier, actor(), r.training.id, keuze);
  return r;
}

test('alleen de eigen officiële partner krijgt een geïsoleerde digitale tweeling zonder productiedata', () => {
  const { db, studio, a, b } = omgeving();
  const aa = studio.overzicht(a), bb = studio.overzicht(b);
  assert.equal(aa.tweeling.code, 'ACME');
  assert.equal(bb.tweeling.code, 'NOVA');
  assert.notEqual(aa.tweeling.id, bb.tweeling.id);
  assert.deepEqual(aa.grenzen, ['Geen echt geld', 'Geen productieacties', 'Geen echte klantdossiers', 'Menselijke RTG-goedkeuring voor publicatie']);
  assert.equal(db.data.orders, undefined);
  assert.equal(db.data.pay, undefined);
});

test('een bedrijf bouwt, beproeft en publiceert alleen via menselijke RTG-goedkeuring', () => {
  const { studio, a } = omgeving();
  let r = bouw(studio, a);
  assert.equal(r.gereedheid.score, 95);
  r = slaagProef(studio, a);
  assert.equal(r.training.status, 'voltooid');
  assert.equal(r.training.score, 100);
  assert.equal(r.studio.gereedheid.score, 100);
  r = studio.indienen(a, actor(), { versie: r.studio.tweeling.versie, notitie: 'Controleer rollen, merkgebruik en synthetische grenzen.' });
  assert.equal(r.tweeling.fase, 'wacht-op-rtg');
  assert.equal(studio.publiekeWereld().aantal, 0);
  const teVroeg = studio.boardroomBeslis('ACME', 'goedkeuren', publicist(), 'Veilige proef en gegevensgrenzen gecontroleerd.',
    { versie: r.tweeling.versie, hash: r.tweeling.beoordeling.hash });
  assert.equal(teVroeg.status, 409);
  let besluit = studio.boardroomBeslis('ACME', 'voorcontroleren', controleur(), 'Rechten, rollen en synthetische grenzen onafhankelijk gecontroleerd.',
    { versie: r.tweeling.versie, hash: r.tweeling.beoordeling.hash });
  assert.equal(besluit.bedrijf.beoordeling.status, 'wacht-op-publicatie');
  besluit = studio.boardroomBeslis('ACME', 'goedkeuren', publicist(), 'Gecontroleerde vingerafdruk als tweede persoon vrijgegeven.',
    { versie: besluit.bedrijf.versie, hash: besluit.bedrijf.beoordeling.hash });
  assert.equal(besluit.bedrijf.fase, 'goedgekeurd');
  const wereld = studio.publiekeWereld();
  assert.equal(wereld.aantal, 1);
  assert.equal(wereld.bedrijven[0].spelregels.echtGeld, false);
  assert.equal(wereld.bedrijven[0].spelregels.productieschrijfacties, false);
  assert.equal(wereld.bedrijven[0].cijfers.werkprocessen, 1);
  assert.equal(wereld.bedrijven[0].publicatie.releaseModel, 'vier-ogen-v2');
  assert.equal(wereld.bedrijven[0].publicatie.vierOgen, true);
  assert.equal(JSON.stringify(wereld.bedrijven[0]).includes('doorSleutel'), false, 'boardroom-identiteiten blijven intern');
  assert.equal(Object.hasOwn(wereld.bedrijven[0], 'werkprocessen'), false, 'de wereldkaart ontvangt niet het volledige bedrijfsmodel');
  assert.ok(JSON.stringify(wereld.bedrijven[0]).length < 2500, 'een partnerkaart blijft compact voor een snelle wereldlijst');
});

test('de interactieve bedrijfstraining scoort server-side en beloont maar eenmaal', () => {
  const { studio, a } = omgeving();
  let r = bouw(studio, a); r = slaagProef(studio, a);
  r = studio.indienen(a, actor(), { versie: r.studio.tweeling.versie });
  let b = studio.boardroomBeslis('ACME', 'voorcontroleren', controleur(), 'Volledige onafhankelijke trainingscontrole uitgevoerd.',
    { versie: r.tweeling.versie, hash: r.tweeling.beoordeling.hash });
  studio.boardroomBeslis('ACME', 'goedkeuren', publicist(), 'Als tweede persoon veilig voor de Partnerwereld vrijgegeven.',
    { versie: b.bedrijf.versie, hash: b.bedrijf.beoordeling.hash });
  r = studio.trainingStart('user-42', 'ACME');
  assert.equal(r.training.stap.opties.length, 3);
  assert.equal(Object.hasOwn(r.training.stap, 'juist'), false);
  for (const keuze of [1, 0, 1, 2]) r = studio.trainingAntwoord('user-42', r.training.id, keuze);
  assert.equal(r.training.score, 100);
  assert.equal(studio.trainingClaim('user-42', r.training.id).nieuw, true);
  assert.equal(studio.trainingClaim('user-42', r.training.id).nieuw, false);
});

test('partnerrelaties vereisen instemming van de tegenpartij', () => {
  const { studio, a, b } = omgeving();
  let r = studio.overzicht(a);
  r = studio.relatieVraag(a, actor('Acme manager'), { versie: r.tweeling.versie, doelCode: 'NOVA', soort: 'ketenpartner' });
  const relatie = r.relaties[0];
  assert.equal(relatie.status, 'wacht-op-partner');
  const verkeerd = studio.relatieBeslis(a, actor(), { id: relatie.id, akkoord: true });
  assert.equal(verkeerd.status, 404);
  const goed = studio.relatieBeslis(b, actor('Nova manager'), { id: relatie.id, akkoord: true });
  assert.equal(goed.relaties[0].status, 'actief');
});

test('veilig importeren neemt geen prijzen mee en revisieconflicten worden geweigerd', () => {
  const { studio, a } = omgeving();
  const begin = studio.overzicht(a), oud = begin.tweeling.versie;
  const r = studio.importeer(a, actor(), { versie: oud });
  assert.equal(r.overgenomen.locaties, 1);
  assert.equal(r.overgenomen.aanbod, 1);
  assert.equal(JSON.stringify(r.tweeling.aanbod).includes('9900'), false);
  const conflict = studio.bouwsteenZet(a, actor(), 'locatie', { versie: oud, naam: 'Oud scherm', plaats: 'Utrecht' });
  assert.equal(conflict.status, 409);
});

test('een boardroombesluit zonder auditreden wordt geweigerd', () => {
  const { studio, a } = omgeving();
  let r = bouw(studio, a); r = slaagProef(studio, a);
  r = studio.indienen(a, actor(), { versie: r.studio.tweeling.versie });
  const besluit = studio.boardroomBeslis('ACME', 'voorcontroleren', controleur(), '',
    { versie: r.tweeling.versie, hash: r.tweeling.beoordeling.hash });
  assert.equal(besluit.status, 400);
  assert.equal(studio.publiekeWereld().aantal, 0);
});

test('vier ogen, rollen en een actuele vingerafdruk zijn technisch verplicht', () => {
  const { studio, a } = omgeving();
  let r = bouw(studio, a); r = slaagProef(studio, a);
  r = studio.indienen(a, actor(), { versie: r.studio.tweeling.versie });
  const voorwaarden = { versie: r.tweeling.versie, hash: r.tweeling.beoordeling.hash };
  assert.equal(studio.boardroomBeslis('ACME', 'voorcontroleren', publicist(), 'Eigenaar probeert de voorcontrole te tekenen.', voorwaarden).status, 403);
  assert.equal(studio.boardroomBeslis('ACME', 'voorcontroleren', controleur(), 'Controle met een verouderde vingerafdruk.',
    { versie: voorwaarden.versie, hash: 'verouderd' }).status, 409);
  let b = studio.boardroomBeslis('ACME', 'voorcontroleren', controleur('user-44'), 'Onafhankelijke controle op inhoud en grenzen.', voorwaarden);
  assert.equal(b.ok, true);
  assert.equal(studio.boardroomBeslis('ACME', 'goedkeuren', controleur('user-55'), 'Controleur probeert te publiceren.',
    { versie: b.bedrijf.versie, hash: b.bedrijf.beoordeling.hash }).status, 403);
  assert.equal(studio.boardroomBeslis('ACME', 'goedkeuren', publicist('user-44'), 'Dezelfde identiteit probeert beide handtekeningen te zetten.',
    { versie: b.bedrijf.versie, hash: b.bedrijf.beoordeling.hash }).status, 409);
  b = studio.boardroomBeslis('ACME', 'goedkeuren', publicist(), 'Onafhankelijke tweede handtekening voor publicatie.',
    { versie: b.bedrijf.versie, hash: b.bedrijf.beoordeling.hash });
  assert.equal(b.ok, true);
  assert.equal(b.bedrijf.gepubliceerd.releaseModel, 'vier-ogen-v2');
});

test('de volledige partnerketen is bereikbaar in leverancier, speler en boardroom UI', () => {
  const lees = bestand => fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');
  const routes = lees('server/routes/magnaatwereld.js');
  const speler = lees('public/apps/magnaat.html');
  const kantoor = lees('public/apps/magnaat-kantoor.html');
  const leverancier = lees('public/apps/leverancier/leverancier-72.js');
  assert.match(routes, /\/api\/supplier\/magnaat\/studio\/indienen/);
  assert.match(routes, /\/api\/member\/magnaat\/partner\/start/);
  assert.match(routes, /\/api\/member\/magnaat\/teamkamer\/maak/);
  assert.match(routes, /\/api\/office\/magnaat\/partner\/beslis/);
  assert.match(routes, /managerOnly/);
  assert.match(speler, /id="partnerCompanies"/);
  assert.match(speler, /function answerPartnerTraining/);
  assert.match(speler, /function renderTeamRoom/);
  assert.match(speler, /id=\"teamEvidence\"/);
  assert.doesNotMatch(speler, /function completeTeamTask\(\).*prompt\(/,
    'teamgameplay gebruikt een zichtbaar bewijsveld en geen blokkerende browserprompt');
  assert.match(kantoor, /id="partnerTwins"/);
  assert.match(kantoor, /function partnerDecision/);
  assert.match(kantoor, /vier-ogen/i);
  assert.match(leverancier, /magnaat-partnerstudio\.html/);
});
