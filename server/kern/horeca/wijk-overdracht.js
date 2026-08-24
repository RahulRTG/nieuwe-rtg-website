/* Horeca (kern): EEN WIJK OVERDRAGEN terwijl er gasten aan tafel zitten.

   DE VRAAG VAN VLOER is niet "wat moet ik nu doen" maar "wie heeft ons nú
   nodig, en hoe verdelen we dat". Het eerste deel stond er al: het wijkbeeld
   telt per wijk hoeveel er open staat en wie hem draagt. Het tweede deel --
   opnieuw verdelen -- kon niet, en dat is precies het moment waarop een
   maître iets nodig heeft: iemand gaat pauzeren, iemand raakt achterop, er
   komt een groep binnen.

   HET GEVAAR ZIT IN HET GAT. Een wijk loslaten en hopen dat een collega hem
   oppakt, is een tafel die tussen twee mensen door valt -- en dat merkt niemand
   tot de gast het zegt. Dus is een overdracht geen "loslaten" maar een AANBOD:

   1. ALLEEN WIE HEM DRAAGT BIEDT HEM AAN. Een collega kan een wijk niet naar
      zichzelf toe trekken; dat zou de claim zijn die de pas juist oplost.
   2. TIJDENS HET AANBOD DRAAGT DE AANBIEDER HEM NOG. Het aanbod verandert niets
      aan wie verantwoordelijk is -- pas de aanvaarding doet dat. Zo bestaat er
      geen moment waarop een wijk van niemand is.
   3. ALLEEN DE GEVRAAGDE AANVAARDT. Een aanbod aan Sanne is geen aanbod aan de
      hele ploeg; anders is het alsnog een wedstrijdje wie het eerst drukt.
   4. INTREKKEN KAN, DOOR DE AANBIEDER OF DOOR EEN MANAGER. Een aanbod dat blijft
      hangen omdat de gevraagde naar huis is, hoort geen grendel te worden.
   5. EEN TAFEL STAAT HOOGSTENS BIJ EEN IEMAND UIT. Twee aanbiedingen op
      dezelfde tafel geven twee antwoorden op "van wie wordt dit", en dan gaan
      er twee of geen. Dat is de per-tafel-vorm van de oude regel "een wijk
      heeft hoogstens een open aanbod": een heel aanbod bezet alle tafels van
      zijn wijk, een half aanbod alleen die van hemzelf. Twee halve aanbiedingen
      op verschillende tafels mogen dus wel -- vier tafels aan Sanne en drie aan
      Bram is een normale avond, geen uitzondering.
   6. WEIGEREN DOET DE GEVRAAGDE, EN ALLEEN DIE.
   7. EEN NEE KOMT AAN: hij blijft staan tot de aanbieder hem heeft gezien.

   Regel 6 en 7 wonen in ./wijk-antwoord.js -- daar staat ook waarom een manager
   niet namens iemand weigert, en waarom een bericht dat zichzelf opruimt geen
   antwoord is.

   EN EEN HALF AANBOD VERHUIST GEEN TAFELS. Drie tafels aan een collega geven
   verandert de plattegrond niet; ze worden UITGELEEND (./wijk-leen.js) en de
   wijk blijft van wie hem droeg. Zie daar waarom dat een eigen laag is.

   WAT DIT NIET IS: een dienstrooster. Wie wanneer werkt staat in de
   personeelslaag. Dit is de handeling van een halve seconde midden in een
   dienst, en meer moet het niet zijn. */
'use strict';

/* De doos zelf staat in ./wijk-doos.js, zodat de weigering ernaast in dezelfde
   doos kijkt en niet in een tweede. */
const { doos, open, lijst, wat, MAXOPEN, MAXBEWAAR } = require('./wijk-doos');

module.exports = ({ horeca, schoon }) => {
  const { nu, id } = horeca;
  const wijklaag = require('./wijk')({ horeca, schoon });

  /* Welke tafels een half aanbod draagt en welke het bezet, staat in
     ./wijk-deel.js -- dat is een rekensom en geen handeling. */
  const deellaag = require('./wijk-deel')({ schoon });

  /* Aanbieden. De wijk blijft van de aanbieder tot de ander hem aanvaardt
     (regel 2) -- er is dus geen moment waarop hij van niemand is. */
  function bied(h, { wijkId, naarId, naarNaam, tafels, ploeg }, wie) {
    const w = wijklaag.lijst(h).find((x) => x.id === String(wijkId || ''));
    if (!w) return { status: 404, error: 'Deze wijk kennen we niet.' };
    if (!w.van) return { status: 409, error: 'Niemand draagt deze wijk; hij is al van iedereen.' };
    if (String(w.van.staffId) !== String(wie.staffId)) {
      return { status: 409, code: 'niet-van-jou',
        error: w.van.naam + ' draagt deze wijk; alleen hij biedt hem aan.' };
    }
    /* AAN EEN ECHTE COLLEGA. Dit veld was als enige niet begrensd en niet
       nagekeken: een onbegrensde tekenreeks de opslag in, en een aanbod aan een
       staffId die niet bestaat -- dat blijft staan tot iemand het intrekt, want
       aanvaarden kan niemand het. Wie er BESTAAT komt van de aanroeper; dat is
       een vraag voor de identiteitslaag. Is die lijst leeg, dan gaat het aanbod
       niet door: dan blijft de wijk bij wie hem draagt, en dat is precies de
       eigenschap die dit ontwerp bewaakt. */
    const naar = schoon(naarId, 40).trim();
    if (!naar) return { status: 400, error: 'Aan wie wordt deze wijk aangeboden?' };
    if (naar === String(wie.staffId)) {
      return { status: 400, error: 'Een wijk aan jezelf aanbieden verandert niets.' };
    }
    if (!(Array.isArray(ploeg) ? ploeg : []).map(String).includes(naar)) {
      return { status: 404, code: 'onbekende-collega',
        error: 'Deze collega werkt niet bij deze zaak.' };
    }
    const keuze = deellaag.kies(w, tafels);
    if (keuze.error) return keuze;
    const deel = keuze.deel;
    /* JE BIEDT ALLEEN AAN WAT JE ZELF DRAAGT -- regel 1, maar dan per tafel. Een
       uitgeleende tafel draagt de LENER, dus hem opnieuw aanbieden zou hem twee
       keer weggeven. Voor een heel aanbod betekent dat: haal eerst terug wat er
       uitstaat. Dat is geen strengheid maar dezelfde zin als regel 1. */
    const staatUit = keuze.raakt.filter((t) => wijklaag.leen.van(h, t));
    if (staatUit.length) {
      return { status: 409, code: 'uitgeleend',
        error: staatUit.join(', ') + ' ' + (staatUit.length === 1 ? 'staat' : 'staan') +
          ' uitgeleend aan ' + wijklaag.leen.van(h, staatUit[0]).naam + '; haal die eerst terug.' };
    }
    const botst = deellaag.bezet(open(h), w.id, keuze.raakt);
    if (botst) {
      return { status: 409, code: 'al-aangeboden',
        error: (botst.tafels ? botst.tafels.join(', ') : w.naam) + ' staat al uit bij ' +
          (botst.naarNaam || 'een collega') + '; trek dat aanbod eerst in.' };
    }
    if (open(h).length >= MAXOPEN) return { status: 409, error: 'Er staan te veel aanbiedingen open.' };
    /* Een nieuw aanbod op dezelfde wijk beantwoordt het vorige nee: dat hoeft
       niet ook nog eens apart weggeklikt te worden (regel 7). */
    for (const oud of doos(h)) {
      if (oud.stand === 'geweigerd' && !oud.gezienAt && oud.wijkId === w.id &&
          String(oud.vanId) === String(wie.staffId)) oud.gezienAt = nu();
    }
    const o = { id: id(4), wijkId: w.id, wijkNaam: w.naam, tafels: deel,
      vanId: String(wie.staffId), vanNaam: wie.naam,
      naarId: naar, naarNaam: schoon(naarNaam, 60) || null,
      stand: 'aangeboden', at: nu() };
    doos(h).unshift(o);
    if (doos(h).length > MAXBEWAAR) doos(h).length = MAXBEWAAR;
    return { ok: true, overdracht: o,
      let: deel
        ? 'U draagt ' + deel.join(', ') + ' nog tot ' + (o.naarNaam || 'uw collega') + ' ze aanvaardt.'
        : 'U draagt deze wijk nog tot ' + (o.naarNaam || 'uw collega') + ' hem aanvaardt.' };
  }

  /* Aanvaarden. Pas HIER verhuist de verantwoordelijkheid. */
  function aanvaard(h, overdrachtId, wie) {
    const o = doos(h).find((x) => x.id === String(overdrachtId || ''));
    if (!o) return { status: 404, error: 'Deze overdracht kennen we niet.' };
    if (o.stand !== 'aangeboden') return { status: 409, error: 'Deze overdracht is al ' + o.stand + '.' };
    if (String(o.naarId) !== String(wie.staffId)) {
      return { status: 409, code: 'niet-voor-jou',
        error: 'Dit aanbod staat bij ' + (o.naarNaam || 'iemand anders') + '.' };
    }
    /* EEN HALF AANBOD VERHUIST DE WIJK NIET. De tafels worden uitgeleend en de
       wijk blijft van wie hem droeg -- anders zou "neem tafel 6 even over" de
       plattegrond hertekenen voor de rest van de dienst (./wijk-leen.js). */
    if (o.tafels && o.tafels.length) {
      const uit = wijklaag.leen.neemOver(h, o.tafels, wie, { vanId: o.vanId,
        vanNaam: o.vanNaam, wijkId: o.wijkId, wijkNaam: o.wijkNaam });
      if (uit.error) return uit;
      o.stand = 'aanvaard';
      o.aanvaardAt = nu();
      return { ok: true, overdracht: o, wijk: o.wijkNaam, tafels: uit.tafels, let: uit.let };
    }
    /* De dienst overschrijven en niet eerst loslaten: tussen loslaten en
       oppakken zou de wijk van niemand zijn, en dat is precies het gat. */
    const dienst = (h.wijkdienst && typeof h.wijkdienst === 'object') ? h.wijkdienst : (h.wijkdienst = {});
    dienst[o.wijkId] = { staffId: String(wie.staffId), naam: wie.naam, at: nu(),
      overgenomenVan: o.vanNaam };
    o.stand = 'aanvaard';
    o.aanvaardAt = nu();
    return { ok: true, overdracht: o, wijk: o.wijkNaam,
      let: o.wijkNaam + ' is nu van u, overgenomen van ' + o.vanNaam + '.' };
  }

  // intrekken: door de aanbieder, of door een manager die een aanbod moet opruimen
  function trekIn(h, overdrachtId, wie) {
    const o = doos(h).find((x) => x.id === String(overdrachtId || ''));
    if (!o) return { status: 404, error: 'Deze overdracht kennen we niet.' };
    if (o.stand !== 'aangeboden') return { status: 409, error: 'Deze overdracht is al ' + o.stand + '.' };
    if (String(o.vanId) !== String(wie.staffId) && !wie.manager) {
      return { status: 409,
        error: o.vanNaam + ' bood ' + wat(o) + ' aan; alleen hij of een manager trekt dat in.' };
    }
    o.stand = 'ingetrokken';
    o.ingetrokkenAt = nu();
    o.ingetrokkenDoor = wie.naam;
    return { ok: true, overdracht: o,
      let: 'Ingetrokken; ' + o.vanNaam + ' draagt ' + wat(o) + ' nog steeds.' };
  }

  /* De ANTWOORDKANT (weigeren, en dat antwoord aan laten komen) staat in
     ./wijk-antwoord.js. Andere naad, zelfde doos: een aanbod is een handeling
     van de aanbieder, een weigering een handeling van de gevraagde -- en ze
     veranderen om verschillende redenen. Hij komt hier weer naar buiten, zodat
     er voor de aanroeper een deur blijft. */
  const antwoord = require('./wijk-antwoord')({ horeca, schoon });

  return { bied, aanvaard, trekIn, lijst, MAXOPEN,
    weiger: antwoord.weiger, gezien: antwoord.gezien, antwoorden: antwoord.antwoorden };
};
