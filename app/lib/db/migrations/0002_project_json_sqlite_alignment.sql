PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__project_revision_backup` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`revision_number` integer NOT NULL,
	`history_key` text NOT NULL,
	`name_snapshot` text NOT NULL,
	`system_prompt` text NOT NULL,
	`messages_json` text NOT NULL,
	`api_config_json` text NOT NULL,
	`content_hash` text NOT NULL,
	`operation_type` text NOT NULL,
	`source_revision_id` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`legacy_source_path` text
);
--> statement-breakpoint
INSERT INTO `__project_revision_backup` (
	`id`,
	`project_id`,
	`workspace_id`,
	`revision_number`,
	`history_key`,
	`name_snapshot`,
	`system_prompt`,
	`messages_json`,
	`api_config_json`,
	`content_hash`,
	`operation_type`,
	`source_revision_id`,
	`created_by`,
	`created_at`,
	`legacy_source_path`
)
SELECT
	pr.`id`,
	pr.`project_id`,
	pr.`workspace_id`,
	pr.`revision_number`,
	pr.`id` || '.json',
	coalesce(p.`name`, 'Untitled Project'),
	coalesce(json_extract(pr.`snapshot_json`, '$.systemPrompt'), p.`system_prompt`, ''),
	coalesce(json_extract(pr.`snapshot_json`, '$.messages'), '[]'),
	coalesce(
		json_extract(pr.`snapshot_json`, '$.apiConfig'),
		'{"baseUrl":"https://api.anthropic.com","apiKey":"","model":"claude-sonnet-4-20250514"}'
	),
	printf('%s:%s:%s', pr.`project_id`, pr.`revision_number`, pr.`created_at`),
	case when pr.`revision_number` = 1 then 'create' else 'update' end,
	(
		select prev.`id`
		from `project_revisions` prev
		where prev.`project_id` = pr.`project_id`
			and prev.`revision_number` = pr.`revision_number` - 1
	),
	pr.`created_by`,
	pr.`created_at`,
	null
FROM `project_revisions` pr
INNER JOIN `projects` p ON p.`id` = pr.`project_id`;
--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`system_prompt` text DEFAULT '' NOT NULL,
	`default_credential_id` text,
	`current_revision_id` text,
	`created_by` text,
	`updated_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`row_version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ck_projects_name_length" CHECK(length(trim("name")) between 1 and 120),
	CONSTRAINT "ck_projects_row_version" CHECK("row_version" >= 1),
	CONSTRAINT "ck_projects_updated_ge_created" CHECK("updated_at" >= "created_at")
);
--> statement-breakpoint
INSERT INTO `__new_projects` (
	`id`,
	`workspace_id`,
	`name`,
	`system_prompt`,
	`default_credential_id`,
	`current_revision_id`,
	`created_by`,
	`updated_by`,
	`created_at`,
	`updated_at`,
	`deleted_at`,
	`row_version`
)
SELECT
	p.`id`,
	p.`workspace_id`,
	p.`name`,
	p.`system_prompt`,
	p.`default_credential_id`,
	p.`current_revision_id`,
	p.`created_by`,
	p.`updated_by`,
	p.`created_at`,
	p.`updated_at`,
	p.`deleted_at`,
	coalesce((
		select max(pr.`revision_number`)
		from `project_revisions` pr
		where pr.`project_id` = p.`id`
	), 1)
FROM `projects` p;
--> statement-breakpoint
DROP TABLE `project_revisions`;
--> statement-breakpoint
DROP TABLE `projects`;
--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;
--> statement-breakpoint
CREATE INDEX `idx_projects_workspace_deleted_updated_at` ON `projects` (`workspace_id`,`deleted_at`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `idx_projects_workspace_name` ON `projects` (`workspace_id`,`name`);
--> statement-breakpoint
CREATE TABLE `project_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`revision_number` integer NOT NULL,
	`history_key` text NOT NULL,
	`name_snapshot` text NOT NULL,
	`system_prompt` text NOT NULL,
	`messages_json` text NOT NULL,
	`api_config_json` text NOT NULL,
	`content_hash` text NOT NULL,
	`operation_type` text NOT NULL,
	`source_revision_id` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`legacy_source_path` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ck_project_revisions_revision_number" CHECK("revision_number" >= 1),
	CONSTRAINT "ck_project_revisions_name_length" CHECK(length(trim("name_snapshot")) between 1 and 120),
	CONSTRAINT "ck_project_revisions_messages_json" CHECK(json_valid("messages_json")),
	CONSTRAINT "ck_project_revisions_api_config_json" CHECK(json_valid("api_config_json")),
	CONSTRAINT "ck_project_revisions_operation_type" CHECK("operation_type" in ('create', 'update', 'restore', 'duplicate', 'import', 'migrate'))
);
--> statement-breakpoint
INSERT INTO `project_revisions` (
	`id`,
	`project_id`,
	`workspace_id`,
	`revision_number`,
	`history_key`,
	`name_snapshot`,
	`system_prompt`,
	`messages_json`,
	`api_config_json`,
	`content_hash`,
	`operation_type`,
	`source_revision_id`,
	`created_by`,
	`created_at`,
	`legacy_source_path`
)
SELECT
	`id`,
	`project_id`,
	`workspace_id`,
	`revision_number`,
	`history_key`,
	`name_snapshot`,
	`system_prompt`,
	`messages_json`,
	`api_config_json`,
	`content_hash`,
	`operation_type`,
	`source_revision_id`,
	`created_by`,
	`created_at`,
	`legacy_source_path`
FROM `__project_revision_backup`
ORDER BY `project_id`, `revision_number`;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_project_revisions_project_revision` ON `project_revisions` (`project_id`,`revision_number`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_project_revisions_project_history_key` ON `project_revisions` (`project_id`,`history_key`);
--> statement-breakpoint
CREATE INDEX `idx_project_revisions_project_created_at` ON `project_revisions` (`project_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_project_revisions_content_hash` ON `project_revisions` (`content_hash`);
--> statement-breakpoint
CREATE INDEX `idx_project_revisions_source_revision_id` ON `project_revisions` (`source_revision_id`);
--> statement-breakpoint
DROP TABLE `__project_revision_backup`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
