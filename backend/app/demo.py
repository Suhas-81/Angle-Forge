"""Synthetic offline generator for running without an LLM key."""
import re
from app.schemas import Asset, BrandKit, Concept, Persona


def concepts(brand: BrandKit, personas: list[Persona]) -> list[Concept]:
    topics = [
        ('Your Temperature, Your Tempo', 'A sip that keeps pace with a busy day.', 'Pour at 8. Still sipping at 10.'),
        ('Between All Your Stops', 'Comfort for the spaces between plans.', 'Commute. Meeting. Next stop.'),
        ('A Sip Along the Way', 'Bring the routine you like on a changing route.', 'Your day has turns. Your mug comes along.'),
    ]
    angles = {p.id: f"{p.angle_preference} Address: {p.pain_points[0]}" for p in personas}
    return [Concept(id=f'concept-{i+1}', name=n, key_message=m, hook=h, persona_angles=angles)
            for i,(n,m,h) in enumerate(topics)]


def create_asset(brand: BrandKit, persona: Persona, concept: Concept,
                 kind: str, variation: int = 0) -> Asset:
    # Factual marketing claims only come from the user's approved facts.
    facts = brand.product_facts or brand.key_benefits
    fact = facts[variation % len(facts)]
    second = facts[(variation + 2) % len(facts)]
    third = facts[(variation + 3) % len(facts)]
    # Each role has a distinct everyday setting, without adding product claims.
    settings = {
        'professional': ('From the metro to your first meeting', 'Your commute. Your calendar. Your cup.'),
        'student': ('From your first class to the library', 'Classes, notes, and the next study session.'),
        'traveler': ('From an early departure to your next stop', 'A changing route can still have familiar sips.'),
    }
    place, hook = settings.get(persona.id, (f'For your day, {persona.name.split()[0]}', concept.hook))
    if variation % 2:
        place, hook = hook, place
    if kind == 'social':
        text = f"{place}. {brand.product_name}: {fact.lower()}. #{re.sub('[^a-zA-Z0-9]', '', brand.brand_name)}"
        return Asset(type='social', persona_id=persona.id, text=text)

    subject = {
        'professional': 'Your coffee between meetings',
        'student': 'For class, notes, and coffee',
        'traveler': 'For the stops along your route',
    }.get(persona.id, f'A note about {brand.product_name}')
    # Use the approved factual statements exactly; the narrative does not invent a claim.
    body = f"""Hi there,

{place}. A full day has a way of moving from one thing to the next. You want a coffee routine that fits your plans. That's the idea behind {brand.product_name}.

Here are a few details you can check for yourself. {fact.rstrip('.')}. {second.rstrip('.')}. {third.rstrip('.')}.

{hook} You can decide which details matter for your routine, whether you're at your desk, walking between classes, or planning a departure. It's your coffee and your schedule. Take the time to find the fit that works for you.

→ Explore {brand.product_name}

{brand.email_sign_off or '— The ' + brand.brand_name + ' team'}"""
    return Asset(type='email', persona_id=persona.id, subject=subject, text=body)


def score(brand: BrandKit, persona: Persona, asset: Asset, passed: bool) -> tuple[int, str]:
    if not passed:
        return 2, 'Offline heuristic: some exact rules still fail; inspect the listed violations.'
    return 4, 'Offline heuristic only: uses persona context and product information. A live model review is required for subjective brand-fit scoring.'
