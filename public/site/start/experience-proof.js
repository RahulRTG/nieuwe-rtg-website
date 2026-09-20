(function (d) {
  'use strict';
  var dialog = d.getElementById('codeProofDialog');
  if (!dialog) return;
  d.querySelectorAll('[data-code-proof]').forEach(function (card) {
    card.addEventListener('click', function () {
      d.getElementById('codeProofTitle').textContent = card.dataset.proofTitle || 'Codebasis';
      d.getElementById('codeProofBody').textContent = card.dataset.proofBody || '';
      d.getElementById('codeProofSource').textContent = card.dataset.proofSource || '';
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    });
  });
}(document));
