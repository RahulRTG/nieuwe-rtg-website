/* Sportclub, deelbestand "sportief": de teams van jeugd tot het eerste
   (selectie op codenaam), het wedstrijdprogramma met uitslagen, de stand die
   live uit de echte uitslagen wordt berekend (3-1-0, doelsaldo) en het
   veldbeheer. Krijgt de gedeelde ctx van ./index.js. */
module.exports = (ctx) => {
  const { save, schoon, id, nu, vandaag, club, seed, vindWedstrijd, TEAM_CATEGORIEEN, VELD_STATUS } = ctx;

  /* ---------- teams: van de jeugd tot het eerste ---------- */
  function teams(code) {
    seed();
    return { ok: true, categorieen: TEAM_CATEGORIEEN, teams: club(code).teams.map(t => ({
      id: t.id, naam: t.naam, categorie: t.categorie, competitie: t.competitie, trainer: t.trainer, spelers: t.spelers.length })) };
  }
  function teamMaak(code, data) {
    data = data || {};
    const naam = schoon(data.naam, 60);
    if (naam.length < 2) return { status: 400, error: 'Geef het team een naam.' };
    const t = { id: id('tm'), naam, categorie: TEAM_CATEGORIEEN.includes(data.categorie) ? data.categorie : 'jeugd',
      competitie: schoon(data.competitie, 60) || 'Vriendschappelijk', trainer: schoon(data.trainer, 60) || null, spelers: [] };
    club(code).teams.unshift(t);
    save();
    return { ok: true, team: t };
  }
  function spelerVoeg(code, teamId, codenaam) {
    const t = club(code).teams.find(x => x.id === String(teamId || ''));
    if (!t) return { status: 404, error: 'Team niet gevonden.' };
    const naam = schoon(codenaam, 60);
    if (naam.length < 2) return { status: 400, error: 'De selectie draait op codenaam.' };
    if (t.spelers.includes(naam)) return { status: 409, error: 'Deze speler staat al in de selectie.' };
    t.spelers.push(naam);
    t.spelers = t.spelers.slice(0, 40);
    save();
    return { ok: true, team: { id: t.id, naam: t.naam, spelers: t.spelers } };
  }

  /* ---------- wedstrijden en uitslagen ---------- */
  function wedstrijdMaak(code, data) {
    data = data || {};
    const c = club(code);
    const t = c.teams.find(x => x.id === String(data.teamId || '')) || c.teams[0];
    if (!t) return { status: 400, error: 'Maak eerst een team.' };
    const w = { id: id('wd'), teamId: t.id, tegenstander: schoon(data.tegenstander, 60) || 'Onbekend',
      thuis: data.thuis !== false, datum: /^\d{4}-\d{2}-\d{2}$/.test(String(data.datum || '')) ? data.datum : vandaag(),
      tijd: /^\d{2}:\d{2}$/.test(String(data.tijd || '')) ? data.tijd : '14:00',
      veld: schoon(data.veld, 40) || null, uitslag: null, at: nu() };
    c.wedstrijden.unshift(w);
    c.wedstrijden = c.wedstrijden.slice(0, 2000);
    save();
    return { ok: true, wedstrijd: w };
  }
  function uitslagZet(code, wid, voor, tegen) {
    const c = club(code);
    const w = vindWedstrijd(c, wid);
    if (!w) return { status: 404, error: 'Wedstrijd niet gevonden.' };
    const v = Math.round(Number(voor)), t = Math.round(Number(tegen));
    if (!Number.isFinite(v) || !Number.isFinite(t) || v < 0 || t < 0 || v > 99 || t > 99)
      return { status: 400, error: 'Een uitslag is twee getallen van 0 tot 99.' };
    w.uitslag = { voor: v, tegen: t };
    save();
    return { ok: true, wedstrijd: w };
  }

  /* ---------- de stand: live berekend uit de uitslagen ---------- */
  function stand(code, teamId) {
    seed();
    const c = club(code);
    const t = c.teams.find(x => x.id === String(teamId || '')) || c.teams[0];
    if (!t) return { ok: true, competitie: null, tabel: [] };
    // de demo-competitie: de eigen uitslagen tellen echt; de rest van de
    // tabel is een stabiele demo-benadering rond de eigen punten
    const eigen = { team: t.naam, g: 0, w: 0, gl: 0, v: 0, dv: 0, dt: 0, p: 0 };
    for (const w of c.wedstrijden.filter(x => x.teamId === t.id && x.uitslag)) {
      eigen.g += 1; eigen.dv += w.uitslag.voor; eigen.dt += w.uitslag.tegen;
      if (w.uitslag.voor > w.uitslag.tegen) { eigen.w += 1; eigen.p += 3; }
      else if (w.uitslag.voor === w.uitslag.tegen) { eigen.gl += 1; eigen.p += 1; }
      else eigen.v += 1;
    }
    const anderen = ['CD Salinas', 'Portinatx United', 'Es Vedra FC', 'Cala Conta', 'Benirras Boys']
      .map((naam, i) => ({ team: naam, g: eigen.g, w: Math.max(0, eigen.w - 1 + (i % 2)), gl: 1, v: Math.max(0, eigen.g - eigen.w - (i % 2)),
        dv: Math.max(0, eigen.dv - 2 - i), dt: eigen.dt + i, p: Math.max(0, eigen.p - 2 - i) }));
    const tabel = [eigen, ...anderen].sort((a, b) => b.p - a.p || (b.dv - b.dt) - (a.dv - a.dt));
    return { ok: true, competitie: t.competitie, team: t.naam, tabel };
  }

  /* ---------- het veldbeheer ---------- */
  function velden(code) {
    seed();
    return { ok: true, statussen: VELD_STATUS, velden: club(code).velden };
  }
  function veldZet(code, vid, data) {
    data = data || {};
    const v = club(code).velden.find(x => x.id === String(vid || ''));
    if (!v) return { status: 404, error: 'Veld niet gevonden.' };
    if (data.status && !VELD_STATUS.includes(data.status)) return { status: 400, error: 'Kies een status (' + VELD_STATUS.join(', ') + ').' };
    if (data.status) v.status = data.status;
    if (data.notitie !== undefined) v.notitie = schoon(data.notitie, 200) || null;
    save();
    return { ok: true, veld: v };
  }

  return { teams, teamMaak, spelerVoeg, wedstrijdMaak, uitslagZet, stand, velden, veldZet };
};
