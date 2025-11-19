import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Start seeding ...')

    // Creer user
    const user = await prisma.utilisateur.create({
        data: {
            pseudo: 'TestUser',
            email: 'test@example.com',
            mot_de_passe_hache: 'hashe_mdp_example',
        },
    })
    console.log('Created user:', user)

    // Creer salon
    const salon = await prisma.salon.create({
        data: {
            nom: 'Test Salon',
            code_partage: 'TEST1234',
            etat_lecture: 'PAUSE',
            fournisseur: 'YOUTUBE',
            video_id: 'dQw4w9WgXcQ',
            horodatage_sec: 0,
            id_participation_hote: {
                create: {
                    pseudo: 'HostUser',
                    role: 'HOST',
                    ip: '127.0.0.1',
                    id_utilisateurID: user.id_utilisateur
                }
            }
        },
    })
    console.log('Created salon:', salon)

    console.log('Seeding finished.')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
