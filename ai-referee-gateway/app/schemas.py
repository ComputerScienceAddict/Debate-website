from pydantic import BaseModel, Field
from typing import Literal, Optional


DebateRole = Literal["affirmative", "negative"]
Severity = Literal["info", "low", "medium", "high"]


class HealthResponse(BaseModel):
    status: str
    referee_model: str
    fast_model: str


class LiveCheckRequest(BaseModel):
    room_id: str
    speaker_id: str
    speaker_role: DebateRole
    topic: str
    text: str = Field(min_length=1)


class RefereeEvent(BaseModel):
    type: str
    severity: Severity
    message: str
    points_delta: int = 0
    quote: Optional[str] = None


class LiveCheckResponse(BaseModel):
    room_id: str
    speaker_id: str
    events: list[RefereeEvent]


class FinalScoreRequest(BaseModel):
    room_id: str
    topic: str
    debate_format: str = "casual_1v1"
    affirmative_transcript: str
    negative_transcript: str
    affirmative_name: str = "Affirmative"
    negative_name: str = "Negative"


class SideScore(BaseModel):
    logic: int
    evidence: int
    clarity: int
    rebuttal: int
    civility: int
    total: int


class FallacyFinding(BaseModel):
    side: Literal["affirmative", "negative"]
    fallacy: str
    quote: str
    explanation: str
    severity: Severity


class FinalScoreResult(BaseModel):
    winner_recommendation: Literal["affirmative", "negative", "tie"]
    confidence: float
    affirmative: SideScore
    negative: SideScore
    summary: str
    key_moments: list[str]
    fallacies: list[FallacyFinding]
    improvement_tips: dict[str, str]
    referee_notes: list[str]


class FinalScoreResponse(BaseModel):
    room_id: str
    model: str
    result: FinalScoreResult


StanceTriple = Literal["support", "oppose", "neutral"]


class TopicConflict(BaseModel):
    tag_label: str
    stance_a: StanceTriple
    stance_b: StanceTriple


class GenerateTopicRequest(BaseModel):
    room_id: str
    debate_format: str = "casual_1v1"
    user_a_name: str = "Participant A"
    user_b_name: str = "Participant B"
    conflicts: list[TopicConflict] = Field(default_factory=list)


class GeneratedTopicJson(BaseModel):
    topic: str = Field(min_length=1)
    resolution: Optional[str] = None
    rationale: Optional[str] = None


class GenerateTopicResponse(BaseModel):
    room_id: str
    model: str
    topic: str
    resolution: Optional[str] = None
    rationale: Optional[str] = None

