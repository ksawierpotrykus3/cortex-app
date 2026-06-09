// ================================================================
// NEXUS V2 — Local Model Cache Manager (Phase 4.3)
// ================================================================
// Zarządza lokalnym repozytorium modeli ONNX, omijając HuggingFace
// przy każdym restarcie aplikacji. Modele są cachowane w projekcie.
//
// ARCHITEKTURA:
//   - ModelCache sprawdza lokalny katalog models/ przed downloadem
//   - Obsługa braku sieci — nie rzuca błędem, tylko informuje
//   - Weryfikacja integralności przez rozmiar pliku
// ================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ==============================================================
// Konfiguracja
// ==============================================================
const DEFAULT_MODELS_DIR = 'models';

/** Minimalny rozmiar pliku .onnx (w bajtach) — all-MiniLM-L6-v2 ma ~23MB */
const MIN_MODEL_FILE_SIZE = 1_000_000;

// ==============================================================
// Typy
// ==============================================================
export interface ModelFileInfo {
  /** Nazwa modelu */
  name: string;
  /** Pełna ścieżka do pliku .onnx */
  filePath: string;
  /** Rozmiar w bajtach */
  size: number;
  /** Czy plik istnieje i jest kompletny */
  exists: boolean;
}

/**
 * ModelNotFoundError — brak modelu w lokalnym cache
 */
export class ModelNotFoundError extends Error {
  public readonly modelName: string;

  constructor(modelName: string, searchPath: string) {
    super(
      `[MODEL_CACHE] Model '${modelName}' nie znaleziony w lokalnym cache. ` +
      `Szukano w: ${searchPath}. ` +
      `Umieść plik .onnx w katalogu models/ lub skonfiguruj ścieżkę.`
    );
    this.name = 'ModelNotFoundError';
    this.modelName = modelName;
  }
}

/**
 * ModelCache — zarządza lokalnymi plikami modeli ONNX
 *
 * Singleton: modele ładuje się raz, używa wielokrotnie.
 * Jeśli model nie istnieje lokalnie — zwraca błąd zamiast
 * próbować ściągać z HuggingFace (offline-first).
 */
export class ModelCache {
  private readonly modelsDir: string;

  constructor(modelsDir?: string) {
    // ============================================================
    // Rozpoznanie ścieżki: relative do projektu lub absolute
    // ============================================================
    this.modelsDir = modelsDir ?? this._resolveDefaultModelsDir();
  }

  /**
   * getModelPath(modelName) — zwraca ścieżkę do modelu
   *
   * Sprawdza lokalny cache. Jeśli model nie istnieje — rzuca
   * ModelNotFoundError zamiast próbować zdalnego pobrania.
   */
  getModelPath(modelName: string): ModelFileInfo {
    const filePath = path.join(this.modelsDir, modelName);

    try {
      const stat = fs.statSync(filePath);

      if (!stat.isFile()) {
        return {
          name: modelName,
          filePath,
          size: 0,
          exists: false,
        };
      }

      if (stat.size < MIN_MODEL_FILE_SIZE) {
        return {
          name: modelName,
          filePath,
          size: stat.size,
          exists: false,
        };
      }

      return {
        name: modelName,
        filePath,
        size: stat.size,
        exists: true,
      };
    } catch {
      return {
        name: modelName,
        filePath,
        size: 0,
        exists: false,
      };
    }
  }

  /**
   * requireModel(modelName) — jak getModelPath, ale rzuca błędem
   *
   * @throws {ModelNotFoundError} jeśli model nie istnieje lokalnie
   */
  requireModel(modelName: string): ModelFileInfo {
    const info = this.getModelPath(modelName);

    if (!info.exists) {
      throw new ModelNotFoundError(modelName, this.modelsDir);
    }

    return info;
  }

  /**
   * listModels() — lista wszystkich modeli .onnx w cache
   */
  listModels(): ModelFileInfo[] {
    try {
      const files = fs.readdirSync(this.modelsDir);
      const models: ModelFileInfo[] = [];

      for (const file of files) {
        if (file.endsWith('.onnx')) {
          const info = this.getModelPath(file);
          models.push(info);
        }
      }

      return models;
    } catch {
      return [];
    }
  }

  /**
   * getModelsDir() — zwraca ścieżkę do katalogu modeli
   */
  getModelsDir(): string {
    return this.modelsDir;
  }

  /**
   * ensureModelsDir() — upewnia się, że katalog modeli istnieje
   */
  ensureModelsDir(): void {
    try {
      fs.mkdirSync(this.modelsDir, { recursive: true });
    } catch {
      // Ignoruj błędy tworzenia katalogu
    }
  }

  // ============================================================
  // Interna
  // ============================================================

  /**
   * _resolveDefaultModelsDir — znajduje domyślny katalog models/
   *
   * Przeszukuje:
   *   1. process.cwd() + 'models'
   *   2. __dirname + '../../models' (względem src/backend/rag/)
   * Używa pierwszego który istnieje, lub process.cwd() jako domyślny
   */
  private _resolveDefaultModelsDir(): string {
    // Próbuj katalog roboczy
    const cwdModels = path.join(process.cwd(), DEFAULT_MODELS_DIR);
    if (this._dirExists(cwdModels)) {
      return cwdModels;
    }

    // Próbuj względem __dirname (src/backend/rag/ -> ../../models/)
    const relativeModels = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '..', '..', '..', DEFAULT_MODELS_DIR,
    );
    if (this._dirExists(relativeModels)) {
      return relativeModels;
    }

    return cwdModels;
  }

  private _dirExists(dir: string): boolean {
    try {
      return fs.statSync(dir).isDirectory();
    } catch {
      return false;
    }
  }
}
