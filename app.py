import urllib.request
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request
from datetime import datetime
import hashlib
import ssl

app = Flask(__name__)

# In-memory cache
CACHE_DATA = None
CACHE_TIME = None

def fetch_and_parse_feed(bypass_cache=False):
    global CACHE_DATA, CACHE_TIME
    
    # Check cache (10 minutes)
    if not bypass_cache and CACHE_DATA and CACHE_TIME:
        time_diff = (datetime.now() - CACHE_TIME).total_seconds()
        if time_diff < 600:
            return CACHE_DATA
            
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    
    # Bypass SSL verification to avoid local development trust issues
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=12) as response:
            xml_data = response.read()
    except Exception as e:
        if CACHE_DATA:
            print(f"Network error while fetching feed, returning cached version. Error: {e}")
            return CACHE_DATA
        raise Exception(f"Failed to fetch feed: {str(e)}")
        
    try:
        root = ET.fromstring(xml_data)
    except Exception as e:
        raise Exception(f"Failed to parse XML data: {str(e)}")
        
    namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
    entries = root.findall('atom:entry', namespaces)
    
    releases = []
    stats = {
        "total_days": len(entries),
        "total_updates": 0,
        "categories": {}
    }
    
    for entry_idx, entry in enumerate(entries):
        title = entry.find('atom:title', namespaces)
        title_text = title.text if title is not None else "Unknown Date"
        
        updated = entry.find('atom:updated', namespaces)
        updated_text = updated.text if updated is not None else ""
        
        link_elem = entry.find('atom:link', namespaces)
        link_href = link_elem.attrib.get('href', '') if link_elem is not None else ''
        
        content_elem = entry.find('atom:content', namespaces)
        content_html = content_elem.text if content_elem is not None else ""
        
        soup = BeautifulSoup(content_html, 'html.parser')
        
        current_category = "General"
        day_updates = []
        current_html_parts = []
        
        for child in soup.contents:
            if hasattr(child, 'name') and child.name == 'h3':
                if current_html_parts:
                    content_str = "".join(str(c) for c in current_html_parts).strip()
                    if content_str:
                        day_updates.append((current_category, content_str))
                    current_html_parts = []
                current_category = child.get_text().strip()
            else:
                current_html_parts.append(child)
                
        if current_html_parts:
            content_str = "".join(str(c) for c in current_html_parts).strip()
            if content_str:
                day_updates.append((current_category, content_str))
                
        parsed_updates = []
        for update_idx, (cat, html_content) in enumerate(day_updates):
            # Clean text parsing for text-only representation (search, copying, tweeting)
            update_soup = BeautifulSoup(html_content, 'html.parser')
            
            # Format some tags for better text readability before getting text
            # E.g. replace code blocks with quotes or similar if needed
            text_content = update_soup.get_text().strip()
            
            # Clean up whitespace
            text_content = " ".join(text_content.split())
            
            norm_cat = cat.strip()
            if not norm_cat:
                norm_cat = "General"
            
            stats["total_updates"] += 1
            stats["categories"][norm_cat] = stats["categories"].get(norm_cat, 0) + 1
            
            # Unique stable ID
            unique_str = f"{title_text}-{update_idx}-{norm_cat}-{text_content[:30]}"
            update_id = hashlib.md5(unique_str.encode('utf-8')).hexdigest()[:8]
            
            parsed_updates.append({
                "id": f"up-{update_id}",
                "category": norm_cat,
                "content_html": html_content,
                "content_text": text_content
            })
            
        releases.append({
            "day": title_text,
            "updated": updated_text,
            "link": link_href,
            "updates": parsed_updates
        })
        
    CACHE_DATA = {
        "status": "success",
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "stats": stats,
        "releases": releases
    }
    CACHE_TIME = datetime.now()
    return CACHE_DATA

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def api_releases():
    refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        data = fetch_and_parse_feed(bypass_cache=refresh)
        return jsonify(data)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    # Default Flask port is 5000
    app.run(debug=True, host='0.0.0.0', port=5000)
