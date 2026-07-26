import os
import sys
import json
import base64
import re
import random
from http.server import SimpleHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
import urllib.request
import html

PORT = 8001
if len(sys.argv) > 1:
    try:
        PORT = int(sys.argv[1])
    except ValueError:
        pass
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(PROJECT_DIR, 'data')
MEDIA_DIR = os.path.join(DATA_DIR, 'media')
DB_FILE = os.path.join(DATA_DIR, 'db.json')
MOODS_FILE = os.path.join(DATA_DIR, 'moods.json')

DEFAULT_MOODS = [
    { "emoji": "😊", "label": "開心" },
    { "emoji": "😌", "label": "平靜" },
    { "emoji": "😴", "label": "疲倦" },
    { "emoji": "🥺", "label": "憂鬱" },
    { "emoji": "😢", "label": "悲傷" },
    { "emoji": "🥱", "label": "疲勞" },
    { "emoji": "😡", "label": "憤怒" },
    { "emoji": "🤩", "label": "興奮" }
]

# Ensure directories exist
os.makedirs(MEDIA_DIR, exist_ok=True)
if not os.path.exists(DB_FILE):
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f)

class AuraWriteHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers so we can access it from phone/other origins
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        # Handle preflight CORS requests
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        if path == '/api/entries':
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            
            try:
                with open(DB_FILE, 'r', encoding='utf-8') as f:
                    entries = json.load(f)
            except Exception as e:
                print("Error reading db.json:", e)
                entries = []
            
            self.wfile.write(json.dumps(entries, ensure_ascii=False).encode('utf-8'))
            return

        if path == '/api/moods':
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            
            moods = DEFAULT_MOODS
            if os.path.exists(MOODS_FILE):
                try:
                    with open(MOODS_FILE, 'r', encoding='utf-8') as f:
                        moods = json.load(f)
                except Exception as e:
                    print("Error reading moods.json:", e)
                    
            self.wfile.write(json.dumps(moods, ensure_ascii=False).encode('utf-8'))
            return

        if path == '/api/link-preview':
            query_params = parse_qs(parsed_url.query)
            target_url = query_params.get('url', [None])[0]
            if not target_url:
                self.send_response(400)
                self.end_headers()
                return
            
            try:
                # Add basic headers to prevent being blocked by some sites
                req = urllib.request.Request(
                    target_url, 
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'}
                )
                with urllib.request.urlopen(req, timeout=3) as response:
                    html_content = response.read().decode('utf-8', errors='ignore')
                    
                    # Regex metadata parsers
                    title_match = re.search(r'<title>(.*?)</title>', html_content, re.IGNORECASE)
                    title = title_match.group(1).strip() if title_match else ""
                    
                    desc_match = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', html_content, re.IGNORECASE)
                    if not desc_match:
                        desc_match = re.search(r'<meta\s+property=["\']og:description["\']\s+content=["\'](.*?)["\']', html_content, re.IGNORECASE)
                    desc = desc_match.group(1).strip() if desc_match else ""
                    
                    image_match = re.search(r'<meta\s+property=["\']og:image["\']\s+content=["\'](.*?)["\']', html_content, re.IGNORECASE)
                    image = image_match.group(1).strip() if image_match else ""
                    
                    # Unescape HTML entities
                    title = html.unescape(title)
                    desc = html.unescape(desc)
                    
                    preview = {
                        "title": title or target_url,
                        "description": desc or "點擊以開啟外部連結",
                        "image": image or ""
                     }
            except Exception as e:
                print(f"Failed to fetch preview for {target_url}: {e}")
                preview = {
                    "title": target_url,
                    "description": "點擊以開啟外部連結",
                    "image": ""
                }
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(preview, ensure_ascii=False).encode('utf-8'))
            return

        # Fallback to serving static files
        super().do_GET()

    def do_POST(self):
        # All data operations are migrated to Supabase. This server only serves static assets.
        self.send_response(410)
        self.end_headers()
        self.wfile.write(b"Obsolete database API endpoint. Migrated to Supabase.")

    def do_DELETE(self):
        self.send_response(410)
        self.end_headers()
        self.wfile.write(b"Obsolete database API endpoint. Migrated to Supabase.")

def run(server_class=HTTPServer, handler_class=AuraWriteHandler):
    server_address = ('', PORT)
    httpd = server_class(server_address, handler_class)
    print(f"Starting AuraWrite API server on port {PORT}...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()

if __name__ == '__main__':
    run()
