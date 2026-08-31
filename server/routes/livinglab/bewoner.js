/* Living Lab, deel "bewoner": de deuren die zonder kantoorinlog opengaan.

   Een Living Lab dat alleen achter een personeelsinlog bestaat, is geen Living
   Lab. Een bewoner moet een vraag kunnen aandragen, erop kunnen stemmen, zijn
   eigen onderzoek kunnen openen met zijn labpas, een observatie kunnen insturen
   en een klacht kunnen indienen -- zonder account.

   ---------- DE REM ----------

   Twee van deze deuren gaan open op een CODE (de labpas, het labpaspoort), en
   dat is precies de vorm waar routes/rtfkantoor/codedeuren.js een uitgebreide
   les over bevat. Die les is hier overgenomen, want hij geldt woordelijk:

   1. PER BRON (twintig per minuut). Dit stopt het afgrazen. Elke poging wordt
      getoetst aan ALLE labpassen tegelijk (opPas loopt de studies langs), dus de
      kans per poging schaalt mee met het aantal deelnemers -- niet met één code.
      Bewust NIET per ip+code: wie elke poging een andere code gebruikt, zou dan
      voor elke poging een verse bak krijgen, en dat is nou juist de aanvaller
      die je wilde vangen. Een sleutel mag niet meebewegen met wat de aanvaller
      varieert.
   2. PER CODE (zestig per minuut). Die begrenst het omgekeerde: veel bronnen op
      één code. Dat mag hier op de code alleen staan, want wie de labpas kent is
      al binnen -- er valt niemand buiten te sluiten die er wel bij hoort.

   De SCHRIJFdeuren (een thema aandragen, stemmen, een observatie insturen, een
   klacht indienen) hebben geen code maar wel een rem, en die staat strakker:
   dat zijn de deuren waarmee je de INHOUD van het lab kunt vervuilen, en daar
   is een mens met een toetsenbord genoeg voor.

   ---------- WAT ER NIET UIT DE BODY KOMT ----------

   De alias van een deelnemer wordt ALTIJD uit de labpas afgeleid en nooit uit
   het lijf van het verzoek gelezen. Zou hij uit de body komen, dan kan iedereen
   die een alias raadt (ze staan in het teambeeld) observaties op naam van een
   ander insturen en zijn punten opstrijken. De pas bewijst wie je bent; een
   alias in een JSON-veld bewijst niets (regel 8 van de lat). */
'use strict';

const rem = require('../../rem');

module.exports = (kern, hulp) => {
  const { app, livinglab } = kern;
  const { veilig } = hulp;

  const lijf = req => (req.body || {});
  const codeUit = req => String(lijf(req).pas || lijf(req).code || '').trim().toUpperCase();

  // de twee remmen van de code-deuren, met dezelfde maten als de andere
  // code-deuren van dit huis
  const remBron = rem({ windowMs: 60000, limit: 20 });
  const remCode = rem({ windowMs: 60000, limit: 60, key: codeUit });
  // de schrijfdeuren: strakker, want hier komt inhoud binnen
  const remSchrijf = rem({ windowMs: 60000, limit: 10 });
  const remLezen = rem({ windowMs: 60000, limit: 60 });

  /* ---------- de labpas: mijn eigen onderzoek ----------
     Geeft de studie zoals een teamlid hem mag zien, wat er nu moet gebeuren, en
     de eigen stand in het spel. */
  app.post('/api/lab2/mijn', remBron, remCode, (req, res) => veilig(res, () => livinglab.mijn(codeUit(req))));

  /* Een observatie insturen met de labpas. De alias komt uit de pas -- zie de
     kop van dit bestand voor waarom dat niet uit de body mag komen. */
  app.post('/api/lab2/mijn/observatie', remBron, remCode, (req, res) => veilig(res, () => {
    const wie = livinglab.mensen.opPas(codeUit(req));
    if (!wie) return { status: 404, error: 'Deze labpas kennen we niet.' };
    const b = Object.assign({}, lijf(req), { door: wie.alias });
    return livinglab.bewijs.observatieBij(wie.studieId, b, wie.alias);
  }));

  /* ---------- het meetvenster: de vragen die deze studie stelt ----------

     Twee deuren, allebei op de labpas: de vragen ophalen en ze invullen. De
     alias komt ook hier uit de pas en nooit uit het lijf.

     DIT IS MET OPZET GEEN APP UIT DE APP STORE. Een app van derden draait in een
     cel zonder netwerk en kan een meting dus niet terugsturen -- en zou dat ook
     niet mogen: een meting draagt een toestemmingsgrond en hoort bij een studie
     van de stichting (kern/livinglab/instrument.js). */
  app.post('/api/lab2/mijn/venster', remBron, remCode, (req, res) => veilig(res, () => {
    const wie = livinglab.mensen.opPas(codeUit(req));
    if (!wie) return { status: 404, error: 'Deze labpas kennen we niet.' };
    return livinglab.instrument.venster(wie.studieId, wie.alias);
  }));

  app.post('/api/lab2/mijn/meting', remBron, remCode, (req, res) => veilig(res, () => {
    const wie = livinglab.mensen.opPas(codeUit(req));
    if (!wie) return { status: 404, error: 'Deze labpas kennen we niet.' };
    return livinglab.instrument.metingBij(wie.studieId, wie.alias, lijf(req));
  }));

  /* Een reflectie insturen met de labpas: wat er misging, wat onverwacht was, of
     welke eerdere conclusie herzien moet worden. Dit staat open voor bewoners
     omdat het juist het gedrag is dat dit lab wil hebben -- en het is bovendien
     het zwaarst beloonde (zie kern/livinglab/spel.js). */
  app.post('/api/lab2/mijn/reflectie', remBron, remCode, (req, res) => veilig(res, () => {
    const wie = livinglab.mensen.opPas(codeUit(req));
    if (!wie) return { status: 404, error: 'Deze labpas kennen we niet.' };
    return livinglab.bewijs.reflectieBij(wie.studieId, lijf(req), wie.alias);
  }));

  /* Zich terugtrekken uit het onderzoek. Dit is de kant waarop de scheiding uit
     kern/livinglab/mensen.js zich moet bewijzen: het werkt op de pas, dus ook
     bij een gescheiden studie waar niemand weet wie erachter zit. */
  /* EERST KIJKEN, DAN PAS WISSEN. Deze deur rekent voor wat er zou gebeuren en
     verandert niets: wat verdwijnt, wat in een dataset is opgegaan en welke
     conclusies in bewijsgraad zakken. Een deelnemer die dat pas ná het wissen
     hoort, heeft geen keuze gehad maar een mededeling gekregen. */
  app.post('/api/lab2/mijn/terugtrekken/gevolg', remBron, remCode, (req, res) => veilig(res, () => {
    const wie = livinglab.mensen.opPas(codeUit(req));
    if (!wie) return { status: 404, error: 'Deze labpas kennen we niet.' };
    return livinglab.terugtrekken.gevolg(wie.studieId, wie.alias);
  }));

  app.post('/api/lab2/mijn/terugtrekken', remBron, remCode, (req, res) => veilig(res, () => {
    const wie = livinglab.mensen.opPas(codeUit(req));
    if (!wie) return { status: 404, error: 'Deze labpas kennen we niet.' };
    return livinglab.mensen.deelnemerWeg(wie.studieId, { alias: wie.alias }, 'deelnemer zelf');
  }));

  /* ---------- vragen uit de buurt ----------
     Open, want dit is de trechter vóór het onderzoek. Wel met een rem, en de
     stem telt op het THEMA (regel 7: de teller hangt aan het doel). */
  /* ---------- de openbare onderzoekskaarten ----------
     Zonder inlog en zonder labpas: dit is de kant die een gemeente, een
     subsidiegever of een buurtbewoner leest. Er staat alleen wat het lab zelf
     heeft geschreven en wat te tellen is -- geen aliassen, geen waarnemingen. */
  app.post('/api/lab2/bewoner/themas', remLezen, (req, res) => veilig(res, () => livinglab.themas.themas(lijf(req).labId)));
  app.post('/api/lab2/bewoner/thema', remSchrijf, (req, res) => veilig(res, () => livinglab.themas.themaBij(lijf(req))));
  app.post('/api/lab2/bewoner/stem', remSchrijf, (req, res) => veilig(res, () => livinglab.themas.themaStem(lijf(req))));

  /* ---------- het publieke beeld van een lab ----------
     De buitenste ring: waar wordt aan gewerkt, en wat is eruit gekomen. Zonder
     kijker meegegeven ziet deze route dus precies wat een voorbijganger mag zien,
     en bij een gescheiden studie is dat niet meer dan de titel en de stap. */
  app.post('/api/lab2/bewoner/overzicht', remLezen, (req, res) => veilig(res, () => livinglab.studie.overzicht(lijf(req).labId, null)));
  app.post('/api/lab2/bewoner/studie', remLezen, (req, res) => veilig(res, () => livinglab.studie.studie(lijf(req).id, null)));
  app.post('/api/lab2/bewoner/labs', remLezen, (req, res) => veilig(res, () => {
    const r = livinglab.bestuur.labs();
    // alleen de actieve labs, en zonder het bestuurlijke deel (budget, tekenaars,
    // partners): dat gaat een voorbijganger niet aan
    return { ok: true, labs: r.labs.filter(l => l.actief).map(l => ({ id: l.id, stad: l.stad, naam: l.naam, land: l.land, toegang: l.toegang })) };
  }));

  /* ---------- de klachtenprocedure ----------
     Bewust zonder pas te gebruiken: een klacht kan juist gaan over hoe het
     onderzoek met je omging, en dan is "log eerst in" het verkeerde antwoord.
     De klacht blijft zichtbaar tot een tekenbevoegde hem afhandelt (de kern
     laat hem niet wegklikken), en hij blokkeert intussen de deelnemersstap. */
  app.post('/api/lab2/bewoner/klacht', remSchrijf, (req, res) => veilig(res, () => livinglab.ethiek.klacht(lijf(req).id, lijf(req))));

  /* ---------- het labpaspoort ---------- */
  app.post('/api/lab2/bewoner/paspoort', remBron, remCode, (req, res) => veilig(res, () => livinglab.spel.paspoort(codeUit(req))));
  app.post('/api/lab2/bewoner/paspoort-maak', remSchrijf, (req, res) => veilig(res, () => livinglab.spel.paspoortMaak(lijf(req))));

  /* Het kader ook publiek: het bewonersscherm bouwt zijn keuzelijsten uit
     dezelfde tabel als het kantoorscherm, zodat er maar één waarheid is over wat
     de cyclus en de methoden zijn (regel 4). Er staat niets vertrouwelijks in --
     het zijn de spelregels, en die horen juist openbaar te zijn. */
  app.post('/api/lab2/bewoner/kader', remLezen, (req, res) => veilig(res, () => livinglab.kaderVoorScherm()));

  /* De deuren voor wie alleen KIJKT -- de onderzoekskaarten, de buurtvragen met
     hun stand, de leenbare apparatuur -- staan in ./openbaar.js. Ze krijgen
     dezelfde rem mee, want dat is dezelfde vraag: afgrazen tegenhouden zonder
     iemand buiten te sluiten die er wel bij hoort. */
  require('./openbaar')(kern, { veilig, lijf, remLezen, remSchrijf });
};
