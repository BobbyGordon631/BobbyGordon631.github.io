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
  const pricing = window.KKSOLVE_CONFIG?.estimatePricing;
  const resultPanel = document.getElementById('quote-result');
  const rangeText = document.getElementById('quote-range');
  const basisText = document.getElementById('quote-basis');
  const isFormSubmit = window.KKSOLVE_CONFIG?.formProvider === 'formsubmit';
  const emailFallback = document.getElementById('email-fallback');
  const emailRequest = document.getElementById('email-request');
  const emailBody = document.getElementById('email-request-body');
  let submitting = false;
  function prepareEmail(quote) {
    const lines = Array.from(new FormData(form))
      .filter(([name]) => !name.startsWith('_'))
      .map(([name, value]) => `${name.replaceAll('_', ' ')}: ${value}`);
    lines.push('', `Estimated range (USD): ${quote.range}`, quote.basis,
      'Non-binding planning estimate. Final price after review; domain, hosting and subscriptions excluded.');
    emailBody.value = lines.join('\n');
    emailRequest.href = `mailto:kavin@kksolve.com?subject=${encodeURIComponent(`KKSolve quote request — ${quote.range}`)}&body=${encodeURIComponent(emailBody.value)}`;
  }
  function estimate() {
    const fields = form.elements;
    const updates = fields.service.value === 'Updates to my website';
    let key = updates ? ({ small: 'smallUpdate', section: 'sectionUpdate', custom: 'customUpdate' }[fields.update_scope.value])
      : ({ '1-4': 'standard', '5-8': 'premier', '9-12': 'extended', '13+': 'large', unknown: 'standard' }[fields.pages.value]);
    let [low, high] = pricing[key];
    const notes = [updates ? fields.update_scope.selectedOptions[0].textContent : fields.pages.value === 'unknown'
      ? 'Assumes 1–4 pages; page count still to be confirmed' : `${fields.pages.value} pages`];
    if (!updates) {
      for (const [value, label] of [[fields.features.value, fields.features.selectedOptions[0].textContent], [fields.content.value, fields.content.selectedOptions[0].textContent]]) {
        if (pricing[value]) { low += pricing[value][0]; high += pricing[value][1]; }
        notes.push(label);
      }
    }
    if ((!updates && (fields.features.value === 'custom' || fields.pages.value === '13+' || fields.content.value === 'writing')) || (updates && fields.update_scope.value === 'custom')) {
      notes.push('Broad allowance only; complex work may exceed this range');
    }
    notes.push('Your description and timeline will be reviewed personally; budget does not change this estimate');
    const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
    return { low, high, range: `${money(low)}–${money(high)}`, basis: notes.join('. ') + '.' };
  }
  function showEstimate() {
    const quote = estimate();
    rangeText.textContent = quote.range;
    basisText.textContent = quote.basis;
    resultPanel.hidden = false;
    return quote;
  }
  function syncScope() {
    const updates = form.elements.service.value === 'Updates to my website';
    document.getElementById('update-scope-field').hidden = !updates;
    form.elements.update_scope.disabled = !updates;
    for (const name of ['pages', 'features', 'content']) {
      form.elements[name].disabled = updates;
      form.elements[name].closest('.field').hidden = updates;
    }
  }
  form.addEventListener('change', () => {
    syncScope();
    if (!resultPanel.hidden) showEstimate();
    if (!emailFallback.hidden) prepareEmail(estimate());
  });
  form.addEventListener('input', () => {
    if (!submitting) { status.textContent = ''; delete status.dataset.state; }
    if (!emailFallback.hidden) prepareEmail(estimate());
  });
  syncScope();
  function report(message, state) {
    status.textContent = message;
    status.dataset.state = state;
    status.focus();
  }
  // Prevent default navigation even if configuration is missing or invalid.
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    for (const input of form.querySelectorAll('[required]')) {
      input.setCustomValidity(input.value.trim() ? '' : 'Please complete this field.');
    }
    if (!form.reportValidity()) return;
    if (form.elements._gotcha.value) {
      report('Your request could not be submitted. Please email kavin@kksolve.com.', 'error');
      return;
    }
    const quote = showEstimate();
    prepareEmail(quote);
    emailFallback.hidden = true;
    if (!configured) {
      emailFallback.hidden = false;
      report('Your estimate is ready. Online delivery is unavailable; please email your details to kavin@kksolve.com.', 'error');
      return;
    }
    const payload = new FormData(form);
    payload.set('estimate_range_USD', quote.range);
    payload.set('estimate_min_USD', String(quote.low));
    payload.set('estimate_max_USD', String(quote.high));
    payload.set('estimate_assumptions', quote.basis);
    payload.set('estimate_terms', 'Non-binding planning estimate. Final price after review; domain, hosting and subscriptions excluded.');
    payload.set('_subject', `KKSolve quote request — ${quote.range}`);
    if (isFormSubmit) {
      payload.set('_honey', payload.get('_gotcha') || '');
      payload.delete('_gotcha');
      payload.set('_template', 'table');
      payload.set('_url', 'https://kksolve.com/');
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
        body: payload,
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'strict-origin-when-cross-origin'
      });
      const result = await response.json();
      if (isFormSubmit && typeof result.message === 'string' && /activat|confirm.{0,40}email|verify.{0,40}email/i.test(result.message)) {
        emailFallback.hidden = false;
        report('Email delivery is not activated yet. Please use the direct email option below to send your request.', 'error');
        return;
      }
      const accepted = isFormSubmit ? result.success === true || result.success === 'true' : result.ok === true;
      if (!response.ok || !accepted) throw new Error('Submission not confirmed');
      report(`Your ${quote.range} estimate and project details were accepted by the email service. Kavin will review your brief and follow up.`, 'success');
      track('inquiry_submitted');
    } catch (error) {
      emailFallback.hidden = false;
      report(error.name === 'AbortError'
        ? 'The email service did not respond in time. Delivery is unconfirmed. Your estimate and details are saved below so you can send them directly by email.'
        : 'The email service could not confirm delivery. Your estimate and details are saved below so you can send them directly by email.', 'error');
    } finally {
      clearTimeout(timeout);
      submitting = false;
      button.disabled = false;
      button.textContent = 'Get My Estimate & Send Request ↗';
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
  button.disabled = !pricing;
  if (configured) {
    notice.textContent = isFormSubmit ? 'Your project details and estimated range will be sent to Kavin via FormSubmit.' : 'Your project details and estimated range will be sent to Kavin through the configured form provider.';
  }
})();
