-- CreateEnum
CREATE TYPE "SubscriptionOrderStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'REFUNDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionOrderPaymentProvider" AS ENUM ('WECHAT', 'ALIPAY');

-- CreateEnum
CREATE TYPE "SubscriptionOrderPaymentChannel" AS ENUM ('JSAPI', 'H5');

-- CreateEnum
CREATE TYPE "SubscriptionOrderFulfillmentMode" AS ENUM ('IMMEDIATE', 'DEFERRED');

-- CreateTable
CREATE TABLE "user_wechat_bindings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "app_id" VARCHAR(64) NOT NULL,
    "open_id" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_wechat_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_orders" (
    "id" TEXT NOT NULL,
    "order_no" VARCHAR(80) NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan" "TenantSubscriptionPlan" NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "total_amount_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'CNY',
    "payment_provider" "SubscriptionOrderPaymentProvider" NOT NULL,
    "payment_channel" "SubscriptionOrderPaymentChannel" NOT NULL,
    "payment_id" VARCHAR(120),
    "payment_prepay_id" VARCHAR(120),
    "status" "SubscriptionOrderStatus" NOT NULL DEFAULT 'PENDING',
    "status_reason" VARCHAR(255),
    "fulfillment_mode" "SubscriptionOrderFulfillmentMode" NOT NULL DEFAULT 'IMMEDIATE',
    "effective_starts_at" TIMESTAMP(3) NOT NULL,
    "provider_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "applied_at" TIMESTAMP(3),

    CONSTRAINT "subscription_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_wechat_bindings_user_id_idx" ON "user_wechat_bindings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_wechat_bindings_user_id_app_id_key" ON "user_wechat_bindings"("user_id", "app_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_wechat_bindings_app_id_open_id_key" ON "user_wechat_bindings"("app_id", "open_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_orders_order_no_key" ON "subscription_orders"("order_no");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_orders_payment_id_key" ON "subscription_orders"("payment_id");

-- CreateIndex
CREATE INDEX "subscription_orders_tenant_id_user_id_idx" ON "subscription_orders"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "subscription_orders_tenant_id_status_idx" ON "subscription_orders"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "subscription_orders_status_idx" ON "subscription_orders"("status");

-- CreateIndex
CREATE INDEX "subscription_orders_payment_provider_payment_id_idx" ON "subscription_orders"("payment_provider", "payment_id");

-- CreateIndex
CREATE INDEX "subscription_orders_effective_starts_at_idx" ON "subscription_orders"("effective_starts_at");

-- CreateIndex
CREATE INDEX "subscription_orders_created_at_idx" ON "subscription_orders"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_orders_tenant_id_order_no_key" ON "subscription_orders"("tenant_id", "order_no");

-- AddForeignKey
ALTER TABLE "user_wechat_bindings" ADD CONSTRAINT "user_wechat_bindings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_orders" ADD CONSTRAINT "subscription_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_orders" ADD CONSTRAINT "subscription_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
