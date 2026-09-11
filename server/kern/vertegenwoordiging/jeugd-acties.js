/* ============================================================================
   HET JEUGDBESTUUR, deel "daden": de drie partijen en de tweede handtekening.

   Afgesplitst van ./jeugd.js op de 10 kB-grens (keuringsregel 13). Daar staat
   wat WAAR is -- is deze jongere bewezen minderjarig, wie is zijn voogd, mag er
   namens hem gehandeld worden. Hier staat wat er GEBEURT. Twee onderwerpen,
   twee bestanden; dezelfde knip als ./acties.js tegenover ./handelen.js.

   De regels waar deze daden aan gehoorzamen staan in de kop van ./jeugd.js en
   worden hier niet herhaald.
   ========================================================================== */
'use strict';

module.exports = (h) => {
  const { dossier, dossierKijk, vastleggen, nu, naam, scho, keyVanCodenaam, volw, spoor,
    jeugdstand, voogdVan, jeugdbeeld, zoekAlsVoogd } = h;

  /* 1. De jongere wijst een volwassene aan. Op zijn eigen account, want het is
        zijn loopbaan -- een volwassene die zichzelf aanmeldt als voogd van een
        vreemde is precies wat er niet moet kunnen. */
  async function voogdVraag(jongereKey, codenaam) {
    const st = jeugdstand(jongereKey);
    if (!st.gezien) {
      return { status: 403, error: 'RTG heeft uw identiteitsbewijs nog niet gezien, dus staat uw ' +
        'leeftijd nog zoals u hem zelf opgaf. Een voogd aanwijzen kan pas als vaststaat dat u ' +
        'minderjarig bent: laat eerst uw identiteit zien op /apps/verificatie.html.' };
    }
    if (!st.minderjarig) {
      return { status: 409, error: 'U bent volgens uw identiteitsbewijs achttien of ouder. ' +
        'U tekent zelf; er is geen voogd nodig en er hoort er dus ook geen te zijn.' };
    }
    /* EEN BEVESTIGDE VOOGDIJ WORDT NIET STIL OVERSCHREVEN. Zonder deze regel
       zet een tweede `vraag` de stand terug op `gevraagd` -- ook als er op dat
       moment machtigingen lopen die juist op die bevestiging steunen. Dan zou
       een jongere zijn eigen bestuur kunnen wegdrukken door iemand anders aan
       te wijzen, en niemand ziet het. Wisselen kan, maar dan bewust: eerst de
       lopende machtigingen intrekken. */
    const bestaand = voogdVan(jongereKey);
    if (bestaand) {
      return { status: 409, error: 'U heeft al een door RTG bevestigde voogd (' + bestaand.wie + '). ' +
        'Een andere aanwijzen kan pas als die voogdij is beeindigd; anders zou een machtiging die op ' +
        'zijn handtekening steunt, stilletjes op iemand anders komen te staan.' };
    }
    const gevonden = keyVanCodenaam ? await keyVanCodenaam(scho(codenaam, 80)) : null;
    const voogdKey = gevonden && gevonden.key;
    if (!voogdKey) return { status: 404, error: 'Dit lid bestaat niet. Vraag om de codenaam zoals die in RTG staat.' };
    if (voogdKey === jongereKey) return { status: 400, error: 'U kunt niet uw eigen voogd zijn.' };
    /* DEZELFDE VRAAG NOG EEN KEER VERANDERT NIETS, en schrijft dus ook niets.
       Zonder deze regel laat een dubbeltik twee spoorregels achter voor een
       verzoek dat er maar een is -- gemeten in de dubbeltik-ronde. Iemand
       ANDERS aanwijzen mag wel: dat is een nieuw verzoek en geen herhaling. */
    const staand = (dossierKijk(jongereKey) || {}).voogd;
    if (staand && staand.key === voogdKey && staand.stand === 'gevraagd') {
      return { status: 200, ok: true, voogd: jeugdbeeld(jongereKey).voogd,
        let: 'Dit verzoek stond al open bij deze persoon; er is niets veranderd.' };
    }
    if (!volw(voogdKey)) {
      return { status: 403, error: 'Deze persoon is bij RTG niet vastgesteld als volwassene. ' +
        'Een voogd tekent mee voor een minderjarige, dus van hem moet juist wel vaststaan wie hij is.' };
    }
    const mis = await vastleggen(() => {
      const d = dossier(jongereKey);
      d.voogd = { key: voogdKey, wie: naam(voogdKey), stand: 'gevraagd', at: nu(), door: naam(jongereKey) };
      spoor(jongereKey, { soort: 'voogd-gevraagd', door: naam(jongereKey), gelukt: true });
    });
    if (mis) return mis;
    return { status: 200, ok: true, voogd: jeugdbeeld(jongereKey).voogd,
      let: 'Gevraagd. Deze persoon moet de rol zelf aanvaarden, en daarna bevestigt RTG hem na bewijs.' };
  }

  /* 2. De volwassene aanvaardt de rol. Niemand wordt ongevraagd voogd. */
  async function voogdRolAanvaard(voogdKey, jongereCodenaam) {
    const gevonden = keyVanCodenaam ? await keyVanCodenaam(scho(jongereCodenaam, 80)) : null;
    const jongereKey = gevonden && gevonden.key;
    if (!jongereKey) return { status: 404, error: 'Dit lid bestaat niet.' };
    const d = dossierKijk(jongereKey);
    const v = d && d.voogd;
    if (!v || v.key !== voogdKey) return { status: 404, error: 'U bent niet als voogd gevraagd door dit lid.' };
    if (v.stand !== 'gevraagd') return { status: 409, error: 'Dit verzoek is al ' + v.stand + '.' };
    const mis = await vastleggen(() => {
      dossier(jongereKey).voogd.stand = 'aanvaard';
      dossier(jongereKey).voogd.aanvaardAt = nu();
      spoor(jongereKey, { soort: 'voogd-aanvaard', door: naam(voogdKey), gelukt: true });
    });
    if (mis) return mis;
    return { status: 200, ok: true,
      let: 'Aanvaard. RTG bevestigt de voogdij pas nadat een medewerker een stuk heeft gezien ' +
        'waaruit blijkt dat u de wettelijk vertegenwoordiger bent; tot dan kan er niets namens dit lid.' };
  }

  /* 3. Een MENS van RTG bevestigt, na bewijs. Dezelfde eerlijkheid als bij de
        identiteitsverificatie: wij stellen vast dat een medewerker een stuk
        heeft GEZIEN, en valideren niets inhoudelijk. */
  async function voogdBesluit(door, jongereCodenaam, akkoord, reden) {
    const gevonden = keyVanCodenaam ? await keyVanCodenaam(scho(jongereCodenaam, 80)) : null;
    const jongereKey = gevonden && gevonden.key;
    if (!jongereKey) return { status: 404, error: 'Dit lid bestaat niet.' };
    /* `door` is de uitslag van routes/office/wiekijkt.js en dus een OBJECT, geen
       naam: {id} voor de eigenaar, {sleutel} voor een kantoorrol op een eigen
       account, en alleen {naam} voor de GEDEELDE code. Die laatste is precies
       wat hier niet mag tekenen -- een spoor dat eindigt bij een gedeelde code
       is geen spoor maar een alibi (KANTOORMACHT.md). Dus wordt er niet op
       tekst gecontroleerd maar op herleidbaarheid. */
    const d0 = door && typeof door === 'object' ? door : {};
    const herleidbaar = d0.id || d0.sleutel;
    if (!herleidbaar) {
      return { status: 403, error: 'Een voogdijbesluit staat op naam. Dit is de gedeelde kantoorcode, en ' +
        'daarmee is later niet te zien WIE heeft vastgesteld dat deze volwassene voor dit kind mag tekenen.' };
    }
    const wie = scho(d0.sleutel || d0.id, 80);
    const d = dossierKijk(jongereKey);
    const v = d && d.voogd;
    if (!v) return { status: 404, error: 'Dit lid heeft geen voogd gevraagd.' };
    if (v.stand !== 'aanvaard') {
      /* De reden verschilt per stand, en dat is geen opsmuk: "al besloten" en
         "de volwassene moet nog" vragen van de medewerker iets heel anders. Een
         weigering die beide gevallen dezelfde zin geeft, stuurt hem de verkeerde
         kant op -- gevonden in de dubbeltik-ronde, waar een tweede bevestiging
         te horen kreeg dat de volwassene nog moest aanvaarden terwijl die dat
         allang had gedaan. */
      const uitleg = (v.stand === 'bevestigd' || v.stand === 'afgewezen')
        ? 'Er is al een besluit genomen; een tweede besluit hoort een nieuwe aanvraag te zijn.'
        : 'Bevestigen kan pas als de volwassene de rol zelf heeft aanvaard.';
      return { status: 409, error: 'Deze voogdij staat op ' + v.stand + '. ' + uitleg };
    }
    const mis = await vastleggen(() => {
      const doss = dossier(jongereKey);
      doss.voogd.stand = akkoord ? 'bevestigd' : 'afgewezen';
      doss.voogd.bevestigdDoor = wie;
      doss.voogd.besluitAt = nu();
      doss.voogd.reden = scho(reden, 300) || null;
      spoor(jongereKey, { soort: akkoord ? 'voogd-bevestigd' : 'voogd-afgewezen', door: wie, gelukt: !!akkoord });
    });
    if (mis) return mis;
    return { status: 200, ok: true, stand: dossierKijk(jongereKey).voogd.stand,
      let: akkoord
        ? 'Bevestigd. Vanaf nu kan er een machtiging worden voorgesteld, en die vraagt twee handtekeningen.'
        : 'Afgewezen. Er kan niets namens dit lid, en dat blijft zo tot er wel bewijs is.' };
  }

  /* DE TWEEDE HANDTEKENING. De jongere tekent EERST: een voogd die vooraf kan
     tekenen, zet de jongere voor een voldongen feit, en dat is precies het
     "nooit sturen maar openen" uit LEVEN.md par. 2. */
  async function voogdTekent(voogdKey, mid) {
    const gevonden = zoekAlsVoogd(voogdKey, mid);
    if (!gevonden) return { status: 404, error: 'U bent niet de bevestigde voogd bij deze machtiging.' };
    const { m, clientKey } = gevonden;
    if (!m.voogdNodig) {
      return { status: 409, error: 'Deze machtiging vraagt geen tweede handtekening.' };
    }
    if (m.ingetrokken) return { status: 409, error: 'Deze machtiging is ingetrokken.' };
    if (!m.aanvaard) {
      return { status: 409, error: 'De jongere heeft zelf nog niet getekend. Zolang dat niet is gebeurd, ' +
        'tekent u niets: anders staat hij voor een voldongen feit.' };
    }
    if (m.voogdAanvaard) return { status: 409, error: 'U heeft hier al voor getekend.' };
    const mis = await vastleggen(() => {
      m.voogdAanvaard = { door: naam(voogdKey), at: nu() };
      spoor(clientKey, { soort: 'voogd-tekent', door: naam(voogdKey), machtigingId: m.id, gelukt: true });
    });
    if (mis) return mis;
    return { status: 200, ok: true,
      let: 'Getekend. Nu staan er twee handtekeningen onder en gaat de machtiging pas lopen.' };
  }

  return { voogdVraag, voogdRolAanvaard, voogdBesluit, voogdTekent };
};
