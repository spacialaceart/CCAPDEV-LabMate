const demoStudents = [
    {
        type: "Student",
        firstName: "Student",
        lastName: "Student",
        email: "student@dlsu.edu.ph",
        securityAnswer: "test",
        department: "Computer Science",
        biography: "Student",
        image: "/uploads/profile-1.jpg",
        password: "student"
    },
    {
        type: "Student",
        firstName: "Angelo",
        lastName: "Rocha",
        email: "angelo_rocha@dlsu.edu.ph",
        securityAnswer: "test",
        password: "345",
        biography: "idk what to put here",
        image: "/uploads/profile-2.jpg",
        department: "Computer Science"
    },
    {
        type: "Student",
        firstName: "Grass",
        lastName: "Capote",
        email: "mary_grace_capote@dlsu.edu.ph",
        securityAnswer: "test",
        password: "456",
        biography: "send help",
        image: "/uploads/profile-3.jpg",
        department: "Computer Science"
    },
    {
        type: "Student",
        firstName: "Anja",
        lastName: "Gonzales",
        email: "anja_gonzales@dlsu.edu.ph",
        securityAnswer: "test",
        password: "234",
        biography: "i need sleep",
        image: "/uploads/profile-4.jpg",
        department: "Computer Science"
    },
    {
        type: "Student",
        firstName: "Liana",
        lastName: "Ho",
        email: "denise_liana_ho@dlsu.edu.ph",
        securityAnswer: "test",
        password: "123",
        biography: "idk stream tsunami sea yeah",
        image: "/uploads/profile-5.jpg",
        department: "Computer Science"
    }
];

const demoLabTechs = [
    {
        type: "LabTech",
        firstName: "Charlie",
        lastName: "Caronongan",
        email: "labtech@dlsu.edu.ph",
        securityAnswer: "test",
        password: "labtech",
        department: "Computer Science",
        biography: "Lab tech for DLSU. No, I am not a dog...",
        image: "/uploads/charlie.jpg"
    },
    {
        type: "LabTech",
        firstName: "Noah",
        lastName: "Davis",
        email: "noah_davis@dlsu.edu.ph",
        securityAnswer: "test",
        department: "Computer Science",
        biography: "I am a lab tech.",
        image: "/uploads/noah.jpg",
        password: "password123"
    },
    {
        type: "LabTech",
        firstName: "Michael",
        lastName: "Myers",
        email: "michael_myers@dlsu.edu.ph",
        securityAnswer: "test",
        biography: "*intense breathing in and out from mask sounds*",
        image: "/uploads/michael.jpg",
        password: "password123"
    }
];

const demoAdmins = [
    {
        type: "Admin",
        firstName: "Admin",
        lastName: "Admin",
        email: "admin@dlsu.edu.ph",
        securityAnswer: "test",
        biography: "Administrator account",
        password: "admin"
    }
];

const demoLaboratories = [
    {
        hall: "Gokongwei Hall",
        room: "GK404B",
        capacity: 20
    },
    {
        hall: "Br. Andrew Gonzales Hall",
        room: "AG1904",
        capacity: 40
    },
    {
        hall: "Gokongwei Hall",
        room: "GK201A",
        capacity: 20
    },
    {
        hall: "Br. Andrew Gonzales Hall",
        room: "AG1706",
        capacity: 40
    },
    {
        hall: "Gokongwei Hall",
        room: "GK302A",
        capacity: 20
    }
];

module.exports = {
    demoStudents,
    demoLabTechs,
    demoAdmins,
    demoLaboratories
};
