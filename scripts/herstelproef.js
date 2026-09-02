#!/usr/bin/env node
/* ============================================================================
   DE HERSTELPROEF -- doet de tegenhanger werkelijk ongedaan wat de heenweg deed?

   WAAROM DIT ER IS. HERSTEL.json leidt tegenhangers af uit NAMEN: naast
   /api/agenda/toevoegen staat /api/agenda/verwijder, dus dat zal wel de
   omkering zijn. De hoogste graad die zo'n afleiding kan halen is `vermoed`, en
   dat stond er eerlijk bij: 74 vermoed, 0 bevestigd. Zolang `bevestigd` leeg is
   mag geen scherm en geen bon een terugweg beloven -- en compenserend handelen
   in een AI-keten is daarmee onbewezen.

   Dit is het instrument dat in BEWIJSSCHULD.json onder `herstel-onbevestigd`
   als ontbrekend stond. Het VOERT het paar uit: heen, kijken, terug, kijken.

   DE MEETLAT: TWEE BEELDEN, NIET EEN. De droogloop telt het versienummer van
   elke collectie, want die beantwoordt "is er iets gebeurd". Voor "staat het er
   weer zoals het stond" is dat de verkeerde vraag: `ver` loopt alleen maar op.
   Daarom leest deze proef de INHOUD (een hash per collectie), en gebruikt hij
   het versiebeeld alleen om te zien of een stap uberhaupt werk deed. Beide
   komen uit scripts/droogloop.js -- er komt geen tweede lezer van de opslag bij.

   VIER UITSLAGEN, EN DRIE ERVAN ZIJN GEEN BEWIJS:

     exact         na de terugweg is de inhoud van elke geraakte collectie
                   letterlijk terug op wat zij voor de heenweg was.
     compensatie   de terugweg deed werk in dezelfde collecties, maar de inhoud
                   is niet dezelfde. Dat is een geldige vorm van herstel (een
                   creditnota wist geen factuur) en het is GEEN exact herstel;
                   wie die twee gelijkstelt, belooft een terugweg die er niet is.
     geen-herstel  de terugweg draaide en veranderde niets. Dan is de naam een
                   belofte en de handeling niet.
     nietBeproefd  de heenweg deed geen werk (geen geldig lijf, geen rechten,
                   404). Dan valt er niets om te draaien -- en dit is met opzet
                   een eigen uitslag en geen `geen-herstel`: niet gemeten mag
                   nooit als een oordeel langskomen.

   WAT DEZE PROEF NIET KAN. Zij weet niet WELK ding de terugweg moet aanwijzen.
   Zij probeert de identificerende velden uit het antwoord van de heenweg door
   te geven; lukt dat niet, dan is de uitslag `nietBeproefd` en niet
   `geen-herstel`. Zij toetst een paar dus in het gunstigste geval -- een
   bevestiging hier is geen bewijs dat het paar ONDER ALLE OMSTANDIGHEDEN
   omkeert.

   Draaien: npm run herstelproef        (alle vermoede paren)
            npm run herstelproef -- --pad /api/agenda/toevoegen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');
const { start } = require('./lib/wegwerpserver');
const { plausibelLijf } = require('./lib/rolproef');
const wereld = require('./lib/herstelwereld');
const { opslagBeeld, inhoudsBeeld, verschil, isSpoor } = require('./droogloop');

const WORTEL = path.join(__dirname, '..');

/* De velden waarmee een terugweg zijn doelwit aanwijst. Uit het antwoord van de
   heenweg gehaald, en niet verzonnen: een terugweg die een id wil en er geen
   krijgt, geeft 404 en dat zou hier ten onrechte "herstelt niet" heten. */
/* `iban` staat erbij omdat de bankroutes daarmee hun rekening aanwijzen, en
   `adres` omdat een website dat doet. Zonder die twee gaf /api/bank/akkoord een
   antwoord waar geen enkele sleutel uit te halen viel, en heette het paar
   "niet beproefd" terwijl de rekening er gewoon stond. */
const SLEUTELVELDEN = ['id', 'code', 'nummer', 'ref', 'sleutel', 'uuid', 'iban', 'adres'];

/* Geeft de sleutels EN of ze te vertrouwen zijn. Dat tweede is geen luxe: komt
   een id uit het LAATSTE element van een lijst, dan is dat een gok -- bij een
   agenda met een item werkt hij, bij een agenda met vijf wees hij een ander
   item aan. De proef mag daarop geen BESCHULDIGING bouwen ("deze terugweg doet
   niets"); zie het gebruik van `uitLijst` verderop. */
function sleutelsMet(antwoord) {
  const uit = {};
  let uitLijst = false;
  const kijk = (o, diepte, inLijst) => {
    if (!o || typeof o !== 'object' || diepte > 3) return;
    for (const [k, v] of Object.entries(o)) {
      if (SLEUTELVELDEN.includes(k) && (typeof v === 'string' || typeof v === 'number')) {
        if (uit[k] === undefined) { uit[k] = v; if (inLijst) uitLijst = true; }
      } else if (Array.isArray(v)) { if (v.length) kijk(v[v.length - 1], diepte + 1, true); }
      else if (v && typeof v === 'object') kijk(v, diepte + 1, inLijst);
    }
  };
  kijk(antwoord, 0, false);
  return { waarden: uit, uitLijst };
}
const sleutelsUit = (antwoord) => sleutelsMet(antwoord).waarden;

/* DE ROL KOMT UIT DE METING, NIET UIT HET PAD. Wie /api/supplier/ ziet en
   daaruit "leverancier" afleidt, zit er bij elke uitzondering naast -- en een
   verkeerde rol geeft 401, wat hier `nietBeproefd` heet. IDEMPROEF.json noteert
   per route met welke rol hij bereikbaar bleek; die nemen we over.

   De eerste ronde draaide alleen als LID en zette 67 paren op nietBeproefd,
   waarvan 28 met een 401. Dat was geen eigenschap van die paren maar van de
   proef. */
function rollenUit(idemproef) {
  const uit = {};
  for (const r of (idemproef || {}).perRoute || []) if (r && r.pad && r.rol) uit[r.pad] = r.rol;
  return uit;
}

function parenUit(register, rollen) {
  const uit = [];
  const r = rollen || {};
  for (const [pad, v] of Object.entries((register || {}).per || {}))
    /* OOK DE AL BEVESTIGDE PAREN, en dat is geen dubbel werk maar de enige
       manier waarop dit register klopt. HERSTEL.json leest deze uitslag om zijn
       graad te bepalen; nam de proef alleen `vermoed`, dan verdween een
       bevestiging bij de volgende ronde uit de uitslag en daarmee uit het
       register -- een bevestiging die zichzelf opheft. En inhoudelijk: een
       terugweg die vorige maand werkte en vandaag niet meer, hoort te zakken. */
    if (v && (v.graad === 'vermoed' || v.graad === 'bevestigd') && v.tegenhanger)
      /* De rol van de HEENWEG bepaalt de sessie. Vraagt de terugweg een andere
         rol, dan geeft hij 401 en heet het paar nietBeproefd -- eerlijk, want
         een terugweg die een andere mens nodig heeft is een ander verhaal dan
         een terugweg die niet werkt. */
      uit.push({ heen: pad, terug: v.tegenhanger, rol: r[pad] || 'member' });
  return uit;
}

/* Wat de route ZEI, en niet alleen welk nummer hij gaf. Een 404 met "Die
   kamercode bestaat niet (meer)" is op te lossen; een kale 404 laat je zoeken.
   De eerste ronde had alleen het nummer, en dat kostte een probeerscript. */
function zeg(antwoord) {
  const d = antwoord && antwoord.data;
  const t = d && (d.error || d.fout || d.melding);
  return t ? String(t).slice(0, 120) : 'geen bericht';
}

async function roep(basis, pad, token, lijf) {
  try {
    const r = await fetch(basis + pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(lijf)
    });
    return { status: r.status, data: await r.json().catch(() => null) };
  } catch (e) { return { status: 0, data: null }; }
}

/* Alleen de collecties die er werkelijk toe doen: de huishouding (apiSpoor,
   handelingLog) verandert bij ELKE oproep en zou elk paar op "niet hersteld"
   zetten. Dat is dezelfde scheiding als in de droogloop, uit hetzelfde bestand. */
const domein = (lijst) => (lijst || []).filter(n => !isSpoor(n));

/* WACHTEN TOT DE OPSLAG STIL LIGT, in plaats van een vast aantal milliseconden.
   Dat is geen nettigheid maar een reparatie: /api/agenda/toevoegen kwam als
   `exact` door wanneer hij alleen draaide en als "raakte niets aan" in de volle
   ronde -- dezelfde code, dezelfde invoer, een andere uitslag. De schrijver is
   asynchroon, en onder belasting was 200 ms te kort. Een proef die van de
   drukte afhangt, meet de drukte.

   EN STILTE IS NIET GENOEG, want dat was de tweede versie van deze fout: twee
   gelijke metingen vlak na de oproep zijn allebei van VOOR de schrijfronde, en
   dan heet "er is nog niets gebeurd" ten onrechte "het is klaar". Daarom eerst
   wachten tot het beeld VERANDERT ten opzichte van vlak voor de oproep, en pas
   daarna tot het stil ligt. Verandert er niets, dan loopt de tijd af en gaat de
   proef door met wat hij ziet -- eeuwig wachten zou een hangende ronde
   opleveren, en een route die werkelijk niets doet bestaat. */
async function stilBeeld(datamap, voorBeeld, maxMs) {
  const eind = Date.now() + (maxMs || 3000);
  const voor = JSON.stringify(voorBeeld || opslagBeeld(datamap));
  let gezien = false;
  let vorig = voor;
  while (Date.now() < eind) {
    await new Promise(r => setTimeout(r, 60));
    const nu = JSON.stringify(opslagBeeld(datamap));
    if (nu !== voor) gezien = true;
    if (gezien && nu === vorig) return;
    vorig = nu;
  }
}

/* Het lijf voor een route: het plausibele lijf, met de velden die DEZE route
   eist eroverheen (scripts/lib/herstelwereld.js). Alleen vorm, nooit uitkomst. */
/* De volgorde is: plausibel, dan wat de voorbereiding opleverde, dan wat DEZE
   route eist. Het wereldlijf wint, en dat is een reparatie: `adres` is een
   sleutel, dus het adres van de vorige publicatie reisde mee en overschreef het
   verse adres -- waarna publiceren 409 "al bezet" gaf op zijn eigen vorige
   ronde. Wat een route eist, hoort boven wat er toevallig meereist. */
/* Wat de wereld eenmalig heeft uitgedeeld (de rekening van het lid) reist onder
   alles mee: het is van de wereld en niet van een paar. Een paar dat er zelf
   iets over zegt, wint. */
let WERELDSLEUTELS = {};
const lijfVoor = (pad, extra) => {
  const e = Object.assign({}, WERELDSLEUTELS, extra || {});
  return Object.assign(plausibelLijf(pad), e, wereld.lijfVoor(pad, e));
};

async function beproefPaar(srv, token, paar) {
  /* EEN PAAR DAT EEN ANDERE WERELD VRAAGT, en dat is een besluit en geen
     mislukking. Een krant vraagt een zaak met de werkvorm journalistiek, een
     stad vraagt een ingericht landpakket. Die nabouwen zou meer verzinnen dan
     meten, dus staat er wat er zou moeten bestaan -- en een eigen uitslag,
     zodat "wij hebben geen krant" niet leest als "de proef kwam er niet bij". */
  const mist = wereld.onbereikbaar(paar.heen);
  if (mist) return { ...paar, uitslag: 'wereldOntbreekt',
    reden: 'deze route vraagt ' + mist + '. De proef zet die wereld niet op: een proef die zijn ' +
      'eigen meetobject verzint, meet zichzelf' };
  /* EERST DE VOORBEREIDING, EN DIE IS DE TEGENHANGER ZELF.

     De helft van de onbeproefde paren is de OMGEKEERDE RICHTING van een paar dat
     wel werkte: /api/clips/weg -> /api/clips/maak. De heenweg is daar een
     verwijdering, en in een verse database is er niets te verwijderen -- 404, en
     de proef noemde dat "niet beproefd". Dat klopte, en het was op te lossen.

     Wat zo'n paar nodig heeft is een onderwerp, en dat maakt de tegenhanger.
     Dus draait die eerst, en zijn identificerende velden reizen mee naar de
     heenweg. Voor een maak -> weg-paar is deze ronde onschadelijk: een
     verwijdering van iets dat er niet is, doet niets en telt nergens in mee.

     Let op wat dit NIET is: de voorbereiding staat VOOR de opwarmronde en voor
     de meting. Wat zij aanricht zit dus in de nulstand en niet in de uitslag. */
  let uitVoorbereiding = {};
  const voorbereid = async () => {
    const voorRonde = opslagBeeld(srv.datamap);
    /* EERST DE TEGENHANGER, DAN DE VOORZIENING, en die volgorde is een
       reparatie. Andersom maakte de voorziening een afspraak aan en haalde de
       tegenhanger (/verwijder) hem meteen weer weg -- waarna de heenweg
       (/bewaar) niets te bewaren had. Wat de heenweg nodig heeft, moet als
       LAATSTE zijn ontstaan. */
    const rTerug = await roep(srv.basis, paar.terug, token, lijfVoor(paar.terug));
    let uit = sleutelsUit(rTerug.data);
    /* Dan het DING dat de heenweg nodig heeft en dat de tegenhanger niet maakt:
       publiceren vraagt een website, een pas sluiten vraagt een pas. Een keten
       mag: live-zetten vraagt een gepubliceerde site, publiceren een bewaarde. */
    for (const via of (wereld.voorzieningVoor(paar.heen) || [])) {
      const v = await roep(srv.basis, via, token, lijfVoor(via, uit));
      uit = Object.assign({}, uit, sleutelsUit(v.data));
    }
    /* OPTELLEN EN NIET VERVANGEN. Een voorziening die al is gebeurd, antwoordt
       de tweede keer korter: /api/bank/akkoord geeft bij de eerste oproep de
       rekening mee en daarna alleen nog "akkoord: true". De tweede
       voorbereiding wiste daarmee de iban die de eerste had opgeleverd, en de
       heenweg kreeg 404 "De rekening bestaat niet" terwijl die rekening er
       stond. Wat een keer is aangewezen, blijft aangewezen. */
    uitVoorbereiding = Object.assign({}, uitVoorbereiding, uit);
    await stilBeeld(srv.datamap, voorRonde);
  };
  await voorbereid();

  /* EEN OPWARMRONDE, EN DIE IS GEEN FORMALITEIT. In een verse database BESTAAT
     de collectie `agendas` nog niet. Voegt de heenweg het eerste item toe en
     haalt de terugweg het weer weg, dan is de collectie daarna leeg maar
     AANWEZIG -- en dat is per definitie een andere inhoud dan "er was niets".
     Zonder deze ronde heette elk paar `compensatie` en was `exact` structureel
     onbereikbaar: een hoogste graad die niemand ooit kan halen, is geen graad.
     De opwarmronde laat de collectie ontstaan; pas daarna begint de meting. */
  const heenLijf = () => lijfVoor(paar.heen, uitVoorbereiding);
  const voorOpwarming = opslagBeeld(srv.datamap);
  await roep(srv.basis, paar.heen, token, heenLijf());
  await stilBeeld(srv.datamap, voorOpwarming);
  /* NOG EEN KEER, want de opwarmronde heeft het onderwerp opgebruikt: bij een
     verwijder -> maak-paar staat er na de opwarming weer niets. De nulstand
     hoort de wereld te zijn waarin de heenweg IETS kan doen. */
  await voorbereid();

  const s0i = inhoudsBeeld(srv.datamap), s0v = opslagBeeld(srv.datamap);
  const heen = await roep(srv.basis, paar.heen, token, heenLijf());
  await stilBeeld(srv.datamap, s0v);
  const s1i = inhoudsBeeld(srv.datamap), s1v = opslagBeeld(srv.datamap);

  const heenRaakte = domein(verschil(s0v, s1v));
  if (heen.status < 200 || heen.status >= 300 || !heenRaakte.length)
    return { ...paar, uitslag: 'nietBeproefd', heenStatus: heen.status, geraakt: heenRaakte,
      reden: heen.status < 200 || heen.status >= 300
        ? 'de heenweg gaf status ' + heen.status + ' (' + zeg(heen) + '): er is niets gebeurd om terug te draaien'
        : 'de heenweg draaide maar raakte geen enkele domeincollectie aan; er valt niets om te keren' };

  /* De terugweg krijgt OOK mee wat de voorbereiding opleverde. Publiceren
     antwoordt met een adres en niet met het id van de website, dus zonder dit
     wees /api/site/offline nergens heen -- en dat las als "de terugweg werkt
     niet" terwijl het lijf niets aanwees. */
  const heenSleutel = sleutelsMet(heen.data);
  const lijf = lijfVoor(paar.terug, Object.assign({}, uitVoorbereiding, heenSleutel.waarden));
  const terug = await roep(srv.basis, paar.terug, token, lijf);
  await stilBeeld(srv.datamap, s1v);
  const s2i = inhoudsBeeld(srv.datamap), s2v = opslagBeeld(srv.datamap);

  /* Alleen wat de HEENWEG aanraakte telt mee voor de vraag of de terugweg werk
     deed. Raakt de terugweg iets heel anders aan (een teller, een logboek van
     een ander domein), dan is dat geen herstel van dit paar -- en het zou een
     paar dat niets terugdraait ten onrechte `compensatie` noemen. */
  const terugRaakte = domein(verschil(s1v, s2v)).filter(n => heenRaakte.includes(n));
  if (terug.status < 200 || terug.status >= 300)
    return { ...paar, uitslag: 'nietBeproefd', heenStatus: heen.status, terugStatus: terug.status,
      geraakt: heenRaakte,
      reden: 'de terugweg gaf status ' + terug.status + ' (' + zeg(terug) + '); waarschijnlijk wees het lijf niet het ' +
        'ding aan dat de heenweg maakte. Dat is een tekort van deze proef en geen oordeel over het paar' };

  /* Terug op de oude inhoud? Alleen kijken naar wat de heenweg aanraakte: dat
     een andere collectie ondertussen bewoog, zegt niets over dit paar. */
  const nietTerug = heenRaakte.filter(n => s2i[n] !== s0i[n]);
  if (!nietTerug.length)
    return { ...paar, uitslag: 'exact', heenStatus: heen.status, terugStatus: terug.status,
      geraakt: heenRaakte,
      reden: 'na de terugweg is de inhoud van elke geraakte collectie letterlijk terug op de oude waarde' };
  if (terugRaakte.length)
    return { ...paar, uitslag: 'compensatie', heenStatus: heen.status, terugStatus: terug.status,
      geraakt: heenRaakte, nietTerug,
      reden: 'de terugweg deed werk, maar ' + nietTerug.length + ' collectie(s) staan niet terug op ' +
        'de oude inhoud. Een geldige vorm van herstel, en geen exacte omkering' };
  /* EEN BESCHULDIGING VRAAGT ZEKERHEID. "Deze terugweg doet niets" zeggen op
     grond van een id dat uit het laatste element van een lijst is gevist, is een
     gok met een oordeel eraan vast -- en precies dat gebeurde: het agendapaar
     kwam alleen als `exact` door en in de volle ronde als `geen-herstel`, omdat
     het geraden id een ander item aanwees. Was de sleutel een gok, dan is de
     eerlijke uitslag dat de proef het niet weet. */
  if (heenSleutel.uitLijst)
    return { ...paar, uitslag: 'nietBeproefd', heenStatus: heen.status, terugStatus: terug.status,
      geraakt: heenRaakte,
      reden: 'de terugweg veranderde niets, maar het ding dat hij moest aanwijzen is GERADEN uit het ' +
        'laatste element van een lijst. Daarop een oordeel bouwen zou een beschuldiging op een gok zijn' };
  return { ...paar, uitslag: 'geen-herstel', heenStatus: heen.status, terugStatus: terug.status,
    geraakt: heenRaakte, nietTerug,
    reden: 'de terugweg gaf ' + terug.status + ' en veranderde niets; de naam belooft een omkering ' +
      'die de handeling niet uitvoert' };
}

async function main() {
  const register = JSON.parse(fs.readFileSync(path.join(WORTEL, 'HERSTEL.json'), 'utf8'));
  const idemproef = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(WORTEL, 'IDEMPROEF.json'), 'utf8')); }
    catch (e) { return null; }
  })();
  let paren = parenUit(register, rollenUit(idemproef));
  const i = process.argv.indexOf('--pad');
  if (i >= 0 && process.argv[i + 1]) {
    /* Een voorvoegsel mag: --pad /api/agenda beproeft alle agendaparen, en dat
       is precies wat je wilt als een paar alleen WEL werkt en in de volle ronde
       niet -- dan zit het verschil in wat een ander paar achterliet. */
    const wens = process.argv[i + 1];
    paren = paren.filter(p => p.heen === wens || p.heen.startsWith(wens + '/'));
  }
  console.log('DE HERSTELPROEF\n');
  console.log('  ' + paren.length + ' vermoed(e) paren, uitgevoerd tegen een wegwerpserver\n');

  /* EEN RONDE = EEN VERSE SERVER. Als functie, want er zijn er twee: de volle
     ronde, en daarna een tweede voor wat toen niet lukte. */
  async function ronde(lijst) {
    const srv = await start({ naam: 'herstelproef', gereed: 'ready',
      env: { NODE_ENV: 'test', RTG_DEMO: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF' } });
    const uitslagen = [];
    try {
      /* DRIE SESSIES, EN EEN ONTBREKENDE IS EEN FOUT. Een rol die niet inlogt en
         waarvan de paren dan "niet beproefd" heten, zou de proef laten lijken op
         een die keek. Zij stopt liever. */
      const aanmeld = async (pad, lijf) => {
        const r = await fetch(srv.basis + pad, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lijf)
        }).then(async x => ({ status: x.status, data: await x.json().catch(() => null) })).catch(() => ({ status: 0, data: null }));
        return { token: r.data && r.data.token, status: r.status };
      };
      const sessies = {
        member: await aanmeld('/api/login', { tier: 'rtg' }),
        office: await aanmeld('/api/office/login', { code: 'RTG-OFFICE-PROEF' }),
        supplier: await aanmeld('/api/supplier/login', { username: 'rahul', password: 'Imran' })
      };
      const nodig = [...new Set(lijst.map(p => p.rol))];
      const mist = nodig.filter(r => !(sessies[r] && sessies[r].token));
      if (mist.length) throw new Error('geen sessie voor: ' + mist.map(r =>
        r + ' (status ' + ((sessies[r] || {}).status) + ')').join(', ') +
        ' -- dan zouden hun paren "niet beproefd" heten terwijl de proef zelf de reden is');

      const voorWereld = opslagBeeld(srv.datamap);
      const klaar = await wereld.zetWereldKlaar({
        roep: (pad, tok, lijf) => roep(srv.basis, pad, tok, lijf),
        tokens: { member: sessies.member.token, office: sessies.office.token, supplier: sessies.supplier.token },
        aanmeld
      });
      /* Wachten tot de wereld op schijf staat. Zonder dit was de rekening van
         het tweede lid er wel volgens het antwoord, maar nog niet volgens de
         route die hem opzoekt -- "De tegenrekening bestaat niet" op een IBAN
         die op dat moment werd weggeschreven. */
      await stilBeeld(srv.datamap, voorWereld);
      WERELDSLEUTELS = klaar.sleutels || {};
      if (klaar.gedaan.length) console.log('  wereld klaargezet: ' + klaar.gedaan.join(', ') + '\n');

      for (const paar of lijst) {
        const u = await beproefPaar(srv, sessies[paar.rol].token, paar);
        uitslagen.push(u);
        console.log('  ' + u.uitslag.padEnd(14) + paar.rol.padEnd(9) + paar.heen + '  ->  ' + paar.terug);
      }
    } finally { try { srv.klaar(); } catch (e) {} }
    return uitslagen;
  }

  const uitslagen = await ronde(paren);

  /* EEN TWEEDE RONDE OP EEN VERSE SERVER, voor wat niet lukte. Dit is geen
     tweede kans maar een MEETPUNT: /api/staff/mob/cdt/aanmelden kwam als
     `compensatie` door wanneer hij alleen draaide, en als 503 "deze functie is
     voor dit genre uitgeschakeld" in de volle ronde. Een eerder paar had de
     wereld veranderd waarin een later paar moest draaien.

     Zulke volgorde-afhankelijkheid stil laten staan zou betekenen dat de uitslag
     afhangt van de volgorde van routenamen. Wat in ronde twee wel lukt, draagt
     daarom `ordeAfhankelijk: true` -- de uitslag telt, en erbij staat dat een
     ander paar hem in de weg zat. */
  /* ELK PAAR OP ZIJN EIGEN SERVER, en dat is de tweede reparatie van hetzelfde
     probleem. De eerste tweede-ronde zette de overgebleven paren samen op een
     verse server, en toen bleef /api/staff/mob/cdt/aanmelden 503 -- want in die
     kleine ronde stonden dezelfde stoorzenders. Isolatie is pas isolatie bij
     een paar per server. Begrensd op MAX_TWEEDE, want dit kost een start per
     paar; loopt de rest daarboven, dan staat dat in de uitslag. */
  const MAX_TWEEDE = 24;
  const rest = uitslagen.filter(u => u.uitslag === 'nietBeproefd');
  const opnieuwGedaan = rest.slice(0, MAX_TWEEDE);
  if (opnieuwGedaan.length) {
    console.log('\n  ' + opnieuwGedaan.length + ' paar/paren opnieuw, elk op zijn EIGEN verse server\n');
    for (const u of opnieuwGedaan) {
      const [n] = await ronde([{ heen: u.heen, terug: u.terug, rol: u.rol }]);
      if (!n || n.uitslag === 'nietBeproefd') continue;
      const i = uitslagen.findIndex(x => x.heen === n.heen);
      if (i >= 0) uitslagen[i] = Object.assign({}, n, { ordeAfhankelijk: true,
        reden: n.reden + '. In de volle ronde lukte dit niet, alleen op een eigen server: een ander ' +
          'paar had de wereld veranderd waarin dit paar moest draaien' });
    }
  }
  const buitenTweedeRonde = Math.max(0, rest.length - MAX_TWEEDE);

  const tel = (n) => uitslagen.filter(u => u.uitslag === n).length;

  const uit = {
    uitleg: 'Vermoede tegenhangers uit HERSTEL.json, werkelijk uitgevoerd: heen, kijken, terug, kijken. ' +
      'Alleen `exact` en `compensatie` zijn een uitspraak over het paar; de rest is een tekort van de proef.',
    gemeten: { paren: paren.length, exact: tel('exact'), compensatie: tel('compensatie'),
      geenHerstel: tel('geen-herstel'), nietBeproefd: tel('nietBeproefd'),
      wereldOntbreekt: tel('wereldOntbreekt'),
      ordeAfhankelijk: uitslagen.filter(u => u.ordeAfhankelijk).length,
      buitenTweedeRonde },
    per: uitslagen,
    grenzen: [
      'de proef weet niet WELK ding de terugweg moet aanwijzen; zij geeft de identificerende velden uit ' +
        'het antwoord van de heenweg door, en faalt dat, dan is de uitslag nietBeproefd en geen oordeel',
      'een paar wordt in het gunstigste geval beproefd: meteen erna, door dezelfde gebruiker, met een ' +
        'vers gemaakt ding. Een bevestiging hier zegt niets over een terugweg een week later',
      'exact en compensatie zijn niet hetzelfde, en worden nooit samengeteld: een creditnota wist geen factuur',
      'de huishouding (apiSpoor, handelingLog) blijft buiten het oordeel; die verandert bij elke oproep',
      'de volle ronde is NIET onafhankelijk: een paar kan de wereld veranderen waarin een later paar ' +
        'draait. Wat in de volle ronde niet lukte, is daarom nog een keer alleen op een eigen server ' +
        'gedraaid; lukt het dan wel, dan staat `ordeAfhankelijk` erbij en geldt die uitslag',
      'de opwarmronde kan een EENMALIG gevolg opslokken: kost de eerste aanmaak iets (een kostenregel, ' +
        'een eerste inrichting), dan gebeurt dat in de opwarmronde en ziet de meting het niet. `exact` ' +
        'betekent hier dus: exact bij een tweede en volgende uitvoering. Zonder die ronde was `exact` ' +
        'onbereikbaar, dus dit is een gekozen ruil en geen vergissing -- /api/meet/maak stond in de ' +
        'eerste ronde op compensatie met `kosten` als reden, en staat er nu op exact'
    ]
  };
  Object.assign(uit, { stempel: stempel() });
  fs.writeFileSync(path.join(WORTEL, 'HERSTELPROEF.json'), JSON.stringify(uit, null, 1) + '\n');
  console.log('\n  exact ' + tel('exact') + ' | compensatie ' + tel('compensatie') +
    ' | geen-herstel ' + tel('geen-herstel') + ' | niet beproefd ' + tel('nietBeproefd') +
    ' | andere wereld nodig ' + tel('wereldOntbreekt'));
  console.log('\nHERSTELPROEF.json geschreven.');
}

if (require.main === module) main().catch(e => { console.error('herstelproef: ' + e.message); process.exit(1); });
module.exports = { parenUit, rollenUit, sleutelsUit, sleutelsMet, beproefPaar };
