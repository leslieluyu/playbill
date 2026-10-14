import { defineCollection, reference } from "astro:content";
import { z } from "astro/zod";
import { worksLoader, listsLoader, peopleLoader } from "./loaders/sqlite";

const person = z.object({ id: z.string(), zh: z.string().optional(), en: z.string() });
const rating = z.object({
  value: z.number(),
  votes: z.number().int().optional(),
  detail: z.any().optional(),
  fetchedAt: z.string(),
});

const works = defineCollection({
  loader: worksLoader(),
  schema: z.object({
    kind: z.enum(["tv", "movie"]),
    zh: z.string().optional(),
    en: z.string(),
    original: z.string().optional(),
    alias: z.array(z.string()).default([]),
    years: z.string(),
    yearStart: z.number().int(),
    place: z.string().optional(),
    form: z.string().optional(),
    runtime: z.number().int().optional(),
    creators: z.array(person),
    writers: z.array(person).default([]),
    cast: z.array(person),
    plot: z.string().optional(),
    plotEn: z.string().optional(),
    playbill: z.string().optional(),
    playbillEn: z.string().optional(),
    poster: z.string().optional(),
    imdbId: z.string().optional(),
    ratings: z.object({ douban: rating.optional(), imdb: rating.optional() }),
  }),
});

const lists = defineCollection({
  loader: listsLoader(),
  schema: z.object({
    title: z.string(),
    kicker: z.string(),
    dek: z.string(),
    source: z.object({ name: z.string(), url: z.string().url() }),
    kind: z.enum(["tv", "movie"]),
    order: z.number(),
    sections: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          blurb: z.string(),
          color: z.string().regex(/^#[0-9a-f]{6}$/i),
        }),
      )
      .default([]),
    entries: z
      .array(
        z.object({
          rank: z.number().int().positive(),
          work: reference("works"),
          section: z.string().optional(),
          hook: z.string().optional(),
          hookEn: z.string().optional(),
        }),
      )
      .min(1),
  }),
});

const people = defineCollection({
  loader: peopleLoader(),
  schema: z.object({
    zh: z.string().optional(),
    en: z.string(),
    photo: z.string().optional(),
    bioZh: z.string().optional(),
    bioEn: z.string().optional(),
    works: z.array(
      z.object({
        id: z.string(),
        zh: z.string().optional(),
        en: z.string(),
        poster: z.string().optional(),
        kind: z.enum(["tv", "movie"]),
        role: z.enum(["creator", "director", "writer", "cast"]),
        yearStart: z.number().int(),
        listId: z.string().optional(),
        rank: z.number().int().optional(),
      }),
    ),
    collaborators: z
      .array(
        z.object({
          id: z.string(),
          zh: z.string().optional(),
          en: z.string(),
          photo: z.string().optional(),
          count: z.number().int().positive(),
          works: z.array(
            z.object({
              id: z.string(),
              zh: z.string().optional(),
              en: z.string(),
            }),
          ),
        }),
      )
      .default([]),
  }),
});

export const collections = { works, lists, people };
