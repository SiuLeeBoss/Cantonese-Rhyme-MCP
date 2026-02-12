import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CantoneseRhymeEngine } from "./rhymeEngine.js";

const engine = new CantoneseRhymeEngine();
const server = new McpServer({ name: "cantonese-rhyme", version: "0.1.0" });

function splitLines(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function isBracketTagLine(trimmedLine: string): boolean {
  return /^\[[^\]]+\]$/u.test(trimmedLine);
}

function parseScheme(scheme: string | undefined, lineCount: number): string[] | null {
  const s = (scheme ?? "").trim();
  if (!s) return null;

  const compact = s.replace(/\s+/g, "");
  const byComma = compact.includes(",") ? compact.split(",").filter(Boolean) : null;
  if (byComma && byComma.length > 0) {
    const out = byComma.map((x) => x.trim()).filter(Boolean);
    return out.length === 0 ? null : out;
  }

  const letters = compact.split("").filter((ch) => /[A-Za-z]/.test(ch));
  if (letters.length === 0) return null;
  if (letters.length >= lineCount) return letters.slice(0, lineCount);

  const out: string[] = [];
  for (let i = 0; i < lineCount; i++) out.push(letters[i % letters.length] ?? "A");
  return out;
}

function pickRhymeKey(
  analyzed: ReturnType<CantoneseRhymeEngine["analyzeTextEnd"]>,
  strictness: "final" | "finalTone" | "group" | "wide"
): string | null {
  if (!analyzed.rhymeKeys) return null;
  if (strictness === "final") return analyzed.rhymeKeys.final;
  if (strictness === "finalTone") return analyzed.rhymeKeys.finalTone;
  if (strictness === "wide") return analyzed.rhymeKeys.final;
  return analyzed.rhymeKeys.group;
}

function toneClassOf(tone: string | null): "level" | "rising" | "departing" | null {
  if (!tone) return null;
  if (tone === "1" || tone === "4") return "level";
  if (tone === "2" || tone === "5") return "rising";
  if (tone === "3" || tone === "6") return "departing";
  return null;
}

function splitTrailingPunctuation(line: string): { stripped: string; trailing: string } {
  const m = line.match(/[ \t\r\n,.;:!?'"“”‘’（）()「」【】\[\]，。；：！？、…]+$/u);
  if (!m) return { stripped: line, trailing: "" };
  const trailing = m[0] ?? "";
  return { stripped: line.slice(0, line.length - trailing.length), trailing };
}

function applyEndReplacement(args: {
  originalLine: string;
  analyzed: ReturnType<CantoneseRhymeEngine["analyzeTextEnd"]>;
  replacementText: string;
}): { rewritten: string; replacedFrom: string | null } | null {
  const { stripped, trailing } = splitTrailingPunctuation(args.originalLine);
  const base = args.analyzed.normalizedText || stripped;
  const matched = args.analyzed.matchedText;
  if (!matched) return null;

  const tail = args.analyzed.unmatchedTail ?? "";
  const suffix = matched + tail;

  if (base.endsWith(suffix)) {
    const prefix = base.slice(0, base.length - suffix.length);
    return { rewritten: prefix + args.replacementText + tail + trailing, replacedFrom: matched };
  }

  if (base.endsWith(matched)) {
    const prefix = base.slice(0, base.length - matched.length);
    return { rewritten: prefix + args.replacementText + trailing, replacedFrom: matched };
  }

  if (stripped.endsWith(suffix)) {
    const prefix = stripped.slice(0, stripped.length - suffix.length);
    return { rewritten: prefix + args.replacementText + tail + trailing, replacedFrom: matched };
  }

  if (stripped.endsWith(matched)) {
    const prefix = stripped.slice(0, stripped.length - matched.length);
    return { rewritten: prefix + args.replacementText + trailing, replacedFrom: matched };
  }

  return null;
}

function isParticleLike(text: string): boolean {
  const chars = Array.from(text);
  if (chars.length === 0 || chars.length > 2) return false;
  const set = new Set(["囉", "喎", "㗎", "呀", "啊", "吖", "啦", "喇", "嘛", "呢", "啫", "啩", "咯", "喔", "喇"]);
  return chars.every((c) => set.has(c));
}

server.tool(
  "cantonese_rhyme_analyze_end",
  "Analyze the end of a Cantonese line and return rhyme keys.",
  {
    text: z.string()
  },
  async ({ text }) => {
    engine.learnFromText(text);
    const analyzed = engine.analyzeTextEnd(text);
    return {
      content: [{ type: "text", text: JSON.stringify(analyzed, null, 2) }],
      structuredContent: analyzed
    };
  }
);

server.tool(
  "cantonese_rhyme_candidates",
  "Return Cantonese rhyme candidates by a rhyme key and strictness.",
  {
    rhymeKey: z.string(),
    strictness: z.enum(["final", "finalTone", "group", "wide"]).default("final"),
    preferStyle: z.enum(["balanced", "content", "particle"]).optional(),
    limit: z.number().int().min(1).max(200).optional(),
    excludeTexts: z.array(z.string()).optional(),
    preferredCharLength: z.number().int().min(1).max(20).optional(),
    tone: z.union([z.string(), z.number()]).optional(),
    tones: z.array(z.union([z.string(), z.number()])).optional(),
    toneClass: z.enum(["level", "rising", "departing"]).optional(),
    context: z.string().optional(),
    contextKeywords: z.array(z.string()).optional()
  },
  async ({ rhymeKey, strictness, preferStyle, limit, excludeTexts, preferredCharLength, tone, tones, toneClass, context, contextKeywords }) => {
    if (context) engine.learnFromText(context);
    for (const k of contextKeywords ?? []) engine.learnFromText(k);
    const candidates = engine.rhymeCandidates({
      rhymeKey,
      strictness,
      preferStyle,
      limit,
      excludeTexts,
      preferredCharLength,
      tone,
      tones,
      toneClass,
      context,
      contextKeywords
    });
    const output = { count: candidates.length, candidates };
    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output
    };
  }
);

server.tool(
  "cantonese_rhyme_diagnose_lyrics",
  "Analyze a whole Cantonese lyrics block for rhyme consistency and suggestions.",
  {
    lyrics: z.string(),
    strictness: z.enum(["final", "finalTone", "group", "wide"]).default("final"),
    scheme: z.string().optional(),
    toneConsistency: z.enum(["none", "class", "exact"]).optional(),
    ignoreBracketTags: z.boolean().optional(),
    rewrite: z.boolean().optional(),
    rewriteSuggestionLimit: z.number().int().min(1).max(200).optional(),
    suggestionLimit: z.number().int().min(1).max(50).optional(),
    preferredCharLength: z.number().int().min(1).max(20).optional(),
    context: z.string().optional(),
    contextKeywords: z.array(z.string()).optional()
  },
  async ({
    lyrics,
    strictness,
    scheme,
    toneConsistency,
    ignoreBracketTags,
    rewrite,
    rewriteSuggestionLimit,
    suggestionLimit,
    preferredCharLength,
    context,
    contextKeywords
  }) => {
    engine.learnFromText(lyrics);
    if (context) engine.learnFromText(context);
    for (const k of contextKeywords ?? []) engine.learnFromText(k);
    const ignoreTags = ignoreBracketTags ?? true;
    const rawLines = lyrics.split(/\r?\n/);
    const parsed = rawLines.map((raw, i) => {
      const trimmed = raw.trim();
      const isBlank = trimmed.length === 0;
      const isTag = !isBlank && ignoreTags && isBracketTagLine(trimmed);
      return { originalLineNumber: i + 1, raw, trimmed, isBlank, isTag, isLyric: !isBlank && !isTag };
    });
    const lyricRows = parsed.filter((p) => p.isLyric);
    const lines = lyricRows.map((r) => r.trimmed);
    const labels = parseScheme(scheme, lines.length);

    const analyzed = lines.map((line) => engine.analyzeTextEnd(line));
    const perLine = analyzed.map((a, i) => ({
      index: lyricRows[i]?.originalLineNumber ?? i + 1,
      lyricIndex: i + 1,
      text: lines[i] ?? "",
      analyzed: a,
      rhymeKey: pickRhymeKey(a, strictness),
      toneClass: toneClassOf(a.tone)
    }));

    const labelToTargetKey = new Map<string, string>();
    const labelToTargetTone = new Map<string, string>();
    const labelToTargetToneClass = new Map<string, "level" | "rising" | "departing">();
    for (let i = 0; i < perLine.length; i++) {
      const label = labels ? labels[i] ?? "A" : null;
      const key = perLine[i]?.rhymeKey ?? null;
      if (label && key && !labelToTargetKey.has(label)) labelToTargetKey.set(label, key);
      const tone = perLine[i]?.analyzed.tone ?? null;
      if (label && tone && !labelToTargetTone.has(label)) labelToTargetTone.set(label, tone);
      const tc = perLine[i]?.toneClass ?? null;
      if (label && tc && !labelToTargetToneClass.has(label)) labelToTargetToneClass.set(label, tc);
    }

    const tcMode = toneConsistency ?? "class";
    const results = perLine.map((row, i) => {
      const label = labels ? labels[i] ?? "A" : null;
      const targetKey = label ? (labelToTargetKey.get(label) ?? null) : null;
      const ok = targetKey ? row.rhymeKey === targetKey : row.rhymeKey !== null;

      const targetTone = label ? (labelToTargetTone.get(label) ?? null) : null;
      const targetToneClass = label ? (labelToTargetToneClass.get(label) ?? null) : null;
      const toneOk =
        tcMode === "none"
          ? null
          : tcMode === "exact"
            ? (targetTone ? row.analyzed.tone === targetTone : null)
            : (targetToneClass ? row.toneClass === targetToneClass : null);
      const toneRisk = tcMode === "none" ? false : toneOk === false;

      const suggestions =
        targetKey && !ok
          ? engine.rhymeCandidates({
              rhymeKey: targetKey,
              strictness,
              limit: suggestionLimit ?? 12,
              excludeTexts: row.analyzed.matchedText ? [row.analyzed.matchedText] : undefined,
              preferredCharLength,
              context,
              contextKeywords
            })
          : [];

      return {
        index: row.index,
        lyricIndex: row.lyricIndex,
        label,
        targetKey,
        ok,
        toneOk,
        toneRisk,
        toneClass: row.toneClass,
        text: row.text,
        analyzed: row.analyzed,
        suggestions
      };
    });

    const groupSummaries = (() => {
      const map = new Map<string, { label: string; targetKey: string | null; indices: number[]; okCount: number; toneSet: Set<string>; toneClassSet: Set<string> }>();
      for (const r of results) {
        if (!r.label) continue;
        const existing =
          map.get(r.label) ??
          {
            label: r.label,
            targetKey: r.targetKey ?? null,
            indices: [],
            okCount: 0,
            toneSet: new Set<string>(),
            toneClassSet: new Set<string>()
          };
        existing.indices.push(r.index);
        if (r.ok) existing.okCount += 1;
        if (r.analyzed.tone) existing.toneSet.add(r.analyzed.tone);
        if (r.toneClass) existing.toneClassSet.add(r.toneClass);
        map.set(r.label, existing);
      }
      return Array.from(map.values()).map((g) => ({
        label: g.label,
        targetKey: g.targetKey,
        lineIndices: g.indices,
        mismatchCount: g.indices.length - g.okCount,
        tones: Array.from(g.toneSet.values()),
        toneClasses: Array.from(g.toneClassSet.values())
      }));
    })();

    const rewriteOutput = (() => {
      if (!rewrite) return null;

      const combinedContext = [context, lyrics].filter(Boolean).join("\n");
      const rewriteLimit = Math.max(1, Math.min(rewriteSuggestionLimit ?? 40, 200));

      const lineRewrites = results.map((r) => {
        const label = r.label;
        const targetKey = r.targetKey;
        if (!label || !targetKey) {
          return { index: r.index, original: r.text, rewritten: r.text, applied: false, reason: "missing_scheme" as const };
        }

        if (r.analyzed.rhymeKeys === null) {
          return { index: r.index, original: r.text, rewritten: r.text, applied: false, reason: "no_pronunciation" as const };
        }

        if (r.ok) {
          return { index: r.index, original: r.text, rewritten: r.text, applied: false, reason: "already_ok" as const };
        }

        const from = r.analyzed.matchedText;
        if (!from) {
          return { index: r.index, original: r.text, rewritten: r.text, applied: false, reason: "no_match" as const };
        }

        const preferredLen = from.length;
        const targetTone = labelToTargetTone.get(label) ?? null;
        const targetToneClass = labelToTargetToneClass.get(label) ?? null;
        const preferStyle = isParticleLike(from) ? "particle" : "content";

        const candidates = engine.rhymeCandidates({
          rhymeKey: targetKey,
          strictness,
          preferStyle,
          limit: rewriteLimit,
          excludeTexts: [from],
          preferredCharLength: preferredLen,
          tone: tcMode === "exact" ? (targetTone ?? undefined) : undefined,
          toneClass: tcMode === "class" ? (targetToneClass ?? undefined) : undefined,
          context: [combinedContext, r.text].filter(Boolean).join("\n"),
          contextKeywords
        });

        const best = candidates[0]?.text ?? null;
        if (!best) {
          return { index: r.index, original: r.text, rewritten: r.text, applied: false, reason: "no_candidate" as const };
        }

        const applied = applyEndReplacement({ originalLine: r.text, analyzed: r.analyzed, replacementText: best });
        if (!applied) {
          return { index: r.index, original: r.text, rewritten: r.text, applied: false, reason: "not_at_end" as const };
        }

        return {
          index: r.index,
          original: r.text,
          rewritten: applied.rewritten,
          applied: true,
          replacedFrom: applied.replacedFrom,
          replacedTo: best,
          targetKey
        };
      });

      const rewrittenLines = rawLines.slice();
      for (const r of lineRewrites) {
        const idx = Math.max(0, r.index - 1);
        if (idx < rewrittenLines.length) rewrittenLines[idx] = r.rewritten;
      }
      const rewrittenLyrics = rewrittenLines.join("\n");
      const changeCount = lineRewrites.filter((r) => r.applied).length;
      return { changeCount, lyrics: rewrittenLyrics, lines: lineRewrites };
    })();

    const summary = {
      lineCount: results.length,
      matchedCount: results.filter((r) => r.ok).length,
      unmatchedLines: results.filter((r) => r.analyzed.rhymeKeys === null).map((r) => r.index),
      toneRiskLines: results.filter((r) => r.toneRisk).map((r) => r.index),
      rewriteChangeCount: rewriteOutput?.changeCount ?? 0,
      skippedTagLines: parsed.filter((p) => p.isTag).map((p) => p.originalLineNumber)
    };

    const output = { summary, groups: groupSummaries, results, rewrite: rewriteOutput };
    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output
    };
  }
);

await server.connect(new StdioServerTransport());
