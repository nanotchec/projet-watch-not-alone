-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RoomMode') THEN
        CREATE TYPE "RoomMode" AS ENUM ('STANDARD', 'SPORTS_ANALYSIS');
    END IF;
END $$;

-- AlterTable
ALTER TABLE "Salon"
ADD COLUMN IF NOT EXISTS "mode" "RoomMode" NOT NULL DEFAULT 'STANDARD';

-- CreateTable
CREATE TABLE IF NOT EXISTS "ElementPlaylistAngle" (
    "id_angle" SERIAL NOT NULL,
    "id_element_playlist" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "fournisseur" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,

    CONSTRAINT "ElementPlaylistAngle_pkey" PRIMARY KEY ("id_angle")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Annotation" (
    "id_annotation" SERIAL NOT NULL,
    "id_salon" INTEGER NOT NULL,
    "id_participation" INTEGER NOT NULL,
    "id_angle" INTEGER,
    "timestamp_video" DOUBLE PRECISION NOT NULL,
    "duree_affichage" DOUBLE PRECISION,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Annotation_pkey" PRIMARY KEY ("id_annotation")
);

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ElementPlaylistAngle_id_element_playlist_fkey') THEN
        ALTER TABLE "ElementPlaylistAngle"
        ADD CONSTRAINT "ElementPlaylistAngle_id_element_playlist_fkey"
        FOREIGN KEY ("id_element_playlist") REFERENCES "ElementPlaylist"("id_element_playlist") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Annotation_id_salon_fkey') THEN
        ALTER TABLE "Annotation"
        ADD CONSTRAINT "Annotation_id_salon_fkey"
        FOREIGN KEY ("id_salon") REFERENCES "Salon"("id_salon") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Annotation_id_participation_fkey') THEN
        ALTER TABLE "Annotation"
        ADD CONSTRAINT "Annotation_id_participation_fkey"
        FOREIGN KEY ("id_participation") REFERENCES "Participation"("id_participation") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Annotation_id_angle_fkey') THEN
        ALTER TABLE "Annotation"
        ADD CONSTRAINT "Annotation_id_angle_fkey"
        FOREIGN KEY ("id_angle") REFERENCES "ElementPlaylistAngle"("id_angle") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
