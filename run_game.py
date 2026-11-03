"""
Astro-Miner Launcher Script
Multimedia Systems Lab — Lab Test 2

This script launches the HTML5 / JavaScript version of Astro-Miner in the
system's default web browser, either via direct file URL or a lightweight HTTP server.
"""

import os
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler, HTTPServer
import threading

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # Keep terminal output clean
        pass

def main():
    print("=" * 60)
    print("  ASTRO-MINER: COSMIC HARVEST — 2D ARCADE GAME")
    print("  Multimedia Systems Lab — Lab Test 2")
    print("=" * 60)
    
    server_address = ('', PORT)
    try:
        httpd = HTTPServer(server_address, QuietHandler)
        server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        server_thread.start()
        url = f"http://localhost:{PORT}/index.html"
        print(f"[+] Local HTTP Server started at: {url}")
        print("[+] Opening game in your default web browser...")
        webbrowser.open(url)
        print("[*] Press Ctrl+C in this terminal when finished.")
        server_thread.join()
    except Exception as e:
        print(f"[*] Note: HTTP server fallback ({e}). Opening index.html directly...")
        index_path = os.path.join(DIRECTORY, "index.html")
        webbrowser.open(f"file://{index_path}")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n[+] Game server stopped. Thank you for playing!")
        sys.exit(0)
