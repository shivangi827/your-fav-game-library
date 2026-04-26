(function () {
  var TERMS_KEY = 'gamelibrary.terms.v1';

  function hasAccepted() {
    try { return localStorage.getItem(TERMS_KEY) === 'accepted'; }
    catch (e) { return false; }
  }

  function markAccepted() {
    try { localStorage.setItem(TERMS_KEY, 'accepted'); }
    catch (e) { /* ignore */ }
  }

  function showModal(readOnly) {
    var modal = document.getElementById('modal-terms');
    var agree = document.getElementById('btn-terms-accept');
    var close = document.getElementById('btn-terms-close');
    if (!modal || !agree || !close) return;
    modal.classList.remove('hidden');
    agree.classList.toggle('hidden', readOnly);
    close.classList.toggle('hidden', !readOnly);
  }

  function hideModal() {
    var modal = document.getElementById('modal-terms');
    if (modal) modal.classList.add('hidden');
  }

  if (!hasAccepted()) {
    showModal(false);
  }

  var acceptBtn = document.getElementById('btn-terms-accept');
  if (acceptBtn) {
    acceptBtn.addEventListener('click', function () {
      markAccepted();
      hideModal();
    });
  }

  var closeBtn = document.getElementById('btn-terms-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      hideModal();
    });
  }

  var termsLink = document.getElementById('footer-terms');
  if (termsLink) {
    termsLink.addEventListener('click', function (e) {
      e.preventDefault();
      showModal(hasAccepted());
    });
  }
})();
