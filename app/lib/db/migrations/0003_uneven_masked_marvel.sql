ALTER TABLE `prompt_assets` ADD `tags` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `prompt_assets` ADD `normalized_tags` text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE `prompt_assets`
SET
    `tags` = '[]',
    `normalized_tags` = '';
--> statement-breakpoint
ALTER TABLE `prompt_asset_versions` ADD `tags_snapshot` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
UPDATE `prompt_asset_versions`
SET `tags_snapshot` = '[]';
