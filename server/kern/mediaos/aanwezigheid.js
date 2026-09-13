/* Media OS (deelmodule): DE PUBLIEKE AANWEZIGHEID, EN DE ENE VOLGRELATIE.

   HET BESLUIT DAT HIERONDER LIGT (13 september 2026). WEKDEKKING.json vond vier
   publieke momenten waarvan er drie niemand konden wekken: festival en sportclub
   hebben geen volgrelatie. De voor de hand liggende oplossing -- `volgtZaak`
   naast `volgtLid`, en morgen `volgtClub` en `volgtFestival` -- is precies de
   vorm die dit huis al twee keer heeft afgewezen: dan krijgt ieder nieuw publiek
   subject zijn eigen sociale administratie, en binnen een jaar zijn het er zes
   die uit elkaar lopen (LAT.md regel 4).

   DUS EEN BEGRIP EN NIET VIER: een lid volgt een PUBLIEKE AANWEZIGHEID. Die
   aanwezigheid kan gedragen worden door een mens of door een organisatie, en dat
   verandert niets aan de relatie. Ajax wordt geen mens en Mila wordt geen zaak;
   de aanwezigheid is alleen het publieke aanspreekpunt waarop iemand zich kan
   abonneren.

   DE HARDE INVARIANT, en die is de reden dat deze module zo klein is:

     EEN AANWEZIGHEID HEEFT NOOIT MEER BEVOEGDHEID DAN HAAR DRAGER.

   Zij is een PROJECTIEADRES en geen actor. Zij tekent niets, ontvangt geen geld,
   wijst niemand aan en bezit geen rechten. Wie hier een veld toevoegt waarmee
   zij iets KAN, heeft een tweede identiteitssysteem gebouwd -- en dat is exact
   de `humans`-tabelgrens uit HDI.md par. 5.1, nu aan de publieke kant.
   test/aanwezigheid.test.js bewaakt dat: de vorm is gesloten.

   VOLGEN IS ALTIJD EXPLICIET. Een kaartje kopen is geen volgen. Lid zijn is geen
   volgen. Ergens werken is geen volgen. Merchandise kopen is geen volgen. De
   mens drukt zelf, of er is geen relatie. Zonder die regel ontstaat vanzelf een
   publiek dat nooit gevraagd is -- en dan is "volgers" een verkooplijst.

   WAAROM DE DOMEINLIJSTEN BLIJVEN BESTAAN. Clips, het Theater en De Salon hebben
   elk een eigen volgrelatie, en die zijn van HEN: ze voeden ook hun eigen feed en
   hun eigen zaal. De Media OS leest ze en bezit ze niet (./volgen.js). Wat hier
   bij komt is EEN lijst voor alle aanwezigheden samen -- geen lijst per subject.
   ./wekken.js voegt de bronnen samen, precies zoals hij dat met Clips en het
   Theater al deed. */
'use strict';

/* De soorten die een aanwezigheid kan uitzenden. Dit is de woordenschat van de
   MELDINGSVOORKEUR en niet van de domeinen: een lid kiest hier wat hij wil
   horen, in woorden die hij herkent. `kern/mediaos/eigen.js` draagt dezelfde
   lijst en leest hem hier, want twee lijsten lopen uiteen. */
const SOORTEN = ['muziek', 'video', 'flow', 'live', 'optreden', 'kaartverkoop', 'wedstrijd', 'uitgelicht'];

/* Wie een aanwezigheid kan DRAGEN. Twee, en met opzet niet meer: een mens met
   een ledensleutel, of een zaak met een code. Een derde soort erbij is een
   besluit en geen uitbreiding. */
const DRAGERS = ['lid', 'zaak'];

module.exports = ({ db, save, schoon, codenaamVan }) => {
  const nu = () => new Date().toISOString();

  function A() {
    if (!db.data.mediaAanwezig || typeof db.data.mediaAanwezig !== 'object') db.data.mediaAanwezig = {};
    if (!db.data.mediaVolgt || typeof db.data.mediaVolgt !== 'object') db.data.mediaVolgt = {};
    return db.data;
  }

  const sleutel = (soort, code) => soort + ':' + code;

  /* DE VORM IS GESLOTEN. Er wordt hier een nieuw object gebouwd en nooit iets
     van de aanroeper doorgegeven: wie `{ mag: true }` meestuurt, krijgt het niet
     terug. Dat is de invariant in code in plaats van in een zin. */
  function vorm(soort, code, naam, soorten) {
    return {
      id: sleutel(soort, code),
      drager: { soort, code },
      naam: schoon(naam, 80) || code,
      soorten: (Array.isArray(soorten) ? soorten : SOORTEN).filter(s => SOORTEN.includes(s)),
      at: nu()
    };
  }

  /* Een aanwezigheid ONTSTAAT door publiek te worden, niet door een knop. Het
     domein dat iets publiceert vraagt hem hier op; bestaat hij niet, dan komt hij
     er. Dat is geen stille registratie van een mens: de drager is een codenaam of
     een zaakcode die al publiek optreedt, en er wordt niets over hem bewaard
     behalve zijn naam en wat hij kan uitzenden. */
  function zorg(soort, code, naam, soorten) {
    if (!DRAGERS.includes(soort) || !code) return null;
    const d = A();
    const id = sleutel(soort, code);
    if (!d.mediaAanwezig[id]) { d.mediaAanwezig[id] = vorm(soort, code, naam, soorten); save(); }
    else if (naam && d.mediaAanwezig[id].naam !== schoon(naam, 80)) {
      /* De naam mag bijgewerkt worden -- een club hernoemt, een lid kiest een
         andere codenaam. De relatie hangt aan de ID en niet aan de naam, dus
         volgers raken niemand kwijt. */
      d.mediaAanwezig[id].naam = schoon(naam, 80); save();
    }
    return d.mediaAanwezig[id];
  }

  const van = (soort, code) => A().mediaAanwezig[sleutel(soort, code)] || null;
  const met = (id) => A().mediaAanwezig[String(id || '')] || null;

  /* ---- volgen: altijd expliciet, en altijd door de mens zelf ---- */
  function volg(key, id, aan) {
    const a = met(id);
    if (!key) return { status: 401, error: 'Geen sessie.' };
    if (!a) return { status: 404, error: 'Deze aanwezigheid bestaat niet.' };
    /* Jezelf volgen heeft geen betekenis en maakt de tellingen onzuiver. */
    if (a.drager.soort === 'lid' && a.drager.code === key)
      return { status: 400, error: 'Dit bent u zelf.' };
    const d = A();
    const lijst = d.mediaVolgt[key] = Array.isArray(d.mediaVolgt[key]) ? d.mediaVolgt[key] : [];
    const i = lijst.indexOf(a.id);
    if (aan && i < 0) lijst.push(a.id);
    if (!aan && i >= 0) lijst.splice(i, 1);
    save();
    return { status: 200, ok: true, volgIk: lijst.includes(a.id), aanwezigheid: beeld(a) };
  }

  const volgtHij = (key, id) => (A().mediaVolgt[key] || []).includes(String(id || ''));

  /* De volgers van een aanwezigheid: ledensleutels. Dit is de enige lijst die
     deze module bezit; Clips, het Theater en De Salon houden de hunne zelf. */
  function volgersVan(id) {
    const d = A();
    const gezocht = String(id || '');
    return Object.keys(d.mediaVolgt).filter(k => (d.mediaVolgt[k] || []).includes(gezocht));
  }

  /* WAT EEN LID ZIET ALS HIJ OP VOLGEN DRUKT. Niet "mediaos/optreden" maar wat
     hij gaat horen. Een aanwezigheid die vier dingen kan uitzenden en dat niet
     zegt, laat iemand op een knop drukken zonder te weten waarvoor -- en dan
     activeert een tik ongemerkt vijf kanalen. */
  const WOORD = {
    muziek: 'muziek', video: "video's", flow: 'korte video', live: 'live',
    optreden: 'optredens', kaartverkoop: 'kaartverkoop', wedstrijd: 'wedstrijden',
    uitgelicht: 'uitgelicht werk'
  };
  const beeld = (a) => a && ({
    id: a.id, naam: a.naam, drager: a.drager.soort,
    soorten: a.soorten, watUKrijgt: a.soorten.map(s => WOORD[s] || s)
  });

  /* De aanwezigheden die dit lid volgt, met hun beeld. */
  function mijn(key) {
    const d = A();
    return (d.mediaVolgt[key] || []).map(id => beeld(d.mediaAanwezig[id])).filter(Boolean);
  }

  /* ---- DISCOVERY: een lid kan een aanwezigheid VINDEN ----

     HET GAT DAT DIT DICHT (13 september 2026). Schakel 2 van scripts/momentproef.js
     stond open met een uitgeschreven reden: er was geen enkele route die
     aanwezigheden opsomt of doorzoekt. `aanwezigMet` vraagt een id dat de fan al
     moet kennen en `mijn` toont alleen wat hij AL volgt -- dus een fan kon een
     festival alleen volgen als iemand hem het id had doorgegeven. Volgen was
     bereikbaar en vinden niet.

     EN DIT MAAKT GEEN PUBLIEKE KANT. Dat is de grens, en hij staat niet voor
     niets in routes/festival/gast.js: "er is in dit huis geen publieke kant, en
     een line-up is het eerste dat er een van zou maken". Deze zoeker hangt
     daarom aan de LEDENdeur (`auth` op de route) en kent geen anonieme ingang.
     Wat hij toont is bovendien niets nieuws: een aanwezigheid ontstaat doordat
     iemand PUBLIEK optreedt, en het beeld draagt alleen de naam, de drager en
     wat er wordt uitgezonden.

     DRIE DINGEN DIE HIJ MET OPZET NIET DOET, en alle drie komen ze uit STAGE.md
     par. 5:

     1. GEEN VOLGERSTELLING. Niet in de uitvoer en niet als sorteersleutel. Een
        lijst op populariteit is een ranglijst, en de meeteenheid van deze laag is
        de gebeurtenis en nooit de mens. Er wordt op NAAM gesorteerd -- saai,
        stabiel, en het zegt niets over iemands publiek.
     2. GEEN AANBEVELING. Hij beantwoordt wat je vraagt en stelt niets voor. Een
        "misschien ken je"-lijst is precies de trechter die LIFE.md par. 4
        tegenhoudt.
     3. GEEN MENSEN ZOEKEN OP NAAM VAN BUITEN. De drager is een codenaam of een
        zaakcode; er komt geen echte naam langs, want die woont in de kluis. */
  const LIMIET = 50;

  function zoek(key, vraag, soort) {
    const d = A();
    const q = String(vraag == null ? '' : vraag).trim().toLowerCase().slice(0, 60);
    const s = SOORTEN.includes(soort) ? soort : null;
    const alles = Object.keys(d.mediaAanwezig).map(id => d.mediaAanwezig[id]).filter(Boolean);
    const raak = alles
      .filter(a => !s || a.soorten.includes(s))
      .filter(a => !q || String(a.naam || '').toLowerCase().includes(q))
      /* Jezelf hoef je niet te vinden: volgen zou toch 400 geven ("Dit bent u
         zelf"), en een treffer waar je niets mee kunt is een dood spoor. */
      .filter(a => !(a.drager.soort === 'lid' && a.drager.code === key))
      .sort((x, y) => String(x.naam).localeCompare(String(y.naam)));
    return {
      aanwezigheden: raak.slice(0, LIMIET).map(a => Object.assign({}, beeld(a), { volgIk: volgtHij(key, a.id) })),
      gevonden: raak.length,
      /* Even groot erbij, want een afgekapte lijst die dat niet zegt leest als
         een volledige lijst. */
      afgekapt: raak.length > LIMIET ? LIMIET : null,
      watDitNietDoet: 'Er staat geen volgorde op populariteit en geen aanbeveling: gesorteerd op naam, en alleen wat u vroeg.'
    };
  }

  return { aanwezigZorg: zorg, aanwezigVan: van, aanwezigMet: met, aanwezigVolg: volg,
    aanwezigVolgtHij: volgtHij, aanwezigVolgersVan: volgersVan, aanwezigMijn: mijn,
    aanwezigZoek: zoek, aanwezigBeeld: beeld, AANWEZIG_SOORTEN: SOORTEN, AANWEZIG_DRAGERS: DRAGERS };
};
module.exports.SOORTEN = SOORTEN;
module.exports.DRAGERS = DRAGERS;
