/* DE VOORRAAD: wat er ligt, wat het waard is, en wat wij niet kunnen zien.

   ER KOMT GEEN VIJFDE VOORRAAD BIJ. Dit huis houdt voorraad al op vier plekken
   bij, en elke plek doet dat anders omdat het werk anders is:

     keuken      -> s.voorraad: artikelen met een MINIMUM en een KOSTPRIJS, plus
                    een mutatiejournaal (s.voorraadLog). De volledigste van de
                    vier, en niet toevallig: een keuken die misgrijpt staat stil.
     retail      -> s.artikelen met VARIANTEN (kleur, maat). Voorraad zit op de
                    variant en niet op het artikel -- maat 42 kan op zijn zijn
                    terwijl maat 40 in het schap ligt.
     boerderij   -> s.boerderij.producten, gevuld door de oogst.
     groothandel -> s.groothandel.producten, met een inkoopprijs en een minimale
                    BESTELhoeveelheid.

   Een vijfde register ernaast zou binnen een maand uiteenlopen met alle vier
   (lat-regel 4), en het zou de enige plek zijn die niemand bijwerkt omdat er
   niet in gewerkt wordt. Deze laag LEEST ze en legt ze naast elkaar.

   DRIE DINGEN DIE HIER MET OPZET NIET WORDEN UITGEREKEND:

   1. GEEN VOORRAADWAARDE OP EEN VERKOOPPRIJS. Retail en boerderij kennen geen
      inkoopprijs -- alleen wat het artikel kost voor de klant. Zou de waarde
      daarop rusten, dan staat er een bedrag dat de winst al bevat, en dat is
      geen voorraadwaarde maar een omzetverwachting. Daar komt dus null met de
      reden, en niet een getal met een sterretje.
   2. GEEN BESTELPUNT WAAR ER GEEN IS. De keuken heeft `min` per artikel en
      retail een drempel per zaak; de groothandel heeft alleen `minBestel`, en
      dat is de minimale hoeveelheid PER BESTELLING en geen bestelpunt. Die twee
      verwarren betekent dat een volle groothandel als "bijna op" wordt gemeld.
   3. GEEN DEKKING IN DAGEN. Daarvoor zouden wij het verbruik van een artikel
      over tijd moeten kennen. Alleen de keuken schrijft mutaties weg, en alleen
      binnen RTG -- wat er handmatig uit de kast gaat, ziet niemand. "Nog vier
      dagen" op zo'n grondslag is een getal waar iemand een bestelling op baseert.

   Wat er WEL uit komt: hoeveel er ligt, hoeveel daarvan onder zijn bestelpunt
   staat, en wat het waard is voor zover er een inkoopprijs bekend is -- elk met
   zijn grondslag erbij. */
'use strict';

const rond = (n) => Math.round((Number(n) || 0) * 100) / 100;
const RETAIL_DREMPEL = 3;   // dezelfde standaard als kern/retail/vloer.js

/* Per bron: waar hij woont, of er een bestelpunt is, en of er een inkoopprijs
   is. Dat laatste bepaalt of er een waarde uit komt -- zie punt 1 in de kop. */
const BRONNEN = {
  keuken: { label: 'Keukenvoorraad', bestelpunt: 'per artikel',
    waardeUit: 'kostprijs', wat: 'Ingrediënten met een minimum per artikel.' },
  retail: { label: 'Winkelvoorraad', bestelpunt: 'drempel per zaak',
    waardeUit: null, wat: 'Artikelen met varianten; voorraad zit op de variant.' },
  boerderij: { label: 'Eigen oogst', bestelpunt: null,
    waardeUit: null, wat: 'Producten uit de eigen oogst en dieropbrengst.' },
  groothandel: { label: 'Groothandelsassortiment', bestelpunt: null,
    waardeUit: 'inkoopPrijs', wat: 'Wat u zelf verkoopt aan zaken en leden.' }
};

module.exports = ({ db }) => {

  const zaakVan = (o) => (o && o.supplierCode
    ? (db.data.suppliers || []).find(x => x.code === o.supplierCode) || null : null);

  /* ---- de vier bronnen, elk in dezelfde vorm ----
     Dezelfde vorm en niet dezelfde opslag: `laag` is null waar er geen
     bestelpunt bestaat, en dat is iets anders dan nul. */

  function keuken(s) {
    const rijen = Array.isArray(s.voorraad) ? s.voorraad : [];
    if (!rijen.length) return null;
    const laag = rijen.filter(a => Number(a.min) > 0 && Number(a.aantal) <= Number(a.min));
    const metPrijs = rijen.filter(a => Number(a.kostprijs) > 0);
    return {
      bron: 'keuken', artikelen: rijen.length,
      laag: laag.length,
      laagRijen: laag.slice(0, 10).map(a => ({ naam: a.naam, aantal: a.aantal,
        min: a.min, eenheid: a.eenheid || null })),
      waarde: rond(metPrijs.reduce((n, a) => n + Number(a.aantal) * Number(a.kostprijs), 0)),
      waardeOver: metPrijs.length, waardeVan: rijen.length,
      journaal: Array.isArray(s.voorraadLog) ? s.voorraadLog.length : 0
    };
  }

  function retail(s) {
    const rijen = Array.isArray(s.artikelen) ? s.artikelen : [];
    if (!rijen.length) return null;
    const drempel = Number((s.settings || {}).retailDrempel);
    const grens = Number.isFinite(drempel) ? drempel : RETAIL_DREMPEL;
    /* Voorraad zit op de VARIANT. Een artikel telt als laag zodra een van zijn
       varianten dat is: maat 42 op is een gemiste verkoop, ook al ligt de rest
       in het schap. */
    const laag = rijen.filter(a => (a.varianten || []).some(v => Number(v.voorraad) <= grens));
    return {
      bron: 'retail', artikelen: rijen.length,
      varianten: rijen.reduce((n, a) => n + (a.varianten || []).length, 0),
      laag: laag.length, drempel: grens,
      laagRijen: laag.slice(0, 10).map(a => ({ naam: a.name || a.naam,
        varianten: (a.varianten || []).filter(v => Number(v.voorraad) <= grens)
          .map(v => ({ vsku: v.vsku, kleur: v.kleur || null, maat: v.maat || null, voorraad: v.voorraad })) })),
      waarde: null,
      waardeReden: 'Op een winkelartikel staat alleen de verkoopprijs. Een waarde daarop is geen voorraadwaarde maar een omzetverwachting: de winst zit er al in.'
    };
  }

  function boerderij(s) {
    const rijen = ((s.boerderij || {}).producten) || [];
    if (!rijen.length) return null;
    return {
      bron: 'boerderij', artikelen: rijen.length,
      laag: null,
      laagReden: 'Op een oogstproduct staat geen minimum. Wat er groeit bepaalt de voorraad, niet een bestelpunt.',
      waarde: null,
      waardeReden: 'Op een oogstproduct staat alleen de verkoopprijs. Wat het u kostte om het te telen, weten wij niet.'
    };
  }

  function groothandel(s) {
    const rijen = ((s.groothandel || {}).producten) || [];
    if (!rijen.length) return null;
    const actief = rijen.filter(p => p.actief !== false);
    const metPrijs = actief.filter(p => Number(p.inkoopPrijs) > 0);
    return {
      bron: 'groothandel', artikelen: actief.length,
      laag: null,
      /* Zie punt 2 in de kop: minBestel is geen bestelpunt. */
      laagReden: 'Een groothandelsproduct heeft wel een minimale bestelhoeveelheid maar geen bestelpunt. Die twee verwarren zou een volle groothandel als "bijna op" melden.',
      waarde: rond(metPrijs.reduce((n, p) => n + Number(p.voorraad || 0) * Number(p.inkoopPrijs), 0)),
      waardeOver: metPrijs.length, waardeVan: actief.length,
      opNul: actief.filter(p => !(Number(p.voorraad) > 0)).length
    };
  }

  /* ---- het beeld ---- */
  function voorraad(o) {
    const s = zaakVan(o);
    if (!s) return null;
    const delen = [keuken(s), retail(s), boerderij(s), groothandel(s)].filter(Boolean);
    if (!delen.length) return null;

    const metWaarde = delen.filter(d => d.waarde !== null);
    const zonderWaarde = delen.filter(d => d.waarde === null);
    const laag = delen.reduce((n, d) => n + (d.laag || 0), 0);

    return {
      zaak: s.code,
      delen: delen.map(d => Object.assign({}, BRONNEN[d.bron], d)),
      laag,
      /* De totale waarde telt alleen op wat een inkoopprijs draagt, en zegt
         erbij welke delen er buiten vallen. Een totaal dat stilzwijgend de helft
         mist, wordt overgetypt in een balans. */
      waarde: metWaarde.length ? rond(metWaarde.reduce((n, d) => n + d.waarde, 0)) : null,
      waardeOver: metWaarde.map(d => d.bron),
      waardeBuiten: zonderWaarde.map(d => ({ bron: d.bron, reden: d.waardeReden })),
      nietGemeten: 'Alleen wat binnen RTG is geregistreerd. Wat er met de hand uit de kast gaat, ziet niemand -- en daarom staat er hier ook geen dekking in dagen: dat zou een getal zijn waar iemand een bestelling op baseert.'
    };
  }

  return { VOORRAAD_BRONNEN: BRONNEN, VOORRAAD_RETAIL_DREMPEL: RETAIL_DREMPEL, voorraad };
};

/* De opvolgregel: alleen over wat onder zijn eigen bestelpunt staat. Geen regel
   over "weinig voorraad" in het algemeen -- zonder bestelpunt weten wij niet
   wat weinig is, en een waarschuwing die op een gevoel rust, leert iemand
   waarschuwingen te negeren. */
function voorraadOpvolging(v) {
  if (!v || !v.laag) return null;
  const bronnen = v.delen.filter(d => d.laag > 0).map(d => d.label.toLowerCase());
  return {
    id: 'voorraad', aantal: v.laag,
    kop: v.laag + ' artikel' + (v.laag === 1 ? ' staat' : 'en staan') + ' onder het bestelpunt',
    waarom: 'In uw ' + bronnen.join(' en ') + '. Wie pas bestelt als het op is, staat stil zolang de levering onderweg is.'
  };
}

module.exports.voorraadOpvolging = voorraadOpvolging;
module.exports.BRONNEN = BRONNEN;
module.exports.RETAIL_DREMPEL = RETAIL_DREMPEL;
