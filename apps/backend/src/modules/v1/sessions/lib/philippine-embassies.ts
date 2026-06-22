/**
 * Comprehensive list of Philippine embassies, consulates, and honorary consul offices worldwide.
 * Used for verifying if a PRINCIPAL user is within 1km of a valid Philippine diplomatic mission.
 *
 * Data sources:
 * - Department of Foreign Affairs (DFA) Philippines
 * - Philippine Embassy websites
 * - Public geographic databases
 *
 * Note: Coordinates are approximate and may require periodic updates.
 */

export interface EmbassyLocation {
	name: string
	type: "embassy" | "consulate" | "honorary_consul"
	country: string
	city: string
	coordinates: { lat: number; lng: number }
	address?: string
}

export const PHILIPPINE_EMBASSIES: EmbassyLocation[] = [
	// ===== AMERICAS =====
	// United States
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "United States",
		city: "Washington, D.C.",
		coordinates: { lat: 38.9074, lng: -77.0381 },
		address: "1600 Massachusetts Avenue N.W., Washington, D.C. 20036",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "United States",
		city: "New York",
		coordinates: { lat: 40.7614, lng: -73.9776 },
		address: "556 Fifth Avenue, New York, NY 10036",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "United States",
		city: "Los Angeles",
		coordinates: { lat: 34.0622, lng: -118.3075 },
		address: "3435 Wilshire Boulevard, Suite 550, Los Angeles, CA 90010",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "United States",
		city: "San Francisco",
		coordinates: { lat: 37.7876, lng: -122.4064 },
		address: "447 Sutter Street, 6th Floor, San Francisco, CA 94108",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "United States",
		city: "Chicago",
		coordinates: { lat: 41.8841, lng: -87.6246 },
		address: "122 South Michigan Avenue, Suite 1600, Chicago, IL 60603",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "United States",
		city: "Honolulu",
		coordinates: { lat: 21.3069, lng: -157.8583 },
		address: "2433 Pali Highway, Honolulu, HI 96817",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "United States",
		city: "Houston",
		coordinates: { lat: 29.7604, lng: -95.3698 },
		address: "9990 Richmond Avenue, Suite 100N, Houston, TX 77042",
	},
	{
		name: "Philippine Consulate",
		type: "consulate",
		country: "United States",
		city: "Agana (Guam)",
		coordinates: { lat: 13.4757, lng: 144.7489 },
		address: "Suite 601-602 ITC Building, 590 South Marine Corps Drive, Tamuning, Guam 96913",
	},
	// Canada
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Canada",
		city: "Ottawa",
		coordinates: { lat: 45.4215, lng: -75.6972 },
		address: "30 Murray Street, Ottawa, Ontario K1N 5M4",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "Canada",
		city: "Toronto",
		coordinates: { lat: 43.6532, lng: -79.3832 },
		address: "160 Eglinton Avenue East, Suite 200, Toronto, Ontario M4P 3B5",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "Canada",
		city: "Vancouver",
		coordinates: { lat: 49.2827, lng: -123.1207 },
		address: "999 Canada Place, Suite 660, Vancouver, BC V6C 3E1",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "Canada",
		city: "Calgary",
		coordinates: { lat: 51.0447, lng: -114.0719 },
		address: "215-5508 4th Street SW, Calgary, Alberta T2V 1N2",
	},
	// Mexico
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Mexico",
		city: "Mexico City",
		coordinates: { lat: 19.4326, lng: -99.1332 },
		address: "Temístocles 1617, Polanco V Sección, Miguel Hidalgo, 11560 Ciudad de México",
	},
	// Brazil
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Brazil",
		city: "Brasilia",
		coordinates: { lat: -15.7942, lng: -47.8822 },
		address: "SEN Avenida das Nações, Lote 01, Brasília-DF, CEP 70.431-902",
	},
	// Argentina
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Argentina",
		city: "Buenos Aires",
		coordinates: { lat: -34.6037, lng: -58.3816 },
		address: "Av. Santa Fe 1581, 4th Floor, Buenos Aires C1060ABC",
	},

	// ===== EUROPE =====
	// United Kingdom
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "United Kingdom",
		city: "London",
		coordinates: { lat: 51.5074, lng: -0.1278 },
		address: "6-11 Suffolk Street, London SW1Y 4HG",
	},
	// Germany
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Germany",
		city: "Berlin",
		coordinates: { lat: 52.52, lng: 13.405 },
		address: "Luisenstraße 16, 10117 Berlin",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "Germany",
		city: "Frankfurt",
		coordinates: { lat: 50.1109, lng: 8.6821 },
		address: "Westendstraße 17, 60325 Frankfurt am Main",
	},
	// France
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "France",
		city: "Paris",
		coordinates: { lat: 48.8763, lng: 2.2948 },
		address: "4 Hameau de Boulainvilliers, 45 rue du Ranelagh, 75016 Paris",
	},
	// Italy
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Italy",
		city: "Rome",
		coordinates: { lat: 41.9028, lng: 12.4964 },
		address: "Viale delle Medaglie d'Oro 112-114, 00136 Rome",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "Italy",
		city: "Milan",
		coordinates: { lat: 45.4642, lng: 9.19 },
		address: "Via Santa Maria Segreta 6, 20123 Milan",
	},
	// Spain
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Spain",
		city: "Madrid",
		coordinates: { lat: 40.4168, lng: -3.7038 },
		address: "Calle Eresma 2, 28002 Madrid",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "Spain",
		city: "Barcelona",
		coordinates: { lat: 41.3851, lng: 2.1734 },
		address: "Via Augusta 125, Bajos, 08006 Barcelona",
	},
	// Netherlands
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Netherlands",
		city: "The Hague",
		coordinates: { lat: 52.0907, lng: 4.2866 },
		address: "Laan Copes van Cattenburch 125, 2585 EZ The Hague",
	},
	// Belgium
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Belgium",
		city: "Brussels",
		coordinates: { lat: 50.8503, lng: 4.3517 },
		address: "297 Avenue Molière, 1050 Brussels",
	},
	// Switzerland
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Switzerland",
		city: "Bern",
		coordinates: { lat: 46.948, lng: 7.4474 },
		address: "Kirchenfeldstrasse 73-75, 3005 Bern",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "Switzerland",
		city: "Geneva",
		coordinates: { lat: 46.2044, lng: 6.1432 },
		address: "Rue de Moillebeau 56, 1209 Geneva",
	},
	// Austria
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Austria",
		city: "Vienna",
		coordinates: { lat: 48.2082, lng: 16.3738 },
		address: "Laurenzerberg 2, 1010 Vienna",
	},
	// Greece
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Greece",
		city: "Athens",
		coordinates: { lat: 37.9838, lng: 23.7275 },
		address: "Antheon 26, Paleo Psychico, 154 52 Athens",
	},
	// Portugal
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Portugal",
		city: "Lisbon",
		coordinates: { lat: 38.7223, lng: -9.1393 },
		address: "Avenida da República 6, 5th Floor, 1050-191 Lisbon",
	},
	// Sweden
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Sweden",
		city: "Stockholm",
		coordinates: { lat: 59.3293, lng: 18.0686 },
		address: "Lidingövägen 54, 115 25 Stockholm",
	},
	// Norway
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Norway",
		city: "Oslo",
		coordinates: { lat: 59.9139, lng: 10.7522 },
		address: "Olav Kyrres plass 1, 0244 Oslo",
	},
	// Finland
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Finland",
		city: "Helsinki",
		coordinates: { lat: 60.1699, lng: 24.9384 },
		address: "Unioninkatu 30, 00100 Helsinki",
	},
	// Denmark
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Denmark",
		city: "Copenhagen",
		coordinates: { lat: 55.6761, lng: 12.5683 },
		address: "Gammel Vartov Vej 20, 2900 Hellerup, Copenhagen",
	},
	// Czech Republic
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Czech Republic",
		city: "Prague",
		coordinates: { lat: 50.0755, lng: 14.4378 },
		address: "Pod Hradbami 17, 160 00 Prague 6",
	},
	// Poland
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Poland",
		city: "Warsaw",
		coordinates: { lat: 52.2297, lng: 21.0122 },
		address: "ul. Kosciuszki 27, 00-358 Warsaw",
	},
	// Hungary
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Hungary",
		city: "Budapest",
		coordinates: { lat: 47.4979, lng: 19.0402 },
		address: "Andrássy út 116, 1062 Budapest",
	},
	// Russia
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Russia",
		city: "Moscow",
		coordinates: { lat: 55.7558, lng: 37.6173 },
		address: "Karmanitsky pereulok 6, Building 1, Moscow 119002",
	},

	// ===== ASIA =====
	// Japan
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Japan",
		city: "Tokyo",
		coordinates: { lat: 35.6585, lng: 139.7271 },
		address: "5-15-5 Roppongi, Minato-ku, Tokyo 106-8537",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "Japan",
		city: "Osaka",
		coordinates: { lat: 34.6937, lng: 135.5022 },
		address: "Twin 21 MID Tower 24F, 2-1-61 Shiromi, Chuo-ku, Osaka 540-6124",
	},
	// China
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "China",
		city: "Beijing",
		coordinates: { lat: 39.9042, lng: 116.4074 },
		address: "23 Xiushui Beijie, Jianguomenwai, Beijing 100600",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "China",
		city: "Shanghai",
		coordinates: { lat: 31.2304, lng: 121.4737 },
		address: "Suite 301, Metrobank Plaza, 1160 West Yan'an Road, Shanghai 200052",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "China",
		city: "Guangzhou",
		coordinates: { lat: 23.1291, lng: 113.2644 },
		address:
			"Room 706-712, Guangdong International Hotel, Main Tower, 339 Huanshi Dong Lu, Guangzhou",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "China",
		city: "Xiamen",
		coordinates: { lat: 24.4798, lng: 118.0894 },
		address:
			"Units 02-04, 30/F, Xiamen International Plaza, No. 8 Lujiang Road, Siming District, Xiamen",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "China",
		city: "Chongqing",
		coordinates: { lat: 29.563, lng: 106.5516 },
		address:
			"52F Yingli International Financial Center, 28 Minzu Road, Yuzhong District, Chongqing",
	},
	// Hong Kong
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "China",
		city: "Hong Kong",
		coordinates: { lat: 22.2855, lng: 114.1577 },
		address: "14/F United Centre, 95 Queensway, Admiralty, Hong Kong",
	},
	// Macau
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "China",
		city: "Macau",
		coordinates: { lat: 22.1987, lng: 113.5439 },
		address: "Unit 1404, 14/F, AIA Tower, 251A-301 Avenida Comercial de Macau",
	},
	// South Korea
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "South Korea",
		city: "Seoul",
		coordinates: { lat: 37.5665, lng: 126.978 },
		address: "5-1 Itaewon 2-dong, Yongsan-gu, Seoul 04349",
	},
	// Taiwan
	{
		name: "Manila Economic and Cultural Office",
		type: "consulate",
		country: "Taiwan",
		city: "Taipei",
		coordinates: { lat: 25.033, lng: 121.5654 },
		address: "41F, Taipei 101 Tower, No. 7, Sec. 5, Xinyi Road, Taipei 11049",
	},
	// Singapore
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Singapore",
		city: "Singapore",
		coordinates: { lat: 1.3044, lng: 103.8399 },
		address: "20 Nassim Road, Singapore 258395",
	},
	// Malaysia
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Malaysia",
		city: "Kuala Lumpur",
		coordinates: { lat: 3.1569, lng: 101.7117 },
		address: "1 Changkat Kia Peng, 50450 Kuala Lumpur",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "Malaysia",
		city: "Kota Kinabalu",
		coordinates: { lat: 5.9804, lng: 116.0735 },
		address: "No. 16, Jalan A.S. Damai, Luyang, 88300 Kota Kinabalu, Sabah",
	},
	// Indonesia
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Indonesia",
		city: "Jakarta",
		coordinates: { lat: -6.2088, lng: 106.8456 },
		address: "Jl. Imam Bonjol No. 6-8, Menteng, Jakarta Pusat 10310",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "Indonesia",
		city: "Manado",
		coordinates: { lat: 1.4748, lng: 124.8421 },
		address: "Jl. 17 Agustus No. 17, Manado, North Sulawesi",
	},
	// Thailand
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Thailand",
		city: "Bangkok",
		coordinates: { lat: 13.7563, lng: 100.5018 },
		address: "760 Sukhumvit Road, Bangkok 10110",
	},
	// Vietnam
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Vietnam",
		city: "Hanoi",
		coordinates: { lat: 21.0285, lng: 105.8542 },
		address: "27B Tran Hung Dao Street, Hoan Kiem District, Hanoi",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "Vietnam",
		city: "Ho Chi Minh City",
		coordinates: { lat: 10.8231, lng: 106.6297 },
		address: "Unit 503, Saigon Tower, 29 Le Duan Boulevard, District 1, Ho Chi Minh City",
	},
	// Cambodia
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Cambodia",
		city: "Phnom Penh",
		coordinates: { lat: 11.5564, lng: 104.9282 },
		address: "No. 33 Street 294, Sangkat Tonle Bassac, Khan Chamkarmon, Phnom Penh",
	},
	// Myanmar
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Myanmar",
		city: "Yangon",
		coordinates: { lat: 16.8661, lng: 96.1951 },
		address: "No. 50 Sayasan Road, Bahan Township, Yangon",
	},
	// Laos
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Laos",
		city: "Vientiane",
		coordinates: { lat: 17.9757, lng: 102.6331 },
		address: "Rue Sapanthong Neua, Ban Sapanthong Neua, Sisattanak District, Vientiane",
	},
	// Brunei
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Brunei",
		city: "Bandar Seri Begawan",
		coordinates: { lat: 4.9031, lng: 114.9398 },
		address: "Simpang 336, Kg. Kiulap, Bandar Seri Begawan BE1518",
	},
	// India
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "India",
		city: "New Delhi",
		coordinates: { lat: 28.6139, lng: 77.209 },
		address: "50-N, Nyaya Marg, Chanakyapuri, New Delhi 110021",
	},
	// Bangladesh
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Bangladesh",
		city: "Dhaka",
		coordinates: { lat: 23.8103, lng: 90.4125 },
		address: "House CES (A) 1, Road 118, Gulshan, Dhaka 1212",
	},
	// Sri Lanka
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Sri Lanka",
		city: "Colombo",
		coordinates: { lat: 6.9271, lng: 79.8612 },
		address: "16 Gregory's Road, Colombo 7",
	},
	// Pakistan
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Pakistan",
		city: "Islamabad",
		coordinates: { lat: 33.6844, lng: 73.0479 },
		address: "House 25-A, Street 20, F-6/2, Islamabad",
	},

	// ===== MIDDLE EAST =====
	// United Arab Emirates
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "United Arab Emirates",
		city: "Abu Dhabi",
		coordinates: { lat: 24.4539, lng: 54.3773 },
		address: "Al Qubaisat Area, Villa No. 4, W-6/01, Abu Dhabi",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "United Arab Emirates",
		city: "Dubai",
		coordinates: { lat: 25.2048, lng: 55.2708 },
		address: "Al Qusais 2, Dubai",
	},
	// Saudi Arabia
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Saudi Arabia",
		city: "Riyadh",
		coordinates: { lat: 24.7136, lng: 46.6753 },
		address: "Diplomatic Quarter, Riyadh 11693",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "Saudi Arabia",
		city: "Jeddah",
		coordinates: { lat: 21.5433, lng: 39.1728 },
		address: "Al Rehab District, Jeddah",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "Saudi Arabia",
		city: "Al-Khobar",
		coordinates: { lat: 26.2172, lng: 50.1971 },
		address: "Corniche Road, Al-Khobar 31952",
	},
	// Kuwait
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Kuwait",
		city: "Kuwait City",
		coordinates: { lat: 29.3759, lng: 47.9774 },
		address: "Block 1, Street 11, House 35, Jabriya, Kuwait City",
	},
	// Qatar
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Qatar",
		city: "Doha",
		coordinates: { lat: 25.2854, lng: 51.531 },
		address: "Villa No. 108, Al Kharaitiyat Area, Doha",
	},
	// Bahrain
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Bahrain",
		city: "Manama",
		coordinates: { lat: 26.2235, lng: 50.5876 },
		address: "Building 128, Road 1901, Block 319, Manama",
	},
	// Oman
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Oman",
		city: "Muscat",
		coordinates: { lat: 23.588, lng: 58.3829 },
		address: "Villa No. 2891, Way No. 3017, Al Khuwair, Muscat",
	},
	// Israel
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Israel",
		city: "Tel Aviv",
		coordinates: { lat: 32.0853, lng: 34.7818 },
		address: "27 Shmuel Hanagid Street, Tel Aviv 6107200",
	},
	// Jordan
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Jordan",
		city: "Amman",
		coordinates: { lat: 31.9454, lng: 35.9284 },
		address: "19 Ibrahim Aqqad Street, Deir Ghbar, Amman 11180",
	},
	// Lebanon
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Lebanon",
		city: "Beirut",
		coordinates: { lat: 33.8938, lng: 35.5018 },
		address: "Mathaf Area, Badaro, Beirut",
	},
	// Iran
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Iran",
		city: "Tehran",
		coordinates: { lat: 35.7796, lng: 51.4465 },
		address: "No. 1, 9th Street, Gandi Avenue, Tehran",
	},
	// Turkey
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Turkey",
		city: "Ankara",
		coordinates: { lat: 39.9334, lng: 32.8597 },
		address: "Mahatma Gandi Caddesi 24/4, 06700 GOP, Ankara",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "Turkey",
		city: "Istanbul",
		coordinates: { lat: 41.0082, lng: 28.9784 },
		address: "Suzer Plaza, Elmadag, Sisli, Istanbul",
	},

	// ===== AFRICA =====
	// South Africa
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "South Africa",
		city: "Pretoria",
		coordinates: { lat: -25.7479, lng: 28.2293 },
		address: "46 Marais Street, Brooklyn, Pretoria 0181",
	},
	// Egypt
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Egypt",
		city: "Cairo",
		coordinates: { lat: 30.0444, lng: 31.2357 },
		address: "5 Shagaret El Dorr Street, Zamalek, Cairo",
	},
	// Nigeria
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Nigeria",
		city: "Abuja",
		coordinates: { lat: 9.0579, lng: 7.4951 },
		address: "11 Mississippi Street, Maitama, Abuja",
	},
	// Libya
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Libya",
		city: "Tripoli",
		coordinates: { lat: 32.8872, lng: 13.1913 },
		address: "Km 7, Gergaresh Road, Tripoli",
	},

	// ===== OCEANIA =====
	// Australia
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Australia",
		city: "Canberra",
		coordinates: { lat: -35.2809, lng: 149.13 },
		address: "1 Moonah Place, Yarralumla, ACT 2600",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "Australia",
		city: "Sydney",
		coordinates: { lat: -33.8688, lng: 151.2093 },
		address: "Level 2, 100 Walker Street, North Sydney, NSW 2060",
	},
	{
		name: "Philippine Consulate General",
		type: "consulate",
		country: "Australia",
		city: "Melbourne",
		coordinates: { lat: -37.8136, lng: 144.9631 },
		address: "Level 2, 15-31 Pelham Street, Carlton, VIC 3053",
	},
	// New Zealand
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "New Zealand",
		city: "Wellington",
		coordinates: { lat: -41.2865, lng: 174.7762 },
		address: "50 Hobson Street, Thorndon, Wellington 6011",
	},
	// Papua New Guinea
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Papua New Guinea",
		city: "Port Moresby",
		coordinates: { lat: -9.4438, lng: 147.1803 },
		address: "Section 167, Lot 7, Lahara Avenue, Hohola, Port Moresby",
	},
	// Fiji
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Fiji",
		city: "Suva",
		coordinates: { lat: -18.1416, lng: 178.4419 },
		address: "7th Floor, Fiji Development Bank Building, 360 Victoria Parade, Suva",
	},
	// Palau
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Palau",
		city: "Koror",
		coordinates: { lat: 7.3386, lng: 134.4663 },
		address: "WCTC Building, Main Street, Koror",
	},
	// Federated States of Micronesia
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Micronesia",
		city: "Kolonia",
		coordinates: { lat: 6.9639, lng: 158.2092 },
		address: "Kolonia, Pohnpei",
	},
	// Marshall Islands
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Marshall Islands",
		city: "Majuro",
		coordinates: { lat: 7.1164, lng: 171.1858 },
		address: "Delap, Majuro",
	},
	// Timor-Leste
	{
		name: "Embassy of the Philippines",
		type: "embassy",
		country: "Timor-Leste",
		city: "Dili",
		coordinates: { lat: -8.5569, lng: 125.5603 },
		address: "Rua de Aileu, Farol, Dili",
	},
]

/**
 * Get total count of embassy locations
 */
export function getEmbassyCount(): number {
	return PHILIPPINE_EMBASSIES.length
}

/**
 * Get embassies by type
 */
export function getEmbassiesByType(type: EmbassyLocation["type"]): EmbassyLocation[] {
	return PHILIPPINE_EMBASSIES.filter(e => e.type === type)
}

/**
 * Get embassies by country
 */
export function getEmbassiesByCountry(country: string): EmbassyLocation[] {
	return PHILIPPINE_EMBASSIES.filter(e => e.country.toLowerCase() === country.toLowerCase())
}
