ALTER TABLE "users"
ADD COLUMN "account" VARCHAR(32);

CREATE UNIQUE INDEX "users_account_key" ON "users"("account");
