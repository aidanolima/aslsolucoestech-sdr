CREATE TABLE `campaign_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`business_name` text,
	`product_offer` text,
	`target_audience` text,
	`ai_criteria` text,
	`ai_message` text
);
--> statement-breakpoint
CREATE TABLE `metrics` (
	`id` integer PRIMARY KEY NOT NULL,
	`lead_id` integer,
	`icebreaker` text NOT NULL,
	`niche` text,
	`converted` integer DEFAULT false,
	`timestamp` integer DEFAULT 1789654072009,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
DROP TABLE `jobs`;--> statement-breakpoint
/*
 SQLite does not support "Set default to column" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html
                  https://stackoverflow.com/questions/2083543/modify-a-columns-type-in-sqlite3

 Due to that we don't generate migration automatically and it has to be done manually
*/