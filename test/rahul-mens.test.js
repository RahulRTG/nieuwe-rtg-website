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
const rahulOmgang = require('../server/kern/rahul-omgang');
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
