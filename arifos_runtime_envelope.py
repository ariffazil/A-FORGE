from pydantic import BaseModel, Field
from typing import Literal, List, Optional, Dict, Any
import uuid
import random

# --- 1. Unified Philosophical Corpus (Ingest & Digested) ---

PHILOSOPHICAL_CORPUS = {
    "arifos.init": [
        {"id": "INIT_Q_001", "author": "Lao Tzu", "quote": "A journey of a thousand miles begins with a single step.", "category": "origin_intent", "role": "anchor_beginning"},
        {"id": "INIT_Q_002", "author": "Aristotle", "quote": "Well begun is half done.", "category": "foundation_first", "role": "foundation_before_motion"},
        {"id": "INIT_Q_007", "author": "Michel de Montaigne", "quote": "No wind serves him who addresses his voyage to no certain port.", "category": "boundary_authority", "role": "purpose_before_motion"}
    ],
    "arifos.sense": [
        {"id": "SENSE_Q_001", "author": "W. K. Clifford", "quote": "It is wrong always, everywhere, and for anyone, to believe anything upon insufficient evidence.", "category": "evidence_first", "role": "evidence_threshold_guard"},
        {"id": "SENSE_Q_002", "author": "Richard Feynman", "quote": "The first principle is that you must not fool yourself—and you are the easiest person to fool.", "category": "perception_reality", "role": "anti_self_deception"},
        {"id": "SENSE_Q_004", "author": "Heraclitus", "quote": "No man ever steps in the same river twice.", "category": "temporal_awareness", "role": "time_variance_guard"}
    ],
    "arifos.mind": [
        {"id": "MIND_Q_001", "author": "Richard Feynman", "quote": "The first principle is that you must not fool yourself—and you are the easiest person to fool.", "category": "logic_truth", "role": "anti_self_deception"},
        {"id": "MIND_Q_003", "author": "Socrates", "quote": "I know that I know nothing.", "category": "uncertainty_humility", "role": "humility_cap"},
        {"id": "MIND_Q_007", "author": "Antoine de Saint-Exupéry", "quote": "Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away.", "category": "order_complexity_limits", "role": "anti_bloat"}
    ],
    "arifos.route": [
        {"id": "ROUTE_Q_002", "author": "Sun Tzu", "quote": "He will win who knows when to fight and when not to fight.", "category": "discernment", "role": "lane_restraint"},
        {"id": "ROUTE_Q_004", "author": "Abraham Maslow", "quote": "If the only tool you have is a hammer, you tend to see every problem as a nail.", "category": "fit_for_purpose", "role": "anti_tool_monoculture"},
        {"id": "ROUTE_Q_007", "author": "Seneca", "quote": "When a man does not know what harbor he is making for, no wind is the right wind.", "category": "right_path", "role": "destination_before_lane"}
    ],
    "arifos.memory": [
        {"id": "MEMORY_Q_001", "author": "George Santayana", "quote": "Those who cannot remember the past are condemned to repeat it.", "category": "history_continuity", "role": "continuity_guard"},
        {"id": "MEMORY_Q_002", "author": "Cicero", "quote": "Memory is the treasury and guardian of all things.", "category": "memory_identity", "role": "memory_as_store_of_value"},
        {"id": "MEMORY_Q_008", "author": "Plutarch", "quote": "The mind is not a vessel to be filled but a fire to be kindled.", "category": "selective_retention", "role": "quality_over_quantity"}
    ],
    "arifos.heart": [
        {"id": "HEART_Q_001", "author": "Immanuel Kant", "quote": "Act in such a way that you treat humanity... always as an end and never as a means only.", "category": "human_dignity", "role": "dignity_guard"},
        {"id": "HEART_Q_003", "author": "Hippocrates", "quote": "First, do no harm.", "category": "non_harm", "role": "harm_floor"},
        {"id": "HEART_Q_009", "author": "Maya Angelou", "quote": "People will never forget how you made them feel.", "category": "compassion", "role": "felt_consequence_awareness"}
    ],
    "arifos.ops": [
        {"id": "OPS_Q_001", "author": "Benjamin Franklin", "quote": "Well done is better than well said.", "category": "practice_over_talk", "role": "execution_over_theater"},
        {"id": "OPS_Q_004", "author": "Bruce Lee", "quote": "Do not pray for an easy life, pray for the strength to endure a difficult one.", "category": "resilience_under_load", "role": "load_bearing_resilience"},
        {"id": "OPS_Q_008", "author": "Antoine de Saint-Exupéry", "quote": "Perfection is achieved... when there is nothing left to take away.", "category": "operational_clarity", "role": "lean_operations"}
    ],
    "arifos.judge": [
        {"id": "JUDGE_Q_001", "author": "Montesquieu", "quote": "There is no crueler tyranny than that which is perpetuated under the shield of law...", "category": "justice", "role": "anti_formalized_injustice"},
        {"id": "JUDGE_Q_003", "author": "Lord Acton", "quote": "Power tends to corrupt, and absolute power corrupts absolutely.", "category": "restraint_in_power", "role": "power_humility"},
        {"id": "JUDGE_Q_005", "author": "Oliver Wendell Holmes Jr.", "quote": "The life of the law has not been logic: it has been experience.", "category": "fairness", "role": "lived_consequence_priority"}
    ],
    "arifos.vault": [
        {"id": "VAULT_Q_001", "author": "Cicero", "quote": "Memory is the treasury and guardian of all things.", "category": "truth_record", "role": "record_preservation"},
        {"id": "VAULT_Q_004", "author": "Voltaire", "quote": "Doubt is not a pleasant condition, but certainty is absurd.", "category": "finality_with_humility", "role": "humble_record_finality"},
        {"id": "VAULT_Q_009", "author": "Tacitus", "quote": "Truth is confirmed by inspection and delay; falsehood by haste and uncertainty.", "category": "truth_record", "role": "verification_before_sealing"}
    ],
    "arifos.forge": [
        {"id": "FORGE_Q_001", "author": "Antoine de Saint-Exupéry", "quote": "Perfection is achieved... when there is nothing left to take away.", "category": "craftsmanship", "role": "minimal_strong_form"},
        {"id": "FORGE_Q_003", "author": "Louis Sullivan", "quote": "Form follows function.", "category": "form_and_function", "role": "purpose_shaped_design"},
        {"id": "FORGE_Q_006", "author": "Steve Jobs", "quote": "Design is not just what it looks like and feels like. Design is how it works.", "category": "craftsmanship", "role": "working_artifact_priority"}
    ]
}

# --- 2. State & Envelope Models ---

class Hypothesis(BaseModel):
    id: str = Field(default_factory=lambda: f"H-{uuid.uuid4().hex[:4]}")
    claim: str
    confidence: float = Field(ge=0.0, le=1.0)
    evidence_for: List[str] = []
    evidence_against: List[str] = []
    falsifier: str
    disconfirming_test: Optional[str] = None

class Provenance(BaseModel):
    intelligence_type: Literal["statistical", "embodied", "hybrid"] = "statistical"
    grounding_status: Literal["data-based", "sensor-based", "human-mediated", "ungrounded"] = "human-mediated"
    stakes_model: Literal["none", "simulated", "externalized-to-human", "shared"] = "externalized-to-human"
    confidence_domain: Literal["narrow-task", "broad-context", "ambiguous", "human-judgment-required"] = "ambiguous"
    meaning_source: Literal["human-attributed", "statistical-inference", "ungrounded"] = "statistical-inference"
    human_equivalence_claimed: bool = False

class MindState(BaseModel):
    objective: str
    facts: List[str] = []
    assumptions: List[str] = []
    unknowns: List[str] = []
    hypotheses: List[Hypothesis] = []
    risks: List[str] = []
    contradictions: List[str] = []
    decision_required: bool = False
    provenance: Provenance

class OutputEnvelope(BaseModel):
    # T0/T1: Core Signal (Mandatory)
    status: Literal["OK", "PARTIAL", "HOLD", "ERROR"]
    summary: str
    next_step: str
    human_decision_required: bool
    
    # T2/T3: Governed Metadata (Optional)
    key_facts: Optional[List[str]] = Field(default=None, max_items=3)
    key_uncertainties: Optional[List[str]] = Field(default=None, max_items=3)
    options: Optional[List[str]] = Field(default=None, max_items=3)
    provenance: Optional[Provenance] = None
    philosophical_anchor: Optional[Dict[str, str]] = None
    
    # Humility Lock: Explicit Incompleteness Marker
    uncertainty_score: float = Field(default=0.0, ge=0.0, le=1.0)
    is_complete: bool = False # Workspace Law L10

# --- 3. Metabolic & Selection Functions ---

def compress_for_operator(state: MindState, tool_id: str = "arifos.mind", tier: Literal["T1_LEAN", "T2_GOVERNED", "T3_DEBUG"] = "T2_GOVERNED") -> OutputEnvelope:
    """Wide mind -> Narrow voice. Implements Workspace Law (L7) and Humility Law (L10)."""
    top_hypotheses = sorted(state.hypotheses, key=lambda h: h.confidence, reverse=True)[:2]
    options = [h.claim for h in top_hypotheses]
    summary = top_hypotheses[0].claim if top_hypotheses else "No stable hypothesis available."
    
    status: Literal["OK", "PARTIAL", "HOLD", "ERROR"] = "OK"
    if state.decision_required:
        status = "HOLD"
    elif state.unknowns:
        status = "PARTIAL"
        
    # Humility Calculation: (Unknowns + Risks) / (Facts + Hypotheses)
    uncertainty = min(1.0, (len(state.unknowns) + len(state.risks)) / max(1.0, len(state.facts) + len(state.hypotheses)))

    if tier == "T1_LEAN":
        return OutputEnvelope(
            status=status,
            summary=summary,
            next_step="Proceed with next logical step." if status == "OK" else "Await guidance.",
            human_decision_required=state.decision_required,
            uncertainty_score=uncertainty,
            is_complete=False
        )

    return OutputEnvelope(
        status=status,
        summary=summary,
        key_facts=state.facts[:3],
        key_uncertainties=state.unknowns[:3],
        options=options[:3],
        next_step="Requesting confirmation for the primary hypothesis." if status == "HOLD" else "Proceed with verification.",
        human_decision_required=state.decision_required,
        provenance=state.provenance,
        philosophical_anchor=select_philosophical_anchor(tool_id, state),
        uncertainty_score=uncertainty,
        is_complete=(uncertainty < 0.1 and status == "OK")
    )

# --- 4. Main AGI Runner ---

def sense(raw_input: str) -> dict:
    return {
        "objective": raw_input,
        "facts": ["Input received by system", "User requesting AGI optimization"],
        "assumptions": ["User has authority"],
        "unknowns": ["Context depth"]
    }

def mind(sense_packet: dict) -> List[Hypothesis]:
    return [
        Hypothesis(claim="Optimize via disk cleanup.", confidence=0.85, falsifier="Cache necessity?"),
        Hypothesis(claim="Optimize via parameter tuning.", confidence=0.15, falsifier="Instability risk?")
    ]

def run_agi_mind(raw_input: str) -> OutputEnvelope:
    sensed = sense(raw_input)
    hypotheses = mind(sensed)
    state = MindState(
        objective=sensed["objective"],
        facts=sensed.get("facts", []),
        assumptions=sensed.get("assumptions", []),
        unknowns=sensed.get("unknowns", []),
        hypotheses=hypotheses,
        provenance=Provenance()
    )
    return compress_for_operator(state, "arifos.mind")
