(() => {
  'use strict';
  // Local-only hooks. No analytics service is loaded and no data leaves the page.
  function track(name) {
    window.dispatchEvent(new CustomEvent('kksolve:analytics', { detail: { event: name } }));
  }
  document.querySelectorAll('[data-event]').forEach(link => {
    link.addEventListener('click', () => track(link.dataset.event));
  });
  const form = document.getElementById('inquiry-form');
  if (!form) return;
  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById('form-status');
  const notice = document.getElementById('delivery-notice');
  const endpoint = window.KKSOLVE_CONFIG?.formEndpoint || '';
  const configured = /^https:\/\//.test(endpoint);
  let submitting = false;
  function report(message, state) {
    status.textContent = message;
    status.dataset.state = state;
    status.focus();
  }
  // Prevent default navigation even if configuration is missing or invalid.
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    if (!configured) {
      report('This form is not connected yet. Nothing has been sent. Please email kavin@kksolve.com.', 'error');
      return;
    }
    for (const input of form.querySelectorAll('[required]')) {
      input.setCustomValidity(input.value.trim() ? '' : 'Please complete this field.');
    }
    if (!form.reportValidity()) return;
    if (form.elements._gotcha.value) {
      report('Your request could not be submitted. Please email kavin@kksolve.com.', 'error');
      return;
    }
    submitting = true;
    button.disabled = true;
    button.textContent = 'Sending your request…';
    form.setAttribute('aria-busy', 'true');
    status.textContent = 'Sending your request…';
    status.dataset.state = 'loading';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer'
      });
      // The configured provider must confirm acceptance with { "ok": true }.
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error('Submission not confirmed');
      form.reset();
      report('Thanks — your project inquiry has been submitted. I’ll be in touch at the email you provided.', 'success');
      track('inquiry_submitted');
    } catch (error) {
      report(error.name === 'AbortError'
        ? 'The request timed out, so delivery could not be confirmed. Your details are still here. Please email kavin@kksolve.com or try again.'
        : 'Delivery could not be confirmed. Your details are still here. Please try again or email kavin@kksolve.com.', 'error');
    } finally {
      clearTimeout(timeout);
      submitting = false;
      button.disabled = false;
      button.textContent = 'Request My Quote ↗';
      form.removeAttribute('aria-busy');
    }
  });
  form.querySelectorAll('input, textarea').forEach(input => {
    input.addEventListener('input', () => {
      input.setCustomValidity('');
      input.removeAttribute('aria-invalid');
    });
    input.addEventListener('invalid', () => input.setAttribute('aria-invalid', 'true'));
  });
  if (configured) {
    button.disabled = false;
    notice.textContent = 'Your details will be sent to Kavin through the configured form provider to discuss your project.';
  }
})();
