CREATE TABLE `prompt_asset_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`name_snapshot` text NOT NULL,
	`description_snapshot` text DEFAULT '' NOT NULL,
	`content` text NOT NULL,
	`change_note` text,
	`content_hash` text NOT NULL,
	`operation_type` text NOT NULL,
	`source_version_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `prompt_assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_version_id`) REFERENCES `prompt_asset_versions`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ck_prompt_asset_versions_version_number" CHECK("prompt_asset_versions"."version_number" >= 1),
	CONSTRAINT "ck_prompt_asset_versions_name_length" CHECK(length(trim("prompt_asset_versions"."name_snapshot")) between 1 and 120),
	CONSTRAINT "ck_prompt_asset_versions_content" CHECK(length("prompt_asset_versions"."content") > 0),
	CONSTRAINT "ck_prompt_asset_versions_operation_type" CHECK("prompt_asset_versions"."operation_type" in ('create', 'update', 'restore', 'import'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_prompt_asset_versions_asset_version` ON `prompt_asset_versions` (`asset_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `idx_prompt_asset_versions_asset_created_at` ON `prompt_asset_versions` (`asset_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_prompt_asset_versions_source_version_id` ON `prompt_asset_versions` (`source_version_id`);--> statement-breakpoint
CREATE INDEX `idx_prompt_asset_versions_content_hash` ON `prompt_asset_versions` (`content_hash`);--> statement-breakpoint
CREATE TABLE `prompt_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`current_version_number` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	CONSTRAINT "ck_prompt_assets_name_length" CHECK(length(trim("prompt_assets"."name")) between 1 and 120),
	CONSTRAINT "ck_prompt_assets_current_version" CHECK("prompt_assets"."current_version_number" >= 1),
	CONSTRAINT "ck_prompt_assets_status" CHECK("prompt_assets"."status" in ('active', 'archived')),
	CONSTRAINT "ck_prompt_assets_archive_state" CHECK((
                ("prompt_assets"."status" = 'archived' and "prompt_assets"."archived_at" is not null)
                or
                ("prompt_assets"."status" = 'active' and "prompt_assets"."archived_at" is null)
            ))
);
--> statement-breakpoint
CREATE INDEX `idx_prompt_assets_status_updated_at` ON `prompt_assets` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_prompt_assets_name` ON `prompt_assets` (`name`);--> statement-breakpoint
CREATE INDEX `idx_prompt_assets_created_at` ON `prompt_assets` (`created_at`);