-- DropForeignKey
ALTER TABLE "ScoreResult" DROP CONSTRAINT "ScoreResult_applicationId_fkey";

-- AddForeignKey
ALTER TABLE "ScoreResult" ADD CONSTRAINT "ScoreResult_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
