/* HET REISGEZELSCHAP, deel twee: WAT ER GEDEELD WORDT.

   Deel een (./reisgezelschap.js) gaat over WIE erbij hoort en wat hij van de
   reis mag zien -- de poort. Dit bestand gaat over wat de reiziger zelf deelt:
   de tijdlijn, het aankomstmoment, de schakelaar daaronder en het beeld.

   Die knip loopt langs een echte naad en niet langs een regelaantal: de poort
   beslist over gegevens die het REISDOMEIN aanlevert, dit bestand over dingen
   die een MENS hier zet. De eerste mag nooit iets prijsgeven dat niet in de
   witte lijst staat; de tweede deelt precies wat iemand bewust deelt.

   De grenzen staan in de kop van deel een en gelden hier onverkort: geen live
   locatie (het veld bestaat niet), geen cijfer op het leven tussen mensen, en
   niets bereikt een tweede persoon zonder dat een mens daarvoor drukt. */
'use strict';

module.exports.maakGezelschapDelen = ({ db, save, crypto, klok, posts, leden, beleidBak, reisVan, naam, schoon, MAX_TEKST, bestandenDeel }) => {
  const nu = () => klok.datum().toISOString();

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
  return { toonPost, schrijf, tijdlijn, beleid, zetBeleid, beleidVan, meldAankomst, deelBeeld };
};
