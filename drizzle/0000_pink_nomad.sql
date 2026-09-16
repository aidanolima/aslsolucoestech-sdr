CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payload` text,
	`retry_count` integer DEFAULT 0,
	`next_run` integer
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` integer PRIMARY KEY NOT NULL,
	`instagram_id` text NOT NULL,
	`username` text NOT NULL,
	`full_name` text,
	`niche` text,
	`score` integer DEFAULT 0,
	`pipeline_state` text DEFAULT 'discovered' NOT NULL,
	`channel_state` text DEFAULT 'browser_contact_pending' NOT NULL,
	`do_not_contact` integer DEFAULT false,
	`created_at` integer DEFAULT 1789325601508,
	`updated_at` integer DEFAULT 1789325601508
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY NOT NULL,
	`lead_id` integer,
	`direction` text NOT NULL,
	`content` text NOT NULL,
	`timestamp` integer DEFAULT 1789325601509,
	`variant` text,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leads_instagram_id_unique` ON `leads` (`instagram_id`);