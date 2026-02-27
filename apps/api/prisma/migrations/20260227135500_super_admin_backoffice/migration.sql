-- CreateTable
CREATE TABLE "super_admin_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "target_tenant_id" TEXT,
    "action" VARCHAR(120) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "super_admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "super_admin_audit_logs_actor_user_id_idx" ON "super_admin_audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "super_admin_audit_logs_target_tenant_id_idx" ON "super_admin_audit_logs"("target_tenant_id");

-- CreateIndex
CREATE INDEX "super_admin_audit_logs_created_at_idx" ON "super_admin_audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "super_admin_audit_logs" ADD CONSTRAINT "super_admin_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "super_admin_audit_logs" ADD CONSTRAINT "super_admin_audit_logs_target_tenant_id_fkey" FOREIGN KEY ("target_tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
