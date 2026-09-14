/* Media OS: één expliciete volgrelatie voor een publieke aanwezigheid, gedragen
   door een lid of zaak. De aanwezigheid is een projectieadres en nooit een
   actor: zij tekent niets, ontvangt geen geld en bezit geen rechten. Een kaartje,
   aankoop of dienstverband maakt niemand automatisch volger. Domeinen houden
   hun eigen lijsten; deze laag voegt alleen het ontbrekende publieke adres toe.
   test/aanwezigheid.test.js bewaakt de gesloten vorm en bevoegdheidsgrens. */
'use strict';

const { beeld } = require('./aanwezigheid-beeld');

/* De soorten die een aanwezigheid kan uitzenden. Dit is de woordenschat van de
   MELDINGSVOORKEUR en niet van de domeinen: een lid kiest hier wat hij wil
   horen, in woorden die hij herkent. `kern/mediaos/eigen.js` draagt dezelfde
   lijst en leest hem hier, want twee lijsten lopen uiteen. */
const SOORTEN = ['muziek', 'video', 'flow', 'live', 'optreden', 'kaartverkoop', 'wedstrijd', 'uitgelicht'];

/* Wie een aanwezigheid kan DRAGEN. Twee, en met opzet niet meer: een mens met
   een ledensleutel, of een zaak met een code. Een derde soort erbij is een
   besluit en geen uitbreiding. */
const DRAGERS = ['lid', 'zaak'];

module.exports = ({ opslag: gegevenOpslag, db, save, schoon, codenaamVan }) => {
  const opslag = gegevenOpslag || require('./opslag')({ db, save });
  const nu = () => new Date().toISOString();

  function A() {
    return opslag.aanwezigheid();
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
    if (!d.mediaAanwezig[id]) { d.mediaAanwezig[id] = vorm(soort, code, naam, soorten); opslag.bewaar(); }
    else if (naam && d.mediaAanwezig[id].naam !== schoon(naam, 80)) {
      /* De naam mag bijgewerkt worden -- een club hernoemt, een lid kiest een
         andere codenaam. De relatie hangt aan de ID en niet aan de naam, dus
         volgers raken niemand kwijt. */
      d.mediaAanwezig[id].naam = schoon(naam, 80); opslag.bewaar();
    }
    return d.mediaAanwezig[id];
  }

  const van = (soort, code) => A().mediaAanwezig[sleutel(soort, code)] || null;
  const met = (id) => A().mediaAanwezig[String(id || '')] || null;

  /* ALLE aanwezigheden, voor ./zoeken.js. Die module doorzoekt ze en raakt
     `db.data` daardoor zelf niet aan: de collectie houdt EEN lezer en EEN
     schrijver, en dat is wat regel 63 van de keuring eist. Hij geeft de
     onbewerkte vormen terug en niet het beeld, want de zoeker filtert op
     `drager` -- dat veld zit met opzet niet in `beeld()`. */
  const alle = () => Object.keys(A().mediaAanwezig).map(id => A().mediaAanwezig[id]).filter(Boolean);

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
    opslag.bewaar();
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

  /* De aanwezigheden die dit lid volgt, met hun beeld. */
  function mijn(key) {
    const d = A();
    return (d.mediaVolgt[key] || []).map(id => beeld(d.mediaAanwezig[id])).filter(Boolean);
  }

  return { aanwezigZorg: zorg, aanwezigVan: van, aanwezigMet: met, aanwezigVolg: volg,
    aanwezigVolgtHij: volgtHij, aanwezigVolgersVan: volgersVan, aanwezigMijn: mijn,
    aanwezigAlle: alle, aanwezigBeeld: beeld, AANWEZIG_SOORTEN: SOORTEN, AANWEZIG_DRAGERS: DRAGERS };
};
module.exports.SOORTEN = SOORTEN;
module.exports.DRAGERS = DRAGERS;
