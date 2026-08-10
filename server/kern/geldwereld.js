/* RTG Geld: de samenhanglaag over de geldwereld (PLATFORM.md par. 0: een van
   de acht werelden).

   Wat dit WEL is: één plek waar staat hoe u er financieel voor staat -- het
   saldo van uw RTG-wallet, wat er open staat in uw verreken-lijstjes, wat u
   heeft toegezegd aan goede doelen -- ongeacht in welke module het leeft.

   Wat dit NIET is, en niet mag worden: een eigen boekhouding. Deze module
   heeft geen eigen collectie, schrijft nooit, en telt vooral niets ZELF op wat
   een domein al optelt: pay houdt zijn eigen dubbel boekhouden bij, wbw zijn
   eigen saldi, mecenaat zijn eigen sommen. Hier worden die uitkomsten alleen
   naast elkaar gezet. Zou deze laag zelf gaan rekenen, dan bestaan er twee
   totalen die uit elkaar kunnen lopen -- en een geldscherm dat een ander getal
   toont dan de wallet is erger dan geen geldscherm (LAT.md regel 4).

   Zelfde vorm als reiswereld, kantoorwereld en socialewereld, tot en met de
   woorden voor de toestanden. De kern wordt LAAT gelezen, om dezelfde reden. */
module.exports.maakGeldwereld = ({ kern }) => {

  const vandaag = () => new Date().toISOString().slice(0, 10);

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
      soort, titel: o.titel || '', wanneer: o.wanneer || null,
      status: o.status || '',
      sig: b.sig || '', teken: b.teken || '', wacht: b.wacht || '',
      /* Bedragen in CENTEN. Het scherm maakt er euro's van; twee afrondlagen
         zijn een cent verschil die niemand kan verklaren.

         Hier stond "zoals elk gelddomein hier ze bewaart", en dat is niet
         waar: mecenaat bewaart hele euro's. Die onware zin heeft de fout een
         tijd verborgen gehouden, want wie hem las hoefde niet meer te kijken.
         Elke bron rekent nu zelf om, en dit is de plek waar dat moet. */
      centen: Number.isFinite(o.centen) ? Math.round(o.centen) : null,
      kenmerk: o.kenmerk || '', app: o.app, link: o.link
    };
  };

  /* Een bron die stukgaat mag de andere niet meenemen, en mag ook niet stil
     verdwijnen. Bij geld weegt dat het zwaarst van alle werelden: een
     geldbeeld zonder de openstaande verrekeningen LIJKT gezond, en dan doet
     iemand een uitgave die hij niet had gedaan. */
  function bron(naam, fn, uit, stil) {
    try { for (const r of fn() || []) uit.push(r); }
    catch (e) { stil.push(naam); }
  }

  function stand(key) {
    const uit = [], stil = [];
    const nu = vandaag();

    /* Het walletsaldo komt uit pay, dat dubbel boekhoudt. GEEN eigen som.
       De rekening heet 'lid:' + CODENAAM (niet de sleutel) -- dezelfde vorm
       als kern/ov/reizen.js hem afleidt. Die regel woont in pay.rekLid, dus
       die gebruiken we en tikken we niet na. */
    bron('wallet', () => {
      const rek = kern.pay.rekLid(kern.codenaamVan(key));
      return [regel('saldo', {
        titel: 'RTG-wallet', status: 'rustig', centen: kern.pay.saldoVan(rek),
        kenmerk: 'wallet', app: 'Betalen', link: '/apps/geld.html#wallet'
      })];
    }, uit, stil);

    /* Wie-betaalt-wat: alleen lijstjes waar uw saldo niet nul is. Een lijstje
       dat glad staat is geen openstaande zaak. */
    bron('verrekeningen', () => {
      const w = kern.wbwMijn(key) || {};
      return (w.groepen || []).filter(g => g.mijnSaldo !== 0).slice(0, 6)
        .map(g => regel('verrekening', {
          titel: g.naam, status: 'gedeeld', centen: g.mijnSaldo,
          kenmerk: g.id, app: 'Wie betaalt wat', link: '/apps/geld.html#wbw'
        }));
    }, uit, stil);

    /* Mecenaat: wat toegezegd is en nog niet betaald. De sommen komen uit de
       module zelf. */
    bron('toezeggingen', () => {
      /* de kijk-variant: kern.mecenaat() gaat via L() en ZET het hele
         lifestyle-dossier op voor wie alleen keek (zie het waarom in
         kern/rechterhand/mecenaat.js) */
      return (kern.mecenaatKijk(key) || []).filter(g => !g.betaald).slice(0, 6)
        .map(g => regel('toezegging', {
          titel: g.doel, wanneer: g.datum || null,
          status: g.datum && g.datum < nu ? 'verlopen' : 'open',
          /* maal honderd: mecenaat bewaart hele euro's en niet centen (zie
             kern/rechterhand/mecenaat.js). Stond hier rauw, en toonde een
             toezegging van 500 euro dus als 5 euro. */
          centen: Math.round((Number(g.bedrag) || 0) * 100),
          kenmerk: g.id, app: 'Mecenaat', link: '/apps/geld.html#mecenaat'
        }));
    }, uit, stil);

    const rang = { incident: 0, aandacht: 1, actief: 2, gezond: 3, '': 4 };
    const regels = uit.sort((a, b) =>
      (rang[a.sig] - rang[b.sig]) ||
      String(a.wanneer || '9999').localeCompare(String(b.wanneer || '9999')));

    const telling = {
      regels: regels.length,
      vandaag: regels.filter(r => r.wanneer === nu).length,
      aandacht: regels.filter(r => r.sig === 'aandacht' || r.sig === 'incident').length,
      wachtend: regels.filter(r => !!r.wacht).length,
      onbekend: regels.filter(r => !r.sig).length
    };

    return { ok: true, regels, telling, stil,
      bronnen: ['wallet', 'verrekeningen', 'toezeggingen'] };
  }

  return { geldwereld: { stand } };
};
