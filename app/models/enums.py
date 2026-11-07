from enum import StrEnum


class ItemKind(StrEnum):
    EXPERIENCE = "experience"
    EDUCATION = "education"
    CERTIFICATION = "certification"
    ACHIEVEMENT = "achievement"


class MessageStatus(StrEnum):
    UNREAD = "unread"
    READ = "read"
    ARCHIVED = "archived"


class EmailStatus(StrEnum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    DISABLED = "disabled"


class MediaKind(StrEnum):
    IMAGE = "image"
    CV = "cv"


PROJECT_CATEGORIES = ["agentic-ai", "machine-learning", "deep-learning", "nlp-rag", "computer-vision", "data-science", "backend-apis"]
PROJECT_STATUSES = ["in-development", "local-build", "completed", "deployed", "archived"]
