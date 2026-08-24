/* DE BRONNEN VAN HET FUNDAMENT -- de vijf lezers die iets zeggen over de
   voorwaarden waarop alles rust: bereikbaarheid, de servicedoelen, de
   gegevens, de sporen en het bewaren.

   Ze staan apart van ./gezondheid-bronnen.js omdat ze een andere vraag
   beantwoorden. Die lezers kijken naar het VERKEER van een dienst (hoeveel
   verzoeken, hoeveel fouten, welke schakelaars); deze vijf kijken naar dingen
   die geen verkeer hebben. Een back-up krijgt geen verzoeken en een hashketen
   ook niet -- maar ze kunnen wel stuk zijn, en dan doet de rest er niet toe.

   Elke lezer geeft dezelfde bevinding terug als de andere kant: graad, oordeel,
   at, zin en zegtNiet. Wat er in `zegtNiet` staat, staat er per bron anders --
   en dat is de hele reden dat het veld bestaat. */
'use strict';

const nuIso = () => new Date().toISOString();

/* DE SONDE. Buiten en binnen worden nooit opgeteld, en alleen buiten telt als
   BEWEZEN: een ronde vanaf de machine zelf bewijst dat de HTTP-laag antwoordt
   en niet dat een klant erbij kan. */
function vanSonde(snap, D, stil) {
  if (!snap.sonde.ok) return stil('sonde', snap.sonde.waarom);
  const st = snap.sonde.waarde;
  const b = st.buiten || {}, i = st.binnen || {};
  if (!b.pogingen && !i.pogingen) {
    return { bron: 'sonde', graad: 'onbekend', oordeel: null, at: nuIso(),
      zin: 'er is in dit venster niets aangeklopt, van binnen noch van buiten',
      zegtNiet: 'Geen meting is geen groen licht.' };
  }
  if (b.pogingen) {
    const deel = b.mislukt / b.pogingen;
    return { bron: 'sonde', graad: 'bewezen', at: st.tot || nuIso(),
      oordeel: deel >= D.sondeDeelStoring ? 'storing' : b.mislukt ? 'let op' : 'in orde',
      getallen: { pogingen: b.pogingen, mislukt: b.mislukt, traag: b.traag, p90Ms: b.p90Ms, kant: 'buiten' },
      zin: b.pogingen + ' metingen van buitenaf, ' + b.mislukt + ' mislukt',
      zegtNiet: 'De sonde loopt een handvol reizen. Dat een reis lukt, zegt niets over de reizen die er niet in zitten.' };
  }
  return { bron: 'sonde', graad: 'gemeten', at: st.tot || nuIso(),
    oordeel: i.mislukt ? 'let op' : 'in orde',
    getallen: { pogingen: i.pogingen, mislukt: i.mislukt, traag: i.traag, p90Ms: i.p90Ms, kant: 'binnen' },
    zin: i.pogingen + ' metingen vanaf de machine zelf, ' + i.mislukt + ' mislukt',
    zegtNiet: 'Deze ronde liep op de server zelf. Hij bewijst dat de HTTP-laag antwoordt, niet dat TLS, ' +
      'DNS, de proxy en het netwerk ertussen het doen.' };
}

function vanSlo(snap, D, stil) {
  if (!snap.slo.ok) return stil('slo', snap.slo.waarom);
  const st = snap.slo.waarde;
  const genoeg = st.doelen.filter(d => d.genoeg);
  if (!genoeg.length) {
    return { bron: 'slo', graad: 'onbekend', oordeel: null, at: nuIso(), getallen: st.tel,
      zin: 'geen enkel servicedoel is voldoende gemeten in dit venster',
      zegtNiet: 'Een doel dat te weinig is gemeten rekent zichzelf op 100%, en dat is geen uitslag.' };
  }
  const gezakt = genoeg.filter(d => d.oordeel === 'niet gehaald');
  const krap = genoeg.filter(d => d.budget && !d.budget.op && d.budget.restDeel < D.budgetKrap);
  return { bron: 'slo', graad: 'gemeten', at: nuIso(),
    oordeel: gezakt.length ? 'storing' : krap.length ? 'let op' : 'in orde',
    getallen: st.tel,
    zin: genoeg.length + ' doelen gemeten, ' + gezakt.length + ' niet gehaald' +
      (krap.length ? ', ' + krap.length + ' met een krap foutbudget' : ''),
    zegtNiet: 'De servicedoelen meten het hele platform en niet een klant of een dienst apart.' };
}

function vanKwaliteit(snap, D, stil) {
  if (!snap.kwaliteit.ok) return stil('kwaliteit', snap.kwaliteit.waarom);
  const k = snap.kwaliteit.waarde;
  const n = k.tel.defecten;
  return { bron: 'kwaliteit', graad: 'gemeten', at: nuIso(),
    oordeel: n >= D.defectenStoring ? 'storing' : n >= D.defectenLet ? 'let op' : 'in orde',
    getallen: { defecten: n, soorten: k.tel.soorten, vermoedens: k.tel.vermoedens,
      objecten: k.gemeten.objecten, onvolledig: !!k.gemeten.onvolledig },
    zin: n + ' harde defecten over ' + k.gemeten.objecten + ' objecten' +
      (k.tel.vermoedens ? ' (plus ' + k.tel.vermoedens + ' vermoedens, niet meegeteld)' : ''),
    zegtNiet: 'Dit meet of gegevens aan elkaar hangen, niet of ze KLOPPEN. Een verwijzing die netjes ' +
      'aankomt bij het verkeerde object staat hier als gezond.' };
}

function vanJournaal(snap, D, stil) {
  if (!snap.journaal.ok) return stil('journaal', snap.journaal.waarom);
  const c = snap.journaal.waarde;
  return { bron: 'journaal', graad: 'gemeten', at: nuIso(),
    oordeel: c.heel ? 'in orde' : 'storing',
    getallen: { heel: !!c.heel, regels: c.regels || null, bij: c.bij || null },
    zin: c.heel ? 'de hashketen is heel over ' + c.regels + ' regels'
      : 'de keten breekt bij ' + c.bij + ': ' + c.waarom,
    zegtNiet: 'Het journaal ziet alleen wat via RTG Command is gegaan. De gewone app-routes en de ' +
      'leverancierskant lopen er niet doorheen, dus stilte is hier geen bewijs.' };
}

/* DE BACK-UP. Deze bron komt NOOIT op `bewezen`, en dat is een besluit en geen
   slordigheid: server/backupstand.js is een aanwezigheidscontrole met tanden en
   geen terugzetproef. Een platformbrede terugzetproef bestaat hier niet
   (kern/tenant/bewijs-sla.js zegt dat met zoveel woorden), en zolang die er niet
   is, hoort er ook geen scherm te staan waarop "bewezen" staat. */
function vanBackup(snap, D, stil) {
  if (!snap.backup.ok) return stil('backup', snap.backup.waarom);
  const b = snap.backup.waarde;
  /* "Er staat niets" is wel degelijk GEMETEN: er is gekeken en er lag niets.
     Dat als `onbekend` melden zou de ernstigste uitslag die dit vermogen kent
     wegpoetsen tot "niet vastgesteld". */
  if (!b.er) {
    return { bron: 'backup', graad: 'gemeten', oordeel: 'storing', at: nuIso(),
      getallen: { er: false }, zin: b.reden,
      zegtNiet: 'Er is niets om verder te controleren.' };
  }
  const mankeert = Array.isArray(b.mankeert) ? b.mankeert : (b.mankeert ? [b.mankeert] : []);
  return { bron: 'backup', graad: 'gemeten', at: b.dag,
    oordeel: (mankeert.length || b.ouderdom >= D.backupDagenStoring) ? 'storing'
      : b.ouderdom >= D.backupDagenLet ? 'let op' : 'in orde',
    getallen: { dag: b.dag, ouderdom: b.ouderdom, bewaard: b.bewaard, mankeert: mankeert.length },
    zin: 'de laatste dagback-up is van ' + b.dag + ' (' + b.ouderdom + ' dagen oud)' +
      (mankeert.length ? ', en er mankeert iets aan: ' + mankeert.slice(0, 3).join('; ') : ''),
    zegtNiet: 'Dit kijkt na of de bestanden er zijn en of db.json opent. Het is GEEN terugzetproef: ' +
      'of de inhoud klopt en of een herstel werkelijk lukt, is nergens gemeten. Daarom kan dit ' +
      'vermogen niet hoger komen dan "gemeten", ook niet na een controleronde.' };
}

module.exports = { vanSonde, vanSlo, vanKwaliteit, vanJournaal, vanBackup };
