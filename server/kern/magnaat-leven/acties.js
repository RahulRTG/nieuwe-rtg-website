/* Magnaat Van Nul: WAT JE ZELF DOET.

   Elke handeling kost tijd (vrije uren van vandaag) of geld, en vaak allebei.
   Een weigering zegt altijd waarom en wat je wel kunt doen: een grijze knop
   zonder reden bestaat hier niet (GRAMMATICA.md).

   De keten waar dit om draait: een eigen project kiezen, netwerken tot er een
   klant is, een offerte sturen, onderhandelen, het werk doen, je onderneming
   inschrijven, factureren, en een klant die te laat betaalt. Wat je doet als
   het geld op is -- lenen, een extra dienst, of een herinnering sturen -- zijn
   keuzes met gevolgen die in ./dag.js doorwerken. */
'use strict';
const R = require('./regels');
const { meld, ontgrendel, aanbod, klantVan, deal: vindDeal, euro } = require('./staat');
const { boekVan } = require('./boek');

const fout = (error) => ({ status: 400, error });
const heleEuro = (x) => {
  const n = Number(x);
  return Number.isInteger(n) && n > 0 && n <= 1000000 ? n * 100 : null;
};
function kostUren(st, n, wat) {
  if (st.uren < n) return fout(wat + ' kost ' + n + ' uur, en je hebt vandaag nog ' + st.uren + ' uur. Morgen heb je weer tijd.');
  st.uren -= n;
  return null;
}

const ACTIES = {
  project(st, z) {
    if (st.project) return fout('Je bent al begonnen met ' + aanbod(st).naam + '.');
    const a = R.AANBOD[z.aanbod];
    if (!a) return fout('Kies wat je wilt aanbieden: ' + Object.keys(R.AANBOD).join(', ') + '.');
    const u = kostUren(st, 2, 'Beginnen'); if (u) return u;
    st.project = { aanbod: z.aanbod, sinds: st.dag };
    boekVan(st).boekOver(st, { soort: 'SOFTWARE', van: ['kas'], naar: ['software'], bedrag: a.softwareKosten,
      omschrijving: a.software + ' (eerste maand)', sleutel: 'software:start' });
    meld(st, 'Je bent begonnen met ' + a.naam + '. ' + a.software + ' kost ' + euro(a.softwareKosten) + ' per maand.', 'goed');
    return { ok: true };
  },

  netwerk(st) {
    if (!st.project) return fout('Netwerken heeft pas zin als je iets aanbiedt. Kies eerst een eigen project.');
    const k = aanbod(st).klanten.find(x => !st.deals.some(d => d.klantId === x.id));
    if (!k) return fout('Iedereen die je kent weet al wat je doet. Maak je lopende klanten tevreden: die bevelen je aan.');
    const u = kostUren(st, 2, 'Netwerken'); if (u) return u;
    st.deals.push({ id: 'd' + (++st.dealTeller), klantId: k.id, fase: 'lead', sinds: st.dag });
    meld(st, 'Je sprak ' + k.naam + '. Die zoekt ' + k.behoefte + '.', 'goed');
    ontgrendel(st, 'berichten');
    return { ok: true };
  },

  offerte(st, z) {
    const d = vindDeal(st, z.deal);
    if (!d || d.fase !== 'lead') return fout('Een offerte stuur je aan iemand die iets zoekt en nog geen prijs van je heeft.');
    const bedrag = heleEuro(z.bedrag);
    if (!bedrag) return fout('Noem een bedrag in hele euro\'s.');
    const u = kostUren(st, 1, 'Een offerte schrijven'); if (u) return u;
    Object.assign(d, { fase: 'offerte', bedrag, antwoordDag: st.dag + 1 });
    meld(st, 'Je offerte van ' + euro(bedrag) + ' ligt bij ' + klantVan(st, d.klantId).naam + '. Morgen hoor je meer.');
    ontgrendel(st, 'offertes');
    return { ok: true };
  },

  onderhandel(st, z) {
    const d = vindDeal(st, z.deal);
    if (!d || d.fase !== 'tegenbod') return fout('Er ligt geen tegenbod om over te onderhandelen.');
    const k = klantVan(st, d.klantId);
    if (z.keuze === 'accepteer' || z.keuze === 'tegen') {
      const bedrag = z.keuze === 'accepteer' ? d.tegenbod : heleEuro(z.bedrag);
      if (!bedrag) return fout('Noem je tegenvoorstel in hele euro\'s.');
      if (bedrag <= k.budget) {
        Object.assign(d, { fase: 'opdracht', bedrag, uren: k.uren, urenGedaan: 0 });
        meld(st, 'Akkoord met ' + k.naam + ' voor ' + euro(bedrag) + '. Aan het werk: ' + k.uren + ' uur.', 'goed');
        return { ok: true };
      }
      if (!d.laatsteBod) {
        d.laatsteBod = true;
        meld(st, k.naam + ' blijft bij ' + euro(d.tegenbod) + '. Dat is het laatste bod.', 'vraag');
        return { ok: true };
      }
    }
    d.fase = 'afgewezen';
    meld(st, 'Geen deal met ' + k.naam + '.', 'slecht');
    return { ok: true };
  },

  werk(st, z) {
    const d = vindDeal(st, z.deal);
    if (!d || d.fase !== 'opdracht') return fout('Er is geen lopende opdracht om aan te werken.');
    const wil = Number(z.uren);
    if (!Number.isInteger(wil) || wil < 1) return fout('Hoeveel uur wil je werken? Een heel getal, minstens een.');
    const n = Math.min(wil, d.uren - d.urenGedaan, st.uren);
    const u = kostUren(st, Math.max(n, 1), 'Werken'); if (u) return u;
    d.urenGedaan += n;
    if (d.urenGedaan >= d.uren) {
      d.fase = 'klaar';
      meld(st, 'De opdracht voor ' + klantVan(st, d.klantId).naam + ' is af. Nu nog betaald worden.', 'goed');
      ontgrendel(st, 'facturen');
    }
    return { ok: true };
  },

  onderneming(st, z) {
    if (st.onderneming) return fout('Je onderneming staat al ingeschreven: ' + st.onderneming.naam + '.');
    if (!st.project) return fout('Schrijf je in als je weet wat je aanbiedt. Kies eerst een eigen project.');
    const naam = String(z.naam || '').trim();
    if (naam.length < 2 || naam.length > 60) return fout('Geef je onderneming een naam van 2 tot 60 tekens.');
    boekVan(st).boekOver(st, { soort: 'INSCHRIJVING', van: ['kas'], naar: ['kvk'], bedrag: R.KOSTEN.kvk,
      omschrijving: 'Inschrijving Kamer van Koophandel', sleutel: 'kvk' });
    st.onderneming = { naam, sinds: st.dag };
    meld(st, naam + ' staat ingeschreven. Dat kostte ' + euro(R.KOSTEN.kvk) + '. Je hebt een bedrijf.', 'goed');
    ontgrendel(st, 'zakelijk');
    return { ok: true };
  },

  factuur(st, z) {
    const d = vindDeal(st, z.deal);
    if (!d || d.fase !== 'klaar') return fout('Je factureert werk dat af is en nog niet gefactureerd.');
    if (!st.onderneming) return fout('Een factuur stuur je als onderneming. Schrijf je eerst in bij de Kamer van Koophandel.');
    const k = klantVan(st, d.klantId);
    const nummer = 'VN-' + String(++st.factuurTeller).padStart(3, '0');
    const vervaldag = st.dag + R.BETAALTERMIJN;
    d.factuur = { nummer, dag: st.dag, bedrag: d.bedrag, vervaldag, betaalDag: vervaldag + k.laat, herinnerd: false };
    d.fase = 'gefactureerd';
    meld(st, 'Factuur ' + nummer + ' van ' + euro(d.bedrag) + ' is naar ' + k.naam + '. Te betalen binnen ' + R.BETAALTERMIJN + ' dagen.');
    return { ok: true };
  },

  herinnering(st, z) {
    const d = vindDeal(st, z.deal);
    if (!d || d.fase !== 'gefactureerd') return fout('Je stuurt een herinnering voor een factuur die nog open staat.');
    const f = d.factuur;
    if (st.dag <= f.vervaldag) return fout('De betaaltermijn loopt nog tot dag ' + f.vervaldag + '. Een herinnering daarvoor is onbeleefd.');
    if (f.herinnerd) return fout('Je hebt al een herinnering gestuurd.');
    f.herinnerd = true;
    f.betaalDag = Math.min(f.betaalDag, st.dag + R.HERINNERING_BETAALT_NA);
    meld(st, 'Herinnering gestuurd aan ' + klantVan(st, d.klantId).naam + '. Die belooft binnen ' + R.HERINNERING_BETAALT_NA + ' dagen te betalen.');
    return { ok: true };
  },

  lenen(st, z) {
    if (st.lening) return fout('Je hebt al een lening bij je familie lopen.');
    const bedrag = heleEuro(z.bedrag);
    if (!bedrag || bedrag > R.LENING.max) return fout('Je familie kan je hooguit ' + euro(R.LENING.max) + ' lenen.');
    boekVan(st).boekOver(st, { soort: 'LENING', van: ['familie'], naar: ['kas'], bedrag,
      omschrijving: 'Lening van je familie' });
    st.lening = { restant: bedrag, termijn: Math.ceil(bedrag / R.LENING.termijnen) };
    meld(st, 'Je familie leent je ' + euro(bedrag) + '. Je betaalt het terug in ' + R.LENING.termijnen + ' termijnen, na je loon.', 'vraag');
    return { ok: true };
  },

  overwerk(st) {
    if (!st.baan.actief) return fout('Je hebt geen baan meer om een extra dienst te draaien.');
    if (st.overwerkDag === st.dag) return fout('Je hebt vandaag al een extra dienst gedraaid. Er is er een per dag.');
    const o = st.baan.overwerk;
    const u = kostUren(st, o.uren, 'Een extra dienst'); if (u) return u;
    boekVan(st).boekOver(st, { soort: 'OVERWERK', van: ['werkgever'], naar: ['kas'], bedrag: o.loon,
      omschrijving: 'Extra dienst', sleutel: 'overwerk:' + st.dag });
    st.overwerkDag = st.dag;
    meld(st, 'Een extra dienst bij ' + st.baan.werkgever + ': ' + euro(o.loon) + ', en je vrije uren van vandaag zijn op.');
    return { ok: true };
  }
};

module.exports = { ACTIES };
