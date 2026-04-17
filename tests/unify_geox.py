import os
import re

SITE_ROOT = '/root/arif-sites/sites/geox.arif-fazil.com'
BASE_URL = 'https://geox.arif-fazil.com'

NAV_ITEMS = [
    ('Home', '/'),
    ('Apps', '/apps/'),
    ('Map', '/map/'),
    ('Viewer', '/viewer/'),
    ('Cockpit', '/cockpit/'),
    ('Tools', '/tools/'),
    ('Theory', '/theory/'),
    ('Docs', '/docs/'),
    ('Status', '/status/'),
    ('Wiki', '/wiki/')
]

def get_nav_html(current_path):
    # Determine the depth of the current file to use relative paths if needed,
    # but for now, we'll use root-relative links as they seem to be the standard here
    # except for assets.
    
    # Check if current_path is a directory or file
    # If it's index.html in a subdir, it's effectively at the subdir level.
    
    nav_html = '            <nav class="nav-links">\n'
    for label, href in NAV_ITEMS:
        # Simple active state check
        active = ''
        if href == '/' and current_path == '/':
            active = ' class="active"'
        elif href != '/' and current_path.startswith(href):
            active = ' class="active"'
            
        nav_html += f'                <a href="{href}"{active}>{label}</a>\n'
    nav_html += '            </nav>'
    return nav_html

def get_header_html(current_path, page_name="UNKNOWN"):
    return f'''        <header>
            <div class="mono" style="margin-bottom: 0.5rem; font-size: 0.7rem; color: var(--muted-color);">
                GEOX_PLATFORM_HUBNODE // {page_name.upper().replace(' ', '_')}
            </div>
{get_nav_html(current_path)}
        </header>'''

def get_footer_html():
    return '''        <footer>
            <div class="governance">DITEMPA BUKAN DIBERI</div>
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2rem;">
                <div>
                    <p>&copy; 2026 GEOX — Dimension-Native Earth Intelligence</p>
                    <p class="mono">VER: 1.0.0-FORGE</p>
                </div>
                <div class="mono" style="text-align: right;">
                    <a href="/status/" style="color: var(--muted-color); font-size: 0.7rem;">SYSTEM_STATUS: [LIVE]</a>
                    <br>
                    <a href="https://github.com/ariffazil/GEOX" style="color: var(--muted-color); font-size: 0.7rem;" target="_blank" rel="noopener">SOURCE: GitHub</a>
                </div>
            </div>
            <div class="constellation-footer" style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border-color); font-size: 0.7rem; color: var(--muted-color); display: flex; gap: 1rem; flex-wrap: wrap;">
                <span>CONSTELLATION:</span>
                <a href="https://soul.arif-fazil.com" style="color: inherit;">SOUL</a>
                <a href="https://mind.arif-fazil.com" style="color: inherit;">MIND</a>
                <a href="https://body.arif-fazil.com" style="color: inherit;">BODY</a>
                <a href="https://mcp.arif-fazil.com" style="color: inherit;">KERNEL</a>
                <a href="https://aaa.arif-fazil.com" style="color: inherit;">FORGE</a>
            </div>
        </footer>'''

def process_file(file_path):
    if '/cockpit/' in file_path and 'index.html' in file_path:
        # Special handling for React app
        process_cockpit_index(file_path)
        return

    with open(file_path, 'r') as f:
        content = f.read()

    # Extract Page Name from title or filename
    title_match = re.search(r'<title>(.*?)</title>', content, re.IGNORECASE)
    if title_match:
        raw_title = title_match.group(1)
        # Clean up existing GEOX and arifOS patterns
        clean_title = raw_title.replace('GEOX', '').replace('arifOS', '').replace('|', '').replace('—', '').replace('·', '').strip()
        if not clean_title:
            clean_title = "Home"
        page_name = clean_title
    else:
        page_name = os.path.basename(os.path.dirname(file_path)).title()
        if not page_name:
            page_name = "Home"

    # 1. Update Title
    new_title = f'GEOX — {page_name} · arifOS'
    content = re.sub(r'<title>.*?</title>', f'<title>{new_title}</title>', content, flags=re.IGNORECASE)

    # 2. Add/Update Canonical
    rel_path = os.path.relpath(file_path, SITE_ROOT)
    if rel_path == 'index.html':
        url_path = '/'
    elif rel_path.endswith('index.html'):
        url_path = '/' + rel_path[:-10]
    else:
        url_path = '/' + rel_path
        
    canonical_tag = f'<link rel="canonical" href="{BASE_URL}{url_path}">'
    if '<link rel="canonical"' in content:
        content = re.sub(r'<link rel="canonical" href=".*?">', canonical_tag, content)
    else:
        # Insert after meta tags
        content = re.sub(r'(<meta.*?>)', r'\1\n    ' + canonical_tag, content, count=1)

    # 3. Meta description
    meta_desc = '<meta name="description" content="GEOX — Governed geoscience and earth physics intelligence under arifOS constitutional floors.">'
    if '<meta name="description"' in content:
        content = re.sub(r'<meta name="description" content=".*?">', meta_desc, content)
    else:
        content = re.sub(r'(<meta.*?>)', r'\1\n    ' + meta_desc, content, count=1)

    # 4. Favicon
    favicon_tag = '<link rel="icon" type="image/png" href="/favicon.png">'
    if '<link rel="icon"' not in content:
        content = re.sub(r'(<head>.*?)', r'\1\n    ' + favicon_tag, content, count=1, flags=re.S)

    # 5. Replace Navigation (Header)
    header_regex = r'<header.*?>.*?</header>'
    new_header = get_header_html(url_path, page_name)
    if re.search(header_regex, content, flags=re.S):
        content = re.sub(header_regex, new_header, content, flags=re.S)
    else:
        # If no header, maybe insert after body start
        content = re.sub(r'(<body.*?>)', r'\1\n    <div class="container">\n' + new_header, content, count=1, flags=re.S)

    # 6. Replace Footer
    footer_regex = r'<footer.*?>.*?</footer>'
    new_footer = get_footer_html()
    if re.search(footer_regex, content, flags=re.S):
        content = re.sub(footer_regex, new_footer, content, flags=re.S)
    else:
        # If no footer, insert before container end or body end
        if '</div>' in content:
             content = re.sub(r'(</div>\s*</body>)', new_footer + r'\n\1', content, flags=re.S)
        else:
             content = re.sub(r'(</body>)', new_footer + r'\1', content, flags=re.S)

    # 7. Replace arifosmcp.arif-fazil.com with mcp.arif-fazil.com
    content = content.replace('arifosmcp.arif-fazil.com', 'mcp.arif-fazil.com')

    # 8. Fix broken relative paths for assets if needed
    # We'll do a simple replacement for css/geox-platform.css based on depth
    depth = rel_path.count('/')
    prefix = '../' * depth
    content = re.sub(r'href="css/geox-platform.css"', f'href="{prefix}css/geox-platform.css"', content)
    
    # Ensure any link to arifosmcp is fixed
    content = content.replace('arifosmcp.arif-fazil.com', 'mcp.arif-fazil.com')

    with open(file_path, 'w') as f:
        f.write(content)

def process_cockpit_index(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Add a small "← Back to GEOX" link or banner outside the React root
    banner = '<div style="position: fixed; top: 10px; left: 10px; z-index: 9999; background: rgba(0,0,0,0.8); padding: 5px 10px; border: 1px solid #3d5c3d; font-family: monospace; font-size: 12px;"><a href="/" style="color: #6b9b6b; text-decoration: none;">← BACK TO GEOX</a></div>'
    if banner not in content:
        content = content.replace('<body>', f'<body>\n    {banner}')
    
    # Replace arifosmcp
    content = content.replace('arifosmcp.arif-fazil.com', 'mcp.arif-fazil.com')
    
    with open(file_path, 'w') as f:
        f.write(content)

def main():
    for root, dirs, files in os.walk(SITE_ROOT):
        for file in files:
            if file.endswith('.html'):
                process_file(os.path.join(root, file))

if __name__ == '__main__':
    main()
