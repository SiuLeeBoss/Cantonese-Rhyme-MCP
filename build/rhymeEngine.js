import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ToJyutping from "to-jyutping";
const INITIALS = [
    "gw",
    "kw",
    "ng",
    "b",
    "p",
    "m",
    "f",
    "d",
    "t",
    "n",
    "l",
    "g",
    "k",
    "h",
    "w",
    "z",
    "c",
    "s",
    "j"
];
const GROUP_OVERRIDES = {
    a: "aa",
    an: "aan",
    ang: "aang",
    e: "e",
    o: "o"
};
const WIDE_FINAL_GROUPS = [
    ["am", "an"],
    ["aam", "aan"],
    ["im", "in"],
    ["em", "en"],
    ["om", "on"],
    ["ing", "eng"],
    ["ik", "ek"]
];
const WIDE_FINAL_EQUIV = Object.fromEntries(WIDE_FINAL_GROUPS.flatMap((group) => group.map((f) => [f, group])));
function stripTrailingPunctuation(input) {
    return input.replace(/[ \t\r\n,.;:!?'"“”‘’（）()「」【】\[\]，。；：！？、…]+$/u, "").trim();
}
function lastSyllableFromJyutping(jyutping) {
    const trimmed = jyutping.trim();
    if (!trimmed)
        return null;
    const parts = trimmed.split(/\s+/);
    return parts[parts.length - 1] ?? null;
}
function splitInitialFinalTone(syllable) {
    const m = syllable.match(/^([a-z]+)([1-6])$/);
    if (!m)
        return null;
    const letters = m[1];
    const tone = m[2];
    const initial = INITIALS.find((i) => letters.startsWith(i)) ?? "";
    const final = letters.slice(initial.length);
    if (!final)
        return null;
    return { initial, final, tone };
}
function normalizeGroup(final) {
    return GROUP_OVERRIDES[final] ?? final;
}
function buildRhymeKeys(final, tone) {
    return {
        final,
        finalTone: `${final}${tone}`,
        group: normalizeGroup(final)
    };
}
function toneClassOf(tone) {
    if (tone === "1" || tone === "4")
        return "level";
    if (tone === "2" || tone === "5")
        return "rising";
    if (tone === "3" || tone === "6")
        return "departing";
    return null;
}
function normalizeTone(input) {
    if (typeof input === "number" && Number.isFinite(input))
        return String(input);
    if (typeof input === "string" && input.trim())
        return input.trim();
    return null;
}
function cjkChars(input) {
    const matches = input.match(/[\p{Script=Han}]/gu);
    return matches ?? [];
}
function isParticleLike(text) {
    const chars = Array.from(text);
    if (chars.length === 0 || chars.length > 2)
        return false;
    const set = new Set(["囉", "喎", "㗎", "呀", "啊", "吖", "啦", "喇", "嘛", "呢", "啫", "啩", "咯", "喔"]);
    return chars.every((c) => set.has(c));
}
function contextBonus(context, keywords, candidateText) {
    let bonus = 0;
    const trimmed = (context ?? "").trim();
    if (trimmed) {
        const set = new Set(cjkChars(trimmed));
        for (const ch of candidateText) {
            if (set.has(ch))
                bonus += 1;
        }
    }
    const ks = (keywords ?? []).map((k) => k.trim()).filter(Boolean);
    for (const k of ks) {
        if (candidateText.includes(k))
            bonus += 5;
    }
    return bonus;
}
function wideFinals(final) {
    return WIDE_FINAL_EQUIV[final] ?? [final];
}
function loadDictJson(dictPath) {
    const raw = fs.readFileSync(dictPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Invalid dict.json format");
    }
    return parsed;
}
export class CantoneseRhymeEngine {
    dict;
    keysByLengthDesc;
    maxKeyLen;
    indexFinal;
    indexFinalTone;
    indexGroup;
    dynamicIndexFinal;
    dynamicIndexFinalTone;
    dynamicIndexGroup;
    dynamicSeen;
    learnedChars;
    jyutpingCandidatesCache;
    constructor(options = {}) {
        const moduleDir = path.dirname(fileURLToPath(import.meta.url));
        const defaultDictPath = path.join(moduleDir, "..", "data", "dict.json");
        const dictPath = options.dictPath ?? process.env.CANTO_RHYME_DICT ?? defaultDictPath;
        this.dict = loadDictJson(dictPath);
        const keys = Object.keys(this.dict);
        this.maxKeyLen = keys.reduce((m, k) => Math.max(m, k.length), 1);
        this.keysByLengthDesc = keys.sort((a, b) => b.length - a.length);
        this.indexFinal = new Map();
        this.indexFinalTone = new Map();
        this.indexGroup = new Map();
        this.dynamicIndexFinal = new Map();
        this.dynamicIndexFinalTone = new Map();
        this.dynamicIndexGroup = new Map();
        this.dynamicSeen = new Set();
        this.learnedChars = new Set();
        this.jyutpingCandidatesCache = new Map();
        for (const text of keys) {
            const readings = this.dict[text] ?? [];
            for (const jyutping of readings) {
                const last = lastSyllableFromJyutping(jyutping);
                if (!last)
                    continue;
                const split = splitInitialFinalTone(last);
                if (!split)
                    continue;
                const rhymeKeys = buildRhymeKeys(split.final, split.tone);
                const candidate = {
                    text,
                    jyutping,
                    lastSyllable: last,
                    final: split.final,
                    tone: split.tone,
                    rhymeKeys
                };
                this.pushIndex(this.indexFinal, rhymeKeys.final, candidate);
                this.pushIndex(this.indexFinalTone, rhymeKeys.finalTone, candidate);
                this.pushIndex(this.indexGroup, rhymeKeys.group, candidate);
            }
        }
    }
    pushIndex(map, key, candidate) {
        const existing = map.get(key);
        if (existing) {
            existing.push(candidate);
            return;
        }
        map.set(key, [candidate]);
    }
    analyzeTextEnd(text) {
        const stripped = stripTrailingPunctuation(text);
        if (!stripped) {
            return {
                normalizedText: "",
                matchedText: null,
                matchedJyutping: null,
                lastSyllable: null,
                initial: null,
                final: null,
                tone: null,
                rhymeKeys: null,
                unmatchedTail: null
            };
        }
        const match = this.matchLongestAtEnd(stripped);
        if (!match) {
            const fallback = this.analyzeEndByToJyutping(stripped);
            if (fallback)
                return fallback;
            return {
                normalizedText: stripped,
                matchedText: null,
                matchedJyutping: null,
                lastSyllable: null,
                initial: null,
                final: null,
                tone: null,
                rhymeKeys: null,
                unmatchedTail: stripped.slice(-Math.min(4, stripped.length)) || null
            };
        }
        const last = lastSyllableFromJyutping(match.jyutping);
        const split = last ? splitInitialFinalTone(last) : null;
        if (!last || !split) {
            const dictResult = {
                normalizedText: stripped,
                matchedText: match.text,
                matchedJyutping: match.jyutping,
                lastSyllable: last,
                initial: null,
                final: null,
                tone: null,
                rhymeKeys: null,
                unmatchedTail: null
            };
            if ((match.text?.length ?? 0) < 2) {
                const fallback = this.analyzeEndByToJyutping(stripped);
                if (fallback && (fallback.matchedText?.length ?? 0) > (dictResult.matchedText?.length ?? 0))
                    return fallback;
            }
            return dictResult;
        }
        const dictResult = {
            normalizedText: stripped,
            matchedText: match.text,
            matchedJyutping: match.jyutping,
            lastSyllable: last,
            initial: split.initial,
            final: split.final,
            tone: split.tone,
            rhymeKeys: buildRhymeKeys(split.final, split.tone),
            unmatchedTail: null
        };
        if ((match.text?.length ?? 0) < 2) {
            const fallback = this.analyzeEndByToJyutping(stripped);
            if (fallback && (fallback.matchedText?.length ?? 0) > (dictResult.matchedText?.length ?? 0))
                return fallback;
        }
        return dictResult;
    }
    learnFromText(text) {
        const chars = cjkChars(text);
        for (const ch of chars) {
            if (this.learnedChars.has(ch))
                continue;
            this.learnedChars.add(ch);
            const cached = this.jyutpingCandidatesCache.get(ch);
            const readings = cached ?? (ToJyutping.getJyutpingCandidates(ch)[0]?.[1] ?? []);
            if (!cached)
                this.jyutpingCandidatesCache.set(ch, readings);
            for (const jyutping of readings) {
                const last = lastSyllableFromJyutping(jyutping);
                if (!last)
                    continue;
                const split = splitInitialFinalTone(last);
                if (!split)
                    continue;
                const rhymeKeys = buildRhymeKeys(split.final, split.tone);
                const candidate = {
                    text: ch,
                    jyutping,
                    lastSyllable: last,
                    final: split.final,
                    tone: split.tone,
                    rhymeKeys
                };
                this.addDynamic(candidate);
            }
        }
    }
    rhymeCandidates(args) {
        const limit = Math.max(1, Math.min(args.limit ?? 30, 200));
        const exclude = new Set((args.excludeTexts ?? []).filter(Boolean));
        const base = this.getCandidatesForKey(args.strictness, args.rhymeKey);
        const filtered = base.filter((c) => !exclude.has(c.text));
        const tone = normalizeTone(args.tone);
        const toneSet = new Set((args.tones ?? []).map(normalizeTone).filter(Boolean));
        const toneClass = args.toneClass ?? null;
        const afterTone = filtered.filter((c) => {
            if (tone && c.tone !== tone)
                return false;
            if (toneSet.size > 0 && !toneSet.has(c.tone))
                return false;
            if (toneClass) {
                const tc = toneClassOf(c.tone);
                if (!tc || tc !== toneClass)
                    return false;
            }
            return true;
        });
        const preferredLen = args.preferredCharLength;
        const preferStyle = args.preferStyle ?? "balanced";
        const scored = afterTone
            .map((c) => {
            const lenPenalty = preferredLen && preferredLen > 0 ? Math.abs(c.text.length - preferredLen) * 2 : 0;
            const bonus = contextBonus(args.context, args.contextKeywords, c.text);
            const particle = isParticleLike(c.text);
            const styleBonus = preferStyle === "particle"
                ? particle
                    ? 6
                    : -2
                : preferStyle === "content"
                    ? particle
                        ? -6
                        : 2
                    : particle
                        ? -1
                        : 1;
            return { c, score: bonus + styleBonus - lenPenalty };
        })
            .sort((a, b) => b.score - a.score || a.c.text.length - b.c.text.length);
        return scored.slice(0, limit).map((s) => s.c);
    }
    addDynamic(candidate) {
        const key = `${candidate.text}__${candidate.jyutping}`;
        if (this.dynamicSeen.has(key))
            return;
        this.dynamicSeen.add(key);
        this.pushIndex(this.dynamicIndexFinal, candidate.rhymeKeys.final, candidate);
        this.pushIndex(this.dynamicIndexFinalTone, candidate.rhymeKeys.finalTone, candidate);
        this.pushIndex(this.dynamicIndexGroup, candidate.rhymeKeys.group, candidate);
    }
    getCandidatesForKey(strictness, rhymeKey) {
        if (strictness === "wide")
            return this.collectWideCandidatesMerged(rhymeKey);
        const a = (this.getIndex(strictness).get(rhymeKey) ?? []).slice();
        const b = (this.getDynamicIndex(strictness).get(rhymeKey) ?? []).slice();
        return this.mergeCandidates(a, b);
    }
    getIndex(strictness) {
        if (strictness === "final")
            return this.indexFinal;
        if (strictness === "finalTone")
            return this.indexFinalTone;
        return this.indexGroup;
    }
    getDynamicIndex(strictness) {
        if (strictness === "final")
            return this.dynamicIndexFinal;
        if (strictness === "finalTone")
            return this.dynamicIndexFinalTone;
        return this.dynamicIndexGroup;
    }
    mergeCandidates(a, b) {
        if (a.length === 0)
            return b;
        if (b.length === 0)
            return a;
        const out = [];
        const seen = new Set();
        for (const c of a) {
            const k = `${c.text}__${c.jyutping}`;
            if (seen.has(k))
                continue;
            seen.add(k);
            out.push(c);
        }
        for (const c of b) {
            const k = `${c.text}__${c.jyutping}`;
            if (seen.has(k))
                continue;
            seen.add(k);
            out.push(c);
        }
        return out;
    }
    collectWideCandidatesMerged(rhymeKeyFinal) {
        const finals = wideFinals(rhymeKeyFinal);
        const outA = [];
        const outB = [];
        for (const f of finals) {
            outA.push(...(this.indexFinal.get(f) ?? []));
            outB.push(...(this.dynamicIndexFinal.get(f) ?? []));
        }
        return this.mergeCandidates(outA, outB);
    }
    analyzeEndByToJyutping(stripped) {
        const list = ToJyutping.getJyutpingList(stripped);
        for (let i = list.length - 1; i >= 0; i--) {
            const [seg, jyutping] = list[i] ?? [];
            if (!seg || !jyutping)
                continue;
            const last = lastSyllableFromJyutping(jyutping);
            const split = last ? splitInitialFinalTone(last) : null;
            if (!last || !split)
                continue;
            const unmatchedTailRaw = list
                .slice(i + 1)
                .map(([t]) => t)
                .join("");
            const unmatchedTail = unmatchedTailRaw ? unmatchedTailRaw : null;
            this.learnFromText(seg);
            return {
                normalizedText: stripped,
                matchedText: seg,
                matchedJyutping: jyutping,
                lastSyllable: last,
                initial: split.initial,
                final: split.final,
                tone: split.tone,
                rhymeKeys: buildRhymeKeys(split.final, split.tone),
                unmatchedTail
            };
        }
        return null;
    }
    matchLongestAtEnd(stripped) {
        const end = stripped.length;
        const maxLen = Math.min(this.maxKeyLen, end);
        for (let len = maxLen; len >= 1; len--) {
            const slice = stripped.slice(end - len, end);
            const readings = this.dict[slice];
            if (readings && readings.length > 0) {
                return { text: slice, jyutping: readings[0] ?? "" };
            }
        }
        const lastChar = stripped.slice(-1);
        const readings = this.dict[lastChar];
        if (readings && readings.length > 0) {
            return { text: lastChar, jyutping: readings[0] ?? "" };
        }
        return null;
    }
}
