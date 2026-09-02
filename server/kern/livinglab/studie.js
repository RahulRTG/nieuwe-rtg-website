/* RTF Living Lab, deel "studie": een onderzoek aanmaken, opzoeken en tonen.
   De cyclus zelf staat in ./cyclus.js, de poorten per stap ook. Hier staat wat
   een studie IS en wie hem mag zien.

   HET ZICHT, want dat is de gevoeligste keuze in dit bestand. Een Living Lab is
   open van aard: bewoners horen te zien waar aan gewerkt wordt. Maar een studie
   met risicoklasse hoog of zeer hoog draagt gegevens over kinderen, schulden of
   mentale gezondheid. Daarom drie ringen, en de buitenste is de standaard:

     publiek   titel, vraagstuk, soort, stap, en (na afronding) de conclusies.
               Geen deelnemers, geen observaties, geen ruwe data. Dit is wat een
               bewoner ziet die nog nergens bij hoort.
     team      het hele dossier, voor wie op de studie staat.
     toezicht  het team-beeld plus het auditspoor, voor de RTF-staf en de
               toezichthouder.

   Bij een GESCHEIDEN studie (klasse hoog en hoger) vervalt de publieke ring tot
   alleen titel, soort en stap: geen vraagstuk en geen conclusies, want juist de
   vraagstelling verraadt dan wie de deelnemers zijn ("bewoners van de
   schuldhulpgroep aan de Kerkstraat"). */
'use strict';

const onderzoeksnummer = require('./onderzoeksnummer');

const kader = require('./kader');

module.exports = (ctx) => {
  const { nu, rid, schoon, S, audit, vindLab, vindStudie, leegDossier, save } = ctx;

  /* De risicoklasse-bodem. Een studie mag altijd HOGER ingeschat worden, nooit
     lager dan wat het onderwerp verdient -- daarom een bodem en geen waarde. */
  function bodemKlasse(tekst, soortNaam) {
    const laag = String(tekst || '').toLowerCase();
    if (kader.GEVOELIG.some(w => laag.includes(w))) return 'hoog';
    const s = kader.soort(soortNaam);
    return s && s.menselijk ? 'midden' : 'laag';
  }

  const isGescheiden = s => { const k = kader.klasse(s.dossier.ethiek.klasse); return !!k && k.gescheiden; };

  /* ---------- de drie ringen ---------- */
  function beeldPubliek(s) {
    const basis = { id: s.id, nummer: s.nummer || null, labId: s.labId, titel: s.titel, soort: s.soort,
      soortNaam: (kader.soort(s.soort) || {}).naam, stap: s.stap, klasse: s.dossier.ethiek.klasse,
      gescheiden: isGescheiden(s), at: s.at };
    if (isGescheiden(s)) return basis;
    return Object.assign(basis, { vraagstuk: s.vraagstuk,
      conclusies: s.stap === 'besluit' || s.stap === 'vervolg'
        ? s.dossier.conclusies.map(c => ({ id: c.id, tekst: c.tekst, graad: c.graad })) : [],
      besluit: s.besluit || null });
  }
  /* Het teambeeld, met een vierde ring erin verstopt: `staf`.

     De KLACHTTEKSTEN gaan alleen naar de RTF-staf en niet naar het team. Een
     klacht kan namelijk over het team zelf gaan -- over hoe de projectleider met
     iemand omging -- en die dan aan datzelfde team tonen, is de klachtprocedure
     omdraaien. Het AANTAL ziet iedereen wel, want dat is de reden dat de studie
     stilstaat en dat mag geen raadsel zijn. */
  function beeldTeam(s, staf) {
    const d = s.dossier;
    return Object.assign(beeldPubliek(s), staf ? {
      klachtenLijst: d.ethiek.klachten.map(k => ({ id: k.id, tekst: k.tekst, van: k.van,
        status: k.status, antwoord: k.antwoord, at: k.at }))
    } : {}, {
      vraagstuk: s.vraagstuk, doel: s.doel, hypothese: d.hypothese, plan: d.plan,
      deelnemers: d.deelnemers.map(p => ({ id: p.id, alias: p.alias, rol: p.rol, toestemming: p.toestemming, at: p.at })),
      ethiek: { klasse: d.ethiek.klasse, vastgesteld: d.ethiek.vastgesteld, privacytoets: d.ethiek.privacytoets,
        review: d.ethiek.review, stopcriteria: d.ethiek.stopcriteria, toestemming: d.ethiek.toestemming,
        klachten: d.ethiek.klachten.length, stilgelegd: d.ethiek.stilgelegd },
      observaties: d.observaties.slice(0, 100), datasets: d.datasets, bronnen: d.bronnen,
      conclusies: d.conclusies, reflectie: d.reflectie, besluit: s.besluit || null,
      uitgangen: d.uitgangen, taken: d.taken, documenten: d.documenten,
      besluitenlog: d.besluitenlog.slice(0, 50), logboek: d.logboek.slice(0, 50),
      reserveringen: d.reserveringen });
  }

  /* Wie is de kijker? `{ key, staf, alias }` -- key is de Foundation-sleutel van
     een ingelogde medewerker, staf betekent RTF/RTG-kantoor, alias is de
     deelnemersalias van een bewoner die met zijn labpas binnenkomt. */
  const opTeam = (s, kijker) => !!kijker && !!kijker.alias && s.dossier.deelnemers.some(p => p.alias === kijker.alias);
  const magTeam = (s, kijker) => !!kijker && (!!kijker.staf || opTeam(s, kijker));

  function beeldVoor(s, kijker) { return magTeam(s, kijker) ? beeldTeam(s, !!(kijker && kijker.staf)) : beeldPubliek(s); }

  function studieMaak(b, wie) {
    b = b || {};
    const lab = vindLab(b.labId);
    if (!lab) return { status: 404, error: 'Kies een bestaand lab.' };
    if (!lab.actief) return { status: 409, error: 'Dit lab is niet actief.' };
    const titel = schoon(b.titel, 120), vraagstuk = schoon(b.vraagstuk, 600), doel = schoon(b.doel, 400);
    if (titel.length < 3) return { status: 400, error: 'Geef het onderzoek een duidelijke titel.' };
    if (vraagstuk.length < 10) return { status: 400, error: 'Wat is het vraagstuk? Beschrijf wat er werkelijk speelt, in een paar zinnen.' };
    const soort = kader.soort(b.soort);
    if (!soort) return { status: 400, error: 'Kies een projectsoort.' };
    if (lab.soorten.length && !lab.soorten.includes(soort.soort))
      return { status: 400, error: 'Dit lab voert geen onderzoek in de soort ' + soort.naam + '.' };
    if (S().studies.length >= 20000) return { status: 400, error: 'Het studieregister zit vol; archiveer eerst afgeronde studies.' };

    /* HET ONDERZOEKSNUMMER (./onderzoeksnummer.js): één naam voor dit onderzoek,
       die ook buiten de software bestaat. Hij wordt HIER gezet, bij het ontstaan,
       en daarna nooit meer -- een nummer dat later wordt toegekend, ontbreekt
       precies op de stukken die het eerst de deur uit gaan. */
    const nummer = onderzoeksnummer.nieuw({ lab, studies: S().studies, at: nu() });
    const s = { id: rid(), nummer, labId: lab.id, titel, soort: soort.soort, vraagstuk, doel,
      stap: 'vraagstuk', dossier: leegDossier(), besluit: null, uit: null, geveegd: null,
      punten: 0, door: schoon(wie, 80) || 'onbekend', at: nu() };
    s.dossier.ethiek.klasse = bodemKlasse(titel + ' ' + vraagstuk + ' ' + doel, soort.soort);
    s.dossier.logboek.unshift({ id: rid(), tekst: 'Onderzoek gestart bij het vraagstuk.', wie: s.door, at: nu() });
    S().studies.unshift(s);
    audit(lab.id, 'studie.maak', wie, s.id, titel);
    save();
    return { ok: true, studie: beeldTeam(s, true) };
  }

  /* Het vraagstuk mag nog scherper worden zolang de studie er nog in staat.
     Daarna niet meer: een vraag die je bijstelt nadat je de uitkomst kent, is de
     oudste manier om jezelf gelijk te geven. */
  function vraagstukZet(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    if (s.stap !== 'vraagstuk')
      return { status: 409, error: 'Het vraagstuk staat vast zodra de hypothese er is; wat er nu verandert hoort in de reflectie.' };
    b = b || {};
    const vraagstuk = schoon(b.vraagstuk, 600);
    if (vraagstuk.length < 10) return { status: 400, error: 'Beschrijf het vraagstuk in een paar zinnen.' };
    s.vraagstuk = vraagstuk;
    if (b.doel != null) s.doel = schoon(b.doel, 400);
    if (b.titel != null && schoon(b.titel, 120).length >= 3) s.titel = schoon(b.titel, 120);
    // de bodem opnieuw bepalen: een bijgesteld vraagstuk kan gevoeliger blijken
    const bodem = bodemKlasse(s.titel + ' ' + s.vraagstuk + ' ' + s.doel, s.soort);
    const nuKl = kader.klasse(s.dossier.ethiek.klasse), bodemKl = kader.klasse(bodem);
    if (bodemKl.rang > nuKl.rang) {
      s.dossier.ethiek.klasse = bodem;
      s.dossier.ethiek.vastgesteld = false;
      s.dossier.logboek.unshift({ id: rid(), tekst: 'Risicoklasse verhoogd naar ' + bodemKl.naam + ' door het bijgestelde vraagstuk.', wie: 'systeem', at: nu() });
    }
    audit(s.labId, 'studie.vraagstuk', wie, s.id, '');
    save();
    return { ok: true, studie: beeldTeam(s, true) };
  }

  function overzicht(labId, kijker) {
    const lab = vindLab(labId); if (!lab) return { status: 404, error: 'Dit lab bestaat niet.' };
    const alle = S().studies.filter(s => s.labId === lab.id);
    const perStap = {};
    for (const c of kader.CYCLUS) perStap[c.stap] = alle.filter(s => s.stap === c.stap).length;
    const perSoort = kader.SOORTEN
      .filter(so => !lab.soorten.length || lab.soorten.includes(so.soort))
      .map(so => ({ soort: so.soort, naam: so.naam, icon: so.icon, aantal: alle.filter(s => s.soort === so.soort).length }));
    return { ok: true, lab: { id: lab.id, stad: lab.stad, naam: lab.naam, toegang: lab.toegang },
      perStap, perSoort, totaal: alle.length,
      studies: alle.slice(0, 200).map(s => beeldVoor(s, kijker)) };
  }

  function studie(id, kijker) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    return { ok: true, studie: beeldVoor(s, kijker), magTeam: magTeam(s, kijker) };
  }

  return { studieMaak, vraagstukZet, overzicht, studie, beeldTeam, beeldPubliek, beeldVoor,
    magTeam, opTeam, isGescheiden, bodemKlasse };
};
