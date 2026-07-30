/* Rahul als mens: geen AI-taal, een echte bui, en iedereen welkom.

   De meeste toetsen hier zijn zuivere functietoetsen (geen server nodig),
   want dit is grotendeels tekst- en rekenwerk. De grenzen zijn belangrijker
   dan de leuke kant: een bui mag nooit de inhoud raken, de plagerige stand
   mag nooit bij een kind terechtkomen, en Rahul mag nooit iemands geloof
   raden.

   Draai los: node --experimental-sqlite --test test/rahul-mens.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const taal = require('../server/kern/rahul/taal');
const twijfel = require('../server/kern/rahul/twijfel');
const lus = require('../server/kern/stuur/lus');
const rahulOmgang = require('../server/kern/rahul-omgang');
const fases = require('../server/kern/rahul-fases');
const tijden = require('../server/kern/geloof/tijden');
const feesten = require('../server/kern/geloof/feesten');
const K = require('../server/kern/geloof/kalenders');

/* ---------------- geen AI-taal ---------------- */
test('geen AI-taal', async (t) => {
  await t.test('bekende openers en sluiters gaan eraf', () => {
    assert.equal(taal.schrob('Natuurlijk! Je tafel staat om 21:00.'), 'Je tafel staat om 21:00.');
    assert.equal(taal.schrob('Goede vraag! Het antwoord is nee.'), 'Het antwoord is nee.');
    assert.equal(taal.schrob('Het is geregeld. Ik hoop dat dit helpt!'), 'Het is geregeld.');
    assert.equal(taal.schrob('Klaar. Laat het me weten als je nog vragen hebt.'), 'Klaar.');
    assert.match(taal.schrob('Als AI-assistent kan ik geen boekingen doen. Maar dit kan wel.'), /^Maar dit kan wel/);
  });

  await t.test('een antwoord dat alleen uit beleefdheid bestaat, blijft staan', () => {
    // liever een cliche dan een leeg antwoord
    assert.notEqual(taal.schrob('Natuurlijk!').trim(), '');
  });

  await t.test('gewone tekst blijft ongemoeid', () => {
    const echt = 'Nee, dat raad ik af. Het hotel ligt te ver van het strand en je verliest een uur per dag.';
    assert.equal(taal.schrob(echt), echt);
    // een zinnetje midden in de tekst mag niet worden weggeknipt
    const midden = 'Ik heb gekeken en ik hoop dat dit helpt bij je keuze, maar de tweede optie is beter.';
    assert.equal(taal.schrob(midden), midden);
  });

  await t.test('de keuring ruikt AI-taal', () => {
    assert.ok(taal.ruikt('Ik hoop dat dit helpt!').length > 0);
    assert.equal(taal.ruikt('De tafel staat om negen uur. Neem een trui mee.').length, 0);
  });

  await t.test('de regels staan in de prompt', () => {
    const alles = taal.TAALREGELS.join(' ');
    assert.match(alles, /Verboden/);
    assert.match(alles, /Begin met het antwoord/);
    assert.match(alles, /mening/);
  });
});

/* ---------------- de stemming ---------------- */
test('de stemming van Rahul', async (t) => {
  // een kleine nep-db, want dit is puur logica
  const db = { data: {} };
  const stemming = require('../server/kern/rahul/stemming')({ db, save: () => {}, crypto: require('crypto') });

  await t.test('er is altijd een bui, en die houdt even aan', () => {
    const s = stemming.stemmingNu();
    assert.ok(s.id, 'er hoort een stand te zijn');
    assert.ok(s.tot > Date.now(), 'en die loopt door');
    assert.equal(stemming.stemmingNu().id, s.id, 'binnen dezelfde periode blijft hij gelijk');
  });

  await t.test('DE GRENS: geen bui bij een kind, op de werkvloer of als het ernst is', () => {
    assert.equal(stemming.stemmingVoor({ kind: true }), null);
    assert.equal(stemming.stemmingVoor({ werk: true }), null);
    assert.equal(stemming.stemmingVoor({ ernst: true }), null);
  });

  await t.test('de bui raakt alleen de toon, en zegt dat er zelf bij', () => {
    stemming.stemmingZet('chagrijnig', true);
    const zin = stemming.stemmingVoor({});
    assert.match(zin, /chagrijnig/i);
    assert.match(zin, /alleen HOE je praat/, 'de prompt moet expliciet zeggen dat de inhoud niet verandert');
    assert.match(zin, /even goed/);
  });

  await t.test('chagrijnig slaat nooit neer op de persoon zelf', () => {
    const chag = stemming.STANDEN.find(s => s.id === 'chagrijnig').zin;
    assert.match(chag, /NOOIT kortaf tegen de persoon/);
    const kort = stemming.STANDEN.find(s => s.id === 'kort').zin;
    assert.match(kort, /niet door deze persoon/);
  });

  await t.test('de boardroom kan een stand vastzetten en weer loslaten', () => {
    assert.equal(stemming.stemmingToon().id, 'chagrijnig');
    assert.equal(stemming.stemmingToon().vast, true);
    stemming.stemmingZet(null, false);
    assert.equal(stemming.stemmingToon().vast, false);
    assert.equal(stemming.stemmingZet('bestaatniet', true).status, 400);
  });
});

/* ---------------- iedereen welkom ---------------- */
test('omgang: iedereen welkom, niemand ingedeeld', async (t) => {
  await t.test('de welkomstregel staat er ALTIJD, bij elke stand', () => {
    for (const omgang of ['maatje', 'plagerig', 'zakelijk', 'rustig', undefined]) {
      const t2 = rahulOmgang({ soort: 'volwassen', omgang, volwassen: true });
      assert.match(t2, /homo, lesbisch, bi, trans, non-binair, queer/i, 'stand: ' + omgang);
      assert.match(t2, /ga je nergens vanuit/i);
    }
    assert.match(rahulOmgang({ soort: 'kind' }), /homo, lesbisch/i, 'ook in het kind-hart');
  });

  await t.test('geslacht bepaalt NIETS meer', () => {
    // de oude aanroepen met 'v' en 'm' moeten nu exact hetzelfde opleveren
    assert.equal(rahulOmgang('v'), rahulOmgang('m'));
    assert.equal(rahulOmgang('v'), rahulOmgang('x'));
    assert.doesNotMatch(rahulOmgang('v'), /veroveren|hard to get/i, 'geen crush-toon op grond van geslacht');
  });

  await t.test('de plagerige stand alleen als iemand er zelf voor kiest', () => {
    assert.doesNotMatch(rahulOmgang({ soort: 'volwassen', omgang: 'maatje', volwassen: true }), /stille crush/i);
    assert.match(rahulOmgang({ soort: 'volwassen', omgang: 'plagerig', volwassen: true }), /stille crush/i);
  });

  await t.test('DE GRENS: nooit plagerig bij een kind of bij onbekende leeftijd', () => {
    assert.doesNotMatch(rahulOmgang({ soort: 'kind', omgang: 'plagerig' }), /stille crush/i);
    assert.match(rahulOmgang({ soort: 'kind', omgang: 'plagerig' }), /volledig uitgesloten/i);
    // leeftijd onbekend: het antwoord is nee
    assert.doesNotMatch(rahulOmgang({ soort: 'volwassen', omgang: 'plagerig' }), /stille crush/i);
    assert.doesNotMatch(rahulOmgang({ soort: 'volwassen', omgang: 'plagerig', volwassen: false }), /stille crush/i);
  });

  await t.test('voornaamwoorden en aanhef worden overgenomen', () => {
    const t2 = rahulOmgang({ soort: 'volwassen', omgang: 'maatje', volwassen: true, voornaamwoord: 'die/diens', aanhef: 'Sam' });
    assert.match(t2, /die\/diens/);
    assert.match(t2, /Sam/);
  });
});

/* ---------------- de vijf levensfases ---------------- */
test('levensfases: dezelfde Rahul, een andere rol', async (t) => {
  await t.test('elke fase levert zijn eigen tekst op, en die is te herkennen', () => {
    const uit = {};
    for (const fase of Object.keys(fases.FASES)) {
      uit[fase] = rahulOmgang({ fase, volwassen: true });
      assert.match(uit[fase], /ga je nergens vanuit/i, 'welkomstregel ontbreekt bij ' + fase);
    }
    assert.match(uit.kind, /grote broer/i);
    assert.match(uit.kind, /koetjes en kalfjes/i);
    assert.match(uit.scholier, /experimenteren/i);
    assert.match(uit.scholier, /naar jezelf luisteren/i);
    assert.match(uit.student, /balans/i);
    assert.match(uit.student, /rondkomen/i);
    assert.match(uit.volwassen, /quality time/i);
    assert.match(uit.volwassen, /sparen/i);
    assert.match(uit.senior, /luisterend oor/i);
    // en geen twee fases zijn hetzelfde
    const teksten = Object.values(uit);
    assert.equal(new Set(teksten).size, teksten.length, 'twee fases leveren dezelfde tekst');
  });

  await t.test('de leeftijd bepaalt de standaardfase, onbekend blijft onbekend', () => {
    assert.equal(fases.faseUitLeeftijd(7), 'kind');
    assert.equal(fases.faseUitLeeftijd(11), 'kind');
    assert.equal(fases.faseUitLeeftijd(12), 'scholier');
    assert.equal(fases.faseUitLeeftijd(17), 'scholier');
    assert.equal(fases.faseUitLeeftijd(18), 'student');
    assert.equal(fases.faseUitLeeftijd(25), 'student');
    assert.equal(fases.faseUitLeeftijd(26), 'volwassen');
    assert.equal(fases.faseUitLeeftijd(66), 'volwassen');
    assert.equal(fases.faseUitLeeftijd(67), 'senior');
    assert.equal(fases.faseUitLeeftijd(null), null, 'geen leeftijd is geen aanname');
  });

  await t.test('het lid mag bijstellen: een student van 34 bestaat', () => {
    assert.equal(fases.faseVoor(34, 'student'), 'student');
    assert.equal(fases.faseVoor(70, 'volwassen'), 'volwassen', 'zeventig en nog midden in het leven');
    assert.equal(fases.faseVoor(30, null), 'volwassen', 'geen keuze: gewoon de leeftijd');
    assert.equal(fases.faseVoor(30, 'bestaatniet'), 'volwassen', 'onzin valt terug op de leeftijd');
  });

  await t.test('DE GRENS: een minderjarige kan zichzelf niet volwassen verklaren', () => {
    for (const keuze of ['student', 'volwassen', 'senior']) {
      assert.equal(fases.faseVoor(14, keuze), 'scholier', 'veertien koos ' + keuze);
      assert.equal(fases.faseVoor(8, keuze), 'kind', 'acht koos ' + keuze);
      // leeftijd onbekend is net zo goed geen toestemming
      assert.equal(fases.faseVoor(null, keuze), null, 'onbekende leeftijd koos ' + keuze);
    }
    // binnen de jeugd mag het wel: een kind van elf dat zich scholier voelt
    assert.equal(fases.faseVoor(11, 'scholier'), 'scholier');
    assert.equal(fases.faseVoor(13, 'kind'), 'kind');
  });

  await t.test('DE GRENS: de jeugdfases krijgen NOOIT de plagerige toon', () => {
    for (const fase of ['kind', 'scholier']) {
      const tekst = rahulOmgang({ fase, omgang: 'plagerig', volwassen: true });
      assert.doesNotMatch(tekst, /stille crush/i, fase + ' kreeg de plagerige tekst');
      assert.match(tekst, /volledig uitgesloten/i, fase + ' mist de uitsluiting');
      // ook de andere volwassen stijlen horen er niet bij te komen
      assert.doesNotMatch(rahulOmgang({ fase, omgang: 'zakelijk' }), /geen gezelligheid vooraf/i);
    }
  });
});

/* ---------------- bij twijfel niets ---------------- */
test('bij twijfel doet Rahul niets', async (t) => {
  await t.test('de regel staat in de prompt, niet alleen in de code', () => {
    const alles = twijfel.TWIJFELREGELS.join(' ');
    assert.match(alles, /BIJ TWIJFEL DOE JE NIETS/);
    assert.match(alles, /honderd procent/i);
    assert.match(alles, /haast/i, 'haast is uitdrukkelijk geen uitzondering');
  });

  await t.test('zonder zeker=true wordt er niets uitgevoerd', () => {
    for (const invoer of [undefined, {}, { zeker: false }, { zeker: 'ja' }, { begrepen: 'taxi om 19:00 voor Sam' }]) {
      const r = twijfel.magDoen(invoer);
      assert.equal(r.ok, false, 'kwam door de poort: ' + JSON.stringify(invoer));
      assert.equal(r.gedaan, false);
      assert.equal(r.vraagEerst, true);
      assert.match(r.uitleg, /Niet uitgevoerd/);
    }
  });

  await t.test('zeker=true alleen is niet genoeg; het moet op te schrijven zijn', () => {
    assert.equal(twijfel.magDoen({ zeker: true }).ok, false);
    assert.equal(twijfel.magDoen({ zeker: true, begrepen: '   ' }).ok, false);
    assert.equal(twijfel.magDoen({ zeker: true, begrepen: 'ok' }).ok, false, 'te kort telt niet als begrepen');
    assert.equal(twijfel.magDoen({ zeker: true, begrepen: 'ok' }).vraagEerst, true);
  });

  await t.test('met zeker EN een zin over wat je gaat doen, mag het wel', () => {
    const r = twijfel.magDoen({ zeker: true, begrepen: 'taxi om 19:00 voor Sam naar Schiphol' });
    assert.equal(r.ok, true);
    assert.equal(r.vraagEerst, undefined);
  });

  await t.test('de doe-tool eist de poortvelden ook echt op', () => {
    // anders is de poort een suggestie in plaats van een voorwaarde
    const doe = lus.TOOLS.find(x => x.name === 'doe');
    assert.ok(doe, 'de tool "doe" bestaat niet meer');
    for (const veld of ['pad', 'zeker', 'begrepen']) {
      assert.ok(doe.input_schema.required.includes(veld), 'niet verplicht: ' + veld);
      assert.ok(doe.input_schema.properties[veld], 'niet beschreven: ' + veld);
    }
  });
});

/* ---------------- de fase door de hele keten ---------------- */
/* De enige toets hier met een echte server: de grens moet ook overeind blijven
   als hij via HTTP wordt geprobeerd, en niet alleen in de functie. */
test('/api/ik houdt de grens vast', async (t) => {
  const { startServer, stop } = require('./helper.js');
  const srv = await startServer();
  const api = async (pad, body, token) => {
    const r = await fetch(srv.base + pad, { method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body || {}) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const maakLid = async (naam, geboren) => {
    const u = Date.now() + Math.floor(Math.random() * 1e6);
    const reg = await api('/api/auth/register', { name: naam, email: 'fase' + u + '@x.nl',
      phone: '06' + String(u).slice(-8), password: 'geheim123', geboortedatum: geboren, tier: 'rtg', pasApp: 'rtg' });
    assert.ok(reg.body.token, 'registratie mislukt: ' + JSON.stringify(reg.body).slice(0, 200));
    return reg.body.token;
  };

  try {
    await t.test('een volwassene krijgt de vier volwassen fases en mag plagerig', async () => {
      const t1 = await maakLid('Fase Volwassen', '1988-05-05');
      const d = (await api('/api/ik', {}, t1)).body;
      assert.equal(d.fase, 'volwassen');
      assert.deepEqual(d.faseKeuzes.map(k => k.id), ['student', 'volwassen', 'senior', 'scholier']);
      assert.ok(d.keuzes.omgang.some(k => k.id === 'plagerig'));
      const na = (await api('/api/ik/zet', { fase: 'senior', omgang: 'plagerig' }, t1)).body;
      assert.equal(na.fase, 'senior');
      assert.equal(na.omgang, 'plagerig');
    });

    await t.test('DE GRENS: een scholier komt er via de API niet doorheen', async () => {
      const t2 = await maakLid('Fase Scholier', '2011-03-03');
      const d = (await api('/api/ik', {}, t2)).body;
      assert.equal(d.fase, 'scholier');
      assert.deepEqual(d.faseKeuzes.map(k => k.id), ['kind', 'scholier']);
      assert.ok(!d.keuzes.omgang.some(k => k.id === 'plagerig'), 'plagerig hoort hier niet in de lijst');
      // en zetten lukt ook niet, ook niet als je de knop overslaat
      const na = (await api('/api/ik/zet', { fase: 'volwassen', omgang: 'plagerig' }, t2)).body;
      assert.equal(na.fase, 'scholier', 'een minderjarige verklaarde zichzelf volwassen');
      assert.equal(na.omgang, 'maatje', 'de plagerige stand werd toch bewaard');
    });
  } finally { stop(srv && srv.child); }
});

/* ---------------- geloof: rekenwerk ---------------- */
test('gebedstijden en de richting van Mekka', async (t) => {
  await t.test('de qibla klopt met een bekende referentie', () => {
    // Londen is de standaardcontrole: overal gepubliceerd als ~119 graden
    assert.ok(Math.abs(tijden.qibla(51.5074, -0.1278) - 119.0) < 0.5, 'Londen hoort ~119 graden te zijn');
    // en de richting draait echt mee met de plek
    assert.equal(tijden.streek(tijden.qibla(-6.2, 106.8)), 'noordwest', 'vanuit Jakarta ligt Mekka noordwest');
    assert.equal(tijden.streek(tijden.qibla(40.7, -74.0)), 'noordoost', 'vanuit New York noordoost');
    assert.ok(tijden.afstandMekka(21.4225, 39.8262) < 5, 'in Mekka zelf is de afstand nul');
  });

  await t.test('de tijden zijn geordend en plausibel', () => {
    const g = tijden.gebedstijden(24.7136, 46.6753, new Date('2026-03-15T12:00:00Z'), { methode: 'ummalqura' });
    const m = (x) => g[x].minutenUtc;
    assert.ok(m('fajr') < m('zonsopgang'), 'fajr voor zonsopgang');
    assert.ok(m('zonsopgang') < m('dhuhr'), 'zonsopgang voor het middaguur');
    assert.ok(m('dhuhr') < m('asr'), 'dhuhr voor asr');
    assert.ok(m('asr') < m('maghrib'), 'asr voor maghrib');
    assert.ok(m('maghrib') < m('isha'), 'maghrib voor isha');
  });

  await t.test('hanafi legt asr later dan de standaard', () => {
    const p = [52.38, 4.64, new Date('2026-05-01T12:00:00Z')];
    const st = tijden.gebedstijden(p[0], p[1], p[2], { asr: 'standaard' });
    const hf = tijden.gebedstijden(p[0], p[1], p[2], { asr: 'hanafi' });
    assert.ok(hf.asr.minutenUtc > st.asr.minutenUtc);
  });

  await t.test('EERLIJK: op hoge breedte geen verzonnen tijd maar een waarschuwing', () => {
    // Tromso in juni: de zon gaat niet onder
    const g = tijden.gebedstijden(69.65, 18.96, new Date('2026-06-21T12:00:00Z'));
    assert.ok(g.waarschuwing, 'hier hoort een eerlijke waarschuwing te staan');
    assert.match(g.waarschuwing, /niet op of niet onder|niet diep genoeg/);
  });

  await t.test('de methode staat er altijd bij, want er is geen enkele waarheid', () => {
    assert.equal(tijden.gebedstijden(52.38, 4.64, new Date(), { methode: 'isna' }).methode, 'ISNA (Noord-Amerika)');
    assert.equal(tijden.gebedstijden(52.38, 4.64, new Date(), { methode: 'bestaatniet' }).methodeId, 'mwl');
  });
});

/* ---------------- geloof: feestdagen ---------------- */
test('feestdagen uit alle tradities', async (t) => {
  const d = (ms) => new Date(ms).toISOString().slice(0, 10);

  await t.test('de kalenders kloppen op bekende data', () => {
    assert.equal(d(K.pasen(2026)), '2026-04-05');
    assert.equal(d(K.pasen(2027)), '2027-03-28');
    assert.equal(d(K.joodsDatum(5786, 'tisjrei', 1)), '2025-09-23', 'Rosj Hasjana 5786');
    assert.equal(d(K.joodsDatum(5786, 'nisan', 15)), '2026-04-02', 'Pesach 5786');
    // en in een SCHRIKKELJAAR schuift Nisan een maand op; op naam gaat dat goed
    assert.ok(K.joodsSchrikkel(5784), '5784 is een schrikkeljaar');
    assert.ok(!K.joodsSchrikkel(5785), '5785 niet');
    assert.equal(d(K.joodsDatum(5784, 'nisan', 15)), '2024-04-23', 'Pesach 5784 (schrikkeljaar)');
    assert.equal(d(K.joodsDatum(5785, 'nisan', 15)), '2025-04-13', 'Pesach 5785 (gewoon jaar)');
  });

  await t.test('elke traditie levert feesten op, geen enkele is leeg', () => {
    for (const tr of feesten.TRADITIES) {
      const lijst = feesten.feestenRond([tr], new Date('2026-01-01T00:00:00Z'), 400);
      assert.ok(lijst.length > 0, 'traditie zonder feesten: ' + tr);
    }
  });

  await t.test('EERLIJK: islamitische data dragen hun voorbehoud mee', () => {
    const l = feesten.feestenRond(['islam'], new Date('2026-01-01T00:00:00Z'), 400);
    assert.ok(l.length);
    for (const f of l) {
      assert.equal(f.zekerheid, 'berekend');
      assert.match(f.noot, /maansikkel/);
      assert.equal(f.avondErvoor, true, 'de dag begint bij zonsondergang de avond ervoor');
    }
  });

  await t.test('EERLIJK: buiten de tabel geen gok', () => {
    // 2099 staat niet in de tabel; dan hoort Diwali er gewoon niet te staan
    const ver = feesten.feestenRond(['hindoeisme'], new Date('2099-01-01T00:00:00Z'), 400);
    assert.equal(ver.filter(f => f.id === 'diwali').length, 0);
  });

  await t.test('leeg = alles; en 0 dagen vooruit betekent echt alleen vandaag', () => {
    // vast venster, want of er de komende dertig dagen toevallig iets valt
    // hangt van de dag af waarop je de test draait
    assert.ok(feesten.feestenRond([], new Date('2026-01-01T00:00:00Z'), 400).length > 10,
      'zonder filter komen alle tradities langs');
    // dagenVooruit = 0 werd door een `|| 45` stilletjes zes weken; die val
    // houden we hiermee dicht
    const alleen = feesten.feestenRond([], new Date('2026-07-26T00:00:00Z'), 0);
    assert.ok(alleen.every(f => f.overDagen === 0), 'nul dagen vooruit is alleen vandaag');
    assert.equal(feesten.vandaag(['islam'], new Date('2026-07-26T00:00:00Z')).length, 0);
    // en op een dag dat er WEL iets is, vindt hij het
    assert.equal(feesten.vandaag(['christendom'], new Date('2026-12-25T00:00:00Z'))[0].naam, 'Kerstmis');
  });
});
