/* HET BESTUUR, deel "persoon": naar WIE wijst deze regel, en hoe zeker is dat.

   CONCERN.md zegt dat elk juridisch gegeven een bron en een geschiedenis heeft.
   Het bestuursregister had de geschiedenis wel (aftreden wist niet) en de bron
   niet: een bestuurder was een stukje tekst van zestig tekens. Je kon er een
   codenaam in zetten die niet bestaat, of die van iemand anders, en niets in
   het huis merkte dat. Bij een UBO-opgave is dat precies het veld dat ertoe
   doet.

   TWEE SOORTEN REGELS, EN DAT IS GEEN DETAIL:

     lid     de codenaam is opgezocht in de ledengids en wijst naar een echt
             account. De sleutel gaat mee, en het betrouwbaarheidsniveau van
             dat lid op het moment van inschrijven (kern/betrouwbaarheid.js).
     extern  een medeoprichter, investeerder of bestuurder die geen RTG-lid is.
             Dat bestaat echt en mag dus niet geweigerd worden -- maar het moet
             met zoveel woorden gezegd worden (`extern: true`), zodat het als
             een BEWERING in het register staat en niet als een vaststelling.

   WAAROM EEN ONBEKENDE CODENAAM WORDT GEWEIGERD in plaats van stil als extern
   te worden opgeslagen: dan is een typefout in de codenaam van een echte
   medebestuurder niet te onderscheiden van een bewuste opgave van iemand van
   buiten. De eerste hoort te worden verbeterd, de tweede te worden vastgelegd.

   HET NIVEAU WORDT BEVROREN OP HET MOMENT VAN INSCHRIJVEN, en niet live
   herrekend. Een register hoort te zeggen wat er bekend was toen de beslissing
   viel; wie wil weten hoe het er NU voor staat, kijkt in de ledengids. Zou het
   meebewegen, dan verandert de geschiedenis met terugwerkende kracht -- en dat
   is het enige wat een register nooit mag doen.

   WAT HIER NIET GEBEURT: toestemming vragen aan de ander. Dit register is de
   voorbereiding op een opgave bij de Kamer van Koophandel en heeft zelf geen
   rechtsgevolg voor die persoon; een bevestigingsstroom zou een zwaarte
   suggereren die dit scherm niet heeft. Wat er wel staat, is of RTG die persoon
   kent en hoe goed. */

'use strict';

const { voldoet } = require('../betrouwbaarheid');

module.exports = ({ scho, keyVanCodenaam, lidstandVan }) => {

  /* Naar wie wijst deze opgave? Levert een persoonsregel, of een fout die
     zegt wat de ondernemer moet doen. */
  async function duidPersoon(body, wat) {
    const codenaam = scho((body || {}).codenaam, 60);
    if (codenaam.length < 2) return { status: 400, error: 'Geef de codenaam van de ' + wat + ' op.' };

    let lid = null;
    try { lid = typeof keyVanCodenaam === 'function' ? await keyVanCodenaam(codenaam) : null; }
    catch (e) { lid = null; }

    if (lid && lid.key) {
      let niveau = null;
      try {
        const st = typeof lidstandVan === 'function' ? lidstandVan(lid.key) : null;
        niveau = st && st.niveau ? st.niveau.id : null;
      } catch (e) { niveau = null; }
      return { soort: 'lid', codenaam: lid.codename || codenaam, key: lid.key, niveauBij: niveau };
    }

    if ((body || {}).extern === true) {
      return { soort: 'extern', codenaam, key: null, niveauBij: null };
    }
    return { status: 404,
      error: 'Wij kennen geen RTG-lid met de codenaam "' + codenaam + '".',
      uitleg: 'Klopt de codenaam? Verbeter hem dan. Gaat het om iemand van buiten RTG -- een ' +
        'medeoprichter of investeerder zonder lidmaatschap -- geef dat dan aan; die staat dan als ' +
        'opgave in uw register en niet als iemand die wij hebben herkend.',
      extern: false };
  }

  /* Wat een regel over zijn eigen grond zegt, in de woorden van het scherm. */
  function grondVan(x) {
    if (!x || x.bron !== 'lid') return { bron: 'extern', niveau: null,
      tekst: 'Opgegeven door u; deze persoon is geen RTG-lid, dus wij hebben de identiteit niet gezien.' };
    if (!x.niveauBij) return { bron: 'lid', niveau: null,
      tekst: 'Een RTG-lid, maar het betrouwbaarheidsniveau is bij het inschrijven niet vastgelegd.' };
    return { bron: 'lid', niveau: x.niveauBij,
      tekst: 'Een RTG-lid; bij het inschrijven stond de identiteit op niveau ' + x.niveauBij + '.' };
  }

  /* Hoe hard staat de UBO-opgave die hieruit volgt? Niet als cijfer maar als
     lijst met wat er per persoon ontbreekt: een score zou suggereren dat een
     zeven ook goed genoeg is, en bij een UBO-opgave is dat niet zo. */
  function grondslag(personen, rijen) {
    const zoek = c => rijen.find(r => r.codenaam === c) || null;
    const uit = (personen || []).map(p => {
      const g = grondVan(zoek(p.codenaam));
      return { codenaam: p.codenaam, bron: g.bron, niveau: g.niveau };
    });
    /* "Sterk genoeg" is A3: RTG heeft het identiteitsbewijs gezien. Die
       vergelijking komt uit kern/betrouwbaarheid.js en wordt hier niet
       nagebouwd -- de treden lopen op hun RANG en niet op hun letter, en een
       eigen `<`-vergelijking op de naam gaat stuk zodra er een trede bijkomt
       die niet netjes achteraan in het alfabet valt. */
    const zwak = uit.filter(p => p.bron !== 'lid' || !voldoet(p.niveau, 'A3'));
    /* Eerst wie het betreft, in gewoon Nederlands. "Van 1 van de 1
       belanghebbenden" is geen zin die iemand hardop zou zeggen, en op een
       scherm dat over een juridische opgave gaat leest houterig als slordig. */
    const staart = ' Bij de Kamer van Koophandel hoort daar een identiteitsbewijs bij; ' +
      'dit register vervangt dat niet en doet ook niet alsof.';
    const kop = !zwak.length ? null
      : uit.length === 1 ? 'RTG heeft de identiteit van de belanghebbende niet gecontroleerd.'
      : zwak.length === uit.length
        ? 'RTG heeft van geen van de ' + uit.length + ' belanghebbenden de identiteit gecontroleerd.'
        : 'RTG heeft de identiteit van ' + zwak.length + ' van de ' + uit.length +
          ' belanghebbenden niet gecontroleerd.';
    return { personen: uit, let: kop ? kop + staart : null };
  }

  return { duidPersoon, grondVan, grondslag };
};
