#!/usr/bin/env node

/**
 * Article Generation Script for produktfotostudio.at
 * 
 * Reads the article queue, picks the first pending article,
 * generates content via Google Gemini API, saves as .md file,
 * and updates the queue status.
 * 
 * Prerequisites:
 *   npm install @google/generative-ai
 * 
 * Environment Variables:
 *   GEMINI_API_KEY - Your Google Gemini API key
 * 
 * Usage:
 *   node scripts/generate-article.js
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// ── Configuration ──────────────────────────────────────────────────────────
const QUEUE_PATH = join(ROOT_DIR, 'src', 'content', 'queue.json');
const RATGEBER_DIR = join(ROOT_DIR, 'src', 'content', 'ratgeber');
const MODEL_NAME = 'gemini-3.1-flash-lite';

// ── Helpers ────────────────────────────────────────────────────────────────

function loadQueue() {
  const raw = readFileSync(QUEUE_PATH, 'utf-8');
  return JSON.parse(raw);
}

function saveQueue(queue) {
  writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf-8');
}

function findPendingArticle(queue) {
  return queue.find((a) => a.status === 'pending');
}

/**
 * Pick 2-3 random internal link targets from the queue (excluding the current article).
 */
function pickInternalLinks(queue, currentSlug) {
  const others = queue
    .filter((a) => a.slug !== currentSlug && a.status === 'published')
    .map((a) => ({ slug: a.slug, title: a.title }));

  // If not enough published articles yet, pick from the full queue
  const pool =
    others.length >= 3
      ? others
      : queue
          .filter((a) => a.slug !== currentSlug)
          .map((a) => ({ slug: a.slug, title: a.title }));

  // Shuffle and take 2-3
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(3, shuffled.length));
}

/**
 * Map category slugs to human-readable German labels.
 */
function categoryLabel(cat) {
  const labels = {
    'produkt-typ': 'Produkttyp-Ratgeber',
    'technik': 'Technik & Aufnahme',
    'beleuchtung': 'Beleuchtung & Studio',
    'plattform': 'Plattform-Guides',
    'business': 'Business & ROI',
    'post-produktion': 'Post-Produktion',
    'lokal': 'Lokaler Markt',
    'vergleich': 'Vergleich & Entscheidungshilfe',
    'checklisten': 'Checklisten & Workflows',
    'trends': 'Trends & Zukunft',
  };
  return labels[cat] || cat;
}

// ── Prompt Construction ────────────────────────────────────────────────────

function buildPrompt(article, internalLinks) {
  const internalLinkInstructions = internalLinks
    .map(
      (l) =>
        `  - „${l.title}" → /ratgeber/${l.slug}/`
    )
    .join('\n');

  return `Du bist ein erfahrener Fachautor für Produktfotografie und E-Commerce in Österreich. Schreibe einen umfassenden, SEO-optimierten Ratgeberartikel auf Deutsch (de-AT) zum folgenden Thema:

**Titel:** ${article.title}
**Kategorie:** ${categoryLabel(article.category)}
**Ziel-Keywords:** ${article.keywords.join(', ')}
**Kurzbeschreibung:** ${article.description}

## Anforderungen an den Artikel:

### Länge & Struktur
- Mindestens 1500 Wörter (besser 2000+)
- Klare Markdown-Struktur mit H2 (##) und H3 (###) Überschriften
- Einleitung (2-3 Absätze), Hauptteil mit mehreren Abschnitten, Fazit
- Verwende Aufzählungen und nummerierte Listen wo sinnvoll
- Keine H1-Überschrift (diese wird automatisch aus dem Titel generiert)

### SEO-Optimierung
- Das Haupt-Keyword „${article.keywords[0]}" muss im ersten Absatz vorkommen
- Verwende Keywords natürlich in Überschriften (nicht erzwingen)
- Schreibe eine Meta-Description (max. 160 Zeichen) die zum Klicken animiert
- Verwende semantisch verwandte Begriffe und Synonyme

### Verlinkung
Baue folgende Links natürlich in den Fließtext ein:

1. **Interne Links** (2-3 Links zu anderen Ratgeber-Artikeln):
${internalLinkInstructions}
   Verwende natürliche Ankertexte, z.B.: „Wie wir in unserem [Ratgeber zur Flat-Lay-Fotografie](/ratgeber/flat-lay-fotografie/) erklären..."

2. **Externer Link zu vladimirkocian.com** (genau 1):
   - URL: ${article.linkTo}
   - Baue diesen Link kontextuell ein, z.B.: „Professionelle Produktfotografen wie [Vladimir Kocian](${article.linkTo}) setzen auf..." oder „Bei [unserem Studio](${article.linkTo}) verwenden wir..."
   - Der Link soll natürlich und wertstiftend wirken

3. **Externer Drittanbieter-Link** (genau 1):
   - Verlinke auf eine relevante, autoritäre deutschsprachige Quelle (z.B. WKO, Statista, bekannte Foto-Magazine, Hersteller-Seiten)
   - Verwende einen beschreibenden Ankertext

### FAQ-Bereich
Füge am Ende einen FAQ-Bereich ein mit 3-5 häufig gestellten Fragen und Antworten:
- Verwende die Markdown-Überschrift: ## Häufig gestellte Fragen (FAQ)
- Jede Frage als ### Überschrift
- Antworten sollten 2-4 Sätze lang sein
- Fragen sollten echte Suchanfragen widerspiegeln

### Tonalität & Stil
- Professionell, aber zugänglich – sprich den Leser mit „du" an
- Autoritativ und kompetent, basierend auf Fachwissen
- Praxisorientiert mit konkreten, umsetzbaren Tipps
- Österreichisches Deutsch (de-AT) – natürlich, nicht übertrieben
- Vermeide Füllwörter und leere Phrasen

### Format der Ausgabe
Gib NUR den Markdown-Inhalt des Artikels zurück. Kein Frontmatter, kein Titel (H1), keine Code-Fences um den gesamten Output. Beginne direkt mit dem ersten Absatz der Einleitung.

Zusätzlich gib am Ende nach dem Artikeltext, getrennt durch "---META---", folgende Informationen:
- metaDescription: Eine Meta-Description (max. 160 Zeichen)

Format:
---META---
metaDescription: Deine Meta-Description hier
`;
}

// ── Frontmatter Generation ─────────────────────────────────────────────────

function buildFrontmatter(article, metaDescription) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

  return `---
title: "${article.title}"
description: "${metaDescription || article.description}"
category: "${article.category}"
keywords:
${article.keywords.map((k) => `  - "${k}"`).join('\n')}
author: "Vladimir Kocian"
date: ${dateStr}
linkTo: "${article.linkTo}"
slug: "${article.slug}"
---`;
}

// ── Main Execution ─────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Loading article queue...');

  // Validate API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY environment variable is not set.');
    console.error('   Set it with: export GEMINI_API_KEY="your-key-here"');
    process.exit(1);
  }

  // Load queue and find pending article
  const queue = loadQueue();
  const article = findPendingArticle(queue);

  if (!article) {
    console.log('✅ No pending articles in the queue. All done!');
    process.exit(0);
  }

  console.log(`📝 Generating article: "${article.title}" (${article.slug})`);
  console.log(`   Category: ${categoryLabel(article.category)}`);
  console.log(`   Keywords: ${article.keywords.join(', ')}`);

  // Pick internal links
  const internalLinks = pickInternalLinks(queue, article.slug);
  console.log(`   Internal links: ${internalLinks.map((l) => l.slug).join(', ')}`);

  // Build the prompt
  const prompt = buildPrompt(article, internalLinks);

  // Initialize Gemini
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 8192,
    },
  });

  console.log('🤖 Calling Gemini API...');
  const result = await model.generateContent(prompt);
  const response = result.response;
  const fullText = response.text();

  if (!fullText || fullText.trim().length < 100) {
    console.error('❌ Gemini returned an empty or too-short response.');
    process.exit(1);
  }

  console.log(`   Received ${fullText.length} characters from Gemini.`);

  // Parse meta information from response
  let articleContent = fullText;
  let metaDescription = article.description;

  const metaSeparator = '---META---';
  if (fullText.includes(metaSeparator)) {
    const parts = fullText.split(metaSeparator);
    articleContent = parts[0].trim();

    const metaPart = parts[1];
    const metaDescMatch = metaPart.match(/metaDescription:\s*(.+)/);
    if (metaDescMatch) {
      metaDescription = metaDescMatch[1].trim().slice(0, 160);
    }
  }

  // Build full markdown file
  const frontmatter = buildFrontmatter(article, metaDescription);
  const fullMarkdown = `${frontmatter}\n\n${articleContent}\n`;

  // Ensure output directory exists
  if (!existsSync(RATGEBER_DIR)) {
    mkdirSync(RATGEBER_DIR, { recursive: true });
  }

  // Write the file
  const outputPath = join(RATGEBER_DIR, `${article.slug}.md`);
  writeFileSync(outputPath, fullMarkdown, 'utf-8');
  console.log(`💾 Saved article to: ${outputPath}`);

  // Update queue status
  const now = new Date().toISOString();
  const articleIndex = queue.findIndex((a) => a.slug === article.slug);
  queue[articleIndex].status = 'published';
  queue[articleIndex].publishDate = now;
  saveQueue(queue);
  console.log(`📋 Updated queue: "${article.slug}" → published (${now})`);

  // Summary
  const publishedCount = queue.filter((a) => a.status === 'published').length;
  const pendingCount = queue.filter((a) => a.status === 'pending').length;
  console.log('');
  console.log('── Summary ──────────────────────────────');
  console.log(`   Published: ${publishedCount} / ${queue.length}`);
  console.log(`   Pending:   ${pendingCount}`);
  console.log(`   Next run will generate: ${queue.find((a) => a.status === 'pending')?.slug || 'none'}`);
  console.log('─────────────────────────────────────────');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
