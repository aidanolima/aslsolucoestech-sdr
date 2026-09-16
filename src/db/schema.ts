import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const leads = sqliteTable('leads', {
  id: integer('id').primaryKey(),
  instagramId: text('instagram_id').unique().notNull(),
  username: text('username').notNull(),
  fullName: text('full_name'),
  niche: text('niche'),
  score: integer('score').default(0),
  pipelineState: text('pipeline_state').notNull().default('discovered'), // 'discovered', 'qualified', 'contacted', 'replied', etc.
  channelState: text('channel_state').notNull().default('browser_contact_pending'),
  doNotContact: integer('do_not_contact', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at').default(Date.now()),
  updatedAt: integer('updated_at').default(Date.now()),
});

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey(),
  leadId: integer('lead_id').references(() => leads.id),
  direction: text('direction').notNull(), // 'inbound' or 'outbound'
  content: text('content').notNull(),
  timestamp: integer('timestamp').default(Date.now()),
  variant: text('variant'), // for A/B testing
});

export const metrics = sqliteTable('metrics', {
  id: integer('id').primaryKey(),
  leadId: integer('lead_id').references(() => leads.id),
  icebreaker: text('icebreaker').notNull(),
  niche: text('niche'),
  converted: integer('converted', { mode: 'boolean' }).default(false),
  timestamp: integer('timestamp').default(Date.now()),
});
