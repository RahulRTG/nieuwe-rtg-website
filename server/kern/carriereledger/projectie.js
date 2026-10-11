/* ============================================================================
   DE LEESKANT VAN HET CARRIERE LEDGER -- een projectie, geen tweede opslag.

   ./index.js schrijft de reeks; dit bestand leest hem. Er wordt hier NIETS
   bewaard en niets bijgewerkt: elke afgeleide (is dit feit ingetrokken, welke
   bevestigingen horen erbij, wat zit er in een kapitaal) wordt bij het lezen
   uitgerekend. Zou een intrekking een vlag op de oorspronkelijke regel zetten,
   dan was die regel herschreven -- en een ledger die zijn eigen verleden
   bijwerkt, is een verslag.

   DE BEVESTIGINGEN WORDEN MET OPZET NIET SAMENGEVAT tot een sterkste herkomst.
   "gezien door RTG" en "bevestigd door bond X" zijn twee verschillende dingen,
   en wie ze tot EEN waarde platslaat, gooit juist weg wat een carrierefeit
   bewijsbaar maakt. De lezer krijgt ze allebei, elk met wat zij wel en niet
   zegt.

   DE ENIGE ORDE IS DE TIJD. Er wordt nergens gesorteerd op gewicht, op het
   aantal bevestigingen of op kapitaal; dat zou een ranglijst zijn met een andere
   naam (CAR-05, scripts/lib/cijferopmens.js).
   ========================================================================== */
'use strict';

const R = require('./regels');

const feitVan = (rs, fid) => rs.find(r => r.id === fid && r.soort === 'feit') || null;
const weggehaald = (rs) => new Set(rs.filter(r => r.soort === 'intrekking').map(r => r.doel));

/* DE DUBBELKLIK-GRENS, en hier weegt hij zwaarder dan elders. Een dubbeltik
   op een agenda geeft rommel die je weghaalt; in een LEDGER kan een regel
   alleen worden ingetrokken en nooit verdwijnen -- dus een tweede identieke
   regel vervuilt voorgoed, en juist op de plek die een mens naar buiten
   toont. De dubbeltik-ronde vond ze allebei (zet: 0 -> 2, bevestig: 0 -> 2).

   Dit is een TOESTANDSCONTROLE en geen duplicaatlaag (MUTATIECONTRACT.md par.
   5o): wat vaststaat is dat er geen tweede IDENTIEKE regel kan ontstaan. Wijk
   ergens van af -- een ander woord, een andere dag -- en het is een ander feit
   dat gewoon doorgaat. Een ingetrokken regel telt niet mee: die opnieuw zetten
   is een correctie en moet kunnen. */
function alGezet(rs, gelijk) {
  const weg = weggehaald(rs);
  return rs.some(r => !weg.has(r.id) && gelijk(r));
}

module.exports = function maakProjectie({ reeksKijk, naam }) {
  const max = R.MAX_REGELS;
  /* De projectie. Feiten op tijd, elk met zijn bevestigingen eronder en met
     `ingetrokken` AFGELEID -- niet opgeslagen, want dan zou een intrekking de
     oorspronkelijke regel herschrijven. */
  function bouw(rs) {
    const weg = weggehaald(rs);
    const uit = rs.filter(r => r.soort === 'feit').map(f => ({
      id: f.id, kapitaal: f.kapitaal, wat: f.wat, op: f.op, at: f.at,
      toelichting: f.toelichting || null,
      ingetrokken: weg.has(f.id),
      bevestigingen: rs.filter(b => b.soort === 'bevestiging' && b.feit === f.id).map(b => ({
        id: b.id, herkomst: b.herkomst, door: b.door, wat: b.wat, at: b.at,
        ingetrokken: weg.has(b.id),
        stelt: R.HERKOMST[b.herkomst].stelt, nietZegt: R.HERKOMST[b.herkomst].nietZegt
      }))
    }));
    uit.sort((a, b) => String(a.op).localeCompare(String(b.op)) || String(a.at).localeCompare(String(b.at)));
    return uit;
  }

  /* De zeven kapitalen als zeven APARTE voorraden met hun opbouw. Er staat met
     opzet geen totaal en geen percentage onder: dat getal is precies wat
     CARRIERE.md par. 4.1 afwijst, en het is ook het enige wat een lezer zou
     verleiden twee mensen naast elkaar te leggen. */
  function voorraden(feiten) {
    return R.KAPITAALNAMEN.map(k => ({ kapitaal: k, wat: R.KAPITALEN[k],
      regels: feiten.filter(f => f.kapitaal === k && !f.ingetrokken).map(f => f.id) }));
  }

  function mijn(key) {
    const rs = reeksKijk(key);
    const feiten = bouw(rs);
    return { status: 200, mens: naam(key), feiten, voorraden: voorraden(feiten),
      herkomst: R.HERKOMST, kapitalen: R.KAPITALEN, nooit: R.NOOIT };
  }

  /* Voor de deel-laag: een feit met zijn bevestigingen, zonder de rest van het
     ledger. Zie ./deel.js voor waarom dat de hele functie van deze laag is. */
  function feit(key, fid) {
    const f = bouw(reeksKijk(key)).find(x => x.id === fid);
    return f || null;
  }

  /* HET AFSCHRIFT -- "het gaat mee" (PERSONEEL.md par. 8, CARRIERE.md: lock-in
     door kwaliteit mag, lock-in door gijzeling zakt). Het hele ledger in EEN
     antwoord dat een mens kan bewaren en meenemen, ook als hij RTG verlaat.

     Twee verschillen met /mijn, en allebei met opzet. Een intrekking draagt hier
     haar REDEN en wie hem gaf: wie het afschrift buiten RTG leest, kan niet
     doorvragen waarom een regel er nog staat. En er staat bij wat dit afschrift
     NIET is -- het is niet ondertekend, dus het bewijst buiten RTG niets uit
     zichzelf; nakijken gaat per regel met een deelcode (./deel.js). Een
     afschrift dat zich als bewijs voordoet, is erger dan geen afschrift.

     Er komt geen samenvatting bij (geen aantal jaren, geen totaal per
     kapitaal): de reeks IS het afschrift, en een getal over een mens kan
     niemand navertellen (CAR-05). Deelcodes staan er niet in: die bestaan bij
     ons alleen als afdruk, en een code is een sleutel en geen feit. */
  function afschrift(key) {
    const rs = reeksKijk(key);
    const trek = new Map(rs.filter(r => r.soort === 'intrekking')
      .map(r => [r.doel, { door: r.door || null, reden: r.reden || null, at: r.at }]));
    const feiten = bouw(rs).map(f => Object.assign({}, f,
      { intrekking: trek.get(f.id) || null,
        bevestigingen: f.bevestigingen.map(b => Object.assign({}, b, { intrekking: trek.get(b.id) || null })) }));
    /* Geen tijdstempel van het maken: het afschrift is een LEZING, en twee keer
       vragen hoort hetzelfde te geven (het mutatiecontract noemt hem lezend). De
       regels dragen hun eigen tijd; de bestandsnaam krijgt de datum op het
       toestel. */
    /* De reeks kapt bij `max` regels aan de voorkant (./index.js, schrijfRegel),
       en houdt alleen de eerste vast. Een ledger dat die grens raakte, kan dus
       regels missen -- ook een intrekking, en dan staat een ingetrokken feit hier
       als niet ingetrokken. Of dat GEBEURD is, weet deze lezing niet; wel of het
       KAN. Dat staat erin in plaats van dat de zinnen hieronder het verzwijgen. */
    const misschienAfgekapt = !!max && rs.length >= max;
    return { status: 200, vorm: 'rtg-loopbaan-afschrift/1',
      mens: naam(key), feiten, misschienAfgekapt, herkomst: R.HERKOMST, kapitalen: R.KAPITALEN, nooit: R.NOOIT,
      nietZegt: [
        'Dit afschrift is niet ondertekend. Buiten RTG bewijst het uit zichzelf niets; een lezer kijkt een regel na met een deelcode die u per regel maakt.',
        'Een bevestiging zegt wat zij zegt en niet meer: per bevestiging staat erbij wat zij wel en niet vaststelt.',
        'Wat hier niet staat, is niet gebeurd volgens dit ledger -- niet volgens de wereld. Het ledger bevat alleen wat u of een ander erin heeft gezet.',
        'Een ingetrokken regel is niet gewist: hij staat er met de reden.',
        'Een ledger bewaart hoogstens ' + max + ' regels en houdt daarboven alleen de eerste vast. Staat ' +
          '`misschienAfgekapt` op waar, dan kunnen oudere regels ontbreken -- ook een intrekking.'
      ] };
  }

  return { mijn, feit, afschrift };
};

module.exports.feitVan = feitVan;
module.exports.weggehaald = weggehaald;
module.exports.alGezet = alGezet;
