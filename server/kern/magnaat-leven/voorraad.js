/* Magnaat V2: HANDEL -- inkopen bij een leverancier, op voorraad houden, en
   verkopen. Naast je dienst verkoop je iets wat bij je aanbod hoort
   (./regels-bedrijf.js, HANDELSWAAR).

   VOORRAAD IS GELD OP DE PLANK, en dat staat in de boeken: bij levering wordt
   het voorraad (een bezit) en een schuld aan de leverancier; bij verkoop komt
   er geld en omzet bij, en gaat de inkoopwaarde als kosten van de voorraad af.
   Je resultaat is dus de marge, niet de omzet. De eerste bestelling betaal je
   vooraf -- een leverancier kent je nog niet --, daarna geeft hij je dertig
   dagen. Wie hem niet betaalt, krijgt niets meer geleverd.

   Hoeveel er verkocht wordt, volgt uit je klanten en je prijs, en is hetzelfde
   voor dezelfde keuzes. Wat je niet op voorraad hebt, kun je niet verkopen: dat
   is een gemiste verkoop. */
'use strict';
const B = require('./regels-bedrijf');
const { meld, ontgrendel, post, euro } = require('./staat');
const { boekVan } = require('./boek');
const { mijnVraag } = require('./markt');

const fout = (error) => ({ status: 400, error });
const waarVan = (st) => (st.aanbod ? B.HANDELSWAAR[st.aanbod] : null);
const geblokkeerd = (st) => st.posten.some(p => p.soort === 'leverancier' && p.achterstand);

/* Stuks per week, in duizendsten, in dit seizoen: je deel van wat heel
   Oudwijk koopt (V3, ./markt.js). Je prijs, je naam en waar je zit, bepalen
   dat deel; de concurrenten de rest. */
const vraagPerWeek = (st) => (waarVan(st) && st.handel ? mijnVraag(st) : 0);

function bestelInkoop(st, z) {
  const w = waarVan(st);
  if (!st.onderneming || !w) return fout('Inkopen bij een groothandel doe je als onderneming.');
  if (geblokkeerd(st)) return fout(w.leverancier + ' levert niet meer zolang je laatste factuur openstaat.');
  const n = Number(z.aantal);
  if (!Number.isInteger(n) || n < w.minimum || n > B.HANDELSVRAAG.bestelMax) {
    return fout(w.leverancier + ' levert ' + w.minimum + ' tot ' + B.HANDELSVRAAG.bestelMax + ' stuks per keer.');
  }
  const bedrag = n * w.inkoop, eerste = !st.handel;
  if (eerste && st.kas < bedrag) {
    return fout('Een eerste bestelling betaal je vooraf: ' + euro(bedrag) + ', en er staat ' + euro(st.kas) + ' op je rekening. Bestel minder, of wacht.');
  }
  if (eerste) st.handel = { prijs: w.advies, voorraad: 0, tegoed: 0, verkocht: 0, gemist: 0, omzet: 0, bestelTeller: 0, krediet: false };
  const id = 'b' + (++st.handel.bestelTeller), dag = st.dag + w.levertijd;
  if (!st.handel.krediet) {
    boekVan(st).boekOver(st, { soort: 'INKOOP', van: ['kas'], naar: ['crediteur', 'groothandel'], bedrag,
      omschrijving: 'Vooruitbetaling ' + n + ' x ' + w.naam, sleutel: 'vooraf:' + id });
  }
  st.leveringen.push({ id, aantal: n, bedrag, dag, vooraf: !st.handel.krediet });
  meld(st, 'Besteld bij ' + w.leverancier + ': ' + n + ' x ' + w.naam + ' voor ' + euro(bedrag) + (st.handel.krediet
    ? ', te betalen binnen ' + w.termijn + ' dagen na levering.' : ', vooraf betaald. Na deze bestelling geeft hij je ' + w.termijn + ' dagen.') +
    ' Levering op dag ' + dag + '.', 'goed');
  st.handel.krediet = true;
  ontgrendel(st, 'handel');
  return { ok: true };
}

function prijs(st, z) {
  const w = waarVan(st), h = st.handel;
  if (!w || !h) return fout('Een prijs zet je op iets wat je verkoopt. Bestel eerst.');
  const n = Number(z.bedrag), c = Number.isInteger(n) ? n * 100 : 0;
  const min = Math.ceil(w.advies * B.HANDELSVRAAG.prijsMin / 100 / 100) * 100, max = Math.floor(w.advies * B.HANDELSVRAAG.prijsMax / 100 / 100) * 100;
  if (c < min || c > max) return fout('Kies een prijs tussen ' + euro(min) + ' en ' + euro(max) + '. Klanten betalen er gewoonlijk ' + euro(w.advies) + ' voor.');
  h.prijs = c;
  meld(st, 'Je verkoopt ' + w.naam + ' nu voor ' + euro(c) + (c < w.inkoop ? ': onder je inkoopprijs van ' + euro(w.inkoop) + ', dus elke verkoop kost je geld.' : '.'));
  return { ok: true };
}

/* Elke dag: wat er geleverd wordt, en wat er verkocht wordt. */
function handelDag(st) {
  const w = waarVan(st), h = st.handel;
  if (!w || !h) return;
  const b = boekVan(st);
  for (const l of st.leveringen.filter(x => x.dag === st.dag)) {
    b.boekOver(st, { soort: 'INKOOP', van: ['crediteur', 'groothandel'], naar: ['voorraad'], bedrag: l.bedrag,
      omschrijving: 'Levering ' + l.aantal + ' x ' + w.naam, sleutel: 'levering:' + l.id });
    if (!l.vooraf) {
      post(st, { soort: 'leverancier', naam: 'Factuur ' + w.leverancier, bedrag: l.bedrag, dag: st.dag + w.termijn,
        leverancier: w.leverancier, naar: ['crediteur', 'groothandel'], boekSoort: 'BETALING_LEVERANCIER' });
    }
    h.voorraad += l.aantal;
    h.inWinkel = true;
    meld(st, w.leverancier + ' heeft ' + l.aantal + ' x ' + w.naam + ' geleverd. Dat is ' + euro(l.bedrag) + ' die nu op de plank ligt.');
  }
  st.leveringen = st.leveringen.filter(x => x.dag > st.dag);
  if (!h.inWinkel) return;             // wat nog nooit te koop lag, mist ook niemand
  h.tegoed += mijnVraag(st, st.dag);                // het weer van vandaag telt mee
  let n = 0;
  while (h.tegoed >= 1000 && h.voorraad > 0) { h.tegoed -= 1000; h.voorraad--; n++; }
  if (h.tegoed >= 1000) {
    const mis = Math.floor(h.tegoed / 1000);
    h.tegoed -= mis * 1000;
    h.gemist += mis;
    if (!h.gemistGemeld || st.dag - h.gemistGemeld >= 7) {
      h.gemistGemeld = st.dag;
      meld(st, 'Iemand wilde een ' + w.naam.toLowerCase() + ' kopen, en je had er geen. Dat is een gemiste verkoop.', 'slecht');
    }
  }
  if (!n) return;
  h.verkocht += n;
  h.omzet += n * h.prijs;
  b.boek(st, { soort: 'VERKOOP', omschrijving: n + ' x ' + w.naam + ' verkocht', sleutel: 'verkoop:' + st.dag,
    regels: [['debet', ['kas'], n * h.prijs], ['credit', ['omzet'], n * h.prijs],
      ['debet', ['kosten', 'inkoopwaarde'], n * w.inkoop], ['credit', ['voorraad'], n * w.inkoop]] });
}

module.exports = { bestelInkoop, prijs, handelDag, vraagPerWeek, waarVan, geblokkeerd };
