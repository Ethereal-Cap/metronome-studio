"""
Apex Metronome Studio - Offline Desktop Launcher
Runs a zero-dependency local HTTP server and opens the offline Metronome App in your browser.
"""

import os
import sys
import webbrowser
import http.server
import socketserver
import threading

PORT = 8520
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class QuietHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def log_message(self, format, *args):
        # Suppress standard HTTP request logging
        pass

def start_server():
    with socketserver.TCPServer(("", PORT), QuietHTTPRequestHandler) as httpd:
        httpd.serve_forever()

if __name__ == '__main__':
    print("=" * 60)
    print("  APEX METRONOME STUDIO - OFFLINE PC LAUNCHER")
    print("=" * 60)
    print(f"Launching Metronome App at: http://localhost:{PORT}/metronome.html")
    print("Press Ctrl+C in this console to exit.")
    print("=" * 60)

    # Start background local web server
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Open local app in browser
    webbrowser.open(f"http://localhost:{PORT}/metronome.html")

    try:
        server_thread.join()
    except KeyboardInterrupt:
        print("\nMetronome Studio closed.")
        sys.exit(0)
