/* Magnaat FROM ZERO: WAT JE ZELF DOET.

   Elke handeling staat hier op een plek; de meeste wonen in het bestand van hun
   onderwerp (tijd, gesprek, opdracht, geld). Een weigering zegt altijd waarom en
   wat wel kan: een grijze knop zonder reden bestaat hier niet (GRAMMATICA.md).

   De twee grote keuzes van V1 staan hier zelf: een onderneming inschrijven als
   het spel heeft vastgesteld dat je structureel voor klanten werkt, en je baan
   opzeggen als je bedrijf je kan dragen. */
'use strict';
const R = require('./regels');
const { AANBOD } = require('./klanten');
const { meld, ontgrendel, euro } = require('./staat');
const { boekVan } = require('./boek');
const tijd = require('./tijd');
const gesprek = require('./gesprek');
const opdracht = require('./opdracht');
const geld = require('./geld');
const team = require('./team');
const voorraad = require('./voorraad');
const contract = require('./contract');
const markt = require('./markt');

const fout = (error) => ({ status: 400, error });

function kies(st, z) {
  if (st.aanbod) return fout('Je werkt al aan ' + AANBOD[st.aanbod].project + '.');
  const a = AANBOD[z.aanbod];
  if (!a) return fout('Kies wat je wilt maken: ' + Object.keys(AANBOD).join(', ') + '.');
  st.aanbod = z.aanbod;
  meld(st, 'Je begint aan ' + a.project + '. Met je laptop en je telefoon kun je al beginnen; plan er tijd voor in je agenda. ' +
    'Wie je werk ziet, kan er iets van vinden.', 'goed');
  return { ok: true };
}

function onderneming(st, z) {
  if (st.onderneming) return fout('Je onderneming staat al ingeschreven: ' + st.onderneming.naam + '.');
  if (st.ondernemingVraag == null) return fout('Je bent nog niet structureel bezig: na twee betaalde opdrachten is dat wel zo.');
  const naam = String(z.naam || '').trim();
  if (naam.length < 2 || naam.length > 60) return fout('Geef je onderneming een naam van 2 tot 60 tekens.');
  if (st.kas < R.KVK) return fout('De inschrijving kost ' + euro(R.KVK) + ', en er staat ' + euro(st.kas) + ' op je rekening.');
  boekVan(st).boekOver(st, { soort: 'INSCHRIJVING', van: ['kas'], naar: ['kosten', 'kvk'], bedrag: R.KVK,
    omschrijving: 'Inschrijving in ' + R.JURISDICTIE.register, sleutel: 'kvk' });
  st.onderneming = { naam, sinds: st.dag };
  meld(st, naam + ' staat ingeschreven in ' + R.JURISDICTIE.register + '. Je bent ondernemer. ' + R.JURISDICTIE.btw, 'goed');
  ontgrendel(st, 'zakelijk');
  ontgrendel(st, 'boekhouding');
  return { ok: true };
}

function ontslag(st) {
  if (!st.baan.actief) return fout('Je werkt al niet meer bij ' + st.baan.werkgever + '.');
  if (!st.zelfstandigMag) return fout('Je bedrijf draagt je nog niet: pas als het vier weken twee keer je loon binnenbrengt.');
  st.baan.actief = false;
  st.zelfstandig = st.dag;
  meld(st, 'Je hebt opgezegd bij ' + st.baan.werkgever + '. Je begon met ' + euro(R.START_KAS) + ' en een baan in de keuken; ' +
    (st.onderneming ? st.onderneming.naam : 'je bedrijf') + ' is van jou, en jij hebt het opgebouwd.', 'goed');
  return { ok: true };
}

const ACTIES = {
  kies, onderneming, ontslag,
  plan: tijd.plan, schrap: tijd.schrap,
  gesprek: gesprek.gesprek, voorstel: gesprek.voorstel, neem: gesprek.neemAan, weiger: gesprek.weiger,
  lever: opdracht.lever, factuur: opdracht.factuur, herinnering: opdracht.herinnering,
  korting: opdracht.korting, voorfinancier: opdracht.voorfinancier,
  uitstel: geld.uitstel, lenen: geld.lenen,
  werf: team.werf, ontsla: team.ontsla, bestel: voorraad.bestelInkoop, prijs: voorraad.prijs,
  teken: contract.teken, wijsaf: contract.wijsAf, zegop: contract.zegOp,
  vestig: markt.vestig
};

module.exports = { ACTIES };
