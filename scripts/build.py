"""Dependency-free static build. Draft terms only appear in the local review output."""
import argparse
import html
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = json.loads((ROOT / 'site-config.json').read_text())
TEMPLATE = (ROOT / 'templates/index.html').read_text()


def esc(value):
    return html.escape(str(value), quote=True)


def render(review=False):
    show_terms = review or CONFIG['termsApproved']
    pending = not CONFIG['termsApproved']
    draft = '<p class="draft-label">PROPOSED TERMS · Pending Kavin’s approval</p>' if show_terms and pending else ''
    packages = draft + '<div class="package-grid">'
    for package in CONFIG['packages']:
        name = esc(package['name'])
        price = f'<span class="price-label">Starting at</span>${package["price"]:,}' if show_terms else 'Request a quote'
        features = package['features'] if show_terms else ['Pages and content support scoped to your project', 'Features and revision rounds agreed in your quote', 'Domain, hosting and subscriptions priced separately']
        packages += f'<article class="package"><div class="package-top"><h3>{name}</h3><span aria-hidden="true">↗</span></div><p class="package-description">{esc(package["description"])}</p><p class="price">{price}</p><ul>'
        packages += ''.join(f'<li>{esc(feature)}</li>' for feature in features)
        packages += f'</ul><a class="button button-outline" href="#contact" data-event="quote_click">Let’s talk {name}<span aria-hidden="true">↗</span></a></article>'
    packages += '</div>'
    if show_terms:
        packages += '<p class="package-footnote">¹ Subject to platform compatibility. Any booking or registration subscription is paid separately.</p>'
    if show_terms:
        payment = f'<div>{draft}<p><strong>Payment in stages.</strong> {esc(CONFIG["standardPayment"])} {esc(CONFIG["largerPayment"])}</p></div>'
        defect = f'<p><strong>{"Proposed support term:" if pending else "Defect corrections:"}</strong> A {CONFIG["defectDays"]}-day post-launch period for correcting defects in the delivered, agreed functionality. {"Pending approval. " if pending else ""}New content or functionality is separate work.</p>'
        cost = f'<p>{"Proposed, pending approval: " if pending else ""}Standard starts at ${CONFIG["packages"][0]["price"]:,}; Premier starts at ${CONFIG["packages"][1]["price"]:,}. Final pricing depends on your agreed scope.</p>'
    else:
        payment = '<p><strong>Payment in stages.</strong> The deposit, payment milestones, and remaining balance will be confirmed in your written quote before work starts.</p>'
        defect = '<p>A defect is a problem with the delivered, agreed functionality; new content or features are new work. Any defect correction period will be confirmed in your written agreement before work starts.</p>'
        cost = '<p>Request a quote for Standard or Premier. The price depends on the pages, content support, features, and revisions we agree on.</p>'
    updates = [
        ('Small edits', CONFIG['smallUpdatePrice'], 'Change business hours, replace a photo, or update a short passage.'),
        ('Larger updates', CONFIG['largerUpdatePrice'], 'Refresh an existing section with your content, or change several related items on one page.'),
        ('Something more?', 'Quoted separately', 'New pages, features, redesigns, and complex changes are scoped individually.')
    ]
    support = draft
    for i, (title, price, description) in enumerate(updates):
        label = (price + (' / request' if i < 2 else '')) if show_terms else 'Quoted separately'
        support += f'<div class="update-row"><div class="update-title"><h3>{title}</h3><span class="update-price">{esc(label)}</span></div><p>{description}</p></div>'
    support += '<p class="support-note">Requests beyond these examples receive a separate quote. Availability and timing are confirmed for each request.</p>'
    endpoint = CONFIG.get('formEndpoint', '')
    if endpoint and not endpoint.startswith('https://'):
        raise ValueError('Use an HTTPS public submission endpoint, never a private API key.')
    values = {
        'ROBOTS': 'noindex, nofollow' if review else 'index, follow',
        'REVIEW_BANNER': '<aside class="review-banner">Private review preview · Package prices, payment & support terms are proposals.<a href="#services">Review the details ↓</a></aside>' if review else '',
        'PACKAGES': packages, 'PAYMENT': payment, 'SUPPORT': support,
        'COST_FAQ': cost, 'DEFECT_FAQ': defect,
        'FORM_ACTION': esc(endpoint) if endpoint else '#contact',
        'DELIVERY_NOTICE': 'Your details will be sent to Kavin through the configured form provider to discuss your project.' if endpoint else 'Online form delivery is not connected yet. Please email <a href="mailto:kavin@kksolve.com">kavin@kksolve.com</a> to request your quote. Nothing entered here is sent.'
    }
    result = TEMPLATE
    for key, value in values.items():
        result = result.replace('@@' + key + '@@', value)
    if '@@' in result:
        raise ValueError('Unresolved template value')
    return '\n'.join(line.rstrip() for line in result.splitlines()) + '\n'


def build_folder(folder, review):
    folder.mkdir(exist_ok=True)
    (folder / 'index.html').write_text(render(review))
    for filename in ['style.css', 'script.js', 'tinos.html']:
        shutil.copy2(ROOT / filename, folder / filename)
    shutil.copytree(ROOT / 'assets', folder / 'assets', dirs_exist_ok=True)
    runtime = 'window.KKSOLVE_CONFIG = ' + json.dumps({'formEndpoint': CONFIG.get('formEndpoint', '')}) + ';\n'
    (folder / 'runtime-config.js').write_text(runtime)
    (folder / 'robots.txt').write_text('User-agent: *\nDisallow: /\n' if review else 'User-agent: *\nAllow: /\nSitemap: https://kksolve.com/sitemap.xml\n')
    if not review:
        (folder / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://kksolve.com/</loc></url></urlset>\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--production', action='store_true', help='Require explicit site approval before a deployment build')
    args = parser.parse_args()
    if args.production and not CONFIG['siteApproved']:
        parser.error('Publication blocked: review the preview and set siteApproved only after Kavin approves publication.')
    build_folder(ROOT / 'dist', False)
    build_folder(ROOT / '.preview', True)
    # Root remains a usable static site with publication-safe wording.
    for filename in ['index.html', 'runtime-config.js', 'robots.txt', 'sitemap.xml']:
        shutil.copy2(ROOT / 'dist' / filename, ROOT / filename)
    print('Built .preview/ (draft terms, noindex) and dist/ (publication-safe terms). Nothing deployed.')
