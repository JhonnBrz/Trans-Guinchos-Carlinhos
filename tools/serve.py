"""Local preview server for public/.

Serves the site with the same security headers declared in public/_headers,
so problems with the Content-Security-Policy show up locally before deploy.
Caching is disabled to make edits visible on every reload.

    python3 tools/serve.py            # http://127.0.0.1:5173
    python3 tools/serve.py --port 8080
"""

import argparse
import functools
import http.server
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "public"
HEADERS_FILE = ROOT / "_headers"


def load_headers(path: Path) -> list[tuple[str, str]]:
    """Read the global (/*) block of a Netlify/Cloudflare-style _headers file."""
    headers, in_block = [], False
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if not raw.startswith((" ", "\t")):
            in_block = line == "/*"
            continue
        if in_block and ":" in line:
            name, value = line.split(":", 1)
            headers.append((name.strip(), value.strip()))
    return headers


class Handler(http.server.SimpleHTTPRequestHandler):
    security_headers: list[tuple[str, str]] = []

    def end_headers(self) -> None:
        for name, value in self.security_headers:
            # HSTS and upgrade-insecure-requests only make sense over HTTPS.
            if name == "Strict-Transport-Security":
                continue
            if name == "Content-Security-Policy":
                value = value.replace("; upgrade-insecure-requests", "")
            self.send_header(name, value)
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def list_directory(self, path):  # never expose directory listings
        self.send_error(404)
        return None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--port", type=int, default=5173)
    args = parser.parse_args()

    Handler.security_headers = load_headers(HEADERS_FILE)
    handler = functools.partial(Handler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        print(f"Serving {ROOT} at http://127.0.0.1:{args.port}")
        server.serve_forever()


if __name__ == "__main__":
    main()
