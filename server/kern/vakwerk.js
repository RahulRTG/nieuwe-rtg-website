/* Vakwerk: het slimme dashboard voor de dienstverlenende genres, de
   zelfstandige professional (zzp), de privechef (chef) en wellness & spa
   (wellness). Deze genres draaien op hetzelfde aanbod-/boekingsmodel
   (s.services + db.data.boekingen met de statusketen aangevraagd ->
   bevestigd -> afgerond). Waar de horeca- en hoteltorens al een eigen
   backoffice hadden, gaf dat de dienstverleners alleen een kale
   aanbodlijst. Deze module tilt ze naar hetzelfde niveau: een
   vandaag-bord, de eerstvolgende afspraken, de aanvragen die op
   bevestiging wachten, omzet-KPI's en een genre-bewuste AI-assistent.

   Alles op codenaam: een boeking toont de codenaam van het lid, nooit de
   echte naam. Volgt het vaste kern-patroon maakVakwerk(state). */

const VAK_GENRES = {
  zzp: {
    label: 'Zelfstandig professional',
    werk: 'afspraak', werkMv: 'afspraken',
    persona: 'je bent de nuchtere bedrijfsadviseur van een zelfstandige professional op RTG. Je denkt mee over agenda, aanbod, tarieven en klantcontact, kort en concreet.'
  },
  chef: {
    label: 'Privechef & catering',
    werk: 'opdracht', werkMv: 'opdrachten',
    persona: 'je bent de ervaren culinair bedrijfsadviseur van een privechef & cateraar op RTG. Je denkt mee over boekingen, menuvoorstellen, mise en place en marge, kort en concreet.'
  },
  wellness: {
    label: 'Wellness & spa',
    werk: 'behandeling', werkMv: 'behandelingen',
    persona: 'je bent de spa-manager die meedenkt met een wellness- & spa-aanbieder op RTG. Je denkt mee over de behandelagenda, bezetting, het aanbod en rust in de planning, kort en concreet.'
  }
};

function maakVakwerk({ db, save, anthropic, findSupplier, boekingenVanZaak, schoon }) {
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const vandaagStr = () => new Date().toISOString().slice(0, 10);
  const rond = n => Math.round((Number(n) || 0) * 100) / 100;
  const datumVan = b => (b.wanneer ? String(b.wanneer).slice(0, 10) : null);
  const tijdVan = b => (b.wanneer && String(b.wanneer).length > 10 ? String(b.wanneer).slice(11, 16) : null);
  // de dag waarop de omzet valt: betaald -> betaaldatum, anders de aanmaakdatum
  const geldDag = b => String(b.paidAt || b.finishedAt || b.at || '').slice(0, 10);

  function genreVan(s) { return s ? VAK_GENRES[s.type] : null; }
  function isVak(s) { return !!genreVan(s); }

  /* ---- beschikbaarheid & boekbare tijdvakken ----
     De dienstverlener zet werkdagen en openingstijden; het lid boekt dan in
     een echt vrij tijdvak in plaats van een willekeurige tijd te typen. Vrije
     tijden houden rekening met de duur van de dienst en met wat al geboekt is
     (aangevraagd of bevestigd). geblokkeerd = losse vrije dagen. */
  const geldigeTijd = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || ''));
  const naarMin = t => { const m = String(t).match(/^(\d{2}):(\d{2})$/); return m ? (+m[1]) * 60 + (+m[2]) : null; };
  const naarTijd = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

  function urenVan(s) {
    const u = s.vakUren || {};
    return {
      // dagen[0..6] = zondag..zaterdag; standaard maandag t/m vrijdag
      dagen: Array.isArray(u.dagen) && u.dagen.length === 7 ? u.dagen.map(Boolean) : [false, true, true, true, true, true, false],
      van: geldigeTijd(u.van) ? u.van : '09:00',
      tot: geldigeTijd(u.tot) ? u.tot : '18:00',
      geblokkeerd: Array.isArray(u.geblokkeerd) ? u.geblokkeerd.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 366) : []
    };
  }
  function uren(code) {
    const s = findSupplier(code);
    if (!genreVan(s)) return { status: 403, error: 'Alleen voor dienstverlenende zaken.' };
    return { ok: true, uren: urenVan(s) };
  }
  function urenZet(code, data) {
    const s = findSupplier(code);
    if (!genreVan(s)) return { status: 403, error: 'Alleen voor dienstverlenende zaken.' };
    const nu = urenVan(s);
    const d = data || {};
    const dagen = Array.isArray(d.dagen) && d.dagen.length === 7 ? d.dagen.map(Boolean) : nu.dagen;
    const van = geldigeTijd(d.van) ? d.van : nu.van;
    const tot = geldigeTijd(d.tot) ? d.tot : nu.tot;
    if (naarMin(tot) <= naarMin(van)) return { status: 400, error: 'De sluitingstijd moet na de openingstijd liggen.' };
    let geblokkeerd = nu.geblokkeerd;
    if (d.blokkeer && /^\d{4}-\d{2}-\d{2}$/.test(d.blokkeer)) geblokkeerd = [...new Set([...geblokkeerd, d.blokkeer])];
    if (d.deblokkeer) geblokkeerd = geblokkeerd.filter(x => x !== d.deblokkeer);
    s.vakUren = { dagen, van, tot, geblokkeerd: geblokkeerd.slice(0, 366) };
    save();
    return { ok: true, uren: s.vakUren };
  }

  // de bezette tijdvakken (start-eindminuten) op een datum, uit de actieve boekingen
  function bezetOp(code, datum) {
    return (boekingenVanZaak(code) || [])
      .filter(b => (b.status === 'aangevraagd' || b.status === 'bevestigd') && datumVan(b) === datum && tijdVan(b))
      .map(b => { const start = naarMin(tijdVan(b)); return { start, eind: start + ((b.service && b.service.duurMin) || 60) }; });
  }
  function slots(code, serviceId, datum) {
    const s = findSupplier(code);
    if (!genreVan(s)) return { status: 403, error: 'Alleen voor dienstverlenende zaken.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(datum || ''))) return { status: 400, error: 'Kies een geldige datum.' };
    const dienst = (s.services || []).find(x => x.id === serviceId);
    const duur = (dienst && dienst.duurMin) || 60;
    const u = urenVan(s);
    const dag = new Date(datum + 'T12:00:00').getDay();
    if (datum < vandaagStr() || !u.dagen[dag] || u.geblokkeerd.includes(datum)) return { ok: true, datum, duurMin: duur, tijden: [] };
    const open = naarMin(u.van), dicht = naarMin(u.tot);
    const bezet = bezetOp(code, datum);
    const stap = Math.max(30, Math.min(duur, 120));
    const nuMin = datum === vandaagStr() ? (new Date().getHours() * 60 + new Date().getMinutes()) : -1;
    const tijden = [];
    for (let m = open; m + duur <= dicht; m += stap) {
      if (m <= nuMin) continue;
      if (bezet.some(b => m < b.eind && (m + duur) > b.start)) continue;
      tijden.push(naarTijd(m));
    }
    return { ok: true, datum, duurMin: duur, tijden };
  }

  function publiek(b) {
    return {
      ref: b.ref, klant: b.customerCodename || 'Gast',
      dienst: (b.service && b.service.name) || 'Dienst',
      soort: (b.service && b.service.soort) || 'dienst',
      duurMin: (b.service && b.service.duurMin) || null,
      prijs: b.price || 0, wanneer: b.wanneer || null,
      datum: datumVan(b), tijd: tijdVan(b),
      status: b.status, paid: !!b.paid,
      betaalMoment: b.betaalMoment || null,
      note: b.note || null
    };
  }

  /* Het bord: alles wat een dienstverlener op een dag wil zien, in een
     oogopslag. Onbetaalde vooraf-aanvragen (wacht-op-betaling) tellen nog
     niet als werk; die laten we buiten de werklijsten. */
  function bord(code) {
    const s = findSupplier(code);
    const g = genreVan(s);
    if (!g) return { status: 403, error: 'Dit dashboard is voor dienstverlenende zaken.' };

    const alle = (boekingenVanZaak(code) || []);
    const echt = alle.filter(b => b.status !== 'wacht-op-betaling'); // betaald of achteraf-aanvraag
    const actief = echt.filter(b => b.status === 'aangevraagd' || b.status === 'bevestigd');
    const vd = vandaagStr();

    const opTijd = arr => arr.slice().sort((a, b) =>
      String(a.wanneer || '9999').localeCompare(String(b.wanneer || '9999')));

    const vandaag = opTijd(actief.filter(b => datumVan(b) === vd)).map(publiek);
    const binnenkort = opTijd(actief.filter(b => datumVan(b) && datumVan(b) > vd)).slice(0, 25).map(publiek);
    const zonderDatum = actief.filter(b => !datumVan(b)).map(publiek);
    const teBevestigen = opTijd(echt.filter(b => b.status === 'aangevraagd')).map(publiek);

    // het aanbod met, per dienst, hoe vaak het al geboekt is en de omzet
    const perDienst = {};
    for (const b of echt) {
      const id = b.service && b.service.id; if (!id) continue;
      const p = perDienst[id] || (perDienst[id] = { boekingen: 0, omzet: 0 });
      p.boekingen++; if (b.paid) p.omzet = rond(p.omzet + (b.price || 0));
    }
    const aanbod = (s.services || []).map(x => ({
      id: x.id, name: x.name, desc: x.desc || null, price: x.price || 0,
      duurMin: x.duurMin || null, soort: x.soort || 'dienst',
      boekingen: (perDienst[x.id] || {}).boekingen || 0,
      omzet: (perDienst[x.id] || {}).omzet || 0
    }));

    // KPI's: omzet vandaag/week/maand op betaalde boekingen, plus bezetting
    const week = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
    const maand = vd.slice(0, 7);
    let omzetVandaag = 0, omzetWeek = 0, omzetMaand = 0, betaaldMaand = 0;
    for (const b of echt) {
      if (!b.paid) continue;
      const dag = geldDag(b);
      if (dag === vd) omzetVandaag = rond(omzetVandaag + (b.price || 0));
      if (dag >= week) omzetWeek = rond(omzetWeek + (b.price || 0));
      if (dag.slice(0, 7) === maand) { omzetMaand = rond(omzetMaand + (b.price || 0)); betaaldMaand++; }
    }
    const bezetMinVandaag = actief.filter(b => datumVan(b) === vd && b.status === 'bevestigd')
      .reduce((n, b) => n + ((b.service && b.service.duurMin) || 0), 0);

    return {
      ok: true, genre: s.type, label: g.label, werk: g.werk, werkMv: g.werkMv,
      vandaag, binnenkort, zonderDatum, teBevestigen, aanbod,
      kpi: {
        omzetVandaag, omzetWeek, omzetMaand,
        gemBon: betaaldMaand ? rond(omzetMaand / betaaldMaand) : 0,
        openAanvragen: teBevestigen.length,
        afsprakenVandaag: vandaag.length,
        bezetUurVandaag: rond(bezetMinVandaag / 60)
      }
    };
  }

  /* De regelgebaseerde adviezen: werkt altijd, ook zonder AI-sleutel. */
  function regelAdvies(b, g) {
    const a = [];
    if (b.teBevestigen.length) a.push(b.teBevestigen.length + ' ' + (b.teBevestigen.length === 1 ? 'aanvraag wacht' : 'aanvragen wachten') + ' op je bevestiging; bevestig ze zodat het lid zekerheid heeft.');
    if (b.vandaag.length) a.push('Vandaag staan er ' + b.vandaag.length + ' ' + g.werkMv + (b.vandaag[0].tijd ? ', de eerste om ' + b.vandaag[0].tijd : '') + '.');
    if (b.zonderDatum.length) a.push(b.zonderDatum.length + ' ' + (b.zonderDatum.length === 1 ? 'boeking heeft' : 'boekingen hebben') + ' nog geen datum; plan een moment met het lid.');
    if (!b.aanbod.length) a.push('Je aanbod is nog leeg. Zet je eerste ' + (g.werk === 'behandeling' ? 'behandeling' : 'dienst') + ' in de app zodat leden kunnen boeken.');
    else {
      const stil = b.aanbod.filter(x => !x.boekingen);
      if (stil.length) a.push(stil.length + ' van je ' + b.aanbod.length + ' aanbod-items zijn nog nooit geboekt; overweeg de omschrijving of prijs aan te scherpen.');
    }
    if (b.kpi.omzetWeek > 0) a.push('Omzet deze week: € ' + b.kpi.omzetWeek.toFixed(2) + ' (deze maand € ' + b.kpi.omzetMaand.toFixed(2) + ').');
    if (!a.length) a.push('Rustig beeld: geen open aanvragen en niets vandaag. Goed moment om je aanbod of de Salon-pagina bij te werken.');
    return a;
  }

  async function adviseur(code, vraag) {
    const b = bord(code);
    if (b.error) return b;
    const g = VAK_GENRES[b.genre];
    const regels = regelAdvies(b, g);
    const v = String(vraag || '').replace(/[<>]/g, '').trim().slice(0, 400);
    if (anthropic) {
      try {
        const situatie = 'Genre: ' + g.label + '. Vandaag ' + b.vandaag.length + ' ' + g.werkMv +
          ', ' + b.teBevestigen.length + ' open aanvragen, ' + b.zonderDatum.length + ' zonder datum. ' +
          'Aanbod: ' + (b.aanbod.map(x => x.name + ' (€' + x.price + (x.duurMin ? ', ' + x.duurMin + 'min' : '') + ', ' + x.boekingen + 'x)').join('; ') || 'nog leeg') + '. ' +
          'Omzet week €' + b.kpi.omzetWeek.toFixed(0) + ', maand €' + b.kpi.omzetMaand.toFixed(0) + ', gemiddelde bon €' + b.kpi.gemBon.toFixed(0) + '. ' +
          'Overzicht van de adviezen: ' + regels.join(' | ');
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 450,
          system: require('./rahul').RAHUL_LEAD + g.persona +
            ' Antwoord kort en concreet in het Nederlands. Werk alleen met de gegevens die je krijgt, verzin geen boekingen of omzet. Klanten staan op codenaam; noem nooit een echte naam. Situatie: ' + situatie,
          messages: [{ role: 'user', content: v || 'Waar moet ik me vandaag op richten?' }]
        });
        const t = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (t) return { ok: true, antwoord: t, voorstellen: regels };
      } catch (e) { /* val terug op de regels */ }
    }
    return { ok: true, antwoord: regels.join(' '), voorstellen: regels };
  }

  return { vakwerk: { GENRES: VAK_GENRES, isVak, bord, adviseur, uren, urenZet, slots } };
}

module.exports = { maakVakwerk, VAK_GENRES };
