/* WELKE KAARTEN WIL DIT LID HEBBEN -- en wat dat vandaag betekent.

   RTG biedt elk gebied aan dat de bron kan leveren (./gebieden.js), maar
   niemand krijgt tweehonderd landen opgedrongen: een lid kiest zelf welke
   kaarten hij wil. Dit is die keuze, en niets meer.

   WAT DE KEUZE VANDAAG DOET, EERLIJK OPGESCHREVEN. Er is een stap die er staat
   en een stap die er niet staat, en ze door elkaar laten lopen zou de
   gevaarlijkste vorm van marketing zijn:

     WAT ER STAAT   RTG weet welke kaarten dit lid wil hebben. Een gekozen
                    gebied dat GEBOUWD is, is meteen bruikbaar -- de route
                    rekent op dat pakket (./gebiednetten.js). Een gekozen
                    gebied dat alleen AANGEBODEN is, is een verzoek: RTG weet
                    daarmee wat er gebouwd moet worden, en dat is precies de
                    weg "via ons".
     WAT ER NIET IS Het pakket staat op de server van RTG en niet op het
                    toestel. Werkelijk offline navigeren vraagt de graaf in de
                    browser, en dat is een volgende stap. Elk antwoord van deze
                    laag draagt daarom `opToestel: false` met de reden -- geen
                    lege waarde, want een leeg veld wordt door de lezer met zijn
                    eigen aanname gevuld.

   DE SLEUTEL IS DE SESSIESLEUTEL EN GEEN NAAM. Welke landen iemand op zijn
   telefoon zet, zegt iets over waar hij komt; dat hoort bij de codenaam en
   nooit bij de kluis (CLAUDE.md, privacy by design). En daarom telt de
   kantoorkant alleen AANTALLEN: hoeveel leden een gebied willen, nooit wie.

   ER KOMT GEEN PLAFOND. Een gekozen kaart kost RTG vandaag niets extra -- de
   pakketten zijn gedeeld -- dus een maximum zou een verzonnen grens zijn. Op
   het toestel is de grens de opslag van dat toestel, en die kent RTG niet. */
'use strict';

const gebieden = require('./gebieden');

const MAX_PER_LID = 500;   // geen beleid maar een dam tegen een stukke aanroeper

/* TWEE REDENEN WAAROM EEN GEBIED NIET TE KIEZEN IS, en ze zijn allebei echt:

     de LICENTIEPOORT houdt hem tegen (gebieden.mag) -- dan mag RTG hem niet
     aanbieden, en dat is geen kwestie van willen;

     de bron levert GEEN DOWNLOADADRES. Zo'n gebied staat in de index maar is
     nooit te bouwen; kiezen zou een verzoek zijn dat niemand kan inwilligen.
     Een knop die niets kan opleveren is erger dan een knop die er niet is.
     Ligt het pakket er al, dan doet het adres niet meer mee -- vandaar de
     `gebouwd`-uitzondering. */
function teKiezen(g) {
  const poort = gebieden.mag(g);
  if (!poort.ok) return { ok: false, reden: poort.reden };
  if (!g.gebouwd && !g.downloadAdres) {
    return { ok: false, reden: 'De bron noemt voor ' + (g.naam || g.code) + ' geen downloadadres, dus RTG ' +
      'kan deze kaart niet bouwen. Hij staat er wel in de index, en daarom staat hij hier ook -- ' +
      'weglaten zou de vraag oproepen waarom hij ontbreekt.' };
  }
  return { ok: true, naamsvermelding: poort.naamsvermelding };
}

module.exports = function maakMijnKaarten({ db, save }) {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/navigatie/mijnkaarten',
    bezit: { navKaarten: 'kaart' } });
  const kijk = () => eigen.kijk('navKaarten') || {};
  const nu = () => new Date().toISOString();

  const rijVan = (sleutel) => {
    const r = kijk()[String(sleutel || '')];
    return Array.isArray(r && r.gekozen) ? r.gekozen : [];
  };

  /* HET BEELD: de catalogus met per gebied of DIT lid hem heeft gekozen. Nooit
     twee lijsten die uit elkaar kunnen lopen -- de stand komt uit de catalogus
     en alleen `gekozen` komt hiervandaan. */
  function beeld(sleutel) {
    const cat = gebieden.catalogus();
    const mijn = new Set(rijVan(sleutel));
    const rij = cat.gebieden.map(g => {
      const k = teKiezen(g);
      return { code: g.code, naam: g.naam, soort: g.soort, ouder: g.ouder,
        aangeboden: true, gebouwd: g.gebouwd, gekozen: mijn.has(g.code),
        licentie: g.licentie, naamsvermelding: k.naamsvermelding || null,
        /* Niet te kiezen zegt altijd WAAROM. Grijs zonder uitleg is een
           raadsel (GRAMMATICA.md: een verhindering draagt een reden). */
        teKiezen: k.ok, waarom: k.ok ? null : k.reden };
    });
    /* EEN KEUZE VOOR EEN GEBIED DAT DE BRON NIET MEER AANBIEDT verdwijnt niet
       stil. Hij wordt ook niet weggegooid -- de keuze is van het lid, en een
       bron die een gebied een dag hernoemt zou anders zijn lijst opruimen. Hij
       staat er dus apart bij, zodat het verschil tussen "gekozen" en "op het
       scherm" verklaard is in plaats van raar. */
    const nietMeer = [...mijn].filter(c => !rij.some(g => g.code === c));
    return { status: 200, gebieden: rij, mijn: [...mijn], gekozenNietAangeboden: nietMeer,
      telling: { aangeboden: rij.length, gebouwd: rij.filter(g => g.gebouwd).length, gekozen: mijn.size },
      bron: cat.bron, licentie: cat.licentie || null, reden: cat.reden || null,
      opToestel: false,
      opToestelWaarom: 'De kaart wordt vandaag door RTG zelf gelezen; op uw toestel opslaan is een ' +
        'volgende stap. Uw keuze blijft staan en is dan de lijst die het toestel ophaalt.' };
  }

  /* KIEZEN. Alleen een gebied dat de catalogus kent en dat de licentiepoort
     haalt. Een gebied dat nog niet gebouwd is mag WEL gekozen worden -- dat is
     het verzoek -- en het antwoord zegt dat met zoveel woorden, zodat niemand
     denkt dat er al een kaart klaarstaat. */
  function kies(sleutel, code) {
    const s = String(sleutel || '');
    if (!s) return { status: 401, error: 'Geen sessie.' };
    const c = String(code || '').toLowerCase();
    const gebied = gebieden.catalogus().gebieden.find(g => g.code === c);
    if (!gebied) return { status: 404, error: 'Dit gebied staat niet in de catalogus.' };
    const k = teKiezen(gebied);
    if (!k.ok) return { status: 409, error: k.reden };
    const bak = eigen.bak('navKaarten');
    const rij = Array.isArray(bak[s] && bak[s].gekozen) ? bak[s].gekozen : [];
    if (!rij.includes(c)) {
      if (rij.length >= MAX_PER_LID) return { status: 409, error: 'Meer dan ' + MAX_PER_LID + ' kaarten gaat niet.' };
      rij.push(c);
    }
    bak[s] = { gekozen: rij, bijgewerktAt: nu() };
    if (save) save();
    return { status: 200, code: c, naam: gebied.naam, gekozen: true, gebouwd: gebied.gebouwd,
      /* Twee heel verschillende dingen, en dus twee zinnen. */
      wat: gebied.gebouwd
        ? 'Deze kaart is gebouwd en wordt meteen gebruikt zodra u er navigeert.'
        : 'Deze kaart is aangeboden maar nog niet gebouwd. Uw keuze is het verzoek; RTG bouwt hem, ' +
          'en tot die tijd rekent de navigatie hier niet.' };
  }

  function weg(sleutel, code) {
    const s = String(sleutel || '');
    if (!s) return { status: 401, error: 'Geen sessie.' };
    const c = String(code || '').toLowerCase();
    const bak = eigen.bak('navKaarten');
    const rij = Array.isArray(bak[s] && bak[s].gekozen) ? bak[s].gekozen : [];
    const uit = rij.filter(x => x !== c);
    bak[s] = { gekozen: uit, bijgewerktAt: nu() };
    if (save) save();
    /* Weghalen wat er niet stond is geen fout: de knop is per gebied, en twee
       tikken achter elkaar hoort geen foutmelding te geven. */
    return { status: 200, code: c, gekozen: false, verwijderd: uit.length !== rij.length };
  }

  /* DE VRAAG VAN HET KANTOOR: wat willen leden dat er gebouwd wordt. Alleen
     aantallen; wie er achter zit staat hier niet en hoort er niet te staan. */
  function vraag() {
    const per = new Map();
    for (const r of Object.values(kijk())) {
      for (const c of (Array.isArray(r && r.gekozen) ? r.gekozen : [])) per.set(c, (per.get(c) || 0) + 1);
    }
    const cat = gebieden.catalogus().gebieden;
    const rij = [...per.entries()].map(([code, aantal]) => {
      const g = cat.find(x => x.code === code);
      return { code, naam: (g && g.naam) || code, aantal, gebouwd: !!(g && g.gebouwd) };
    }).sort((a, b) => b.aantal - a.aantal || (a.code < b.code ? -1 : 1));
    return { status: 200, gevraagd: rij, telling: { gebieden: rij.length },
      let: 'Aantallen per gebied, nooit wie. Welke landen iemand wil hebben, zegt iets over waar hij komt.' };
  }

  return { navKaartenBeeld: beeld, navKaartKies: kies, navKaartWeg: weg, navKaartVraag: vraag };
};
