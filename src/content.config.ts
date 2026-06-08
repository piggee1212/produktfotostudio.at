import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const ratgeber = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/ratgeber' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    keywords: z.array(z.string()),
    category: z.string(),
    publishDate: z.string(),
    author: z.string().default('Vladimir Kocian'),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    relatedArticles: z.array(z.string()).optional(),
    faq: z
      .array(
        z.object({
          question: z.string(),
          answer: z.string(),
        })
      )
      .optional(),
  }),
});

export const collections = { ratgeber };
