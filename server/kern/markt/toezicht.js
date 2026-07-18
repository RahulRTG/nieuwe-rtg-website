/* Markt-toezicht: melden en blokkeren (drie meldingen = verborgen) en de
   AI-hulp (prijsadvies, veiligheidsscan, nette beschrijving). Krijgt de
   gedeelde context een keer bij het opstarten vanuit kern/markt.js. */
module.exports = (ctx) => {
  const { db, save, crypto, anthropic, schoon, notify, notifySupplier, haversine, betaal,
    CATEGORIEEN, STATEN, LEVERING, RESPECTLOOS, VERBODEN, SCAM_WOORDEN, CONTACT_BUITEN,
    RICHTPRIJS, STAAT_FACTOR, SAMEN_METER, SAMEN_VERS_MS,
    store, rid, nu, clip, pk, keurTekst, scanVeiligheid, pub, zichtbaar, vind } = ctx;
  /* ---------- melden & blokkeren ---------- */
  function meld(id, melder, reden) {
    const ad = vind(id);
    if (!ad) return { error: 'Advertentie niet gevonden.', status: 404 };
    if (pk(ad.verkoper) === pk(melder)) return { error: 'Je kunt je eigen advertentie niet melden.', status: 400 };
    ad.melders = ad.melders || [];
    const k = pk(melder);
    if (!ad.melders.includes(k)) ad.melders.push(k);
    ad.meldRedenen = ad.meldRedenen || [];
    if (reden) ad.meldRedenen.push({ reden: clip(reden, 200), at: nu() });
    save();
    return { ok: true, verborgen: ad.melders.length >= 3 };
  }
  function blokkeer(partij, doelSoort, doelId) {
    const m = store();
    const key = pk(partij);
    const doel = pk({ soort: doelSoort, id: doelId });
    if (!doel || doel === key) return { error: 'Kan niet.', status: 400 };
    m.geblokkeerd[key] = m.geblokkeerd[key] || [];
    if (!m.geblokkeerd[key].includes(doel)) m.geblokkeerd[key].push(doel);
    save();
    return { ok: true };
  }
  function deblokkeer(partij, doelSoort, doelId) {
    const m = store();
    const key = pk(partij);
    const doel = pk({ soort: doelSoort, id: doelId });
    m.geblokkeerd[key] = (m.geblokkeerd[key] || []).filter(x => x !== doel);
    save();
    return { ok: true };
  }

  /* ---------- AI-hulp ---------- */
  const VEILIG_TIPS = [
    'Spreek af op een openbare, drukke plek en neem iemand mee.',
    'Betaal pas als je het spullen in handen hebt, of gebruik een veilige betaling.',
    'Betaal nooit vooruit en deel geen codes van cadeaukaarten.',
    'Houd het gesprek in de app; deel je adres pas als je een afspraak hebt.',
    'Vertrouw je het niet? Stop, en meld de advertentie.'
  ];
  function radenCategorie(titel) {
    const t = String(titel || '').toLowerCase();
    const map = [
      ['kleding', /(jas|broek|trui|jurk|schoen|shirt|kleding|sneaker)/], ['kids', /(baby|kinder|speelgoed|box|buggy|wieg|luier)/],
      ['elektronica', /(telefoon|iphone|laptop|tv|console|playstation|xbox|tablet|camera|koptelefoon)/],
      ['wonen', /(bank|stoel|tafel|kast|lamp|bed|servies|gordijn)/], ['tuin', /(tuin|plant|bbq|barbecue|parasol|schutting)/],
      ['vervoer', /(fiets|scooter|auto|step|brommer|aanhanger)/], ['boeken', /(boek|roman|studieboek|strip)/],
      ['sport', /(fitness|halter|voetbal|tennis|ski|yoga|fiets)/], ['vrije-tijd', /(spel|gitaar|piano|game|puzzel|lego)/]
    ];
    for (const [c, rx] of map) if (rx.test(t)) return c;
    return 'overig';
  }
  function prijsSuggestie(categorie, staat) {
    const basis = RICHTPRIJS[categorie] || 20;
    const f = STAAT_FACTOR[staat] || 1;
    const mid = Math.round(basis * f);
    return { laag: Math.max(1, Math.round(mid * 0.7)), midden: mid, hoog: Math.round(mid * 1.4) };
  }
  async function aiHelp(soort, data = {}) {
    const titel = clip(data.titel, 80);
    const beschrijving = clip(data.beschrijving, 1000);
    const categorie = CATEGORIEEN.includes(data.categorie) ? data.categorie : radenCategorie(titel);
    const staat = STATEN.includes(data.staat) ? data.staat : 'gebruikt';
    if (soort === 'categorie') return { categorie: radenCategorie(titel) };
    if (soort === 'prijs') {
      const p = prijsSuggestie(categorie, staat);
      return { prijs: p, tekst: 'Voor "' + (titel || categorie) + '" (' + staat + ') is ' + p.midden + ' euro een eerlijke vraagprijs; tussen ' + p.laag + ' en ' + p.hoog + ' euro is gebruikelijk. Vraag iets hoger dan je minimum, dan is er ruimte om te bieden.' };
    }
    if (soort === 'veilig') {
      const tekst = titel + ' ' + beschrijving;
      const vlaggen = [];
      if (SCAM_WOORDEN.test(tekst)) vlaggen.push('Er wordt gevraagd om vooruit te betalen of buiten de app te gaan.');
      if (CONTACT_BUITEN.test(beschrijving)) vlaggen.push('Er staan contactgegevens of een link in; houd het in de app.');
      return { veilig: vlaggen.length === 0, vlaggen, tips: VEILIG_TIPS };
    }
    // 'beschrijving' (standaard): een nette, eerlijke omschrijving
    if (anthropic) {
      try {
        const r = await anthropic.messages.create({
          model: 'claude-opus-4-8', max_tokens: 300,
          system: 'Je helpt iemand een korte, eerlijke, vriendelijke advertentietekst schrijven voor een tweedehands marktplaats. Nederlands, geen overdrijving, noem staat en of ophalen/verzenden kan. Geen contactgegevens.',
          messages: [{ role: 'user', content: 'Titel: ' + titel + '\nCategorie: ' + categorie + '\nStaat: ' + staat + '\nWat ik erover kwijt wil: ' + (beschrijving || '(niks)') }]
        });
        const tekst = (r.content || []).map(b => b.text || '').join('').trim();
        if (tekst) return { tekst };
      } catch (e) { /* val terug op sjabloon */ }
    }
    const staatT = { nieuw: 'nieuw en ongebruikt', zgan: 'zo goed als nieuw', gebruikt: 'netjes gebruikt, met normale gebruikssporen' }[staat];
    const tekst = (titel || 'Aangeboden') + '.\n\n' +
      (beschrijving ? beschrijving + '\n\n' : '') +
      'Staat: ' + staatT + '. Op te halen' + (Array.isArray(data.levering) && data.levering.includes('verzenden') ? ' of te verzenden' : '') +
      '. Vraag gerust naar meer foto\'s of informatie.';
    return { tekst };
  }
  return { meld, blokkeer, deblokkeer, aiHelp };
};
