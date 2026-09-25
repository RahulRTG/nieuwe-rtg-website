/* Magnaat FROM ZERO: HET GELD, EN DAT LOOPT ALLEEN DOOR HET GROOTBOEK.

   Dezelfde regel als World sinds A2.10 (MAGNAAT.md): een saldo wordt nooit
   rechtstreeks geschreven. Dit bestand is de enige plek in FROM ZERO die geld
   beweegt; `st.kas` is een projectie van de rekening `kas`.

   HET BOEK KLOPT ECONOMISCH, en daar is het spel om te doen. Een factuur is
   omzet en een VORDERING, geen geld: pas als de klant betaalt, gaat de
   vordering naar de kas. Een voorschot is geen omzet maar een schuld aan de
   klant tot je levert. Daarom kan het resultaat van een opdracht +€ 620 zijn
   terwijl er € 93 op je rekening staat -- en dat staat hier in de boeken, niet
   alleen op het scherm.

   Een rekening wordt genoemd als [soort, sleutel]: ['kas'], ['vordering',
   klant], ['vooruit', klant], ['omzet'], ['kosten', wat], ['schuld', aan wie],
   ['begin'], ['voorraad'], ['crediteur', leverancier], of een tegenpartij buiten je boeken (werkgever, verhuurder, ...).
   Privé-uitgaven gaan naar een tegenpartij; kosten van je werk naar `kosten`,
   zodat het resultaat alleen over je werk gaat. */
'use strict';
const crypto = require('crypto');
const { maakGrootboek, geheugenJournaal, collectieJournaal } = require('../magnaat-grootboek');
const { REGELVERSIE } = require('./regels');

const EIGEN = { kas: 'actief', vordering: 'actief', vooruit: 'passief', omzet: 'opbrengst', kosten: 'kosten',
  schuld: 'passief', begin: 'passief', voorraad: 'actief', crediteur: 'passief' };
const TEGENPARTIJEN = ['werkgever', 'verhuurder', 'winkels', 'leveranciers', 'familie', 'incasso', 'financier', 'kvk', 'software'];

const SOORTEN = Object.fromEntries(['OPENING', 'LOON', 'EXTRA_DIENST', 'VERPLICHTING', 'BOODSCHAPPEN', 'SOFTWARE',
  'AANMANING', 'INSCHRIJVING', 'VOORSCHOT', 'FACTUUR', 'BETALING_KLANT', 'KORTING', 'VOORFINANCIERING', 'LENING',
  'AFLOSSING', 'LOON_PERSONEEL', 'WERKPLEK', 'INHUUR', 'INKOOP', 'BETALING_LEVERANCIER', 'VERKOOP'].map(s => [s, s]));

const HANDVAT = Symbol('boek');

function maakBoek({ db } = {}) {
  const opslag = db ? collectieJournaal({ db }) : geheugenJournaal();
  const cache = new Map();

  function wereldboek(w) {
    let gb = cache.get(w);
    if (!gb) {
      gb = maakGrootboek({
        wereld: w, opslag, soorten: SOORTEN, idVoorvoegsel: 'FZ',
        versies: { regel: REGELVERSIE, motor: 'from-zero-1' },
        periode: (p) => ({ nummer: p.dag || 0, datum: 'dag ' + (p.dag || 0) })
      });
      cache.set(w, gb);
    }
    return gb;
  }

  function rekening(w, [k, x]) {
    if (EIGEN[k]) return { code: w + ':' + k + (x ? ':' + x : ''), soort: EIGEN[k] };
    if (!TEGENPARTIJEN.includes(k)) throw new Error('Geen rekening in FROM ZERO: ' + k + '.');
    return { code: w + ':' + k, soort: 'extern' };
  }

  /* EEN BOEKING van regels [kant, rekening, bedrag]. Debet en credit moeten
     gelijk zijn; het grootboek weigert anders. Een sleutel die al geboekt is,
     geeft de bestaande boeking terug en beweegt de kas NIET -- anders loopt de
     kas stil weg van de rekening. Elke boeking draagt haar richting voor het
     scherm: `in` en `uit` gaan over je rekening, `boek` blijft erbuiten. */
  function boek(st, { soort, regels, omschrijving, sleutel }) {
    const lijnen = regels.filter(([, , b]) => b !== 0);
    if (!lijnen.length) return null;
    for (const [, , b] of lijnen) {
      if (!Number.isSafeInteger(b) || b < 0) throw new Error('FROM ZERO boekt alleen hele, positieve centen: ' + b + '.');
    }
    const w = st.wereld, gb = wereldboek(w), p = st.boek;
    gb.zorgVorm(p);
    p.dag = st.dag;
    let kasDelta = 0;
    const gbRegels = lijnen.map(([kant, zijde, b]) => {
      const r = rekening(w, zijde);
      if (zijde[0] === 'kas') kasDelta += kant === 'debet' ? b : -b;
      return gb.regel(r.code, zijde[1] || zijde[0], omschrijving || soort, r.soort, kant, b);
    });
    const richting = kasDelta > 0 ? 'in' : kasDelta < 0 ? 'uit' : 'boek';
    const voor = p.boekVolgorde;
    const g = gb.metOorzaak(soort, () => gb.boek(p, sleutel || soort + ':' + (p.boekVolgorde + 1), soort,
      omschrijving || soort, gbRegels, [richting]));
    if (p.boekVolgorde === voor) return g;
    st.kas += kasDelta;
    return g;
  }

  /* De gewone overdracht: van de ene rekening naar de andere. */
  const boekOver = (st, { soort, van, naar, bedrag, omschrijving, sleutel }) =>
    boek(st, { soort, omschrijving, sleutel, regels: [['debet', naar, bedrag], ['credit', van, bedrag]] });

  const bevestig = (st) => (st.boek ? wereldboek(st.wereld).bevestig(st.boek) : 0);
  /* Het saldo zoals het grootboek het telt: debet min credit. */
  const saldo = (st, zijde) => ((st.boek.rekeningen[rekening(st.wereld, zijde).code] || {}).saldo || 0);
  const verifieer = (st) => wereldboek(st.wereld).verifieerGrootboek(st.boek);

  /* Wat de boeken zeggen, in de taal van de speler. */
  function cijfers(st) {
    const r = st.boek.rekeningen, pre = st.wereld + ':';
    let vorderingen = 0, vooruit = 0, kosten = 0, schuld = 0, voorraad = 0, crediteuren = 0;
    for (const [code, x] of Object.entries(r)) {
      if (!code.startsWith(pre)) continue;
      const k = code.slice(pre.length).split(':')[0];
      if (k === 'vordering') vorderingen += x.saldo;
      if (k === 'vooruit') vooruit -= x.saldo;
      if (k === 'kosten') kosten += x.saldo;
      if (k === 'schuld') schuld -= x.saldo;
      if (k === 'voorraad') voorraad += x.saldo;
      if (k === 'crediteur') crediteuren -= x.saldo;
    }
    const omzet = 0 - saldo(st, ['omzet']);   // 0 - en geen -: een lege rekening is 0 en geen -0
    return { kas: saldo(st, ['kas']), vorderingen, vooruit, omzet, kosten, resultaat: omzet - kosten, schuld, voorraad, crediteuren };
  }

  function open(st, bedrag) {
    st.kas = 0;
    st.boek = { boekVolgorde: 0, rekeningen: {}, laatstToegepast: 0, totalen: { debet: 0, credit: 0, aantal: 0 },
      recent: [], vandaag: null, wachtend: [], integriteit: null };
    return boekOver(st, { soort: 'OPENING', van: ['begin'], naar: ['kas'], bedrag, omschrijving: 'Wat je had', sleutel: 'opening' });
  }

  return { boek, boekOver, bevestig, saldo, verifieer, cijfers, open };
}

/* Het handvat hangt de boekhouding aan de staat, zoals in World: het gaat niet
   mee in JSON, en een staat zonder handvat kan geen geld bewegen. */
function koppel(st, b) { st[HANDVAT] = b; return st; }
function boekVan(st) {
  const b = st && st[HANDVAT];
  if (!b) throw new Error('Geld bewegen kan alleen in een leven dat aan het grootboek hangt.');
  return b;
}
const wereldVan = (key) => 'leven:' + crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 16);

module.exports = { maakBoek, koppel, boekVan, wereldVan, TEGENPARTIJEN, SOORTEN };
