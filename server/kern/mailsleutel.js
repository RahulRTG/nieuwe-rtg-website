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
   raden. */
'use strict';
const adresLaag = require('./rtmail-adres');

const MAX_PER_VAK = 10;

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
  function maak(adres, naam) {
    const bus = busVan(adres);
    if (!bus) return { error: 'Dit postvak is niet te bepalen.' };
    const s = S();
    const mijne = s.rijen.filter(r => r.postvak === bus);
    if (mijne.length >= MAX_PER_VAK) return { error: 'U heeft al ' + MAX_PER_VAK + ' apparaatsleutels; trek er eerst een in.' };
    const geheim = crypto.randomBytes(24).toString('base64url');
    const rij = { id: crypto.randomBytes(5).toString('hex'), postvak: bus, adres,
      naam: String(naam || '').replace(/[<>]/g, '').trim().slice(0, 60) || 'naamloos apparaat',
      hash: hash(geheim), at: nu(), laatst: null };
    s.rijen.push(rij);
    save();
    return { ok: true, id: rij.id, naam: rij.naam, gebruiker: adres, sleutel: geheim,
      let: 'Schrijf deze sleutel nu op: hij is hierna niet meer te zien. Wij bewaren alleen een hash, zodat een inbraak in onze database uw mailclient niet opent.' };
  }

  const lijst = (adres) => S().rijen.filter(r => r.postvak === busVan(adres))
    .map(r => ({ id: r.id, naam: r.naam, at: r.at, laatst: r.laatst }));

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
    for (const r of S().rijen) {
      if (r.postvak !== bus) continue;
      const bewaard = Buffer.from(r.hash, 'utf8');
      if (bewaard.length !== gegeven.length) continue;
      if (!crypto.timingSafeEqual(bewaard, gegeven)) continue;
      r.laatst = nu();
      save();
      return { ok: true, adres: r.adres, sleutel: r.id, naam: r.naam };
    }
    return { ok: false, waarom: 'die apparaatsleutel klopt niet' };
  }

  return { maak, lijst, trekIn, controleer, MAX_PER_VAK };
};
