/* School (deelmodule): binnenkomen -- de vervanger en de nieuwe docent.

   Twee mensen die hetzelfde probleem hebben: ze staan hier voor het eerst en
   moeten binnen een paar minuten iets kunnen. Een schoolsysteem geeft ze
   normaal alles, en dat is hetzelfde als niets.

   SUBSTITUTE TEACHER MODE. Docent ziek om 07:42. De vervanger opent een scherm
   en krijgt de klas, wat er vandaag aan de orde is, het materiaal erbij, en wat
   eerdere lessen over die stof hebben opgeschreven -- juist hij heeft daar iets
   aan, want hij kent de klas niet. En verder niets.

   Dat "verder niets" is grens 4 uit SCHOOL.md, de Child Context Firewall: een
   vervanger ziet geen zorgdossier, geen incidenten en geen gezinssituatie. Wat
   hij wel ziet zijn de NAMEN van de kinderen, want zonder naam kan hij niemand
   aanspreken en geen presentie aftekenen. Minimale context voor de taak, en de
   briefing zegt zelf met zoveel woorden wat er niet in staat -- anders denkt
   een vervanger dat hij alles ziet en gaat hij ervan uit dat er niets speelt.

   NEW TEACHER AUTOPILOT. Een nieuwe docent krijgt VIJF dingen, niet
   vijfhonderd. Ze worden afgeleid uit wat er werkelijk is: heb je een klas,
   staat er vandaag iets open, ken je de huisregels die hier anders zijn. Wat af
   is valt weg; er komt niets bij tot je eraan toe bent.

   Ook hier wordt niets bewaard. Er is geen voortgangsbalk en geen "3 van de 5
   voltooid": dat zou een prestatiemeter op een mens zijn, en dat is precies wat
   grens 8 verbiedt. De lijst wordt telkens uitgerekend uit de stand van zaken. */
/* De tijd komt uit de tijdmachine en niet van het besturingssysteem: anders
   is dit bestand niet te beproeven op schrikkeldag, zomertijd of een verlopen
   termijn. Zie server/lib/klok.js. */
const { datum } = require('../lib/klok');
const { DOELEN } = require('../kern/leerstof');

const MAX_DOELEN = 6;

/* De drie dingen die hier anders zijn dan op de meeste scholen, en die een
   nieuwe docent op dag een moet weten omdat ze zijn werk veranderen. */
const HUISREGELS = [
  'Leren is geen wedstrijd: er zijn hier geen ranglijsten en geen scores buiten een oefensessie.',
  'Een rapport is pas een rapport als een mens het heeft vastgesteld; een concept gaat nergens heen.',
  'De hulplijn is van het kind zelf. U pakt hem op, maar u opent hem niet namens een kind.'
];

/* De stappen zijn AFGELEID uit de stand van zaken en worden niet opgeslagen:
   geen voortgangsbalk, geen "3 van de 5 voltooid". Dat zou een prestatiemeter
   op een mens zijn, en dat is precies wat grens 8 verbiedt.

   Waarom dit een pure functie is en geen stuk route: de belofte is "vijf
   dingen, niet vijfhonderd", en die is alleen te toetsen als je alle standen
   langs kunt lopen. Er is bewust GEEN afkapgrens bij vijf -- zo'n grens zou
   verbergen dat er een zesde bijkwam. De lijst is kort omdat er maar vijf
   dingen tegelijk waar kunnen zijn, en de toets rekent dat na. */
function stappenVan(stand) {
  const geenKlas = !stand.klassen;
  return [
    !stand.actief && { wat: 'Wacht op goedkeuring', waarom: 'De directie moet uw aanmelding nog aftekenen. Zolang dat niet is gebeurd, kunt u nog niets openen.' },
    geenKlas && { wat: 'U staat nog niet op een klas', waarom: 'Vraag de directie om u aan een klas te koppelen; daarna staat hier wat er te doen is.' },
    stand.hulp && { wat: 'De hulplijn staat open', waarom: 'Een kind heeft om hulp gevraagd. Dit gaat voor op alles wat hieronder staat.', waarheen: 'hulplijn' },
    (stand.zonderPresentie || []).length && { wat: 'Teken de presentie van vandaag af', waarom: 'Voor ' + (stand.zonderPresentie || []).join(', ') + ' staat vandaag nog geen lijst.', waarheen: 'presentie' },
    !geenKlas && { wat: 'Kijk wat de vorige lessen opschreven', waarom: 'Bij elk leerdoel staat wat eerder werkte en waar het vastliep. Dat scheelt u de eerste weken het meest.', waarheen: 'lesgeheugen' },
    { wat: 'Drie dingen die hier anders zijn', waarom: HUISREGELS.join(' ') }
  ].filter(Boolean);
}

module.exports = (sctx) => {
  const { router, S, eigenVeld, K, klasVan, personeelVan, presentieLijst } = sctx;
  const dag = () => datum().toISOString().slice(0, 10);
  const lessenVan = (sch) => (Array.isArray(sch && sch.lessen) ? sch.lessen : []);

  /* ---------- de vervanger: alles wat hij nodig heeft, en niets meer ---------- */
  router.post('/school/vervanging/briefing', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const sch = k.schoolCode ? eigenVeld(S(), k.schoolCode) : null;
    const vandaag = dag();
    const doelen = [...new Set([].concat(
      (k.huiswerk || []).filter(h => h.doel && (h.deadline === vandaag || h.deadline > vandaag)).map(h => h.doel),
      ...(k.toetsen || []).filter(t => t.status === 'open').map(t => t.doelen || [])
    ))].filter(id => DOELEN[id]).slice(0, MAX_DOELEN);

    /* Het materiaal: de les in gewone taal plus de andere manieren om hetzelfde
       uit te leggen. Een vervanger die de stof niet geeft, heeft juist aan die
       tweede uitleg wat. */
    const materiaal = doelen.map(id => ({ doel: id, naam: DOELEN[id].naam, vak: DOELEN[id].vak,
      les: DOELEN[id].les, uitleg: (DOELEN[id].uitleg || []).slice(0, 2).map(u => ({ soort: u.soort, tekst: u.tekst })) }));

    // wat eerdere lessen over deze stof opschreven: Teaching Memory, juist hier
    const eerder = lessenVan(sch).filter(x => (x.werkte || x.liepVast) && (x.doelen || []).some(d => doelen.includes(d)))
      .slice(0, 3).map(x => ({ datum: x.datum, klas: x.klas, door: x.door, werkte: x.werkte, liepVast: x.liepVast }));

    const gezet = (presentieLijst && sch ? presentieLijst(sch) : [])
      .some(p => p.klasCode === k.code && p.datum === vandaag);

    res.json({ ok: true,
      klas: { code: k.code, naam: k.naam, fase: k.fase || null, leerlingen: (k.leerlingen || []).length },
      // namen: zonder naam kun je niemand aanspreken en geen presentie aftekenen
      namen: (k.leerlingen || []).map(l => l.naam).slice(0, 200),
      vandaag: { presentieGezet: gezet, onlineLes: (k.onlineLes && k.onlineLes.aan) ? k.onlineLes.kamercode : null },
      materiaal, eerder,
      waarnemer: k.waarnemer ? { naam: k.waarnemer.naam, tot: k.waarnemer.tot || null } : null,
      /* Zeg zelf wat er NIET in staat. Een vervanger die denkt dat hij alles
         ziet, gaat ervan uit dat er niets speelt -- en dat is precies het
         moment waarop een kind tussen wal en schip valt. */
      nietHierin: ['het zorgdossier', 'incidenten', 'de gezinssituatie', 'het leerlingdossier'],
      uitleg: 'Dit is de klas, wat er vandaag aan de orde is en het materiaal erbij. Wat hierboven onder "niet hierin" staat, ziet u bewust niet; is het nodig, vraag het aan de directie en dan wordt het vastgelegd.' });
  });

  /* ---------- de nieuwe docent: vijf dingen, niet vijfhonderd ---------- */
  router.post('/school/personeel/start', (req, res) => {
    const auth = personeelVan(req, res); if (!auth) return;
    const { sch, p } = auth;
    const mijn = Object.values(K()).filter(k => k.schoolCode === sch.code &&
      (k.leraarId === p.id || (k.leraren || []).some(x => x.id === p.id) || (k.waarnemer && k.waarnemer.id === p.id)));
    const vandaag = dag();
    const zonderPresentie = mijn.filter(k => (k.leerlingen || []).length &&
      !(presentieLijst && sch ? presentieLijst(sch) : []).some(x => x.klasCode === k.code && x.datum === vandaag));
    const hulp = mijn.reduce((n, k) => n + (k.hulplijn || []).filter(m => m.status === 'open').length, 0);

    const stappen = stappenVan({ actief: p.status === 'actief', klassen: mijn.length,
      zonderPresentie: zonderPresentie.map(k => k.naam), hulp });

    res.json({ ok: true, naam: p.naam, school: sch.naam, klassen: mijn.map(k => ({ code: k.code, naam: k.naam })),
      stappen, huisregels: HUISREGELS,
      uitleg: 'Hoogstens vijf dingen, afgeleid uit hoe het er nu voor staat. Wat af is valt weg; de rest komt als u eraan toe bent. Er wordt niet bijgehouden hoe ver u bent.' });
  });
};
module.exports.HUISREGELS = HUISREGELS;
module.exports.stappenVan = stappenVan;
