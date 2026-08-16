/* Server-authoritatieve bedrijfstraining uit een goedgekeurde digitale
   tweeling. De browser krijgt nooit het juiste antwoord vooraf en iedere
   sessie schrijft uitsluitend naar Magnaat-spelstaat. */
'use strict';

module.exports = ({ basis: B }) => {
  function fout(error, status = 400) { return { error, status }; }
  function stapPubliek(stap, index, totaal) {
    return stap ? { nummer: index + 1, totaal, fase: stap.fase, vraag: stap.vraag, opties: stap.opties.slice() } : null;
  }
  function maakStappen(snapshot) {
    const proces = snapshot.werkprocessen[0], afdeling = snapshot.afdelingen.find(x => x.id === proces.afdelingId) || snapshot.afdelingen[0];
    const rol = snapshot.rollen.find(x => x.id === proces.rolId) || snapshot.rollen[0], aanbod = snapshot.aanbod[0], locatie = snapshot.locaties[0];
    return [
      { fase: 'Intake', vraag: 'U start "' + proces.naam + '" voor ' + aanbod.naam + '. Wat doet u eerst?',
        opties: ['Meteen uitvoeren zodat het dossier snel verdwijnt', 'Doel, bevoegdheid en actuele status in het synthetische dossier controleren', 'Een echte klant of betaling opzoeken'], juist: 1,
        goed: 'Sterk. Eerst context en bevoegdheid, daarna pas uitvoering.', fout: 'Snelheid zonder context maakt een proces niet veilig of controleerbaar.' },
      { fase: 'Operatie', vraag: 'Tijdens stap "' + proces.stappen[Math.min(1, proces.stappen.length - 1)] + '" ontstaat capaciteitsdruk op ' + locatie.naam + '. Wat is de beste reactie?',
        opties: ['Impact vastleggen, risico stabiliseren en een eigenaar aanwijzen', 'De waarschuwing verwijderen om de score groen te houden', 'De productiewerkplek openen en daar direct ingrijpen'], juist: 0,
        goed: 'Juist. U maakt het risico zichtbaar en houdt de echte operatie buiten bereik.', fout: 'De trainingsomgeving mag nooit uitwijken naar productie of bewijs verbergen.' },
      { fase: 'Besluit', vraag: 'Een uitzondering vraagt goedkeuring binnen ' + afdeling.naam + '. Wie beslist?',
        opties: ['De speler met de hoogste ranglijstscore', rol.naam + ' binnen de vastgelegde rechten en met een auditreden', 'Magnaat automatisch, zonder menselijke tussenkomst'], juist: 1,
        goed: 'Juist. De bedrijfsrol en auditreden sturen het besluit.', fout: 'Ranglijsten en automatisering vervangen geen echte bevoegdheidsgrens.' },
      { fase: 'Afronding', vraag: 'Wanneer is dit trainingsdossier aantoonbaar klaar?',
        opties: ['Zodra de laatste knop is aangeklikt', 'Als de omzetindex stijgt', 'Na resultaat, bewijs, eigenaar en volgend controlemoment in het synthetische dossier'], juist: 2,
        goed: 'Volledig. Zo wordt de oefening overdraagbaar en toetsbaar.', fout: 'Een klik of score bewijst niet dat het bedrijfsproces beheerst is afgerond.' }
    ];
  }
  function publiek(training) {
    if (!training) return null;
    return { id: training.id, bedrijf: B.kopie(training.bedrijf), modus: training.modus, status: training.status,
      score: training.score, maximum: 100, stap: stapPubliek(training.stappen[training.index], training.index, training.stappen.length),
      feedback: training.feedback || '', antwoorden: training.antwoorden.map(x => ({ nummer: x.nummer, goed: x.goed })) };
  }
  function start(sleutelIn, snapshot, modus) {
    if (!snapshot || !snapshot.werkprocessen.length || !snapshot.rollen.length || !snapshot.afdelingen.length || !snapshot.aanbod.length || !snapshot.locaties.length)
      return fout('Deze bedrijfstweeling heeft nog geen volledige trainingsroute.', 409);
    const sleutel = B.tekst(sleutelIn, 180), kast = B.staat().trainingen;
    const bestaand = kast[sleutel];
    if (bestaand && bestaand.status === 'bezig' && bestaand.bedrijf.code === snapshot.code) return { ok: true, training: publiek(bestaand), hervat: true };
    const training = {
      id: B.id('training'), sleutel, modus, bedrijf: { code: snapshot.code, naam: snapshot.naam, type: snapshot.type, stad: snapshot.stad },
      status: 'bezig', index: 0, score: 0, stappen: maakStappen(snapshot), antwoorden: [], feedback: '',
      gestartAt: B.nu(), voltooidAt: null, beloningGeclaimd: false
    };
    kast[sleutel] = training; B.save();
    return { ok: true, training: publiek(training), hervat: false };
  }
  function antwoord(sleutelIn, trainingId, keuzeIn) {
    const sleutel = B.tekst(sleutelIn, 180), training = B.staat().trainingen[sleutel];
    if (!training || training.id !== B.tekst(trainingId, 100)) return fout('Deze training bestaat niet.', 404);
    if (training.status !== 'bezig') return fout('Deze training is al afgerond.', 409);
    const keuze = Number(keuzeIn), stap = training.stappen[training.index];
    if (!Number.isInteger(keuze) || keuze < 0 || keuze >= stap.opties.length) return fout('Kies een van de getoonde acties.');
    const goed = keuze === stap.juist;
    training.antwoorden.push({ nummer: training.index + 1, keuze, goed });
    if (goed) training.score += Math.round(100 / training.stappen.length);
    training.feedback = goed ? stap.goed : stap.fout;
    training.index += 1;
    if (training.index >= training.stappen.length) {
      training.status = 'voltooid'; training.voltooidAt = B.nu(); training.index = training.stappen.length;
    }
    B.save();
    return { ok: true, goed, training: publiek(training) };
  }
  function claim(sleutelIn, trainingId) {
    const training = B.staat().trainingen[B.tekst(sleutelIn, 180)];
    if (!training || training.id !== B.tekst(trainingId, 100) || training.status !== 'voltooid' || training.beloningGeclaimd) return { nieuw: false };
    training.beloningGeclaimd = true; B.save();
    return { nieuw: true, score: training.score, bedrijf: training.bedrijf };
  }
  function proefStart(supplier, actor, model) {
    const t = B.tweeling(supplier), basisGereed = t.locaties.length && t.afdelingen.length && t.rollen.length && t.aanbod.length && t.werkprocessen.some(x => x.stappen.length >= 3);
    if (!basisGereed) return fout('Bouw eerst een locatie, afdeling, rol, aanbod en volledig werkproces.', 409);
    const r = start('partner:' + t.code, B.momentopname(t), 'partnerproef');
    if (!r.error) r.studio = model.overzicht(supplier);
    return r;
  }
  function proefAntwoord(supplier, actor, trainingId, keuze, model) {
    const t = B.tweeling(supplier), r = antwoord('partner:' + t.code, trainingId, keuze);
    if (r.error) return r;
    if (r.training.status === 'voltooid') {
      t.laatsteProef = { id: r.training.id, score: r.training.score, door: B.actorNaam(actor), at: B.nu() };
      B.wijzig(t, actor, 'proef-voltooid', 'Veilige bedrijfssimulatie afgerond met ' + r.training.score + '%.');
    }
    r.studio = model.overzicht(supplier);
    return r;
  }

  return { start, antwoord, claim, proefStart, proefAntwoord, publiek };
};
