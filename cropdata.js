const crops = [

/* ================= ROOT & TUBERS ================= */
{
name: "Cassava",
varieties: ["TMS 98/0581", "TME 419", "NR 8082"],
zones: ["Derived Savanna", "Guinea Savanna"],
soil: ["loam", "sandy loam"],
ph: [5.0, 6.5],
temp: [22, 34],
rain: [800, 1500],
yield: 25,
waterNeed: "Low",
pestResistance: "High",
fertilizer: "NPK 15-15-15 (200-300 kg/ha) + manure",
season: {
south: ["Mar", "Apr", "Sep"],
north: ["May", "Jun"]
}
},

{
name: "Yam",
varieties: ["TDr 89/02665", "Meccakusa"],
zones: ["Derived Savanna"],
soil: ["loam"],
ph: [5.0, 6.8],
temp: [22, 33],
rain: [900, 1500],
yield: 18,
waterNeed: "Medium",
pestResistance: "Medium",
fertilizer: "Organic manure + NPK",
season: { south: ["Feb","Mar"], north: ["Apr"] }
},

{
name: "Sweet Potato",
varieties: ["UMUSPO 3", "UMUSPO 1"],
zones: ["All"],
soil: ["sandy loam"],
ph: [5.0, 6.5],
temp: [20, 32],
rain: [600, 1200],
yield: 12,
waterNeed: "Low",
pestResistance: "Medium",
fertilizer: "NPK 15-15-15 (150kg/ha)",
season: { south: ["Mar","Sep"], north: ["May","Jun"] }
},

/* ================= CEREALS ================= */
{
name: "Maize",
varieties: ["SAMMAZ 29", "Oba Super"],
zones: ["All"],
soil: ["loam"],
ph: [5.5, 7.0],
temp: [20, 32],
rain: [700, 1200],
yield: 5.5,
waterNeed: "Medium",
pestResistance: "Medium",
fertilizer: "NPK 20-10-10 + Urea",
season: { south: ["Mar","Apr","Aug"], north: ["May","Jun"] }
},

{
name: "Rice",
varieties: ["FARO 44", "NERICA 8"],
zones: ["All"],
soil: ["clay"],
ph: [5.0, 7.5],
temp: [24, 35],
rain: [1000, 2000],
yield: 4.5,
waterNeed: "High",
pestResistance: "Low",
fertilizer: "NPK + Urea split",
season: { south: ["Apr"], north: ["Jun"] }
},

{
name: "Sorghum",
varieties: ["SAMSORG 40"],
zones: ["Sudan Savanna"],
soil: ["sandy"],
ph: [5.5, 7.5],
temp: [22, 38],
rain: [400, 800],
yield: 3,
waterNeed: "Low",
pestResistance: "High",
fertilizer: "NPK 100kg/ha",
season: { north: ["May","Jun"] }
},

{
name: "Millet",
varieties: ["SOSAT-C88"],
zones: ["Sudan Savanna"],
soil: ["sandy"],
ph: [5.5, 8],
temp: [26, 42],
rain: [300, 600],
yield: 1.5,
waterNeed: "Very Low",
pestResistance: "Very High",
fertilizer: "Microdose NPK",
season: { north: ["Jun","Jul"] }
},

/* ================= LEGUMES ================= */
{
name: "Cowpea",
varieties: ["SAMPEA 20-T"],
zones: ["All"],
soil: ["loam"],
ph: [5.0, 7.2],
temp: [22, 40],
rain: [400, 800],
yield: 1.5,
waterNeed: "Low",
pestResistance: "High",
fertilizer: "SSP + Rhizobium",
season: { south: ["Apr","Aug"], north: ["May"] }
},

{
name: "Groundnut",
varieties: ["SAMNUT 24"],
zones: ["All"],
soil: ["sandy loam"],
ph: [5.2, 7.2],
temp: [22, 38],
rain: [500, 900],
yield: 1.6,
waterNeed: "Low",
pestResistance: "Medium",
fertilizer: "SSP + Gypsum",
season: { south: ["Apr"], north: ["May"] }
},

{
name: "Soybean",
varieties: ["TGX 1987-62F"],
zones: ["Guinea Savanna"],
soil: ["loam"],
ph: [5.8, 7],
temp: [20, 35],
rain: [700, 1200],
yield: 2.2,
waterNeed: "Medium",
pestResistance: "Medium",
fertilizer: "Inoculant + NPK",
season: { north: ["May","Jun"] }
},

/* ================= VEGETABLES ================= */
{
name: "Tomato",
varieties: ["Roma VF", "UC82B"],
zones: ["All"],
soil: ["loam"],
ph: [5.5, 7.5],
temp: [20, 30],
rain: [600, 1000],
yield: 20,
waterNeed: "Medium",
pestResistance: "Low",
fertilizer: "NPK + Calcium",
season: { south: ["Oct","Nov"], north: ["Nov","Dec"] }
},

{
name: "Pepper",
varieties: ["Tatase", "Shombo"],
zones: ["All"],
soil: ["loam"],
ph: [5.5, 7.0],
temp: [20, 32],
rain: [600, 1000],
yield: 10,
waterNeed: "Medium",
pestResistance: "Low",
fertilizer: "NPK + organic",
season: { south: ["Sep"], north: ["Nov"] }
},

{
name: "Onion",
varieties: ["Red Creole"],
zones: ["Northern"],
soil: ["sandy loam"],
ph: [6.0, 7.5],
temp: [15, 30],
rain: [500, 800],
yield: 12,
waterNeed: "Low",
pestResistance: "Medium",
fertilizer: "NPK 15-15-15",
season: { north: ["Nov","Dec"] }
},

/* ================= TREE CROPS ================= */
{
name: "Oil Palm",
varieties: ["Tenera"],
zones: ["Forest"],
soil: ["loam"],
ph: [5.0, 6.5],
temp: [22, 32],
rain: [1500, 3000],
yield: 20,
waterNeed: "High",
pestResistance: "Medium",
fertilizer: "NPKMg",
season: { south: ["All year"] }
},

{
name: "Cocoa",
varieties: ["CRIN CF9"],
zones: ["Forest"],
soil: ["loam"],
ph: [5.0, 6.5],
temp: [20, 32],
rain: [1200, 2500],
yield: 1.2,
waterNeed: "High",
pestResistance: "Low",
fertilizer: "NPK + mulch",
season: { south: ["Mar","Apr"] }
},

/* ================= FRUITS ================= */
{
name: "Banana",
varieties: ["Cavendish"],
zones: ["All"],
soil: ["loam"],
ph: [5.5, 7.0],
temp: [24, 35],
rain: [1200, 2500],
yield: 30,
waterNeed: "High",
pestResistance: "Medium",
fertilizer: "NPK high K",
season: { south: ["All year"], north: ["Irrigation"] }
},

{
name: "Mango",
varieties: ["Kent", "Tommy Atkins"],
zones: ["All"],
soil: ["loam"],
ph: [5.5, 7.5],
temp: [24, 40],
rain: [600, 1200],
yield: 15,
waterNeed: "Low",
pestResistance: "Medium",
fertilizer: "NPK + compost",
season: { all: ["Rainy season planting"] }
},

/* ================= MORE CROPS (condensed but usable) ================= */
{
name: "Okra",
varieties: ["NH47-4"],
zones: ["All"],
soil: ["loam"],
ph: [5.5,7],
temp: [22,35],
rain: [500,1000],
yield: 8,
waterNeed: "Low",
pestResistance: "Medium",
fertilizer: "NPK",
season: { all:["Rainy season"] }
},

{
name: "Cucumber",
varieties: ["Marketmore"],
zones: ["All"],
soil: ["loam"],
ph: [5.5,7],
temp: [20,30],
rain: [600,1000],
yield: 12,
waterNeed: "Medium",
pestResistance: "Low",
fertilizer: "NPK",
season: { all:["Dry season irrigation"] }
},

{
name: "Watermelon",
varieties: ["Sugar Baby"],
zones: ["Northern"],
soil: ["sandy"],
ph: [5.5,7.5],
temp: [25,38],
rain: [400,800],
yield: 15,
waterNeed: "Low",
pestResistance: "Medium",
fertilizer: "NPK",
season: { north:["Dry season"] }
}

];

module.exports = crops;
