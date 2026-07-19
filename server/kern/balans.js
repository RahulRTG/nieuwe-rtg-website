/* RTG Balans: Rahul kijkt naar de agenda, het rooster en het eetpatroon en
   adviseert ook eens NIKS: rust, hobby's, ontprikkelen. Een gezonde
   leefstijl hoort bij het huis, maar zonder dwang, schuldgevoel of
   streaks: alleen een eerlijk weekbeeld en een vriendelijk advies dat je
   gerust mag negeren. Het beeld komt uit wat er al is (de agenda, het
   grootboek, de klokuren van het personeel); er wordt niets nieuws over
   het lid vastgelegd. */
const DAG = 86400000;

/* puur: het weekbeeld uit agenda-items (komende 7 dagen) en
   grootboekrijen (afgelopen 14 dagen) */
function weekBeeld({ agenda = [], rijen = [], nu = new Date() }) {
  const dagen = [...Array(7)].map((_, i) => new Date(nu.getTime() + i * DAG).toISOString().slice(0, 10));
  const items = agenda.filter(i => !i.gedaan && dagen.includes(i.datum));
  const perDag = dagen.map(d => items.filter(i => i.datum === d).length);
  const sinds = new Date(nu.getTime() - 14 * DAG).toISOString();
  const eet = rijen.filter(r => r.at >= sinds && /^partner:/.test(r.naar || ''));
  const laat = eet.filter(r => { const u = new Date(r.at).getHours(); return u >= 23 || u < 5; }).length;
  return {
    dagen, perDag,
    vrijeDagen: perDag.filter(n => n === 0).length,
    avonden: items.filter(i => i.tijd && i.tijd >= '19:00').length,
    uitPerWeek: +(eet.length / 2).toFixed(1),
    laat
  };
}

/* puur: de adviezen, eerlijk en zonder opgeheven vinger; hooguit vier */
function adviezenUit(b) {
  const a = [];
  if (b.vrijeDagen === 0) a.push({ icoon: '🌿', tekst: 'Er staat de komende week geen enkele lege dag in uw agenda. Plan er een: niks doen is ook een afspraak.' });
  else if (b.vrijeDagen <= 2) a.push({ icoon: '🌿', tekst: 'Nog ' + b.vrijeDagen + ' lege dag(en) deze week. Houd ze leeg; ontprikkelen werkt het best zonder plan.' });
  else a.push({ icoon: '✨', tekst: 'Uw week ademt: ' + b.vrijeDagen + ' dagen zonder verplichtingen. Zo hoort het.' });
  if (b.avonden >= 4) a.push({ icoon: '🌙', tekst: b.avonden + ' avonden gepland. Kies er een om vroeg te stoppen: schermen uit, een wandeling, een boek of uw hobby.' });
  if (b.laat >= 3) a.push({ icoon: '😴', tekst: 'RTG ziet ' + b.laat + ' late nachten in twee weken. Slaap is de beste investering van het huis.' });
  if (b.uitPerWeek >= 5) a.push({ icoon: '🥗', tekst: 'U at ongeveer ' + b.uitPerWeek + ' keer per week buiten de deur. Zelf koken is ook ontprikkelen; Rahul denkt mee met een simpel recept dat bij uw zorgprofiel past.' });
  else a.push({ icoon: '🏃', tekst: 'Beweging hoeft geen sport te zijn: een half uur wandelen op een lege dag telt volop. Liever echt sporten? Rahul kent de spa- en wellnesspartners.' });
  return a.slice(0, 4);
}

/* puur: het stille balans-seintje. Alleen als de komende week echt vol zit
   (nul lege dagen) fluistert Balans een keer mee in "Rahul ziet"; nooit
   een melding op het toestel, en een week met lucht blijft stil. */
function seintjeVoorBalans(balansResultaat) {
  const b = balansResultaat && balansResultaat.beeld;
  if (!b || b.vrijeDagen > 0) return null;
  return { icoon: '🌿', tekst: 'Uw komende week zit vol; niks doen is ook een afspraak. Vraag me gerust een rustmoment te plannen.' };
}

function maakBalans({ db, zorgVan, klokVan }) {
  const boek = () => Array.isArray(db.data.payBoekingen) ? db.data.payBoekingen : [];

  function balansVoorLid(codenaam, key, nu = new Date()) {
    const agenda = ((db.data.agendas || {})['lid:' + key] || []);
    const rijen = boek().filter(r => r.van === 'lid:' + codenaam).slice(0, 400);
    const beeld = weekBeeld({ agenda, rijen, nu });
    const zorg = zorgVan ? zorgVan(key) : null;
    return {
      ok: true, beeld, adviezen: adviezenUit(beeld),
      koken: zorg && (zorg.allergenen || []).length
        ? 'Rahul kookt met u mee en houdt rekening met: ' + zorg.allergenen.join(', ') + '.'
        : 'Rahul kookt met u mee; zet allergenen of een dieet in uw zorgprofiel en hij houdt er rekening mee.',
      vraagRust: 'Kijk naar mijn agenda en plan een rustmoment deze week; ik wil een dag niks.',
      vraagKoken: 'Geef me een simpel recept voor vanavond dat bij mijn zorgprofiel past.',
      vraagBewegen: 'Welke spa-, wellness- of sportmogelijkheden zijn er bij onze huizen? Plan er een op een lege dag deze week.'
    };
  }

  /* de werkkant: klokuren vertellen eerlijk of iemand te vol zit */
  function balansVoorStaf(code, staffId, nu = new Date()) {
    if (!staffId) return { ok: true, klok: null, adviezen: [{ icoon: '🌿', tekst: 'Log in op uw eigen naam (PIN) om uw persoonlijke balans te zien.' }] };
    const klok = klokVan(code, staffId);
    const a = [];
    if (klok.weekUren >= 45) a.push({ icoon: '🛑', tekst: 'U staat deze week al op ' + klok.weekUren + ' uur. Bespreek een vrije dag met de manager; het rooster kan het dragen.' });
    else if (klok.weekUren >= 38) a.push({ icoon: '🌙', tekst: klok.weekUren + ' uur deze week: een volle week. Plan uw vrije dag bewust en doe er iets wat geen scherm nodig heeft.' });
    else a.push({ icoon: '✨', tekst: klok.weekUren + ' uur deze week: gezond in balans. Houd dat vast.' });
    if (klok.vandaagUren >= 9) a.push({ icoon: '😴', tekst: 'Vandaag al ' + klok.vandaagUren + ' uur geklokt. Rond af wat moet en klok uit; morgen is er ook nog.' });
    return { ok: true, klok, adviezen: a };
  }

  return { balans: { balansVoorLid, balansVoorStaf, seintjeVoorBalans, weekBeeld, adviezenUit } };
}

module.exports = { maakBalans, weekBeeld, adviezenUit, seintjeVoorBalans };
