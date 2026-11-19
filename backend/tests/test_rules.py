from app.schemas import Asset, BrandKit
from app.rules import all_violations, count_hashtags, demo_repair, forbidden_hits, validate_asset

BRAND = BrandKit(brand_name="FableCup", product_name="FableCup Mug",
    product_description="A completely invented mug for demonstration purposes.",
    key_benefits=["Portable"], tone="Kind and direct", banned_words=["free", "best ever"],
    social_char_limit=60, hashtag_limit=1, email_subject_limit=25, email_body_limit=80)


def test_banned_words_are_case_insensitive_and_word_bounded():
    assert forbidden_hits("A risk-FREE mug. Best Ever! freedom", BRAND.banned_words) == ["free", "best ever"]
    assert forbidden_hits("freedom", BRAND.banned_words) == []


def test_hashtag_count():
    assert count_hashtags("Visit #MadeUp #Travel and #joy!") == 3


def test_social_hard_rules_are_exact():
    a = Asset(type="social", persona_id="p1", text="Free now #A #B")
    fields = validate_asset(a, BRAND)
    assert not fields["post"].passed
    assert fields["post"].hashtags == 2
    assert len(all_violations(fields)) == 2


def test_email_subject_and_body_validated_separately():
    a = Asset(type="email", persona_id="p1", subject="Best ever!", text="This is free")
    fields = validate_asset(a, BRAND)
    assert set(fields) == {"subject", "body"}
    assert not all(field.passed for field in fields.values())


def test_demo_repair_is_rechecked_and_removes_bans_and_excess_tags():
    a = Asset(type="social", persona_id="p1", text="Free travel #One #Two and the best ever feeling")
    repaired = demo_repair(a, BRAND)
    assert not all_violations(validate_asset(repaired, BRAND))


def test_unicode_character_limit_uses_codepoints():
    assert validate_asset(Asset(type="social", persona_id="p1", text="☕" * 60), BRAND)["post"].passed
    assert not validate_asset(Asset(type="social", persona_id="p1", text="☕" * 61), BRAND)["post"].passed


def test_empty_copy_does_not_pass_hard_validation():
    result = validate_asset(Asset(type='social', persona_id='p1', text='  '), BRAND)
    assert not result['post'].passed
    assert 'empty' in result['post'].violations[0]
