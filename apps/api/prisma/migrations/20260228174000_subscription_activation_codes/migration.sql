-- CreateTable
CREATE TABLE "subscription_activation_codes" (
    "id" TEXT NOT NULL,
    "code_digest" VARCHAR(128) NOT NULL,
    "code_label" VARCHAR(32) NOT NULL,
    "target_tenant_id" TEXT,
    "plan" "TenantSubscriptionPlan" NOT NULL DEFAULT 'PRO',
    "duration_days" INTEGER,
    "max_images" INTEGER,
    "max_storage_bytes" BIGINT,
    "max_shares" INTEGER,
    "redeem_limit" INTEGER NOT NULL DEFAULT 1,
    "redeemed_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "disabled_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_activation_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_activation_codes_code_digest_key" ON "subscription_activation_codes"("code_digest");

-- CreateIndex
CREATE INDEX "subscription_activation_codes_target_tenant_id_idx" ON "subscription_activation_codes"("target_tenant_id");

-- CreateIndex
CREATE INDEX "subscription_activation_codes_created_by_user_id_idx" ON "subscription_activation_codes"("created_by_user_id");

-- CreateIndex
CREATE INDEX "subscription_activation_codes_expires_at_idx" ON "subscription_activation_codes"("expires_at");

-- CreateIndex
CREATE INDEX "subscription_activation_codes_plan_idx" ON "subscription_activation_codes"("plan");

-- AddForeignKey
ALTER TABLE "subscription_activation_codes" ADD CONSTRAINT "subscription_activation_codes_target_tenant_id_fkey" FOREIGN KEY ("target_tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_activation_codes" ADD CONSTRAINT "subscription_activation_codes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
