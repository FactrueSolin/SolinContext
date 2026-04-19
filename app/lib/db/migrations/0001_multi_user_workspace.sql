PRAGMA foreign_keys=OFF;
--> statement-breakpoint
DROP TABLE IF EXISTS `prompt_asset_versions`;
--> statement-breakpoint
DROP TABLE IF EXISTS `prompt_assets`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`logto_user_id` text NOT NULL,
	`email` text,
	`name` text,
	`avatar_url` text,
	`status` text DEFAULT 'active' NOT NULL,
	`last_login_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "ck_users_status" CHECK("users"."status" in ('active', 'disabled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_users_logto_user_id` ON `users` (`logto_user_id`);
--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`owner_user_id` text,
	`logto_organization_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ck_workspaces_type" CHECK("workspaces"."type" in ('personal', 'organization')),
	CONSTRAINT "ck_workspaces_status" CHECK("workspaces"."status" in ('active', 'archived')),
	CONSTRAINT "ck_workspaces_personal_owner" CHECK((
		("workspaces"."type" = 'personal' and "workspaces"."owner_user_id" is not null)
		or
		("workspaces"."type" = 'organization')
	)),
	CONSTRAINT "ck_workspaces_organization_logto_id" CHECK((
		("workspaces"."type" = 'organization' and "workspaces"."logto_organization_id" is not null)
		or
		("workspaces"."type" = 'personal')
	))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_workspaces_slug` ON `workspaces` (`slug`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_workspaces_logto_organization_id` ON `workspaces` (`logto_organization_id`);
--> statement-breakpoint
CREATE INDEX `idx_workspaces_owner_user_id` ON `workspaces` (`owner_user_id`);
--> statement-breakpoint
CREATE TABLE `workspace_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`joined_at` integer NOT NULL,
	`invited_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ck_workspace_memberships_role" CHECK("workspace_memberships"."role" in ('owner', 'admin', 'editor', 'viewer')),
	CONSTRAINT "ck_workspace_memberships_status" CHECK("workspace_memberships"."status" in ('active', 'invited', 'suspended'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_workspace_memberships_workspace_user` ON `workspace_memberships` (`workspace_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_workspace_memberships_user_status` ON `workspace_memberships` (`user_id`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_workspace_memberships_workspace_role_status` ON `workspace_memberships` (`workspace_id`,`role`,`status`);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`actor_user_id` text,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_workspace_created_at` ON `audit_logs` (`workspace_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `projects` (
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
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ck_projects_name_length" CHECK(length(trim("projects"."name")) between 1 and 120)
);
--> statement-breakpoint
CREATE INDEX `idx_projects_workspace_deleted_updated_at` ON `projects` (`workspace_id`,`deleted_at`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `project_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`revision_number` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ck_project_revisions_revision_number" CHECK("project_revisions"."revision_number" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_project_revisions_project_revision` ON `project_revisions` (`project_id`,`revision_number`);
--> statement-breakpoint
CREATE INDEX `idx_project_revisions_project_created_at` ON `project_revisions` (`project_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `prompt_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`current_version_number` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text,
	`updated_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ck_prompt_assets_name_length" CHECK(length(trim("prompt_assets"."name")) between 1 and 120),
	CONSTRAINT "ck_prompt_assets_normalized_name_length" CHECK(length(trim("prompt_assets"."normalized_name")) between 1 and 120),
	CONSTRAINT "ck_prompt_assets_current_version" CHECK("prompt_assets"."current_version_number" >= 1),
	CONSTRAINT "ck_prompt_assets_status" CHECK("prompt_assets"."status" in ('active', 'archived')),
	CONSTRAINT "ck_prompt_assets_archive_state" CHECK((
		("prompt_assets"."status" = 'archived' and "prompt_assets"."archived_at" is not null)
		or
		("prompt_assets"."status" = 'active' and "prompt_assets"."archived_at" is null)
	))
);
--> statement-breakpoint
CREATE INDEX `idx_prompt_assets_workspace_status_updated_at` ON `prompt_assets` (`workspace_id`,`status`,`updated_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_prompt_assets_workspace_normalized_name` ON `prompt_assets` (`workspace_id`,`normalized_name`);
--> statement-breakpoint
CREATE INDEX `idx_prompt_assets_workspace_name` ON `prompt_assets` (`workspace_id`,`name`);
--> statement-breakpoint
CREATE INDEX `idx_prompt_assets_created_at` ON `prompt_assets` (`created_at`);
--> statement-breakpoint
CREATE TABLE `prompt_asset_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`name_snapshot` text NOT NULL,
	`description_snapshot` text DEFAULT '' NOT NULL,
	`content` text NOT NULL,
	`change_note` text,
	`content_hash` text NOT NULL,
	`operation_type` text NOT NULL,
	`source_version_id` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `prompt_assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_version_id`) REFERENCES `prompt_asset_versions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ck_prompt_asset_versions_version_number" CHECK("prompt_asset_versions"."version_number" >= 1),
	CONSTRAINT "ck_prompt_asset_versions_name_length" CHECK(length(trim("prompt_asset_versions"."name_snapshot")) between 1 and 120),
	CONSTRAINT "ck_prompt_asset_versions_content" CHECK(length("prompt_asset_versions"."content") > 0),
	CONSTRAINT "ck_prompt_asset_versions_operation_type" CHECK("prompt_asset_versions"."operation_type" in ('create', 'update', 'restore', 'import'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_prompt_asset_versions_asset_version` ON `prompt_asset_versions` (`asset_id`,`version_number`);
--> statement-breakpoint
CREATE INDEX `idx_prompt_asset_versions_workspace_asset_created_at` ON `prompt_asset_versions` (`workspace_id`,`asset_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_prompt_asset_versions_source_version_id` ON `prompt_asset_versions` (`source_version_id`);
--> statement-breakpoint
CREATE INDEX `idx_prompt_asset_versions_content_hash` ON `prompt_asset_versions` (`content_hash`);
