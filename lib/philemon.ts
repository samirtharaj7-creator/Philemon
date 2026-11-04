import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ChapterContentSchema, type ChapterContent } from "@/lib/schemas";
import { padChapter } from "@/lib/utils";

export const PHILEMON_BOOKS = {
  "philemon": {
    slug: "philemon",
    name: "Philemon",
    chapterCount: 1,
    verseCounts: [25]
  }
} as const;

export type PhilemonBookSlug = keyof typeof PHILEMON_BOOKS;
export type PhilemonBookConfig = (typeof PHILEMON_BOOKS)[PhilemonBookSlug];

export type ChapterAdjacency = {
  previous: number | null;
  next: number | null;
};

const contentRoot = join(process.cwd(), "content");

export function getPhilemonBookConfig(bookSlug: PhilemonBookSlug): PhilemonBookConfig {
  return PHILEMON_BOOKS[bookSlug];
}

export function getPhilemonStaticParams(bookSlug: PhilemonBookSlug) {
  const { chapterCount } = getPhilemonBookConfig(bookSlug);
  return Array.from({ length: chapterCount }, (_, index) => ({ chapter: String(index + 1) }));
}

export function parsePhilemonChapterNumber(
  bookSlug: PhilemonBookSlug,
  chapter: number | string
): number | null {
  const rawChapter = String(chapter);
  if (!/^[1-9]\d*$/.test(rawChapter)) return null;

  const chapterNumber = Number(rawChapter);
  const { chapterCount } = getPhilemonBookConfig(bookSlug);
  if (!Number.isSafeInteger(chapterNumber) || chapterNumber > chapterCount) return null;

  return chapterNumber;
}

export function getPhilemonChapter(
  bookSlug: PhilemonBookSlug,
  chapter: number | string
): ChapterContent | null {
  const chapterNumber = parsePhilemonChapterNumber(bookSlug, chapter);
  if (chapterNumber === null) return null;

  const config = getPhilemonBookConfig(bookSlug);
  const chapterPath = join(contentRoot, config.slug, `chapter-${padChapter(chapterNumber)}.json`);
  if (!existsSync(chapterPath)) return null;

  const parsed = ChapterContentSchema.parse(JSON.parse(readFileSync(chapterPath, "utf8")));
  const expectedVerseCount = config.verseCounts[chapterNumber - 1];

  if (parsed.chapterNumber !== chapterNumber) {
    throw new Error(
      `${config.name} ${chapterNumber} loaded chapterNumber ${parsed.chapterNumber}.`
    );
  }

  if (parsed.verses.length !== expectedVerseCount) {
    throw new Error(
      `${config.name} ${chapterNumber} has ${parsed.verses.length} verses; expected ${expectedVerseCount}.`
    );
  }

  parsed.verses.forEach((verse, index) => {
    const expectedReference = `${config.name} ${chapterNumber}:${index + 1}`;
    if (verse.verse !== expectedReference) {
      throw new Error(
        `${config.name} ${chapterNumber} contains ${verse.verse}; expected ${expectedReference}.`
      );
    }
  });

  return parsed;
}

export function getPhilemonChapterAdjacency(
  bookSlug: PhilemonBookSlug,
  chapter: number | string
): ChapterAdjacency | null {
  const chapterNumber = parsePhilemonChapterNumber(bookSlug, chapter);
  if (chapterNumber === null) return null;

  const { chapterCount } = getPhilemonBookConfig(bookSlug);
  return {
    previous: chapterNumber > 1 ? chapterNumber - 1 : null,
    next: chapterNumber < chapterCount ? chapterNumber + 1 : null
  };
}
