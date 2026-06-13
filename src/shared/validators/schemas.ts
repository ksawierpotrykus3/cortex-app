// ================================================================
// NEXUS V2 — Zod Guards: Structural Validation Schemas (Phase 5.3)
// ================================================================
// Asercyjne typy Zod dla mutacji agentów i konfiguracji.
// Używane przez DraftZone do walidacji danych przed wysłaniem
// przez IPC do WriteWorkera i dalej do Append-Only DB (Phase 2).
//
// ARCHITEKTURA:
// - AgentMutation: podstawowa mutacja agenta (id + instrukcja)
// - DraftSubmission: pełny formularz korekty RLHF
// - DraftMetadata: metadane korekty (autor, znacznik czasu)
// - Każdy schemat ma .parse() które rzuci ZodError przy błędzie
// - Walidacja po stronie Reacta, PRZED rzutem do IPC
// ================================================================

import { z } from 'zod';
import { ContextConfig } from '../types/schema';

// ============================================================
// Stałe walidacyjne
// ============================================================
const MIN_ID_LENGTH = 3;
const MIN_INSTRUCTION_LENGTH = 10;
const MAX_INSTRUCTION_LENGTH = 100_000; // 100KB max
const MAX_REASONING_LENGTH = 10_000;

// ============================================================
// AgentMutation — podstawowa mutacja agenta
//
// Używana do korekty odpowiedzi pojedynczego agenta.
// id = identyfikator agenta (min 3 znaki)
// instruction = treść korekty (min 10 znaków)
// ============================================================
export const AgentMutation = z.object({
  /** ID agenta — min 3 znaki, tylko dozwolone znaki */
  id: z
    .string()
    .min(MIN_ID_LENGTH, `Agent ID wymaga minimum ${MIN_ID_LENGTH} znaków`)
    .max(128, 'Agent ID nie może przekraczać 128 znaków')
    .regex(
      /^[a-zA-Z0-9_\-:.]+$/,
      'Agent ID może zawierać tylko litery, cyfry, podkreślenia, myślniki, dwukropki i kropki'
    ),

  /** Instrukcja korekty dla agenta — min 10 znaków */
  instruction: z
    .string()
    .min(MIN_INSTRUCTION_LENGTH, `Instrukcja wymaga minimum ${MIN_INSTRUCTION_LENGTH} znaków`)
    .max(MAX_INSTRUCTION_LENGTH, `Instrukcja nie może przekraczać ${MAX_INSTRUCTION_LENGTH} znaków`),
});

// ============================================================
// AgentMutationType — typ wywnioskowany ze schematu
// ============================================================
export type AgentMutationType = z.infer<typeof AgentMutation>;

// ============================================================
// DraftMetadata — metadane korekty RLHF
// ============================================================
export const DraftMetadata = z.object({
  /** Autor korekty (user / system / ai) */
  author: z.enum(['user', 'system', 'ai']).default('user'),

  /** Znacznik czasowy korekty (ISO 8601) */
  timestamp: z.string().datetime().optional(),

  /** ID oryginalnej odpowiedzi agenta (jeśli znane) */
  originalResponseId: z.string().optional(),

  /** ID pipelineu DAG (jeśli korekta dotyczy pipeline'u) */
  pipelineId: z.string().optional(),

  /** Wersja schematu — do przyszłej migracji */
  schemaVersion: z.literal(1).default(1),
});

// ============================================================
// DraftMetadataType — typ wywnioskowany
// ============================================================
export type DraftMetadataType = z.infer<typeof DraftMetadata>;

// ============================================================
// DraftSubmission — pełny formularz korekty RLHF
//
// Łączy mutację agenta z metadanymi i opcjonalnym kontekstem.
// Używany przez DraftZone do walidacji całego formularza przed
// wysłaniem do IPC.
// ============================================================
export const DraftSubmission = z.object({
  /** Mutacja agenta (wymagana) */
  mutation: AgentMutation,

  /** Metadane korekty */
  metadata: DraftMetadata.optional(),

  /** Opcjonalne uzasadnienie korekty — dla RLHF audit trail */
  reasoning: z
    .string()
    .max(MAX_REASONING_LENGTH, `Uzasadnienie nie może przekraczać ${MAX_REASONING_LENGTH} znaków`)
    .optional(),

  /** Opcjonalne tagi kategorii korekty */
  tags: z
    .array(z.string().min(1).max(32))
    .max(10, 'Maksymalnie 10 tagów')
    .optional(),

  /** Czy korekta wymaga zatwierdzenia przez człowieka */
  requiresApproval: z.boolean().default(false),
});

// ============================================================
// DraftSubmissionType — typ wywnioskowany
// ============================================================
export type DraftSubmissionType = z.infer<typeof DraftSubmission>;

// ============================================================
// DraftSubmissionPartial — wersja częściowa (do zapisu wersji roboczej)
// ============================================================
export const DraftSubmissionPartial = DraftSubmission.partial();

// ============================================================
// validateMutation(draftData) — funkcja walidująca
//
// Przyjmuje nieznany obiekt, przepuszcza przez AgentMutation.parse
// i zwraca poprawny typ lub rzuca ZodError.
//
// UŻYCIE W DRAFTZONE:
//   try {
//     const valid = validateMutation(formData);
//     ipcRenderer.send('save-mutation', valid);
//   } catch (err) {
//     if (err instanceof ZodError) {
//       showToast(err.errors.map(e => e.message).join(', '));
//     }
//   }
// ============================================================
export function validateMutation(draftData: unknown): AgentMutationType {
  return AgentMutation.parse(draftData);
}

// ============================================================
// validateSubmission(draftData) — pełna walidacja formularza
// ============================================================
export function validateSubmission(draftData: unknown): DraftSubmissionType {
  return DraftSubmission.parse(draftData);
}

// ============================================================
// validateSubmissionSafe(draftData) — bezpieczna walidacja
// Zwraca { success, data, error } zamiast rzucać.
// ============================================================
export function validateSubmissionSafe(draftData: unknown) {
  const result = DraftSubmission.safeParse(draftData);
  if (result.success) {
    return { success: true as const, data: result.data };
  }
  return { success: false as const, error: result.error };
}

// ============================================================
// Context Config schemas (F6.2)
// ============================================================

// Context Source
export const ContextSourceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string(),
  enabled: z.boolean(),
  config: z.record(z.any()),
});

// Context Config
export const ContextConfigSchema = z.object({
  sources: z.array(ContextSourceSchema).min(1, 'Co najmniej jedno źródło kontekstu'),
  maxTokens: z.number().int().positive('Limit tokenów musi być dodatni').max(131072),
  includeSystemPrompt: z.boolean(),
  customInstructions: z.string().max(5000, 'Instrukcje nie mogą przekraczać 5000 znaków').default(''),
});

export function validateContextConfig(data: unknown): { success: boolean; data?: ContextConfig; error?: string } {
  const result = ContextConfigSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data as ContextConfig };
  return { success: false, error: result.error.errors.map(e => e.message).join('; ') };
}
