/* HET REISGEZELSCHAP -- de mensen rond ÉÉN reis.

   Dit is niet "vrienden" en niet "een tijdlijn". Het is de kleine kring die bij
   deze ene reis hoort: wie meereist, en wie meeleeft. Die twee zien met opzet
   niet hetzelfde, en dat verschil is de hele module.

   DE POORT IS HET PRODUCT. Niet het scherm, niet de tijdlijn: `zicht()`. Elke
   uitgifte van een reis aan iemand anders dan de reiziger gaat daar langs, en
   hij werkt met een WITTE LIJST -- per rol staat opgeschreven welke velden
   meegaan. Een veld dat morgen aan een reisonderdeel wordt toegevoegd (een
   stoelnummer, een adres, een prijs) komt er dus NIET vanzelf bij. Dat is de
   enige richting die veilig is: een zwarte lijst vergeet je een keer, en dan
   staat er een boekingsnummer op het scherm van iemands schoonmoeder.

   WIE WAT ZIET (en test/reisgezelschap.test.js houdt deze tabel eerlijk):

     van de reis            eigenaar   reisgenoot        meekijker
     bestemming, periode    ja         ja                ja
     draaiboek en tijden    ja         ja                nee
     kenmerk (boeking)      ja         nee               nee
     prijs, documenten      ja         nee               nee
     aankomstmelding        ja         ja                als hij aanstaat
     wat de reiziger deelt  ja         ja                ja

   DRIE GRENZEN DIE UIT LIFE.md PAR. 4 KOMEN EN HIER VORM KRIJGEN:

   1. WAT EEN TWEEDE PERSOON BEREIKT, BEVESTIGT EEN MENS. Een uitnodiging staat
      op `gevraagd` en doet niets tot de ANDER hem aanvaardt. Niemand wordt in
      een gezelschap gezet.
   2. ER IS GEEN LIVE LOCATIE, en dat is een besluit en geen ontbrekende
      functie. Een reiziger deelt een MOMENT ("ik ben er"); er loopt geen stip
      mee. Daarom kent deze module geen coördinaten -- ook niet als veld.
   3. ER KOMT GEEN CIJFER OP HET LEVEN TUSSEN MENSEN. Geen likes, geen teller
      wie het meest kijkt, geen volgorde op betrokkenheid. De tijdlijn is een
      tijdlijn: op tijd gesorteerd, en verder niets.

   INTREKKEN WERKT ECHT. Wie eruit gaat, ziet niets meer -- ook niet wat er
   eerder stond. Dat kan alleen omdat de tijdlijn bij de REIS hoort en niet bij
   de kijker: er is geen kopie in een postvak van iemand anders.

   EN ER KOMEN GEEN NAMEN IN. Een gezelschapslid staat hier met zijn CODENAAM,
   zoals overal buiten de identiteitskluis (CLAUDE.md). */
'use strict';

const klok = require('../lib/klok');

const ROLLEN = ['reisgenoot', 'meekijker'];
const STANDEN = ['gevraagd', 'aanvaard'];
const MAX_TEKST = 1200;
const MAX_LEDEN = 30;

/* WAT ER PER ROL MEEGAAT -- de witte lijst uit de kop, als code.
   Van een REIS zelf, en van een ONDERDEEL apart: een onderdeel draagt het
   kenmerk (het boekingsnummer) en dat is precies wat nooit naar buiten mag. */
const REISVELDEN = {
  eigenaar: ['id', 'bestemming', 'venster', 'personen', 'sig', 'telling', 'grond', 'apps', 'herkomsten'],
  reisgenoot: ['id', 'bestemming', 'venster', 'personen', 'sig', 'telling'],
  meekijker: ['id', 'bestemming', 'venster']
};
const ONDERDEELVELDEN = {
  eigenaar: null,                                   // alles, het is zijn eigen reis
  reisgenoot: ['soort', 'titel', 'bestemming', 'van', 'tot', 'sig'],
  meekijker: []                                     // geen draaiboek: de lijst blijft leeg
};

module.exports.maakReisgezelschap = ({ db, save, crypto, mijnReizen, codenaamVan, keyVanCodenaam, bestandenDeel }) => {
  const nu = () => klok.datum().toISOString();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);
  const naam = (key) => (typeof codenaamVan === 'function' ? codenaamVan(key) : null) || key;

  const eigen = require('./eigencollectie')({
    db, domein: 'kern/reisgezelschap',
    bezit: { reisGezelschap: 'lijst', reisTijdlijn: 'lijst', reisDeelbeleid: 'kaart' }
  });
  const leden = () => eigen.bak('reisGezelschap');
  const posts = () => eigen.bak('reisTijdlijn');
  const beleidBak = () => eigen.bak('reisDeelbeleid');

  const reisVan = (key, reisId) => (mijnReizen(key).reizen || []).find(r => r.id === reisId) || null;

  /* De rol van een KIJKER bij een reis van een ander. `null` = hij hoort er
     niet bij, en dan bestaat de reis voor hem niet -- geen 403 met inhoud
     eromheen, maar niets. */
  function rolVan(reisId, eigenaarKey, kijkerKey) {
    if (kijkerKey === eigenaarKey) return 'eigenaar';
    const l = leden().find(x => x.reis === reisId && x.eigenaar === eigenaarKey
      && x.lid === kijkerKey && x.stand === 'aanvaard');
    return l ? l.rol : null;
  }

  /* DE POORT. Geeft terug wat deze rol van deze reis mag zien -- opgebouwd uit
     de witte lijst, dus wat er niet in staat, gaat niet mee. */
  function zicht(reis, rol) {
    if (!reis || !REISVELDEN[rol]) return null;
    const uit = {};
    for (const veld of REISVELDEN[rol]) if (reis[veld] !== undefined) uit[veld] = reis[veld];
    const velden = ONDERDEELVELDEN[rol];
    if (velden === null) uit.onderdelen = reis.onderdelen || [];
    else {
      uit.onderdelen = (reis.onderdelen || []).map((o) => {
        const d = {};
        for (const veld of velden) if (o[veld] !== undefined) d[veld] = o[veld];
        return d;
      }).filter(o => Object.keys(o).length);
    }
    uit.rol = rol;
    /* Wat deze rol NIET ziet, staat er met zoveel woorden bij. Een meekijker
       die een lege lijst krijgt hoort te weten dat er iets is en dat hij het
       niet ziet -- anders lijkt de reis leeg (BESTUUR.md: niet vast te stellen
       is een uitslag, geen stilte). */
    uit.nietZichtbaar = rol === 'eigenaar' ? []
      : rol === 'reisgenoot' ? ['boekingskenmerken', 'prijzen', 'documenten']
        : ['draaiboek', 'tijden', 'boekingskenmerken', 'prijzen', 'documenten'];
    return uit;
  }

  /* UITNODIGEN. Zet een verzoek klaar; de ander aanvaardt het zelf. */
  /* EEN CODENAAM IS GEEN SLEUTEL. Dit stond hier eerst wel zo: de opgegeven
     codenaam werd bewaard en later vergeleken met de SESSIESLEUTEL van de
     kijker. Dat kan alleen kloppen als een lid de sleutel van een ander kent --
     en die kent hij niet, dus de uitnodiging kwam nooit aan. De vertaling
     hoort hier, één keer, langs `keyVanCodenaam` uit de ledengids (kern/gids.js) --
     er komt geen tweede manier bij om iemand op te zoeken. */
  async function nodigUit(key, reisId, codenaam, rol) {
    const reis = reisVan(key, reisId);
    if (!reis) return { status: 404, error: 'Deze reis staat niet bij u.' };
    if (!ROLLEN.includes(rol)) return { status: 400, error: 'Kies reisgenoot of meekijker.' };
    const gevraagd = schoon(codenaam, 60);
    if (!gevraagd) return { status: 400, error: 'Geef de codenaam van de persoon die u uitnodigt.' };
    const treffer = typeof keyVanCodenaam === 'function' ? await keyVanCodenaam(gevraagd) : null;
    const lid = treffer && treffer.key;
    if (!lid) return { status: 404, error: 'Er is geen lid met de codenaam ' + gevraagd + '.' };
    if (lid === key) return { status: 400, error: 'U staat zelf al bij deze reis.' };
    const rij = leden().filter(x => x.reis === reisId && x.eigenaar === key);
    if (rij.length >= MAX_LEDEN) return { status: 400, error: 'Een gezelschap telt maximaal ' + MAX_LEDEN + ' mensen.' };
    const bestaat = rij.find(x => x.lid === lid);
    if (bestaat) return { status: 409, error: 'Deze persoon staat al in het gezelschap (' + bestaat.stand + ').' };
    const rec = {
      id: 'G-' + crypto.randomBytes(4).toString('hex'),
      reis: reisId, eigenaar: key, eigenaarCodenaam: naam(key),
      lid, lidCodenaam: treffer.codename || gevraagd,
      rol, stand: 'gevraagd', gevraagdOp: nu(), aanvaardOp: null
    };
    leden().push(rec); save();
    return { status: 200, ok: true, lid: toon(rec) };
  }

  /* AANVAARDEN doet de uitgenodigde zelf, en niemand anders. */
  function antwoord(key, id, ja) {
    const rec = leden().find(x => x.id === id && x.lid === key);
    if (!rec) return { status: 404, error: 'Geen openstaande uitnodiging.' };
    if (rec.stand !== 'gevraagd') return { status: 409, error: 'Deze uitnodiging is al afgehandeld.' };
    if (!ja) {
      db.data.reisGezelschap = leden().filter(x => x !== rec); save();
      return { status: 200, ok: true, stand: 'geweigerd' };
    }
    rec.stand = 'aanvaard'; rec.aanvaardOp = nu(); save();
    return { status: 200, ok: true, stand: 'aanvaard' };
  }

  /* INTREKKEN. Door de eigenaar (iemand eruit), of door het lid zelf (weggaan).
     In beide gevallen verdwijnt de toegang tot alles -- ook tot wat er eerder
     stond, want er is geen kopie elders. */
  async function verwijder(key, id) {
    const rec = leden().find(x => x.id === id && (x.eigenaar === key || x.lid === key));
    if (!rec) return { status: 404, error: 'Niet gevonden.' };
    db.data.reisGezelschap = leden().filter(x => x !== rec); save();
    /* EN DE BEELDEN GAAN MEE. Wie de tijdlijn kwijtraakt maar de fotos houdt,
       is niet weggehaald; dat is een halve waarheid en die is erger dan geen.
       De deellaag van de kluis is hier de baas -- wij zetten alleen de
       codenaam uit de lijst van elk beeld van deze reis. */
    const codenaam = rec.lidCodenaam || naam(rec.lid);
    if (typeof bestandenDeel === 'function') {
      const beelden = posts().filter(p => p.reis === rec.reis && p.eigenaar === rec.eigenaar && p.bestand);
      for (const p of beelden) {
        try { await bestandenDeel(rec.eigenaar, p.bestand, codenaam, false); } catch (e) { /* de kluis meldt zelf */ }
      }
    }
    return { status: 200, ok: true, beeldenIngetrokken: true };
  }

  const toon = (x) => ({
    id: x.id, reis: x.reis, codenaam: x.lidCodenaam || naam(x.lid), rol: x.rol, stand: x.stand,
    gevraagdOp: x.gevraagdOp, aanvaardOp: x.aanvaardOp
  });

  /* HET GEZELSCHAP van een reis. Alleen de eigenaar en aanvaarde leden zien
     wie erbij zit; een openstaande uitnodiging is alleen zichtbaar voor de
     eigenaar en voor de gevraagde zelf. */
  function gezelschap(key, reisId) {
    const eigenaar = reisVan(key, reisId);
    if (eigenaar) {
      return { status: 200, ok: true, rol: 'eigenaar',
        leden: leden().filter(x => x.reis === reisId && x.eigenaar === key).map(toon) };
    }
    const mijn = leden().find(x => x.reis === reisId && x.lid === key && x.stand === 'aanvaard');
    if (!mijn) return { status: 404, error: 'Deze reis staat niet bij u.' };
    return { status: 200, ok: true, rol: mijn.rol,
      leden: leden().filter(x => x.reis === reisId && x.eigenaar === mijn.eigenaar && x.stand === 'aanvaard').map(toon) };
  }

  /* WAT IEMAND VAN EEN REIS ZIET. Voor de eigenaar zijn eigen reis; voor een
     ander de reis van de eigenaar, door de poort. */
  function reisVoor(key, reisId) {
    const eigen = reisVan(key, reisId);
    if (eigen) return { status: 200, ok: true, reis: zicht(eigen, 'eigenaar') };
    const mijn = leden().find(x => x.reis === reisId && x.lid === key && x.stand === 'aanvaard');
    if (!mijn) return { status: 404, error: 'Deze reis staat niet bij u.' };
    const bron = reisVan(mijn.eigenaar, reisId);
    if (!bron) return { status: 404, error: 'De reis bestaat niet meer.' };
    return { status: 200, ok: true, reis: zicht(bron, mijn.rol), van: mijn.eigenaarCodenaam || naam(mijn.eigenaar) };
  }

  /* DE TIJDLIJN. Eén per reis, gedeeld door het hele gezelschap. Op tijd
     gesorteerd -- er komt geen volgorde op betrokkenheid. */
  function schrijf(key, reisId, tekst) {
    const t = schoon(tekst, MAX_TEKST);
    if (!t) return { status: 400, error: 'Schrijf eerst iets.' };
    const eigen = reisVan(key, reisId);
    const mijn = eigen ? null : leden().find(x => x.reis === reisId && x.lid === key && x.stand === 'aanvaard');
    if (!eigen && !mijn) return { status: 403, error: 'U hoort niet bij deze reis.' };
    const post = {
      id: 'P-' + crypto.randomBytes(4).toString('hex'),
      reis: reisId, eigenaar: eigen ? key : mijn.eigenaar,
      door: key, doorCodenaam: naam(key), rol: eigen ? 'eigenaar' : mijn.rol,
      tekst: t, at: nu()
    };
    posts().push(post); save();
    return { status: 200, ok: true, post: toonPost(post) };
  }

  const toonPost = (p) => ({ id: p.id, van: p.doorCodenaam, rol: p.rol, soort: p.soort || 'bericht',
    tekst: p.tekst, bestand: p.bestand || null, at: p.at });

  /* WAT U DEELT -- per reis, en per stuk.

     WAAROM DIT GEEN "LIVE" IETS IS. RTG heeft geen externe vluchtbron (de
     reiswacht zegt dat met zoveel woorden), dus een melding "uw vlucht is
     geland" zou hier verzonnen zijn. En zelfs mét zo'n bron zou een stand die
     vanzelf doorloopt neerkomen op volgen. Het aankomstmoment is daarom een
     HANDELING van de reiziger: hij zegt dat hij er is. Dat is precies de vorm
     uit LIFE.md par. 4 -- een moment, geen stip.

     De schakelaar bepaalt niet OF de reiziger het mag melden, maar of een
     MEEKIJKER het te zien krijgt. Een reisgenoot ziet het altijd: die staat op
     dezelfde reis. */
  const STANDAARD_BELEID = { aankomst: true };

  function beleidVan(reisId, eigenaarKey) {
    const b = beleidBak()[eigenaarKey + '|' + reisId];
    return Object.assign({}, STANDAARD_BELEID, b || {});
  }

  function beleid(key, reisId) {
    if (!reisVan(key, reisId)) return { status: 404, error: 'Deze reis staat niet bij u.' };
    /* Wat er NIET bestaat staat er met zoveel woorden bij: anders leest een
       ontbrekende schakelaar als een functie die nog moet komen. */
    return { status: 200, ok: true, beleid: beleidVan(reisId, key),
      bestaatNiet: [{ naam: 'live locatie',
        reden: 'RTG deelt geen doorlopende positie. U deelt een moment, geen stip.' }] };
  }

  function zetBeleid(key, reisId, veld, aan) {
    if (!reisVan(key, reisId)) return { status: 404, error: 'Deze reis staat niet bij u.' };
    if (!Object.prototype.hasOwnProperty.call(STANDAARD_BELEID, veld)) {
      return { status: 400, error: 'Dat is geen instelling die bestaat.' };
    }
    const sleutel = key + '|' + reisId;
    const b = Object.assign({}, beleidVan(reisId, key));
    b[veld] = aan === true;
    beleidBak()[sleutel] = b; save();
    return { status: 200, ok: true, beleid: b };
  }

  /* BEELD DELEN -- en het besluit dat eronder ligt.

     EEN FOTO DIE NAAR VIER MENSEN GAAT IS IETS ANDERS DAN EEN FOTO IN UW KLUIS.
     Daarom komt er hier GEEN tweede opslag bij. Wat op de tijdlijn staat is een
     VERWIJZING naar een bestand dat in de kluis van de reiziger blijft, en de
     toegang wordt geregeld door de deellaag die die kluis al heeft
     (kern/bestanden-delen.js). Dat is niet alleen minder code -- het maakt drie
     dingen waar die anders beloftes waren geweest:

       1. BEWAARTERMIJN. Het beeld valt onder de bewaartermijn van de kluis van
          zijn eigenaar. Er ligt geen tweede exemplaar in een RTG-bak dat die
          termijn overleeft, en er is niets te vergeten wat het recht op
          vergetelheid (kern/bestanden-vergeten.js) niet al meepakt.
       2. DOELBINDING. Delen gebeurt per bestand en per persoon, met de
          codenamen van dít gezelschap. Niet "alles van deze reis" en niet
          "iedereen die er ooit bij zat".
       3. INTREKKEN WERKT ECHT. Wie uit het gezelschap gaat, verliest ook de
          bestanden: `verwijder()` hieronder haalt hem uit de deellijst van elk
          beeld van deze reis. Zonder die stap zou hij de tijdlijn kwijtraken en
          de fotos houden -- precies de halve waarheid die dit huis niet wil.

     WAT DIT NIET DOET: uploaden. Het bestand staat al in de kluis; hier wordt
     het gedeeld. Een tweede uploadweg zou een tweede quotum, een tweede
     virusscan en een tweede plek zijn waar bytes van een lid landen. */
  async function deelBeeld(key, reisId, bestandId, tekst) {
    const reis = reisVan(key, reisId);
    if (!reis) return { status: 404, error: 'Deze reis staat niet bij u.' };
    const bid = schoon(bestandId, 60);
    if (!bid) return { status: 400, error: 'Kies een bestand uit uw kluis.' };
    if (typeof bestandenDeel !== 'function') {
      return { status: 501, error: 'Delen van bestanden is op deze server niet ingeschakeld.' };
    }
    const kring = leden().filter(x => x.reis === reisId && x.eigenaar === key && x.stand === 'aanvaard');
    /* Eerst delen, dan pas plaatsen. Andersom zou er een regel op de tijdlijn
       staan die naar een beeld wijst dat niemand mag openen. */
    for (const l of kring) {
      const uit = await bestandenDeel(key, bid, l.lidCodenaam || naam(l.lid), true);
      if (uit && uit.error) return { status: uit.status || 400, error: uit.error };
    }
    const post = {
      id: 'P-' + crypto.randomBytes(4).toString('hex'),
      reis: reisId, eigenaar: key, door: key, doorCodenaam: naam(key), rol: 'eigenaar',
      soort: 'beeld', bestand: bid, tekst: schoon(tekst, MAX_TEKST), at: nu()
    };
    posts().push(post); save();
    return { status: 200, ok: true, post: toonPost(post), gedeeldMet: kring.length };
  }

  /* HET AANKOMSTMOMENT. Alleen de reiziger zelf; een reisgenoot meldt niet aan
     dat een ander er is. */
  function meldAankomst(key, reisId) {
    const reis = reisVan(key, reisId);
    if (!reis) return { status: 404, error: 'Deze reis staat niet bij u.' };
    const post = {
      id: 'P-' + crypto.randomBytes(4).toString('hex'),
      reis: reisId, eigenaar: key, door: key, doorCodenaam: naam(key), rol: 'eigenaar',
      soort: 'aankomst',
      tekst: 'Aangekomen in ' + (reis.bestemming || 'de bestemming') + '.',
      at: nu()
    };
    posts().push(post); save();
    const b = beleidVan(reisId, key);
    return { status: 200, ok: true, post: toonPost(post),
      /* Eerlijk terugmelden wie dit ziet -- de reiziger hoort te weten of zijn
         meekijkers meelezen, en niet te moeten raden. */
      gedeeldMet: b.aankomst ? 'het hele gezelschap' : 'alleen wie meereist' };
  }

  function tijdlijn(key, reisId) {
    const eigen = reisVan(key, reisId);
    const mijn = eigen ? null : leden().find(x => x.reis === reisId && x.lid === key && x.stand === 'aanvaard');
    if (!eigen && !mijn) return { status: 404, error: 'Deze reis staat niet bij u.' };
    const eigenaar = eigen ? key : mijn.eigenaar;
    const rol = eigen ? 'eigenaar' : mijn.rol;
    const b = beleidVan(reisId, eigenaar);
    /* Het aankomstmoment is het enige dat een schakelaar kent: staat hij uit,
       dan blijft het bij wie meereist. Berichten die iemand zelf schrijft
       hebben geen schakelaar -- wie schrijft, deelt. */
    const magZien = (p) => !(p.soort === 'aankomst' && rol === 'meekijker' && !b.aankomst);
    return { status: 200, ok: true, rol,
      posts: posts().filter(p => p.reis === reisId && p.eigenaar === eigenaar).filter(magZien)
        .sort((a, b2) => String(a.at).localeCompare(String(b2.at))).map(toonPost) };
  }

  /* MIJN UITNODIGINGEN -- wat er aan mij gevraagd is, en wat ik zelf meereis. */
  function mijnKring(key) {
    return { status: 200, ok: true,
      gevraagd: leden().filter(x => x.lid === key && x.stand === 'gevraagd')
        .map(x => ({ id: x.id, reis: x.reis, van: x.eigenaarCodenaam, rol: x.rol, gevraagdOp: x.gevraagdOp })),
      meereizen: leden().filter(x => x.lid === key && x.stand === 'aanvaard')
        .map(x => ({ id: x.id, reis: x.reis, van: x.eigenaarCodenaam, rol: x.rol })) };
  }

  return {
    reisgezelschap: {
      ROLLEN, STANDEN, zicht, rolVan, nodigUit, antwoord, verwijder,
      gezelschap, reisVoor, schrijf, tijdlijn, mijnKring, beleid, zetBeleid, meldAankomst, deelBeeld
    }
  };
};
