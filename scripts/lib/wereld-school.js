/* ============================================================================
   DE SCHOOLWERELD -- vier objecten die tachtig routes ontsluiten.

   HET PROBLEEM. Na de sleutelronde en de objectoogst stonden er nog 87
   schoolroutes op 404, en de server zegt zelf waarom:

      36  "Dit gezin kennen we niet. Klopt de gezinscode?"
      14  "Deze leerling staat niet in de administratie."
       7  "Die klas hoort niet bij deze school."
       7  "Dit personeelslid is niet gevonden."

   Vier dingen dus, en ze hangen aan elkaar: een leerling zit in een KLAS, die
   klas hoort bij een SCHOOL, en de leerling is een profiel uit een GEZIN. Geen
   van de vier valt los te maken -- dat is wat een wereld onderscheidt van een
   sleutel.

   DE KETEN, en alles langs de gewone deuren met de gewone poorten ervoor:

     1. de school bestaat al (scripts/lib/lijfsleutels.js, familie `school`)
     2. het gezin ook (familie `gezin`), met een beheerdersprofiel
     3. een KIND toevoegen aan dat gezin -- een leerling is een gezinsprofiel
        en geen apart soort mens. Met een geboortedatum EN een eigen pincode:
        de eerste omdat de school er een leeftijdspas aan hangt, de tweede
        omdat elk kind zijn eigen slot krijgt. Allebei weigerde de route ze
        eerst, met de reden erbij -- dat is hoe deze wereld is gebouwd: niet
        uit de documentatie maar uit wat de deuren terugzeggen
     4. de directie NODIGT EEN LERAAR UIT; de uitnodiging gaat naar het
        persoonlijke schoolmailadres en nergens anders
     5. die leraar accepteert en krijgt daar zijn personeelssleutel
     6. de leraar maakt een KLAS -- de beheersleutel van de school kan dat
        niet, en dat is geen omissie maar het ontwerp
     7. het gezin sluit het kind aan bij die klas met de klascode

   Pas na stap 7 kent de school dat gezin, en dat is precies wat die 36 routes
   missen.

   TWEE DEUREN DIE IK HEB LATEN LIGGEN. /school/personeel/aanmeld maakt in een
   keer een personeelslid met alleen een schoolcode -- en geeft buiten
   NODE_ENV=test een 410, met zoveel woorden: "Zelf aanmelden met alleen een
   schoolcode is gesloten. Vraag de directie om een persoonlijke uitnodiging."
   Diezelfde vlag aanzetten zou hier vijf stappen schelen en meteen een server
   meten die het product niet is. Dat geldt ook voor /school/school/maak, om
   dezelfde reden (zie de kop van lijfsleutels.js).

   WAT DIT NIET IS. Er wordt niets in de database gezet en geen poort omzeild.
   Elke stap is een route die een echte gebruiker ook aanroept: een ouder die
   een kind toevoegt, een leraar die een klas maakt, een ouder die zijn kind
   aansluit. Zou een van de stappen worden overgeslagen door de sleutel direct
   weg te schrijven, dan meet de proef daarna iets wat het product niet doet.

   WAT DIT WEL DOET DAT OPVALT: het maakt een KIND aan. Dat is bewust en het
   hoort te worden opgemerkt -- LEVEN.md par. 2 zegt dat een kind geen profiel
   is. Hier gaat het om een proefopstelling op een wegwerpserver, en het kind
   heet dan ook Proefkind; er komt geen echt kind in beeld. Maar wie deze
   module ooit naar een andere omgeving tilt, hoort die zin gelezen te hebben. */
'use strict';
const fs = require('fs');
const path = require('path');

/* De uitnodigingslink uit de outbox van de proefopstelling -- dezelfde weg als
   de schoolregistratie in scripts/lib/lijfsleutels.js, en om dezelfde reden:
   de link gaat naar het schoolmailadres en niet naar de aanroeper. Peilt tot de
   mail er echt is in plaats van een aantal milliseconden te gokken. */
async function leesUitnodiging(datamap, msMax) {
  if (!datamap) return null;
  const outbox = path.join(datamap, 'outbox');
  const tot = Date.now() + (msMax || 8000);
  while (Date.now() < tot) {
    let namen = [];
    try { namen = fs.readdirSync(outbox); } catch (e) { namen = []; }
    for (const n of namen) {
      let tekst = '';
      try { tekst = fs.readFileSync(path.join(outbox, n), 'utf8'); } catch (e) { continue; }
      const m = /#uitnodiging=([A-Z0-9]+\.[a-f0-9]{20,})/i.exec(tekst);
      if (m) return m[1];
    }
    await new Promise(r => setTimeout(r, 40));
  }
  return null;
}

/* Stil: een stap die niet lukt hoort de wereld niet om te gooien, maar wel
   gemeld te worden. Zie `stappen` in de uitkomst. */
async function zetSchoolKlaar({ post, sleutels, datamap }) {
  const stappen = [];
  const doe = async (naam, pad, lijf, tok) => {
    let a = null;
    try { a = await post(pad, lijf, tok); } catch (e) { a = { status: 0, data: null }; }
    const ok = a && a.status >= 200 && a.status < 300;
    stappen.push({ naam, pad, status: a ? a.status : 0, ok,
      waarom: ok ? null : ((a && a.data && a.data.error) || 'geen antwoord') });
    return ok ? a.data : null;
  };

  const school = (sleutels || {}).school || {};
  const gezin = (sleutels || {}).gezin || {};
  if (!school.schoolCode || !gezin.code) {
    return { klaar: false, reden: 'de school- of gezinsleutel ontbreekt; zonder die twee valt hier niets te bouwen',
      stappen, extra: {} };
  }

  /* Een kind is een profiel in het gezin -- geen apart soort mens. */
  /* De geboortedatum is verplicht en dat is een grens en geen formaliteit: de
     school hangt er de leeftijdspas aan. Tien jaar terug, dus een leerling. */
  const jaartal = new Date().getFullYear() - 10;
  const kind = await doe('kind in het gezin', '/api/foundation/gezin/profiel/maak',
    { code: gezin.code, token: gezin.token, naam: 'Proefkind', rol: 'kind',
      geboortedatum: jaartal + '-06-15', pin: '4321' }, null);
  const profielId = kind && (kind.profiel ? kind.profiel.id : kind.id);

  /* De directie nodigt uit; de link gaat naar het schoolmailadres. Net als bij
     de schoolregistratie zelf is dat het ontwerp -- wie uitnodigt hoort de
     sleutel niet in handen te krijgen -- en dus leest de bouwer hem uit de
     outbox van de proefopstelling. */
  const email = 'proefleraar@voorbeeld.test';
  await doe('leraar uitnodigen', '/api/foundation/school/personeel/uitnodig',
    { schoolCode: school.schoolCode, beheerToken: school.beheerToken,
      naam: 'Proef Leraar', email, rollen: ['leraar'] }, null);
  const uitnodiging = await leesUitnodiging(datamap);
  let personeelToken = null;
  if (uitnodiging) {
    const acc = await doe('leraar accepteert', '/api/foundation/school/personeel/uitnodiging/accepteer',
      { uitnodiging }, null);
    personeelToken = acc && (acc.personeelToken || (acc.personeel && acc.personeel.token));
  } else {
    stappen.push({ naam: 'leraar accepteert', pad: '-', status: 0, ok: false,
      waarom: 'geen uitnodigingslink in de outbox gevonden' });
  }

  /* EN DE KLAS MAAKT DE LERAAR, niet de beheerder. De eerste versie stuurde de
     beheersleutel mee en kreeg "Onbekende school of verkeerd personeel-token".
     Dat is geen hobbel maar de regel: `if (p.rol !== 'leraar') return 403 --
     alleen een leraar maakt klassen`. */
  const klas = personeelToken ? await doe('klas op de school', '/api/foundation/school/leraar/klas/maak',
    { schoolCode: school.schoolCode, personeelToken, naam: 'Proefklas', niveau: 'po', jaar: 1 }, null) : null;
  const klasCode = klas && (klas.klas ? (klas.klas.code || klas.klas.klasCode) : (klas.code || klas.klasCode));

  /* Pas hier kent de school het gezin: de ouder sluit zijn kind aan. */
  if (klasCode && profielId) {
    await doe('kind aansluiten bij de klas', '/api/foundation/school/koppel',
      { code: gezin.code, token: gezin.token, klasCode, profielId }, null);
  }

  /* DRIE SLEUTELS NAAST ELKAAR, EN DAT KAN OMDAT ZE ANDERS HETEN.

     De schoolpoorten lezen `schoolCode` met `beheerToken` of `personeelToken`
     (server/school/poorten.js); de gezinspoort leest `code` met `token`
     (server/foundation/gezinshulp.js). Geen enkele schoolpoort kijkt naar
     `code` of `token`, en geen enkele gezinspoort naar `schoolCode`. Ze mogen
     dus alle drie in hetzelfde lijf.

     Dat is geen toeval maar de reden dat dit werkt: dezelfde route-tak wordt
     door DRIE soorten mensen gebruikt -- de directie, een leraar en een ouder
     -- en het huis heeft ze uit elkaar gehouden door ze andere veldnamen te
     geven. Een prefix-familie kan dat niet, want die kent maar een sleutel;
     een wereld wel.

     Ik heb hier eerst `gezinscode` meegegeven, en dat was raden: de route
     leest `code`. Zesendertig routes bleven daardoor 404 terwijl de wereld al
     klaarstond. */
  const extra = {};
  if (school.schoolCode) { extra.schoolCode = school.schoolCode; extra.beheerToken = school.beheerToken; }
  if (gezin.code) { extra.code = gezin.code; extra.token = gezin.token; }
  if (klasCode) { extra.klasCode = klasCode; }
  if (personeelToken) { extra.personeelToken = personeelToken; }
  if (profielId) { extra.profielId = profielId; extra.leerlingId = profielId; }

  return { klaar: !!(klasCode && profielId), stappen, extra,
    reden: klasCode && profielId ? null : 'niet elke stap kwam door; zie stappen' };
}

module.exports = { zetSchoolKlaar };
