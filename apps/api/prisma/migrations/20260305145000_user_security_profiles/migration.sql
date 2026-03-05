CREATE TABLE "user_security_profiles" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "question" VARCHAR(120) NOT NULL,
  "answer_hash" VARCHAR(128) NOT NULL,
  "salt" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_security_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_security_profiles_user_id_key" ON "user_security_profiles"("user_id");

ALTER TABLE "user_security_profiles"
ADD CONSTRAINT "user_security_profiles_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
