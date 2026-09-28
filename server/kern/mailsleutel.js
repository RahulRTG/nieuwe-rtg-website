/* APPARAATSLEUTELS: hoe een mailclient binnenkomt zonder het wachtwoord.

   WAAROM NIET GEWOON HET WACHTWOORD. Een mailclient bewaart zijn wachtwoord op
   schijf, jaren lang, op een laptop die ook zoekraakt. Het RTG-wachtwoord opent
   veel meer dan een postvak: de app, de pas, de betaallaag. Wie IMAP wil
   gebruiken, hoort dus iets anders te krijgen -- iets dat precies EEN postvak
   opent en dat los in te trekken is zonder dat de eigenaar zijn wachtwoord
   hoeft te wijzigen.

   VIER EIGENSCHAPPEN, en ze volgen alle vier uit die ene gedachte:

   1. EEN SLEUTEL HOORT BIJ EEN POSTVAK. Niet bij een account, niet bij een
      apparaat-in-het-algemeen. Wie twee postvakken leest, heeft twee sleutels.
   2. HIJ IS MAAR EEN KEER TE ZIEN. Wat wij bewaren is een hash; verliest u hem,
      dan maakt u een nieuwe. Een sleutel die wij kunnen tonen, kan ook gestolen
      worden uit onze database.
   3. HIJ DRAAGT EEN NAAM EN EEN LAATSTE GEBRUIK. "Laptop van Rahul, voor het
      laatst gezien op 3 augustus" is wat iemand nodig heeft om te durven
      intrekken. Een lijst met zeven naamloze sleutels trekt niemand in.
   4. INTREKKEN WERKT METEEN. Er is geen tweede lijst en geen cache; de
      controle kijkt elke keer in dezelfde rij.

   De vergelijking gaat via timingSafeEqual: een controle die sneller "nee" zegt
   naarmate het begin van de sleutel beter klopt, is een controle die je kunt
   raden.

   EN HIJ VERVALT (CODECREDENTIALS.json, rtmail.imap_apparaatsleutel):
   standaard 180 dagen, nooit langer dan 365. Roteren geeft hetzelfde apparaat
   een nieuwe sleutel en maakt de oude in dezelfde schrijfactie waardeloos --
   geen overlap, want intrekken was hier altijd meteen. Gebruik wordt geteld en
   niet begrensd (een mailclient logt telkens in); wat hem begrenst is de
   vervaldatum, het ene postvak en MAX_PER_VAK. Een sleutel van voor deze regel
   vervalt op LEGACY_TOT, een open besluit van de eigenaar. */
'use strict';
const adresLaag = require('./rtmail-adres');

const MAX_PER_VAK = 10;
const DAGEN_STANDAARD = 180;
const DAGEN_MAX = 365;
const LEGACY_TOT = '2026-12-31T23:59:59.000Z';
const vervaltVan = (r) => r.vervalt || LEGACY_TOT;
function geldigheid(dagen) {
  if (dagen == null || dagen === '') return DAGEN_STANDAARD;
  const d = Number(dagen);
  return Number.isInteger(d) && d >= 1 && d <= DAGEN_MAX ? d : null;
}

module.exports = ({ db, save, crypto }) => {
  const nu = () => new Date().toISOString();
  const busVan = (adres) => {
    const o = adresLaag.ontleed(adres);
    return o.binnenshuis ? String(o.lokaal || '').replace(/[.-]/g, '') : String(o.adres || '');
  };
  const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

  const eigen = require('./eigencollectie')({ db, domein: 'kern/mailsleutel', bezit: { mailSleutels: 'kaart' } });
  function S() {
    const s = eigen.bak('mailSleutels');
    if (!Array.isArray(s.rijen)) s.rijen = [];
    return s;
  }

  /* Aanmaken. De sleutel komt EEN keer terug in het antwoord en wordt daarna
     nooit meer getoond -- wij bewaren alleen de hash. */
  function maak(adres, naam, dagen) {
    const bus = busVan(adres);
    if (!bus) return { error: 'Dit postvak is niet te bepalen.' };
    const d = geldigheid(dagen);
    if (!d) return { error: 'Een apparaatsleutel geldt 1 tot ' + DAGEN_MAX + ' dagen.' };
    const s = S();
    const mijne = s.rijen.filter(r => r.postvak === bus);
    if (mijne.length >= MAX_PER_VAK) return { error: 'U heeft al ' + MAX_PER_VAK + ' apparaatsleutels; trek er eerst een in.' };
    const geheim = crypto.randomBytes(24).toString('base64url');
    const rij = { id: crypto.randomBytes(5).toString('hex'), postvak: bus, adres,
      naam: String(naam || '').replace(/[<>]/g, '').trim().slice(0, 60) || 'naamloos apparaat',
      hash: hash(geheim), at: nu(), laatst: null, vervalt: tot(d), gebruik: 0,
      issuer: 'rtg.rtmail', doel: 'imap-apparaat' };
    s.rijen.push(rij);
    save();
    return { ok: true, id: rij.id, naam: rij.naam, gebruiker: adres, sleutel: geheim, vervalt: rij.vervalt,
      let: 'Schrijf deze sleutel nu op: hij is hierna niet meer te zien. Wij bewaren alleen een hash, zodat een inbraak in onze database uw mailclient niet opent.' };
  }

  const tot = (d) => new Date(Date.now() + d * 86400000).toISOString();
  const lijst = (adres) => S().rijen.filter(r => r.postvak === busVan(adres))
    .map(r => ({ id: r.id, naam: r.naam, at: r.at, laatst: r.laatst, vervalt: vervaltVan(r),
      legacy: !r.vervalt, gebruik: r.gebruik || 0 }));

  /* Roteren: zelfde apparaat, zelfde naam, een nieuw geheim en een nieuwe
     vervaldatum. De oude hash is weg in dezelfde save; er is geen overlap. */
  function roteer(adres, id, dagen) {
    const d = geldigheid(dagen);
    if (!d) return { error: 'Een apparaatsleutel geldt 1 tot ' + DAGEN_MAX + ' dagen.' };
    const r = S().rijen.find(x => x.id === String(id || '') && x.postvak === busVan(adres));
    if (!r) return { error: 'Die sleutel bestaat niet op dit postvak.' };
    const geheim = crypto.randomBytes(24).toString('base64url');
    Object.assign(r, { hash: hash(geheim), at: nu(), laatst: null, vervalt: tot(d), gebruik: 0,
      issuer: 'rtg.rtmail', doel: 'imap-apparaat' });
    save();
    return { ok: true, id: r.id, naam: r.naam, gebruiker: r.adres, sleutel: geheim, vervalt: r.vervalt,
      let: 'De vorige sleutel van dit apparaat werkt vanaf nu niet meer. Deze is maar een keer te zien.' };
  }

  function trekIn(adres, id) {
    const s = S();
    const i = s.rijen.findIndex(r => r.id === String(id || '') && r.postvak === busVan(adres));
    if (i < 0) return { error: 'Die sleutel bestaat niet op dit postvak.' };
    const weg = s.rijen.splice(i, 1)[0];
    save();
    return { ok: true, id: weg.id, naam: weg.naam,
      let: 'Deze sleutel werkt vanaf nu niet meer. Er is geen cache en geen tweede lijst.' };
  }

  /* De controle die de IMAP-laag gebruikt. Geeft het ADRES terug bij een goede
     sleutel -- de client noemt zijn gebruikersnaam, maar wij geloven de
     sleutel, niet die naam. */
  function controleer(gebruiker, geheim) {
    const bus = busVan(gebruiker);
    if (!bus || !geheim) return { ok: false, waarom: 'gebruikersnaam of sleutel ontbreekt' };
    const gegeven = Buffer.from(hash(geheim), 'utf8');
    /* Elke rij van dit postvak wordt vergeleken, zonder vroege uitgang; pas
       daarna telt of de treffer nog geldt. */
    let treffer = null;
    for (const r of S().rijen) {
      if (r.postvak !== bus) continue;
      const bewaard = Buffer.from(r.hash, 'utf8');
      if (bewaard.length === gegeven.length && crypto.timingSafeEqual(bewaard, gegeven)) treffer = r;
    }
    if (!treffer) return { ok: false, waarom: 'die apparaatsleutel klopt niet' };
    if (!(Date.parse(vervaltVan(treffer)) > Date.now()))
      return { ok: false, waarom: 'deze apparaatsleutel is verlopen; maak of roteer er een' };
    treffer.laatst = nu();
    treffer.gebruik = (treffer.gebruik || 0) + 1;
    save();
    return { ok: true, adres: treffer.adres, sleutel: treffer.id, naam: treffer.naam };
  }

  return { maak, roteer, lijst, trekIn, controleer, MAX_PER_VAK, DAGEN_STANDAARD, DAGEN_MAX, LEGACY_TOT };
};
