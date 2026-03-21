-- CreateTable
CREATE TABLE IF NOT EXISTS "Salon" (
    "id_salon" SERIAL NOT NULL,
    "code_partage" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "id_participation_hoteID" INTEGER NOT NULL,
    "id_element_principalID" INTEGER,
    "maj_etat_le" TIMESTAMP(3) NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Salon_pkey" PRIMARY KEY ("id_salon")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Participation" (
    "id_participation" SERIAL NOT NULL,
    "id_utilisateurID" INTEGER NOT NULL,
    "id_salonID" INTEGER,
    "pseudo" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "rejoint_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quitte_le" TIMESTAMP(3),

    CONSTRAINT "Participation_pkey" PRIMARY KEY ("id_participation")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Utilisateur" (
    "id_utilisateur" SERIAL NOT NULL,
    "pseudo" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mot_de_passe_hache" TEXT NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id_utilisateur")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Message" (
    "id_message" SERIAL NOT NULL,
    "id_ParticipationID" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id_message")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Playlist" (
    "id_playlist" SERIAL NOT NULL,
    "id_salonID" INTEGER NOT NULL,
    "id_particiaptionID" INTEGER,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id_playlist")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ElementPlaylist" (
    "id_element_playlist" SERIAL NOT NULL,
    "id_playlistID" INTEGER NOT NULL,
    "fournisseur" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "etat_lecture" TEXT NOT NULL DEFAULT 'pause',
    "horodatage_sec" INTEGER NOT NULL DEFAULT 0,
    "ajoutee_parID" INTEGER NOT NULL,

    CONSTRAINT "ElementPlaylist_pkey" PRIMARY KEY ("id_element_playlist")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EtatSalonHistorique" (
    "id_eta" SERIAL NOT NULL,
    "id_salonID" INTEGER NOT NULL,
    "video_id" TEXT NOT NULL,
    "etat_lecture" TEXT NOT NULL,
    "horodatage_sec" INTEGER NOT NULL,
    "vitesse" TEXT NOT NULL,
    "enregistree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EtatSalonHistorique_pkey" PRIMARY KEY ("id_eta")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BanIp" (
    "id_ban" SERIAL NOT NULL,
    "id_salonID" INTEGER NOT NULL,
    "ip" TEXT NOT NULL,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "raison" TEXT NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BanIp_pkey" PRIMARY KEY ("id_ban")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BanUtilisateur" (
    "id_ban_user" SERIAL NOT NULL,
    "id_salonID" INTEGER NOT NULL,
    "id_utilisateurID" INTEGER NOT NULL,

    CONSTRAINT "BanUtilisateur_pkey" PRIMARY KEY ("id_ban_user")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Salon_id_participation_hoteID_key" ON "Salon"("id_participation_hoteID");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Salon_id_element_principalID_key" ON "Salon"("id_element_principalID");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Playlist_id_salonID_key" ON "Playlist"("id_salonID");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Playlist_id_particiaptionID_key" ON "Playlist"("id_particiaptionID");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BanUtilisateur_id_utilisateurID_key" ON "BanUtilisateur"("id_utilisateurID");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Salon_id_participation_hoteID_fkey') THEN
        ALTER TABLE "Salon"
        ADD CONSTRAINT "Salon_id_participation_hoteID_fkey"
        FOREIGN KEY ("id_participation_hoteID") REFERENCES "Participation"("id_participation") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Salon_id_element_principalID_fkey') THEN
        ALTER TABLE "Salon"
        ADD CONSTRAINT "Salon_id_element_principalID_fkey"
        FOREIGN KEY ("id_element_principalID") REFERENCES "ElementPlaylist"("id_element_playlist") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Participation_id_utilisateurID_fkey') THEN
        ALTER TABLE "Participation"
        ADD CONSTRAINT "Participation_id_utilisateurID_fkey"
        FOREIGN KEY ("id_utilisateurID") REFERENCES "Utilisateur"("id_utilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Participation_id_salonID_fkey') THEN
        ALTER TABLE "Participation"
        ADD CONSTRAINT "Participation_id_salonID_fkey"
        FOREIGN KEY ("id_salonID") REFERENCES "Salon"("id_salon") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_id_ParticipationID_fkey') THEN
        ALTER TABLE "Message"
        ADD CONSTRAINT "Message_id_ParticipationID_fkey"
        FOREIGN KEY ("id_ParticipationID") REFERENCES "Participation"("id_participation") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Playlist_id_salonID_fkey') THEN
        ALTER TABLE "Playlist"
        ADD CONSTRAINT "Playlist_id_salonID_fkey"
        FOREIGN KEY ("id_salonID") REFERENCES "Salon"("id_salon") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Playlist_id_particiaptionID_fkey') THEN
        ALTER TABLE "Playlist"
        ADD CONSTRAINT "Playlist_id_particiaptionID_fkey"
        FOREIGN KEY ("id_particiaptionID") REFERENCES "Participation"("id_participation") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ElementPlaylist_id_playlistID_fkey') THEN
        ALTER TABLE "ElementPlaylist"
        ADD CONSTRAINT "ElementPlaylist_id_playlistID_fkey"
        FOREIGN KEY ("id_playlistID") REFERENCES "Playlist"("id_playlist") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ElementPlaylist_ajoutee_parID_fkey') THEN
        ALTER TABLE "ElementPlaylist"
        ADD CONSTRAINT "ElementPlaylist_ajoutee_parID_fkey"
        FOREIGN KEY ("ajoutee_parID") REFERENCES "Participation"("id_participation") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EtatSalonHistorique_id_salonID_fkey') THEN
        ALTER TABLE "EtatSalonHistorique"
        ADD CONSTRAINT "EtatSalonHistorique_id_salonID_fkey"
        FOREIGN KEY ("id_salonID") REFERENCES "Salon"("id_salon") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BanIp_id_salonID_fkey') THEN
        ALTER TABLE "BanIp"
        ADD CONSTRAINT "BanIp_id_salonID_fkey"
        FOREIGN KEY ("id_salonID") REFERENCES "Salon"("id_salon") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BanUtilisateur_id_salonID_fkey') THEN
        ALTER TABLE "BanUtilisateur"
        ADD CONSTRAINT "BanUtilisateur_id_salonID_fkey"
        FOREIGN KEY ("id_salonID") REFERENCES "Salon"("id_salon") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BanUtilisateur_id_utilisateurID_fkey') THEN
        ALTER TABLE "BanUtilisateur"
        ADD CONSTRAINT "BanUtilisateur_id_utilisateurID_fkey"
        FOREIGN KEY ("id_utilisateurID") REFERENCES "Utilisateur"("id_utilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
