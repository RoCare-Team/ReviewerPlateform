/**
 * India states/UTs → major cities dataset, for the state+city picker on the
 * create-campaign form (see components/ui/StateCitySelect.jsx). Not every
 * town in India — a curated list of state capitals, district headquarters,
 * and other well-known cities/business hubs per state, enough to cover
 * where a real business or reviewer actually is.
 *
 * Kept as a plain JS module (not fetched) since it's small enough to ship
 * in the client bundle and needs zero network round-trip for instant search.
 */
export const INDIA_STATES = [
  {
    name: "Andhra Pradesh",
    cities: ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Rajahmundry", "Tirupati", "Kadapa", "Kakinada", "Anantapur", "Eluru", "Ongole", "Chittoor", "Srikakulam", "Machilipatnam"],
  },
  {
    name: "Arunachal Pradesh",
    cities: ["Itanagar", "Naharlagun", "Pasighat", "Tawang", "Ziro", "Bomdila"],
  },
  {
    name: "Assam",
    cities: ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon", "Tinsukia", "Tezpur", "Bongaigaon", "Karimganj", "Sivasagar"],
  },
  {
    name: "Bihar",
    cities: ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga", "Purnia", "Arrah", "Begusarai", "Katihar", "Munger", "Chhapra", "Bihar Sharif"],
  },
  {
    name: "Chhattisgarh",
    cities: ["Raipur", "Bhilai", "Bilaspur", "Korba", "Durg", "Rajnandgaon", "Jagdalpur", "Raigarh", "Ambikapur"],
  },
  {
    name: "Goa",
    cities: ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda", "Bicholim"],
  },
  {
    name: "Gujarat",
    cities: ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Junagadh", "Gandhinagar", "Anand", "Nadiad", "Morbi", "Mehsana", "Bharuch", "Vapi", "Navsari"],
  },
  {
    name: "Haryana",
    cities: ["Gurugram", "Faridabad", "Panipat", "Ambala", "Yamunanagar", "Rohtak", "Hisar", "Karnal", "Sonipat", "Panchkula", "Bhiwani", "Sirsa"],
  },
  {
    name: "Himachal Pradesh",
    cities: ["Shimla", "Manali", "Dharamshala", "Solan", "Mandi", "Kullu", "Hamirpur", "Una", "Bilaspur"],
  },
  {
    name: "Jharkhand",
    cities: ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Deoghar", "Hazaribagh", "Giridih", "Ramgarh"],
  },
  {
    name: "Karnataka",
    cities: ["Bengaluru", "Mysuru", "Hubballi", "Mangaluru", "Belagavi", "Kalaburagi", "Davanagere", "Ballari", "Shivamogga", "Tumakuru", "Udupi", "Vijayapura", "Hassan", "Mandya"],
  },
  {
    name: "Kerala",
    cities: ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam", "Kannur", "Alappuzha", "Kottayam", "Palakkad", "Malappuram", "Idukki", "Wayanad"],
  },
  {
    name: "Madhya Pradesh",
    cities: ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Dewas", "Satna", "Ratlam", "Rewa", "Katni", "Singrauli"],
  },
  {
    name: "Maharashtra",
    cities: ["Mumbai", "Pune", "Nagpur", "Nashik", "Thane", "Aurangabad", "Solapur", "Kolhapur", "Amravati", "Navi Mumbai", "Sangli", "Akola", "Latur", "Dhule", "Jalgaon", "Ahmednagar"],
  },
  {
    name: "Manipur",
    cities: ["Imphal", "Thoubal", "Bishnupur", "Churachandpur"],
  },
  {
    name: "Meghalaya",
    cities: ["Shillong", "Tura", "Jowai", "Nongstoin"],
  },
  {
    name: "Mizoram",
    cities: ["Aizawl", "Lunglei", "Champhai", "Serchhip"],
  },
  {
    name: "Nagaland",
    cities: ["Kohima", "Dimapur", "Mokokchung", "Tuensang"],
  },
  {
    name: "Odisha",
    cities: ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur", "Puri", "Balasore", "Bhadrak", "Baripada"],
  },
  {
    name: "Punjab",
    cities: ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali", "Hoshiarpur", "Moga", "Pathankot", "Firozpur"],
  },
  {
    name: "Rajasthan",
    cities: ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer", "Bikaner", "Alwar", "Bharatpur", "Sikar", "Bhilwara", "Pali", "Sri Ganganagar"],
  },
  {
    name: "Sikkim",
    cities: ["Gangtok", "Namchi", "Gyalshing", "Mangan"],
  },
  {
    name: "Tamil Nadu",
    cities: ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli", "Erode", "Vellore", "Thoothukudi", "Dindigul", "Thanjavur", "Nagercoil", "Kanchipuram"],
  },
  {
    name: "Telangana",
    cities: ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam", "Ramagundam", "Mahbubnagar", "Nalgonda", "Secunderabad"],
  },
  {
    name: "Tripura",
    cities: ["Agartala", "Udaipur", "Dharmanagar", "Kailashahar"],
  },
  {
    name: "Uttar Pradesh",
    cities: ["Lucknow", "Kanpur", "Ghaziabad", "Agra", "Varanasi", "Meerut", "Prayagraj", "Noida", "Bareilly", "Aligarh", "Moradabad", "Saharanpur", "Gorakhpur", "Firozabad", "Jhansi", "Muzaffarnagar", "Mathura"],
  },
  {
    name: "Uttarakhand",
    cities: ["Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rudrapur", "Rishikesh", "Nainital", "Kashipur"],
  },
  {
    name: "West Bengal",
    cities: ["Kolkata", "Howrah", "Durgapur", "Asansol", "Siliguri", "Bardhaman", "Malda", "Kharagpur", "Haldia", "Darjeeling"],
  },
  {
    name: "Andaman and Nicobar Islands",
    cities: ["Port Blair"],
  },
  {
    name: "Chandigarh",
    cities: ["Chandigarh"],
  },
  {
    name: "Dadra and Nagar Haveli and Daman and Diu",
    cities: ["Daman", "Diu", "Silvassa"],
  },
  {
    name: "Delhi",
    cities: ["New Delhi", "Dwarka", "Rohini", "Saket", "Karol Bagh", "Connaught Place", "Janakpuri", "Pitampura"],
  },
  {
    name: "Jammu and Kashmir",
    cities: ["Srinagar", "Jammu", "Anantnag", "Baramulla", "Udhampur", "Kathua"],
  },
  {
    name: "Ladakh",
    cities: ["Leh", "Kargil"],
  },
  {
    name: "Lakshadweep",
    cities: ["Kavaratti"],
  },
  {
    name: "Puducherry",
    cities: ["Puducherry", "Karaikal", "Yanam", "Mahe"],
  },
];

/** Best-effort reverse lookup: which state a city belongs to (case-insensitive). */
export function findStateForCity(cityName) {
  if (!cityName) return null;
  const needle = cityName.trim().toLowerCase();
  for (const state of INDIA_STATES) {
    if (state.cities.some((c) => c.toLowerCase() === needle)) return state.name;
  }
  return null;
}
