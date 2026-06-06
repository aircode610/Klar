"""SQLModel tables — mirrors DeadlinePivot PRD §7."""

from datetime import date, datetime
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


class DeadlineSource(str, Enum):
    EXPLICIT = "explicit"
    INFERRED = "inferred"
    UNKNOWN = "unknown"


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ActionStatus(str, Enum):
    OPEN = "open"
    DONE = "done"
    IGNORED = "ignored"


class DocumentCategory(str, Enum):
    """Closed vocabulary for letter classification.

    Covers the institutional landscape for both international students and
    working professionals in Germany. Use OTHER only when the letter genuinely
    does not fit any defined bucket.
    """

    HEALTH_INSURANCE = "health_insurance"      # AOK, TK, BARMER, private KV
    OTHER_INSURANCE = "other_insurance"        # Haftpflicht, Hausrat, KFZ, Leben
    BANKING = "banking"                        # bank accounts, credit cards, SCHUFA
    TAX = "tax"                                # Finanzamt
    IMMIGRATION = "immigration"                # Ausländerbehörde, residence/visa
    EDUCATION = "education"                    # universities, BAföG, Studentenwerk
    HOUSING = "housing"                        # landlord, property management
    UTILITIES = "utilities"                    # Strom, Gas, Wasser, Internet, Mobilfunk
    EMPLOYMENT = "employment"                  # Arbeitgeber, HR, Lohn
    GOVERNMENT_BENEFITS = "government_benefits"  # ALG I/II, Kindergeld, Elterngeld, Wohngeld
    PENSION = "pension"                        # Deutsche Rentenversicherung
    BROADCAST_FEE = "broadcast_fee"            # Beitragsservice / Rundfunk
    CIVIC = "civic"                            # Bürgeramt, Personalausweis, Pass
    LEGAL_DEBT = "legal_debt"                  # Mahnbescheid, Inkasso, Bußgeld, Anwalt
    OTHER = "other"


class User(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    email: str = Field(unique=True, index=True)
    timezone: str = "Europe/Berlin"
    calendar_connected: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Letter(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: Optional[UUID] = Field(default=None, foreign_key="user.id", index=True)
    raw_text: str = ""
    file_url: Optional[str] = None
    institution: str = ""
    document_type: str = ""
    category: DocumentCategory = DocumentCategory.OTHER
    summary_en: str = ""
    ocr_confidence: float = 0.0
    extraction_warnings: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ActionItem(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    letter_id: UUID = Field(foreign_key="letter.id", index=True)
    title: str
    description: str = ""
    steps: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    deadline: Optional[date] = None
    deadline_confidence: float = 0.0
    deadline_source: DeadlineSource = DeadlineSource.UNKNOWN
    status: ActionStatus = ActionStatus.OPEN
    severity: Severity = Severity.MEDIUM
    reply_needed: bool = False
    calendar_synced: bool = False
    evidence_span: str = ""


class RiskScore(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    action_item_id: UUID = Field(foreign_key="actionitem.id", index=True)
    score: int = 0
    deadline_proximity_pts: float = 0.0
    institution_weight: float = 0.0
    severity_pts: float = 0.0
    missing_info_penalty: float = 0.0
    explanation: str = ""
    computed_at: datetime = Field(default_factory=datetime.utcnow)


class UserCorrection(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    action_item_id: UUID = Field(foreign_key="actionitem.id", index=True)
    field_name: str
    original_value: str
    corrected_value: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
