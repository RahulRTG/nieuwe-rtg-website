#!/usr/bin/env node
/* ============================================================================
   HET VOORSTEL PER ONVERKLAARDE SCHRIJFROUTE -- de machine zet klaar, een mens
   geeft vrij.

   IDEMSCHULD.json telt 4.479 schrijfroutes zonder verklaring in
   server/lib/idemsleutels.js. Dat getal moet naar nul, en de verleiding is om
   het in een middag leeg te schrijven: een lus over de routelijst, per route een
   plausibele regel, schuld nul, klaar.

   Dat mag hier niet, en de reden staat in het bestand zelf: "een verklaring die
   je niet hebt nagelezen, is een gok met een net gezicht" -- geschreven nadat
   POST /api/muziek/maak een verklaring kreeg die op de NAAM van de route was
   gebaseerd en niet op de handler. Een lijst van 4.479 zulke gokken is geen
   dekking; het is dezelfde blindheid met een groen vinkje ervoor.

   Idempotentie is een eigenschap van de HANDELING. Twee keer `{}` naar een
   dobbelworp zijn twee legitieme worpen; twee keer `{}` naar "maak een concern"
   is een dubbeltik. Geen enkele machine ziet dat verschil aan de code, want het
   verschil zit in wat de handeling BETEKENT.

   Wat een machine wel kan, is het verschil tussen die twee zo klein mogelijk
   maken voor de mens die het besluit neemt. Dit script leest wat de idemproef
   werkelijk heeft GEMETEN in zijn RONDE ZONDER SLEUTEL -- twee woordelijk gelijke
   kale oproepen en het verschil dat elk in de opslag achterliet -- en verdeelt de
   schuld in vier standen.

   WAAROM JUIST DIE RONDE, en niet de drie oproepen met een sleutel: die dragen
   `idem` in het lijf, en server/middleware/idempotentie.js is precies daarop
   opt-in voor elke /api-POST. Die uitslag meet dus de platformlaag die de proef
   zelf voedt. idemsleutels.js gaat over iets anders: de dubbeltik van een
   ongeduldige gebruiker, en die stuurt geen sleutel.

     voorstel       het bewijs laat maar een lezing toe. De vorm staat erbij,
                    met de meting als grond. Een mens leest hem na en neemt hem
                    over -- of niet.
     besluit-nodig  er is gemeten dat een herhaling het werk OPNIEUW doet. Of dat
                    een dubbeltik is of een tweede handeling, is precies de vraag
                    die geen meting beantwoordt. Het bewijs staat erbij zodat het
                    besluit seconden kost in plaats van een zoektocht.
     onbereikt      de proef kwam niet bij het werk. Er is dus geen bewijs, en
                    dan hoort er ook geen voorstel te staan. Deze routes vragen
                    eerst een wereld waarin ze slagen; de hindernis die de route
                    zelf teruggaf staat erbij.
     al-verklaard   staat al in idemsleutels.js.

   WAT DIT SCRIPT NOOIT DOET: schrijven in server/lib/idemsleutels.js. Het
   voorstel landt in IDEMVOORSTEL.json en nergens anders. Zou het zichzelf
   invullen, dan was de verklaring weer een afleiding uit gedrag -- en dan meet
   de idemproef straks zijn eigen aanname.

   Draaien:  node scripts/idemvoorstel.js [--vastleggen]
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { SLEUTELS } = require('../server/lib/idemsleutels');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'IDEMVOORSTEL.json');
const vastleggen = process.argv.includes('--vastleggen');

const lees = (naam) => JSON.parse(fs.readFileSync(path.join(WORTEL, naam), 'utf8'));

const proef = lees('IDEMPROEF.json');
const schuldReg = lees('IDEMSCHULD.json');

/* De meting per pad. De idemproef kent alleen POST-routes zonder pad-parameter;
   de schuld is breder. Wat we niet gemeten hebben, krijgt dus geen bewijs -- en
   daarmee geen voorstel. */
const meting = new Map();
for (const r of proef.perRoute || []) meting.set((r.methode || 'POST') + ' ' + r.pad, r);

const leeg = (d) => !d || !Object.keys(d).length;
const beschrijf = (d) => leeg(d) ? 'niets' : Object.entries(d).map(([k, v]) => k + ' ' + (typeof v === 'number' ? (v > 0 ? '+' + v : String(v)) : v)).join(', ');

/* ---------------------------------------------------------------------------
   DE REGELS. Zes, en elk noemt wat hij van het bewijs eist. Wie er een toevoegt:
   de eis hoort strenger te zijn dan het gevoel, niet andersom. Let op dat maar
   TWEE van de zes een voorstel opleveren -- de andere vier eindigen bij een mens,
   en dat is geen tekortkoming van dit script maar de vorm van het probleem.
   ------------------------------------------------------------------------- */
function weeg(sleutel) {
  const m = meting.get(sleutel);
  if (!m) return { stand: 'onbereikt', graad: 'onbekend',
    waarom: 'deze route staat niet in IDEMPROEF.json -- niet gemeten (een pad-parameter, een ander werkwoord dan POST, of hij viel buiten de ronde)' };

  /* HET BEWIJS DAT ERTOE DOET IS DE RONDE ZONDER SLEUTEL, EN DAT WAS EERST FOUT.

     De eerste opzet van dit script las `m.idempotentie` -- de uitslag van de
     drie oproepen MET een idem-sleutel in het lijf -- en stelde bij 'beschermd'
     een `zelfdeVerzoek: true` voor. Dat leverde 1.087 voorstellen op, en ze
     waren allemaal waardeloos.

     Reden: server/middleware/idempotentie.js is opt-in op precies de velden die
     de proef meestuurt (`idem`, `idempotentieSleutel`) en staat voor ELKE
     /api-POST. Die uitslag meet dus de platformlaag die de proef zelf voedt, en
     niet de route. Nagemeten op 29 augustus 2026: van vijf routes die MET
     sleutel `herhaald: true` gaven, gaven er vier ZONDER sleutel gewoon
     `herhaald: false`. Een voorstel op die grond is precies de gok met een net
     gezicht waar idemsleutels.js voor waarschuwt -- ditmaal met een meting als
     alibi, wat hem erger maakt en niet beter.

     server/lib/idemsleutels.js gaat over de dubbeltik ZONDER sleutel: de
     ongeduldige gebruiker op een trage verbinding stuurt geen idempotency-key.
     Dus is `m.zonderSleutel` de enige uitslag die hier iets mag wegen. */
  const z = m.zonderSleutel;
  if (!z) return { stand: 'onbereikt', graad: 'onbekend',
    waarom: 'deze route is nog niet zonder sleutel gemeten; draai scripts/idemproef-route.js opnieuw ' +
      '(de ronde zonder sleutel bestaat sinds 29 augustus 2026)' };

  const st = z.statussen || [];
  const o = z.opslag || {};

  /* 1. DE ROUTE VING DE DUBBELTIK ZELF. Eerste kale oproep deed werk, de
        woordelijk gelijke herhaling niet -- gemeten in de opslag, zonder dat er
        een sleutel aan te pas kwam. Dat IS zelfdeVerzoek. */
  if (z.stand === 'beschermd' && z.grond === 'opslag') {
    return { stand: 'voorstel', vorm: { zelfdeVerzoek: true }, graad: 'gemeten',
      waarom: 'gemeten ZONDER sleutel: de eerste oproep liet ' + beschrijf(o.d) + ' achter in de opslag ' +
        'en de woordelijk gelijke herhaling niets. De route vangt de dubbeltik dus al op; de ' +
        'verklaring legt vast dat dat de bedoeling is en geen toeval.' };
  }

  /* 2. DE IDEM-POORT DEED HET AL -- maar zonder verklaring KAN dat niet, dus dit
        is een tegenspraak die een mens moet zien in plaats van een voorstel. */
  if (z.stand === 'beschermd' && z.grond === 'gemerkt') {
    return { stand: 'besluit-nodig', graad: 'gemeten',
      waarom: 'het antwoord droeg `herhaald: true` terwijl er geen sleutel is gestuurd EN er geen ' +
        'verklaring in idemsleutels.js staat. Dat hoort niet te kunnen: de idem-poort handelt op de ' +
        'verklaring. Ergens doet een laag hier iets dat niemand heeft opgeschreven -- eerst uitzoeken ' +
        'welke, en pas daarna een verklaring.' };
  }

  /* 3. GEWEIGERD BIJ DE HERHALING. Geen tweede effect, maar via een heel ander
        mechanisme (een conflict, een toestandscontrole). Dat is geen
        zelfdeVerzoek en het hoort niet als zodanig voorgesteld te worden. */
  if (z.stand === 'beschermd' && z.grond === 'geweigerd') {
    return { stand: 'besluit-nodig', graad: 'gemeten',
      waarom: 'de kale herhaling werd GEWEIGERD (statussen ' + st.join('/') + '): de route bewaakt zijn ' +
        'eigen toestand en dat is iets anders dan een herhaling herkennen. Een `zelfdeVerzoek` zou hier ' +
        'het eerste antwoord terugleggen over een bewuste weigering heen -- de fout die de kop van ' +
        'server/middleware/idempotentie.js beschrijft. Kies met de handler erbij.' };
  }

  /* 4. DE DUBBELTIK DEED HET WERK OPNIEUW. Hier houdt de machine op, en met
        opzet: dit is exact het onderscheid tussen de dubbeltik en de tweede
        worp, en dat zit in wat de handeling BETEKENT. */
  if (z.stand === 'onbeschermd') {
    return { stand: 'besluit-nodig', graad: 'gemeten',
      waarom: 'gemeten ZONDER sleutel: een woordelijk gelijke herhaling deed het werk OPNIEUW ' +
        '(opslag: ' + beschrijf(o.d) + ' / ' + beschrijf(o.e) + '). Dit is de dubbeltik. Of hij ' +
        'opgevangen hoort te worden of een tweede handeling is die met recht plaatsvindt, beantwoordt ' +
        'geen meting -- twee keer {} naar een dobbelworp zijn twee worpen. Kies: zelfdeVerzoek/velden, ' +
        'of nietIdempotent met de reden.' };
  }

  /* 5. GEEN WERK, DRIE KEER GOED -- kandidaat-leesroute. Bewust `vermoed`:
        staatlog kijkt naar de collecties in de database, dus een schrijfactie
        naar een bestand, een externe dienst of een teller daarbuiten ziet hij
        niet. Dat is precies het soort route waar een te snelle `leest: true` de
        poort blind maakt. */
  const kaalOk = st.length === 2 && st.every(x => x >= 200 && x < 300);
  if (z.stand === 'ongemeten' && kaalOk && leeg(o.d) && leeg(o.e)) {
    return { stand: 'voorstel', vorm: { leest: true }, graad: 'vermoed',
      waarom: 'twee geslaagde kale oproepen (' + st.join('/') + ') die geen van beide iets in de ' +
        'gemeten collecties achterlieten. Ziet eruit als een POST die alleen leest of rekent. NA TE ' +
        'KIJKEN in de handler: schrijft hij naar een bestand, een externe dienst of een teller buiten ' +
        'die collecties, dan is dit voorstel fout.' };
  }

  /* 6. DE PROEF KWAM NIET BINNEN. Geen bewijs, dus geen voorstel. */
  return { stand: 'onbereikt', graad: 'onbekend',
    waarom: 'de proef kreeg deze route zonder sleutel niet aan het werk (' + (z.reden || 'geen reden vastgelegd') +
      ', statussen ' + st.join('/') + (m.hindernis ? '; de route zei: "' + m.hindernis + '"' : '') +
      '). Zonder een oproep die werk doet is er niets te wegen.' };
}

/* ---------------------------------------------------------------------------
   DE RONDE
   ------------------------------------------------------------------------- */
const rijen = [];
const telling = { voorstel: 0, 'besluit-nodig': 0, onbereikt: 0, 'al-verklaard': 0 };
const perGraad = {};

for (const sleutel of schuldReg.schuld || []) {
  if (SLEUTELS[sleutel]) { telling['al-verklaard']++; continue; }
  const w = weeg(sleutel);
  telling[w.stand]++;
  perGraad[w.graad] = (perGraad[w.graad] || 0) + 1;
  rijen.push(Object.assign({ route: sleutel }, w));
}

/* De volgorde van het werk: eerst wat een mens in seconden kan afdoen (een
   voorstel met een gemeten grond), dan de besluiten, dan wat eerst een wereld
   nodig heeft. Een lijst van 4.479 regels is alleen bruikbaar als de bovenste
   regel ook de eerstvolgende handeling is. */
const RANG = { voorstel: 0, 'besluit-nodig': 1, onbereikt: 2 };
const GRAAD = { gemeten: 0, vermoed: 1, onbekend: 2 };
rijen.sort((a, b) => (RANG[a.stand] - RANG[b.stand]) || (GRAAD[a.graad] - GRAAD[b.graad]) ||
  a.route.localeCompare(b.route));

console.log('\n=== VOORSTELLEN PER ONVERKLAARDE SCHRIJFROUTE ===\n');
console.log('  schuld in IDEMSCHULD.json            : ' + (schuldReg.schuld || []).length);
console.log('  gemeten door IDEMPROEF               : ' + meting.size + ' routes');
console.log('');
console.log('  VOORSTEL (na te kijken en over te nemen) : ' + telling.voorstel);
console.log('  BESLUIT NODIG (gemeten, maar de vraag is menselijk) : ' + telling['besluit-nodig']);
console.log('  ONBEREIKT (geen bewijs, eerst een wereld) : ' + telling.onbereikt);
if (telling['al-verklaard']) console.log('  al verklaard (schuldlijst verouderd)  : ' + telling['al-verklaard']);
console.log('');
console.log('  naar bewijsgraad                     : ' +
  Object.entries(perGraad).map(([g, n]) => g + ' ' + n).join(', '));

const vormTelling = {};
for (const r of rijen) if (r.vorm) { const k = Object.keys(r.vorm)[0]; vormTelling[k] = (vormTelling[k] || 0) + 1; }
if (Object.keys(vormTelling).length) {
  console.log('  voorgestelde vormen                  : ' +
    Object.entries(vormTelling).map(([v, n]) => v + ' ' + n).join(', '));
}
console.log('\n  de eerste tien:');
for (const r of rijen.slice(0, 10)) {
  console.log('    [' + r.stand + '/' + r.graad + '] ' + r.route + (r.vorm ? '  -> ' + JSON.stringify(r.vorm) : ''));
}

if (vastleggen) {
  fs.writeFileSync(UITSLAG, JSON.stringify({
    stempel: stempel(),
    uitleg: 'Per schrijfroute zonder verklaring: wat de idemproef er werkelijk aan GEMETEN heeft, en ' +
      'welke vorm dat bewijs toelaat. Een voorstel is geen verklaring -- het wordt er pas een als een ' +
      'mens hem nakijkt en overneemt in server/lib/idemsleutels.js.',
    grens: 'Dit register bewijst niets over idempotentie. Het maakt alleen het BESLUIT goedkoop. ' +
      'Een voorstel met graad "vermoed" berust op het uitblijven van een spoor in de gemeten ' +
      'collecties, en afwezig bewijs is geen bewijs van afwezigheid.',
    gemeten: { schuld: (schuldReg.schuld || []).length, metMeting: rijen.filter(r => r.stand !== 'onbereikt').length,
      voorstel: telling.voorstel, besluitNodig: telling['besluit-nodig'], onbereikt: telling.onbereikt,
      alVerklaard: telling['al-verklaard'], perGraad, vormen: vormTelling },
    rijen
  }, null, 1) + '\n');
  console.log('\n  IDEMVOORSTEL.json geschreven.');
} else {
  console.log('\n  (niets weggeschreven -- draai met --vastleggen)');
}
