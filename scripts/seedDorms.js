const mongoose = require('mongoose');
require('dotenv').config();
const Dorm = require('../models/Dorm');

const dorms = [
  {
    name: "Silver Oak Premium Hostel",
    description: "Experience luxury living in the heart of the city. Our premium suites offer individual study spaces, high-speed WiFi, and a vibrant community atmosphere. Perfect for students who prioritize comfort and productivity.",
    price: 18000,
    beds: 1,
    block: "A",
    type: "premium",
    image: "https://images.unsplash.com/photo-1555854811-8222883070bc?auto=format&fit=crop&q=80&w=800",
    images: [
      "https://images.unsplash.com/photo-1555854811-8222883070bc?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&q=80&w=800"
    ],
    amenities: ['WiFi', 'Air Conditioning', 'Laundry', 'Furnished', 'Study Table', 'Attached Bathroom', 'Security'],
    isPopular: true,
    isFeatured: true,
    rating: 4.8,
    totalReviews: 24
  },
  {
    name: "Lakeside Student Living",
    description: "Located right next to the university park, Lakeside offers a serene environment for focused studying. Our two-seater rooms are spacious and well-ventilated.",
    price: 12000,
    beds: 2,
    block: "B",
    type: "two-seater",
    image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80&w=800",
    images: [
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=800"
    ],
    amenities: ['WiFi', 'Power Backup', 'CCTV', 'Security'],
    isPopular: false,
    isFeatured: false,
    rating: 4.2,
    totalReviews: 12
  },
  {
    name: "The Hub Dormitory",
    description: "Affordable and social! The Hub is designed for students who love to collaborate. Our shared rooms are the most budget-friendly option in the city.",
    price: 7500,
    beds: 4,
    block: "D",
    type: "shared",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=800",
    images: [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=800"
    ],
    amenities: ['WiFi', 'Kitchen', 'Laundry', 'Wardrobe'],
    isPopular: true,
    isFeatured: false,
    rating: 4.0,
    totalReviews: 45
  },
  {
    name: "Green Valley Boys Hostel",
    description: "Eco-friendly living with lots of open space. We offer large gardens and outdoor study areas in addition to comfortable three-seater rooms.",
    price: 10500,
    beds: 3,
    block: "C",
    type: "three-seater",
    image: "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&q=80&w=800",
    images: [
      "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&q=80&w=800"
    ],
    amenities: ['WiFi', 'Parking', 'Laundry', 'Balcony', 'Hot Water'],
    isVerified: true,
    rating: 4.5,
    totalReviews: 18
  },
  {
    name: "Modern Scholars Residence",
    description: "Sleek, modern design with all top-tier amenities. Fully furnished single rooms for those who value privacy and style.",
    price: 22000,
    beds: 1,
    block: "A",
    type: "premium",
    image: "https://images.unsplash.com/photo-1505691938895-1758d7eaa511?auto=format&fit=crop&q=80&w=800",
    images: [
      "https://images.unsplash.com/photo-1505691938895-1758d7eaa511?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&q=80&w=800"
    ],
    amenities: ['WiFi', 'Air Conditioning', 'Gym', 'TV', 'Kitchen', 'Attached Bathroom'],
    isFeatured: true,
    isNew: true,
    rating: 4.9,
    totalReviews: 8
  },
  {
    name: "Trinity Square Hostel",
    description: "Centrally located near the main student market. Trinity Square provides easy access to all city amenities and vibrant nightlife.",
    price: 9000,
    beds: 2,
    block: "B",
    type: "two-seater",
    image: "https://images.unsplash.com/photo-1536376074432-cd424450c260?auto=format&fit=crop&q=80&w=800",
    amenities: ['WiFi', 'Security', 'Wardrobe', 'CCTV'],
    rating: 4.1,
    totalReviews: 32
  },
  {
    name: "Harmony Girls Dorm",
    description: "A safe and supportive environment for female students. Our facilities include a common room for social events and strict 24/7 security.",
    price: 13500,
    beds: 2,
    block: "E",
    type: "two-seater",
    image: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&q=80&w=800",
    amenities: ['WiFi', 'Laundry', 'Security', 'CCTV'],
    isPopular: true,
    isVerified: true,
    rating: 4.7,
    totalReviews: 29
  },
  {
    name: "Budget Stay Rooms",
    description: "No-frills accommodation for the practical student. Clean, safe, and right on the bus route to campus.",
    price: 6000,
    beds: 4,
    block: "F",
    type: "shared",
    image: "https://images.unsplash.com/photo-1544062894-245b8547ca3c?auto=format&fit=crop&q=80&w=800",
    amenities: ['WiFi', 'Power Backup', 'Security'],
    rating: 3.8,
    totalReviews: 15
  },
  {
    name: "Apex Elite Dorms",
    description: "High-end living with professional management. Each floor has its own kitchen and lounge area.",
    price: 15500,
    beds: 1,
    block: "A",
    type: "single",
    image: "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&q=80&w=800",
    amenities: ['WiFi', 'Air Conditioning', 'Study Table', 'Attached Bathroom'],
    isPopular: true,
    rating: 4.6,
    totalReviews: 21
  },
  {
    name: "Blue Horizon Hostel",
    description: "Cool blue aesthetic with a focus on peace and quiet. Ideal for postgraduate students and researchers.",
    price: 11000,
    beds: 2,
    block: "C",
    type: "two-seater",
    image: "https://images.unsplash.com/photo-1616594111350-b797371a5390?auto=format&fit=crop&q=80&w=800",
    amenities: ['WiFi', 'Study Table', 'Parking'],
    rating: 4.4,
    totalReviews: 10
  },
  {
    name: "Metro Living Suites",
    description: "Live close to the subway. Metro Living offers compact but highly functional rooms designed for the modern urban student.",
    price: 14000,
    beds: 1,
    block: "B",
    type: "single",
    image: "https://images.unsplash.com/photo-1512918766671-ad6519639207?auto=format&fit=crop&q=80&w=800",
    amenities: ['WiFi', 'Security', 'Laundry'],
    isNew: true,
    rating: 4.3,
    totalReviews: 5
  },
  {
    name: "Serenity Heights",
    description: "Located on a hill overlooking the university. Fresh air and quiet surroundings make this the perfect place for high-achievers.",
    price: 16500,
    beds: 1,
    block: "D",
    type: "premium",
    image: "https://images.unsplash.com/photo-1594488651390-00aa9cbcc549?auto=format&fit=crop&q=80&w=800",
    amenities: ['WiFi', 'Air Conditioning', 'Balcony', 'Gym'],
    isFeatured: true,
    rating: 4.7,
    totalReviews: 14
  },
  {
    name: "Co-Living Connect",
    description: "The ultimate social dormitory experience. Large common areas and regular community events.",
    price: 8500,
    beds: 3,
    block: "A",
    type: "three-seater",
    image: "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&q=80&w=800",
    amenities: ['WiFi', 'Kitchen', 'Laundry'],
    rating: 4.2,
    totalReviews: 38
  },
  {
    name: "The Scholar's Nest",
    description: "Quiet, book-filled, and scholarly. We provide the best study environment with 24/7 library access and silent zones.",
    price: 12500,
    beds: 2,
    block: "B",
    type: "two-seater",
    image: "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&q=80&w=800",
    amenities: ['WiFi', 'Study Table', 'Security'],
    isVerified: true,
    rating: 4.6,
    totalReviews: 22
  },
  {
    name: "Pioneer Port",
    description: "For the tech-savvy student. High-speed fiber internet and smart home features in every room.",
    price: 19000,
    beds: 1,
    block: "C",
    type: "premium",
    image: "https://images.unsplash.com/photo-1515362778563-6a8d0e44bc6b?auto=format&fit=crop&q=80&w=800",
    amenities: ['WiFi', 'Air Conditioning', 'Security', 'Attached Bathroom'],
    isPopular: true,
    rating: 4.8,
    totalReviews: 17
  },
  {
    name: "Central Park Dorms",
    description: "Overlooking the main park. A beautiful place to live and relax after a long day of lectures.",
    price: 11500,
    beds: 2,
    block: "D",
    type: "two-seater",
    image: "https://images.unsplash.com/photo-1562438668-bcf0ca6578f0?auto=format&fit=crop&q=80&w=800",
    amenities: ['WiFi', 'Balcony', 'Hot Water', 'Laundry'],
    rating: 4.5,
    totalReviews: 31
  },
  {
    name: "Gateway Hostel",
    description: "The gateway to your academic success. Reliable staff and all the basics you need for a comfortable stay.",
    price: 9500,
    beds: 3,
    block: "E",
    type: "three-seater",
    image: "https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&q=80&w=800",
    amenities: ['WiFi', 'Security', 'CCTV', 'Wardrobe'],
    rating: 4.0,
    totalReviews: 50
  },
  {
    name: "Urban Pulse Residency",
    description: "Modern lifestyle in a compact space. Close to cafes, libraries, and the student union.",
    price: 13000,
    beds: 2,
    block: "A",
    type: "two-seater",
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=800",
    amenities: ['WiFi', 'Laundry', 'Security'],
    isNew: true,
    rating: 4.4,
    totalReviews: 12
  },
  {
    name: "Comfort Cove",
    description: "A cozy and warm environment. We make sure you feel at home away from home.",
    price: 10000,
    beds: 4,
    block: "B",
    type: "shared",
    image: "https://images.unsplash.com/photo-1536376074432-cd424450c260?auto=format&fit=crop&q=80&w=800",
    amenities: ['WiFi', 'Kitchen', 'Hot Water'],
    rating: 4.1,
    totalReviews: 19
  },
  {
    name: "Star Studded Hostel",
    description: "Top-rated by students for 5 years straight. Excellence in hostel management and student care.",
    price: 15000,
    beds: 1,
    block: "C",
    type: "single",
    image: "https://images.unsplash.com/photo-1555854811-8222883070bc?auto=format&fit=crop&q=80&w=800",
    amenities: ['WiFi', 'Air Conditioning', 'Attached Bathroom', 'Security', 'Gym'],
    isPopular: true,
    isFeatured: true,
    rating: 4.9,
    totalReviews: 62
  }
];

const seedDB = async () => {
  try {
    const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/dormaxis';
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB for seeding');

    // Optional: Clear existing dorms
    const clearExisting = process.argv.includes('--clear');
    if (clearExisting) {
      await Dorm.deleteMany({});
      console.log('🗑️  Cleared existing dorms');
    }

    await Dorm.insertMany(dorms);
    console.log(`✅ Successfully seeded ${dorms.length} dorms!`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding error:', err);
    process.exit(1);
  }
};

seedDB();
