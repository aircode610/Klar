from dataclasses import dataclass


@dataclass
class AgentEvent:
    type: str   # "classification", "risk_score", "deadline", "consequence", "error"
    data: dict


@dataclass
class AgentResult:
    ocr_text: str
    letter_type: str
    agency: str
    deadline_date: str | None
    days_remaining: int | None
    consequence: str
    risk_score: int
    risk_label: str
