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

   WAT HIER WEL EEN VRAAG IS, en eerlijk als vraag blijft staan: Cercle ("je
   besloten kring") en Entourage ("je vaste mensen en hun rol") beschrijven
   allebei de mensen om u heen. Dat RUIKT naar twee ingangen naar dezelfde
   capability, en dan zou samenvoegen juist wel mogen. Maar dat vaststellen
   vraagt eerst een blik in hun twee kernen, en apps samenvoegen op een
   vermoeden is precies wat de regel verbiedt. Het staat daarom hier
   opgeschreven als het volgende onderzoek, niet als een uitgevoerde keuze.

   De kern wordt LAAT gelezen, om dezelfde reden als bij kern/reiswereld.js en
   kern/kantoorwereld.js. */
module.exports.maakSocialeWereld = ({ kern }) => {

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

  const regel = (soort, o) => {
    const st = String(o.status || '').toLowerCase();
    const b = BETEKENIS[st] || {};
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
  function bron(naam, fn, uit, stil) {
    try { for (const r of fn() || []) uit.push(r); }
    catch (e) { stil.push(naam); }
  }

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

    bron('bijeenkomsten', () => {
      const b = kern.bijeenkomst.mijnAgenda({ key }) || {};
      return (b.komt || []).slice(0, 8).map(x => regel('bijeenkomst', {
        titel: x.titel, wanneer: x.datum, tijd: x.tijd,
        status: dag(x.datum) === nu ? 'vandaag' : 'open',
        door: x.groep, kenmerk: x.id, app: 'Genootschap', link: '/apps/genootschap.html'
      }));
    }, uit, stil);

    bron('kring', () => {
      const p = kern.pulseFeed(key, 'volgend') || {};
      return (p.feed || []).slice(0, 5).map(x => regel('bericht', {
        titel: (x.tekst || '').slice(0, 70) || 'Bericht',
        wanneer: x.at, status: 'rustig', door: x.naam || x.door || null,
        kenmerk: x.id, app: 'Pulse', link: '/apps/pulse.html'
      }));
    }, uit, stil);

    /* Wat op u wacht bovenaan, daarna op tijd. Dezelfde rangorde als de andere
       twee werelden. */
    const rang = { incident: 0, aandacht: 1, actief: 2, gezond: 3, '': 4 };
    const regels = uit.sort((a, b) =>
      (rang[a.sig] - rang[b.sig]) ||
      String(a.wanneer || '9999').localeCompare(String(b.wanneer || '9999')) ||
      String(a.tijd || '').localeCompare(String(b.tijd || '')));

    const telling = {
      regels: regels.length,
      vandaag: regels.filter(r => r.wanneer === nu).length,
      aandacht: regels.filter(r => r.sig === 'aandacht' || r.sig === 'incident').length,
      wachtend: regels.filter(r => !!r.wacht).length,
      onbekend: regels.filter(r => !r.sig).length
    };

    return { ok: true, regels, telling, stil,
      bronnen: ['gesprekken', 'bijeenkomsten', 'kring'] };
  }

  return { socialewereld: { kring } };
};
