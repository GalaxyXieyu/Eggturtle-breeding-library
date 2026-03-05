CREATE TABLE "user_phone_bindings" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "phone_number" VARCHAR(20) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_phone_bindings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_phone_bindings_user_id_key" ON "user_phone_bindings"("user_id");
CREATE UNIQUE INDEX "user_phone_bindings_phone_number_key" ON "user_phone_bindings"("phone_number");
CREATE INDEX "user_phone_bindings_phone_number_idx" ON "user_phone_bindings"("phone_number");

ALTER TABLE "user_phone_bindings"
ADD CONSTRAINT "user_phone_bindings_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
