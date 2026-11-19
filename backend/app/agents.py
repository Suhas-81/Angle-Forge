"""Small, explicit task agents for the AngleForge generation pipeline.

These are *orchestrated task-specific agents*, not autonomous browsing agents.
They share typed contracts and have separate prompts/responsibilities. The
BrandGuardian always runs deterministic Python checks, never delegates exact
rules to the LLM. Synthetic demo mode makes no external AI calls.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field

from app.demo import concepts as offline_concepts, create_asset as offline_asset, score as offline_score
from app.llm import (GeminiClient, generate_concepts, generate_persona_pair,
                     regenerate_piece, repair_piece, score_piece)
from app.rules import all_violations, demo_repair, validate_asset
from app.schemas import (Asset, BrandCheck, BrandKit, CheckedAsset, Concept,
                         Persona)


@dataclass
class AgentRun:
    events: list[dict] = field(default_factory=list)

    def log(self, role: str, action: str, outcome: str = 'complete') -> None:
        self.events.append({'agent': role, 'action': action, 'status': outcome})


class CampaignStrategistAgent:
    name = 'Campaign Strategist'

    async def run(self, ai: GeminiClient | None, brand: BrandKit,
                  personas: list[Persona], trace: AgentRun) -> list[Concept]:
        concepts = offline_concepts(brand, personas) if ai is None else await generate_concepts(ai, brand, personas)
        trace.log(self.name, f'Proposed {len(concepts)} different creative concepts for three audiences')
        return concepts


class PersonaCopywriterAgent:
    name = 'Persona Copywriter'

    async def run(self, ai: GeminiClient | None, brand: BrandKit, persona: Persona,
                  concept: Concept, trace: AgentRun) -> list[Asset]:
        pair = ([offline_asset(brand, persona, concept, kind) for kind in ('social', 'email')]
                if ai is None else await generate_persona_pair(ai, brand, persona, concept))
        trace.log(self.name, f'Created social post and email for {persona.name}')
        return pair

    async def revise(self, ai: GeminiClient | None, brand: BrandKit, persona: Persona,
                     concept: Concept, kind: str, previous: Asset | None,
                     revision: int, trace: AgentRun) -> Asset:
        asset = (offline_asset(brand, persona, concept, kind, revision)
                 if ai is None else await regenerate_piece(ai, brand, persona, concept, kind, previous))
        trace.log(self.name, f'Regenerated {kind} for {persona.name} (revision {revision})')
        return asset


class ContentRefinementAgent:
    name = 'Content Refinement'

    async def run(self, ai: GeminiClient | None, brand: BrandKit, persona: Persona,
                  asset: Asset, issues: list[str], trace: AgentRun) -> Asset:
        fixed = (demo_repair(asset, brand) if ai is None else
                 await repair_piece(ai, brand, persona, asset, issues))
        trace.log(self.name, f'Attempted one repair of {asset.type} for {persona.name}: {len(issues)} violation(s)')
        return fixed


class BrandReviewerAgent:
    name = 'Brand Reviewer'

    def __init__(self) -> None:
        self.refinement = ContentRefinementAgent()

    async def run(self, ai: GeminiClient | None, brand: BrandKit, persona: Persona,
                  asset: Asset, trace: AgentRun) -> CheckedAsset:
        fields = validate_asset(asset, brand)
        violations = all_violations(fields)
        trace.log(self.name, f'Checked exact hard rules for {persona.name} {asset.type}: {len(violations)} violation(s)')
        attempted = bool(violations)
        succeeded = False
        if attempted:
            asset = await self.refinement.run(ai, brand, persona, asset, violations, trace)
            fields = validate_asset(asset, brand)
            violations = all_violations(fields)
            succeeded = not violations
            trace.log(self.name, 'Revalidated repaired content', 'passed' if succeeded else 'needs-review')
        score, reason = (offline_score(brand, persona, asset, not violations) if ai is None
                         else await score_piece(ai, brand, persona, asset))
        trace.log(self.name, f'Evaluated brand voice for {persona.name} {asset.type}: {score}/5',
                  'passed' if not violations else 'needs-review')
        return CheckedAsset(asset=asset, check=BrandCheck(
            passed=not violations, score=score, reason=reason, violations=violations,
            fields=fields, evaluation_mode='demo' if ai is None else 'ai',
            auto_fix_attempted=attempted, auto_fix_succeeded=succeeded))


class AngleForgeOrchestrator:
    """Coordinates typed, narrow-scope agents; no unbounded tool invocation."""
    def __init__(self, demo: bool) -> None:
        self.ai = None if demo else GeminiClient()
        self.strategist = CampaignStrategistAgent()
        self.copywriter = PersonaCopywriterAgent()
        self.reviewer = BrandReviewerAgent()

    async def concepts(self, brand: BrandKit, personas: list[Persona]):
        trace = AgentRun()
        results = await self.strategist.run(self.ai, brand, personas, trace)
        return results, trace.events

    async def generate(self, brand: BrandKit, personas: list[Persona], concept: Concept):
        # Concurrent persona generation, with deterministic resulting order.
        async def build_for(p: Persona):
            local = AgentRun()
            pair = await self.copywriter.run(self.ai, brand, p, concept, local)
            reviewed = await asyncio.gather(*(self.reviewer.run(self.ai, brand, p, asset, local)
                                               for asset in pair))
            return reviewed, local.events
        result = await asyncio.gather(*(build_for(p) for p in personas))
        return [asset for pair, _ in result for asset in pair], [event for _, events in result for event in events]

    async def regenerate(self, brand: BrandKit, persona: Persona, concept: Concept,
                         kind: str, previous: Asset | None, revision: int):
        trace = AgentRun()
        asset = await self.copywriter.revise(self.ai, brand, persona, concept, kind, previous, revision, trace)
        checked = await self.reviewer.run(self.ai, brand, persona, asset, trace)
        return checked, trace.events

    async def recheck(self, brand: BrandKit, personas: list[Persona], assets: list[Asset]):
        trace = AgentRun()
        lookup = {p.id: p for p in personas}
        reviewed = []
        for asset in assets:
            reviewed.append(await self.reviewer.run(self.ai, brand, lookup[asset.persona_id], asset, trace))
        return reviewed, trace.events
