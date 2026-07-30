/* RTG Opvang: de AZC-/COA-afdeling. Locaties met capaciteit en bezetting,
   mensen in de opvang, en de doorstroom van aanmelding tot een eigen woning.

   Privacy by design, strenger dan waar dan ook: een bewoner staat hier
   ALLEEN als dossiernummer, met de gegevens die je nodig hebt om goed voor
   iemand te zorgen (gezinsgrootte, taal, of er kinderen zijn, de fase).
   Geen namen, geen nationaliteit-op-het-scherm, geen geboortedata. Wie een
   persoon echt moet kennen, doet dat buiten dit bord om -- net als bij de
   codenamen van de leden.

   De keten: aangemeld -> opvang -> statushouder -> gehuisvest (of vertrek).
   Elke stap is een menselijk besluit; het systeem rekent alleen mee. */
module.exports = ({ db, save, crypto }) => {
  const nu = () => new Date().toISOString();
  const d = () => db.data;
  const locaties = () => { if (!d().opvangLocaties || typeof d().opvangLocaties !== 'object') d().opvangLocaties = {}; return d().opvangLocaties; };
  const dossiers = () => { if (!Array.isArray(d().opvangDossiers)) d().opvangDossiers = []; return d().opvangDossiers; };

  const SOORTEN = { azc: 'Asielzoekerscentrum', nood: 'Noodopvang', gezin: 'Gezinslocatie',
    amv: 'Alleenstaande minderjarigen', pol: 'Procesopvanglocatie', doorstroom: 'Doorstroomlocatie' };
  const FASEN = ['aangemeld', 'opvang', 'statushouder', 'gehuisvest', 'vertrokken'];
  const DIENSTEN = ['school', 'huisarts', 'ggz', 'juridisch', 'taalles', 'werk', 'sport', 'kinderopvang'];

  const getal = (v, min, max, std) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : std; };
  const schoonTekst = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n);

  /* ---------- locaties ---------- */
  function locatieZet(data, id) {
    data = data || {};
    const bestaand = id ? locaties()[id] : null;
    if (id && !bestaand) return { status: 404, error: 'Die locatie bestaat niet.' };
    const naam = schoonTekst(data.naam, 60), plaats = schoonTekst(data.plaats, 60);
    if (!naam || !plaats) return { status: 400, error: 'Geef de locatie een naam en een plaats.' };
    const l = bestaand || { id: 'OPV' + crypto.randomBytes(3).toString('hex').toUpperCase(), geopend: nu() };
    Object.assign(l, {
      naam, plaats,
      soort: SOORTEN[data.soort] ? data.soort : 'azc',
      capaciteit: getal(data.capaciteit, 0, 5000, 100),
      diensten: (Array.isArray(data.diensten) ? data.diensten : []).filter(x => DIENSTEN.includes(x)),
      notitie: schoonTekst(data.notitie, 300),
      open: data.open !== false
    });
    locaties()[l.id] = l;
    save();
    return { ok: true, locatie: metCijfers(l) };
  }

  const bezetVan = id => dossiers().filter(x => x.locatie === id && ['aangemeld', 'opvang', 'statushouder'].includes(x.fase))
    .reduce((s, x) => s + x.personen, 0);

  function metCijfers(l) {
    const bezet = bezetVan(l.id);
    const vrij = Math.max(0, l.capaciteit - bezet);
    return Object.assign({}, l, { soortLabel: SOORTEN[l.soort], bezet, vrij,
      bezettingPct: l.capaciteit ? Math.min(100, Math.round(bezet / l.capaciteit * 100)) : 0 });
  }

  function locatieLijst() {
    const lijst = Object.values(locaties()).map(metCijfers).sort((a, b) => b.bezettingPct - a.bezettingPct);
    const cap = lijst.reduce((s, l) => s + l.capaciteit, 0);
    const bez = lijst.reduce((s, l) => s + l.bezet, 0);
    return { ok: true, locaties: lijst, soorten: SOORTEN, diensten: DIENSTEN,
      totaal: { locaties: lijst.length, capaciteit: cap, bezet: bez, vrij: Math.max(0, cap - bez),
        bezettingPct: cap ? Math.round(bez / cap * 100) : 0 } };
  }

  /* ---------- dossiers (op nummer, nooit op naam) ---------- */
  function dossierMaak(data) {
    data = data || {};
    const l = locaties()[String(data.locatie || '')];
    if (!l) return { status: 404, error: 'Kies een bestaande locatie.' };
    if (!l.open) return { status: 409, error: 'Deze locatie neemt niemand op dit moment op.' };
    const personen = getal(data.personen, 1, 12, 1);
    if (bezetVan(l.id) + personen > l.capaciteit) return { status: 409, error: 'Deze locatie heeft niet genoeg plek; kies een andere locatie.' };
    const dos = {
      nummer: 'DOS-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      locatie: l.id, locatieNaam: l.naam,
      personen, kinderen: getal(data.kinderen, 0, 10, 0),
      taal: schoonTekst(data.taal, 30) || null,
      bijzonder: schoonTekst(data.bijzonder, 200),
      diensten: (Array.isArray(data.diensten) ? data.diensten : []).filter(x => DIENSTEN.includes(x)),
      fase: 'aangemeld', historie: [{ fase: 'aangemeld', at: nu() }], at: nu()
    };
    dossiers().unshift(dos);
    if (dossiers().length > 50000) dossiers().length = 50000;
    save();
    return { ok: true, dossier: dos };
  }

  /* De fase verzetten: alleen vooruit door de keten, of naar vertrokken. */
  function faseZet(nummer, fase, notitie) {
    const dos = dossiers().find(x => x.nummer === String(nummer || ''));
    if (!dos) return { status: 404, error: 'Dat dossiernummer kennen we niet.' };
    if (!FASEN.includes(fase)) return { status: 400, error: 'Onbekende fase.' };
    const nu2 = FASEN.indexOf(dos.fase), naar = FASEN.indexOf(fase);
    if (fase !== 'vertrokken' && naar <= nu2) return { status: 409, error: 'De keten loopt vooruit: van ' + dos.fase + ' kan dit niet terug.' };
    dos.fase = fase;
    dos.historie.push({ fase, at: nu(), notitie: schoonTekst(notitie, 200) || undefined });
    save();
    return { ok: true, dossier: dos };
  }

  function dienstZet(nummer, dienst, aan) {
    const dos = dossiers().find(x => x.nummer === String(nummer || ''));
    if (!dos) return { status: 404, error: 'Dat dossiernummer kennen we niet.' };
    if (!DIENSTEN.includes(dienst)) return { status: 400, error: 'Onbekende dienst.' };
    dos.diensten = (dos.diensten || []).filter(x => x !== dienst);
    if (aan !== false) dos.diensten.push(dienst);
    save();
    return { ok: true, diensten: dos.diensten };
  }

  function dossierLijst(f) {
    f = f || {};
    let lijst = dossiers();
    if (FASEN.includes(f.fase)) lijst = lijst.filter(x => x.fase === f.fase);
    if (f.locatie) lijst = lijst.filter(x => x.locatie === f.locatie);
    return { ok: true, dossiers: lijst.slice(0, 200), fasen: FASEN, aantal: lijst.length };
  }

  /* ---------- het bord van de afdeling ---------- */
  function bord() {
    const loc = locatieLijst();
    const perFase = {};
    for (const f of FASEN) perFase[f] = dossiers().filter(x => x.fase === f).reduce((s, x) => s + x.personen, 0);
    const wachtOpWoning = dossiers().filter(x => x.fase === 'statushouder');
    const vol = loc.locaties.filter(l => l.bezettingPct >= 90);
    const seinen = [];
    if (loc.totaal.bezettingPct >= 90) seinen.push('De opvang zit vrijwel vol (' + loc.totaal.bezettingPct + '%); open een locatie bij of versnel de doorstroom.');
    if (vol.length) seinen.push(vol.length + ' locatie(s) boven 90%: ' + vol.slice(0, 3).map(l => l.naam).join(', ') + '.');
    if (wachtOpWoning.length) seinen.push(wachtOpWoning.reduce((s, x) => s + x.personen, 0) + ' mensen met een status wachten op een woning -- dat is de snelste winst voor de doorstroom.');
    const kinderen = dossiers().filter(x => ['aangemeld', 'opvang', 'statushouder'].includes(x.fase)).reduce((s, x) => s + (x.kinderen || 0), 0);
    return { ok: true, totaal: loc.totaal, perFase, kinderen, seinen,
      locaties: loc.locaties.slice(0, 20), wachtOpWoning: wachtOpWoning.length,
      privacy: 'Iedereen staat hier als dossiernummer. Namen, nationaliteit en geboortedata horen niet op een bezettingsbord.' };
  }

  return { opvang: { SOORTEN, FASEN, DIENSTEN, locatieZet, locatieLijst, dossierMaak, faseZet, dienstZet, dossierLijst, bord } };
};
