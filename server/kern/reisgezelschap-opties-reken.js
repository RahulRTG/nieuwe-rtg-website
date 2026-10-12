/* DE REKENREGELS VAN DE GROEPSBEREKENING -- zuiver, zonder opslag of sessie.

   Afgesplitst uit ./reisgezelschap-opties.js toen dat bestand over de grens
   van keuringsregel 13 ging. Waarom de regels zo zijn (grove stappen, de
   drempel, het toetsbudget) staat in de kop daar; hier staat alleen HOE er
   gerekend wordt, zodat een toets ze los kan nalopen. */
'use strict';

const BAND = 5000;                 // EUR 50 in centen
const MAX_OPTIES = 5;
const MAX_TOETSEN = 6;             // nieuwe of gewijzigde opties per 24 uur, per reis
const DAG_MS = 24 * 60 * 60 * 1000;
const MIN_DEELNEMERS = 3;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

const GRENS = 'Wie over meerdere dagen opties blijft toetsen, kan het laagste plafond van de groep ' +
  'tot op EUR 50 benaderen, maar niet zien van wie het is. Er is geen ruis en geen versleutelde ' +
  'berekening; de server van RTG rekent met de opgaven.';
const NIET_GEZEGD = ['wie een optie niet past', 'hoeveel deelnemers een optie niet past',
  'de plafonds, data of voorkeuren van anderen', 'de reden waarom een optie een ander niet past'];

const bandOmlaag = c => Math.floor(c / BAND) * BAND;
const bandOmhoog = c => Math.ceil(c / BAND) * BAND;

/* Past deze optie bij deze ene opgave? Geeft de redenen in de taal van DEZE
   deelnemer -- ze gaan alleen naar hem. Een opgave zonder plafond of zonder
   data legt op dat punt geen grens op: wie niets opgaf, heeft niets uitgesloten. */
function pastBij(optie, opgave) {
  const redenen = [];
  if (opgave.plafond != null && bandOmhoog(optie.prijsPP) > bandOmlaag(opgave.plafond)) {
    redenen.push('De prijs per persoon ligt boven jouw plafond.');
  }
  if (opgave.data && opgave.data.length && !opgave.data.some(d => d.van <= optie.van && optie.tot <= d.tot)) {
    redenen.push('De data vallen buiten de periodes die jij opgaf.');
  }
  const botst = (optie.kenmerken || []).filter(k => (opgave.nietGraag || []).includes(k));
  if (botst.length) redenen.push('Deze optie heeft iets wat jij liever niet hebt: ' + botst.join(', ') + '.');
  return { past: redenen.length === 0, redenen };
}

/* De dagen waarop IEDEREEN die data opgaf kan. Wie geen data opgaf, telt niet
   mee (hij sloot niets uit). Per dag gerekend en daarna weer tot periodes
   samengevoegd, zodat er geen losse gaten of overlappen in de uitkomst zitten. */
function gedeeldVenster(opgaven) {
  const met = opgaven.filter(o => o.data && o.data.length);
  if (!met.length) return null;
  const dagenVan = (o) => {
    const s = new Set();
    for (const d of o.data) {
      for (let t = Date.parse(d.van); t <= Date.parse(d.tot); t += DAG_MS) s.add(new Date(t).toISOString().slice(0, 10));
    }
    return s;
  };
  let samen = dagenVan(met[0]);
  for (const o of met.slice(1)) { const ander = dagenVan(o); samen = new Set([...samen].filter(d => ander.has(d))); }
  const dagen = [...samen].sort();
  const uit = [];
  for (const d of dagen) {
    const laatste = uit[uit.length - 1];
    if (laatste && Date.parse(d) - Date.parse(laatste.tot) === DAG_MS) laatste.tot = d;
    else uit.push({ van: d, tot: d });
  }
  return uit;
}

function keurOptie(o, VOORKEUREN) {
  const i = o || {};
  const titel = String(i.titel || '').replace(/[<>]/g, '').trim().slice(0, 80);
  if (!titel) return { fout: 'Geef de optie een titel.' };
  const prijsPP = Number(i.prijsPP);
  if (!Number.isInteger(prijsPP) || prijsPP <= 0 || prijsPP > 10000000) {
    return { fout: 'Geef de prijs per persoon op als een heel aantal centen, groter dan nul.' };
  }
  const van = String(i.van || ''), tot = String(i.tot || '');
  if (!DATUM.test(van) || !DATUM.test(tot) || isNaN(Date.parse(van)) || isNaN(Date.parse(tot)) || tot < van) {
    return { fout: 'Geef de optie een begin- en einddatum als JJJJ-MM-DD, met het einde niet voor het begin.' };
  }
  const kenmerken = [];
  for (const k of Array.isArray(i.kenmerken) ? i.kenmerken : []) {
    if (!VOORKEUREN.includes(k)) return { fout: '"' + String(k).slice(0, 40) + '" staat niet in de lijst kenmerken.' };
    if (!kenmerken.includes(k)) kenmerken.push(k);
  }
  return { optie: { titel, prijsPP, van, tot, kenmerken } };
}

module.exports = { BAND, MAX_OPTIES, MAX_TOETSEN, DAG_MS, MIN_DEELNEMERS, GRENS, NIET_GEZEGD, pastBij, gedeeldVenster, keurOptie };
