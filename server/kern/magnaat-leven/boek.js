/* Magnaat Van Nul: HET GELD, EN DAT LOOPT ALLEEN DOOR HET GROOTBOEK.

   Dezelfde regel als World sinds A2.10 (MAGNAAT.md): een saldo wordt nooit
   rechtstreeks geschreven. `boekOver` boekt een overdracht in het grootboek
   (server/kern/magnaat-grootboek/) en werkt daarna de kas in de staat bij met
   precies hetzelfde aantal centen. Dit bestand is dus de enige plek in Van Nul
   die een saldo schrijft, en `st.kas` is een projectie van de rekening.

   De tegenpartijen zijn wie er in dit leven geld geeft of krijgt: de
   werkgever, de verhuurder, de winkels, de leverancier van je software, de
   Kamer van Koophandel, de bank, je familie en je klanten. Elk heeft een vaste
   rekening in deze wereld; een klant heeft er een per klant. */
'use strict';
const { maakGrootboek, geheugenJournaal, collectieJournaal } = require('../magnaat-grootboek');
const { REGELVERSIE } = require('./regels');

const TEGENPARTIJEN = ['werkgever', 'verhuurder', 'winkels', 'leveranciers', 'software', 'kvk', 'bank', 'familie'];

const SOORTEN = Object.fromEntries(['OPENING', 'LOON', 'OVERWERK', 'HUUR', 'VASTE_LASTEN', 'LEVENSKOSTEN',
  'SOFTWARE', 'INSCHRIJVING', 'BETALING_KLANT', 'RENTE', 'LENING', 'AFLOSSING'].map(s => [s, s]));

const HANDVAT = Symbol('boek');

function maakBoek({ db } = {}) {
  const opslag = db ? collectieJournaal({ db }) : geheugenJournaal();
  const cache = new Map();

  function wereldboek(w) {
    let gb = cache.get(w);
    if (!gb) {
      gb = maakGrootboek({
        wereld: w, opslag, soorten: SOORTEN, idVoorvoegsel: 'VN',
        versies: { regel: REGELVERSIE, motor: 'van-nul-1' },
        periode: (p) => ({ nummer: p.dag || 0, datum: 'dag ' + (p.dag || 0) })
      });
      cache.set(w, gb);
    }
    return gb;
  }

  const rekening = (w, [k, x]) => {
    if (k === 'kas') return w + ':kas';
    if (k === 'klant') return w + ':klant:' + x;
    if (!TEGENPARTIJEN.includes(k)) throw new Error('Geen tegenpartij in Van Nul: ' + k + '.');
    return w + ':' + k;
  };

  /* EEN OVERDRACHT van `van` naar `naar`: elk een [soort, sleutel], zoals
     ['kas'] of ['klant', 'bakkerij']. Nul boekt niets; een negatief bedrag is
     een fout, want de richting zegt hier altijd wie betaalt. */
  function boekOver(st, { soort, van, naar, bedrag, omschrijving, sleutel }) {
    if (bedrag === 0) return null;
    if (!Number.isSafeInteger(bedrag) || bedrag < 0) throw new Error('Van Nul boekt alleen hele, positieve centen: ' + bedrag + '.');
    const w = st.wereld, gb = wereldboek(w), p = st.boek;
    gb.zorgVorm(p);
    p.dag = st.dag;
    const regel = (kant, zijde) => gb.regel(rekening(w, zijde), zijde[1] || zijde[0], omschrijving || soort,
      zijde[0] === 'kas' ? 'actief' : 'extern', kant, bedrag);
    const voor = p.boekVolgorde;
    const g = gb.metOorzaak(soort, () => gb.boek(p, sleutel || soort + ':' + (p.boekVolgorde + 1), soort,
      omschrijving || soort, [regel('debet', naar), regel('credit', van)],
      [van[0] === 'kas' ? 'uit' : naar[0] === 'kas' ? 'in' : 'tussen']));
    /* Een sleutel die al geboekt is, geeft de bestaande boeking terug en boekt
       niets: dan beweegt de kas ook niet, anders loopt hij stil weg van de rekening. */
    if (p.boekVolgorde === voor) return g;
    if (van[0] === 'kas') st.kas -= bedrag;
    if (naar[0] === 'kas') st.kas += bedrag;
    return g;
  }

  const bevestig = (st) => (st.boek ? wereldboek(st.wereld).bevestig(st.boek) : 0);
  const saldo = (st, zijde) => ((st.boek.rekeningen[rekening(st.wereld, zijde)] || {}).saldo || 0);
  const verifieer = (st) => wereldboek(st.wereld).verifieerGrootboek(st.boek);

  /* De opening: je begint met wat je hebt, en dat komt ergens vandaan -- van je
     eigen spaargeld, dat hier als familie staat. */
  function open(st, bedrag) {
    st.kas = 0;
    st.boek = { boekVolgorde: 0, rekeningen: {}, laatstToegepast: 0, totalen: { debet: 0, credit: 0, aantal: 0 },
      recent: [], vandaag: null, wachtend: [], integriteit: null };
    return boekOver(st, { soort: 'OPENING', van: ['familie'], naar: ['kas'], bedrag, omschrijving: 'Wat je had', sleutel: 'opening' });
  }

  return { boekOver, bevestig, saldo, verifieer, open, rekening };
}

/* Het handvat hangt de boekhouding aan de staat, zoals in World: het gaat niet
   mee in JSON, en een staat zonder handvat kan geen geld bewegen. */
function koppel(st, boek) { st[HANDVAT] = boek; return st; }
function boekVan(st) {
  const b = st && st[HANDVAT];
  if (!b) throw new Error('Geld bewegen kan alleen in een leven dat aan het grootboek hangt.');
  return b;
}

module.exports = { maakBoek, koppel, boekVan, TEGENPARTIJEN, SOORTEN };
