import os
os.environ["DEMO_MODE"] = "true"
from fastapi.testclient import TestClient
from app.main import app
from app.sample import SAMPLE

client = TestClient(app)


def test_complete_journey_and_changed_rule():
    base = SAMPLE
    r = client.post("/api/concepts", json=base)
    assert r.status_code == 200, r.text
    concepts = r.json()["concepts"]
    assert len(concepts) == 3
    body = {**base, "concept": concepts[0]}
    generated = client.post("/api/generate", json=body)
    assert generated.status_code == 200, generated.text
    assets = generated.json()["assets"]
    assert len(assets) == 6
    assert all(a["check"]["passed"] for a in assets), assets
    new_brand = {**base["brand"], "banned_words": ["coffee", "comfort", "perfect"]}
    rechecked = client.post("/api/recheck", json={**body, "brand": new_brand,
        "assets": [a["asset"] for a in assets]})
    assert rechecked.status_code == 200, rechecked.text
    assert len(rechecked.json()["assets"]) == 6
    piece = client.post("/api/regenerate", json={**body, "persona_id": base["personas"][0]["id"],
        "asset_type": "social", "previous": assets[0]["asset"], "revision": 1})
    assert piece.status_code == 200, piece.text
    assert piece.json()["asset"]["type"] == "social"


def test_agents_endpoint_and_trace():
    agent_data = client.get('/api/agents').json()
    assert len(agent_data['agents']) == 4
    result = client.post('/api/concepts', json=SAMPLE)
    assert result.status_code == 200
    assert result.json()['trace'][0]['agent'] == 'Campaign Strategist'
    generation = client.post('/api/generate', json={**SAMPLE, 'concept': result.json()['concepts'][0]})
    assert generation.status_code == 200
    names = {v['agent'] for v in generation.json()['trace']}
    assert 'Persona Copywriter' in names
    assert 'Brand Reviewer' in names


def test_invalid_persona_recheck_returns_422():
    concept = client.post('/api/concepts', json=SAMPLE).json()['concepts'][0]
    invalid = client.post('/api/recheck', json={**SAMPLE, 'concept': concept,
        'assets': [{'type':'social', 'persona_id':'not-a-persona', 'text':'hello'}]})
    assert invalid.status_code == 422


def test_changed_banned_word_triggers_one_repair():
    concept = client.post('/api/concepts', json=SAMPLE).json()['concepts'][0]
    output = client.post('/api/generate', json={**SAMPLE, 'concept': concept}).json()['assets']
    # A product word is used in at least one synthetic asset.
    rule = {**SAMPLE['brand'], 'banned_words': ['mug']}
    reply = client.post('/api/recheck', json={**SAMPLE, 'brand': rule, 'concept': concept,
        'assets': [v['asset'] for v in output]})
    assert reply.status_code == 200, reply.text
    data = reply.json()
    assert len(data['assets']) == 6
    assert any(a['check']['auto_fix_attempted'] for a in data['assets'])
    assert any(v['agent'] == 'Content Refinement' for v in data['trace'])
    assert all(a['check']['passed'] for a in data['assets'])
