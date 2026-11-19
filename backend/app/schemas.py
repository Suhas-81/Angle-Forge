from typing import Literal
from pydantic import BaseModel, Field, field_validator, model_validator


class BrandKit(BaseModel):
    brand_name: str = Field(min_length=1, max_length=100)
    product_name: str = Field(min_length=1, max_length=100)
    product_description: str = Field(min_length=10, max_length=1800)
    key_benefits: list[str] = Field(min_length=1, max_length=8)
    product_tagline: str = Field(default="", max_length=180)
    product_price: str = Field(default="", max_length=60)
    product_facts: list[str] = Field(default_factory=list, max_length=20)
    claims_policy: str = Field(default="", max_length=1200)
    tone_words: list[str] = Field(default_factory=list, max_length=12)
    mission: str = Field(default="", max_length=700)
    vision: str = Field(default="", max_length=700)
    positioning: str = Field(default="", max_length=700)
    brand_personality: str = Field(default="", max_length=350)
    brand_values: list[str] = Field(default_factory=list, max_length=8)
    brand_dos: list[str] = Field(default_factory=list, max_length=10)
    brand_donts: list[str] = Field(default_factory=list, max_length=10)
    manifesto: str = Field(default="", max_length=1500)
    visual_palette: list[str] = Field(default_factory=list, max_length=6)
    visual_notes: str = Field(default="", max_length=600)
    swot: dict[str, str] = Field(default_factory=dict)
    tone: str = Field(min_length=2, max_length=200)
    example_lines: list[str] = Field(default_factory=list, max_length=8)
    banned_words: list[str] = Field(default_factory=list, max_length=25)
    social_char_limit: int = Field(default=280, ge=40, le=3000)
    hashtag_limit: int = Field(default=2, ge=0, le=20)
    email_subject_limit: int = Field(default=60, ge=12, le=300)
    email_body_limit: int = Field(default=9000, ge=80, le=10000)
    social_emoji_limit: int = Field(default=100, ge=0, le=20)
    email_body_min_words: int = Field(default=0, ge=0, le=1000)
    email_body_max_words: int = Field(default=1000, ge=1, le=2000)
    email_hashtags_allowed: bool = True
    email_cta_count: int = Field(default=0, ge=0, le=3)
    email_sign_off: str = Field(default="", max_length=120)

    @model_validator(mode="after")
    def check_word_range(self):
        if self.email_body_min_words > self.email_body_max_words:
            raise ValueError("Email minimum words must be less than or equal to maximum words")
        return self

    @field_validator("key_benefits", "example_lines", "banned_words", "brand_values", "brand_dos", "brand_donts", "visual_palette", "product_facts", "tone_words")
    @classmethod
    def clean_items(cls, value: list[str]) -> list[str]:
        return [str(v).strip()[:300] for v in value if str(v).strip()]


class Persona(BaseModel):
    id: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    profile: str = Field(min_length=2, max_length=200)
    goal: str = Field(min_length=2, max_length=350)
    pain_points: list[str] = Field(min_length=1, max_length=8)
    angle_preference: str = Field(min_length=2, max_length=300)


    @field_validator("pain_points")
    @classmethod
    def clean_pain_points(cls, items: list[str]) -> list[str]:
        cleaned = [str(x).strip() for x in items if str(x).strip()]
        if not cleaned:
            raise ValueError("Add at least one persona pain point")
        return cleaned


class Concept(BaseModel):
    id: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=2, max_length=150)
    key_message: str = Field(min_length=5, max_length=550)
    hook: str = Field(min_length=5, max_length=550)
    persona_angles: dict[str, str] = Field(default_factory=dict)


class Asset(BaseModel):
    type: Literal["social", "email"]
    persona_id: str
    text: str = ""
    subject: str = ""


class HardCheck(BaseModel):
    passed: bool
    violations: list[str]
    chars: int
    char_limit: int
    hashtags: int = 0
    hashtag_limit: int = 0


class BrandCheck(BaseModel):
    passed: bool
    score: int = Field(ge=1, le=5)
    reason: str
    violations: list[str]
    fields: dict[str, HardCheck]
    evaluation_mode: Literal["ai", "demo"] = "demo"
    auto_fix_attempted: bool = False
    auto_fix_succeeded: bool = False


class CheckedAsset(BaseModel):
    asset: Asset
    check: BrandCheck


class BrandAndPersonas(BaseModel):
    brand: BrandKit
    personas: list[Persona] = Field(min_length=3, max_length=3)


class GenerateRequest(BrandAndPersonas):
    concept: Concept


class RegenerateRequest(GenerateRequest):
    persona_id: str
    asset_type: Literal["social", "email"]
    previous: Asset | None = None
    revision: int = Field(default=1, ge=1, le=100)


class RecheckRequest(GenerateRequest):
    assets: list[Asset] = Field(min_length=1, max_length=6)


class ConceptResponse(BaseModel):
    concepts: list[Concept]
    mode: Literal["ai", "demo"]
    trace: list[dict[str, str]] = Field(default_factory=list)


class GenerateResponse(BaseModel):
    assets: list[CheckedAsset]
    mode: Literal["ai", "demo"]
    trace: list[dict[str, str]] = Field(default_factory=list)
