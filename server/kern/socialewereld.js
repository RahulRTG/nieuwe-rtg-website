/* RTG Sociaal: de samenhanglaag over de sociale wereld (laag 2 uit PLATFORM.md).

   Wat dit WEL is: één plek waar staat wat er tussen u en de mensen om u heen
   speelt -- een gesprek dat op antwoord wacht, een bijeenkomst die eraan komt,
   wat er in uw kring geplaatst is.

   Wat dit NIET is, en niet mag worden: een eigen sociaal netwerk. Deze module
   heeft geen eigen collectie, schrijft nooit, en bewaart niets. Praten,
   plaatsen en aanmelden gebeurt in de app die het echte werk doet.

   DE TOETSVRAAG UIT PLATFORM.md, hier toegepast. Van de tien sociale apps is
   er geen enkele die alleen maar een tweede ingang is:

     Berichten (comm)   eigen gesprekskern, laden, bijlagen, bellen. Zelfstandig.
     De Salon           besloten netwerk met eigen curatie. Zelfstandig.
     Genootschap        groepen met prikbord, peilingen, bijeenkomsten. Zelfstandig.
     Pulse              de rustige dagbundeling. Zelfstandig.
     Vonk               kennismaken, eigen kern. Zelfstandig.
     Meet               vergaderkamers, WebRTC. Zelfstandig.
     Attenties          cadeaus en attenties. Zelfstandig.

   CERCLE EN ENTOURAGE ZIJN ONDERZOCHT, en blijven apart. Ze stonden hier als
   verdacht omdat hun omschrijvingen allebei "de mensen om u heen" beloofden.
   In de kernen kijken gaf het omgekeerde antwoord: Cercle houdt CLUBS bij
   (stad, lidnummer, dresscode, reciprociteit, gastpassen) en Entourage MENSEN
   (band, dieet, documenten met vervaldatum). Andere data, andere werkstroom.
   Wat ze deelden was een routevoorvoegsel, en dat is geen gedeelde kern.
   Fout zat dus in de beschrijving, niet in de architectuur -- zie PLATFORM.md.

   De kern wordt LAAT gelezen, om dezelfde reden als bij kern/reiswereld.js en
   kern/kantoorwereld.js. */
module.exports.maakSocialeWereld = ({ kern }) => {

  /* De grammatica van een wereld staat op EEN plek (kern/wereldkern.js): de
     vier signalen, hun volgorde, en het vangnet dat een stukke bron meldt
     zonder de rest mee te nemen. Die stonden hier als eigen kopie -- in alle
     vier de werelden letterlijk hetzelfde -- en dan bedoelt de eerste die er
     een verandert iets anders met hetzelfde woord (LAT.md regel 4).

     Het WOORDENBOEK blijft hier: welke statussen deze wereld kent, weet
     alleen deze wereld. En het sorteren en tellen ook, want die VERSCHILLEN
     per wereld met reden; ze samenvoegen zou van vier werelden een grijze
     middelmaat maken (zie het waarom in wereldkern.js). */
  const { RANG, bron, betekenisVan, standVan } = require('./wereldkern');

  /* Laag 0 van het Command Canvas: het woord waarmee deze wereld opent
     (CANVAS.md, waar Social letterlijk 'Levendig' heet bij vier mensen die op
     je wachten). Hier is aandacht dus GEEN alarm: mensen die iets van u willen
     is precies waar een sociale wereld voor bestaat. Een stand die daar 'Druk'
     van maakt, maakt van vrienden een werkvoorraad. */
  const meetStand = standVan({ verstoord: 'Verstoord', aandacht: 'Levendig', gezond: 'Rustig' });

  const dag = (d) => String(d || '').slice(0, 10);
  const vandaag = () => new Date().toISOString().slice(0, 10);

  /* Dezelfde woorden als in de twee andere werelden, met opzet. Drie
     samenhanglagen die elk hun eigen vocabulaire verzinnen zijn drie
     producten (LAT.md regel 4, ONTWERP.md par. 3 en 5). */
  const BETEKENIS = {
    verlopen:  { sig: 'incident', teken: '!' },
    vandaag:   { sig: 'aandacht', teken: '!' },
    open:      { sig: 'actief', teken: '◷' },
    gedeeld:   { sig: 'actief', teken: '◷', wacht: 'de ander' },
    rustig:    { sig: 'gezond', teken: '✓' }
  };
  /* Door de poort: betekenisVan weigert een status die een signaal noemt
     dat niet bestaat. Zonder die controle gaf een onbekend signaal stil NaN
     in de vergelijking en sorteerde de hele rij gewoon niet. */
  const betekenis = betekenisVan(BETEKENIS);

  const regel = (soort, o) => {
    const st = String(o.status || '').toLowerCase();
    const b = betekenis(st);
    return {
      soort, titel: o.titel || '', wanneer: dag(o.wanneer) || null,
      tijd: o.tijd || null, status: o.status || '',
      sig: b.sig || '', teken: b.teken || '', wacht: b.wacht || '',
      // alleen meesturen wat het domein echt weet
      door: o.door || null, open: o.open || null,
      kenmerk: o.kenmerk || '', app: o.app, link: o.link
    };
  };

  /* Een bron die stukgaat mag de andere niet meenemen, en mag ook niet stil
     verdwijnen. Een sociaal beeld dat na een storing twee van de drie bronnen
     toont, lijkt compleet -- en dan blijft iemand onbeantwoord. */

  function kring(key) {
    const uit = [], stil = [];
    const nu = vandaag();

    /* ALLEEN WAT OP U WACHT. Een inbox uitputtend herhalen is het werk van
       Berichten zelf; hier hoort alleen te staan wat onbeantwoord is. Zou dit
       scherm elk gesprek tonen, dan is het een tweede inbox en geen beeld. */
    bron('gesprekken', () => {
      const i = kern.comm.inbox(key) || {};
      return (i.gesprekken || []).filter(g => g.ongelezen > 0 && !g.stil)
        .slice(0, 8)
        .map(g => regel('gesprek', {
          titel: g.titel, wanneer: g.at, status: 'open', open: g.ongelezen,
          kenmerk: g.id, app: 'Berichten', link: '/apps/comm.html'
        }));
    }, uit, stil);

    /* HET DOMEIN LEVERT `wat`, NIET `titel`. Hier stond `x.titel`, en dat is
       altijd undefined geweest: kern/genootschap/bijeenkomst.js bouwt zijn rijen
       met publiek(), en die kent geen veld `titel`. Elke bijeenkomst stond dus
       zonder titel op het scherm, zonder dat iets klaagde -- een lege string is
       een geldige string. De toets miste het omdat zijn nagemaakte agenda wel
       een `titel` teruggaf; die is meeverbeterd, want een namaakbron die niet op
       de echte lijkt, bewijst niets (LAT.md regel 2). */
    bron('bijeenkomsten', () => {
      const b = kern.bijeenkomst.mijnAgenda({ key }) || {};
      /* `wat` en niet `titel`: zo heet het veld bij de bijeenkomst zelf
         (kern/genootschap/bijeenkomst.js, publiek()). Hier stond x.titel, en
         dat bestaat daar niet -- elke bijeenkomst kwam dus NAAMLOOS binnen en
         het scherm viel terug op het woord "Bijeenkomst". Dat viel niet op
         zolang het een regel in een register was; op de tijdlijn van vandaag is
         een moment zonder naam meteen zinloos. */
      return (b.komt || []).slice(0, 8).map(x => regel('bijeenkomst', {
        titel: x.wat, wanneer: x.datum, tijd: x.tijd,
        status: dag(x.datum) === nu ? 'vandaag' : 'open',
        door: x.groep, kenmerk: x.id, app: 'Genootschap', link: '/apps/genootschap.html'
      }));
    }, uit, stil);

    /* En dezelfde fout stond hier: Pulse levert de afzender als `codenaam`
       (kern/pulse/index.js, publiek()). `x.naam || x.door` was allebei
       undefined, dus elk bericht in de kring stond zonder afzender -- terwijl
       juist bij een sociaal bericht de afzender het halve bericht is. */
    bron('kring', () => {
      const p = kern.pulseFeed(key, 'volgend') || {};
      return (p.feed || []).slice(0, 5).map(x => regel('bericht', {
        titel: (x.tekst || '').slice(0, 70) || 'Bericht',
        wanneer: x.at, status: 'rustig', door: x.codenaam || null,
        kenmerk: x.id, app: 'Pulse', link: '/apps/pulse.html'
      }));
    }, uit, stil);

    /* Wat op u wacht bovenaan, daarna op tijd. Dezelfde rangorde als de andere
       twee werelden. */
    const regels = uit.sort((a, b) =>
      (RANG[a.sig] - RANG[b.sig]) ||
      String(a.wanneer || '9999').localeCompare(String(b.wanneer || '9999')) ||
      String(a.tijd || '').localeCompare(String(b.tijd || '')));

    const telling = {
      regels: regels.length,
      vandaag: regels.filter(r => r.wanneer === nu).length,
      aandacht: regels.filter(r => r.sig === 'aandacht' || r.sig === 'incident').length,
      wachtend: regels.filter(r => !!r.wacht).length,
      onbekend: regels.filter(r => !r.sig).length
    };

    /* Laag 0: het oordeel in EEN woord, hier berekend en niet op het scherm
       (CANVAS.md). */
    return { ok: true, regels, stand: meetStand(regels, stil), telling, stil,
      bronnen: ['gesprekken', 'bijeenkomsten', 'kring'] };
  }

  return { socialewereld: { kring } };
};
