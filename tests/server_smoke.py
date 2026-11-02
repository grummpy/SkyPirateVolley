#!/usr/bin/env python3
"""Smoke-test that server.py serves the game and falls forward off a busy port."""

import os
import select
import socket
import subprocess
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVER = os.path.join(ROOT, "server.py")


def wait_for_url(proc, timeout=5):
    deadline = timeout
    chunks = ""
    while deadline > 0:
        ready, _, _ = select.select([proc.stdout], [], [], 0.25)
        deadline -= 0.25
        if not ready:
            if proc.poll() is not None:
                raise RuntimeError(f"server exited {proc.returncode}: {chunks}")
            continue
        line = proc.stdout.readline()
        if not line:
            continue
        chunks += line
        if line.startswith("LISTENING "):
            return line.split()[1].strip()
    raise RuntimeError(f"no LISTENING line: {chunks}")


def fetch(url):
    with urllib.request.urlopen(url, timeout=3) as response:
        return response.status, response.read()


def main():
    held = socket.socket()
    held.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    held.bind(("127.0.0.1", 8820))
    held.listen(1)
    proc = subprocess.Popen(
        [sys.executable, SERVER, "--no-browser", "--port", "8820"],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        url = wait_for_url(proc)
        if url.endswith(":8820") or url.endswith(":8820/"):
            raise SystemExit(f"expected a fallback port, got {url}")
        status, body = fetch(url if url.endswith("/") else url + "/")
        if status != 200 or b"Sky Pirate Volley" not in body or b"src/ui/main.js" not in body:
            raise SystemExit(f"index page failed: {status}")
        js_status, js_body = fetch(url.rstrip("/") + "/src/core/game.js")
        if js_status != 200 or b"createMatch" not in js_body:
            raise SystemExit("core module was not served")
        arcade_status, arcade_body = fetch(url.rstrip("/") + "/arcade.json")
        if arcade_status != 200 or b"skypiratevolley" not in arcade_body:
            raise SystemExit("arcade.json was not served")
        icon_status, icon_body = fetch(url.rstrip("/") + "/assets/icon.jpg")
        if icon_status != 200 or len(icon_body) < 100:
            raise SystemExit("icon was not served")
        print(f"smoke ok {url}")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
        held.close()


if __name__ == "__main__":
    main()
