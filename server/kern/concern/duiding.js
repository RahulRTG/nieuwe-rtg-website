/* CONCERN (deelmodule): een vrije naam DUIDEN -- achteraf vastleggen wie een
   bestuurder of gevolmachtigde is.

   Sinds 23 september 2026 is een nieuwe bestuurder een codenaam of uitdrukkelijk
   extern (./persoon.js). De feiten van daarvoor dragen een vrije naam, en die
   tellen voor de tekengrens in het Werk OS niet mee: een naam die niemand heeft
   gecontroleerd vergelijken met een codenaam is raden. Deze module is de weg
   om zo'n oud feit alsnog te duiden, door de eigenaar van de entiteit.

   DIT IS EEN CORRECTIE VAN WIE, GEEN WISSELING VAN BESTUUR. Dat verschil is de
   hele module. Beeindigen plus opnieuw zetten zou in de tijdmachine een aftreden
   en een aantreden laten zien die nooit gebeurden -- en ./tijd.js sluit de oude
   loop op de dag voor de nieuwe, dus de persoon zou een dag geen bestuurder zijn
   geweest. Daarom:

     - het oude feit blijft in de opslag staan, als `vervallen`, met de reden
       erbij (dezelfde vorm als "overschreven" in ./tijd.js -- niets wordt gewist);
     - het nieuwe feit krijgt precies HETZELFDE venster, dezelfde waarde en de
       juridische BRON van het oude: wat de akte zei, verandert niet;
     - de duiding zelf draagt een EIGEN bron en wie haar deed (`duiding`), want
       "dit is codenaam X" is een tweede bewering naast de akte.

   WAT NIET KAN, en waarom:
     - een feit dat al op een codenaam staat opnieuw duiden. Een andere mens is
       een ander feit: beeindig het en zet een nieuw. Anders is dit een weg om
       stil de persoon achter een lopende volmacht te verwisselen;
     - een duiding naar een codenaam die al een eigen lopend feit van dezelfde
       soort bij deze entiteit heeft: dan staat een mens er twee keer. */
'use strict';

const { bron: maakBron } = require('./bron');
const { MET_PERSOON } = require('./persoon');

module.exports = ({ opslag, save, crypto }) => {
  const bak = () => opslag.tak('feiten');

  /* `naar` komt uit ./persoon.js (duidBestuurder): { sleutel, extern }. De
     codenaam is daar al in de gids opgezocht; hier wordt niets geraden. */
  function duid(entiteit, feitId, naar, opties) {
    const o = opties || {};
    const f = bak().find(x => x.id === feitId && x.entiteit === entiteit && !x.vervallen);
    if (!f) return { status: 404, error: 'Dit gegeven bestaat niet.' };
    if (!MET_PERSOON.includes(f.soort)) return { status: 400,
      error: 'Alleen een bestuurder of gevolmachtigde wordt geduid; een ' + f.soort + ' draagt geen tekenlimiet.' };
    const was = f.extra && typeof f.extra.extern === 'boolean' ? (f.extra.extern ? 'extern' : 'codenaam') : 'vrij';
    if (was === 'codenaam') return { status: 409,
      error: 'Dit gegeven staat al op een codenaam. Gaat het om een andere persoon, beeindig het dan en leg een nieuw gegeven vast.' };
    if (was === 'extern' && naar.extern) return { status: 409, error: 'Dit gegeven staat al als extern vastgelegd.' };
    if (!naar.extern && bak().some(x => x !== f && x.entiteit === entiteit && x.soort === f.soort && !x.vervallen
      && x.sleutel === naar.sleutel && (x.tot === null || f.tot === null || String(x.tot) >= String(f.van)))) {
      return { status: 409, error: naar.sleutel + ' staat bij deze entiteit al als ' + f.soort + '. Dezelfde mens twee keer vastleggen maakt de tekengrens onleesbaar.' };
    }
    const b = maakBron(o.bronSoort, o.bronDetail, o.wie);
    if (b.error) return { status: 400, error: b.error, uitleg: b.uitleg };

    const at = new Date().toISOString();
    const nieuw = Object.assign({}, f, {
      id: 'feit_' + crypto.randomBytes(6).toString('hex'),
      sleutel: naar.extern ? f.sleutel : naar.sleutel,
      extra: Object.assign({}, f.extra || {}, { extern: !!naar.extern }),
      duiding: { vorige: f.id, was, bron: b.bron, at },
      gezet: at
    });
    f.vervallen = true;
    f.vervallenOm = naar.extern ? 'geduid als extern' : 'geduid als codenaam ' + naar.sleutel;
    f.vervangenDoor = nieuw.id;
    bak().push(nieuw);
    save();
    return { ok: true, feit: { id: nieuw.id, soort: nieuw.soort, sleutel: nieuw.sleutel, van: nieuw.van, tot: nieuw.tot,
      extern: !!naar.extern, was, vorige: f.id } };
  }

  return { tijdDuid: duid };
};
