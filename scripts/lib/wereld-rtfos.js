/* ============================================================================
   DE RTFOS-WERELD -- een stadsafdeling om alles aan te hangen.

   HET PROBLEEM. Honderdvierenveertig routes onder /api/rtfos/ staan onbewezen,
   en tweeendertig ervan zeggen hetzelfde: "Deze stadsafdeling bestaat niet."
   De stad is de wortel van dit domein -- projecten, activiteiten, hulpvragen,
   vrijwilligers, subsidies, partners, vergaderingen en campagnes hangen er
   allemaal onder.

   WAAROM DE OBJECTOOGST HIER NIET BIJ KON. Die oogst per TAK (twee en drie
   segmenten diep), en dat is met opzet zo: een id uit de kluis van een lid is
   zinloos voor een festival van een zaak. Maar /api/rtfos/stad en
   /api/rtfos/activiteit zijn twee verschillende takken, dus het id van de stad
   kwam nooit bij de activiteit terecht. Dat is geen fout in de oogst maar de
   grens ervan: een WERELD met een gedeelde wortel vraagt een wereld.

   DE WEG, en hij is gemeten en niet aangenomen: /api/rtfos/stad/maak zit
   achter officeAuth, maar de handeling zelf vraagt `w.landelijk`, en dat leest
   `magBoardroom(key)` (kern/rtfos/basis.js, wie()). Een office-sessie is dus
   niet genoeg; de boardroomsleutel wel. Gemeten: 200 met boardroom, 401 met
   een losse office-inlog.

   WAT DIT KLAARZET is een enkel veld: `stad`. Niet `id` -- dat leest elke
   kindroute als het id van het KIND, en dan zou de wereld precies de
   verwarring stichten die zij moet oplossen. De kinderen zelf maakt de
   objectoogst, per tak, zoals altijd. */
'use strict';

async function zetRtfosKlaar({ post, tokens }) {
  const stappen = [];
  const brd = (tokens || {}).boardroom;
  if (!brd) {
    return { klaar: false, extra: {}, stappen,
      reden: 'zonder boardroomsleutel is er geen landelijk bestuur, en alleen dat opent een stadsafdeling' };
  }

  let a = null;
  try { a = await post('/api/rtfos/stad/maak', { naam: 'RTF Proefstad', land: 'Nederland' }, brd); }
  catch (e) { a = null; }
  const ok = a && a.status >= 200 && a.status < 300;
  const stad = ok && a.data && a.data.stad && a.data.stad.id;
  stappen.push({ naam: 'de stadsafdeling openen', pad: '/api/rtfos/stad/maak',
    status: a ? a.status : 0, ok: !!stad,
    waarom: stad ? null : ((a && a.data && a.data.error) || 'geen antwoord') });

  if (!stad) {
    return { klaar: false, extra: {}, stappen,
      reden: 'de stadsafdeling ging niet open; zie stappen' };
  }

  /* De stad ACTIEF zetten. Een verse stad staat op `verkend`, en een deel van
     het domein doet niets in die stand. Lukt het niet, dan is dat geen reden
     om de wereld af te keuren: de wortel bestaat en dat is wat de 32 routes
     vroegen. Het staat wel MET REDEN in de stappen. */
  let st = null;
  try { st = await post('/api/rtfos/stad/status', { id: stad, status: 'actief' }, brd); } catch (e) { st = null; }
  const stOk = st && st.status >= 200 && st.status < 300;
  stappen.push({ naam: 'de stad activeren', pad: '/api/rtfos/stad/status',
    status: st ? st.status : 0, ok: !!stOk,
    waarom: stOk ? null : ((st && st.data && st.data.error) || 'geen antwoord') });

  /* EN EEN ZETEL VOOR DE SESSIE DIE DE ROUTES STRAKS GEBRUIKEN.

     Dit was de tweede muur, en hij werd pas zichtbaar toen de eerste weg was:
     met alleen een stad werd "Deze stadsafdeling bestaat niet" meteen "U heeft
     in RTF Proefstad geen bevoegdheid voor deze handeling". De routes dragen
     rol `office` (officeAuth), en `magRecht` vraagt een ZETEL in die stad --
     of het landelijke bestuur. Het bestuur is de boardroom, en die gebruikt de
     proef niet voor deze routes.

     De weg is de echte: het landelijke bestuur kent een zetel toe. Daarvoor is
     de accountsleutel van de ontvanger nodig, en die vraagt de office-sessie
     op over zichzelf (/api/rtfos/ik geeft `key`). Raden kon hier niet: de
     sleutel is per installatie anders. */
  const off = (tokens || {}).office;
  if (off) {
    let ik = null;
    try { ik = await post('/api/rtfos/ik', {}, off); } catch (e) { ik = null; }
    const key = ik && ik.data && ik.data.key;
    if (!key) {
      stappen.push({ naam: 'de sleutel van de office-sessie opvragen', pad: '/api/rtfos/ik',
        status: ik ? ik.status : 0, ok: false,
        waarom: (ik && ik.data && ik.data.error) || 'geen key in het antwoord' });
    } else {
      let z = null;
      try {
        z = await post('/api/rtfos/zetel',
          { stad, key, naam: 'Proefzetel', rol: 'stadsbestuur' }, brd);
      } catch (e) { z = null; }
      const zOk = z && z.status >= 200 && z.status < 300;
      stappen.push({ naam: 'een zetel toekennen aan de office-sessie', pad: '/api/rtfos/zetel',
        status: z ? z.status : 0, ok: !!zOk,
        waarom: zOk ? null : ((z && z.data && z.data.error) || 'geen antwoord') });
    }
  } else {
    stappen.push({ naam: 'een zetel toekennen aan de office-sessie', pad: '/api/rtfos/zetel',
      status: 0, ok: false,
      waarom: 'er is geen office-sessie; zonder die sleutel is er niemand om een zetel aan te geven' });
  }

  return { klaar: true, extra: { stad }, stappen, reden: null };
}

module.exports = { zetRtfosKlaar };
