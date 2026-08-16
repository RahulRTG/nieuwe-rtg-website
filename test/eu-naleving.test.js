/* De pinnen onder EU.md: elke "dit staat in de code"-bewering uit dat
   document staat hier als toets. Niet omdat een tekstcontrole diepgang heeft,
   maar omdat een nalevingsdocument dat naar de code wijst gaat LIEGEN zodra
   iemand die code stilletjes terugdraait -- een placeholder-mail terugzet, de
   AI-melding wegpoetst omdat hij "rommelig" oogt, of het aanmeldbesluit
   achter de verkeerde poort hangt. Dan hoort de bouw te breken, met dit
   bestand als reden.

   Draai los: node --experimental-sqlite --test test/eu-naleving.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const lees = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('AVG/BW 3:15d: de juridische pagina\'s dragen adres, KvK en een echt contactadres', () => {
  for (const p of ['public/apps/juridisch/privacy.html', 'public/apps/juridisch/voorwaarden.html', 'public/apps/juridisch/partnervoorwaarden.html']) {
    const b = lees(p);
    assert.match(b, /82273510/, p + ' draagt het KvK-nummer');
    if (!/partnervoorwaarden/.test(p)) assert.match(b, /Overhoeksplein 1, 1031 KS Amsterdam/, p + ' draagt het vestigingsadres');
    /* De placeholder was precies het soort ding dat eeuwig blijft staan:
       een @...example-adres leest als ingevuld en is het niet. */
    assert.ok(!/@[a-z.-]*example/.test(b), p + ' bevat geen placeholder-mailadres meer');
  }
});

test('AVG art. 22: het besluit over een aanmelding neemt een mens, en het beleid zegt dat', () => {
  /* De route: beslis staat achter officeAuth en geeft de naam van de
     beslisser door. Dit is een bedradingspin, geen gedragstoets -- het gedrag
     zelf staat in test/aanmeldbesluit.test.js; hier staat vast dat de
     bewering in het privacybeleid over DEZE regel gaat. */
  const route = lees('server/routes/aanmeldingen.js');
  const regel = route.split('\n').find(r => r.includes("'/api/aanmelding/beslis'"));
  assert.ok(regel && regel.includes('officeAuth'), 'beslis loopt door de kantoorpoort (een mens)');
  const beleid = lees('public/apps/juridisch/privacy.html');
  assert.match(beleid, /artikel 22/, 'het privacybeleid benoemt artikel 22');
  assert.match(beleid, /herbeoordeling/, 'en biedt de weg naar een menselijke herbeoordeling');
  assert.match(beleid, /Autoriteit Persoonsgegevens/, 'en noemt het klachtrecht bij de AP');
});

test('AI-verordening art. 50: de vaste AI-melding staat in de leden-app, niet alleen in de voorwaarden', () => {
  const app = lees('public/apps/app.html');
  assert.match(app, /Rahul is een AI/, 'de melding staat in de app-schil');
  assert.match(app, /os-aiwet/, 'als vast element bij de chatbalk, met eigen stijl');
  /* En de voorwaarden mogen niet meer beweren dat je ernaar moet vragen. */
  const vw = lees('public/apps/juridisch/voorwaarden.html');
  assert.ok(!/als u ernaar vraagt/.test(vw), 'de voorwaarden beloven de melding, niet het navragen');
});

test('AI-verordening art. 50 lid 2: campagnebeeld is als AI-gegenereerd benoemd', () => {
  /* Het campagnebeeld is nu een kiesbare achtergrond in de leden-app en geen
     img in het oude magazine. Juist bij die knop moet de melding staan: daar
     ziet en kiest de gebruiker het beeld. */
  const app = lees('public/apps/app.html');
  assert.match(app, /os-wall-beeld[\s\S]*AI-gegenereerd campagnebeeld/,
    'de app benoemt het beeld bij de achtergrondkeuze');
  assert.match(lees('public/apps/juridisch/privacy.html'), /met AI gemaakt/, 'het privacybeleid zegt het');
});

test('DSA: er is een benoemd contactpunt voor meldingen en toezichthouders', () => {
  assert.match(lees('public/apps/juridisch/privacy.html'), /contactpunt/, 'het contactpunt staat in het beleid');
});

test('Wft 3:7: het platform noemt zichzelf nergens meer "bank"', () => {
  /* Het woord "bank" in eigen naam of bedrijfsvoering vraagt een
     bankvergunning (Wft 3:7). Het product heet nu RTG Rekening. Deze pin
     loopt ALLE uitgeleverde schermen en de app-gids langs; hij kijkt naar de
     eigennaam ("RTG Bank") en naar de zelfaanduiding ("eigen bank"), niet
     naar het losse woord -- over de banken van anderen (kinderrechten-les,
     een bankpas van een lid) mag gewoon worden geschreven. */
  const wortel = path.join(__dirname, '..');
  const fouten = [];
  const loop = (map) => {
    for (const naam of fs.readdirSync(map)) {
      const vol = path.join(map, naam);
      if (fs.statSync(vol).isDirectory()) { if (!/dist$/.test(vol)) loop(vol); continue; }
      if (!/\.(html|js|webmanifest)$/.test(naam)) continue;
      const b = fs.readFileSync(vol, 'utf8');
      if (/RTG Bank/.test(b) || /[Ee]igen bank\b/.test(b))
        fouten.push(path.relative(wortel, vol));
    }
  };
  loop(path.join(wortel, 'public'));
  const gids = lees('server/kern/appgids-data/deel1.js');
  if (/RTG Bank/.test(gids)) fouten.push('server/kern/appgids-data/deel1.js');
  assert.deepEqual(fouten, [], 'deze bestanden noemen het platform nog "bank":\n  ' + fouten.join('\n  '));
});
