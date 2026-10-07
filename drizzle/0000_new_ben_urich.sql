CREATE TABLE `budgets` (
	`key` text PRIMARY KEY NOT NULL,
	`used` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `budget_expiry` ON `budgets` (`expires`);--> statement-breakpoint
CREATE TABLE `observations` (
	`reporter` text NOT NULL,
	`cohort` text NOT NULL,
	`sequence` integer NOT NULL,
	`state` text NOT NULL,
	`observed` integer NOT NULL,
	`expires` integer NOT NULL,
	`had_failure` integer NOT NULL,
	PRIMARY KEY(`reporter`, `cohort`)
);
--> statement-breakpoint
CREATE INDEX `cohort_freshness` ON `observations` (`cohort`,`observed`);--> statement-breakpoint
CREATE INDEX `observation_expiry` ON `observations` (`expires`);