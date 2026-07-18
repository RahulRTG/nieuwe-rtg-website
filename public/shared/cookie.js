/* Cookiemelding voor de site en de apps. RTG gebruikt alleen functionele
   opslag (ingelogd blijven, voorkeuren), geen tracking en geen cookies van
   derden; daarom is dit een eerlijke melding met een knop, geen
   toestemmingsmuur. Eén keer bevestigen is genoeg (localStorage). */
(function () {
  var SLEUTEL = 'rtg_cookieinfo_v1';
  try { if (localStorage.getItem(SLEUTEL)) return; } catch (e) { return; }

  var en = false;
  try { en = (window.RTGi18n && RTGi18n.lang === 'en') || /^en/.test(navigator.language || ''); } catch (e) {}
  var T = en
    ? { txt: 'RTG uses functional storage only, to keep you signed in and remember your preferences. No tracking, no third-party cookies.',
        ok: 'Fine', privacy: 'Privacy policy' }
    : { txt: 'RTG gebruikt alleen functionele opslag: om u ingelogd te houden en uw voorkeuren te onthouden. Geen tracking, geen cookies van derden.',
        ok: 'Prima', privacy: 'Privacybeleid' };

  var stijl = document.createElement('style');
  stijl.textContent =
    '#rtg-cookie{position:fixed;left:50%;bottom:max(1rem,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9999;' +
      'width:calc(100% - 2rem);max-width:440px;background:#0C0C0B;color:#F5F3EE;border:1px solid #857007;border-radius:14px;' +
      'padding:1rem 1.1rem;font-family:Inter,system-ui,sans-serif;font-size:0.8rem;line-height:1.55;box-shadow:0 12px 40px rgba(0,0,0,0.35);}' +
    '#rtg-cookie p{margin:0 0 0.75rem;color:#F5F3EE;}' +
    '#rtg-cookie .rij{display:flex;align-items:center;gap:1rem;}' +
    '#rtg-cookie a{color:#C9B25A;text-decoration:none;border-bottom:1px solid rgba(201,178,90,0.4);font-size:0.74rem;}' +
    '#rtg-cookie button{margin-left:auto;background:#FFFFFF;color:#0C0C0B;border:none;border-radius:999px;' +
      'padding:0.5rem 1.4rem;font-family:inherit;font-size:0.78rem;font-weight:600;cursor:pointer;}';
  document.head.appendChild(stijl);

  var el = document.createElement('div');
  el.id = 'rtg-cookie';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', en ? 'Cookie notice' : 'Cookiemelding');
  var p = document.createElement('p');
  p.textContent = T.txt;
  var rij = document.createElement('div');
  rij.className = 'rij';
  var a = document.createElement('a');
  a.href = '/apps/juridisch/privacy.html';
  a.textContent = T.privacy;
  var knop = document.createElement('button');
  knop.type = 'button';
  knop.textContent = T.ok;
  knop.addEventListener('click', function () {
    try { localStorage.setItem(SLEUTEL, new Date().toISOString()); } catch (e) {}
    el.remove();
  });
  rij.appendChild(a); rij.appendChild(knop);
  el.appendChild(p); el.appendChild(rij);
  var plaats = function () { document.body.appendChild(el); };
  if (document.body) plaats(); else document.addEventListener('DOMContentLoaded', plaats);
})();
