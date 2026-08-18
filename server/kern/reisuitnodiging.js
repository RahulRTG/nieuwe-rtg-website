/* DE REISUITNODIGING -- een klaargezette reis, en een link.

   DRIE SCHAKELS, EEN VORM.
   1. Het RTG-reisbureau zet een reis klaar voor iemand die nog geen lid is, en
      stuurt hem een link. Wie die link opent, kan lid worden en de reis
      overnemen.
   2. Een lid nodigt zijn REISGENOOT uit voor dezelfde reis, met dezelfde link.
   3. Die reisgenoot kan het weer doorgeven -- maar alleen als hij zelf een reis
      heeft om te delen. Een uitnodiging is nooit een doorgeefsleutel.

   WAT HIER MET OPZET NIET GEBEURT, en dit is de belangrijkste alinea:

   ER WORDT GEEN PROFIEL AANGEMAAKT VAN IEMAND DIE GEEN LID IS. Een klaargezette
   reis bevat de REIS en niet de PERSOON: geen naam, geen e-mailadres, geen
   telefoonnummer. De medewerker stuurt de link zelf, via zijn eigen kanaal. Dat
   is de striktste vorm en ook de eenvoudigste, en hij volgt rechtstreeks uit
   LIFE.md par. 4.7 (geen schaduwprofielen): wie hier een adresboekje van
   aanstaande klanten van maakt, bouwt precies het dossier dat dit huis niet wil
   hebben. Wordt de reis niet opgeeist, dan verloopt hij en is er niets bewaard
   dat over een mens gaat.

   ER GAAN GEEN BESTANDEN MEE. Een bewijsstuk hoort in de kluis van zijn
   eigenaar; een klaargezette reis heeft nog geen eigenaar, dus zou het in een
   RTG-bak belanden -- een tijdelijke opslag met paspoortscans van niet-leden.
   Het kantoor zet dus de GELEZEN gegevens klaar, niet de documenten. Wat er
   nodig zou zijn om dat wel te doen (een bewaartermijn, een doelbinding en een
   eigenaar) is een eigen besluit en geen bijvangst van deze functie.

   EEN LINK GEEFT NOOIT EEN PAS. Opeisen levert de gewone weg naar een RTG Pass,
   met de ballotage die daarbij hoort. Lifestyle en Business blijven menselijke
   goedkeuring (CLAUDE.md); de uitnodiging draagt daarom geen tier, en er is
   niets aan mee te geven.

   EN DE SLEUTEL IS DE ENTROPIE, niet de rem. De code is 128 bits uit
   crypto.randomBytes: die raad je niet, ook niet met een miljoen pogingen. De
   rem op de publieke route houdt ruis tegen en is geen slot -- dat verschil
   hoort benoemd, want een rem die je voor een slot aanziet is LAT-regel 7 in
   zijn gevaarlijkste vorm.

   WAT EEN NIET-OPGEEISTE LINK LAAT ZIEN: bestemming, periode, hoeveel
   onderdelen en van welke soort, en van wie hij komt (het kantoor, of een
   codenaam). NIET de titels, de kenmerken of de datums per onderdeel. Wie de
   link doorstuurt of kwijtraakt, lekt daarmee geen boekingsnummers. Na het
   opeisen staat alles gewoon in het eigen dossier van de opeiser. */
'use strict';

const DAGEN_GELDIG = 30;
const SOORTEN_UIT = ['klaargezet', 'reisgenoot'];

module.exports.maakReisuitnodiging = ({ db, save, crypto, invoer, idGeverifieerd }) => {
  const nu = () => new Date().toISOString();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);
  const datum = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : null;

  function bak() {
    if (!db.data.reisUitnodigingen || typeof db.data.reisUitnodigingen !== 'object') db.data.reisUitnodigingen = {};
    return db.data.reisUitnodigingen;
  }
  const vindCode = (code) => Object.values(bak()).find(u => u.code === String(code || '').trim()) || null;
  const verlopen = (u) => !!u.geldigTot && u.geldigTot < nu().slice(0, 10);

  /* De onderdelen die meegaan. Alleen wat een reisregel maakt: soort, naam,
     bestemming, datums en het kenmerk. Geen bewijsstukken, geen sleutels, geen
     verwijzing naar de kluis van wie dan ook. */
  function schoneOnderdelen(rij) {
    const uit = [];
    for (const o of (Array.isArray(rij) ? rij : []).slice(0, 40)) {
      const soort = schoon(o && o.soort, 20), titel = schoon(o && o.titel, 120), van = datum(o && o.van);
      if (!soort || !titel || !van) continue;
      uit.push({ soort, titel, van, tot: datum(o.tot), bestemming: schoon(o.bestemming, 80),
        kenmerk: schoon(o.kenmerk, 40), herkomst: schoon(o.herkomst, 20) || 'handmatig' });
    }
    return uit;
  }

  function maak(soort, door, doorCodenaam, onderdelen, doorWie) {
    if (!SOORTEN_UIT.includes(soort)) return { status: 400, error: 'Onbekend soort uitnodiging.' };
    const rij = schoneOnderdelen(onderdelen);
    if (!rij.length) return { status: 400, error: 'Zet eerst minstens één reisonderdeel klaar (met een naam en een datum).' };
    const dagen = rij.map(o => o.tot || o.van).concat(rij.map(o => o.van)).sort();
    const tot = new Date(Date.now() + DAGEN_GELDIG * 86400000).toISOString().slice(0, 10);
    const u = {
      id: 'U-' + crypto.randomBytes(4).toString('hex'),
      // 128 bits: dit is het slot. Zie de kop.
      code: crypto.randomBytes(16).toString('hex'),
      soort, door, doorCodenaam: doorCodenaam || null,
      /* WIE hem maakte staat er los bij, en alleen bij een kantoorbalie. De
         uitnodiging zelf is van HET KANTOOR -- anders ziet een collega de link
         niet die zijn buurman klaarzette, en dan gaat er een tweede lijstje
         circuleren buiten het systeem om. Voor het auditspoor blijft de persoon
         wel staan. */
      doorWie: doorWie || null,
      bestemming: (rij.find(o => o.bestemming) || {}).bestemming || '',
      venster: { van: dagen[0], tot: dagen[dagen.length - 1] },
      onderdelen: rij, geldigTot: tot, ingetrokken: false, opgeeist: null, at: nu()
    };
    bak()[u.id] = u;
    save();
    return { ok: true, uitnodiging: u, link: '/apps/reisuitnodiging.html?code=' + u.code };
  }

  // het kantoor zet een reis klaar voor een klant die nog geen lid hoeft te zijn
  const zetKlaar = (wie, onderdelen) => maak('klaargezet', 'kantoor', null, onderdelen, schoon(wie, 60));
  // een lid nodigt een reisgenoot uit voor onderdelen uit zijn eigen reis
  const nodigUit = (key, codenaam, onderdelen) => maak('reisgenoot', key, schoon(codenaam, 60), onderdelen);

  /* Openen, opeisen, intrekken en de lijst staan in ./reisuitnodiging-gebruik.js:
     het MAKEN van een uitnodiging en het GEBRUIKEN ervan zijn twee kanten met
     elk hun eigen zorgen (wat er te zien is vóór het opeisen, de
     identiteitscontrole, wie mag intrekken). Zelfde bak, doorgegeven. */
  const gebruik = require('./reisuitnodiging-gebruik')({ bak, save, vindCode, verlopen, invoer, idGeverifieerd, nu });

  return { reisuitnodiging: Object.assign({ zetKlaar, nodigUit }, gebruik) };
};
