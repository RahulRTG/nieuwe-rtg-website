/* DE ZEGELSLEUTEL ONDER GELIJKTIJDIG OPSTARTEN.

   DE AANLEIDING IS EEN ECHTE CI-UITVAL. test/eigenaar-wedloop.test.js zet drie
   servers tegelijk op EEN gedeelde datamap, en op 15 september 2026 viel er een
   om met:

     error:1E08010C:DECODER routines::unsupported
         at Object.createPrivateKey (node:internal/crypto/keys:926:10)

   Die toets gaat over het eigenaarsACCOUNT en vond dus iets anders dan waarvoor
   hij geschreven is -- bij toeval, en alleen onder belasting. Deze toets lokt
   de oorzaak wel gericht uit.

   DE FOUT IS KIJKEN-DAN-DOEN, precies de vorm die de kop van die andere toets
   al beschrijft, maar dan op een BESTAND in plaats van op een databaserij:

     1 proces A: existsSync -> false, begint te schrijven
     2 proces B: existsSync -> TRUE  (het bestand bestaat, de inhoud nog niet)
     3 proces B: leest leeg of half, en createPrivateKey gooit

   TWEE BEWERINGEN, EN DE TWEEDE IS DE BELANGRIJKSTE. Dat geen enkel proces
   omvalt is de zichtbare helft. Dat ze allemaal DEZELFDE sleutel lezen is de
   helft die stiller faalt: wie dit met een gewone temp+rename repareert, maakt
   het atomair en laat de laatste schrijver winnen -- en dan draagt elk proces
   een andere sleutel en verifieert het ene de tokens van het andere niet meer.
   Dat is erger dan de wedloop, want er valt niets om; er klopt alleen niets
   meer. Vandaar link(): die faalt met EEXIST in plaats van te overschrijven.

   WAAROM EEN KIND-PROCES EN GEEN LUS. De wedloop zit TUSSEN processen. In een
   enkel proces is er niets om mee te racen, en dan toetst dit niets. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
/* VIERENTWINTIG EN NIET ACHT, en dat getal is gemeten en niet gekozen. Met acht
   processen slaagde deze toets OOK op de kapotte code: ze raakten elkaar niet,
   en een wedloop die je niet uitlokt win je altijd. Met vierentwintig levert de
   oude code 24 VERSCHILLENDE sleutels op en de gerepareerde er 1. */
const HOEVEEL = 24;
const RONDES = 2;       // een wedloop die je een keer wint, heb je niet bewezen

/* Een kind dat NIETS anders doet dan de zegel opzetten en zijn publieke sleutel
   afdrukken. Zo klein mogelijk: elke extra regel verschuift de timing en maakt
   de botsing minder waarschijnlijk. */
const KIND = `
const { maakZegel } = require(${JSON.stringify(path.join(WORTEL, 'server/lib/zegel.js'))});
/* argv[1] EN argv[2], NIET [2] en [3]: bij node met de -e vlag is er geen
   scriptpad, dus de argumenten schuiven een plek op. De eerste versie las hier
   undefined, waardoor elk kind meteen viel -- en de toets zakte toen op de OUDE
   code om de VERKEERDE reden. Dat zag eruit als bewijs dat hij de wedloop ving.
   (En let op de aanhalingstekens hierboven: dit blok woont in een template
   literal, dus een backtick sluit hem af.) */
const start = Number(process.argv[1]);
/* Alle kinderen wachten op DEZELFDE wandklok voordat ze beginnen. Zonder deze
   startlijn begint nummer acht als nummer een al klaar is, en dan racet er
   niets. */
while (Date.now() < start) { /* spinnen: preciezer dan setTimeout */ }
const z = maakZegel({ dataDir: process.argv[2] });
process.stdout.write(z.publiekeSleutel());
`;

function ronde() {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zegelwedloop-'));
  const start = Date.now() + 300;
  const kinderen = [];
  /* execFile EN NIET execFileSync, en dat is het verschil tussen een wedloop en
     een rij. De synchrone variant BLOKKEERT de ouder tot dit kind klaar is, dus
     de vierentwintig "gelijktijdige" processen liepen keurig na elkaar -- en
     dan leest nummer twee gewoon de sleutel van nummer een. De toets stond
     daardoor groen op de KAPOTTE code, wat eruitzag als bewijs dat de reparatie
     werkte. Ze moeten echt tegelijk draaien, anders is er niets om mee te racen. */
  for (let i = 0; i < HOEVEEL; i++) {
    kinderen.push(new Promise((klaar) => {
      execFile(process.execPath, ['-e', KIND, String(start), map],
        { encoding: 'utf8', timeout: 30000 },
        (fout, uit, err) => {
          if (fout) klaar({ ok: false, fout: String(err || fout.message || '').slice(0, 400) });
          else klaar({ ok: true, sleutel: String(uit).trim() });
        });
    }));
  }
  return Promise.all(kinderen);
}

test('vierentwintig processen die tegelijk opkomen delen een zegelsleutel, en geen valt om', async () => {
  const omgevallen = [];
  /* PER RONDE VERGELIJKEN EN NIET EROVERHEEN, en dat is een reparatie van deze
     toets zelf. Elke ronde krijgt een VERSE datamap, dus drie rondes horen drie
     verschillende sleutels op te leveren -- dat is geen bevinding maar de
     opzet. De vraag is of de ACHT processen BINNEN een ronde dezelfde sleutel
     lezen. De eerste versie telde over alle rondes en meldde keurig "3
     verschillende sleutels" over een systeem dat het goed deed. */
  let meestePerRonde = 0;
  for (let r = 0; r < RONDES; r++) {
    const sleutels = new Set();
    for (const u of await ronde()) {
      if (!u.ok) omgevallen.push(u.fout); else sleutels.add(u.sleutel);
    }
    meestePerRonde = Math.max(meestePerRonde, sleutels.size);
  }

  assert.equal(omgevallen.length, 0,
    'een of meer processen vielen om bij het gelijktijdig opzetten van de zegel. Dit is de wedloop ' +
    'uit server/lib/zegel.js: het bestand bestaat voordat de inhoud er is, dus de tweede lezer krijgt ' +
    'niets. Uitval:\n' + omgevallen.slice(0, 2).join('\n---\n'));

  /* EEN SLEUTEL EN NIET ACHT. Zou hier temp+rename staan, dan valt er niets om
     en zijn er toch meerdere sleutels -- de faalvorm die niemand ziet. */
  assert.equal(meestePerRonde, 1,
    'binnen een ronde kwamen er ' + meestePerRonde + ' verschillende zegelsleutels boven water, op EEN ' +
    'gedeelde datamap. Dan verifieert het ene proces de tokens van het andere niet meer, en dat faalt ' +
    'stiller dan een crash -- er valt niets om, er klopt alleen niets meer.');
});

/* DE BESTURINGSPROEF. Zonder deze kan de toets hierboven groen staan omdat de
   kinderen elkaar nooit RAAKTEN -- een wedloop die je niet uitlokt, win je
   altijd. Hier bestaat het bestand al met een LEGE inhoud, precies de toestand
   die proces B in stap 2 aantreft. Ziet maakZegel dat niet, dan is de meting
   hierboven niets waard. */
test('een leeg sleutelbestand is precies de toestand die de wedloop oplevert', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zegelleeg-'));
  fs.writeFileSync(path.join(map, 'zegel.key'), '');
  const { maakZegel } = require('../server/lib/zegel.js');
  assert.throws(() => maakZegel({ dataDir: map }), /DECODER|asn1|PEM|unsupported/i,
    'een leeg sleutelbestand komt er zonder klacht doorheen. Dan zegt de toets hierboven niets ' +
    'over de wedloop, want de toestand die hij moet vangen is blijkbaar onschuldig.');
});
