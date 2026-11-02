#!/bin/bash
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required to launch Sky Pirate Volley."
  echo "Install it from https://www.python.org/downloads/ and try again."
  exit 1
fi
exec python3 server.py
