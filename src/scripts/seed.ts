import { ObjectId } from "mongodb";
import { connectDB, closeDB } from "../config/db.js";
import {
  getUsersCollection,
  getBloodRequestsCollection,
  getDonationsCollection,
} from "../db/collections.js";
import {
  BloodGroup,
  District,
  UserRole,
  Urgency,
  RequestStatus,
} from "../types/shared.js";

/**
 * Seed script for creating demo data (Req 1.11)
 * This script is idempotent - safe to run multiple times
 */

const DEMO_EMAIL = "demo@bloodos.app";
const DEMO_PASSWORD_HASH = "$2a$10$YourHashedPasswordHere"; // In production, this would be properly hashed

const seedDemoAccount = async () => {
  console.log("🌱 Starting seed script...");

  try {
    await connectDB();
    const usersCollection = getUsersCollection();

    // Check if demo account already exists
    const existingDemo = await usersCollection.findOne({ email: DEMO_EMAIL });

    if (existingDemo) {
      console.log("  ℹ Demo account already exists, skipping...");
      return existingDemo;
    }

    // Create demo account
    const demoUser = {
      _id: new ObjectId(),
      id: new ObjectId().toString(),
      email: DEMO_EMAIL,
      emailVerified: true,
      name: "Demo User",
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Extended BloodOS fields
      role: UserRole.USER,
      phone: "01712345678",
      district: District.DHAKA,
      bloodGroup: BloodGroup.O_POSITIVE,
      isDonor: true,
      lastDonationDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
    };

    await usersCollection.insertOne(demoUser);
    console.log("  ✓ Demo account created:", DEMO_EMAIL);

    return demoUser;
  } catch (error) {
    console.error("  ❌ Error creating demo account:", error);
    throw error;
  }
};

const seedSampleUsers = async () => {
  console.log("🌱 Seeding sample users...");

  try {
    const usersCollection = getUsersCollection();

    // Sample users across different districts and blood groups
    const sampleUsers = [
      {
        _id: new ObjectId(),
        id: new ObjectId().toString(),
        email: "donor1@example.com",
        emailVerified: true,
        name: "Karim Rahman",
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: UserRole.USER,
        phone: "01712345679",
        district: District.CHITTAGONG,
        bloodGroup: BloodGroup.A_POSITIVE,
        isDonor: true,
        lastDonationDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), // 120 days ago
      },
      {
        _id: new ObjectId(),
        id: new ObjectId().toString(),
        email: "donor2@example.com",
        emailVerified: true,
        name: "Fatima Akter",
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: UserRole.USER,
        phone: "01812345678",
        district: District.DHAKA,
        bloodGroup: BloodGroup.B_POSITIVE,
        isDonor: true,
        lastDonationDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      },
      {
        _id: new ObjectId(),
        id: new ObjectId().toString(),
        email: "donor3@example.com",
        emailVerified: true,
        name: "Amit Kumar",
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: UserRole.USER,
        phone: "01912345678",
        district: District.SYLHET,
        bloodGroup: BloodGroup.O_NEGATIVE,
        isDonor: true,
        lastDonationDate: null, // Never donated
      },
      {
        _id: new ObjectId(),
        id: new ObjectId().toString(),
        email: "admin@bloodos.app",
        emailVerified: true,
        name: "Admin User",
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: UserRole.ADMIN,
        phone: "01712345680",
        district: District.DHAKA,
        bloodGroup: BloodGroup.AB_POSITIVE,
        isDonor: false,
        lastDonationDate: null,
      },
    ];

    // Insert only if they don't exist
    for (const user of sampleUsers) {
      const existing = await usersCollection.findOne({ email: user.email });
      if (!existing) {
        await usersCollection.insertOne(user);
        console.log(`  ✓ Created user: ${user.email}`);
      } else {
        console.log(`  ℹ User already exists: ${user.email}`);
      }
    }

    return sampleUsers;
  } catch (error) {
    console.error("  ❌ Error seeding sample users:", error);
    throw error;
  }
};

const seedSampleRequests = async (users: any[]) => {
  console.log("🌱 Seeding sample blood requests...");

  try {
    const requestsCollection = getBloodRequestsCollection();

    // Find a non-admin user to create requests
    const requester =
      users.find((u) => u.email === "demo@bloodos.app") || users[0];

    if (!requester) {
      console.log("  ⚠ No users found to create requests");
      return;
    }

    const sampleRequests = [
      {
        _id: new ObjectId(),
        userId: requester._id,
        patientName: "Dilruba Yasmin",
        bloodGroup: BloodGroup.O_POSITIVE,
        unitsNeeded: 2,
        hospitalName: "National Institute of Cardiovascular Diseases (NICVD)",
        hospitalAddress: "Sher-e-Bangla Nagar, Dhaka-1207",
        district: District.DHAKA,
        urgency: Urgency.CRITICAL,
        status: RequestStatus.OPEN,
        neededByDate: new Date(Date.now() + 4 * 60 * 60 * 1000), // in 4 hours
        contactPhone: "01712345678",
        additionalNotes:
          "Emergency coronary artery bypass grafting (CABG). Cross-matching sample is at blood bank.",
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
        updatedAt: new Date(),
      },
      {
        _id: new ObjectId(),
        userId: requester._id,
        patientName: "Tariqul Islam",
        bloodGroup: BloodGroup.B_POSITIVE,
        unitsNeeded: 3,
        hospitalName: "Chittagong Medical College Hospital (CMCH)",
        hospitalAddress: "57 K.B. Fazlul Kader Road, Panchlaish, Chittagong",
        district: District.CHITTAGONG,
        urgency: Urgency.CRITICAL,
        status: RequestStatus.OPEN,
        neededByDate: new Date(Date.now() + 8 * 60 * 60 * 1000), // in 8 hours
        contactPhone: "01819876543",
        additionalNotes:
          "Severe polytrauma following highway road accident. Active internal hemorrhage in OT-2.",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        updatedAt: new Date(),
      },
      {
        _id: new ObjectId(),
        userId: requester._id,
        patientName: "Nusrat Jahan",
        bloodGroup: BloodGroup.A_NEGATIVE,
        unitsNeeded: 2,
        hospitalName: "Sylhet MAG Osmani Medical College Hospital",
        hospitalAddress: "Medical Road, Kazir Bazar, Sylhet-3100",
        district: District.SYLHET,
        urgency: Urgency.URGENT,
        status: RequestStatus.OPEN,
        neededByDate: new Date(Date.now() + 18 * 60 * 60 * 1000), // in 18 hours
        contactPhone: "01911223344",
        additionalNotes:
          "Post-partum hemorrhage in gynecology ward 4. Rh-negative blood urgently required.",
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        updatedAt: new Date(),
      },
      {
        _id: new ObjectId(),
        userId: requester._id,
        patientName: "Master Rafan Hossain",
        bloodGroup: BloodGroup.AB_POSITIVE,
        unitsNeeded: 1,
        hospitalName: "Rajshahi Medical College Hospital (RMCH)",
        hospitalAddress: "Laxmipur, Rajshahi-6000",
        district: District.RAJSHAHI,
        urgency: Urgency.URGENT,
        status: RequestStatus.OPEN,
        neededByDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // in 24 hours
        contactPhone: "01733445566",
        additionalNotes:
          "Pediatric Thalassemia routine exchange transfusion. Washed RBC required.",
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        updatedAt: new Date(),
      },
      {
        _id: new ObjectId(),
        userId: requester._id,
        patientName: "Al-Amin Gazi",
        bloodGroup: BloodGroup.O_NEGATIVE,
        unitsNeeded: 2,
        hospitalName: "Khulna Medical College Hospital",
        hospitalAddress: "Boyra Main Road, Khulna-9000",
        district: District.KHULNA,
        urgency: Urgency.CRITICAL,
        status: RequestStatus.OPEN,
        neededByDate: new Date(Date.now() + 6 * 60 * 60 * 1000), // in 6 hours
        contactPhone: "01677889900",
        additionalNotes:
          "Emergency gastrointestinal bleeding in ICU. Rare O-negative whole blood needed immediately.",
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        updatedAt: new Date(),
      },
      {
        _id: new ObjectId(),
        userId: requester._id,
        patientName: "Shahanara Parvin",
        bloodGroup: BloodGroup.A_POSITIVE,
        unitsNeeded: 2,
        hospitalName: "Mymensingh Medical College Hospital (MMCH)",
        hospitalAddress: "Charpara, Mymensingh-2200",
        district: District.MYMENSINGH,
        urgency: Urgency.MODERATE,
        status: RequestStatus.OPEN,
        neededByDate: new Date(Date.now() + 48 * 60 * 60 * 1000), // in 48 hours
        contactPhone: "01555667788",
        additionalNotes:
          "Elective oncological resection scheduled for Monday morning. Pre-operative reservation.",
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        updatedAt: new Date(),
      },
    ];

    // Check by patientName and district to prevent duplicate inserts on re-runs
    for (const request of sampleRequests) {
      const existing = await requestsCollection.findOne({
        patientName: request.patientName,
        district: request.district,
      });
      if (!existing) {
        await requestsCollection.insertOne(request);
        console.log(`  ✓ Created request for: ${request.patientName} (${request.bloodGroup}, ${request.district})`);
      } else {
        // Update to ensure neededByDate and status are fresh
        await requestsCollection.updateOne(
          { _id: existing._id },
          {
            $set: {
              neededByDate: request.neededByDate,
              status: RequestStatus.OPEN,
              urgency: request.urgency,
              unitsNeeded: request.unitsNeeded,
              hospitalName: request.hospitalName,
              hospitalAddress: request.hospitalAddress,
              contactPhone: request.contactPhone,
              additionalNotes: request.additionalNotes,
              updatedAt: new Date(),
            },
          }
        );
        console.log(`  ✓ Refreshed existing request for: ${request.patientName} (${request.bloodGroup}, ${request.district})`);
      }
    }
  } catch (error) {
    console.error("  ❌ Error seeding sample requests:", error);
    throw error;
  }
};

const seedSampleDonations = async (users: any[]) => {
  console.log("🌱 Seeding sample donations...");

  try {
    const donationsCollection = getDonationsCollection();

    // Find donors
    const donors = users.filter((u) => u.isDonor);

    if (donors.length === 0) {
      console.log("  ⚠ No donors found to create donations");
      return;
    }

    const sampleDonations = [
      {
        _id: new ObjectId(),
        userId: donors[0]._id,
        donationDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
        bloodGroup: donors[0].bloodGroup,
        hospitalName: "Dhaka Medical College Hospital",
        district: donors[0].district,
        verified: true,
        verifiedBy: users.find((u) => u.role === UserRole.ADMIN)?._id || null,
        verifiedAt: new Date(Date.now() - 99 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      },
    ];

    // Insert only if they don't exist
    for (const donation of sampleDonations) {
      const existing = await donationsCollection.findOne({ _id: donation._id });
      if (!existing) {
        await donationsCollection.insertOne(donation);
        console.log("  ✓ Created donation record");
      } else {
        console.log("  ℹ Donation record already exists");
      }
    }
  } catch (error) {
    console.error("  ❌ Error seeding sample donations:", error);
    throw error;
  }
};

/**
 * Main seed function
 */
const seed = async () => {
  try {
    // Seed demo account
    const demoUser = await seedDemoAccount();

    // Seed sample users
    const sampleUsers = await seedSampleUsers();
    const allUsers = [demoUser, ...sampleUsers];

    // Seed sample blood requests
    await seedSampleRequests(allUsers);

    // Seed sample donations
    await seedSampleDonations(allUsers);

    console.log("✅ Seed script completed successfully");
  } catch (error) {
    console.error("❌ Seed script failed:", error);
    process.exit(1);
  } finally {
    await closeDB();
  }
};

// Run seed if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
}

export { seed };
