// NVIDIA Key Rotator Proxy v3 — wbudowany w Nexus, zero zależności
// Używa tylko natywnego http + fetch (Node.js 18+)
// Uruchamiany automatycznie przez Electron main/index.ts
// Oraz ręcznie przez run_proxy.bat
// 
// Plik .mjs = always ES module (nie potrzebuje "type": "module" w package.json)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));