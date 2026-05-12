export const SERVICES_DATA = {
  "Exclusive Packages": [
    { id: "pkg_1", name: "Showroom Shine (Pkg 1)", desc: "The ultimate refresh: VIP wash, engine wash, tire mags detailing, and hand glass watermarks removal.", prices: { Sedan: 2500, SUV: 3500 }, estTime: "4 Hours", durationMinutes: 240 },
    { id: "pkg_2", name: "Ultimate Protection (Pkg 2)", desc: "Machine polish for swirl removal, paint protection wax, and BTZ interior disinfection.", prices: { Sedan: 3500, SUV: 4500 }, estTime: "5 Hours", durationMinutes: 300 },
  ],
  "Premium Car Wash": [
    { id: "wash_1", name: "Regular Wash", desc: "Professional exterior cleaning using high-quality automotive soap and microfiber drying.", prices: { Sedan: 150, SUV: 180, "Van/L300": 300 }, estTime: "1 Hour", durationMinutes: 60 },
    { id: "wash_2", name: "Supreme Wash", desc: "Advanced wash including high-gloss treatment, degreaser, and protective wax.", prices: { Sedan: 500, SUV: 600, "Van/L300": 800 }, estTime: "2 Hours", durationMinutes: 120 },
  ],
  "Specialized Exterior Care": [
    { id: "ext_1", name: "Spot Removal", desc: "Targeted removal of localized stains and blemishes from the paint surface.", prices: { Sedan: 1000, SUV: 1500, "Van/L300": 2000 }, estTime: "1-2 Hours", durationMinutes: 90 },
    { id: "ext_2", name: "Acid Rain Removal (Hand)", desc: "Manual removal of water spots and acid rain marks to restore surface clarity.", prices: { Sedan: 600, SUV: 800, "Van/L300": 1000 }, estTime: "2 Hours", durationMinutes: 120 },
    { id: "ext_3", name: "Acid Rain Removal (Machine)", desc: "Machine-buffed treatment for deep water spot and acid rain mark removal.", prices: { Sedan: 1000, SUV: 1500, "Van/L300": 2000 }, estTime: "3 Hours", durationMinutes: 180 },
    { id: "ext_4", name: "Engine Wash", desc: "Safe and thorough cleaning of the engine bay to remove accumulated grease and dirt.", prices: { Sedan: 500, SUV: 800, "Van/L300": 1000 }, estTime: "1 Hour", durationMinutes: 60 },
    { id: "ext_5", name: "Headlight Polish", desc: "Restores yellowed or hazy headlights to original factory clarity.", prices: { Sedan: 800, SUV: 1000, "Van/L300": 1300 }, estTime: "1.5 Hours", durationMinutes: 90 },
    { id: "ext_6", name: "Asphalt Removal", desc: "Removes road tar and asphalt splatters without affecting the paint finish.", prices: { Sedan: 700, SUV: 900, "Van/L300": 1200 }, estTime: "2 Hours", durationMinutes: 120 },
    { id: "ext_7", name: "Buff Wax (Machine)", desc: "Machine-applied premium wax for an ultra-smooth and protective finish.", prices: { Sedan: 1000, SUV: 1500, "Van/L300": 2500 }, estTime: "2-3 Hours", durationMinutes: 150 },
    { id: "ext_8", name: "Mags Detailing", desc: "Deep cleaning and polishing of wheels and rims to remove brake dust and oxidation.", prices: { Sedan: 1200, SUV: 2000, "Van/L300": 2800 }, estTime: "2 Hours", durationMinutes: 120 },
  ],
  "Interior & Cabin Care": [
    { id: "int_1", name: "Interior Detailing", desc: "Deep extraction, shampooing, and disinfection of all interior cabin surfaces.", prices: { Sedan: 4500, SUV: 5500, "Van/L300": 6500 }, estTime: "4-5 Hours", durationMinutes: 270 },
    { id: "int_2", name: "Back to Zero", desc: "Ozone treatment and antibacterial fogging to eliminate odors and germs.", prices: { Sedan: 350, SUV: 400, "Van/L300": 600 }, estTime: "30 Mins", durationMinutes: 30 },
    { id: "int_3", name: "Seat Cover In/Out", desc: "Professional removal, cleaning, and reinstallation of vehicle seat covers.", prices: { Sedan: 500, SUV: 800, "Van/L300": 1200 }, estTime: "2 Hours", durationMinutes: 120 },
    { id: "int_4", name: "Ceiling Cleaning", desc: "Careful removal of stains and dust from the vehicle's interior headliner.", prices: { Sedan: 700, SUV: 1000, "Van/L300": 1300 }, estTime: "2 Hours", durationMinutes: 120 },
  ],
  "Professional Detailing": [
    { id: "det_1", name: "Ceramic Coating", desc: "Premium 3-step exterior detailing followed by long-term ceramic protection.", prices: { Sedan: 10000, SUV: 13000, "Van/L300": 16000 }, estTime: "2 Days", durationMinutes: 2880 },
    { id: "det_2", name: "Exterior Detailing (3 Step)", desc: "Complete 3-step process: cutting cream, polishing, and high-gloss finishing.", prices: { Sedan: 5000, SUV: 6000, "Van/L300": 7000 }, estTime: "1 Day", durationMinutes: 1440 },
    { id: "det_3", name: "1st Step Cutting", desc: "Intensive swirl and deep scratch removal process only.", prices: { Sedan: 2500, SUV: 3000, "Van/L300": 3500 }, estTime: "4 Hours", durationMinutes: 240 },
    { id: "det_4", name: "Glass Detailing", desc: "Machine buffing for the windshield only to ensure perfect optical clarity.", prices: { Sedan: 3500, SUV: 4500, "Van/L300": 6000 }, estTime: "3 Hours", durationMinutes: 180 },
  ],
  "Motorcycle Specialist": [
    { id: "moto_1", name: "Moto Wash", desc: "Professional cleaning tailored specifically for motorcycle components.", prices: { Regular: 120, Bigbike: 150 }, estTime: "30 Mins", durationMinutes: 30 },
    { id: "moto_2", name: "Moto VIP", desc: "Includes wash, high-gloss treatment, degreaser, and protective wax.", prices: { Regular: 250, Bigbike: 350 }, estTime: "1 Hour", durationMinutes: 60 },
    { id: "moto_3", name: "Moto Detail", desc: "Full restoration of all visible motorcycle parts and surfaces.", prices: { Regular: 2500, Bigbike: 3000 }, estTime: "4 Hours", durationMinutes: 240 },
    { id: "moto_4", name: "Moto Ceramic Coating", desc: "Hydrophobic ceramic shield for paint, plastics, and metal parts.", prices: { Regular: 3500, Bigbike: 5500 }, estTime: "1 Day", durationMinutes: 1440 },
    { id: "moto_5", name: "Moto 3-Step Detailing", desc: "Comprehensive cutting, polishing, and finishing for bike paintwork.", prices: { Regular: 2500, Bigbike: 3500 }, estTime: "5 Hours", durationMinutes: 300 },
  ],
  "Add-on Treatments": [
    { id: "add_1", name: "Waxx Add-on", desc: "Extra layer of protective wax for an enhanced reflective shine.", prices: { Sedan: 200, SUV: 300, "Van/L300": 400 }, estTime: "30 Mins", durationMinutes: 30 },
    { id: "add_2", name: "Highgloss Add-on", desc: "Intense gloss enhancer for that wet-look finish.", prices: { Sedan: 200, SUV: 300, "Van/L300": 400 }, estTime: "30 Mins", durationMinutes: 30 },
    { id: "add_3", name: "Degreaser Add-on", desc: "Heavy-duty degreasing for underchassis or specific dirty areas.", prices: { Sedan: 200, SUV: 300, "Van/L300": 400 }, estTime: "30 Mins", durationMinutes: 30 },
  ]
};
