"""Brewly-spec edge cases introduced in the responsive v3 patch."""
from fastapi.testclient import TestClient
from app.main import app
from app.sample import SAMPLE
from app.schemas import Asset, BrandKit
from app.rules import validate_asset, all_violations, visible_chars, count_emoji, count_hashtags

client=TestClient(app)
BRAND=BrandKit.model_validate(SAMPLE['brand'])


def test_joined_emoji_counts_as_one_visible_character():
    assert visible_chars('👩🏽‍💻') == 1
    assert visible_chars('👨‍👩‍👧‍👦') == 1
    assert count_emoji('👩🏽‍💻 👨‍👩‍👧‍👦') == 2


def test_social_emoji_banned_phrases_and_hashtag_limits():
    a=Asset(persona_id='professional',type='social',text='A revolutionary mug 🌞🎒 #One #Two #Three')
    violations=all_violations(validate_asset(a,BRAND))
    assert any('banned' in x for x in violations)
    assert any('emojis' in x for x in violations)
    assert any('hashtags' in x for x in violations)


def test_email_word_cta_signoff_and_hashtag_policies():
    a=Asset(persona_id='professional',type='email',subject='Hello #Brewly',text='Hi, see this now. #Brewly')
    issues=all_violations(validate_asset(a,BRAND))
    assert any('minimum 80' in x for x in issues)
    assert any('hashtags' in x for x in issues)
    assert any('CTA' in x for x in issues)
    assert any('sign-off' in x for x in issues)


def test_full_offline_workflow_has_six_compliant_brewly_assets():
    resp=client.post('/api/concepts',json=SAMPLE)
    assert resp.status_code == 200, resp.text
    concept=resp.json()['concepts'][0]
    generate=client.post('/api/generate',json={**SAMPLE,'concept':concept})
    assert generate.status_code == 200, generate.text
    assets=generate.json()['assets']
    assert len(assets)==6
    assert all(x['check']['passed'] for x in assets), [x['check']['violations'] for x in assets]
    emails=[x['asset'] for x in assets if x['asset']['type']=='email']
    assert all(80<=len(x['text'].split())<=150 for x in emails)
    assert all(x['text'].strip().endswith(BRAND.email_sign_off) for x in emails)
