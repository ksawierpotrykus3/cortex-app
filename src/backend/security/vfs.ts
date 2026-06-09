// ================================================================
// NEXUS V2 — Nexus Virtual File System (VFS) + ACL (Phase 3.1)
// ================================================================
// CIENKA WARSTWA PROXY — żadnego buforowania plików w RAM.
// Translacja nexus:// URI na rzeczywiste ścieżki Windows z
// walidacją ACL (Default Deny) i ochroną przed Directory Traversal.
//
// ARCHITEKTURA:
// - nexus:// URI → path.resolve + path.normalize → real path
// - ACL: Default Deny — każdy dostęp wymaga jawnego allow tokenu
// - Ochrona przed ../../: path.resolve usuwa wszystkie ../
// - Zerowe buforowanie: każde wywołanie idzie do realnego FS
// ================================================================

import { promises as fs, constants as fsConst } from 'fs';
import path from 'path';

// ==============================================================
// Typy ACL
// ==============================================================
export type AccessRight = 'read' | 'write' | 'delete' | 'execute';

export interface AclEntry {
  /** Unikalny token DAG agenta */
  token: string;
  /** Wirtualna ścieżka (nexus://...) */
  nexusPath: string;
  /** Nadane prawa */
  rights: Set<AccessRight>;
}

export interface AclCheckResult {
  allowed: boolean;
  reason?: string;
}

// ==============================================================
// ForbiddenVfsAccessException — rzucany przy naruszeniu ACL
// ==============================================================
export class ForbiddenVfsAccessException extends Error {
  public readonly nexusPath: string;
  public readonly token: string;
  public readonly resolvedPath: string;

  constructor(nexusPath: string, token: string, resolvedPath: string, reason: string) {
    super(
      `[VFS:FORBIDDEN] Token "${token}" próbuje uzyskać dostęp do "${nexusPath}" → "${resolvedPath}": ${reason}`
    );
    this.name = 'ForbiddenVfsAccessException';
    this.nexusPath = nexusPath;
    this.token = token;
    this.resolvedPath = resolvedPath;
  }
}

// ==============================================================
// VfsMalformedPathException — rzucany przy parsowaniu URI
// ==============================================================
export class VfsMalformedPathException extends Error {
  public readonly nexusPath: string;

  constructor(nexusPath: string, detail: string) {
    super(`[VFS:MALFORMED] "${nexusPath}": ${detail}`);
    this.name = 'VfsMalformedPathException';
    this.nexusPath = nexusPath;
  }
}

// ==============================================================
// Mapa rejestracji: nexus:// → rzeczywista ścieżka na dysku
// ==============================================================
export interface NexusMountPoint {
  /** Nazwa węzła (np. "workflow_logs") */
  node: string;
  /** Rzeczywista ścieżka bezwzględna na dysku */
  realPath: string;
  /** Czy mount point jest read-only */
  readOnly: boolean;
}

// ==============================================================
// NexusVFS — Virtual File System
//
// TLUMACZENIE URI:
//   nexus://workflow_logs/log_01 → C:\Nexus_Workspace\Workflows\log_01
//
// BEZPIECZEŃSTWO:
//   path.resolve usuwa wszystkie ../../ — fizycznie niemożliwe
//   jest wyjście poza zamontowany katalog bez ponownego mounta.
//   Dodatkowo ACL sprawdza token DAG przed każdą operacją.
// ==============================================================
export class NexusVFS {
  /** Mapa mount pointów: node → { realPath, readOnly } */
  private readonly mounts = new Map<string, NexusMountPoint>();

  /** ACL Registry: token → AclEntry[] */
  private readonly aclRegistry = new Map<string, AclEntry[]>();

  /** Bazowa ścieżka workspace (do walidacji mountów) */
  private readonly workspaceBase: string;

  constructor(workspaceBase: string) {
    this.workspaceBase = path.resolve(workspaceBase);
  }

  // ============================================================
  // mount(node, realPath, readOnly) — rejestracja mount pointa
  //
  // Weryfikuje, że realPath znajduje się wewnątrz workspaceBase.
  // Jeśli nie — rzuca błąd (zabezpieczenie przed mountem poza
  // workspace).
  // ============================================================
  public mount(node: string, realPath: string, readOnly = false): void {
    const absolutePath = path.resolve(realPath);

    // ================================================================
    // OCHRONA PRZED MOUNTEM POZA WORKSPACE
    // Weryfikujemy, że realPath znajduje się wewnątrz workspaceBase.
    // Używamy path.relative — jeśli zwraca ścieżkę zaczynającą się
    // od "..", oznacza to próbę mounta poza workspace.
    // ================================================================
    const relative = path.relative(this.workspaceBase, absolutePath);
    if (relative.startsWith('..')) {
      throw new ForbiddenVfsAccessException(
        `mount://${node}`,
        'system',
        absolutePath,
        `Próba zamontowania ścieżki poza workspace: "${absolutePath}" nie znajduje się wewnątrz "${this.workspaceBase}"`
      );
    }

    this.mounts.set(node, {
      node,
      realPath: absolutePath,
      readOnly,
    });
  }

  // ============================================================
  // registerToken(token, nexusPath, rights) — nadanie praw ACL
  // ============================================================
  public registerToken(
    token: string,
    nexusPath: string,
    rights: AccessRight[]
  ): void {
    const existing = this.aclRegistry.get(token) ?? [];
    existing.push({
      token,
      nexusPath,
      rights: new Set(rights),
    });
    this.aclRegistry.set(token, existing);
  }

  // ============================================================
  // revokeToken(token) — odwołanie wszystkich praw tokenu
  // ============================================================
  public revokeToken(token: string): void {
    this.aclRegistry.delete(token);
  }

  // ============================================================
  // resolve(nexusUri) — translacja nexus:// URI na real path
  //
  // 1. Parsuje URI: nexus://node/path/to/file
  // 2. Znajduje mount point dla node
  // 3. path.resolve(mount.realPath, subPath)
  // 4. Weryfikuje, że wynikowa ścieżka jest wewnątrz mounta
  //
  // OCHRONA PRZED DIRECTORY TRAVERSAL:
  //   path.resolve usuwa wszystkie ../../ — to jest pierwsza linia
  //   obrony. Druga linia: weryfikacja, że wynik jest wewnątrz
  //   mount.realPath. Jeśli atakujący spróbuje:
  //     nexus://workflow_logs/../../Windows/System32/config/SAM
  //   → path.resolve = C:\Windows\System32\config\SAM
  //   → relative do mount.realPath zaczyna się od ".."
  //   → błąd!
  // ============================================================
  public resolve(nexusUri: string): { realPath: string; mount: NexusMountPoint } {
    const parsed = this._parseUri(nexusUri);
    const mount = this.mounts.get(parsed.node);

    if (!mount) {
      throw new VfsMalformedPathException(
        nexusUri,
        `Nieznany mount point "${parsed.node}". Dostępne: [${[...this.mounts.keys()].join(', ')}]`
      );
    }

    // path.resolve usuwa wszystkie ../../ — bezpieczne
    const resolvedPath = path.resolve(mount.realPath, parsed.subPath);

    // ================================================================
    // OCHRONA: sprawdź czy resolvedPath jest wewnątrz mount.realPath
    // ================================================================
    const relativeToMount = path.relative(mount.realPath, resolvedPath);
    if (relativeToMount.startsWith('..')) {
      throw new ForbiddenVfsAccessException(
        nexusUri,
        'system',
        resolvedPath,
        `Directory Traversal wykryty: "${resolvedPath}" wychodzi poza mount "${mount.realPath}"`
      );
    }

    return { realPath: resolvedPath, mount };
  }

  // ============================================================
  // checkAcl(token, nexusUri, requiredRight) — Default Deny ACL
  //
  // POLITYKA DEFAULT DENY:
  // Jeśli token nie ma jawnie nadanego prawa do ścieżki → DENY.
  // Jeśli token ma prawo ale ścieżka nie pasuje → DENY.
  // Jeśli nexusUri zawiera ../../ → DENY (z ForbiddenVfsAccessException).
  //
  // Sprawdzanie praw:
  //   1. Dla każdego AclEntry tokenu sprawdź czy nexusUri pasuje
  //      do nexusPath (prefix match).
  //   2. Jeśli pasuje — sprawdź czy requiredRight jest w rights.
  //   3. Jeśli nie ma żadnego pasującego entry → DENY.
  // ============================================================
  public checkAcl(
    token: string,
    nexusUri: string,
    requiredRight: AccessRight
  ): AclCheckResult {
    // Najpierw znormalizuj nexusUri (usuń trailing slash itp.)
    const normalizedUri = nexusUri.replace(/\/+$/, '');

    // Sprawdź najpierw czy URI jest poprawny — wywołanie resolve
    // rzuci VfsMalformedPathException jeśli mount point nie istnieje
    // lub ForbiddenVfsAccessException jeśli traversal.
    try {
      this.resolve(normalizedUri);
    } catch (err) {
      if (
        err instanceof ForbiddenVfsAccessException ||
        err instanceof VfsMalformedPathException
      ) {
        throw err;
      }
      throw err;
    }

    const entries = this.aclRegistry.get(token);
    if (!entries || entries.length === 0) {
      return {
        allowed: false,
        reason: `Token "${token}" nie ma żadnych praw dostępu (Default Deny)`,
      };
    }

    // Sprawdź czy któryś z entry pasuje do URI i ma wymagane prawo
    for (const entry of entries) {
      // Prefix match: nexus://workflow_logs pasuje do nexus://workflow_logs/log_01
      if (normalizedUri.startsWith(entry.nexusPath)) {
        if (entry.rights.has(requiredRight)) {
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: `Token "${token}" ma dostęp do "${entry.nexusPath}" ale brak prawa "${requiredRight}"`,
        };
      }
    }

    return {
      allowed: false,
      reason: `Token "${token}" nie ma dostępu do "${normalizedUri}" (Default Deny)`,
    };
  }

  // ============================================================
  // readFile(token, nexusUri) — odczyt pliku przez VFS
  //
  // 1. ACL check (read)
  // 2. resolve URI → realPath
  // 3. fs.readFile(realPath)
  //
  // UWAGA: To jest cienkie proxy — nie buforujemy w RAM.
  // Każde wywołanie idzie do realnego FS.
  // ============================================================
  public async readFile(
    token: string,
    nexusUri: string
  ): Promise<Buffer> {
    const acl = this.checkAcl(token, nexusUri, 'read');
    if (!acl.allowed) {
      throw new ForbiddenVfsAccessException(
        nexusUri,
        token,
        '(not resolved)',
        acl.reason ?? 'Brak prawa odczytu (Default Deny)'
      );
    }

    const { realPath } = this.resolve(nexusUri);

    try {
      return await fs.readFile(realPath);
    } catch (err: unknown) {
      if (err instanceof ForbiddenVfsAccessException) throw err;
      if (err instanceof VfsMalformedPathException) throw err;
      throw new ForbiddenVfsAccessException(
        nexusUri,
        token,
        realPath,
        `Błąd odczytu pliku: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // ============================================================
  // writeFile(token, nexusUri, data) — zapis pliku przez VFS
  // ============================================================
  public async writeFile(
    token: string,
    nexusUri: string,
    data: string | Buffer
  ): Promise<void> {
    const acl = this.checkAcl(token, nexusUri, 'write');
    if (!acl.allowed) {
      throw new ForbiddenVfsAccessException(
        nexusUri,
        token,
        '(not resolved)',
        acl.reason ?? 'Brak prawa zapisu (Default Deny)'
      );
    }

    const { realPath, mount } = this.resolve(nexusUri);

    if (mount.readOnly) {
      throw new ForbiddenVfsAccessException(
        nexusUri,
        token,
        realPath,
        'Mount point jest read-only'
      );
    }

    try {
      await fs.writeFile(realPath, data, { encoding: typeof data === 'string' ? 'utf8' : undefined });
    } catch (err: unknown) {
      if (err instanceof ForbiddenVfsAccessException) throw err;
      if (err instanceof VfsMalformedPathException) throw err;
      throw new ForbiddenVfsAccessException(
        nexusUri,
        token,
        realPath,
        `Błąd zapisu pliku: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // ============================================================
  // deleteFile(token, nexusUri) — usunięcie pliku przez VFS
  // ============================================================
  public async deleteFile(
    token: string,
    nexusUri: string
  ): Promise<void> {
    const acl = this.checkAcl(token, nexusUri, 'delete');
    if (!acl.allowed) {
      throw new ForbiddenVfsAccessException(
        nexusUri,
        token,
        '(not resolved)',
        acl.reason ?? 'Brak prawa usunięcia (Default Deny)'
      );
    }

    const { realPath, mount } = this.resolve(nexusUri);

    if (mount.readOnly) {
      throw new ForbiddenVfsAccessException(
        nexusUri,
        token,
        realPath,
        'Mount point jest read-only'
      );
    }

    try {
      await fs.unlink(realPath);
    } catch (err: unknown) {
      if (err instanceof ForbiddenVfsAccessException) throw err;
      if (err instanceof VfsMalformedPathException) throw err;
      throw new ForbiddenVfsAccessException(
        nexusUri,
        token,
        realPath,
        `Błąd usunięcia pliku: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // ============================================================
  // stat(token, nexusUri) — informacje o pliku
  // ============================================================
  public async stat(
    token: string,
    nexusUri: string
  ): Promise<{ size: number; isDirectory: boolean; modifiedTime: Date }> {
    const acl = this.checkAcl(token, nexusUri, 'read');
    if (!acl.allowed) {
      throw new ForbiddenVfsAccessException(
        nexusUri,
        token,
        '(not resolved)',
        acl.reason ?? 'Brak prawa odczytu (Default Deny)'
      );
    }

    const { realPath } = this.resolve(nexusUri);
    const stat = await fs.stat(realPath);

    return {
      size: stat.size,
      isDirectory: stat.isDirectory(),
      modifiedTime: stat.mtime,
    };
  }

  // ============================================================
  // readdir(token, nexusUri) — lista plików w katalogu
  // ============================================================
  public async readdir(
    token: string,
    nexusUri: string
  ): Promise<string[]> {
    const acl = this.checkAcl(token, nexusUri, 'read');
    if (!acl.allowed) {
      throw new ForbiddenVfsAccessException(
        nexusUri,
        token,
        '(not resolved)',
        acl.reason ?? 'Brak prawa odczytu (Default Deny)'
      );
    }

    const { realPath } = this.resolve(nexusUri);
    return fs.readdir(realPath);
  }

  // ============================================================
  // exists(token, nexusUri) — sprawdzenie czy plik istnieje
  // ============================================================
  public async exists(
    token: string,
    nexusUri: string
  ): Promise<boolean> {
    const acl = this.checkAcl(token, nexusUri, 'read');
    if (!acl.allowed) return false;

    try {
      const { realPath } = this.resolve(nexusUri);
      await fs.access(realPath, fsConst.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================
  // getRegisteredTokens() — lista wszystkich tokenów ACL
  // ============================================================
  public getRegisteredTokens(): string[] {
    return [...this.aclRegistry.keys()];
  }

  // ============================================================
  // getAclEntries(token) — lista entry ACL dla tokenu
  // ============================================================
  public getAclEntries(token: string): AclEntry[] {
    return this.aclRegistry.get(token) ?? [];
  }

  // ============================================================
  // _parseUri(nexusUri) — wewnętrzny parser URI
  //
  // Format: nexus://node/path/to/file
  // Zwraca: { node, subPath }
  //
  // Walidacja:
  //   - nexus:// musi być prefixem
  //   - node może zawierać tylko [a-zA-Z0-9_-]
  //   - subPath jest normalizowany przez path.resolve
  // ============================================================
  private _parseUri(nexusUri: string): { node: string; subPath: string } {
    if (typeof nexusUri !== 'string') {
      throw new VfsMalformedPathException(
        String(nexusUri),
        'URI musi być stringiem'
      );
    }

    if (!nexusUri.startsWith('nexus://')) {
      throw new VfsMalformedPathException(
        nexusUri,
        'URI musi zaczynać się od "nexus://"'
      );
    }

    // Usuń nexus://
    const rest = nexusUri.slice('nexus://'.length);

    // Pierwszy segment to node
    const firstSlash = rest.indexOf('/');
    const node = firstSlash === -1 ? rest : rest.slice(0, firstSlash);
    const subPath = firstSlash === -1 ? '' : rest.slice(firstSlash + 1);

    if (!node) {
      throw new VfsMalformedPathException(
        nexusUri,
        'Brak nazwy mount pointa. Format: nexus://node/path'
      );
    }

    // Walidacja: node tylko [a-zA-Z0-9_-]
    if (!/^[a-zA-Z0-9_-]+$/.test(node)) {
      throw new VfsMalformedPathException(
        nexusUri,
        `Nazwa mount pointa "${node}" zawiera niedozwolone znaki. Dozwolone: [a-zA-Z0-9_-]`
      );
    }

    return { node, subPath };
  }
}
