/* Magnaat Teamkamers: samen oefenen in de bevroren digitale tweeling van een
   gepubliceerd partnerbedrijf. De kamer bewaart uitsluitend synthetische
   spelstaat. Sleutels van leden verlaten de server niet; alle mutaties zijn
   server-authoritatief, revisiegebonden en idempotent per commando. */
'use strict';

const klok = require('../lib/klok');
const maakActies = require('./magnaat-trainingslobby-acties');
const maakRegie = require('./magnaat-trainingslobby-regie');
const VERSIE = 1;
const MAX_DEELNEMERS = 12;
const MAX_KAMERS_PER_HOST = 10;
const MAX_LOG = 160;

module.exports = ({ db, save, bewerkCollectie = null, crypto, partnerstudio, codenaamVan, sseToCustomer = null }) => {
  const nu = () => klok.datum().toISOString();
  const tekst = (v, max = 180) => String(v == null ? '' : v)
    .replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const id = voor => voor + '-' + crypto.randomBytes(7).toString('hex');
  const kopie = v => JSON.parse(JSON.stringify(v));
  const fout = (error, status = 400) => ({ error, status });

  let actieveStaat = null;
  function normaliseer(s) {
    if (!s || typeof s !== 'object') s = {};
    s.versie = VERSIE;
    if (!s.kamers || typeof s.kamers !== 'object') s.kamers = {};
    return s;
  }
  function staat() {
    if (actieveStaat) return normaliseer(actieveStaat);
    db.data.magnaatTrainingslobbies = normaliseer(db.data.magnaatTrainingslobbies);
    return db.data.magnaatTrainingslobbies;
  }
  /* In productie levert de opslag een database-slot. De callback zelf blijft
     synchroon; PostgreSQL mag vóór de callback op het slot wachten en commit
     erna. Tests en losse modulegebruikers zonder opslagprimitive houden het
     bestaande synchrone contract. */
  function metActueleStaat(werk) {
    if (typeof bewerkCollectie !== 'function') return werk();
    return bewerkCollectie('magnaatTrainingslobbies', bron => {
      actieveStaat = normaliseer(bron);
      try { return werk(); }
      finally { actieveStaat = null; }
    });
  }
  function label(key) {
    let naam = null;
    try { naam = codenaamVan && codenaamVan(key); } catch (e) {}
    return tekst(naam, 80) || 'Teamspeler';
  }
  function toegangscode() {
    let code;
    do { code = crypto.randomBytes(8).toString('base64url').replace(/[-_]/g, '').slice(0, 9).toUpperCase(); }
    while (!code || Object.values(staat().kamers).some(k => k.toegangscode === code));
    return code;
  }
  function deelnemer(kamer, key) { return kamer.deelnemers.find(d => d.key === tekst(key, 150)); }
  function vind(key, kamerId) {
    const kamer = staat().kamers[tekst(kamerId, 100)];
    if (!kamer) return { fout: fout('Deze teamkamer bestaat niet.', 404) };
    const d = deelnemer(kamer, key);
    if (!d) return { fout: fout('U bent geen deelnemer van deze teamkamer.', 403) };
    return { kamer, d };
  }
  function log(kamer, d, actie, detail) {
    kamer.log.unshift({ id: id('event'), at: nu(), door: d ? d.naam : 'systeem', actie, detail: tekst(detail, 400) });
    kamer.log = kamer.log.slice(0, MAX_LOG);
  }
  function teamkamerRolVan(kamer, d) { return kamer.rollen.find(r => r.id === d.rolId) || null; }
  function taakPubliek(kamer) {
    const taak = kamer.taken[kamer.taakIndex];
    if (!taak) return null;
    const eigenaar = kamer.deelnemers.find(d => d.id === taak.eigenaarId);
    return { id: taak.id, nummer: kamer.taakIndex + 1, totaal: kamer.taken.length,
      titel: taak.titel, soort: taak.soort, status: taak.status,
      eigenaar: eigenaar ? { id: eigenaar.id, naam: eigenaar.naam } : null,
      bewijs: taak.status === 'klaar' ? taak.bewijs : null };
  }
  function publiek(kamer, key, kort = false) {
    const ik = deelnemer(kamer, key), basis = {
      id: kamer.id, bedrijf: kopie(kamer.bedrijf), status: kamer.status,
      revisie: kamer.revisie, deelnemers: kamer.deelnemers.length,
      voortgang: { klaar: kamer.taken.filter(t => t.status === 'klaar').length, totaal: kamer.taken.length },
      bijgewerktAt: kamer.bijgewerktAt
    };
    if (kort) return basis;
    return Object.assign(basis, {
      toegangscode: kamer.status === 'wacht' ? kamer.toegangscode : null,
      host: kamer.hostKey === tekst(key, 150), ik: ik && { id: ik.id, naam: ik.naam, rolId: ik.rolId },
      rollen: kamer.rollen.map(r => ({ id: r.id, naam: r.naam, rechten: r.rechten.slice() })),
      team: kamer.deelnemers.map(d => ({ id: d.id, naam: d.naam, rolId: d.rolId, ik: d === ik })),
      werkproces: kopie(kamer.werkproces), taak: taakPubliek(kamer),
      regels: { echtGeld: false, productieacties: false, synthetisch: true, serverAuthoritatief: true },
      log: kamer.log.slice(0, 40)
    });
  }
  function revisie(kamer, verwacht) {
    return Number.isInteger(Number(verwacht)) && Number(verwacht) === kamer.revisie
      ? null : fout('De teamkamer is intussen gewijzigd. Ververs eerst de actuele stand.', 409);
  }
  function muteer(kamer, d, actie, detail) {
    kamer.revisie += 1; kamer.bijgewerktAt = nu(); log(kamer, d, actie, detail);
    if (!actieveStaat) save();
  }
  function commando(kamer, commandId) {
    const c = tekst(commandId, 120);
    if (!c) return { fout: fout('Een unieke commandosleutel is verplicht.') };
    if (kamer.commandos[c]) return { herhaald: true };
    return { sleutel: c };
  }
  function legCommandoVast(kamer, sleutel) {
    const c = tekst(sleutel, 120);
    kamer.commandos[c] = nu();
    const keys = Object.keys(kamer.commandos); if (keys.length > 400) for (const k of keys.slice(0, keys.length - 400)) delete kamer.commandos[k];
  }
  function maakBinnen(key, invoer = {}) {
    if (!partnerstudio || typeof partnerstudio.trainingsmodel !== 'function') return fout('De Partnerwereld is niet aangesloten.', 503);
    const open = Object.values(staat().kamers).filter(k => k.hostKey === tekst(key, 150) && !['voltooid', 'gesloten'].includes(k.status));
    if (open.length >= MAX_KAMERS_PER_HOST) return fout('Rond eerst een bestaande teamkamer af.', 409);
    const model = partnerstudio.trainingsmodel(invoer.code);
    if (!model) return fout('Kies een gepubliceerd officieel partnerbedrijf.', 404);
    const snapshot = model.snapshot;
    const proces = snapshot.werkprocessen.find(w => w.id === tekst(invoer.werkprocesId, 100)) || snapshot.werkprocessen[0];
    if (!proces || !Array.isArray(proces.stappen) || proces.stappen.length < 3) return fout('Dit bedrijf heeft geen volledig gepubliceerd werkproces.', 409);
    const host = { id: id('speler'), key: tekst(key, 150), naam: label(key), rolId: null, erbijAt: nu() };
    const kamer = {
      id: id('kamer'), toegangscode: toegangscode(), hostKey: host.key,
      bedrijf: { code: snapshot.code, naam: snapshot.naam, type: snapshot.type, stad: snapshot.stad,
        releaseHash: model.meta.hash, releaseModel: model.meta.releaseModel || 'legacy' },
      rollen: snapshot.rollen.map(r => ({ id: r.id, naam: r.naam, rechten: Array.isArray(r.rechten) ? r.rechten.slice() : [] })),
      werkproces: { id: proces.id, naam: proces.naam, doel: proces.doel, stappen: proces.stappen.slice() },
      deelnemers: [host], status: 'wacht', revisie: 1, taakIndex: 0, taken: [],
      commandos: {}, log: [], gemaaktAt: nu(), bijgewerktAt: nu(), voltooidAt: null
    };
    log(kamer, host, 'teamkamer-gemaakt', snapshot.naam + ' · release ' + model.meta.hash);
    staat().kamers[kamer.id] = kamer; if (!actieveStaat) save();
    return { ok: true, kamer: publiek(kamer, key) };
  }
  function deelnemenBinnen(key, codeIn) {
    const code = tekst(codeIn, 20).toUpperCase();
    const kamer = Object.values(staat().kamers).find(k => k.toegangscode === code);
    if (!kamer || kamer.status !== 'wacht') return fout('Deze toegangscode is niet geldig of de teamkamer is al gestart.', 404);
    const bestaand = deelnemer(kamer, key); if (bestaand) return { ok: true, herhaald: true, kamer: publiek(kamer, key) };
    if (kamer.deelnemers.length >= MAX_DEELNEMERS) return fout('Deze teamkamer is vol.', 409);
    const d = { id: id('speler'), key: tekst(key, 150), naam: label(key), rolId: null, erbijAt: nu() };
    kamer.deelnemers.push(d); muteer(kamer, d, 'deelnemer-erbij', d.naam + ' trad veilig toe.');
    return { ok: true, kamer: publiek(kamer, key) };
  }
  function mijnBinnen(key, kamerId) {
    if (kamerId) { const v = vind(key, kamerId); return v.fout || { ok: true, kamer: publiek(v.kamer, key) }; }
    const kamers = Object.values(staat().kamers).filter(k => deelnemer(k, key))
      .sort((a, b) => String(b.bijgewerktAt).localeCompare(String(a.bijgewerktAt))).slice(0, 20)
      .map(k => publiek(k, key, true));
    return { ok: true, kamers };
  }

  const acties = maakActies({ tekst, fout, vind, revisie, commando, legCommandoVast,
    muteer, publiek, rolVan: teamkamerRolVan, nu, id });

  return Object.assign(maakRegie({ sseToCustomer, staat, tekst, publiek, metActueleStaat,
    maakBinnen, deelnemenBinnen, mijnBinnen, acties }), { _staat: staat });
};
