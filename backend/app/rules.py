"""Deterministic channel and copy constraints for AngleForge.

Grapheme clusters (regex \\X) count characters as seen by the reader, including emoji.
A CTA is explicitly marked with one standalone line beginning with the arrow ``→``.
Semantic claims and persuasion remain model/human-review responsibilities.
"""
import re
import regex
from app.schemas import Asset, BrandKit, HardCheck


def forbidden_hits(text: str, banned_words: list[str]) -> list[str]:
    found = []
    for banned in banned_words:
        term = banned.strip()
        if term and re.search(r"(?<!\w)" + re.escape(term) + r"(?!\w)", text, flags=re.IGNORECASE):
            found.append(term)
    return found


def visible_chars(text: str) -> int:
    return len(regex.findall(r"\X", text))


def count_hashtags(text: str) -> int:
    return len(re.findall(r"(?<!\w)#[\w]+", text, flags=re.UNICODE))


def count_emoji(text: str) -> int:
    # Count full emoji grapheme sequences, including joined families, once.
    return sum(bool(regex.search(r"\p{Extended_Pictographic}|\p{Regional_Indicator}", cluster))
               for cluster in regex.findall(r"\X", text))


def word_count(text: str) -> int:
    return len(text.split())


def _field(text: str, limit: int, banned_words: list[str], field_name: str,
           hashtag_limit: int | None = None, emoji_limit: int | None = None,
           no_hashtags: bool = False, min_words: int = 0, max_words: int = 0,
           sign_off: str = '', cta_count: int = 0,
           absolute_words: bool = False) -> HardCheck:
    issues: list[str] = []
    if not text.strip():
        issues.append(f"{field_name}: content must not be empty.")
    chars = visible_chars(text)
    if chars > limit:
        issues.append(f"{field_name}: {chars} visible characters exceeds limit {limit}.")
    banned = list(banned_words)
    if absolute_words:
        banned.extend(['never', 'forever', '100%'])
    hits = forbidden_hits(text, banned)
    if hits:
        issues.append(f"{field_name}: banned term(s): {', '.join(dict.fromkeys(hits))}.")
    tags = count_hashtags(text)
    if hashtag_limit is not None and tags > hashtag_limit:
        issues.append(f"{field_name}: {tags} hashtags exceeds limit {hashtag_limit}.")
    if no_hashtags and tags:
        issues.append(f"{field_name}: hashtags are not allowed.")
    if emoji_limit is not None:
        emojis = count_emoji(text)
        if emojis > emoji_limit:
            issues.append(f"{field_name}: {emojis} emojis exceeds limit {emoji_limit}.")
    if min_words or max_words:
        words = word_count(text)
        if min_words and words < min_words:
            issues.append(f"{field_name}: {words} words is below minimum {min_words}.")
        if max_words and words > max_words:
            issues.append(f"{field_name}: {words} words exceeds maximum {max_words}.")
    if sign_off and (not text.strip().endswith(sign_off) or text.strip().splitlines()[-1].strip() != sign_off):
        issues.append(f"{field_name}: must end with exact sign-off: {sign_off}")
    if cta_count:
        # The content contract requires CTAs on clearly marked lines.
        ctas = len(re.findall(r"^\s*→\s+\S", text, flags=re.MULTILINE))
        if ctas != cta_count:
            issues.append(f"{field_name}: requires exactly {cta_count} marked CTA line(s) (→), found {ctas}.")
    return HardCheck(passed=not issues, violations=issues, chars=chars, char_limit=limit,
                     hashtags=tags, hashtag_limit=hashtag_limit or 0)


def validate_asset(asset: Asset, brand: BrandKit) -> dict[str, HardCheck]:
    absolute = bool(brand.claims_policy)
    if asset.type == 'social':
        return {'post': _field(asset.text, brand.social_char_limit, brand.banned_words,
                               'Social post', brand.hashtag_limit, brand.social_emoji_limit,
                               absolute_words=absolute)}
    return {
        'subject': _field(asset.subject, brand.email_subject_limit, brand.banned_words,
                          'Email subject', no_hashtags=not brand.email_hashtags_allowed,
                          absolute_words=absolute),
        'body': _field(asset.text, brand.email_body_limit, brand.banned_words,
                       'Email body', no_hashtags=not brand.email_hashtags_allowed,
                       min_words=brand.email_body_min_words, max_words=brand.email_body_max_words,
                       sign_off=brand.email_sign_off, cta_count=brand.email_cta_count,
                       absolute_words=absolute),
    }


def all_violations(fields: dict[str, HardCheck]) -> list[str]:
    return [violation for result in fields.values() for violation in result.violations]


def demo_repair(asset: Asset, brand: BrandKit) -> Asset:
    """Best-effort deterministic offline repair; every output is revalidated by caller."""
    banned = list(brand.banned_words) + (['never', 'forever', '100%'] if brand.claims_policy else [])

    def remove_bans(value: str) -> str:
        for banned_term in banned:
            if banned_term.strip():
                value = re.sub(r"(?<!\w)" + re.escape(banned_term.strip()) + r"(?!\w)",
                               'fresh', value, flags=re.IGNORECASE)
        return value

    def trim_visible(value: str, limit: int) -> str:
        value = value.strip()
        return ''.join(regex.findall(r"\X", value)[:limit]).rstrip(' ,;:-')

    if asset.type == 'social':
        value = remove_bans(asset.text)
        tags = list(re.finditer(r"(?<!\w)#[\w]+", value, flags=re.UNICODE))
        for match in reversed(tags[brand.hashtag_limit:]):
            value = value[:match.start()] + value[match.end():]
        clusters = regex.findall(r"\X", value)
        used = 0
        kept = []
        for cluster in clusters:
            if regex.search(r"\p{Extended_Pictographic}|\p{Regional_Indicator}", cluster):
                if used >= brand.social_emoji_limit:
                    continue
                used += 1
            kept.append(cluster)
        return asset.model_copy(update={'text': trim_visible(''.join(kept), brand.social_char_limit)})

    subject = trim_visible(remove_bans(asset.subject), brand.email_subject_limit)
    text = remove_bans(asset.text)
    if not brand.email_hashtags_allowed:
        text = re.sub(r"(?<!\w)#[\w]+", '', text)
    if brand.email_sign_off:
        text = text.replace(brand.email_sign_off, '').strip()
    # Remove existing structured CTA lines; add exactly the required count.
    lines = [line for line in text.splitlines() if not line.lstrip().startswith('→')]
    main = '\n'.join(lines).strip()
    if brand.email_body_min_words:
        facts = [remove_bans(x.rstrip(' .') + '.') for x in (brand.product_facts or brand.key_benefits)]
        facts = facts or [f"{brand.product_name} is the product featured in this campaign."]
        ix = 0
        max_attempts = max(2, brand.email_body_min_words)
        while word_count(main) + 9 < brand.email_body_min_words and ix < max_attempts:
            main += '\n\n' + facts[ix % len(facts)]
            ix += 1
    ctas = ["→ Explore the collection" for _ in range(brand.email_cta_count)]
    tail = ([''] + ctas if ctas else []) + (['', brand.email_sign_off] if brand.email_sign_off else [])
    suffix = '\n'.join(tail)
    allowed_words = brand.email_body_max_words - word_count(suffix) if brand.email_body_max_words else 100000
    if word_count(main) > max(0, allowed_words):
        main = ' '.join(main.split()[:max(0, allowed_words)])
    text = main.rstrip() + ('\n\n' if suffix else '') + suffix.strip()
    if visible_chars(text) > brand.email_body_limit:
        # Preserve required sign-off and CTA while removing body prose.
        suffix = ('\n\n' + '\n'.join(ctas) if ctas else '') + ('\n\n' + brand.email_sign_off if brand.email_sign_off else '')
        body_room = max(0, brand.email_body_limit - visible_chars(suffix))
        text = trim_visible(main, body_room) + suffix
    return asset.model_copy(update={'subject': subject, 'text': text.strip()})
