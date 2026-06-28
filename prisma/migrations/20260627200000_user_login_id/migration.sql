-- Employee login ID on users (matches employee_code)
ALTER TABLE "users" ADD COLUMN "login_id" TEXT;

CREATE UNIQUE INDEX "users_login_id_key" ON "users"("login_id");
