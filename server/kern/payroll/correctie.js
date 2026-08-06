/* Payroll OS: DE CORRECTIERUN.

   Een definitieve loonrun verandert niet meer. Niet "we passen het even aan":
   een loonstrook die is uitgegeven, een bedrag dat is betaald en een aangifte
   die is verzonden staan tegenover elkaar, en wie de run alsnog bijwerkt laat
   die drie uit elkaar lopen zonder spoor.

   Een correctie is daarom een NIEUWE run die naar de oude wijst. De oude blijft
   staan precies zoals hij was -- dat is het hele punt -- en het VERSCHIL per
   medewerker staat erbij, want dat is wat er nabetaald of ingehouden wordt.

   DE CORRECTIE REKENT OP DE REGELS VAN TOEN. Op de regelversie van de
   oorspronkelijke run, niet die van vandaag. Anders wordt een correctie op juni
   stilzwijgend een herberekening tegen de tarieven van nu, en dat is exact de
   drift die deze hele opzet moet tegenhouden: het bedrag zou dan veranderen om
   een reden die niets met de correctie te maken heeft. Is dat pakket niet meer
   te vinden, dan is er geen correctie mogelijk -- en dat is een eerlijke fout,
   geen reden om dan maar iets anders te pakken.

   Apart van ./run.js omdat die over de 10 KB ging, en omdat dit een eigen
   onderwerp is: de weg naar definitief is iets anders dan wat je daarna nog
   kunt. */
'use strict';

function maakCorrectie({ db, save, nu, crypto, motor, regelpakket, componenten, vind, bak, kort, stempel }) {
  const tijd = nu || (() => new Date().toISOString());
  const id = () => 'run_' + crypto.randomBytes(5).toString('hex');

  function corrigeer({ runId, regels, door, reden }) {
    const oud = vind(runId);
    if (!oud) return { status: 404, error: 'Deze loonrun kennen we niet.' };
    if (oud.stand !== 'definitief') return { status: 409, error: 'Corrigeren kan pas als de oorspronkelijke run definitief is.' };
    if (!reden) return { status: 400, error: 'Noteer waarom deze correctie nodig is.' };
    if (!door) return { status: 400, error: 'Noteer wie de correctie opent.' };

    const pakket = regelpakket.opVersie(oud.land, oud.regelversie);
    if (!pakket) return { status: 409, error: 'Regelpakket ' + oud.regelversie + ' is niet meer te vinden; een correctie zonder de oorspronkelijke regels is geen correctie.' };
    const dag = oud.periode + '-01';
    const comp = Object.fromEntries(componenten.geldigOp(dag).map(c => [c.sleutel, c]));

    const stroken = [];
    for (const r of (regels || [])) {
      const strook = motor.bereken({ contract: r.contract, periode: { van: dag },
        invoer: r.invoer, regelpakket: pakket, componenten: comp });
      if (strook.fout) return { status: 422, error: strook.fout, onbekend: strook.onbekend, staffId: r.staffId };
      const was = (oud.stroken.find(s => s.staffId === r.staffId) || {}).strook;
      stroken.push({ staffId: r.staffId, naam: r.naam, invoer: r.invoer, contract: r.contract, strook,
        verschilNettoCenten: strook.nettoCenten - (was ? was.nettoCenten : 0),
        waarschuwingen: motor.controleer(strook, { regelpakket: pakket,
          leeftijdsgroep: r.leeftijdsgroep, gewerkteUren: r.gewerkteUren || 0 }) });
    }

    const run = {
      id: id(), code: oud.code, zaak: oud.zaak, periode: oud.periode, land: oud.land,
      regelversie: pakket.versie, regelstand: pakket.stand,
      stand: 'concept', stroken, correctieVan: oud.id, reden,
      totaalNettoCenten: stroken.reduce((s, x) => s + x.strook.nettoCenten, 0),
      totaalVerschilCenten: stroken.reduce((s, x) => s + x.verschilNettoCenten, 0),
      totaalKostenCenten: stroken.reduce((s, x) => s + x.strook.kostenWerkgeverCenten, 0),
      goedkeuringen: [], stappen: [], geopendDoor: door, at: tijd()
    };
    stempel(run, 'correctie geopend', door, { van: oud.id, reden, regelversie: pakket.versie });
    bak().unshift(run);
    save();
    return { ok: true, run: kort(run) };
  }

  return { corrigeer };
}

module.exports = { maakCorrectie };
