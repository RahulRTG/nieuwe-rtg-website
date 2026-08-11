/* ============================================================================
   DE KETEN -- een journaal waarvan het verleden niet stil te herschrijven is.

   WAAROM DIT ER IS. Een auditlog beantwoordt één vraag: wat is er gebeurd. Dat
   antwoord is precies zoveel waard als de zekerheid dat niemand het achteraf
   heeft bijgesteld -- en die zekerheid had dit huis niet. Wie bij de database
   kan, kan een regel wijzigen of weghalen, en er is niets dat daarna nog
   afwijkt. Juist bij het inzagejournaal is dat ernstig: dat is het spoor van wie
   de identiteitskluis heeft geopend, en de enige plek waar een betrokkene kan
   nalezen wie zijn naam heeft opgezocht.

   HOE. Elke regel draagt de hash van de vorige. Verander regel 1 achteraf, dan
   klopt de hash die regel 2 van hem bewaart niet meer, en breekt de keten op een
   aanwijsbaar punt. Wissen valt op dezelfde manier op: de opvolger verwijst naar
   iets wat er niet meer is.

   WAT DIT WEL EN NIET TEGENHOUDT, en dat verschil is de hele eerlijkheid van
   deze module:

   - Het houdt STILLE wijziging tegen. Zichtbare niet: wie bij de database kan,
     kan de hele keten opnieuw uitrekenen en er weer een kloppend geheel van
     maken. Daarvoor moet de TOP van de keten periodiek naar buiten -- naar een
     fysiek gescheiden systeem, of publiek. Zolang dat niet gebeurt, bewijst deze
     keten dat er niet PER ONGELUK iets is verschoven en dat een half werk
     opvalt; niet dat een vastberaden beheerder is tegengehouden.
   - Het maakt de regels niet geheim. Een hash beschermt de VOLGORDE en de
     INHOUD tegen verandering, niet tegen meelezen.

   TWEE DINGEN DIE UIT ELKAAR MOETEN, en dit is het belangrijkste onderscheid in
   dit bestand:

     LOKALE KETENINTEGRITEIT   klopt de overgebleven geschiedenis met zichzelf?
     EXTERNE VERANKERING       is de geschiedenis nog even LANG als hij was?

   Alleen het eerste kan een journaal over zichzelf vaststellen, en het is
   verleidelijk om te denken dat dat genoeg is. Dat is het niet. Wie de nieuwste
   K regels weggooit, houdt een keten over die van voor naar achter perfect
   klopt: elke regel wijst naar een voorganger die er nog is, elke hash klopt met
   zijn inhoud. Er is lokaal NIETS wat daar tegenin gaat -- geen teller, geen
   hoogwatermerk, geen volgnummer -- want alles wat je ernaast zet, staat in
   dezelfde database als wat je wil beschermen en is door dezelfde hand te
   wijzigen. Dat is geen tekortkoming van deze implementatie maar een grens van
   het middel.

   Sporen wissen van wat je zojuist deed is dus precies de aanval waar een
   losse hashketen niet tegen beschermt. Daarvoor moet er één getal NAAR BUITEN:
   verankerPunt() maakt dat getal, verifieerTegenAnker() rekent ermee af. Zolang
   niemand dat getal wegzet, bewijst deze module dat er niet PER ONGELUK iets is
   verschoven en dat half werk opvalt -- niet dat een vastberaden beheerder is
   tegengehouden.

   HET VOLGNUMMER bestaat alleen voor dat afrekenen. Lokaal voegt het niets toe
   (wie de kop afknipt, knipt de hoge nummers gewoon mee weg); tegen een anker
   is het het verschil tussen "er is iets weg" en "ik weet hoeveel".

   OVER DE AFKAP. Een begrensd journaal (het inzagejournaal houdt er 5000)
   verliest zijn oudste regels. De keten breekt dan bij de oudste die er nog is,
   en dat is geen fout maar een grens: verifieer() meldt hem apart als
   `afgekapt` en niet als `gebroken`. Zou hij dat door elkaar halen, dan stond de
   controle na 5000 regels voor altijd rood en zette iemand hem uit.
   ========================================================================== */
'use strict';
const crypto = require('crypto');

/* WAT ER GEHASHT WORDT. Sleutels op alfabetische volgorde, zodat dezelfde regel
   altijd dezelfde hash geeft ongeacht in welke volgorde de velden zijn gezet --
   anders breekt de keten op een herschikking die niets betekent. Het veld `hash`
   telt niet mee (dat is de uitkomst zelf); `vorige` WEL, want de link is nu juist
   het stuk dat niet mag schuiven. */
function kanoniek(regel) {
  const uit = {};
  for (const k of Object.keys(regel || {}).sort()) {
    if (k === 'hash') continue;
    uit[k] = regel[k];
  }
  return JSON.stringify(uit);
}

/* De hash van één schakel. Kort gehouden (32 tekens): lang genoeg om botsing
   uit te sluiten voor dit doel, kort genoeg om een journaalregel leesbaar te
   houden voor wie hem met het blote oog naleest. */
function hashVan(regel) {
  return crypto.createHash('sha256').update(kanoniek(regel)).digest('hex').slice(0, 32);
}

/* Een regel aan de keten hangen. Geeft de regel MET vorige en hash terug; de
   invoer blijft ongemoeid, zodat een aanroeper die zijn object nog gebruikt
   geen halve regel in handen houdt. */
function schakel(regel, vorigeHash, nr) {
  const met = { ...regel, vorige: vorigeHash || null, nr: Number(nr) || 0 };
  return { ...met, hash: hashVan(met) };
}

/* Een regel aan een BESTAAND journaal hangen (nieuwste vooraan). Doet in één
   handeling wat elke aanroeper anders zelf moet uitrekenen -- de vorige hash en
   het volgnummer -- want die twee uit elkaar laten lopen is stil en fataal. */
function hangAan(regels, regel) {
  const l = Array.isArray(regels) ? regels : [];
  const nieuwste = l.find(r => r && r.hash) || null;
  return schakel(regel, nieuwste ? nieuwste.hash : null, nieuwste ? (Number(nieuwste.nr) || 0) + 1 : 1);
}

/* De hele keten nalopen. `regels` staat NIEUWSTE EERST -- dat is hoe het
   inzagejournaal hem bewaart (unshift), en een verifieerder die stilletijk een
   andere volgorde aanneemt, keurt alles goed.

   Geeft terug:
     ok         niets mis
     gebroken   [{index, waarom}] -- hier klopt het niet meer
     afgekapt   de oudste regel verwijst naar een voorganger die weggevallen is;
                normaal bij een begrensd journaal, dus apart gemeld
     zonderKeten hoeveel regels nog helemaal geen hash dragen (oude regels van
                voor deze voorziening; die veroordelen we niet) */
function verifieer(regels) {
  const l = Array.isArray(regels) ? regels : [];
  const gebroken = [];
  let zonderKeten = 0, afgekapt = false;

  for (let i = 0; i < l.length; i++) {
    const r = l[i];
    if (!r || !r.hash) { zonderKeten++; continue; }

    /* 1. Klopt de regel met zijn eigen hash? Zo niet, dan is de INHOUD veranderd. */
    if (hashVan(r) !== r.hash) {
      gebroken.push({ index: i, waarom: 'de inhoud van deze regel klopt niet met zijn hash' });
      continue;
    }

    /* 2. Klopt de verwijzing naar de voorganger? De voorganger van regel i staat
       op i+1: de lijst loopt van nieuw naar oud. */
    const ouder = l[i + 1];
    if (!ouder) {
      /* De oudste die er nog is. Verwijst hij naar een voorganger, dan is die
         weggevallen -- de afkap, geen breuk. */
      if (r.vorige) afgekapt = true;
      continue;
    }
    if (!ouder.hash) { continue; }   // de keten begint hier; niets te vergelijken
    if (r.vorige !== ouder.hash) {
      gebroken.push({ index: i, waarom: 'verwijst niet naar de regel eronder -- er is iets tussenuit of veranderd' });
    }
  }

  return { ok: gebroken.length === 0, gebroken, afgekapt, zonderKeten, geteld: l.length };
}

/* De TOP van de keten: de hash van de nieuwste regel. Dit is het ene getal dat
   naar buiten moet om de keten echt onherschrijfbaar te maken -- zie de kop.
   Publiceer je hem, dan kan niemand het verleden meer opnieuw uitrekenen zonder
   dat het opvalt. */
function top(regels) {
  const l = Array.isArray(regels) ? regels : [];
  for (const r of l) if (r && r.hash) return r.hash;
  return null;
}

/* Wat deze control is, voor TOEZICHT.md. Het veld `grens` is verplicht en staat
   hier niet voor de vorm: wie hem weglaat, laat een control bij het mappen naar
   een wettelijke eis onvermijdelijk te ruim lezen. */
const CONTROL = {
  control: 'AUDIT-KETEN-LOKAAL',
  wat: 'wijziging en verwijdering MIDDEN in het auditspoor breken de keten aantoonbaar',
  eigenaar: 'Security',
  bewijs: ['test/keten.test.js'],
  bewijsstuk: 'de ketenhash van het journaal (inzagelog.ketenTop())',
  grens: 'ziet uitsluitend wat er BINNEN het overgebleven journaal niet klopt. Wie de ' +
    'NIEUWSTE regels weggooit, houdt een perfect kloppende keten over -- sporen wissen ' +
    'van wat je zojuist deed valt hier dus niet op. Daarvoor is AUDIT-KETEN-VERANKERD ' +
    'nodig, en die is nog niet in bedrijf.'
};

module.exports = { schakel, hangAan, verifieer, top, hashVan, kanoniek, CONTROL };
