/* Horeca (kern): HET ANTWOORD OP EEN AANBOD -- nee zeggen, en dat aan laten
   komen.

   WAAROM DIT EEN EIGEN BESTAND IS. ./wijk-overdracht.js gaat over de handeling
   van de AANBIEDER: dit gaat over die van de GEVRAAGDE. Dat zijn twee mensen op
   twee momenten, en ze veranderen om verschillende redenen.

   TOT HIER KON EEN AANBOD MAAR EEN KANT OP. Aanvaarden of niets doen -- en dan
   bleef het staan tot de aanbieder het zelf introk. Dat werkt, maar het legt de
   handeling bij de verkeerde persoon: wie NIET kan, weet dat als enige, en die
   moet het kunnen zeggen. Twee regels maken dat veilig:

   1. ALLEEN DE GEVRAAGDE WEIGERT. Niet de aanbieder (die trekt in) en niet een
      manager: een manager die namens iemand weigert, laat het journaal iets
      zeggen wat die persoon nooit gezegd heeft. Opruimen doet hij met
      intrekken, en dat heet dan ook zo.
   2. EEN NEE KOMT AAN. Een weigering die alleen een stand in de data is, is
      geen antwoord. Hij blijft op het scherm van de aanbieder staan TOT die hem
      heeft gezien -- niet een tijdje, want wie op dat moment met borden liep,
      mist hem anders. Een bericht dat vanzelf verdwijnt, is de tweede manier om
      een tafel tussen twee mensen door te laten vallen.

   EN DE REDEN IS VRIJE TEKST EN GEEN KEUZELIJST. "Waarom niet" heeft op een
   drukke avond honderd vormen, en een lijstje van vier maakt van de vijfde
   reden een leugen. Hij mag ook leeg blijven: nee is een compleet antwoord. */
'use strict';

const { doos, minutenSinds, wat } = require('./wijk-doos');

module.exports = ({ horeca, schoon }) => {
  const { nu } = horeca;

  function weiger(h, overdrachtId, wie, reden) {
    const o = doos(h).find((x) => x.id === String(overdrachtId || ''));
    if (!o) return { status: 404, error: 'Deze overdracht kennen we niet.' };
    if (o.stand !== 'aangeboden') return { status: 409, error: 'Deze overdracht is al ' + o.stand + '.' };
    if (String(o.naarId) !== String(wie.staffId)) {
      return { status: 409, code: 'niet-voor-jou',
        error: 'Dit aanbod staat bij ' + (o.naarNaam || 'iemand anders') +
          '; alleen hij weigert het. Opruimen doet ' + o.vanNaam + ' of een manager met intrekken.' };
    }
    o.stand = 'geweigerd';
    o.geweigerdAt = nu();
    o.reden = schoon(reden, 80).trim() || null;
    return { ok: true, overdracht: o,
      let: 'Geweigerd. ' + o.vanNaam + ' draagt ' + wat(o) + ' nog steeds, en krijgt dit te zien.' };
  }

  /* Gezien. Alleen de aanbieder, want het bericht is aan hem -- een collega die
     het wegklikt, haalt een antwoord weg dat de aanbieder nooit gelezen heeft. */
  function gezien(h, overdrachtId, wie) {
    const o = doos(h).find((x) => x.id === String(overdrachtId || ''));
    if (!o) return { status: 404, error: 'Deze overdracht kennen we niet.' };
    if (o.stand !== 'geweigerd') return { status: 409, error: 'Hier staat geen weigering.' };
    if (String(o.vanId) !== String(wie.staffId)) {
      return { status: 409, error: 'Dit antwoord is aan ' + o.vanNaam + '.' };
    }
    o.gezienAt = nu();
    return { ok: true, overdracht: o, let: 'Weg. U draagt hem nog steeds.' };
  }

  /* De weigeringen die nog op mijn scherm horen: aan mij gericht en nog niet
     gezien. Oudste onderaan, want het nieuwste antwoord is het antwoord waar
     nog iets mee moet. */
  function antwoorden(h, staffId) {
    return doos(h)
      .filter((o) => o.stand === 'geweigerd' && !o.gezienAt && String(o.vanId) === String(staffId))
      .map((o) => Object.assign({}, o, { staat: minutenSinds(o.geweigerdAt) }));
  }

  return { weiger, gezien, antwoorden };
};
