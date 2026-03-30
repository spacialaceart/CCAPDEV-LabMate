require("../config/loadEnv");

const mongoose = require("mongoose");
const argon2 = require("argon2");

const { DATABASE_URI } = require("../config/pageConfigs");
const User = require("./models/User");
const Laboratory = require("./models/Laboratory");
const { seedReservations } = require("./seedReservations");
const { ensureAdminAccount } = require("./adminAccount");
const {
    demoStudents,
    demoLabTechs,
    demoLaboratories
} = require("./seedData");

async function hashSeedUsers(users) {
    return Promise.all(
        users.map(async (user) => ({
            ...user,
            password: await argon2.hash(user.password)
        }))
    );
}

const seedDatabase = async () => {
    const shouldManageConnection = mongoose.connection.readyState === 0;

    try {
        if (shouldManageConnection) {
            await mongoose.connect(process.env.DATABASE_URL || DATABASE_URI);
            console.log("Connected to MongoDB");
        }

        // Clear existing data
        await User.deleteMany({});
        await Laboratory.deleteMany({});
        
        console.log('Previous data cleared');

        // Hash all passwords
        const hashedStudents = await hashSeedUsers(demoStudents);
        const hashedLabTechs = await hashSeedUsers(demoLabTechs);

        // Insert new demo data
        await User.insertMany(hashedStudents);
        console.log('Demo students added');

        await User.insertMany(hashedLabTechs);
        console.log('Demo lab techs added');

        await Laboratory.insertMany(demoLaboratories);
        console.log('Demo laboratories added');

        // seed reservations once users and labs are added
        await seedReservations();
        console.log('Demo reservations added');

        await ensureAdminAccount();
        console.log("Default admin account ensured");

        console.log('Database seeded successfully');
    } catch (error) {
        console.error('Error seeding database:', error);
        throw error;
    } finally {
        if (shouldManageConnection) {
            await mongoose.disconnect();
        }
    }
};

if (require.main === module) {
    seedDatabase()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { seedDatabase };
