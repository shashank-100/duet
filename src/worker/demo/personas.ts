// 25 FICTIONAL demo personas. None of these people exist; names, employers and posts are invented
// for the demo and every page that shows them is labelled "Fictional demo". Their "LinkedIn" and
// "Instagram" are fixture pages hosted by Duet itself at /demo/sources/<slug> — never real URLs.
// Employers are generic invented names so they cannot be mistaken for real organizations.

import type { Gender } from "../../shared/types";

export interface Persona {
  slug: string;
  name: string;
  age: number;
  gender: Gender;
  open_to: Gender[];
  age_min: number;
  age_max: number;
  location: string;
  looking_for: string;
  priorities: string;
  boundaries: string;
  linkedin: { headline: string; about: string; experience: string[]; education: string; skills: string[]; volunteering?: string };
  instagram: { handle: string; bio: string; posts: string[] };
}

export const PERSONAS: Persona[] = [
  {
    slug: "maya-okafor", name: "Maya Okafor", age: 31, gender: "woman", open_to: ["man"], age_min: 29, age_max: 38,
    location: "Brooklyn, NY", looking_for: "A long-term relationship with someone curious and kind.",
    priorities: "Shared weekend adventures, emotional honesty, someone who reads.", boundaries: "Prefers not to discuss exes on a first date.",
    linkedin: {
      headline: "Urban Planner at Northbridge City Studio | Transit & public space",
      about: "I design streets people actually want to walk on. Eight years in transit planning, obsessed with how small parks change neighborhoods. I lead community workshops in English and Igbo-speaking communities across Brooklyn.",
      experience: ["Senior Urban Planner at Northbridge City Studio (2021 – present): leads bus-priority corridor projects and runs public design workshops", "Planner at Harbor & Line Associates (2017 – 2021): bike lane network studies"],
      education: "M.S. Urban Planning, Eastfield University", skills: ["Urban design", "Community engagement", "GIS", "Public speaking"],
      volunteering: "Volunteer tree steward — Brooklyn Street Trees Collective",
    },
    instagram: { handle: "maya.maps.things", bio: "planner by day · sourdough by night · finding the best bench in every park 🌳", posts: [
      "Sunday ritual: 7am run through Prospect Park, then sourdough. The starter is named Gerald and he is thriving.",
      "Finished 'The Power Broker' after six months. I have FEELINGS about highways now.",
      "Our community workshop drew 60 neighbors tonight. Turns out everyone has opinions about benches. Love that.",
      "Weekend trip to the Catskills — 11 miles, one wrong turn, zero regrets.",
      "Book club pick this month: 'Piranesi'. Bring snacks and theories." ] },
  },
  {
    slug: "daniel-reyes", name: "Daniel Reyes", age: 33, gender: "man", open_to: ["woman"], age_min: 27, age_max: 36,
    location: "Manhattan, NY", looking_for: "Something serious, with someone who likes being outside.",
    priorities: "Active lifestyle, humor, closeness with family.", boundaries: "Doesn't drink much; prefers coffee or daytime plans.",
    linkedin: {
      headline: "Physical Therapist | Sports rehab | Clinic co-founder at Stride Forward PT",
      about: "I help runners and weekend warriors get back to what they love. Co-founded a small clinic in Washington Heights. Bilingual Spanish/English care.",
      experience: ["Co-founder & PT at Stride Forward PT (2020 – present)", "Physical Therapist at Riverside Sports Health (2016 – 2020): ACL and running injury rehab"],
      education: "Doctor of Physical Therapy, Lakeshore College", skills: ["Sports rehabilitation", "Gait analysis", "Bilingual care"],
    },
    instagram: { handle: "dan.moves", bio: "PT · trail runner · my abuela's pernil > yours", posts: [
      "Ran the Hudson Highlands trail race this morning. Legs: gone. Spirit: high.",
      "Sunday dinner at my abuela's. She still won't give me the pernil recipe.",
      "Coached a patient back to her first 10K after knee surgery. Best part of the job.",
      "Trying to learn guitar at 33. My neighbors are very patient people.",
      "Early coffee + sunrise on the George Washington Bridge path. Worth the 5:30 alarm." ] },
  },
  {
    slug: "priya-raman", name: "Priya Raman", age: 28, gender: "woman", open_to: ["man"], age_min: 27, age_max: 35,
    location: "Jersey City, NJ", looking_for: "Open to see where it goes — ideally long-term.",
    priorities: "Intellectual curiosity, ambition balanced with rest, food adventures.", boundaries: "No talk about salaries or money on early dates.",
    linkedin: {
      headline: "Data Scientist, Climate Risk at Meridian Analytics",
      about: "I build models that estimate flood risk for coastal neighborhoods. Previously in healthcare analytics. I care about making data useful to people who aren't data people.",
      experience: ["Data Scientist at Meridian Analytics (2022 – present): flood-risk models for coastal cities", "Analyst at CareCurve Health (2019 – 2022): hospital readmission dashboards"],
      education: "B.S. Statistics, Westbrook University", skills: ["Python", "Geospatial modeling", "Data visualization", "Teaching"],
      volunteering: "Mentor — Girls Code Saturdays",
    },
    instagram: { handle: "priya.plots", bio: "climate nerd · dumpling hunter · Carnatic violin, badly", posts: [
      "Dumpling crawl through Flushing: 6 spots, 1 clear winner (the pan-fried ones on 41st).",
      "Practiced violin for the first time in months. Carnatic scales are humbling.",
      "Presented our flood model to a community board. Best question came from a 12-year-old.",
      "Saturday mentoring: the girls built a weather station with a Raspberry Pi!",
      "Sunset kayak on the Hudson. Free kayaking in the city is the best-kept secret." ] },
  },
  {
    slug: "ethan-brooks", name: "Ethan Brooks", age: 35, gender: "man", open_to: ["woman"], age_min: 28, age_max: 40,
    location: "Brooklyn, NY", looking_for: "A real partnership; open to kids someday but no rush.",
    priorities: "Kindness, creativity, someone who likes quiet evenings as much as nights out.", boundaries: "Not into heavy partying.",
    linkedin: {
      headline: "High School Chemistry Teacher | Robotics coach",
      about: "Twelve years teaching chemistry at a public high school. I coach the robotics team that somehow made state finals two years running.",
      experience: ["Chemistry Teacher at Eastside Public High (2013 – present)", "Robotics Team Coach (2016 – present): two state-finals appearances"],
      education: "M.A. Science Education, Hillcrest College", skills: ["Curriculum design", "Mentoring", "Robotics"],
    },
    instagram: { handle: "mr.brooks.builds", bio: "chem teacher · robot dad (team #4471) · amateur woodworker", posts: [
      "Built a walnut bookshelf this summer. Only one finger slightly injured.",
      "Robotics team is going to STATE again!! So proud of these kids.",
      "Quiet Friday: jazz record, homemade ramen, crossword. Perfect.",
      "Went to a pottery class with my sister. My bowl is… a plate.",
      "Fall camping in the Adirondacks. Woke up to frost on the tent." ] },
  },
  {
    slug: "sofia-lindqvist", name: "Sofia Lindqvist", age: 30, gender: "woman", open_to: ["man", "woman"], age_min: 27, age_max: 38,
    location: "Manhattan, NY", looking_for: "A long-term relationship with a creative, grounded person.",
    priorities: "Art and culture, travel, mutual independence.", boundaries: "",
    linkedin: {
      headline: "Museum Exhibition Designer at Atlas Contemporary",
      about: "I turn ideas into rooms people can walk through. Exhibition design for contemporary art, from lighting to wall text.",
      experience: ["Exhibition Designer at Atlas Contemporary (2020 – present)", "Junior Designer at Fold & Frame Studio (2017 – 2020)"],
      education: "B.F.A. Spatial Design, Northvale School of Art", skills: ["Exhibition design", "Lighting design", "3D modeling"],
    },
    instagram: { handle: "sofia.in.rooms", bio: "rooms, light, and too many sketchbooks · Stockholm → NYC", posts: [
      "Install week. 14-hour days, 1 perfect gallery. Opening Thursday!",
      "Sketching in the Met's sculpture court on my day off.",
      "Took a ceramics wheel class and I think I've found my new obsession.",
      "Midsommar picnic in Central Park with flower crowns and too much herring.",
      "Solo trip to Lisbon — the light there is unreal for a designer." ] },
  },
  {
    slug: "marcus-chen", name: "Marcus Chen", age: 29, gender: "man", open_to: ["woman"], age_min: 25, age_max: 33,
    location: "Queens, NY", looking_for: "Looking for something serious.",
    priorities: "Ambition, shared love of food, someone who likes games and banter.", boundaries: "",
    linkedin: {
      headline: "Software Engineer at Lumen Ledger | Payments infrastructure",
      about: "Backend engineer building reliable payments systems. I like boring systems that never go down and exciting side projects that always do.",
      experience: ["Software Engineer II at Lumen Ledger (2021 – present): payments reliability", "Software Engineer at Quickcart (2018 – 2021)"],
      education: "B.S. Computer Science, Eastfield University", skills: ["Go", "Distributed systems", "PostgreSQL"],
    },
    instagram: { handle: "marcus.cooks.code", bio: "eng · board game hoarder · I will make you hand-pulled noodles", posts: [
      "Hand-pulled noodles attempt #7. They are finally… noodles.",
      "Board game night: Wingspan went 3 hours and I regret nothing.",
      "Weekend hackathon: built a bot that tells me which ramen place has the shortest line.",
      "Pickup basketball at the court on 108th every Saturday — come get crossed.",
      "Visited my parents' restaurant in Flushing and got put to work immediately." ] },
  },
  {
    slug: "amara-diallo", name: "Amara Diallo", age: 34, gender: "woman", open_to: ["man"], age_min: 32, age_max: 42,
    location: "Harlem, NY", looking_for: "A committed relationship with an emotionally mature partner.",
    priorities: "Faith in people, generosity, music, steady communication.", boundaries: "Prefers to keep first conversations away from family plans.",
    linkedin: {
      headline: "Pediatric Nurse Practitioner | Community health",
      about: "Ten years caring for kids and families in Harlem. I run a free weekend asthma clinic and teach CPR in local schools.",
      experience: ["Pediatric Nurse Practitioner at Uptown Family Health (2018 – present)", "RN, Pediatrics at St. Lucan Hospital (2013 – 2018)"],
      education: "M.S.N., Pediatric NP, Riverside School of Nursing", skills: ["Pediatrics", "Community health education", "CPR instruction"],
      volunteering: "Weekend asthma clinic organizer",
    },
    instagram: { handle: "amara.sings.uptown", bio: "kids' NP · choir alto · jollof debates welcome", posts: [
      "Our choir performed at the Apollo amateur night! Alto section carried, obviously.",
      "Taught CPR to 40 fifth graders today. They were better than most adults.",
      "Made jollof for 30 at the block party. The Ghanaian neighbors have notes.",
      "Sunday afternoon at the Schomburg Center reading room. My happy place.",
      "Salsa class with my cousin — I stepped on exactly one foot." ] },
  },
  {
    slug: "jonah-weiss", name: "Jonah Weiss", age: 37, gender: "man", open_to: ["woman"], age_min: 31, age_max: 40,
    location: "Brooklyn, NY", looking_for: "A long-term partner to build a calm, full life with.",
    priorities: "Warmth, cooking together, books, someone who likes slow mornings.", boundaries: "",
    linkedin: {
      headline: "Editor, Nonfiction at Hollow Pine Press",
      about: "I edit narrative nonfiction — science, history, and the occasional cookbook. Before publishing I was a line cook for four years.",
      experience: ["Senior Editor at Hollow Pine Press (2017 – present)", "Assistant Editor at Marigold Books (2013 – 2017)", "Line cook at The Copper Table (2009 – 2013)"],
      education: "B.A. History, Hillcrest College", skills: ["Editing", "Book acquisition", "Storytelling"],
    },
    instagram: { handle: "jonah.reads.and.eats", bio: "editor · former line cook · bread, books, the Rockaways", posts: [
      "Slow Saturday: farmers market, braised short ribs, half a novel.",
      "Finished editing a book about octopus intelligence. I can never eat calamari again.",
      "Rockaway beach in October is the best-kept secret in New York.",
      "Baked a babka for my book club. They now only invite me for the babka.",
      "Bike ride to Coney Island and back. 30 miles, one knish." ] },
  },
  {
    slug: "lena-park", name: "Lena Park", age: 27, gender: "woman", open_to: ["man"], age_min: 26, age_max: 33,
    location: "Manhattan, NY", looking_for: "Dating with intention — open to something long-term.",
    priorities: "Adventurous spirit, music, ambition.", boundaries: "Not comfortable with late-night first dates.",
    linkedin: {
      headline: "Product Designer at Tidewater Health | Accessibility advocate",
      about: "I design health apps that work for everyone, including people using screen readers. I organize a monthly accessibility design meetup.",
      experience: ["Product Designer at Tidewater Health (2021 – present)", "UX Designer at Brightpath Bank (2019 – 2021)"],
      education: "B.F.A. Interaction Design, Northvale School of Art", skills: ["Product design", "Accessibility", "User research"],
    },
    instagram: { handle: "lena.designs.loud", bio: "product designer · K-indie concerts · bouldering 3x/week", posts: [
      "Sent my first V5 at the bouldering gym!!! Forearms destroyed.",
      "Saw Se So Neon live and cried a little. Unreal show.",
      "Our accessibility meetup hit 100 RSVPs this month 🎉",
      "Weekend in Montauk: surf lesson, sunburn, zero regrets.",
      "Tried every bingsu place in K-town so you don't have to." ] },
  },
  {
    slug: "tomas-alvarez", name: "Tomás Alvarez", age: 32, gender: "man", open_to: ["woman"], age_min: 26, age_max: 34,
    location: "Brooklyn, NY", looking_for: "A relationship with someone who loves a good adventure.",
    priorities: "Spontaneity, music, travel, honesty.", boundaries: "",
    linkedin: {
      headline: "Sound Engineer & Producer | Owner, Basement Tape Studio",
      about: "I record bands, podcasts and the occasional symphony. Running a small studio in Bushwick since 2019.",
      experience: ["Owner/Engineer at Basement Tape Studio (2019 – present)", "Live Sound Engineer at Elm Street Music Hall (2014 – 2019)"],
      education: "Certificate in Audio Engineering, Metro Sound Institute", skills: ["Audio engineering", "Music production", "Live sound"],
    },
    instagram: { handle: "tomas.turns.knobs", bio: "studio rat · vinyl digger · motorcycle trips when I can", posts: [
      "Recorded a 12-piece Afrobeat band today. My ears are ringing in the best way.",
      "Rode up to the Delaware Water Gap on the bike. Cold, perfect.",
      "Crate digging haul: three Brazilian records from the 70s.",
      "Late-night mix session, 3am. This is my natural habitat.",
      "Two weeks backpacking in Oaxaca. Already planning the return." ] },
  },
  {
    slug: "hannah-kim", name: "Hannah Kim", age: 36, gender: "woman", open_to: ["man"], age_min: 33, age_max: 44,
    location: "Hoboken, NJ", looking_for: "A committed partner who's ready for a stable life.",
    priorities: "Reliability, kindness, healthy routines, family closeness.", boundaries: "",
    linkedin: {
      headline: "Corporate Attorney → Mediator | Founder, Common Ground Mediation",
      about: "After nine years in corporate law I started a mediation practice. I help people find agreements without going to court.",
      experience: ["Founder & Mediator at Common Ground Mediation (2022 – present)", "Associate at Halden & Rowe LLP (2013 – 2022)"],
      education: "J.D., Westbrook Law School", skills: ["Mediation", "Negotiation", "Contract law"],
    },
    instagram: { handle: "hannah.finds.common.ground", bio: "mediator · yoga at 6am · aunt to 4 · tennis on weekends", posts: [
      "Morning yoga on the Hoboken pier. Manhattan skyline as my backdrop.",
      "Took my nieces and nephews apple picking. 22 pounds of apples. Pie week.",
      "Weekend tennis doubles: we lost, but we laughed the whole time.",
      "One year of running my own practice. Scary, worth it.",
      "Meal prep Sunday: Korean banchan edition, thanks to my mom's recipes." ] },
  },
  {
    slug: "noah-fischer", name: "Noah Fischer", age: 30, gender: "man", open_to: ["woman"], age_min: 26, age_max: 33,
    location: "Manhattan, NY", looking_for: "Open to a relationship; taking it slow.",
    priorities: "Curiosity, humor, someone who likes being outdoors.", boundaries: "Not into talking about politics on a first date.",
    linkedin: {
      headline: "Wildlife Biologist | Urban Ecology Lab",
      about: "I study how birds and small mammals adapt to cities. Field work in Central Park and Jamaica Bay, plus a lot of spreadsheets.",
      experience: ["Research Biologist at Urban Ecology Lab (2020 – present)", "Field Technician at Coastal Bird Survey (2017 – 2020)"],
      education: "M.S. Ecology, Lakeshore College", skills: ["Field ecology", "Bird banding", "R statistics"],
    },
    instagram: { handle: "noah.and.the.birds", bio: "bird nerd · city ecologist · I will stop mid-sentence for a hawk", posts: [
      "Spotted a red-tailed hawk eating a pigeon on Fifth Ave. Nature is metal.",
      "Dawn bird walk in Central Park: 31 species before 8am.",
      "Kayak survey of Jamaica Bay — osprey everywhere.",
      "Hosted a trivia night for the lab. Bird category was, predictably, brutal.",
      "Weekend camping in the Pine Barrens with a borrowed tent and a lot of bug spray." ] },
  },
  {
    slug: "zara-hussain", name: "Zara Hussain", age: 29, gender: "woman", open_to: ["man", "woman"], age_min: 26, age_max: 35,
    location: "Brooklyn, NY", looking_for: "A meaningful relationship with someone playful.",
    priorities: "Humor, creative projects, food, independence.", boundaries: "",
    linkedin: {
      headline: "Pastry Chef & Founder, Saffron Crumb Bakery",
      about: "I run a small bakery in Bay Ridge mixing South Asian flavors with French technique. Cardamom croissants are our bestseller.",
      experience: ["Founder & Head Pastry Chef at Saffron Crumb Bakery (2021 – present)", "Pastry Cook at Maison Verre (2016 – 2021)"],
      education: "Diploma in Pastry Arts, Metro Culinary Institute", skills: ["Pastry", "Small business", "Menu development"],
    },
    instagram: { handle: "zara.bakes.saffron", bio: "cardamom croissants · 4am alarms · stand-up comedy fan", posts: [
      "New flavor drop: pistachio rose morning buns. Sold out by 10am!!",
      "Open mic comedy night — I just watched, but someday.",
      "4am bakery shift playlist: 90s Bollywood and Fleetwood Mac. Don't judge.",
      "Rare day off: Brooklyn Botanic Garden and an entire nap.",
      "Taught a kids' baking class. Flour is still in my hair." ] },
  },
  {
    slug: "olivia-grant", name: "Olivia Grant", age: 33, gender: "woman", open_to: ["woman", "nonbinary"], age_min: 28, age_max: 40,
    location: "Brooklyn, NY", looking_for: "A long-term partner to share a home and a dog with someday.",
    priorities: "Emotional openness, outdoor adventures, community involvement.", boundaries: "",
    linkedin: {
      headline: "Environmental Lawyer | Clean water advocacy",
      about: "I represent community groups fighting for clean water and fair zoning. Former park ranger, still a ranger at heart.",
      experience: ["Staff Attorney at Riverkeeper Legal Fund (2019 – present)", "Seasonal Park Ranger at Shawangunk State Preserve (2012 – 2015)"],
      education: "J.D., Eastfield University School of Law", skills: ["Environmental law", "Litigation", "Community organizing"],
    },
    instagram: { handle: "olivia.outside.always", bio: "water lawyer · former ranger · rock climbing in the Gunks", posts: [
      "Climbing in the Gunks this weekend. Finally led a 5.8!",
      "Testified at a hearing about the Gowanus cleanup today. Long day, good day.",
      "Foster dog update: Biscuit has been adopted 🥲 I miss him already.",
      "Community garden harvest: way too much kale, as usual.",
      "Backpacking the Long Path for 3 days. No signal, pure joy." ] },
  },
  {
    slug: "riya-mehta", name: "Riya Mehta", age: 31, gender: "woman", open_to: ["woman", "nonbinary"], age_min: 27, age_max: 38,
    location: "Manhattan, NY", looking_for: "A committed relationship with someone warm and curious.",
    priorities: "Art, cooking together, thoughtful conversation, travel.", boundaries: "",
    linkedin: {
      headline: "Documentary Producer | Stories about food and migration",
      about: "I produce documentaries about how families carry recipes across borders. My last film followed three generations of a Gujarati sweet shop.",
      experience: ["Producer at Long Table Films (2019 – present)", "Associate Producer at Northlight Media (2015 – 2019)"],
      education: "M.F.A. Documentary Film, Hillcrest College", skills: ["Documentary production", "Interviewing", "Editing"],
    },
    instagram: { handle: "riya.rolls.film", bio: "documentary producer · recipe collector · film camera always loaded", posts: [
      "Our documentary screened at a festival in Toronto! Three generations of mithai on the big screen.",
      "Cooking my nani's dal with a friend who has never had it. Converted.",
      "Shot a roll of Portra in Chinatown at golden hour.",
      "Pottery date with myself. Made a wobbly cup I love.",
      "Train trip up the Hudson to Beacon for Dia and a long lunch." ] },
  },
  {
    slug: "kai-nakamura", name: "Kai Nakamura", age: 28, gender: "nonbinary", open_to: ["woman", "man", "nonbinary"], age_min: 25, age_max: 36,
    location: "Brooklyn, NY", looking_for: "Open — friendship first, then see where it goes.",
    priorities: "Creativity, kindness, queer community, playful energy.", boundaries: "Please use they/them.",
    linkedin: {
      headline: "Game Designer at Little Lantern Games",
      about: "I design cozy narrative games about community and care. Our last game was about running a neighborhood tea shop.",
      experience: ["Game Designer at Little Lantern Games (2021 – present)", "Level Designer at Stormglass Interactive (2018 – 2021)"],
      education: "B.A. Game Design, Northvale School of Art", skills: ["Narrative design", "Prototyping", "Unity"],
    },
    instagram: { handle: "kai.makes.cozy.games", bio: "they/them · cozy game designer · tea snob · roller skating", posts: [
      "Our tea-shop game hit 100k players! Thank you for loving our little world.",
      "Roller skating at the rink on Thursday nights is my therapy.",
      "Hosting a game jam this weekend at the community center — everyone welcome.",
      "Tried a gongfu tea ceremony and now I need a new shelf for teaware.",
      "Picnic in McCarren Park with zines, plums, and friends." ] },
  },
  {
    slug: "sam-oduya", name: "Sam Oduya", age: 34, gender: "nonbinary", open_to: ["woman", "man", "nonbinary"], age_min: 28, age_max: 40,
    location: "Manhattan, NY", looking_for: "A long-term partner who likes building things together.",
    priorities: "Community, honesty, music, cooking.", boundaries: "Please use they/them.",
    linkedin: {
      headline: "Architect | Affordable housing design at Commonwall Architects",
      about: "I design affordable housing with shared courtyards and community kitchens. I believe buildings can make neighbors into friends.",
      experience: ["Project Architect at Commonwall Architects (2018 – present)", "Designer at Stack & Beam (2014 – 2018)"],
      education: "M.Arch, Eastfield University", skills: ["Architecture", "Community design", "Revit"],
    },
    instagram: { handle: "sam.draws.homes", bio: "they/them · architect · Afrobeats DJ on weekends · plant parent", posts: [
      "DJ set at a rooftop party — Afrobeats until the sun came up.",
      "Our courtyard housing project broke ground today. 84 homes!",
      "Sunday stew for the whole building. Community kitchen energy.",
      "Repotted 14 plants. My apartment is now a jungle.",
      "Sketch walk through the West Village, looking at stoops." ] },
  },
  {
    slug: "grace-whitfield", name: "Grace Whitfield", age: 39, gender: "woman", open_to: ["man"], age_min: 35, age_max: 46,
    location: "Philadelphia, PA", looking_for: "A grounded long-term relationship.",
    priorities: "Stability, humor, love of travel, open communication.", boundaries: "Long distance is fine for an initial chat but I'd want to meet in person eventually.",
    linkedin: {
      headline: "Hospital Operations Director | Process improvement",
      about: "I make hospitals run better: shorter waits, fewer double-bookings, happier nurses. Fifteen years in healthcare operations.",
      experience: ["Director of Operations at Liberty General Hospital (2017 – present)", "Operations Manager at Keystone Health (2009 – 2017)"],
      education: "M.B.A., Brookfield Business School", skills: ["Operations", "Lean process improvement", "Team leadership"],
    },
    instagram: { handle: "grace.travels.slow", bio: "ops nerd · 31 countries · Phillies diehard · gardener", posts: [
      "Country #31: Japan. The trains alone made me emotional.",
      "Phillies game with my brother. We will not discuss the 8th inning.",
      "My tomato plants have taken over the entire backyard.",
      "Weekend in Cape May: bikes, bookstore, lighthouse.",
      "Hosted a dinner party for 10. The brisket held." ] },
  },
  {
    slug: "ben-adeyemi", name: "Ben Adeyemi", age: 40, gender: "man", open_to: ["woman"], age_min: 33, age_max: 42,
    location: "Manhattan, NY", looking_for: "A serious relationship; ready to settle down.",
    priorities: "Generosity, intellectual conversation, travel, family.", boundaries: "",
    linkedin: {
      headline: "Professor of Economics | Development and urban labor markets",
      about: "I study how cities create opportunities for migrants. I teach undergraduates and run a summer program for first-generation students.",
      experience: ["Associate Professor of Economics at Metro City University (2015 – present)", "Postdoctoral Fellow at Global Labor Institute (2012 – 2015)"],
      education: "Ph.D. Economics, Westbrook University", skills: ["Econometrics", "Teaching", "Public policy"],
      volunteering: "Director, First-Gen Scholars Summer Program",
    },
    instagram: { handle: "prof.ben.walks", bio: "economist · jazz clubs · Lagos ↔ NYC · long walks, longer conversations", posts: [
      "Late set at the Village Vanguard. Some nights the city just gives.",
      "Summer program graduation — 40 first-gen students heading to college!",
      "Back in Lagos for a conference and my mother's cooking.",
      "Sunday walk: Brooklyn Bridge to Red Hook, 3 hours of podcasts.",
      "Chess in Washington Square Park. Lost to a 10-year-old, again." ] },
  },
  {
    slug: "chloe-martin", name: "Chloe Martin", age: 26, gender: "woman", open_to: ["man"], age_min: 25, age_max: 31,
    location: "Brooklyn, NY", looking_for: "Open to see where things go.",
    priorities: "Fun, spontaneity, fitness, shared playlists.", boundaries: "",
    linkedin: {
      headline: "Marketing Manager at Fernway Outdoor Co.",
      about: "I market outdoor gear by actually using it. I run our brand ambassador program and the company running club.",
      experience: ["Marketing Manager at Fernway Outdoor Co. (2022 – present)", "Social Media Coordinator at Peak & Pine (2020 – 2022)"],
      education: "B.A. Communications, Lakeshore College", skills: ["Brand marketing", "Content strategy", "Community building"],
    },
    instagram: { handle: "chloe.goes.outside", bio: "marketing @ outdoor co · half marathons · spin class addict · playlist curator", posts: [
      "Half marathon PR: 1:44! Already signed up for the next one.",
      "Spin class at 6am followed by a bagel the size of my head.",
      "My new running playlist is 3 hours long and I stand by every song.",
      "Weekend at a lake house with friends. Paddleboarded, fell in, repeatedly.",
      "Company running club hit 50 members!" ] },
  },
  {
    slug: "leo-bianchi", name: "Leo Bianchi", age: 27, gender: "man", open_to: ["woman", "man"], age_min: 24, age_max: 33,
    location: "Brooklyn, NY", looking_for: "Exploring; would love something long-term with the right person.",
    priorities: "Creativity, food, laughter, emotional honesty.", boundaries: "",
    linkedin: {
      headline: "Illustrator & Animator | Children's books and short films",
      about: "I illustrate picture books and animate short films. My latest book is about a pigeon who wants to be a ballet dancer.",
      experience: ["Freelance Illustrator & Animator (2019 – present)", "Animator at Paperboat Studio (2017 – 2019)"],
      education: "B.F.A. Illustration, Northvale School of Art", skills: ["Illustration", "2D animation", "Storyboarding"],
    },
    instagram: { handle: "leo.draws.pigeons", bio: "illustrator · pigeon advocate · nonna's gnocchi forever", posts: [
      "My pigeon ballerina book is out!! Reading it at the library on Saturday.",
      "Sunday gnocchi with nonna over video call. She critiqued my technique live.",
      "Sketching people on the G train. Nobody noticed. Probably.",
      "Animated short got into a festival in Annecy!",
      "Thrifting for vintage sweaters is my cardio." ] },
  },
  {
    slug: "andre-silva", name: "André Silva", age: 31, gender: "man", open_to: ["man", "nonbinary"], age_min: 27, age_max: 38,
    location: "Manhattan, NY", looking_for: "A long-term relationship with someone kind and adventurous.",
    priorities: "Travel, fitness, dancing, honesty.", boundaries: "",
    linkedin: {
      headline: "Airline Pilot (First Officer) | Former flight instructor",
      about: "I fly transatlantic routes and spent five years teaching people to fly small planes. I love explaining weather.",
      experience: ["First Officer at Atlantic Crest Airways (2020 – present)", "Flight Instructor at Skyward Flight School (2015 – 2020)"],
      education: "B.S. Aeronautical Science, Coastal Aviation University", skills: ["Commercial aviation", "Instruction", "Meteorology"],
    },
    instagram: { handle: "andre.flies.far", bio: "pilot · samba on weekends · layover food critic", posts: [
      "Layover in Lisbon: pastel de nata count = 5.",
      "Samba class in the East Village — Rio-born and still learning.",
      "Sunrise over Greenland from the flight deck. Never gets old.",
      "Morning run along the Hudson after a red-eye. Jet lag who?",
      "Taught my nephew to fly a kite. Pilot training starts early." ] },
  },
  {
    slug: "ravi-shah", name: "Ravi Shah", age: 34, gender: "man", open_to: ["man", "nonbinary"], age_min: 28, age_max: 40,
    location: "Brooklyn, NY", looking_for: "Something serious with a creative, curious partner.",
    priorities: "Art, cooking, conversation, community.", boundaries: "Prefers daytime first meetups.",
    linkedin: {
      headline: "Restaurant Owner & Chef, Little Monsoon",
      about: "I run a 30-seat restaurant serving coastal Indian food. We source from local farms and close on Mondays so the team can rest.",
      experience: ["Chef-Owner at Little Monsoon (2019 – present)", "Sous Chef at Harbor Kitchen (2013 – 2019)"],
      education: "Culinary Arts Diploma, Metro Culinary Institute", skills: ["Restaurant management", "Menu design", "Sourcing"],
    },
    instagram: { handle: "ravi.cooks.monsoon", bio: "chef @ little monsoon · gallery hopper · monday is my only day off", posts: [
      "Monday off: Chelsea galleries and a very long lunch someone else cooked.",
      "New menu: Goan fish curry with greens from our farm partner upstate.",
      "Our team turned 5 years old this week. Grateful for every one of them.",
      "Pottery class made me realize I should stick to plates I can cook on.",
      "Sunset bike ride along the Brooklyn waterfront." ] },
  },
  {
    slug: "isabel-cruz", name: "Isabel Cruz", age: 30, gender: "woman", open_to: ["man"], age_min: 28, age_max: 36,
    location: "Boston, MA", looking_for: "A long-term relationship; open to relocating for the right person eventually.",
    priorities: "Intellectual curiosity, kindness, love of the outdoors.", boundaries: "",
    linkedin: {
      headline: "Biomedical Engineer | Prosthetics R&D at Kinetic Limb Labs",
      about: "I design prosthetic hands that are cheaper and more responsive. Fieldwork with clinics in Puerto Rico and Guatemala.",
      experience: ["Biomedical Engineer at Kinetic Limb Labs (2020 – present)", "Research Engineer at Harborview Rehab Institute (2018 – 2020)"],
      education: "M.S. Biomedical Engineering, Eastfield University", skills: ["Mechanical design", "3D printing", "Clinical research"],
    },
    instagram: { handle: "isabel.builds.hands", bio: "prosthetics engineer · Puerto Rico ♥ Boston · hiking the Whites", posts: [
      "Fitted a 3D-printed hand for an 8-year-old today. She immediately gave me a high five.",
      "Hiked Franconia Ridge in the fog. Couldn't see anything. Loved it.",
      "Salsa night in Cambridge with my lab mates.",
      "Back home in San Juan for the holidays — pasteles assembly line with the whole family.",
      "Weekend makerspace session: built a lamp from bike parts." ] },
  },
  {
    slug: "will-thompson", name: "Will Thompson", age: 29, gender: "man", open_to: ["woman"], age_min: 25, age_max: 32,
    location: "Manhattan, NY", looking_for: "Looking for a relationship with someone fun and grounded.",
    priorities: "Humor, adventure, live music, loyalty.", boundaries: "",
    linkedin: {
      headline: "Firefighter & EMT | Youth soccer coach",
      about: "Firefighter and EMT for six years. I teach fire safety at elementary schools and coach a youth soccer team.",
      experience: ["Firefighter/EMT at Metro City Fire Department (2018 – present)", "EMT at Lenox Ambulance Service (2016 – 2018)"],
      education: "EMT-B Certification; B.A. Kinesiology, Lakeshore College", skills: ["Emergency response", "EMT", "Youth coaching"],
    },
    instagram: { handle: "will.on.shift", bio: "firefighter · youth soccer coach · concerts, chili cook-offs, dog uncle", posts: [
      "Firehouse chili cook-off: we came second. The judges were bribed.",
      "U10 soccer team won their first game of the season!",
      "Saw a folk band in a tiny bar on the Lower East Side. Best night out in ages.",
      "Fire safety day at PS 87 — 200 kids learned stop, drop and roll.",
      "Weekend hike at Bear Mountain with my sister's dog, Moose." ] },
  },
];

export function sourcePath(slug: string, platform: "linkedin" | "instagram"): string {
  return `/demo/sources/${slug}/${platform}`;
}
