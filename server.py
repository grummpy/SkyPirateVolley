#!/usr/bin/env python3
"""Local server for Sky Pirate Volley. Binds 127.0.0.1 and falls forward to a free port."""

from __future__ import annotations

import argparse
import json
import os
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        if os.environ.get("SKY_HTTP_LOG"):
            super().log_message(fmt, *args)


def default_port():
    try:
        with open(os.path.join(ROOT, "arcade.json"), encoding="utf-8") as handle:
            return int(json.load(handle).get("port", 8820))
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return 8820


def bind_server(host, start_port):
    last_error = None
    for port in range(start_port, start_port + 30):
        try:
            return ThreadingHTTPServer((host, port), Handler)
        except OSError as exc:
            last_error = exc
    raise SystemExit(f"No free port from {start_port} through {start_port + 29} ({last_error})")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Serve Sky Pirate Volley on localhost.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=None, help="Port to try first. Defaults to arcade.json.")
    parser.add_argument("--no-browser", action="store_true", help="Do not open a browser window.")
    args = parser.parse_args(argv)

    requested = default_port() if args.port is None else args.port
    if requested < 0 or requested > 65535:
        raise SystemExit(f"Invalid port {requested}")
    httpd = bind_server(args.host, requested)
    host, port = httpd.server_address[:2]
    url = f"http://{host}:{port}/"
    print(f"LISTENING {url}", flush=True)
    if port != requested:
        print(f"Port {requested} is busy. Sky Pirate Volley is on {url}", flush=True)
    else:
        print(f"Sky Pirate Volley is running at {url}", flush=True)
    if not args.no_browser:
        try:
            webbrowser.open(url)
        except Exception as exc:  # pragma: no cover - desktop only
            print(f"Open {url} in a browser ({exc})", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.", flush=True)
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
