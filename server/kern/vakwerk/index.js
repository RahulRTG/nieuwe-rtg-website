/* Vakwerk: het slimme dashboard voor de dienstverlenende genres, de
   zelfstandige professional (zzp), de privechef (chef) en wellness & spa
   (wellness). Deze genres draaien op hetzelfde aanbod-/boekingsmodel
   (s.services + db.data.boekingen met de statusketen aangevraagd ->
   bevestigd -> afgerond). Deze module tilt ze naar hetzelfde niveau als de
   horeca- en hoteltorens: een vandaag-bord, de eerstvolgende afspraken, de
   aanvragen die op bevestiging wachten, omzet-KPI's en een genre-bewuste
   AI-assistent.

   Alles op codenaam: een boeking toont de codenaam van het lid, nooit de
   echte naam. Volgt het vaste kern-patroon maakVakwerk(state). Dit is de
   orkestrator: de genres, de gedeelde helpers en het bord wonen hier; de
   beschikbaarheid en tijdvakken in ./agenda, de AI-adviseur in ./advies. */

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

  const geldigeTijd = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || ''));
  const naarMin = t => { const m = String(t).match(/^(\d{2}):(\d{2})$/); return m ? (+m[1]) * 60 + (+m[2]) : null; };
  const naarTijd = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

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

  // de gedeelde ctx voor de deelbestanden
  const ctx = { db, save, anthropic, findSupplier, boekingenVanZaak, scho, vandaagStr, rond,
    datumVan, tijdVan, geldDag, genreVan, isVak, geldigeTijd, naarMin, naarTijd, publiek, bord, VAK_GENRES };
  const api = { GENRES: VAK_GENRES, isVak, bord };
  Object.assign(api, require('./agenda')(ctx), require('./advies')(ctx));
  return { vakwerk: api };
}

module.exports = { maakVakwerk, VAK_GENRES };
