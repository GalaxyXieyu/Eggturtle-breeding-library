ALTER TABLE "referral_bindings"
ADD COLUMN "source_meta" JSONB;

ALTER TYPE "ReferralRewardTriggerType"
ADD VALUE IF NOT EXISTS 'FIRST_PRODUCT_CREATE';

ALTER TABLE "referral_rewards"
ADD COLUMN "trigger_key" VARCHAR(120),
ADD COLUMN "trigger_meta" JSONB;

CREATE UNIQUE INDEX "referral_rewards_trigger_key_key"
ON "referral_rewards"("trigger_key");
