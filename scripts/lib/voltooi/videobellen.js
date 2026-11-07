/* Echte browserproef voor het vluchtige videobelcontract. De oproep loopt via
   Rahul, de zichtbare kiezer en de Edge; frames, audiosamples, peer-identiteit en opruiming
   worden in de twee echte browsercontexten gemeten. */
'use strict';
const assert = require('node:assert/strict');
const { metScherm, toets } = require('../voltooischerm');
const bel = require('../voltooibellen');

const mediaBewijs = (beeld) => ({ aFrames: beeld[0].frames, bFrames: beeld[1].frames,
  aAudio: beeld[0].audio, bAudio: beeld[1].audio });

const sc = {
  functie: 'os:videobellen',
  ingang: '/apps/app.html?pas=rtg',
  kanaal: 'browser',
  belofte: 'twee verbonden leden starten via Rahul een zichtbaar videogesprek, ontvangen over en weer voortlopende beelden en gedecodeerde audio en kunnen het volledig beeindigen; signalingherstel behoudt de bestaande peer en na herladen herleeft geen oude oproep',
  grens: 'vluchtig gesprek op twee Chromium-toestellen met synthetische camera en microfoon, loopback-ICE en signaling op dezelfde origin; geen opnamepersistentie, browser- of peercrash, TURN over een streng netwerk, echte camera, hoorbare luidsprekerweergave of productiebezorging',
  async loop(w, stap) {
    const base = w.basis;
    const post = bel.maakPost(base);
    const A = await bel.lid(post, 'vpa');
    const B = await bel.lid(post, 'vpb');
    await bel.verbind(post, A, B);
    const ijs = (await post('/api/ice', {}, A.token)).data;
    assert.ok(ijs && Array.isArray(ijs.iceServers), 'de testwereld geeft ICE-servers uit');

    await metScherm(w, sc, async ({ ctx, p, observeer, nieuwToestel, verslag }) => {
      const a = await bel.bereidToestel({ ctx, p, observeer }, base, A.token, sc.ingang);
      const b = await bel.nieuwMediaToestel(nieuwToestel, base, B.token, sc.ingang);

      await bel.wachtWerktafel(a, false);
      await bel.wachtWerktafel(b, true);
      await toets(stap, 'menselijk', 'Rahul opent de zichtbare videobelkiezer vanuit de Edge', async () => {
        await bel.openViaRahul(a);
        return 'de Rahul-opdracht toont #osBelScrim.open op ' + sc.ingang;
      });
      await toets(stap, 'menselijk', 'de ontvanger ziet een inkomende video-oproep van het verbonden lid', async () => {
        await bel.kiesContact(a, b, B);
        return 'de inkomende oproep staat zichtbaar als Video';
      });
      await toets(stap, 'menselijk', 'de zichtbare Edge-bediening laat de ontvanger bewust opnemen', async () => {
        await bel.neemOp(b);
        return 'de knop Opnemen is gezien en gebruikt';
      });
      await toets(stap, 'voltooibaar', 'beide toestellen bereiken dezelfde verbonden oproep', async () => {
        await Promise.all([bel.verbonden(a), bel.verbonden(b)]);
        return 'beide RTCPeerConnections zijn connected';
      });
      let beeld;
      await toets(stap, 'voltooibaar', 'beide leden ontvangen gedecodeerd videobeeld en audio met energie', async () => {
        beeld = await bel.beelden(a, b);
        return mediaBewijs(beeld);
      });
      await toets(stap, 'voltooibaar', 'beelden en gedecodeerde audio lopen in beide richtingen aantoonbaar verder', async () => {
        beeld = await bel.beelden(a, b, beeld);
        return mediaBewijs(beeld);
      });
      await toets(stap, 'voltooibaar', 'ophangen sluit de peerverbindingen en alle lokale mediatracks', async () => {
        await bel.bewaarGespreksmiddelen([a, b]);
        await bel.hangOp(a, b);
        return 'beide peers closed en alle tracks ended';
      });

      await toets(stap, 'persistent', 'na herladen van A bevestigt de SSE-barriere dat geen oude oproep herleeft', async () => {
        await bel.herlaadZonderOudeOproep(a, post, A, B, 'na-herladen-a');
        return 'A heeft geen actieve of inkomende oude oproep';
      });
      await toets(stap, 'persistent', 'na herladen van B bevestigt de SSE-barriere dat geen oude oproep herleeft', async () => {
        await bel.herlaadZonderOudeOproep(b, post, B, A, 'na-herladen-b');
        return 'B heeft geen actieve of inkomende oude oproep';
      });
      await toets(stap, 'persistent', 'na beide herladingen kan alleen een bewuste nieuwe oproep beginnen', async () => {
        await bel.wachtWerktafel(a, false);
        await bel.wachtWerktafel(b, true);
        await bel.openViaRahul(a);
        await bel.kiesContact(a, b, B);
        await bel.neemOp(b);
        await Promise.all([bel.verbonden(a), bel.verbonden(b)]);
        beeld = await bel.beelden(a, b);
        beeld = await bel.beelden(a, b, beeld);
        return { nieuwGesprek: true, ...mediaBewijs(beeld) };
      });
      await toets(stap, 'persistent', 'een nette signalingherstart blijft op dezelfde origin en dezelfde peers', async () => {
        await bel.bewaarPeer([a, b]);
        await w.herstart();
        assert.equal(w.basis, base, 'de signaling-origin blijft gelijk');
        await bel.controleerDezelfdePeer([a, b]);
        return 'de twee bestaande RTCPeerConnections bleven behouden';
      });
      await toets(stap, 'persistent', 'na signalingherstart lopen beeld en audio op dezelfde peers verder', async () => {
        beeld = await bel.beelden(a, b, beeld);
        return mediaBewijs(beeld);
      });
      await toets(stap, 'persistent', 'het hervatte gesprek kan schoon worden beeindigd', async () => {
        await bel.bewaarGespreksmiddelen([a, b]);
        await bel.hangOp(a, b);
        return 'beide peers closed en alle tracks ended';
      });

      await toets(stap, 'herstelbaar', 'na eerder herstel kan een bewuste nieuwe oproep opnieuw verbinden', async () => {
        await bel.wachtWerktafel(a, false);
        await bel.wachtWerktafel(b, true);
        await bel.openViaRahul(a);
        await bel.kiesContact(a, b, B);
        await bel.neemOp(b);
        await Promise.all([bel.verbonden(a), bel.verbonden(b)]);
        beeld = await bel.beelden(a, b);
        beeld = await bel.beelden(a, b, beeld);
        return { nieuwGesprek: true, ...mediaBewijs(beeld) };
      });
      await toets(stap, 'herstelbaar', 'een signalingcrash blijft op dezelfde origin en maakt geen nieuwe peer', async () => {
        await bel.bewaarPeer([a, b]);
        await w.crash();
        assert.equal(w.basis, base, 'de signaling-origin blijft gelijk');
        await bel.controleerDezelfdePeer([a, b]);
        return 'de twee bestaande RTCPeerConnections bleven behouden';
      });
      await toets(stap, 'herstelbaar', 'na signalingcrash lopen beeld en audio op dezelfde peers verder', async () => {
        beeld = await bel.beelden(a, b, beeld);
        return mediaBewijs(beeld);
      });
      await toets(stap, 'herstelbaar', 'ook na een signalingcrash sluit ophangen alle peers en tracks', async () => {
        await bel.bewaarGespreksmiddelen([a, b]);
        await bel.hangOp(a, b);
        return 'beide peers closed en alle tracks ended';
      });

      assert.equal(verslag.ingang, sc.ingang, 'de zichtbare Rahul-opdracht is niet op de ingang waargenomen');
      assert.ok(verslag.toestanden.filter((t) => t.selector === '#osBelScrim.open').length >= 3,
        'niet iedere bewuste oproep opende de zichtbare videobelkiezer');
      assert.deepEqual(verslag.fouten, [], 'paginafouten tijdens gesprek en herstel');
      assert.deepEqual(verslag.documentfouten, [], 'documentfouten tijdens gesprek en herstel');
    }, { args: bel.nepMediaArgs(), context: bel.contextOpties });
  }
};

module.exports = sc;
