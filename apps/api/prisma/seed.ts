import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: 'Engineering', slug: 'engineering' },
  { name: 'Design', slug: 'design' },
  { name: 'Product', slug: 'product' },
  { name: 'Culture', slug: 'culture' },
];

const DEMO_USER = {
  email: 'demo@avertra.com',
  name: 'Demo Author',
  password: 'Demo1234!',
};

const POSTS: Array<{
  title: string;
  category: string;
  excerpt: string;
  content: string;
}> = [
  {
    title: 'Scaling Our API to a Million Requests a Day',
    category: 'Engineering',
    excerpt: 'How we rebuilt our request pipeline to handle a 10x traffic spike without adding servers.',
    content:
      'When traffic started climbing, our first instinct was to scale horizontally and call it a day. ' +
      'That bought us time, but the real win came from rethinking how requests flowed through the system: ' +
      'connection pooling, smarter caching at the edge, and trimming N+1 queries out of the hot paths. ' +
      'This post walks through the profiling process, the three changes that mattered most, and the ' +
      'monitoring setup that told us when we were actually done.',
  },
  {
    title: 'Why We Chose Postgres Over a NoSQL Store',
    category: 'Engineering',
    excerpt: 'A look at the tradeoffs that led us back to a relational database for our core product.',
    content:
      'Every few years the industry rediscovers that relational databases are good at relations. ' +
      'We evaluated a document store early on for its flexible schema, but our data was relational from ' +
      'day one: users, posts, comments, likes, all pointing at each other. Postgres gave us real transactions, ' +
      'foreign key constraints that catch bugs before they ship, and a query planner that just works. ' +
      'This post covers the migration path and what we would do differently.',
  },
  {
    title: 'Designing for Trust: Our New Onboarding Flow',
    category: 'Design',
    excerpt: 'Cutting our signup drop-off in half by rethinking the first three screens a user sees.',
    content:
      'First impressions are made in seconds, and our old onboarding flow was losing almost half of new users ' +
      'before they finished signup. We interviewed a dozen users, watched their screens, and found the same ' +
      'friction points over and over: too many fields, unclear progress, no sense of what happens next. ' +
      'The redesign focused on one thing per screen, visible progress, and copy that explains why we ask for ' +
      'each piece of information.',
  },
  {
    title: 'A Practical Guide to Design Tokens',
    category: 'Design',
    excerpt: 'How a shared token system kept our web and mobile apps visually consistent as the team grew.',
    content:
      'Design tokens sound like an abstraction for its own sake until your team grows past a handful of ' +
      'engineers and designers. Once colors, spacing, and typography lived in three different places, drift ' +
      'was inevitable. We moved to a single source of truth that generates CSS variables for web and a Swift ' +
      'enum for iOS from the same JSON file. This post covers the tooling and the rollout.',
  },
  {
    title: 'How We Prioritize Our Roadmap Every Quarter',
    category: 'Product',
    excerpt: 'The scoring framework we use to turn a long backlog into a short, defensible roadmap.',
    content:
      'Every team has more good ideas than time to build them. Our quarterly planning used to be a debate ' +
      'about whose feature felt most urgent. Now we score every candidate on reach, impact, confidence, and ' +
      'effort, and the roadmap falls out of the spreadsheet instead of the loudest voice in the room. It is ' +
      'not perfect, but it is consistent, and consistency is what makes a roadmap trustworthy.',
  },
  {
    title: 'What We Learned Shipping a Feature Nobody Used',
    category: 'Product',
    excerpt: 'A postmortem on a launch that looked great on paper and flopped in production.',
    content:
      'We spent a full quarter building a collaborative editing feature we were sure users wanted. Three ' +
      'months after launch, usage was under two percent. This post is an honest postmortem: the assumptions ' +
      'we never tested, the signals we ignored because we liked the idea too much, and the lightweight ' +
      'validation process we now run before committing engineering time to anything.',
  },
  {
    title: 'Remote-First, Three Years In',
    category: 'Culture',
    excerpt: 'What actually changed when we stopped requiring an office and started requiring documentation.',
    content:
      'Going remote was not the hard part; staying good at it was. The habits that made remote work well for ' +
      'us were not exotic: writing decisions down, defaulting to async, and being deliberate about the few ' +
      'times we do get everyone in a room. Three years in, this is what we would tell a team just starting ' +
      'the transition.',
  },
  {
    title: 'How We Run Blameless Postmortems',
    category: 'Culture',
    excerpt: 'The format that turned incident reviews from finger-pointing sessions into our best learning tool.',
    content:
      'Our first postmortems were quietly terrible: everyone was polite, nobody said anything useful, and the ' +
      'same class of incident kept recurring. The fix was structural, not cultural: a template that asks for a ' +
      'timeline before opinions, a rule that engineer names never appear next to blame language, and action ' +
      'items that get tracked like any other ticket instead of disappearing into a doc nobody reopens.',
  },
];

async function main() {
  const categoryByName = new Map<string, string>();
  for (const category of CATEGORIES) {
    const created = await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
    categoryByName.set(category.name, created.id);
  }

  const passwordHash = await bcrypt.hash(DEMO_USER.password, 10);
  const user = await prisma.user.upsert({
    where: { email: DEMO_USER.email },
    update: {},
    create: {
      email: DEMO_USER.email,
      name: DEMO_USER.name,
      passwordHash,
    },
  });

  for (const post of POSTS) {
    const slug = post.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    await prisma.post.upsert({
      where: { slug },
      update: {},
      create: {
        title: post.title,
        slug,
        content: post.content,
        excerpt: post.excerpt,
        authorId: user.id,
        categoryId: categoryByName.get(post.category),
      },
    });
  }

  console.log(`Seeded ${CATEGORIES.length} categories and ${POSTS.length} posts for ${DEMO_USER.email}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
