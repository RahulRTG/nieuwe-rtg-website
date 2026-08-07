/* Kern-module "bureau": Het Privékantoor -- de ENE app van de Lifestyle Pass.

   Waarom dit bestaat. De Lifestyle Pass had veertien premium-apps, elk netjes
   op zichzelf: Maison wist van uw huis, Hangar van uw toestel, Entourage van uw
   chauffeur, Reisboek van uw visum. Veertien tegels, veertien dossiers, veertien
   keer zelf de verbanden leggen. Bij zesenveertig euro per maand is dat een
   rijke app-verzameling. Bij twintigduizend is het huiswerk.

   Wat een privékantoor doet is niet meer apps leveren maar de verbanden leggen:
   "wij gaan in augustus zes weken weg" raakt het huis, de staf, de auto's, de
   dieren, de post, de agenda en drie paspoorten, en dat hoort ú niet uit te
   zoeken. Dus is dit één app op één levenscontext, met vier onderdelen die de
   veertien apps aan elkaar knopen:

     ./graaf.js       de Life Graph -- alles wat u heeft, wie het bezit, wie het
                      mag zien en wanneer het aandacht vraagt. Een PROJECTIE op
                      de bestaande dossiers, geen tweede opslag.
     ./termijnen.js   de Control Tower -- alle datums uit al die apps in vier
                      vensters, plus het venster dat nergens bestond:
                      achterstallig.
     ./delegatie.js   hoeveel het kantoor zelf mag, per domein, met een grens in
                      euro's en een dak dat u niet kunt ophogen.
     ./cases.js       een verzoek als dossier, met team, tijdlijn en één plek
                      waar een MENS bevestigt.
     ./nu.js          de Situation Room: één kop, en de regels die hem waarmaken.
     ./kamers.js      de twintig werelden, met eerlijk erbij welke er nog niet
                      zijn.

   De veertien apps blijven bestaan en blijven de plek waar u dingen INVULT. Dit
   kantoor is de plek waar ze samenkomen. Dat is met opzet de goedkoopste vorm:
   geen datamigratie, geen tweede waarheid, en een app die stuk kan zonder de
   rest mee te nemen.

   Gemount vanuit opzet/kernlaag3.js, achter dezelfde pas-poort als de rest van
   de suite (routes/member/bureau.js). */
'use strict';

module.exports = ({ db, save, crypto, anthropic, liveCodename, notify }) => {
  const nu = () => new Date().toISOString();
  const rid = () => crypto.randomBytes(4).toString('hex');
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 200);
  const vandaag = () => new Date().toISOString().slice(0, 10);

  const graafMod = require('./graaf')({ db, vandaag });
  const termijnenMod = require('./termijnen')({ graaf: graafMod.graaf });
  const delegatieMod = require('./delegatie')({ db, save, nu });
  const casesMod = require('./cases')({ db, save, nu, rid, schoon, liveCodename, notify,
    beoordeel: delegatieMod.beoordeel });
  const kamersMod = require('./kamers')({ samenvatting: graafMod.samenvatting });
  const nuMod = require('./nu')({ tower: termijnenMod.tower, cases: casesMod.cases,
    samenvatting: graafMod.samenvatting, graaf: graafMod.graaf });

  /* Rahul in het Privékantoor. Hij is hier de ROUTER, niet de uitvoerder: hij
     leest de situatie, zegt wat hij ziet en noteert wat u wilt. Wat hij niet
     doet -- en dit staat zowel in de systeemprompt als in de code eromheen --
     is iets bevestigen. Een boeking, een tafel, een toegang: die bevestigt een
     mens achter het bureau (cases.js), en Rahul kan die functie niet aanroepen.

     De context die hij meekrijgt is het NU-beeld en de delegatiestand, want dat
     is precies wat het antwoord anders maakt: bij L4 op vervoer mag hij zeggen
     "dat regelen wij", bij L2 hoort hij te zeggen "dat leggen wij u voor". */
  async function bureauAI(key, vraag) {
    const q = schoon(vraag, 500);
    const beeld = nuMod.nuBeeld(key, graafMod.graaf(key));
    const del = delegatieMod.delegatie(key);
    const magZelf = del.domeinen.filter(d => d.niveau >= 3).map(d => d.naam.toLowerCase());
    /* Deze zin gaat naar het lid en niet alleen naar het model, dus hij is
       geschreven en niet met haakjes in elkaar gezet: "1 zaak/zaken lopen" is
       geen u-vorm. */
    const t = beeld.tellingen;
    const stuk = (n, een, veel) => n + ' ' + (n === 1 ? een : veel);
    const delen = [];
    if (t.beslissingen) delen.push(stuk(t.beslissingen, 'beslissing', 'beslissingen') + ' voor u');
    if (t.achterstallig) delen.push(stuk(t.achterstallig, 'punt', 'punten') + ' achterstallig');
    if (t.dezeWeek) delen.push(stuk(t.dezeWeek, 'punt', 'punten') + ' deze week');
    if (t.lopend) delen.push(stuk(t.lopend, 'zaak', 'zaken') + ' in behandeling');
    const samenvatting = beeld.kop + '. ' +
      (delen.length ? delen.join(', ') + '. ' : 'Er staat niets open. ') +
      (magZelf.length ? 'U heeft ons mandaat gegeven voor: ' + magZelf.join(', ') + '.'
        : 'Wij hebben voor geen enkel onderwerp een uitvoerend mandaat; alles gaat langs u.');

    if (anthropic && q) {
      try {
        const res = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 400,
          system: require('../rahul').rahulLeadVoor(key) +
            'U bent het Privékantoor van dit Lifestyle Pass-lid: hun chef de bureau. Spreek het lid consequent aan met "u". ' +
            'Voorkomend, discreet, to the point, geen opsmuk. U bent de ROUTER: u leest de situatie, u zegt wat u ziet en u noteert. ' +
            'U bevestigt NOOIT een boeking, tafel, toegang, levering of prijs -- dat doet een van onze mensen, en u zegt dat er eerlijk bij. ' +
            'U verzint geen partners, bedragen of namen. Waar het lid ons een uitvoerend mandaat gaf mag u zeggen dat wij het oppakken; ' +
            'waar dat mandaat er niet is, zegt u dat u het ter goedkeuring voorlegt. Over gezondheid en nalatenschap adviseert u niet en ' +
            'schakelt u niemand in: daarover beslist het lid zelf. Situatie nu (privé): ' + samenvatting,
          messages: [{ role: 'user', content: q }]
        });
        const tekst = res.content && res.content[0] && res.content[0].text;
        if (tekst) return { status: 200, ok: true, antwoord: tekst, kop: beeld.kop };
      } catch (e) { /* val terug op het vaste antwoord hieronder */ }
    }
    return { status: 200, ok: true, demo: true, kop: beeld.kop,
      antwoord: 'Tot uw dienst. ' + samenvatting +
        ' Zegt u wat u geregeld wilt hebben, dan leg ik er een zaak voor aan en pakt een van onze mensen het persoonlijk op. ' +
        'Bevestigen doe ik pas als het rond is.' };
  }

  /* Het openingsscherm van de app: de kop uit de Situation Room, de tower op
     één regel per venster, de plattegrond en hoeveel er in de graaf staat. Eén
     aanroep, want dit is één scherm -- vier losse aanroepen zouden vier keer
     dezelfde graaf bouwen. */
  function bureauOverzicht(key) {
    /* EEN graaf, vijf lezers. Dit stond hier eerst als vijf losse aanroepen die
       er ieder een bouwden; op een vol dossier (15.000 knopen) kostte dat scherm
       daardoor 134 ms in plaats van 27. De graaf gaat nu als argument mee, en
       niet via een cache -- een cache zou moeten weten wanneer een ANDERE app
       (Maison, Hangar, Cellier) iets heeft geschreven, en die vraag goed
       beantwoorden is moeilijker dan het probleem waard is. Doorgeven kan niet
       verouderen. */
    const g = graafMod.graaf(key);
    const t = termijnenMod.tower(key, g);
    const beeld = nuMod.nuBeeld(key, g, t);
    return {
      status: 200,
      naam: liveCodename ? liveCodename(key) : '',
      kop: beeld.kop, ernst: beeld.ernst, regels: beeld.regels, tellingen: beeld.tellingen,
      vensters: t.vensters.map(v => ({ sleutel: v.sleutel, label: v.label, aantal: v.aantal })),
      achterstallig: t.achterstallig.length,
      kamers: kamersMod.kamers(key, g).kamers,
      graaf: graafMod.samenvatting(key, g)
    };
  }

  return {
    bureauOverzicht, bureauAI,
    bureauNu: nuMod.nuBeeld, bureauKnoop: nuMod.knoopDetail,
    bureauTower: termijnenMod.tower, bureauTermijnen: termijnenMod.termijnenAlle,
    bureauGraaf: graafMod.graafVoor, bureauGraafSamenvatting: graafMod.samenvatting,
    // alleen voor de toets; zie de staart van ./graaf.js
    bureauKnoopFabriek: graafMod.knoop,
    bureauDelegatie: delegatieMod.delegatie, bureauDelegatieZet: delegatieMod.delegatieZet,
    bureauBeoordeel: delegatieMod.beoordeel,
    bureauKamers: kamersMod.kamers,
    bureauCases: casesMod.cases, bureauCaseOpen: casesMod.caseOpen,
    bureauCaseBeslis: casesMod.caseBeslis, bureauCaseIntrek: casesMod.caseIntrek,
    bureauDesk: casesMod.bureauDesk, bureauVoortgang: casesMod.bureauVoortgang,
    BUREAU_KAMERS: kamersMod.BUREAU_KAMERS,
    BUREAU_DOMEINEN: delegatieMod.DELEGATIE_DOMEINEN,
    BUREAU_NIVEAUS: delegatieMod.DELEGATIE_NIVEAUS,
    BUREAU_CASE_SOORTEN: casesMod.CASE_SOORTEN
  };
};
