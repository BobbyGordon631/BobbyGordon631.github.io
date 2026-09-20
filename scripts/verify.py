"""Browser journey checks. Requires playwright and installed Google Chrome.
Run: python scripts/verify.py (defaults to local preview on port 4173).
All configured form requests are intercepted locally; no real inquiry is sent.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
BASE = os.environ.get('KKSOLVE_PREVIEW_URL', 'http://localhost:4173')
MOCK = 'https://forms.test.invalid/inquiry'

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True, args=['--no-proxy-server'])
    errors = []
    page = browser.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
    for width, height in [(320, 812), (390, 844), (768, 1024), (1440, 1000)]:
        page.set_viewport_size({'width': width, 'height': height})
        page.goto(BASE, wait_until='networkidle')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Overflow at {width}'
        assert page.locator('h1').count() == 1
        for img in page.locator('img').all():
            img.scroll_into_view_if_needed()
            assert img.evaluate('(img) => img.complete && img.naturalWidth > 0')
        for link in page.locator('a[href^="#"]').all():
            target = link.get_attribute('href')
            assert page.locator(target).count() == 1, target
        page.locator('nav a[href="#services"]').click()
        assert page.url.endswith('#services')
        page.locator('a[href="#contact"]').first.click()
        assert page.url.endswith('#contact')
        assert page.locator('.submit-button').is_disabled()
        assert 'not connected' in page.locator('#delivery-notice').inner_text()
        page.screenshot(path=str(ROOT / '.preview' / f'check-{width}.png'), full_page=True)
        print(f'PASS responsive layout, navigation, anchors, images: {width}px')
    # Keyboard access to first link and native FAQ disclosure.
    page.goto(BASE)
    page.keyboard.press('Tab')
    assert page.evaluate('document.activeElement.textContent') == 'Skip to content'
    page.keyboard.press('Enter')
    assert page.url.endswith('#main')
    summary = page.locator('summary').first
    summary.focus()
    page.keyboard.press('Enter')
    assert page.locator('details').first.get_attribute('open') is not None
    page.emulate_media(reduced_motion='reduce')
    assert page.evaluate('getComputedStyle(document.documentElement).scrollBehavior') == 'auto'
    assert page.locator('link[rel="canonical"]').get_attribute('href') == 'https://kksolve.com/'
    assert page.locator('meta[name="robots"]').get_attribute('content') == 'noindex, nofollow'
    json.loads(page.locator('script[type="application/ld+json"]').inner_text())
    print('PASS keyboard, FAQ, reduced motion, metadata and structured data')
    # No JavaScript: content/navigation accessible, form cannot submit.
    context = browser.new_context(java_script_enabled=False)
    noscript = context.new_page()
    noscript.goto(BASE)
    assert noscript.locator('h1').is_visible()
    assert noscript.locator('.submit-button').is_disabled()
    assert noscript.locator('noscript').is_visible()
    assert noscript.locator('a[href="mailto:kavin@kksolve.com"]').count() >= 1
    context.close()
    print('PASS no-JavaScript content and email fallback')
    assert not errors, errors
    print('PASS no console errors during ordinary browsing')
    errors.clear()
    # Inject only a local mock endpoint; no provider is contacted.
    page.route('**/runtime-config.js', lambda route: route.fulfill(content_type='application/javascript', body='window.KKSOLVE_CONFIG = {formEndpoint: "' + MOCK + '"};'))
    requests = []
    reply = {'status': 200, 'json': {'ok': True}}
    def submit(route):
        requests.append(True)
        if reply.get('abort'):
            route.abort('failed')
        else:
            route.fulfill(status=reply['status'], content_type='application/json', body=json.dumps(reply['json']))
    page.route(MOCK, submit)
    page.goto(BASE)
    events = []
    page.expose_function('recordEvent', lambda detail: events.append(detail))
    page.evaluate("window.addEventListener('kksolve:analytics', e => window.recordEvent(e.detail))")
    button = page.locator('.submit-button')
    button.click()
    assert not requests
    page.locator('#name').fill('Test Person')
    page.locator('#email').fill('invalid')
    page.locator('#business').fill('Test Organization')
    page.locator('#description').fill('A local test inquiry that must never be delivered.')
    button.click()
    assert not requests
    page.locator('#email').fill('test@example.invalid')
    page.locator('#website').fill('not-a-url')
    button.click()
    assert not requests
    page.locator('#website').fill('https://example.invalid')
    page.locator('#name').fill('   ')
    button.click()
    assert not requests
    page.locator('#name').fill('Test Person')
    page.locator('#company-url').fill('spam', force=True)
    button.click()
    assert not requests
    page.locator('#company-url').fill('', force=True)
    print('PASS required fields, email/URL validation, whitespace and honeypot')
    for response in [{'status': 422, 'json': {'ok': False}}, {'status': 200, 'json': {'ok': False}}, {'status': 200, 'json': {}}]:
        reply.update(response)
        button.click()
        page.wait_for_function("document.querySelector('#form-status').dataset.state === 'error'")
        assert page.locator('#name').input_value() == 'Test Person'
        assert not events
    print('PASS server rejection and unconfirmed responses preserve input, never report success')
    reply.update({'status': 200, 'json': {'ok': True}})
    button.click()
    page.wait_for_function("document.querySelector('#form-status').dataset.state === 'success'")
    assert page.locator('#name').input_value() == ''
    assert events == [{'event': 'inquiry_submitted'}]
    print('PASS confirmed success resets form and emits only non-personal event name')
    unexpected = [error for error in errors if '422 (Unprocessable Entity)' not in error]
    assert not unexpected, unexpected
    browser.close()
print('PASS no unexpected browser console errors; no real inquiry submitted')
