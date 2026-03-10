ALTER TABLE "users"
ADD COLUMN "referral_code" VARCHAR(32);

CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

CREATE TYPE "ReferralRewardStatus" AS ENUM ('PENDING', 'AWARDED', 'SKIPPED');
CREATE TYPE "ReferralRewardTriggerType" AS ENUM ('FIRST_PAYMENT', 'RENEWAL');

CREATE TABLE "referral_bindings" (
    "id" TEXT NOT NULL,
    "referrer_user_id" TEXT NOT NULL,
    "invitee_user_id" TEXT NOT NULL,
    "referral_code" VARCHAR(32) NOT NULL,
    "source" VARCHAR(32) NOT NULL DEFAULT 'share_link',
    "bound_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_bindings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "referral_rewards" (
    "id" TEXT NOT NULL,
    "status" "ReferralRewardStatus" NOT NULL DEFAULT 'PENDING',
    "trigger_type" "ReferralRewardTriggerType" NOT NULL,
    "status_reason" VARCHAR(120),
    "referrer_user_id" TEXT NOT NULL,
    "invitee_user_id" TEXT NOT NULL,
    "payment_provider" VARCHAR(32),
    "payment_id" VARCHAR(80),
    "order_id" VARCHAR(80),
    "reward_days_referrer" INTEGER NOT NULL DEFAULT 0,
    "reward_days_invitee" INTEGER NOT NULL DEFAULT 0,
    "awarded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" TEXT,

    CONSTRAINT "referral_rewards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referral_bindings_invitee_user_id_key" ON "referral_bindings"("invitee_user_id");
CREATE INDEX "referral_bindings_referrer_user_id_idx" ON "referral_bindings"("referrer_user_id");
CREATE INDEX "referral_bindings_referral_code_idx" ON "referral_bindings"("referral_code");

CREATE UNIQUE INDEX "referral_rewards_payment_id_key" ON "referral_rewards"("payment_id");
CREATE UNIQUE INDEX "referral_rewards_order_id_key" ON "referral_rewards"("order_id");
CREATE INDEX "referral_rewards_invitee_user_id_idx" ON "referral_rewards"("invitee_user_id");
CREATE INDEX "referral_rewards_referrer_user_id_idx" ON "referral_rewards"("referrer_user_id");

ALTER TABLE "referral_bindings"
ADD CONSTRAINT "referral_bindings_referrer_user_id_fkey"
FOREIGN KEY ("referrer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "referral_bindings"
ADD CONSTRAINT "referral_bindings_invitee_user_id_fkey"
FOREIGN KEY ("invitee_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "referral_rewards"
ADD CONSTRAINT "referral_rewards_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "referral_rewards"
ADD CONSTRAINT "referral_rewards_referrer_user_id_fkey"
FOREIGN KEY ("referrer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "referral_rewards"
ADD CONSTRAINT "referral_rewards_invitee_user_id_fkey"
FOREIGN KEY ("invitee_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
