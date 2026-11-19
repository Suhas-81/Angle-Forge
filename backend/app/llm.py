"""LLM layer: five small prompts, one per step, rather than a monolithic prompt."""
import json
import os
import re
from typing import Any

import httpx

from app.schemas import Asset, BrandKit, Concept, Persona


class AIError(Exception):
    pass


class GeminiClient:
    def __init__(self) -> None:
        self.key = os.getenv("GEMINI_API_KEY", "").strip()
        self.model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()

    async def json(self, prompt: str, temperature: float = 0.7) -> Any:
        if not self.key:
            raise AIError("GEMINI_API_KEY is missing. Add it to backend/.env or enable DEMO_MODE=true.")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": temperature,
                                 "maxOutputTokens": 3072},
        }
        try:
            async with httpx.AsyncClient(timeout=65) as client:
                r = await client.post(url, params={"key": self.key}, json=payload)
                r.raise_for_status()
                data = r.json()
            raw = "".join(p.get("text", "") for c in data.get("candidates", [])
                          for p in c.get("content", {}).get("parts", []))
            raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.I)
            return json.loads(raw)
        except httpx.HTTPStatusError as exc:
            try:
                msg = exc.response.json().get("error", {}).get("message", "")
            except Exception:
                msg = ""
            raise AIError(f"Gemini API rejected the request ({exc.response.status_code}). {msg[:350]}") from exc
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            raise AIError(f"Gemini request or JSON parsing failed: {str(exc)[:350]}") from exc


def context(brand: BrandKit) -> str:
    return json.dumps(brand.model_dump(), ensure_ascii=False)


def persona_context(persona: Persona) -> str:
    return json.dumps(persona.model_dump(), ensure_ascii=False)


async def generate_concepts(ai: GeminiClient, brand: BrandKit, personas: list[Persona]) -> list[Concept]:
    prompt = f"""You are a responsible creative strategist. All product/persona data are synthetic.
STEP: CAMPAIGN CONCEPTS ONLY. Generate exactly THREE genuinely distinct marketing concepts.
Do not invent technical specifications, testimonials, pricing, guarantees, or claims not in the brand kit.
Respect tone and banned words; consider each persona's distinct goal and pain points.
Brand kit JSON: {context(brand)}
Three personas JSON: {json.dumps([p.model_dump() for p in personas], ensure_ascii=False)}
Return JSON object {{"concepts":[{{"id":"concept-1","name":"...","key_message":"...",
"hook":"...","persona_angles":{{"persona_id":"distinct angle", "other_id":"..."}}}}, ...]}}.
Use ids concept-1, concept-2, concept-3. Return no Markdown.
"""
    obj = await ai.json(prompt)
    try:
        raw = obj["concepts"]
        if len(raw) != 3:
            raise ValueError("The LLM did not return 3 concepts")
        result = [Concept.model_validate(c) for c in raw]
        for i, c in enumerate(result, 1):
            c.id = f"concept-{i}"
        return result
    except Exception as exc:
        raise AIError(f"Invalid concepts JSON: {exc}") from exc


async def generate_persona_pair(ai: GeminiClient, brand: BrandKit, persona: Persona,
                              concept: Concept) -> list[Asset]:
    prompt = f"""You are an expert brand copywriter. This is synthetic mock marketing data.
STEP: ASSETS FOR ONE PERSONA ONLY. Create ONE social post and ONE email (subject + body).
Make this persona's message specifically address their goal AND a unique pain point. Use angle preference.
Keep distinct positioning, not reworded generic copy. Follow the brand tone and example lines,
without copying them word-for-word. Do NOT invent product features, awards, studies, prices or promises.
Aim safely below all character limits. Social: at most {brand.social_char_limit} characters and
at most {brand.hashtag_limit} hashtags. Email subject <= {brand.email_subject_limit} characters;
email body <= {brand.email_body_limit} visible characters AND {brand.email_body_min_words}-{brand.email_body_max_words} words.
Social: at most {brand.social_emoji_limit} emojis. Email must have exactly {brand.email_cta_count} CTA line(s), each beginning with →.
Email body must end with exact sign-off: {brand.email_sign_off!r}. Email hashtags allowed: {brand.email_hashtags_allowed}.
Use ONLY approved product_facts for factual assertions; honor claims_policy. Avoid banned terms everywhere.
Brand kit JSON: {context(brand)}
Chosen concept JSON: {json.dumps(concept.model_dump(), ensure_ascii=False)}
Persona JSON: {persona_context(persona)}
Return ONLY {{"social":{{"text":"..."}},"email":{{"subject":"...","text":"..."}}}}.
"""
    obj = await ai.json(prompt)
    try:
        return [Asset(type="social", persona_id=persona.id, text=obj["social"]["text"]),
                Asset(type="email", persona_id=persona.id, text=obj["email"]["text"],
                      subject=obj["email"]["subject"])]
    except Exception as exc:
        raise AIError(f"Invalid persona assets JSON: {exc}") from exc


async def regenerate_piece(ai: GeminiClient, brand: BrandKit, persona: Persona,
                           concept: Concept, kind: str, previous: Asset | None) -> Asset:
    prompt = f"""You are a thoughtful brand copywriter. All context is synthetic.
STEP: REGENERATE EXACTLY ONE {kind.upper()} ASSET for the specified persona.
Retain the chosen concept but use a FRESH, persona-specific angle and a new hook.
Address a specific pain point and goal; never just synonym-swap previous copy.
Use brand example lines as tone references. Do not invent unsupported features or claims.
Brand JSON: {context(brand)}
Persona JSON: {persona_context(persona)}
Concept JSON: {json.dumps(concept.model_dump(), ensure_ascii=False)}
Previous asset JSON (avoid repeating): {json.dumps(previous.model_dump() if previous else {}, ensure_ascii=False)}
Hard rules: social max {brand.social_char_limit} chars and {brand.hashtag_limit} hashtags;
email subject max {brand.email_subject_limit} chars; email body {brand.email_body_min_words}-{brand.email_body_max_words} words;
email CTA lines {brand.email_cta_count} (prefix each with →), and exact sign-off {brand.email_sign_off!r}.
Social emoji max {brand.social_emoji_limit}. Use only approved product_facts and respect claims_policy.
Return one JSON object with keys "text" and "subject" (use empty subject for social).
"""
    obj = await ai.json(prompt)
    try:
        return Asset(type=kind, persona_id=persona.id, text=obj["text"],
                     subject=obj.get("subject", "") if kind == "email" else "")
    except Exception as exc:
        raise AIError(f"Invalid regenerated asset JSON: {exc}") from exc


async def repair_piece(ai: GeminiClient, brand: BrandKit, persona: Persona,
                       asset: Asset, failures: list[str]) -> Asset:
    prompt = f"""STEP: ONE-TIME HARD-RULE REPAIR. Fix the EXISTING copy with minimal changes.
All context is synthetic. Preserve distinct persona positioning, genuine brand tone and meaning.
Resolve EACH exact failure. Do not add unsupported product claims.
Brand JSON: {context(brand)}
Persona JSON: {persona_context(persona)}
Asset JSON: {json.dumps(asset.model_dump(), ensure_ascii=False)}
Exact failed rules JSON: {json.dumps(failures, ensure_ascii=False)}
Return ONLY JSON object {{"text":"corrected asset body or post","subject":"corrected email subject or empty"}}.
"""
    obj = await ai.json(prompt, temperature=0.2)
    try:
        return Asset(type=asset.type, persona_id=asset.persona_id,
                     text=obj["text"], subject=obj.get("subject", "") if asset.type == "email" else "")
    except Exception as exc:
        raise AIError(f"Invalid repaired asset JSON: {exc}") from exc


async def score_piece(ai: GeminiClient, brand: BrandKit, persona: Persona,
                      asset: Asset) -> tuple[int, str]:
    prompt = f"""STEP: SUBJECTIVE BRAND-FIT REVIEW ONLY. All data are synthetic.
Judge how well this ONE asset follows tone, stylistic example lines, selected persona goal/pain points,
appropriate channel style and claims accuracy against product_facts / claims_policy.
Explicitly penalize unsupported product facts or unsupported claims. Do NOT check character counts, hashtags, or banned words;
those exact checks are done by code elsewhere. Be discerning.
Brand kit JSON: {context(brand)}
Persona JSON: {persona_context(persona)}
Asset JSON: {json.dumps(asset.model_dump(), ensure_ascii=False)}
Return ONLY JSON {{"score": integer 1 to 5, "reason": "brief specific rationale <= 45 words"}}.
"""
    obj = await ai.json(prompt, temperature=0.1)
    try:
        val = int(obj["score"])
        return max(1, min(5, val)), str(obj["reason"])[:400]
    except Exception as exc:
        raise AIError(f"Invalid score JSON: {exc}") from exc
