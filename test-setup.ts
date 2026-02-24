import { prisma } from './src/lib/prisma';
import bcrypt from 'bcrypt';

async function main() {
    console.log("Starting...");
    const adminCount = await prisma.adminUser.count();
    console.log("Count:", adminCount);

    if (adminCount > 0) {
        console.log("Setup already complete.");
        return;
    }

    console.log("Hashing password...");
    const password_hash = await bcrypt.hash('password123', 10);
    console.log("Hash:", password_hash);

    console.log("Creating empresa...");
    const empresa = await prisma.empresa.create({ data: { nombre: 'MrProspect MVP' } });
    console.log("Empresa:", empresa.id);

    console.log("Creating superadmin...");
    const user = await prisma.adminUser.create({
        data: { email: 'admin@mrprospect.com', password_hash, role: 'SUPERADMIN', empresa_id: empresa.id }
    });
    console.log("User:", user.email);
}
main().catch(console.error).finally(() => process.exit(0));
