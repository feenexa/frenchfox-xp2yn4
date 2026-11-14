#!/usr/bin/env python3
"""Einfacher Server für die App im Heimnetz (zum Entwickeln und Ausprobieren am iPad).

Wie `python3 -m http.server`, aber der Browser darf nichts zwischenspeichern.
So erscheint nach dem Neuladen immer der aktuelle Stand (auch auf dem iPad).

Start:  python3 serve.py          (Port 8080, Ordner app/)
        python3 serve.py 8081     (anderer Port)
"""
import functools
import http.server
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app")


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    with http.server.ThreadingHTTPServer(("0.0.0.0", port), handler) as server:
        print(f"FrenchFox: http://localhost:{port}/  (Ordner {ROOT})")
        server.serve_forever()
