/* Functieschakelaars (deelmodule): de bordweergave (catalogus met status per
   doelgroep) en het valideren/duiden van (AI-)wijzigingsvoorstellen. */
const { CATEGORIEEN, DOELGROEPEN, DOELGROEP_IDS, DOELGROEP_OP_ID, LEDEN, LEDEN_RTF, FUNCTIES, OP_ID } = require('./register');
const { functieVoorPad, functieAan, functieAanVoor, functieStoring, functieStatus,
  heeftLandRegels, blokkadeReden, padGeblokkeerd, doelgroepVanVerzoek, tierNaarDoelgroep } = require('./toegang');
function catalogus(staat) {
  return CATEGORIEEN.map(cat => ({
    categorie: cat,
    functies: FUNCTIES.filter(f => f.categorie === cat).map(f => {
      const s = (staat && staat[f.id]) || {};
      const perLand = s.perLand || {};
      const perPersoon = s.perPersoon || {};
      return {
        id: f.id, naam: f.naam, uitleg: f.uitleg, standaard: f.standaard, aan: functieAan(f.id, staat),
        storing: functieStoring(f.id, staat), status: functieStatus(f.id, staat),
        doelgroepen: (f.doelgroepen || []).map(dg => {
          const meta = DOELGROEP_OP_ID[dg] || { id: dg, naam: dg, emoji: '•' };
          return { id: dg, naam: meta.naam, emoji: meta.emoji, aan: functieAanVoor(f.id, dg, staat) };
        }),
        // actieve beperkingen per land en per persoon (alleen wat expliciet uit staat)
        landUit: Object.keys(perLand).filter(k => perLand[k] === false),
        persoonUit: Object.keys(perPersoon).filter(k => perPersoon[k] === false)
      };
    })
  })).filter(g => g.functies.length);
}

/* Valideer een lijst voorgestelde wijzigingen ({ id, doelgroep, aan }). Alleen
   bestaande functies, en een doelgroep die bij die functie hoort (of leeg =
   globaal). Zo kan de AI-hulp nooit iets onmogelijks voorstellen. */
function valideerVoorstel(arr) {
  if (!Array.isArray(arr)) return [];
  const uit = [];
  for (const w of arr) {
    const f = w && OP_ID[w.id];
    if (!f) continue;
    const aan = w.aan !== false && w.aan !== 'false';
    let dg = w.doelgroep || null;
    if (dg && !(f.doelgroepen || []).includes(dg)) continue;
    uit.push({ id: f.id, naam: f.naam, doelgroep: dg, aan });
  }
  return uit;
}

/* Lokale taal-hulp: begrijp een korte Nederlandse instructie en stel wijzigingen
   voor. Dit is de terugval als er geen AI-sleutel is, en houdt de controlekamer
   ook zonder externe AI bruikbaar. Herkent intentie (aan/uit), doelgroep(en) en
   welke functie(s) of categorie het betreft. */
function duidVoorstel(vraag, staat) {
  const q = ' ' + String(vraag || '').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ') + ' ';
  const wilUit = /\b(uit|uitzetten|uitschakelen|uitzet|dicht|sluit|sluiten|blokkeer|blokkeren|stop|stoppen|verberg|verbergen|off|geen)\b/.test(q);
  const wilAan = /\b(aan|aanzetten|inschakelen|aanzet|open|openzetten|activeer|activeren|toestaan|geef|on|wel)\b/.test(q);
  let zetAan = null;
  if (wilUit && !wilAan) zetAan = false; else if (wilAan && !wilUit) zetAan = true;

  // doelgroepen herkennen (leeg = geen specifieke: globaal)
  const dgs = [];
  for (const d of DOELGROEPEN) if (d.synoniemen.some(s => q.includes(' ' + s + ' ') || q.includes(' ' + s + ',') || q.includes(' ' + s + '.'))) dgs.push(d.id);
  if (/\bleden\b/.test(q) && !dgs.some(id => LEDEN.includes(id))) LEDEN.forEach(id => dgs.push(id));
  const doelen = dgs.length ? Array.from(new Set(dgs)) : [null]; // null = globaal

  // functies/categorie herkennen
  const alles = /\b(alles|alle functies|hele platform|het hele systeem|alle apps)\b/.test(q);
  let functies = [];
  if (alles) functies = FUNCTIES.slice();
  else {
    const cat = CATEGORIEEN.find(c => q.includes(' ' + c.toLowerCase().split(' (')[0] + ' '));
    if (cat) functies = FUNCTIES.filter(f => f.categorie === cat);
    // trefwoorden uit de functienaam en id
    for (const f of FUNCTIES) {
      if (functies.includes(f)) continue;
      const woorden = (f.naam.toLowerCase().match(/\p{L}{4,}/gu) || []).concat(f.id.split('-'));
      if (woorden.some(w => w.length >= 4 && q.includes(' ' + w))) functies.push(f);
    }
  }

  // voorstel opbouwen: alleen echte veranderingen, en doelgroep moet bij de functie horen
  const voorstel = [];
  if (zetAan !== null) {
    for (const f of functies) {
      for (const dg of doelen) {
        if (dg && !(f.doelgroepen || []).includes(dg)) continue;
        if (functieAanVoor(f.id, dg, staat) === zetAan) continue; // al zo
        voorstel.push({ id: f.id, naam: f.naam, doelgroep: dg, aan: zetAan });
      }
    }
  }
  const dgNaam = doelen.filter(Boolean).map(id => (DOELGROEP_OP_ID[id] || {}).naam).join(', ');
  let uitleg;
  if (zetAan === null) uitleg = 'Ik kon niet goed uit je vraag halen of iets AAN of UIT moet. Noem duidelijk "aanzetten" of "uitzetten", en voor welke doelgroep.';
  else if (!functies.length) uitleg = 'Ik herkende geen functie of app in je vraag. Noem bijvoorbeeld "de sociale laag", "de kassa" of een categorie.';
  else if (!voorstel.length) uitleg = 'Dat staat al zo ingesteld' + (dgNaam ? ' voor ' + dgNaam : '') + '; er is niets te wijzigen.';
  else uitleg = 'Voorstel: ' + voorstel.length + ' wijziging(en) ' + (zetAan ? 'AAN' : 'UIT') + (dgNaam ? ' voor ' + dgNaam : ' (globaal)') + '. Controleer en vraag ze aan.';
  return { voorstel, uitleg };
}


module.exports = { catalogus, valideerVoorstel, duidVoorstel };
