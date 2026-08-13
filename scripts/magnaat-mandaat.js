/* Magnaat-mandaatmeter: vanaf welk punt wordt autonomie organisatorische kracht?

   ./magnaat-balans.js meet of elke sector speelbaar is, ./magnaat-pomp.js of er
   geen geld uit het niets komt, ./magnaat-storing.js of elke uitweg ergens de
   goede is. Dit script meet de vraag onder VERHAAL.md hoofdstuk 13: wat het
   verschil is tussen een bedrijf dat zonder zijn eigenaar kan en een dat dat
   niet kan.

   DE VRAAG IS NIET "WELKE INSTELLING VERDIENT HET MEESTE". Dat is een
   optimalisatie, en het antwoord erop zou een aanbevolen stand zijn -- en dan
   is governance een schuifje met een beste positie in plaats van een keuze. De
   vraag is:

     **Vanaf welk punt wordt autonomie organisatorische kracht, en vanaf welk
     punt wordt het roekeloosheid?**

   EN DAAROM MEET HIJ HET WAAROM EN NIET ALLEEN DE KAS. Twee bedrijven met
   dezelfde eindstand kunnen op een totaal andere manier daar gekomen zijn: de
   een miste omzet omdat er handen tekort waren, de ander betaalde rente omdat
   niemand mocht lenen. Dat verschil is de hele les, en op een kasregel is het
   onzichtbaar.

   ================== DE OPSTELLING ==================

   Identieke bedrijven, dezelfde maanden, dezelfde wereld -- alleen de
   BESTUURSVORM verschilt. De eigenaar is er in geen van de gevallen: dit meet
   wat er gebeurt terwijl hij weg is, en dat is precies waar hoofdstuk 13 over
   gaat.

   ================== WAT DEZE METER (NOG) NIET KAN ==================

   De derde uitkomst -- TE VEEL MANDAAT WORDT ROEKELOOSHEID -- is met deze motor
   niet te meten, en dat hoort hier te staan in plaats van weggelaten te worden.
   De AI-manager KAN niet roekeloos zijn: zijn tweede wet
   (../server/kern/spellen/magnaat/beheer.js) verbiedt hem het bedrijf groter te
   maken, en zijn actielijst bevat dan ook alleen `beleid` en
   `krediet-opnemen`. Een ruimer mandaat geeft hem meer ruimte om te doen wat hij
   toch al deed; het geeft hem geen nieuwe manier om er naast te zitten.

   Wat er dus nodig is voordat "te veel mandaat" gemeten kan worden: een
   gemandateerde die beslissingen kan nemen waarvan de gevolgen groter zijn dan
   zijn informatie -- uitbreiden, tekenen, overnemen. Zolang dat er niet is,
   meldt dit script de bovenkant als ONGEMETEN en niet als veilig.

   Draaien: node scripts/magnaat-mandaat.js */
'use strict';

const { kaart } = require('../server/kern/spellen/magnaat/kaart');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };
const MAANDEN = 36;
const START = 400000;

/* DE BESTUURSVORMEN, van geen enkele delegatie tot alles. `regels` is null als
   er geen manager is -- dat is de eigenaar die vertrekt zonder iets te regelen,
   en de eerlijke ondergrens van deze reeks. */
const VORMEN = [
  { sleutel: 'weg', naam: 'niemand (eigenaar vertrokken)', beheer: false },
  { sleutel: 'krap', naam: 'krap mandaat', beheer: true,
    /* `personeel: 1` en niet 0: een grens van nul WORDT WEGGEGOOID (nul is geen
       bevoegdheid, ../server/kern/spellen/magnaat/mandaat.js), en dan is deze
       rij ongemandateerd in plaats van krap. Dat is geen bug maar het gat dat
       hieronder gemeld wordt: je kunt met dit model geen NEE zeggen tegen
       huishouding, alleen een klein JA. */
    regels: { kasbuffer: 0, mag: { onderhoud: 300, personeel: 1 } } },
  { sleutel: 'standaard', naam: 'standaard (niets ingesteld)', beheer: true,
    regels: { kasbuffer: 0, mag: {} } },
  { sleutel: 'ruim', naam: 'ruim mandaat', beheer: true,
    regels: { kasbuffer: 0, mag: { onderhoud: 25000, personeel: 20, prijs: true } } },
  { sleutel: 'alles', naam: 'alles gedelegeerd', beheer: true,
    regels: { kasbuffer: 0, mag: { onderhoud: true, personeel: true, prijs: true,
      lenen: true, uitbreiden: true, contracten: true, onderzoek: true, verzekeren: true } } }
];

/* HOE DE EIGENAAR VERTREKT, en dat bleek de belangrijkste as van deze meting.

   De eerste opzet liet hem vertrekken met alles keurig ingesteld, en dan valt er
   niets te besturen: het pand blijft op honderd, de bezetting klopt, en een
   manager kost alleen maar tarief. Dat is een echte uitkomst -- zie de klacht
   die hij opleverde -- maar het is de saaie helft van de vraag.

   De andere helft is de realistische: iemand vertrekt met een zaak die aandacht
   nodig heeft. Daar hoort bestuur zijn geld te verdienen, en daar wordt "het
   bedrijf raakt verstopt" ook echt zichtbaar. */
const STORING = require('../server/kern/spellen/magnaat/storing');

const VERTREK = {
  verzorgd: { naam: 'verzorgd achtergelaten', doe() {} },
  verwaarloosd: { naam: 'verwaarloosd achtergelaten',
    doe(m, p, v) { m.spel.zet(p, 'anna', { actie: 'beleid', id: v.id, onderhoud: 0, personeel: 1 }); } },
  /* EN DE DERDE, sinds de manager storingen mag verhelpen: je gaat weg terwijl
     de koeling het niet doet. Dit is de vertrekvorm waar een MANDAAT werkelijk
     iets beslist -- repareren kost geld, dus "onderhoud tot X" bepaalt of je
     terugkomt in een zaak die draait of in een die drie jaar heeft gebloed.

     Hij wordt NIET geloot maar gezet, want dit is een meter en geen partij: een
     machinebreuk valt met een paar procent per maand en dan meet je het weer. */
  kapot: { naam: 'met een kapotte koeling achtergelaten',
    doe(m, p, v) {
      m.spel.zet(p, 'anna', { actie: 'beleid', id: v.id, onderhoud: 0, personeel: 1 });
      STORING.uitVoorval(v, 'machinebreuk', p.staat.maand);
    } }
};

/* Een zaak, een bestuursvorm, en dan drie jaar zonder eigenaar. Wat er
   teruggegeven wordt is met opzet breed: het WAAROM van een verschil zit in
   deze getallen en niet in de kas. */
function proef(vorm, hoe = 'verzorgd') {
  const m = maakMagnaat();
  const p = { id: 'md', soort: 'magnaat', spelers: ['anna'], teams: [0], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  p.staat.geld.anna = START;
  m.spel.zet(p, 'anna', { actie: 'open',
    kavel: kaart('ijmuiden').kavels.filter(k => k.zone === 'boulevard')[0].id,
    sector: 'horeca', omvang: 30 });
  const v = p.staat.vestigingen.anna[0];
  VERTREK[hoe].doe(m, p, v);
  if (vorm.beheer) {
    m.spel.zet(p, 'anna', { actie: 'beheer-aan' });
    m.spel.zet(p, 'anna', Object.assign({ actie: 'beheer-regels' }, vorm.regels));
  }
  /* DE EIGENAAR IS WEG. Vanaf hier doet niemand meer een zet: elke maand die
     volgt is de wereld die doorloopt. */
  const uit = { gemist: 0, rente: 0, beheer: 0, derving: 0, geweigerd: 0 };
  for (let i = 0; i < MAANDEN; i++) {
    p.staat.gerekendTot -= p.staat.maandMs;
    for (const verslag of m.eco.bijrekenen(p)) {
      uit.rente += (verslag.rentelast || 0);
      uit.beheer += (verslag.beheerlast || 0);
      for (const rij of Object.values(verslag.perSpeler || {}))
        for (const r of rij) {
          uit.gemist += (r.gemist || 0);
          uit.derving += (r.derving || 0);
        }
    }
  }
  /* WAT DE MANAGER NIET MOCHT, uit zijn eigen log. Dat is de kern van "het
     bedrijf raakt verstopt": niet dat er iets fout ging, maar dat er iets bleef
     liggen omdat niemand erover mocht beslissen. */
  const log = ((p.staat.beheer || {}).anna || {}).log || [];
  uit.geweigerd = log.filter(x => /niet verhoogd|niet aangenomen|niet geleend|blijft stuk/.test(x.wat || '')).length;
  /* EN OF DE KOELING HET WEER DOET. Bij de derde vertrekvorm is dit de vraag:
     een manager die hem mag repareren komt hier op `nee` uit, een die dat niet
     mag op `ja` -- en dan zie je in de kas wat dat drie jaar lang kost. */
  uit.stuk = STORING.openstaand(v).length > 0;
  uit.kas = Math.round(p.staat.geld.anna);
  uit.onderhoud = Math.round(v.onderhoud);
  uit.personeel = v.personeel;
  uit.reputatie = Math.round(v.reputatie);
  uit.omzet = Math.round(v.omzetTotaal || 0);
  uit.overeind = p.staat.vestigingen.anna.length > 0;
  return uit;
}

function meet(hoe = 'verwaarloosd') {
  const rijen = VORMEN.map(vorm => Object.assign({ vorm }, proef(vorm, hoe)));
  const klachten = [];
  const bij = (s) => rijen.find(r => r.vorm.sleutel === s);

  /* 1. EEN MANAGER HOORT TE HELPEN. Zou een bedrijf zonder enige sturing het
     beter doen dan een met een manager, dan betaal je een tarief voor schade en
     is de hele beheerlaag een val. */
  if (bij('standaard').kas <= bij('weg').kas)
    klachten.push('een standaardmanager levert niets op (' + bij('standaard').kas
      + ' tegen ' + bij('weg').kas + ' zonder manager); dan is zijn tarief een val');

  /* 2. EEN KRAP MANDAAT VERSTOPT HET BEDRIJF, en het moet ZICHTBAAR zijn waarom.
     Een krappe stand die toevallig evenveel oplevert, meet niets: de vraag is of
     het verstopt raakt, niet of het duurder is. */
  if (!bij('krap').geweigerd)
    klachten.push('een krap mandaat leverde geen enkel geweigerd besluit op;'
      + ' dan is de grens niet gaan bijten en meet deze rij niets');
  if (bij('krap').kas >= bij('ruim').kas)
    klachten.push('krap bestuur pakt niet slechter uit dan ruim bestuur ('
      + bij('krap').kas + ' tegen ' + bij('ruim').kas + '); dan is delegeren gratis');

  /* 3. EN DE BOVENKANT IS ONGEMETEN, niet veilig. Zie de kop: de AI-manager kan
     niet roekeloos zijn, dus "te veel mandaat" is met deze motor geen meetbare
     uitkomst. Dat melden we, want een lat die stil ontbreekt leest als een lat
     die gehaald wordt. */
  const bovenkant = bij('alles').kas >= bij('ruim').kas - Math.abs(bij('ruim').kas) * 0.01
    ? 'ongemeten: alles delegeren pakt niet slechter uit dan ruim delegeren'
    : 'let op: alles delegeren pakt SLECHTER uit dan ruim delegeren -- dat is de'
      + ' roekeloosheidskant en die is nu wel meetbaar';

  /* HET GAT DAT DEZE METER VOND, en het hoort in de uitslag omdat het een
     besluit vraagt en geen reparatie is. Voor de huishoudelijke bevoegdheden
     (onderhoud, personeel) betekent GEEN mandaat nog steeds ONBEGRENSD -- dat is
     de achterwaartse compatibiliteit uit VERHAAL.md hoofdstuk 13, en de prijs
     ervan is dat "hij mag dit niet" onuitdrukbaar is. Alleen een klein JA kan.
     Wie dat wil veranderen, verandert het gedrag van elke lopende partij. */
  const gat = 'voor onderhoud en personeel betekent GEEN mandaat nog steeds'
    + ' onbegrensd; "hij mag dit niet" is met dit model niet uit te drukken';
  return { rijen, klachten, bovenkant, gat, hoe };
}

function toon(hoe, telt) {
  const { rijen, klachten, bovenkant, gat } = meet(hoe);
  console.log('\nMagnaat-mandaatmeter: ' + MAANDEN + ' maanden zonder eigenaar -- '
    + VERTREK[hoe].naam + '\n');
  console.log('bestuursvorm                   |       kas | gemist | onderh | mensen |'
    + ' rente | geweigerd' + (hoe === 'kapot' ? ' | koeling' : ''));
  for (const r of rijen)
    console.log(r.vorm.naam.padEnd(30) + ' | ' + String(r.kas).padStart(9)
      + ' | ' + String(Math.round(r.gemist)).padStart(6)
      + ' | ' + String(r.onderhoud).padStart(6)
      + ' | ' + String(r.personeel).padStart(6)
      + ' | ' + String(Math.round(r.rente)).padStart(5)
      + ' | ' + String(r.geweigerd).padStart(9)
      /* EN OF DE KOELING HET WEER DOET. Alleen bij de vertrekvorm waar er een
         stuk was, want een kolom die overal `nee` zegt is geen kolom. */
      + (r.stuk === undefined || hoe !== 'kapot' ? '' : ' | ' + (r.stuk ? 'nog stuk' : 'gemaakt')));
  const weg = rijen.find(r => r.vorm.sleutel === 'weg');
  console.log('\nten opzichte van een bedrijf zonder enige sturing:');
  for (const r of rijen.filter(x => x.vorm.sleutel !== 'weg'))
    console.log('  ' + r.vorm.naam.padEnd(30) + (r.kas - weg.kas >= 0 ? '+' : '')
      + Math.round(r.kas - weg.kas));
  console.log('\nbovenkant -- ' + bovenkant);
  console.log('open gat  -- ' + gat);
  if (!klachten.length)
    console.log('\ndelegeren loont, en een krap mandaat is aantoonbaar duurder');
  else if (!telt) {
    console.log('\nbevindingen (deze opstelling telt niet mee voor de uitslag):');
    for (const k of klachten) console.log('  - ' + k);
  } else {
    console.log('\nNIET OK:');
    for (const k of klachten) console.log('  - ' + k);
  }
  return telt ? klachten : [];
}

if (require.main === module) {
  /* BEIDE VERTREKVORMEN, want ze beantwoorden verschillende vragen. Alleen de
     verwaarloosde telt voor de uitslag: een zaak die niets nodig heeft, meet
     geen bestuur. */
  toon('verzorgd', false);
  toon('kapot', false);
  const klachten = toon('verwaarloosd', true);
  if (klachten.length) process.exitCode = 1;
}

module.exports = { meet, proef, VORMEN, MAANDEN };
