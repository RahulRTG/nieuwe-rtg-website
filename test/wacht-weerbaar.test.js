/* DE WACHT, WEERBAAR (server/kern/wacht/: index.js, raadkamer.js, flood.js,
   afweer.js).

   De Wacht is het immuunsysteem: hij meet, snijdt indringers af, zet bij een
   L7-piek zelf de deur op een kier, en legt voorstellen neer waar een mens over
   beslist. test/wacht.test.js toetst de gewone weg; dit bestand toetst de
   randen waar een immuunsysteem zich tegen zijn eigenaar keert of stil wordt:
   een actie buiten de vaste lijst, een reflex die blijft hangen, een teller die
   terugloopt, een besluit dat nooit wordt opgeruimd, een lus die omvalt.

   Wat hier niet mag sneuvelen:
   1. alleen acties uit de vaste lijst (staat.js TOEGESTAAN) worden ooit
      uitgevoerd; een vervalste of onbekende actie doet NIETS en zegt dat;
   2. een voorstel voert niets uit tot een mens het accepteert, en een
      geaccepteerd voorstel waarvan de actie mislukt, meldt dat eerlijk
      (uitgevoerd: false) in plaats van "gelukt";
   3. de lastafworp is tijdgebonden: hij dooft vanzelf, ook als niemand meer
      meet, en een verlopen quarantaine laat de bron weer binnen;
   4. een teller die terugloopt (herstart van het schild) geeft nooit een
      negatieve piek, en een te lange grafiek of een berg oude besluiten wordt
      zichtbaar opgeruimd -- met een telling, niet stilletjes;
   5. de analyse maakt geen dubbele voorstellen en slaat rommel in de
      signalen over in plaats van om te vallen;
   6. de rand-status zegt "stil" als de rand verwacht wordt maar zwijgt, en
      nooit "actief" op oud verkeer;
   7. de meetlus stempelt zich bij de sensorstilte, en een meting die omvalt
      wordt GETELD in plaats van geslikt.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - raadkamer.js voerUit: `if (!actie || !TOEGESTAAN.has(actie.soort))`
     vervangen door `if (!actie)`
     -> "1. een actie buiten de vaste lijst" en "1b. ... in de opslag vervalst"
     ZAKKEN (RAAK): de onbekende soort valt dan door naar "Niets uitgevoerd."
     en de assertie op de uitleg breekt.
   - flood.js beoordeelFlood: de doof-regel `if (la.actief && la.tot && la.tot
     <= nu) {...}` weggehaald
     -> "3. een getripte lastafworp dooft vanzelf" ZAKT (RAAK).
   - index.js meet: `Math.max(0, totaal - vorigeVerzoeken)` vervangen door
     `totaal - vorigeVerzoeken`
     -> "4. een teller die terugloopt" ZAKT (RAAK).

   Draai: node --test test/wacht-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const maakWacht = require('../server/kern/wacht');
const staat = require('../server/kern/wacht/staat');
const stilte = require('../server/kern/command/sensorstilte');
const { wachtOpWaarde } = require('./helper');

function maakBeveilig(samenvatting) {
  const meldingen = [];
  return {
    meldingen,
    meld: (type, ernst, tekst, meta) => { meldingen.push({ type, ernst, tekst, meta }); },
    samenvatting: samenvatting || (() => ({ open: meldingen.length, kritiek: meldingen.filter(m => m.ernst === 'kritiek').length }))
  };
}

function opzet(extra) {
  const db = { data: {} };
  let saves = 0;
  const ctx = Object.assign({ db, save: () => { saves++; } }, extra || {});
  const w = maakWacht(ctx);
  const W = staat.maakW(db);
  return { db, w, saves: () => saves, W };
}

function metKlok(t0) {
  const echt = Date.now;
  let nu = t0;
  Date.now = () => nu;
  return { verder: (ms) => { nu += ms; }, terug: () => { Date.now = echt; } };
}

/* ---------------- 1. de vaste lijst ---------------- */

test('1. een actie buiten de vaste lijst, of geen actie, wordt nooit uitgevoerd', () => {
  const { w, db } = opzet();
  const kamer = require('../server/kern/wacht/raadkamer');
  // via de raadkamer zelf: de lijst is de enige poort
  const r = kamer({ db, save() {}, lees: {}, W: staat.maakW(db) });
  assert.deepEqual(r.voerUit(null), { ok: false, uitleg: 'Onbekende of niet-toegestane actie; er is niets uitgevoerd.' });
  const vals = r.voerUit({ soort: 'eval', code: 'process.exit(1)' });
  assert.equal(vals.ok, false, 'een soort buiten TOEGESTAAN mag niet slagen');
  assert.match(vals.uitleg, /niet-toegestane actie/);

  // een voorstel met een vervalste actie draagt hem niet mee
  const v = w.voorstel({ titel: 'x', actie: { soort: 'shell', cmd: 'rm -rf /' } });
  assert.equal(v.actie, null, 'een niet-toegestane actie wordt bij het neerleggen al weggegooid');
  assert.equal(v.soort, 'advies', 'zonder soort is het een advies');
  const b = w.beslis(v.id, 'accepteren', null, 'eigenaar');
  assert.equal(b.ok, true);
  assert.equal(b.uitgevoerd, true);
  assert.match(b.resultaat, /Geen actie gekoppeld/, 'akkoord zonder actie is alleen genoteerd');
});

test('1b. ook als iemand de actie NA het voorstel in de opslag vervalst, voert accepteren niets uit', () => {
  const { w, W } = opzet();
  const v = w.voorstel({ titel: 'x', actie: { soort: 'vrij', bron: 'a' } });
  // manipulatie van de opgeslagen actie: de soort wordt iets gevaarlijks
  W().raad.find(x => x.id === v.id).actie = { soort: 'exec', cmd: 'x' };
  const b = w.beslis(v.id, 'accepteren', 'ok', 'eigenaar');
  assert.equal(b.status, 'geaccepteerd');
  assert.equal(b.uitgevoerd, false, 'de vervalste actie is geweigerd, en dat staat in het antwoord');
  assert.match(b.resultaat, /niet-toegestane/);
});

test('1c. elke toegestane actie doet precies wat ze zegt', () => {
  const bev = maakBeveilig();
  const { w, db, W } = opzet({ beveilig: bev });
  const kamer = require('../server/kern/wacht/raadkamer');
  // vrij op een bron die er niet stond
  const v1 = w.voorstel({ titel: 'vrij', actie: { soort: 'vrij', bron: 'niemand' } });
  assert.equal(w.beslis(v1.id, 'accepteren').resultaat, 'Bron stond niet in quarantaine.');
  w.isoleer('1.1.1.1', 'x');
  const v2 = w.voorstel({ titel: 'vrij', actie: { soort: 'vrij', bron: '1.1.1.1' } });
  assert.equal(w.beslis(v2.id, 'accepteren').resultaat, 'Bron vrijgegeven.');
  assert.equal(w.inQuarantaine('1.1.1.1'), false);

  // hygiene
  const v3 = w.voorstel({ titel: 'h', actie: { soort: 'hygiene' } });
  assert.match(w.beslis(v3.id, 'accepteren').resultaat, /^Opgeruimd: \d+ item\(s\)\.$/);

  // zekering: onbekend -> niets, bekend -> eruit en er weer in
  const v4 = w.voorstel({ titel: 'z', actie: { soort: 'zekering', id: 'bestaat-niet', aan: false } });
  const r4 = w.beslis(v4.id, 'accepteren');
  assert.equal(r4.uitgevoerd, false, 'een onbekende zekering wordt niet stil "gelukt"');
  assert.match(r4.resultaat, /Onbekende zekering/);
  db.data.techniek = { zekeringen: { registratie: { aan: true, naam: 'Registratie', tot: 123 } } };
  const v5 = w.voorstel({ titel: 'z', actie: { soort: 'zekering', id: 'registratie', aan: false } });
  assert.match(w.beslis(v5.id, 'accepteren').resultaat, /eruit/);
  const z = db.data.techniek.zekeringen.registratie;
  assert.equal(z.aan, false); assert.equal(z.reden, 'via raadkamer');
  assert.ok(z.sindsGesprongen > 0); assert.equal(z.tot, null, 'een raadkamerbesluit is niet tijdgebonden');
  const v6 = w.voorstel({ titel: 'z', actie: { soort: 'zekering', id: 'registratie', aan: true } });
  assert.match(w.beslis(v6.id, 'accepteren').resultaat, /er weer in/);
  assert.equal(z.aan, true); assert.equal(z.reden, null); assert.equal(z.sindsGesprongen, null);
  // zonder techniek-tak bestaat er geen zekering
  const losse = kamer({ db: { data: {} }, save() {}, lees: {}, W: staat.maakW({ data: {} }) });
  assert.equal(losse.voerUit({ soort: 'zekering', id: 'registratie' }).ok, false);

  // drempel: sleutel begrensd, onzin wordt 0
  const lang = 'x'.repeat(60);
  const v7 = w.voorstel({ titel: 'd', actie: { soort: 'drempel', sleutel: lang, waarde: 'veel' } });
  w.beslis(v7.id, 'accepteren');
  assert.equal(W().drempels['x'.repeat(40)], 0, 'een niet-getal wordt 0 en de sleutel is op 40 tekens begrensd');
  assert.equal(W().drempels[lang], undefined);
  const r8 = losse.voerUit({ soort: 'drempel', waarde: 7 });
  assert.equal(r8.ok, true); assert.match(r8.uitleg, /= 7\./);

  // lastafworp aan: tijdgebonden, en een bestaande reden blijft staan
  W().lastafworp.reden = 'L7-piek eerder';
  const r9 = w.zetLastafworp(true);
  assert.match(r9.uitleg, /weer actief/);
  assert.equal(W().lastafworp.reden, 'L7-piek eerder');
  assert.ok(W().lastafworp.tot > Date.now() && W().lastafworp.tot <= Date.now() + staat.LASTAFWORP_MS);
  w.zetLastafworp(false);
  assert.equal(W().lastafworp.reden, 'handmatig opgeheven');
  W().lastafworp.reden = null;
  w.zetLastafworp(true);
  assert.equal(W().lastafworp.reden, 'handmatig aangezet', 'zonder eerdere reden staat er waarom hij aan ging');
});

/* ---------------- 2. de mens beslist ---------------- */

test('2. beslissen: onbekend voorstel, onzin-verdict, notities en de beslisser', () => {
  const { w, W } = opzet();
  assert.deepEqual(w.beslis('bestaat-niet', 'accepteren'), { ok: false, error: 'Onbekend voorstel.' });
  const v = w.voorstel({ soort: 'afweer', titel: 'T'.repeat(200), uitleg: 'U'.repeat(700), actie: { soort: 'quarantaine', bron: 'q' } });
  assert.equal(v.titel.length, 120); assert.equal(v.uitleg.length, 600);
  const fout = w.beslis(v.id, 'doe-maar');
  assert.equal(fout.ok, false, 'een verdict buiten de drie mag niets veranderen');
  assert.equal(W().raad[0].status, 'open');
  assert.equal(w.inQuarantaine('q'), false);

  const inc = w.beslis(v.id, 'inconclaaf');
  assert.equal(inc.status, 'inconclaaf');
  assert.equal(W().raad[0].overleg[0].tekst, 'Napraten met de AI.', 'zonder notitie staat er waarom het terugging');
  assert.equal(W().raad[0].overleg[0].door, 'eigenaar');
  assert.equal(w.meters().openVoorstellen, 1, 'inconclaaf telt nog als open op het bord');

  const af = w.beslis(v.id, 'afwijzen', null, 'piket');
  assert.equal(af.status, 'afgewezen');
  assert.equal(W().raad[0].beslistDoor, 'piket');
  assert.equal(W().raad[0].overleg.length, 1, 'geen lege notitie erbij');
  assert.equal(w.inQuarantaine('q'), false, 'afwijzen voert de actie niet uit');

  const v2 = w.voorstel({ titel: 'a', actie: { soort: 'quarantaine', bron: 'r' } });
  const ok = w.beslis(v2.id, 'accepteren', 'n'.repeat(500));
  assert.equal(W().raad[0].beslistDoor, null, 'zonder beslisser geen verzonnen naam');
  assert.equal(W().raad[0].overleg[0].tekst.length, 400);
  assert.equal(ok.uitgevoerd, true);
});

test('2b. de audit-staart van voorstellen is begrensd, nieuwste eerst', () => {
  const { w, W } = opzet();
  for (let i = 0; i < staat.RAAD_MAX + 5; i++) w.voorstel({ titel: 'v' + i });
  assert.equal(W().raad.length, staat.RAAD_MAX);
  assert.equal(W().raad[0].titel, 'v' + (staat.RAAD_MAX + 4));
  assert.equal(w.bord().raad.length, 40, 'het bord toont de laatste veertig');
  assert.equal(w.bord().openVoorstellen, staat.RAAD_MAX);
});

/* ---------------- 3. tijdgebonden reflexen ---------------- */

test('3. een getripte lastafworp dooft vanzelf, ook bij een nieuwe meting zonder piek', () => {
  const klok = metKlok(1e12);
  try {
    let teller = 0;
    const bev = maakBeveilig();
    const { w, W } = opzet({ beveilig: bev, lees: { verzoeken: () => teller, verdachteBronnen: () => null } });
    w.meet();
    teller += staat.L7_DREMPEL + 1;
    const s = w.meet();
    assert.equal(s.lastafworp, 1);
    assert.equal(W().lastafworp.bronnen.length, 0, 'zonder signalen geen afgesneden bronnen, en geen crash');
    assert.equal(w.lastAfworpActief(), true);
    klok.verder(staat.LASTAFWORP_MS + 1);
    const s2 = w.meet();
    assert.equal(s2.lastafworp, 0, 'na de dooftijd staat de deur weer open');
    assert.equal(W().lastafworp.actief, false);
    assert.equal(W().lastafworp.tot, null);
  } finally { klok.terug(); }
});

test('3b. het middleware-pad dooft een verlopen lastafworp ook zonder meting', () => {
  const { w, W } = opzet();
  assert.equal(w.lastAfworpActief(), false);
  w.zetLastafworp(true);
  assert.equal(w.lastAfworpActief(), true);
  W().lastafworp.tot = Date.now() - 1;
  assert.equal(w.lastAfworpActief(), false, 'een verlopen reflex mag het verkeer niet blijven weigeren');
  assert.equal(W().lastafworp.actief, false);
  // een actieve lastafworp zonder einde blijft actief (handmatig gezet zonder tot)
  W().lastafworp = { actief: true };
  assert.equal(w.lastAfworpActief(), true);
});

test('3c. tijdens een actieve lastafworp: de piek wordt bijgehouden, er komt geen tweede trip', () => {
  const bev = maakBeveilig();
  const { w, W } = opzet({ beveilig: bev });
  W().drempels['l7-flood'] = 100;
  assert.equal(w.beoordeelFlood(100).actief, false, 'precies op de eigen drempel tript hij niet');
  const la = w.beoordeelFlood(150);
  assert.equal(la.actief, true);
  assert.equal(la.drempel, 100, 'de drempel uit de raadkamer telt, niet de standaard');
  assert.match(la.reden, /150 verzoeken\/10s \(drempel 100\)/);
  w.beoordeelFlood(400);
  assert.equal(la.piek, 400);
  w.beoordeelFlood(120);
  assert.equal(la.piek, 400, 'een lagere meting verlaagt de piek niet');
  assert.equal(bev.meldingen.filter(m => m.type === 'lastafworp').length, 1, 'een trip, een kritieke melding');
  assert.equal(W().raad.filter(v => v.actie && v.actie.soort === 'lastafworp').length, 1);

  // de lastafworp gaat uit, maar het open opheffingsvoorstel staat er nog: geen tweede
  la.actief = false; la.tot = null; la.piek = 0;
  // een handmatig aangezette lastafworp zonder piek neemt de eerste meting als piek
  W().lastafworp = { actief: true };
  assert.equal(w.beoordeelFlood(5).piek, 5);
  W().lastafworp = la;
  W().drempels['l7-flood'] = 'onzin';
  assert.equal(w.beoordeelFlood(staat.L7_DREMPEL).actief, false, 'een kapotte drempel valt terug op de standaard');
  w.beoordeelFlood(staat.L7_DREMPEL + 1);
  assert.equal(W().raad.filter(v => v.actie && v.actie.soort === 'lastafworp').length, 1, 'geen dubbel voorstel');
  // een trip zonder beveilig-object valt niet om
  const zonder = opzet();
  assert.equal(zonder.w.beoordeelFlood(staat.L7_DREMPEL + 1).actief, true);
});

test('3d. bij een trip gaan alleen de felste vijf bronnen in quarantaine, en rommel wordt overgeslagen', () => {
  const bronnen = [
    { bron: 'a', treffers: 1 }, { bron: 'b', treffers: 9 }, { bron: 'c', treffers: 4 },
    { bron: 'd', treffers: 7 }, { bron: 'e' }, { bron: 'f', treffers: 8 }, { bron: 'g', treffers: 6 }, { bron: 'h' }
  ];
  const { w, W } = opzet({ lees: { verdachteBronnen: () => bronnen } });
  const la = w.beoordeelFlood(staat.L7_DREMPEL + 10);
  assert.deepEqual(la.bronnen, ['b', 'f', 'd', 'g', 'c']);
  assert.deepEqual(Object.keys(W().quarantaine).sort(), ['b', 'c', 'd', 'f', 'g']);
  assert.equal(bronnen[0].bron, 'a', 'de signaallijst van het schild zelf wordt niet omgegooid');
  // een trip waarin een bron zonder naam zit, isoleert geen lege bron
  const twee = opzet({ lees: { verdachteBronnen: () => [{ treffers: 50 }, null].filter(x => x !== null) } });
  twee.w.beoordeelFlood(staat.L7_DREMPEL + 1);
  assert.deepEqual(Object.keys(twee.W().quarantaine), []);
});

test('3e. quarantaine: lege bron weigert, reden en einde kloppen, verlopen dooft', () => {
  const { w, W, saves } = opzet();
  assert.equal(w.isoleer('', 'x'), null, 'een lege bron is geen quarantaine');
  assert.equal(w.isoleer(null), null);
  const q = w.isoleer('z'.repeat(200));
  assert.equal(q.reden, 'handmatig');
  assert.equal(Object.keys(W().quarantaine)[0].length, 120, 'de bron is begrensd');
  assert.equal(q.tot - q.sinds, staat.QUARANTAINE_MS);
  assert.equal(w.vrij(undefined), false);
  assert.equal(w.inQuarantaine(undefined), false, 'een ontbrekende bron staat nooit in quarantaine');
  const bev = maakBeveilig();
  const metMelder = opzet({ beveilig: bev });
  metMelder.w.isoleer('k');
  assert.match(bev.meldingen[0].tekst, /in quarantaine gezet \(\)/, 'zonder reden geen "undefined" in de melding');
  assert.equal(bev.meldingen[0].meta.bron, 'quarantaine:k');
  const voor = saves();
  assert.equal(w.vrij('bestaat-niet'), false);
  assert.equal(saves(), voor, 'niets vrijgegeven, niets bewaard');
  // een quarantaine zonder einde blijft staan
  W().quarantaine.handmatig = { reden: 'x', sinds: 1 };
  assert.equal(w.inQuarantaine('handmatig'), true);
  const lijst = w.quarantaineLijst();
  const h = lijst.find(x => x.bron === 'handmatig');
  assert.equal(h.resterend, 0, 'zonder einde rekent de lijst geen negatieve resttijd');
  const z = lijst.find(x => x.bron.startsWith('zzz'));
  assert.ok(z.resterend > 3500 && z.resterend <= 3600);
});

/* ---------------- 4. meten en opruimen ---------------- */

test('4. een teller die terugloopt geeft nooit een negatieve piek', () => {
  let teller = 500;
  const { w } = opzet({ lees: { verzoeken: () => teller } });
  assert.equal(w.meet().verzoeken, 0, 'de eerste meting heeft geen vorige en is 0');
  teller = 10;   // het schild herstartte
  assert.equal(w.meet().verzoeken, 0);
  teller = 40;
  assert.equal(w.meet().verzoeken, 30);
});

test('4b. zonder signaallezers en met een karig alarm meet hij nog steeds eerlijk', () => {
  const bev = maakBeveilig(() => ({}));
  const { w } = opzet({ beveilig: bev });
  const m0 = w.meters();
  assert.equal(m0.verzoeken, 0, 'zonder meting een lege meterstand');
  assert.equal(typeof m0.geheugen, 'number');
  assert.ok(m0.geheugen > 0, 'het geheugen komt uit het proces zelf');
  const s = w.meet();
  assert.equal(s.alarm, 0); assert.equal(s.kritiek, 0);
  assert.equal(s.bans, 0); assert.equal(s.ips, 0);
  const metAlarm = opzet({ beveilig: maakBeveilig(() => ({ open: 3, kritiek: 2 })) });
  const s2 = metAlarm.w.meet();
  assert.equal(s2.alarm, 3); assert.equal(s2.kritiek, 2);
});

test('4c. de grafiek is een ring van RING metingen; de oudste valt eraf', () => {
  let teller = 0;
  const { w } = opzet({ lees: { verzoeken: () => teller++ } });
  for (let i = 0; i < staat.RING + 7; i++) w.meet();
  const g = w.grafiek();
  assert.equal(g.length, staat.RING);
  g.length = 0;
  assert.equal(w.grafiek().length, staat.RING, 'grafiek() geeft een kopie, het bord kan hem niet leegmaken');
});

test('4d. opruimen telt wat er weg ging: verlopen quarantaine, te lange grafiek, oude besluiten', () => {
  const { w, W } = opzet();
  const nu = Date.now();
  W().quarantaine = { oud: { tot: nu - 1 }, vers: { tot: nu + 60000 }, eeuwig: { reden: 'zonder einde' } };
  for (let i = 0; i < staat.RING + 3; i++) W().grafiek.push({ t: i });
  W().raad = [
    { id: '1', status: 'geaccepteerd', beslistOp: nu - staat.OUD_BESLUIT_MS - 1 },
    { id: '2', status: 'afgewezen', beslistOp: nu - staat.OUD_BESLUIT_MS - 1 },
    { id: '3', status: 'afgewezen', beslistOp: nu - 1000 },
    { id: '4', status: 'open', beslistOp: nu - staat.OUD_BESLUIT_MS - 1 },
    { id: '5', status: 'geaccepteerd' }
  ];
  const r = w.opruimen();
  assert.equal(r.opgeruimd, 1 + 3 + 2);
  assert.deepEqual(Object.keys(W().quarantaine).sort(), ['eeuwig', 'vers']);
  assert.deepEqual(W().raad.map(v => v.id), ['3', '4', '5'], 'open en recente besluiten blijven');
  assert.equal(W().grafiek.length, staat.RING);
  assert.equal(W().hygiene.laatstAantal, 6);
  assert.equal(W().hygiene.totaalOpgeruimd, 6);
  const r2 = w.opruimen();
  assert.equal(r2.opgeruimd, 0);
  assert.equal(W().hygiene.totaalOpgeruimd, 6, 'het totaal loopt op en wordt niet teruggezet');
  assert.equal(W().hygiene.laatstAantal, 0);
});

/* ---------------- 5. de analyse ---------------- */

test('5. analyseer slaat rommel, afgesneden en zwakke bronnen over, en maakt geen dubbelingen', () => {
  const signalen = [null, {}, { bron: 'zwak', treffers: staat.AANVAL_DREMPEL - 1 }, { bron: 'geen-telling' },
    { bron: 'al-binnen', treffers: 10 }, { bron: 'fel', treffers: staat.AANVAL_DREMPEL }];
  const { w } = opzet({ lees: { verdachteBronnen: () => signalen } });
  w.isoleer('al-binnen', 'eerder');
  const eerste = w.analyseer();
  assert.deepEqual(eerste.map(v => v.actie.bron), ['fel'], 'alleen de felle bron die nog binnen is');
  assert.match(eerste[0].actie.reden, /\(3\)/);
  assert.equal(w.analyseer().length, 0, 'een tweede ronde legt hetzelfde advies niet nog eens neer');
  const kaal = w.voorstel({});
  assert.equal(kaal.titel, 'Voorstel', 'zonder titel een herkenbare standaard');
  assert.equal(w.beslis(kaal.id, 'afwijzen').status, 'afgewezen');
  assert.equal(w.bord().raad[0].beslistDoor, null);
  w.beslis(eerste[0].id, 'inconclaaf', 'eerst bellen');
  assert.equal(w.bord().openVoorstellen, 1, 'inconclaaf telt op het bord als open');
  // zonder signalen (null) valt hij niet om
  const leeg = opzet({ lees: { verdachteBronnen: () => null } });
  assert.deepEqual(leeg.w.analyseer(), []);
});

test('5b. analyseer stelt opruimen voor bij verlopen quarantaine of oude besluiten, en maar een keer', () => {
  const { w, W } = opzet();
  assert.deepEqual(w.analyseer(), [], 'niets te ruimen, geen voorstel');
  const nu = Date.now();
  W().raad.push({ id: 'oud', status: 'afgewezen', beslistOp: nu - staat.OUD_BESLUIT_MS - 5 });
  W().quarantaine.weg = { tot: nu - 1 };
  W().quarantaine.blijft = { reden: 'geen einde' };
  const r = w.analyseer();
  assert.equal(r.length, 1);
  assert.equal(r[0].actie.soort, 'hygiene');
  assert.match(r[0].uitleg, /1 verlopen quarantaine\(s\) en 1 oude besluiten/);
  assert.deepEqual(w.analyseer(), [], 'er ligt al een open opruimvoorstel');
  // geaccepteerd: dan ruimt hij echt op
  const b = w.beslis(r[0].id, 'accepteren');
  assert.match(b.resultaat, /Opgeruimd: 2/);
});

/* ---------------- 6. de rand ---------------- */

test('6. de rand-status: onbekend, wachtend, actief en stil -- nooit "actief" op oud verkeer', () => {
  const oud = { edge: process.env.RTG_EDGE, rand: process.env.RTG_ACHTER_RAND };
  const klok = metKlok(2e12);
  try {
    delete process.env.RTG_EDGE; delete process.env.RTG_ACHTER_RAND;
    const { w } = opzet();
    const s0 = w.randStatus();
    assert.equal(s0.status, 'onbekend');
    assert.equal(s0.laatstGezien, null); assert.equal(s0.ouderdomSec, null);

    process.env.RTG_ACHTER_RAND = '1';
    assert.equal(w.randStatus().status, 'wachtend', 'verwacht maar nog nooit gezien');

    w.randGezien();
    const s1 = w.randStatus();
    assert.equal(s1.status, 'actief');
    assert.match(s1.uitleg, /\(edge\)/, 'zonder provider heet de rand gewoon "edge"');
    w.randGezien({ ray: 'r'.repeat(100), provider: 'p'.repeat(100) });
    const s2 = w.randStatus();
    assert.equal(s2.ray.length, 60); assert.equal(s2.provider.length, 40);

    klok.verder(staat.RAND_VERS_MS + 1000);
    const s3 = w.randStatus();
    assert.equal(s3.status, 'stil', 'oud randverkeer is geen staande eerste linie');
    assert.equal(s3.ouderdomSec, Math.round((staat.RAND_VERS_MS + 1000) / 1000));

    delete process.env.RTG_ACHTER_RAND;
    process.env.RTG_EDGE = '1';
    assert.equal(w.randStatus().status, 'stil', 'RTG_EDGE telt ook als verwachting');
    delete process.env.RTG_EDGE;
    assert.equal(w.randStatus().status, 'onbekend', 'niet verwacht en oud: geen alarmtaal');
    assert.equal(w.bord().rand.status, 'onbekend');
  } finally {
    klok.terug();
    if (oud.edge === undefined) delete process.env.RTG_EDGE; else process.env.RTG_EDGE = oud.edge;
    if (oud.rand === undefined) delete process.env.RTG_ACHTER_RAND; else process.env.RTG_ACHTER_RAND = oud.rand;
  }
});

/* ---------------- 7. de lus ---------------- */

test('7. de meetlus meldt zich aan, en een omvallende meting wordt geteld in plaats van geslikt', async () => {
  stilte._wis();
  const van = () => stilte.oordeel().find(r => r.naam === 'wacht');
  const t1 = opzet().w.start();
  try {
    assert.equal(van().stand, 'levend', 'net gestart is binnen het eerste venster levend');
    assert.equal(van().reden, 'gestart, nog geen ronde');
  } finally { clearInterval(t1); }

  stilte._wis();
  let kapot = true;
  const { w } = opzet({ lees: { verzoeken: () => { if (kapot) throw new Error('signaal weg'); return 1; } } });
  const t = w.start(5);
  try {
    const stuk = await wachtOpWaarde(() => { const s = van(); return s && s.fouten >= 2 ? s : null; },
      { ms: 5000, wat: 'twee getelde fouten van de wacht' });
    assert.match(stuk.reden, /mislukte rondes en nog geen geslaagde/, 'een lus die alleen omvalt, heeft geen geslaagde ronde');
    assert.equal(stuk.laatsteFout !== null, true);
    kapot = false;
    const hersteld = await wachtOpWaarde(() => { const s = van(); return s && /rondes, laatste/.test(s.reden) ? s : null; },
      { ms: 5000, wat: 'een geslaagde ronde na herstel' });
    assert.equal(hersteld.stand, 'levend', 'pas een geslaagde meting maakt hem weer levend');
    assert.ok(hersteld.fouten >= 2, 'de fouten blijven geteld, ook na herstel');
  } finally { clearInterval(t); stilte._wis(); }
});
