/* DE INGEVOERDE ONDERDELEN (hoort bij kern/invoer.js).

   De balie leest en laat bevestigen; dit bestand gaat over wat er daarna met de
   onderdelen gebeurt: opvragen, weghalen, doorgeven aan de reiswereld, en
   overnemen uit een reisuitnodiging.

   DAT LAATSTE IS DE REDEN DAT DIT BESTAND ER IS. Een reis die het kantoor
   klaarzette, of die een reisgenoot deelde, moet ergens landen -- en dat is hier
   en niet in een eigen bak van de uitnodigingen. Anders zijn er twee plekken die
   weten wat er in uw reis staat, en dan geeft "waar staat mijn reis" binnen een
   maand twee antwoorden (LAT-regel 4). */
'use strict';

module.exports = ({ bak, save, crypto, nu, schoon }) => {

  const mijn = (key) => (bak().items || []).filter(x => x.key === key).slice(0, 100);

  /* Weghalen mag altijd: wie zijn reis hier onderbrengt, moet hem er ook weer
     uit kunnen halen. Het bewijsstuk zelf blijft in de eigen kluis staan -- dat
     is van het lid en niet van deze module om weg te gooien. */
  function weg(key, id) {
    const b = bak();
    const i = b.items.findIndex(x => x.id === String(id || '') && x.key === key);
    if (i < 0) return { status: 404, error: 'Dit onderdeel staat niet bij u.' };
    const [uit] = b.items.splice(i, 1);
    save();
    return { ok: true, weg: uit.id, bewijsBlijft: !!(uit.bewijs && uit.bewijs.bestandId) };
  }

  /* De regels voor de reiswereld. Dezelfde vorm als elk ander reisdomein: deze
     laag levert rijen, de wereld maakt er regels van en De Reis groepeert ze. */
  /* Het kenmerk: het boekingsnummer als dat er is, anders het eigen id. Een
     onderdeel ZONDER kenmerk is nergens aan vast te knopen -- de visumtaak
     hangt aan 'reis:<kenmerk>', en de oplosser vond bij een ingevoerd hotel
     zonder boekingsnummer letterlijk niets om een taak aan te hangen. Het
     eigen id is een echte referentie: hij wijst dit onderdeel aan. */
  const mijnRegels = (key) => mijn(key).map(x => ({
    titel: x.titel, bestemming: x.bestemming, van: x.van, tot: x.tot,
    status: x.status, kenmerk: x.kenmerk || x.id, soort: x.soort, herkomst: x.herkomst
  }));

  /* OVERNEMEN UIT EEN UITNODIGING. Er komt hier geen bewijsstuk mee en geen
     lezing: wat een ander of het kantoor las, is hun lezing. Wat de opeiser
     krijgt is de reis zelf, met de stand `ingelezen` -- niemand doet alsof RTG
     dit bevestigd heeft (REIZEN.md par. 4.3).

     De HERKOMST mag de aanroeper opleggen (een reisgenoot deelt: dan is de bron
     voor de ontvanger een ander lid), en anders houdt elk onderdeel de zijne.
     Nooit stil op 'rtg' zetten: dan zou een overgenomen reis eruitzien als iets
     wat RTG verkocht heeft. */
  function neemOver(key, { onderdelen, herkomst, bron }) {
    const rij = Array.isArray(onderdelen) ? onderdelen : [];
    if (!rij.length) return { status: 400, error: 'Er is niets om over te nemen.' };
    const b = bak();
    const uit = rij.map(o => ({
      id: 'I-' + crypto.randomBytes(4).toString('hex'),
      key, soort: o.soort, titel: o.titel, bestemming: o.bestemming || '',
      van: o.van, tot: o.tot || null, kenmerk: o.kenmerk || '',
      status: 'ingelezen', herkomst: herkomst || o.herkomst || 'handmatig',
      bewijs: null, velden: {}, onzeker: [],
      overgenomen: schoon(bron, 120) || null, at: nu()
    }));
    b.items.unshift(...uit);
    b.items = b.items.slice(0, 5000);
    save();
    return { ok: true, onderdelen: uit };
  }

  return { mijn, weg, mijnRegels, neemOver };
};
