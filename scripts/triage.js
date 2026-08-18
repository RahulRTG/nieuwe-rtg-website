#!/usr/bin/env node
'use strict';

/* DE TRIAGE -- wat er tussen "de sonde is rood" en "iemand doet iets" hoort te
   staan, en wat er tot nu toe niet stond.

   De live-sonde draait elke vijf minuten en zakt netjes met exitcode 1. Daarna
   gebeurde er niets: er ging een mail naar wie toevallig op de workflow
   geabonneerd was, en die moest zelf uitzoeken of de naam niet meer oploste,
   het certificaat verlopen was, de reverse proxy dicht zat of de app zelf
   omviel. Dat uitzoeken is het dure deel van een storing -- niet het
   repareren, maar de eerste twintig minuten waarin niemand weet WAAR het zit.

   Deze module doet dat onderscheid, en trekt er één conclusie uit die er echt
   toe doet: helpt de vorige versie terugzetten, of niet?

   DAT ONDERSCHEID IS DE HELE WINST. Terugrollen repareert precies één ding:
   een app die stuk is gegaan door wat er als laatste in ging. Bij een verlopen
   certificaat, een DNS die niet oplost of een rand die dicht zit doet
   terugrollen NIETS -- het kost alleen tijd, en het zet ondertussen een oudere
   versie neer die je daarna weer vooruit moet rollen.

   WAT DIT SCRIPT NIET DOET: terugrollen. Het adviseert. `npm run deploy:terug`
   zet een echte productieomgeving terug en dat is geen handeling die een cron
   op eigen gezag hoort te doen; die knop blijft bij een mens.

   Draaien:
     node scripts/triage.js --uit=sonde.json
     node scripts/sonde.js https://rtg.example.com --json=sonde.json || node scripts/triage.js --uit=sonde.json */

const fs = require('fs');

/* De handtekeningen per laag. Ze staan bewust op volgorde van "verder weg" naar
   "dichterbij": lost de naam niet op, dan zegt een 502 verderop niets meer. */
const DNS = /ENOTFOUND|EAI_AGAIN|ERR_NAME_NOT_RESOLVED|getaddrinfo/i;
const TLS = /CERT_|ERR_TLS|DEPTH_ZERO|UNABLE_TO_VERIFY|SELF_SIGNED|ERR_SSL|handshake|certificaat verloopt/i;
const VERBINDING = /ECONNREFUSED|ECONNRESET|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|socket hang up/i;

/* De sonde noemt zijn velden reis/reden, een toets schrijft liever pad/fout.
   Beide zijn dezelfde meting, dus de triage leest ze allebei in plaats van de
   ene vorm tot waarheid te verklaren. */
function normaliseer(reis) {
  return {
    pad: reis.pad || reis.reis || reis.naam || '?',
    status: Number(reis.status) || 0,
    fout: String(reis.fout || reis.reden || ''),
    gelukt: typeof reis.gelukt === 'boolean' ? reis.gelukt : (Number(reis.status) >= 200 && Number(reis.status) < 400)
  };
}

/* De duiding. Puur: erin gaan monsters, eruit komt een oordeel. Geen netwerk,
   geen bestanden, geen tijd -- zodat elke tak van dit oordeel in een toets
   echt kan worden omgezet. */
function duid(reizen) {
  const r = (Array.isArray(reizen) ? reizen : []).map(normaliseer);

  /* LAT.md regel 3: een meter zakt als zijn invoer ontbreekt. Nul reizen is
     niet "alles goed" maar "er is niets gemeten", en dat verschil is precies
     het verschil tussen een rustige nacht en een blinde nacht. */
  if (!r.length) {
    return {
      laag: 'onbekend', terugrollen: false, stuk: 0, totaal: 0,
      waarom: 'De sonde leverde geen reizen op; er is niets gemeten. Dat is geen groen licht.',
      doen: 'Zoek uit waarom de sonde niets liep: staat RTG_LIVE_URL, draagt SLO.json nog reizen, kwam de runner er wel?'
    };
  }

  const stuk = r.filter(x => !x.gelukt);
  if (!stuk.length) {
    return { laag: 'geen', terugrollen: false, stuk: 0, totaal: r.length, waarom: 'Alle reizen kwamen door.', doen: 'Niets.' };
  }

  const foutTekst = stuk.map(x => x.fout).join(' | ');
  const noem = () => stuk.map(x => `${x.pad} (${x.status || 'geen antwoord'})`).join(', ');

  if (DNS.test(foutTekst)) {
    return {
      laag: 'dns', terugrollen: false, stuk: stuk.length, totaal: r.length,
      waarom: 'De naam loste niet op: ' + noem() + '. Dat gebeurt buiten dit huis -- bij de registrar of de nameservers.',
      doen: 'Controleer de nameservers en of het domein nog actief is. Terugrollen doet hier niets: de app is niet eens bereikt.'
    };
  }

  if (TLS.test(foutTekst)) {
    return {
      laag: 'tls', terugrollen: false, stuk: stuk.length, totaal: r.length,
      waarom: 'De TLS-verbinding kwam niet rond: ' + noem() + '. Bijna altijd een verlopen of onvolledig uitgeleverd certificaat.',
      doen: 'Controleer de vervaldatum en de ketenuitlevering van het certificaat, en of de vernieuwing draait. Terugrollen doet hier niets.'
    };
  }

  if (VERBINDING.test(foutTekst)) {
    return {
      laag: 'rand', terugrollen: false, stuk: stuk.length, totaal: r.length,
      waarom: 'De verbinding werd geweigerd of viel weg: ' + noem() + '. Dat is de rand (reverse proxy, poort, container), niet de code erachter.',
      doen: 'Kijk of de container draait en of de proxy naar de goede poort wijst. Terugrollen zet een andere versie neer achter dezelfde dichte deur.'
    };
  }

  /* Alles antwoordt, en alles antwoordt fout. Dan is de app zelf stuk, en dan
     -- en alleen dan -- is de laatste uitrol de eerste verdachte. */
  if (stuk.length === r.length) {
    return {
      laag: 'app', terugrollen: true, stuk: stuk.length, totaal: r.length,
      waarom: 'Alle ' + r.length + ' reizen antwoordden met een fout: ' + noem() + '. De rand staat open, de app erachter niet.',
      doen: 'Dit is het geval waarin terugrollen echt helpt. Bekijk de laatste uitrol; `npm run deploy:terug` zet hem terug. Die knop blijft bij een mens.'
    };
  }

  return {
    laag: 'deels', terugrollen: false, stuk: stuk.length, totaal: r.length,
    waarom: stuk.length + ' van de ' + r.length + ' reizen viel om: ' + noem() + '. De rest komt gewoon door, dus dit zit in een route en niet in het huis.',
    doen: 'Zoek de fout in die specifieke route. Terugrollen is hier duurder dan de storing: je zet alles terug voor iets wat op één plek zit.'
  };
}

function toon(u) {
  return [
    'TRIAGE VAN DE LIVE-SONDE',
    '  laag         ' + u.laag,
    '  reizen stuk  ' + u.stuk + ' van ' + u.totaal,
    '  terugrollen  ' + (u.terugrollen ? 'JA -- dit is het geval waarin het helpt' : 'nee'),
    '',
    '  ' + u.waarom,
    '  ' + u.doen
  ].join('\n');
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const uit = (argv.find(a => a.startsWith('--uit=')) || '').slice(6);
  if (!uit) {
    console.error('Geef de sonde-uitvoer mee: node scripts/triage.js --uit=sonde.json');
    process.exit(2);
  }
  let rauw;
  try {
    rauw = JSON.parse(fs.readFileSync(uit, 'utf8'));
  } catch (e) {
    /* Exitcode 2, niet 1: de triage kon niet duiden. Een fix-lus die hierop
       afgaat zou anders een storing gaan zoeken die niet gemeten is. */
    console.error('De triage kon de sonde-uitvoer niet lezen (' + uit + '): ' + e.message);
    process.exit(2);
  }
  const uitslag = duid(Array.isArray(rauw) ? rauw : (rauw.monsters || rauw.reizen || []));
  console.log(toon(uitslag));
  fs.writeFileSync('TRIAGE.json', JSON.stringify(uitslag, null, 2) + '\n');
  process.exit(uitslag.laag === 'geen' ? 0 : (uitslag.laag === 'onbekend' ? 2 : 1));
}

module.exports = { duid, normaliseer, toon };
