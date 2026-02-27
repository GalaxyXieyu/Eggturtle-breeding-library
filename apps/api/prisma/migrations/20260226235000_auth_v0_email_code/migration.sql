-- CreateTable
CREATE TABLE "auth_codes" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "code_hash" VARCHAR(128) NOT NULL,
    "salt" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_codes_email_idx" ON "auth_codes"("email");

-- CreateIndex
CREATE INDEX "auth_codes_email_created_at_idx" ON "auth_codes"("email", "created_at");
