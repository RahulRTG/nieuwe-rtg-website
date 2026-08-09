/* Media OS (deelmodule): MEDIA FOR BUSINESS -- de interne wereld van uw
   organisatie.

   WAAROM DIT GEEN FILTER IS, en dat is het hele punt. Een laag boven de vier
   domeinen kan alleen kiezen uit wat er al is, en alles wat er al is, is
   openbaar. Een "interne" wereld die bestaat uit een selectie van openbaar werk
   zou het woord intern gebruiken voor iets wat het niet is -- en niemand merkt
   dat verschil tot het misgaat. Intern moet daarom bij het PUBLICEREN
   vastliggen, en dat gebeurt in de domeinen zelf:

     - kern/theater/zaak.js  -- de interne videobibliotheek van een zaak;
     - kern/podium (zone 'zaak') -- de interne uitzending van een zaak.

   Allebei hangen ze aan dezelfde bron voor "wie werkt waar" (kern/
   werkplekken.js, uit de personeelsadministratie). Dit bestand voegt daar
   niets aan toe: het zet de twee naast elkaar in één stand en vraagt beide
   lezers om wat ZIJ voor dit lid vrijgeven. Er komt hier dus geen enkel stuk
   binnen dat niet al intern was.

   De stand verschijnt alleen bij wie ergens werkt. Een tab die altijd nee zegt
   is geen stand maar een deur naar niets. */
'use strict';

module.exports = ({ MODI, catalogus, bronnen }) => {
  /* ---- MEDIA FOR BUSINESS: de interne wereld van uw organisatie ----
     Twee bronnen, allebei al intern aan de bron: de opgenomen bibliotheek van
     het Theater en de interne livekanalen van het Podium. De Media OS voegt
     hier niets samen wat niet al bij elkaar hoort, en filtert niets openbaars
     "intern" -- dat kan hij ook niet, want deze twee lezers geven alleen wat
     bij een zaak van dit lid hoort. */
  function zaakWereld(sess) {
    const zaken = bronnen.zakenVan ? (bronnen.zakenVan(sess.key) || []) : [];
    if (!zaken.length) {
      return { status: 200, modus: 'zaak', modusNaam: MODI.zaak.naam, mag: false, zaken: [], stukken: [],
        /* Zelfde vorm als kern/mediaos/leeg.js gebruikt, want het scherm tekent
           een lege stand op precies een manier. Een tweede vorm hier zou een
           tweede tekenpad in de app vragen. */
        leeg: { titel: 'Deze wereld is van organisaties',
          wat: 'Hier staat het interne werk van de zaak waar u werkt: video die uw organisatie zelf publiceert, en haar interne uitzendingen.',
          waarom: 'U werkt nergens waar RTG van weet, dus er is niets om te tonen.',
          stappen: [{ pad: '/apps/app.html', tekst: 'Vraag uw werkgever om de uitnodiging' }] },
        modi: modiVoor(sess), uitleg: 'Wat hier zou staan, is van uw organisatie en staat in geen openbare lijst.' };
    }
    const uit = [];
    for (const v of (bronnen.videosZaak ? (bronnen.videosZaak(sess.key) || []) : []))
      uit.push(catalogus.vanVideo(v, sess.key, false, v.mijn));
    for (const k of (bronnen.liveZaak ? (bronnen.liveZaak(sess.key) || []) : []))
      uit.push(catalogus.vanLive(k, sess.key));
    return { status: 200, modus: 'zaak', modusNaam: MODI.zaak.naam, mag: true,
      /* Elke zaak met haar eigen naam en kleur (kern/theater/huisstijl.js).
         De Media OS verzint dat merk niet: hij vraagt het aan de bron die het
         beheert, en die zet er zelf bij waar het ophoudt. */
      zaken: merkVan(sess.key, zaken),
      stukken: uit, totaal: uit.length,
      leeg: uit.length ? null : { titel: 'Nog niets intern gepubliceerd',
        wat: 'Hier komt het interne werk van uw organisatie te staan: video uit haar eigen bibliotheek en haar interne uitzendingen.',
        waarom: 'Uw organisatie heeft er nog geen.',
        stappen: [{ pad: '/apps/theater.html', tekst: 'Interne bibliotheek (de leiding)' },
          { pad: '/apps/podium.html', tekst: 'Interne uitzending (de leiding)' }] },
      modi: modiVoor(sess),
      einde: 'Dat is alles wat er intern staat.',
      uitleg: 'Alles hier is van uw organisatie: het staat in geen enkele openbare lijst, niet op een profielkaart ' +
        'en niet in de gedeelde mediawereld. Wie er niet werkt, komt er ook met een link niet bij.' };
  }
  /* De standen die DIT lid te zien krijgt. De zakenstand staat er alleen bij
     wie ergens werkt: een lege tab die altijd nee zegt, is geen stand maar een
     deur naar niets. */
  /* De zaken van dit lid, aangevuld met hun huisstijl. Zonder die bron (of als
     er nog geen bibliotheek staat) blijft het gewoon naam en code -- geen
     verzonnen merk. */
  function merkVan(key, zaken) {
    const merken = bronnen.merkZaak ? (bronnen.merkZaak(key) || []) : [];
    return zaken.map(z => {
      const m = merken.find(x => x.code === z.code);
      return { code: z.code, naam: z.naam, leiding: z.leiding,
        huisstijl: (m && m.huisstijl) || null };
    });
  }

  function modiVoor(sess) {
    const heeftZaak = bronnen.zakenVan ? (bronnen.zakenVan(sess.key) || []).length > 0 : false;
    return Object.keys(MODI).filter(k => k !== 'zaak' || heeftZaak).map(k => ({ id: k, naam: MODI[k].naam }));
  }

  return { zaakWereld, modiVoor };
};
