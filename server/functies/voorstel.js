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

/* Valideer een lijst voorgestelde wijzigingen. Naast het klassieke schakelen
   ({ id, doelgroep|genre, aan }) kent het contract nu ook de geld-regie:
   { soort:'pasprijs', pas, euro }, { soort:'korting', genre, pct } en
   { soort:'commissie', genre|code, pct }. Alleen bestaande functies en
   doelgroepen komen erdoor; genres en zaakcodes worden schoongemaakt en bij
   het toepassen nogmaals door de geld-/genre-motor gecontroleerd. Zo kan de
   AI-hulp (Rahul) nooit iets onmogelijks voorstellen; er verandert pas iets
   als de eigenaar het voorstel toepast. */
const schoonGenre = g => String(g || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30) || null;
const schoonCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || null;
function valideerVoorstel(arr) {
  if (!Array.isArray(arr)) return [];
  const uit = [];
  for (const w of arr) {
    if (!w) continue;
    const soort = String(w.soort || 'schakel');
    if (soort === 'pasprijs') {
      const pas = w.pas === 'rtg' || w.pas === 'lifestyle' ? w.pas : null;
      const euro = Number(w.euro);
      if (pas && Number.isFinite(euro) && euro >= 0 && euro <= 100000)
        uit.push({ soort, pas, euro, naam: 'Pasprijs ' + (pas === 'rtg' ? 'RTG Pass' : 'Lifestyle Pass') + ' naar € ' + euro + ' per maand (ex btw)' });
      continue;
    }
    if (soort === 'korting' || soort === 'commissie') {
      const pct = Number(w.pct);
      const max = soort === 'korting' ? 50 : 30;
      const genre = schoonGenre(w.genre), code = soort === 'commissie' ? schoonCode(w.code) : null;
      if (Number.isFinite(pct) && pct >= 0 && pct <= max && (genre || code))
        uit.push({ soort, genre, code, pct,
          naam: (soort === 'korting' ? 'Ledenvoordeel ' : 'Partnervergoeding ') + (code || genre) + ' naar ' + pct + '%' });
      continue;
    }
    const f = OP_ID[w.id];
    if (!f) continue;
    const aan = w.aan !== false && w.aan !== 'false';
    const genre = schoonGenre(w.genre);
    if (genre) { uit.push({ soort: 'schakel', id: f.id, naam: f.naam, genre, aan }); continue; }
    let dg = w.doelgroep || null;
    if (dg && !(f.doelgroepen || []).includes(dg)) continue;
    uit.push({ soort: 'schakel', id: f.id, naam: f.naam, doelgroep: dg, aan });
  }
  return uit;
}

/* Lokale taal-hulp: begrijp een korte Nederlandse instructie en stel wijzigingen
   voor. Dit is de terugval als er geen AI-sleutel is, en houdt de controlekamer
   ook zonder externe AI bruikbaar. Herkent intentie (aan/uit), doelgroep(en) en
   welke functie(s) of categorie het betreft. */
function duidVoorstel(vraag, staat, extra) {
  const ruw = String(vraag || '');
  const q = ' ' + ruw.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ') + ' ';
  const genres = (extra && Array.isArray(extra.genres)) ? extra.genres : [];
  const genreInVraag = () => {
    for (const g of genres) {
      const namen = [g.id, (g.label || '').toLowerCase()].filter(Boolean);
      if (namen.some(n => n && q.includes(' ' + n + ' '))) return g.id;
    }
    return null;
  };
  // strak: alleen een genre dat na "voor" staat ("sluit rtg eye voor horeca"),
  // anders leest "zet de charter uit" het genre charter in de functienaam
  const genreNaVoor = () => {
    for (const g of genres) {
      const namen = [g.id, (g.label || '').toLowerCase()].filter(Boolean);
      for (const n of namen) {
        if (!n) continue;
        const veilig = n.replace(/[.*+?^${}()|[\]\\]/g, '');
        if (new RegExp(' voor (de |het |alle )?' + veilig + '( |-)').test(q)) return g.id;
      }
    }
    return null;
  };
  const getal = () => { const m = ruw.match(/(\d+(?:[.,]\d+)?)/); return m ? Number(m[1].replace(',', '.')) : null; };

  /* ---- de geld-regie in gewone taal (Rahul stelt voor, de eigenaar past toe) ---- */
  if (/pasprijs|maandbijdrage|maandprijs|prijs van de .*pas|pas .*euro/.test(q) || (/\bpas\b/.test(q) && /euro|eur\b/.test(q))) {
    const pas = /lifestyle/.test(q) ? 'lifestyle' : (/\brtg\b/.test(q) ? 'rtg' : null);
    const euro = getal();
    if (/gratis/.test(q) && !pas) return { voorstel: [], uitleg: 'De gratis app blijft gratis; dat bedrag staat vast.' };
    if (/business/.test(q)) return { voorstel: [], uitleg: 'De Business Pass is prijs op maat; dat spreekt u per klant af.' };
    if (pas && euro != null)
      return { voorstel: valideerVoorstel([{ soort: 'pasprijs', pas, euro }]),
        uitleg: 'Voorstel: de ' + (pas === 'rtg' ? 'RTG Pass' : 'Lifestyle Pass') + ' naar € ' + euro + ' per maand (ex btw). Controleer en pas toe.' };
  }
  if (/korting|ledenvoordeel|voordeel/.test(q) && /%|procent/.test(q + ruw.toLowerCase())) {
    const genre = genreInVraag(), pct = getal();
    if (genre && pct != null)
      return { voorstel: valideerVoorstel([{ soort: 'korting', genre, pct }]),
        uitleg: 'Voorstel: ' + pct + '% ledenvoordeel op ' + genre + ' (RTG legt bij; de zaak houdt het volle bedrag). Controleer en pas toe.' };
  }
  if (/commissie|vergoeding/.test(q) && /%|procent/.test(q + ruw.toLowerCase())) {
    const genre = genreInVraag(), pct = getal();
    const codeM = ruw.match(/\b([A-Z][A-Z0-9]{2,11})\b/);
    if ((genre || codeM) && pct != null)
      return { voorstel: valideerVoorstel([{ soort: 'commissie', genre, code: codeM ? codeM[1] : null, pct }]),
        uitleg: 'Voorstel: de partnervergoeding voor ' + (codeM ? codeM[1] : genre) + ' naar ' + pct + '%. Interne afspraak; raakt het lid nooit. Controleer en pas toe.' };
  }
  const wilUit = /\b(uit|uitzetten|uitschakelen|uitzet|dicht|sluit|sluiten|blokkeer|blokkeren|stop|stoppen|verberg|verbergen|off|geen)\b/.test(q);
  const wilAan = /\b(aan|aanzetten|inschakelen|aanzet|open|openzetten|activeer|activeren|toestaan|geef|on|wel)\b/.test(q);
  let zetAan = null;
  if (wilUit && !wilAan) zetAan = false; else if (wilAan && !wilUit) zetAan = true;

  // doelgroepen herkennen (leeg = geen specifieke: globaal)
  const dgs = [];
  for (const d of DOELGROEPEN) if (d.synoniemen.some(s => q.includes(' ' + s + ' ') || q.includes(' ' + s + ',') || q.includes(' ' + s + '.'))) dgs.push(d.id);
  if (/\bleden\b/.test(q) && !dgs.some(id => LEDEN.includes(id))) LEDEN.forEach(id => dgs.push(id));
  let doelen = dgs.length ? Array.from(new Set(dgs)) : [null]; // null = globaal

  // functies/categorie herkennen
  const alles = /\b(alles|alle functies|hele platform|het hele systeem|alle apps)\b/.test(q);
  let functies = [];
  if (alles) functies = FUNCTIES.slice();
  else {
    const cat = CATEGORIEEN.find(c => q.includes(' ' + c.toLowerCase().split(' (')[0] + ' '));
    if (cat) functies = FUNCTIES.filter(f => f.categorie === cat);
    // trefwoorden uit de functienaam en id; de volle naam (zonder haakjes) en
    // de id tellen ook, zodat korte namen als "RTG Eye" en "OV" herkend worden
    for (const f of FUNCTIES) {
      if (functies.includes(f)) continue;
      const naamKort = f.naam.toLowerCase().split(' (')[0];
      if (q.includes(' ' + naamKort + ' ') || q.includes(' ' + f.id + ' ')) { functies.push(f); continue; }
      const woorden = (f.naam.toLowerCase().match(/\p{L}{4,}/gu) || []).concat(f.id.split('-'));
      if (woorden.some(w => w.length >= 4 && q.includes(' ' + w))) functies.push(f);
    }
  }

  /* Doelgroep-woorden die alleen in een herkende functienaam zaten tellen
     niet als doelgroep: "sluit RTG Eye" gaat over de functie, niet over de
     RTG Pass. We halen de herkende naamfrases uit de vraag en kijken opnieuw. */
  let qZonder = q;
  for (const f of functies) {
    const nk = ' ' + f.naam.toLowerCase().split(' (')[0] + ' ';
    qZonder = qZonder.split(nk).join(' ');
  }
  const dgsEcht = [];
  for (const d of DOELGROEPEN) if (d.synoniemen.some(s => qZonder.includes(' ' + s + ' '))) dgsEcht.push(d.id);
  if (/\bleden\b/.test(qZonder) && !dgsEcht.some(id => LEDEN.includes(id))) LEDEN.forEach(id => dgsEcht.push(id));
  doelen = dgsEcht.length ? Array.from(new Set(dgsEcht)) : [null];

  // de leveranciers-regie in gewone taal: "sluit rtg eye voor horeca"
  const genreDoel = genreNaVoor();
  if (genreDoel && zetAan !== null && functies.length && !dgsEcht.length) {
    const voorstel = functies
      .filter(f => (f.doelgroepen || []).some(d => d === 'leverancier' || d === 'personeel'))
      .filter(f => {
        // alleen echte veranderingen: uit stelt alleen voor wat nog open staat, aan alleen wat dicht staat
        const nuDicht = !!(staat && staat[f.id] && staat[f.id].perGenre && staat[f.id].perGenre[genreDoel] === false);
        return zetAan ? nuDicht : !nuDicht;
      })
      .map(f => ({ id: f.id, naam: f.naam, genre: genreDoel, aan: zetAan }));
    return { voorstel: valideerVoorstel(voorstel),
      uitleg: voorstel.length
        ? 'Voorstel: ' + voorstel.length + ' functie(s) ' + (zetAan ? 'weer open' : 'dicht') + ' voor het genre ' + genreDoel + '. Controleer en pas toe.'
        : 'Dat staat al zo voor het genre ' + genreDoel + ', of de genoemde functie hoort niet bij de werk-apps.' };
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
  return { voorstel: valideerVoorstel(voorstel), uitleg };
}


module.exports = { catalogus, valideerVoorstel, duidVoorstel };
