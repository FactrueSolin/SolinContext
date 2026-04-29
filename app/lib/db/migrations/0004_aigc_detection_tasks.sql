CREATE TABLE `aigc_detection_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text,
	`status` text NOT NULL,
	`external_task_id` text,
	`external_status` text,
	`source_file_name` text NOT NULL,
	`source_file_ext` text NOT NULL,
	`source_mime_type` text NOT NULL,
	`source_file_size` integer NOT NULL,
	`source_file_sha256` text NOT NULL,
	`storage_path` text NOT NULL,
	`storage_status` text DEFAULT 'active' NOT NULL,
	`idempotency_key` text NOT NULL,
	`deduplicated` integer DEFAULT false NOT NULL,
	`progress_current` integer,
	`progress_total` integer,
	`progress_unit` text,
	`result_overall_score` real,
	`result_human_score` real,
	`result_summary` text,
	`result_json` text,
	`raw_result_json` text,
	`error_code` text,
	`error_message` text,
	`submitted_at` integer,
	`completed_at` integer,
	`last_synced_at` integer,
	`last_sync_error_at` integer,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`syncing_until` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT `ck_aigc_detection_tasks_status` CHECK("aigc_detection_tasks"."status" in ('queued_local', 'submit_failed', 'submitted', 'processing', 'succeeded', 'failed')),
	CONSTRAINT `ck_aigc_detection_tasks_storage_status` CHECK("aigc_detection_tasks"."storage_status" in ('active', 'deleted')),
	CONSTRAINT `ck_aigc_detection_tasks_source_file_ext` CHECK("aigc_detection_tasks"."source_file_ext" in ('pdf', 'doc', 'docx')),
	CONSTRAINT `ck_aigc_detection_tasks_sha256` CHECK(length("aigc_detection_tasks"."source_file_sha256") = 64),
	CONSTRAINT `ck_aigc_detection_tasks_source_file_size` CHECK("aigc_detection_tasks"."source_file_size" >= 0),
	CONSTRAINT `ck_aigc_detection_tasks_retry_count` CHECK("aigc_detection_tasks"."retry_count" >= 0),
	CONSTRAINT `ck_aigc_detection_tasks_progress_current` CHECK("aigc_detection_tasks"."progress_current" is null or "aigc_detection_tasks"."progress_current" >= 0),
	CONSTRAINT `ck_aigc_detection_tasks_progress_total` CHECK("aigc_detection_tasks"."progress_total" is null or "aigc_detection_tasks"."progress_total" >= 0),
	CONSTRAINT `ck_aigc_detection_tasks_progress_pair` CHECK((("aigc_detection_tasks"."progress_current" is null and "aigc_detection_tasks"."progress_total" is null) or ("aigc_detection_tasks"."progress_current" is not null and "aigc_detection_tasks"."progress_total" is not null and "aigc_detection_tasks"."progress_current" <= "aigc_detection_tasks"."progress_total"))),
	CONSTRAINT `ck_aigc_detection_tasks_result_overall_score` CHECK("aigc_detection_tasks"."result_overall_score" is null or ("aigc_detection_tasks"."result_overall_score" >= 0 and "aigc_detection_tasks"."result_overall_score" <= 1)),
	CONSTRAINT `ck_aigc_detection_tasks_result_human_score` CHECK("aigc_detection_tasks"."result_human_score" is null or ("aigc_detection_tasks"."result_human_score" >= 0 and "aigc_detection_tasks"."result_human_score" <= 1)),
	CONSTRAINT `ck_aigc_detection_tasks_submitted_at` CHECK("aigc_detection_tasks"."submitted_at" is null or "aigc_detection_tasks"."submitted_at" >= "aigc_detection_tasks"."created_at"),
	CONSTRAINT `ck_aigc_detection_tasks_completed_at` CHECK("aigc_detection_tasks"."completed_at" is null or "aigc_detection_tasks"."submitted_at" is null or "aigc_detection_tasks"."completed_at" >= "aigc_detection_tasks"."submitted_at"),
	CONSTRAINT `ck_aigc_detection_tasks_updated_at` CHECK("aigc_detection_tasks"."updated_at" >= "aigc_detection_tasks"."created_at"),
	CONSTRAINT `ck_aigc_detection_tasks_result_json` CHECK("aigc_detection_tasks"."result_json" is null or json_valid("aigc_detection_tasks"."result_json")),
	CONSTRAINT `ck_aigc_detection_tasks_raw_result_json` CHECK("aigc_detection_tasks"."raw_result_json" is null or json_valid("aigc_detection_tasks"."raw_result_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_aigc_detection_tasks_external_task_id` ON `aigc_detection_tasks` (`external_task_id`);
--> statement-breakpoint
CREATE INDEX `idx_aigc_detection_tasks_workspace_created_at` ON `aigc_detection_tasks` (`workspace_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_aigc_detection_tasks_workspace_status_updated_at` ON `aigc_detection_tasks` (`workspace_id`,`status`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `idx_aigc_detection_tasks_sha256` ON `aigc_detection_tasks` (`source_file_sha256`);
--> statement-breakpoint
CREATE INDEX `idx_aigc_detection_tasks_workspace_sha256_status_created_at` ON `aigc_detection_tasks` (`workspace_id`,`source_file_sha256`,`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_aigc_detection_tasks_status_last_synced_at` ON `aigc_detection_tasks` (`status`,`last_synced_at`);
--> statement-breakpoint
CREATE INDEX `idx_aigc_detection_tasks_created_by_created_at` ON `aigc_detection_tasks` (`created_by`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_aigc_detection_tasks_workspace_source_file_name` ON `aigc_detection_tasks` (`workspace_id`,`source_file_name`);
--> statement-breakpoint
CREATE INDEX `idx_aigc_detection_tasks_completed_at` ON `aigc_detection_tasks` (`completed_at`);
--> statement-breakpoint
CREATE TABLE `aigc_detection_task_events` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`event_type` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`payload_json` text,
	`operator_type` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `aigc_detection_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT `ck_aigc_detection_task_events_event_type` CHECK("aigc_detection_task_events"."event_type" in ('task_created', 'file_saved', 'submit_requested', 'submit_succeeded', 'submit_failed', 'status_synced', 'result_synced', 'sync_failed', 'retry_requested', 'retry_submitted', 'storage_deleted')),
	CONSTRAINT `ck_aigc_detection_task_events_operator_type` CHECK("aigc_detection_task_events"."operator_type" in ('user', 'system')),
	CONSTRAINT `ck_aigc_detection_task_events_payload_json` CHECK("aigc_detection_task_events"."payload_json" is null or json_valid("aigc_detection_task_events"."payload_json"))
);
--> statement-breakpoint
CREATE INDEX `idx_aigc_detection_task_events_task_created_at` ON `aigc_detection_task_events` (`task_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_aigc_detection_task_events_workspace_created_at` ON `aigc_detection_task_events` (`workspace_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_aigc_detection_task_events_event_type_created_at` ON `aigc_detection_task_events` (`event_type`,`created_at`);
