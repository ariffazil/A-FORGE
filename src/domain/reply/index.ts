/**
 * reply/ — Agent Reply Forgery: 9-Mode Modular Reply System
 *
 * @module reply
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

export {
  forgeReply,
  forgeHealth,
  forgeIncident,
  forgeProposal,
  forgeEscalate,
  forgeDeny,
  forgeAudit,
  forgeVault999Hash,
  detectReplyMode,
  formatByModality,
  REPLY_MODE,
  CONFIDENCE_LEVELS,
  VERDICT_FLOOR_MAP,
  floorToPublic,
  type ReplyMode,
  type ReplyVerdict,
  type ReplyConfidence,
  type ReplyRecipient,
  type ReplyCC,
  type ReplyContext,
  type ForgeStructuredOutput,
  type FormattedContent,
  type ContentModality,
} from "./reply_forge.js";
