/**
 * Geocoding utilities for address search and validation
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 */

type ServiceArea = {
  name: string;
  queryBias: string;
  latitude: number;
  longitude: number;
  radiusMiles: number;
  viewbox: string;
  locationAliases: string[];
};

type FeaturedLocation = {
  placeName: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  aliases: string[];
};

const DEFAULT_SEARCH_LIMIT = 12;

const SERVICE_AREAS: ServiceArea[] = [
  {
    name: 'Fort Wayne',
    queryBias: 'Fort Wayne, IN',
    latitude: 41.0793,
    longitude: -85.1394,
    radiusMiles: 25,
    viewbox: '-85.5,41.3,-84.8,40.8',
    locationAliases: [
      'fort wayne',
      'fort wayne in',
      'downtown fort wayne',
      'downtown',
      'the landing',
      'west central',
      'southwood park',
      'northside',
      'north side fort wayne',
      'south side fort wayne',
      'west side fort wayne',
      'east side fort wayne',
      'new haven',
      'new haven in',
      'allen county',
      'parkview field',
      'electric works',
      'promenade park',
      'headwaters park',
      'science central',
      'fort wayne childrens zoo',
      'childrens zoo',
      'glenbrook square',
      'jefferson pointe',
      'allen county war memorial coliseum',
      'war memorial coliseum',
      'memorial coliseum',
      'parkview regional medical center',
      'parkview regional',
      'lutheran hospital',
      'dupont hospital',
      'purdue fort wayne',
      'pfw',
      'ipfw',
      'indiana tech',
      'university of saint francis',
      'saint francis fort wayne',
      'franke park',
      'foster park',
      'foellinger theatre',
      'foellinger freimann botanical conservatory',
      'botanical conservatory',
      'grand wayne center',
      'embassy theatre',
      'coliseum boulevard',
      'georgetown',
      'canterbury',
      'arlington park',
      'southwest fort wayne',
      'northeast fort wayne',
      'northwest fort wayne',
      'southeast fort wayne',
      'fort wayne international airport',
      'fwa airport',
      'fwa',
      'general motors fort wayne assembly',
      'gm fort wayne assembly',
      'fort wayne assembly',
      'sweetwater',
      'sweetwater sound',
      'amazon fulfillment center',
      'amazon fort wayne',
      'steel dynamics',
      'sdi fort wayne',
      'lima road',
      'coldwater road',
      'maplecrest road',
      'illinois road',
      'bluffton road',
      'jefferson boulevard',
      'dupont road',
      'st joe center road',
      'georgetown square',
      'coventry',
      'coventry plaza',
      'northcrest',
      'science central',
      'allen county public library',
      'public library main',
      'the clyde theatre',
      'clyde theatre',
      'lutheran downtown hospital',
      'st joseph hospital',
      'franciscan center',
      'airport expressway',
      'gateway plaza',
      'northcrest shopping center',
      'canterbury green',
      'redeemer radio area',
      'woodland plaza',
      'north anthony',
      'waynedale',
      'Aboite',
      'aboite',
      'new haven high school',
      'snider high school',
      'northrop high school',
      'carroll high school',
      'homestead high school',
      'south side high school',
      'northcrest',
      'coliseum crossing',
      'apple glen',
      'ruths chris',
      'ruth s chris',
      'ruth chris',
    ],
  },
];

const FEATURED_FORT_WAYNE_LOCATIONS: FeaturedLocation[] = [
  {
    placeName: 'Parkview Field',
    streetAddress: '1301 Ewing St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0676,
    longitude: -85.1402,
    aliases: ['tin caps stadium', 'baseball stadium'],
  },
  {
    placeName: 'Electric Works',
    streetAddress: '1620 Broadway',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0711,
    longitude: -85.1537,
    aliases: ['union street market', 'west central'],
  },
  {
    placeName: 'Promenade Park',
    streetAddress: '202 W Superior St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0818,
    longitude: -85.1438,
    aliases: ['riverfront'],
  },
  {
    placeName: 'Headwaters Park',
    streetAddress: '333 S Clinton St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0831,
    longitude: -85.1385,
    aliases: ['festival plaza'],
  },
  {
    placeName: "Fort Wayne Children's Zoo",
    streetAddress: '3411 Sherman Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46808',
    latitude: 41.1182,
    longitude: -85.1651,
    aliases: ['childrens zoo', 'zoo'],
  },
  {
    placeName: 'Glenbrook Square',
    streetAddress: '4201 Coldwater Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46805',
    latitude: 41.1165,
    longitude: -85.1389,
    aliases: ['glenbrook mall', 'mall'],
  },
  {
    placeName: 'Jefferson Pointe',
    streetAddress: '4130 W Jefferson Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46804',
    latitude: 41.072,
    longitude: -85.1954,
    aliases: ['shopping center'],
  },
  {
    placeName: 'Allen County War Memorial Coliseum',
    streetAddress: '4000 Parnell Ave',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46805',
    latitude: 41.1096,
    longitude: -85.1118,
    aliases: ['war memorial coliseum', 'memorial coliseum', 'coliseum'],
  },
  {
    placeName: 'Parkview Regional Medical Center',
    streetAddress: '11109 Parkview Plaza Dr',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46845',
    latitude: 41.1858,
    longitude: -85.1005,
    aliases: ['parkview regional', 'hospital'],
  },
  {
    placeName: 'Lutheran Hospital',
    streetAddress: '7950 W Jefferson Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46804',
    latitude: 41.0607,
    longitude: -85.2466,
    aliases: ['lutheran health network', 'hospital'],
  },
  {
    placeName: 'Purdue Fort Wayne',
    streetAddress: '2101 E Coliseum Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46805',
    latitude: 41.1183,
    longitude: -85.1116,
    aliases: ['pfw', 'ipfw', 'campus', 'college'],
  },
  {
    placeName: 'Grand Wayne Convention Center',
    streetAddress: '120 W Jefferson Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.079,
    longitude: -85.1415,
    aliases: ['grand wayne center', 'convention center', 'embassy theatre'],
  },
  {
    placeName: 'Fort Wayne International Airport',
    streetAddress: '3801 W Ferguson Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46809',
    latitude: 40.9785,
    longitude: -85.1951,
    aliases: ['fwa', 'airport', 'terminal'],
  },
  {
    placeName: 'General Motors Fort Wayne Assembly',
    streetAddress: '12200 Lafayette Center Rd',
    city: 'Roanoke',
    state: 'IN',
    zipCode: '46783',
    latitude: 40.9914,
    longitude: -85.3129,
    aliases: ['gm plant', 'assembly plant', 'silverado plant', 'job site'],
  },
  {
    placeName: 'Amazon Fulfillment Center',
    streetAddress: '9798 Smith Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46809',
    latitude: 40.9975,
    longitude: -85.1902,
    aliases: ['amazon warehouse', 'amazon job site', 'fulfillment center'],
  },
  {
    placeName: 'Sweetwater',
    streetAddress: '5501 US Hwy 30 W',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46818',
    latitude: 41.0626,
    longitude: -85.2147,
    aliases: ['sweetwater sound', 'music store', 'distribution'],
  },
  {
    placeName: 'Steel Dynamics',
    streetAddress: '7575 W Jefferson Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46804',
    latitude: 41.0618,
    longitude: -85.2434,
    aliases: ['sdi', 'steel plant', 'industrial site'],
  },
  {
    placeName: 'Dupont Hospital',
    streetAddress: '2520 E Dupont Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46825',
    latitude: 41.1784,
    longitude: -85.1066,
    aliases: ['dupont', 'hospital', 'medical center'],
  },
  {
    placeName: 'Lutheran Downtown Hospital',
    streetAddress: '702 Van Buren St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0756,
    longitude: -85.1455,
    aliases: ['downtown hospital', 'lutheran downtown'],
  },
  {
    placeName: 'Indiana Tech',
    streetAddress: '1600 E Washington Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46803',
    latitude: 41.0825,
    longitude: -85.1184,
    aliases: ['college', 'campus', 'warriors'],
  },
  {
    placeName: 'University of Saint Francis',
    streetAddress: '2701 Spring St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46808',
    latitude: 41.1098,
    longitude: -85.1763,
    aliases: ['saint francis', 'usf'],
  },
  {
    placeName: 'Science Central',
    streetAddress: '1950 N Clinton St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46805',
    latitude: 41.0954,
    longitude: -85.1374,
    aliases: ['science museum', 'museum'],
  },
  {
    placeName: 'Allen County Public Library Main',
    streetAddress: '900 Library Plaza',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.077,
    longitude: -85.1402,
    aliases: ['acpl', 'main library', 'public library'],
  },
  {
    placeName: 'Embassy Theatre',
    streetAddress: '125 W Jefferson Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0792,
    longitude: -85.1419,
    aliases: ['embassy', 'theatre', 'downtown theater'],
  },
  {
    placeName: 'Foellinger-Freimann Botanical Conservatory',
    streetAddress: '1100 S Calhoun St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0775,
    longitude: -85.1382,
    aliases: ['botanical conservatory', 'conservatory'],
  },
  {
    placeName: 'The Clyde Theatre',
    streetAddress: '1808 Bluffton Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46809',
    latitude: 41.0576,
    longitude: -85.1633,
    aliases: ['clyde theatre', 'club room at the clyde'],
  },
  {
    placeName: 'Georgetown Square',
    streetAddress: '6511 E State Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46815',
    latitude: 41.1028,
    longitude: -85.0544,
    aliases: ['georgetown', 'shopping plaza'],
  },
  {
    placeName: 'Coventry Plaza',
    streetAddress: '5735 Falls Dr',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46804',
    latitude: 41.0568,
    longitude: -85.2173,
    aliases: ['coventry', 'southwest shopping'],
  },
  {
    placeName: 'Northcrest Shopping Center',
    streetAddress: '1005 E Coliseum Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46805',
    latitude: 41.1189,
    longitude: -85.1275,
    aliases: ['northcrest', 'shopping center'],
  },
  {
    placeName: 'Canterbury Green',
    streetAddress: '2727 Canterbury Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46835',
    latitude: 41.1041,
    longitude: -85.0635,
    aliases: ['canterbury', 'apartment complex'],
  },
  {
    placeName: 'Costco Wholesale Fort Wayne',
    streetAddress: '5110 Value Dr',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46808',
    latitude: 41.124,
    longitude: -85.2055,
    aliases: ['costco', 'warehouse club', 'retail', 'job site'],
  },
  {
    placeName: "Sam's Club Fort Wayne",
    streetAddress: '6736 Lima Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46818',
    latitude: 41.1408,
    longitude: -85.1647,
    aliases: ['sams club', 'warehouse club', 'retail', 'job site'],
  },
  {
    placeName: 'Walmart Supercenter - Lima Rd',
    streetAddress: '10105 Lima Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46818',
    latitude: 41.173,
    longitude: -85.1652,
    aliases: ['walmart', 'supercenter', 'retail', 'store', 'job site'],
  },
  {
    placeName: 'Walmart Supercenter - Maysville Rd',
    streetAddress: '10420 Maysville Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46835',
    latitude: 41.126,
    longitude: -85.0084,
    aliases: ['walmart', 'supercenter', 'retail', 'store', 'job site'],
  },
  {
    placeName: 'Meijer - Lima Rd',
    streetAddress: '6309 Lima Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46818',
    latitude: 41.1362,
    longitude: -85.1644,
    aliases: ['meijer', 'grocery', 'retail', 'store', 'job site'],
  },
  {
    placeName: 'Meijer - Maysville Rd',
    streetAddress: '10301 Maysville Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46835',
    latitude: 41.123,
    longitude: -85.0076,
    aliases: ['meijer', 'grocery', 'retail', 'store', 'job site'],
  },
  {
    placeName: 'Target - Lima Rd',
    streetAddress: '6030 Lima Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46818',
    latitude: 41.132,
    longitude: -85.1635,
    aliases: ['target', 'retail', 'store', 'job site'],
  },
  {
    placeName: "Lowe's Home Improvement - Apple Glen",
    streetAddress: '1130 Apple Glen Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46804',
    latitude: 41.0766,
    longitude: -85.2336,
    aliases: ['lowes', 'hardware', 'home improvement', 'retail', 'job site'],
  },
  {
    placeName: 'The Home Depot - Lima Rd',
    streetAddress: '6235 Lima Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46818',
    latitude: 41.1367,
    longitude: -85.1641,
    aliases: ['home depot', 'hardware', 'home improvement', 'retail', 'job site'],
  },
  {
    placeName: "Menards - Illinois Rd",
    streetAddress: '6310 Illinois Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46804',
    latitude: 41.0737,
    longitude: -85.2237,
    aliases: ['menards', 'hardware', 'home improvement', 'retail', 'job site'],
  },
  {
    placeName: 'Chick-fil-A - Coliseum Blvd',
    streetAddress: '411 W Coliseum Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46805',
    latitude: 41.1186,
    longitude: -85.1432,
    aliases: ['chick fil a', 'restaurant', 'food', 'pickup'],
  },
  {
    placeName: 'Chipotle Mexican Grill - Jefferson Pointe',
    streetAddress: '4150 W Jefferson Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46804',
    latitude: 41.0723,
    longitude: -85.1963,
    aliases: ['chipotle', 'restaurant', 'food', 'pickup'],
  },
  {
    placeName: 'Texas Roadhouse - Fort Wayne',
    streetAddress: '6411 W Jefferson Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46804',
    latitude: 41.0629,
    longitude: -85.2258,
    aliases: ['texas roadhouse', 'restaurant', 'steakhouse', 'food', 'pickup'],
  },
  {
    placeName: 'Olive Garden - Coliseum Blvd',
    streetAddress: '315 E Coliseum Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46805',
    latitude: 41.1174,
    longitude: -85.1371,
    aliases: ['olive garden', 'restaurant', 'italian', 'food', 'pickup'],
  },
  {
    placeName: 'Buffalo Wild Wings - Coldwater Rd',
    streetAddress: '5519 Coldwater Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46825',
    latitude: 41.1282,
    longitude: -85.1398,
    aliases: ['buffalo wild wings', 'bww', 'restaurant', 'food', 'pickup'],
  },
  {
    placeName: 'Panera Bread - Coldwater Rd',
    streetAddress: '5250 Coldwater Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46825',
    latitude: 41.1256,
    longitude: -85.1395,
    aliases: ['panera', 'restaurant', 'bakery', 'food', 'pickup'],
  },
  {
    placeName: "Ruth's Chris Steak House",
    streetAddress: '224 W Wayne St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0795,
    longitude: -85.1421,
    aliases: ['ruths chris', 'ruth s chris', 'ruth chris', 'steakhouse', 'restaurant', 'food'],
  },
  {
    placeName: 'Dana Incorporated',
    streetAddress: '3939 Technology Dr',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46808',
    latitude: 41.1293,
    longitude: -85.1707,
    aliases: ['dana', 'dana hq', 'factory', 'manufacturing', 'job site'],
  },
  {
    placeName: 'Do it Best Corp HQ',
    streetAddress: '6502 Nelson Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46803',
    latitude: 41.0629,
    longitude: -85.0581,
    aliases: ['do it best', 'corporate', 'warehouse', 'distribution', 'job site'],
  },
  {
    placeName: 'Vera Bradley Distribution Center',
    streetAddress: '12420 Stonebridge Rd',
    city: 'Roanoke',
    state: 'IN',
    zipCode: '46783',
    latitude: 40.9893,
    longitude: -85.299,
    aliases: ['vera bradley', 'distribution center', 'warehouse', 'job site'],
  },
  {
    placeName: 'Fort Wayne Metals',
    streetAddress: '9609 Ardmore Ave',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46809',
    latitude: 41.0008,
    longitude: -85.1684,
    aliases: ['fort wayne metals', 'factory', 'manufacturing', 'industrial', 'job site'],
  },
  {
    placeName: 'UPS Customer Center',
    streetAddress: '5801 Industrial Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46825',
    latitude: 41.131,
    longitude: -85.1411,
    aliases: ['ups', 'shipping', 'warehouse', 'logistics', 'job site'],
  },
  {
    placeName: 'FedEx Ship Center',
    streetAddress: '3801 Lower Huntington Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46809',
    latitude: 40.9818,
    longitude: -85.1934,
    aliases: ['fedex', 'shipping', 'warehouse', 'logistics', 'job site'],
  },
  {
    placeName: 'USPS Processing and Distribution Center',
    streetAddress: '1501 S Clinton St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0615,
    longitude: -85.1386,
    aliases: ['usps', 'post office', 'mail distribution', 'logistics', 'job site'],
  },
  {
    placeName: 'Aboite Center',
    streetAddress: '4200 W Jefferson Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46804',
    latitude: 41.0722,
    longitude: -85.1986,
    aliases: ['aboite', 'southwest', 'shopping center', 'retail', 'job site'],
  },
  {
    placeName: 'Valbruna Slater Stainless, Inc.',
    streetAddress: '2400 Taylor St W',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0682,
    longitude: -85.1645,
    aliases: ['valbruna stainless', 'valbruna', 'steel mill', 'factory', 'job site', 'manufacturing'],
  },
  {
    placeName: 'Parkview Hospital Randallia',
    streetAddress: '2200 Randallia Dr',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46805',
    latitude: 41.0962,
    longitude: -85.1099,
    aliases: ['randallia hospital', 'parkview randallia', 'hospital', 'medical'],
  },
  {
    placeName: 'Ivy Tech Community College North Campus',
    streetAddress: '3701 Dean Dr',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46835',
    latitude: 41.1225,
    longitude: -85.0952,
    aliases: ['ivy tech', 'college', 'school', 'campus'],
  },
  {
    placeName: 'R. Nelson Snider High School',
    streetAddress: '4600 Fairlawn Pass',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46815',
    latitude: 41.1071,
    longitude: -85.082,
    aliases: ['snider high school', 'snider', 'school'],
  },
  {
    placeName: 'Northrop High School',
    streetAddress: '7001 Coldwater Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46825',
    latitude: 41.1453,
    longitude: -85.1404,
    aliases: ['northrop', 'high school', 'school'],
  },
  {
    placeName: 'South Side High School',
    streetAddress: '3601 S Calhoun St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46807',
    latitude: 41.0534,
    longitude: -85.1362,
    aliases: ['south side high school', 'south side', 'school'],
  },
  {
    placeName: 'Wayne High School',
    streetAddress: '9100 Winchester Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46819',
    latitude: 41.0007,
    longitude: -85.1403,
    aliases: ['wayne high school', 'wayne', 'school'],
  },
  {
    placeName: 'North Side High School',
    streetAddress: '475 E State Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46805',
    latitude: 41.098,
    longitude: -85.1339,
    aliases: ['north side high school', 'north side', 'school'],
  },
  {
    placeName: 'Carroll High School',
    streetAddress: '3701 Carroll Rd',
    city: 'Huntertown',
    state: 'IN',
    zipCode: '46818',
    latitude: 41.1904,
    longitude: -85.1937,
    aliases: ['carroll high school', 'carroll', 'school'],
  },
  {
    placeName: 'Homestead High School',
    streetAddress: '4310 Homestead Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46814',
    latitude: 41.0436,
    longitude: -85.2861,
    aliases: ['homestead high school', 'homestead', 'school'],
  },
  {
    placeName: 'Coney Island',
    streetAddress: '131 W Main St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0799,
    longitude: -85.1411,
    aliases: ['coney island fort wayne', 'hot dogs', 'restaurant', 'food'],
  },
  {
    placeName: "Cindy's Diner",
    streetAddress: '230 W Berry St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.079,
    longitude: -85.1424,
    aliases: ['cindys diner', 'diner', 'restaurant', 'food'],
  },
  {
    placeName: 'The Oyster Bar',
    streetAddress: '1830 S Calhoun St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0687,
    longitude: -85.1384,
    aliases: ['oyster bar', 'restaurant', 'seafood', 'food'],
  },
  {
    placeName: 'Club Soda',
    streetAddress: '235 E Superior St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.083,
    longitude: -85.1377,
    aliases: ['club soda fort wayne', 'restaurant', 'steakhouse', 'food'],
  },
  {
    placeName: 'Tolon',
    streetAddress: '614 S Harrison St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0809,
    longitude: -85.1418,
    aliases: ['tolon fort wayne', 'restaurant', 'food'],
  },
  {
    placeName: 'Nawa',
    streetAddress: '126 W Columbia St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0813,
    longitude: -85.1413,
    aliases: ['nawa fort wayne', 'restaurant', 'thai', 'food'],
  },
  {
    placeName: 'Shigs In Pit Barbeque',
    streetAddress: '2008 Fairfield Ave',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0675,
    longitude: -85.1455,
    aliases: ['shigs in pit', 'bbq', 'restaurant', 'food'],
  },
  {
    placeName: 'DeBrand Fine Chocolates',
    streetAddress: '10105 Auburn Park Dr',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46825',
    latitude: 41.1755,
    longitude: -85.1151,
    aliases: ['debrand', 'chocolate', 'dessert', 'shop'],
  },
  {
    placeName: "Raimondo's Pizza",
    streetAddress: '2608 W State Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46808',
    latitude: 41.0962,
    longitude: -85.1772,
    aliases: ['raimondos pizza', 'pizza', 'restaurant', 'food'],
  },
  {
    placeName: 'Lawton Park',
    streetAddress: '1900 N Clinton St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46805',
    latitude: 41.0889,
    longitude: -85.138,
    aliases: ['lawton park', 'park', 'unpopular location'],
  },
  {
    placeName: 'Shoaff Park',
    streetAddress: '6401 St Joe Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46835',
    latitude: 41.1435,
    longitude: -85.0956,
    aliases: ['shoaff', 'park', 'unpopular location'],
  },
  {
    placeName: 'Kreager Park',
    streetAddress: '7225 N River Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46815',
    latitude: 41.0888,
    longitude: -85.0409,
    aliases: ['kreager', 'park', 'east side park'],
  },
  {
    placeName: 'Ivan Lebamoff Reservoir Park',
    streetAddress: '2300 S Clinton St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46803',
    latitude: 41.0633,
    longitude: -85.1348,
    aliases: ['reservoir park', 'lebamoff park', 'park'],
  },
  {
    placeName: 'Swinney Park',
    streetAddress: '1101 W Jefferson Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0747,
    longitude: -85.1643,
    aliases: ['swinney', 'park', 'west side park'],
  },
  {
    placeName: 'Lindenwood Nature Preserve',
    streetAddress: '600 Lindenwood Ave',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46808',
    latitude: 41.0799,
    longitude: -85.1848,
    aliases: ['lindenwood', 'nature preserve', 'trails', 'unpopular location'],
  },
  {
    placeName: 'The Bradley',
    streetAddress: '204 W Main St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0803,
    longitude: -85.142,
    aliases: ['bradley hotel', 'hotel', 'downtown'],
  },
  {
    placeName: 'Courtyard Fort Wayne Downtown',
    streetAddress: '1150 S Harrison St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0754,
    longitude: -85.1407,
    aliases: ['courtyard marriott', 'hotel', 'downtown'],
  },
  {
    placeName: 'Dupont Plaza Drive',
    streetAddress: 'Dupont Plaza Dr',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46825',
    latitude: 41.1777,
    longitude: -85.0974,
    aliases: ['dupont plaza', 'medical offices', 'job site'],
  },
  {
    placeName: 'Waynedale',
    streetAddress: 'Waynedale',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46809',
    latitude: 41.0201,
    longitude: -85.1691,
    aliases: ['waynedale fort wayne', 'neighborhood', 'unpopular location'],
  },
  {
    placeName: 'Plantations of Aboite',
    streetAddress: 'Plantations of Aboite',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46814',
    latitude: 41.0398,
    longitude: -85.2736,
    aliases: ['aboite', 'neighborhood', 'southwest fort wayne'],
  },
  {
    placeName: 'Harrison Hill',
    streetAddress: 'Harrison Hill',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46807',
    latitude: 41.0447,
    longitude: -85.1425,
    aliases: ['harrison hill neighborhood', 'neighborhood', 'unpopular location'],
  },
  {
    placeName: 'West Central',
    streetAddress: 'West Central',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0775,
    longitude: -85.1465,
    aliases: ['west central neighborhood', 'neighborhood', 'downtown west'],
  },
  {
    placeName: 'Southwood Park',
    streetAddress: 'Southwood Park',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46807',
    latitude: 41.0439,
    longitude: -85.1504,
    aliases: ['southwood park neighborhood', 'neighborhood', 'unpopular location'],
  },
  {
    placeName: 'Bloomingdale Park',
    streetAddress: 'Bloomingdale Park',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46808',
    latitude: 41.0826,
    longitude: -85.1522,
    aliases: ['bloomingdale', 'park', 'unpopular location'],
  },
];

function getAppOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return 'http://localhost:3000';
}

function getInternalApiUrl(pathname: string): URL {
  return new URL(pathname, getAppOrigin());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object';
}

function getRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export interface GeocodedAddress {
  formattedAddress: string;
  placeName?: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  serviceAreaName: string;
  distanceFromServiceArea: number;
  distanceFromFortWayne: number;
  isWithinServiceArea: boolean;
}

export function formatAddressLines(address: GeocodedAddress) {
  const placeName = address.placeName?.trim();
  const street = address.streetAddress?.trim();
  const isPrimaryPlaceName = Boolean(placeName);
  const primary = placeName || street || address.formattedAddress || '';

  const cityState = [address.city, address.state].filter(Boolean).join(', ');
  const cityStateZip = cityState + (address.zipCode ? ` ${address.zipCode}` : '');

  const secondaryParts: string[] = [];
  if (
    street &&
    primary &&
    (isPrimaryPlaceName || street.toLowerCase() !== primary.toLowerCase())
  ) {
    secondaryParts.push(street);
  }
  if (cityStateZip) {
    secondaryParts.push(cityStateZip);
  }

  return {
    primary,
    secondary: secondaryParts.join(', '),
  };
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in miles
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function normalizeQuery(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenizeQuery(value: string, options?: { minLength?: number }): string[] {
  const minLength = options?.minLength ?? 2;
  return normalizeQuery(value)
    .split(' ')
    .filter((token) => token.length >= minLength);
}

function getTokenVariants(token: string): string[] {
  const variants = new Set<string>([token]);
  if (token.endsWith('s') && token.length > 3) {
    variants.add(token.slice(0, -1));
  }
  return Array.from(variants);
}

function getServiceAreasForQuery(query: string): ServiceArea[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return SERVICE_AREAS;

  const matchedAreas = SERVICE_AREAS.filter((area) =>
    area.locationAliases.some((alias) => normalized.includes(alias))
  );

  return matchedAreas.length > 0 ? matchedAreas : SERVICE_AREAS;
}

function getClosestServiceArea(latitude: number, longitude: number): {
  area: ServiceArea;
  distanceMiles: number;
} {
  let closestArea = SERVICE_AREAS[0];
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const area of SERVICE_AREAS) {
    const distance = calculateDistance(area.latitude, area.longitude, latitude, longitude);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestArea = area;
    }
  }

  return {
    area: closestArea,
    distanceMiles: closestDistance,
  };
}

function getSearchQueries(query: string): Array<{ searchText: string; area?: ServiceArea }> {
  const trimmed = query.trim();
  const areas = getServiceAreasForQuery(trimmed);
  const normalized = normalizeQuery(trimmed);

  const queries: Array<{ searchText: string; area?: ServiceArea }> = [{ searchText: trimmed }];

  for (const area of areas) {
    const alreadyScoped =
      normalized.includes(normalizeQuery(area.name)) ||
      normalized.includes(normalizeQuery(area.queryBias));
    if (alreadyScoped) continue;
    queries.push({ searchText: `${trimmed}, ${area.queryBias}`, area });
  }

  return queries;
}

function toFeaturedAddress(location: FeaturedLocation): GeocodedAddress {
  const nearest = getClosestServiceArea(location.latitude, location.longitude);
  const roundedDistance = Math.round(nearest.distanceMiles * 10) / 10;

  return {
    formattedAddress: `${location.placeName}, ${location.streetAddress}, ${location.city}, ${location.state} ${location.zipCode}`,
    placeName: location.placeName,
    streetAddress: location.streetAddress,
    city: location.city,
    state: location.state,
    zipCode: location.zipCode,
    latitude: location.latitude,
    longitude: location.longitude,
    serviceAreaName: nearest.area.name,
    distanceFromServiceArea: roundedDistance,
    distanceFromFortWayne: roundedDistance,
    isWithinServiceArea: true,
  };
}

function getFeaturedLocationSuggestions(
  query: string,
  options?: { allowDefaultWhenNoMatch?: boolean }
): GeocodedAddress[] {
  const normalized = normalizeQuery(query);
  const tokens = tokenizeQuery(query, { minLength: 2 });
  const allowDefaultWhenNoMatch = options?.allowDefaultWhenNoMatch !== false;

  if (!normalized) {
    return FEATURED_FORT_WAYNE_LOCATIONS.slice(0, DEFAULT_SEARCH_LIMIT).map(toFeaturedAddress);
  }
  if (tokens.length === 0) {
    const lightweightMatches = FEATURED_FORT_WAYNE_LOCATIONS.filter((location) => {
      const haystack = normalizeQuery(
        `${location.placeName} ${location.streetAddress} ${location.city} ${location.state} ${location.aliases.join(' ')}`
      );
      return haystack.includes(normalized);
    });

    if (lightweightMatches.length > 0) {
      return lightweightMatches.slice(0, DEFAULT_SEARCH_LIMIT).map(toFeaturedAddress);
    }

    if (!allowDefaultWhenNoMatch) return [];
    return FEATURED_FORT_WAYNE_LOCATIONS.slice(0, DEFAULT_SEARCH_LIMIT).map(toFeaturedAddress);
  }

  const exactTokenMatches = FEATURED_FORT_WAYNE_LOCATIONS.filter((location) => {
    const haystack = normalizeQuery(
      `${location.placeName} ${location.streetAddress} ${location.city} ${location.state} ${location.aliases.join(' ')}`
    );
    return tokens.every((token) => getTokenVariants(token).some((variant) => haystack.includes(variant)));
  });

  if (exactTokenMatches.length > 0) {
    return exactTokenMatches.slice(0, DEFAULT_SEARCH_LIMIT).map(toFeaturedAddress);
  }

  const partialTokenMatches = FEATURED_FORT_WAYNE_LOCATIONS.filter((location) => {
    const haystack = normalizeQuery(
      `${location.placeName} ${location.streetAddress} ${location.city} ${location.state} ${location.aliases.join(' ')}`
    );
    return tokens.some((token) => getTokenVariants(token).some((variant) => haystack.includes(variant)));
  });

  if (partialTokenMatches.length > 0) {
    return partialTokenMatches.slice(0, DEFAULT_SEARCH_LIMIT).map(toFeaturedAddress);
  }

  if (!allowDefaultWhenNoMatch) return [];
  return FEATURED_FORT_WAYNE_LOCATIONS.slice(0, DEFAULT_SEARCH_LIMIT).map(toFeaturedAddress);
}

function dedupeAddresses(addresses: GeocodedAddress[]): GeocodedAddress[] {
  const seen = new Set<string>();
  const deduped: GeocodedAddress[] = [];

  for (const address of addresses) {
    const key = `${address.formattedAddress.toLowerCase()}|${address.latitude.toFixed(6)}|${address.longitude.toFixed(6)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(address);
  }

  return deduped;
}

/**
 * Search for addresses using OpenStreetMap Nominatim API
 * with service-area-aware location name support.
 */
export async function searchAddress(
  query: string
): Promise<GeocodedAddress[]> {
  const trimmedQuery = query.trim();
  const featuredSuggestions = getFeaturedLocationSuggestions(trimmedQuery, { allowDefaultWhenNoMatch: true });
  const featuredMatches = getFeaturedLocationSuggestions(trimmedQuery, { allowDefaultWhenNoMatch: false });
  if (!trimmedQuery) return featuredSuggestions;
  // For short queries, use known matches immediately. If there are no known matches,
  // still attempt live Fort Wayne geocoding so new place names can resolve.
  if (trimmedQuery.length < 3 && featuredMatches.length > 0) return featuredSuggestions;
  const queryTokens = tokenizeQuery(trimmedQuery, { minLength: 2 });

  try {
    const dedupedResults = new Map<string, GeocodedAddress>();
    const searchQueries = getSearchQueries(trimmedQuery);

    for (const search of searchQueries) {
      const url = getInternalApiUrl('/api/geocoding/search');
      url.searchParams.append('q', search.searchText);
      url.searchParams.append('format', 'json');
      url.searchParams.append('addressdetails', '1');
      url.searchParams.append('namedetails', '1');
      url.searchParams.append('limit', String(DEFAULT_SEARCH_LIMIT));
      url.searchParams.append('countrycodes', 'us');
      if (search.area) {
        url.searchParams.append('viewbox', search.area.viewbox);
        url.searchParams.append('bounded', '0');
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      if (!Array.isArray(payload)) continue;

      for (const value of payload) {
        if (!isRecord(value)) continue;

        const latText = getString(value.lat);
        const lngText = getString(value.lon);
        if (!latText || !lngText) continue;

        const lat = Number.parseFloat(latText);
        const lng = Number.parseFloat(lngText);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const nearest = getClosestServiceArea(lat, lng);
        const isWithinServiceArea = nearest.distanceMiles <= nearest.area.radiusMiles;
        if (!isWithinServiceArea) continue;

        const address = getRecord(value.address);
        const namedetails = isRecord(value.namedetails) ? value.namedetails : undefined;
        const streetNumber = getString(address.house_number);
        const street = getString(address.road);
        const streetAddress = `${streetNumber} ${street}`.trim();
        const placeName =
          (namedetails && getString(namedetails.name)) ||
          getString(value.name) ||
          getString(address.building) ||
          getString(address.amenity) ||
          getString(address.shop) ||
          getString(address.tourism) ||
          getString(address.leisure) ||
          getString(address.office) ||
          getString(address.historic) ||
          getString(address.craft) ||
          getString(address.man_made);

        const roundedDistance = Math.round(nearest.distanceMiles * 10) / 10;
        const formattedAddress = getString(value.display_name);
        const searchableText = normalizeQuery(
          `${formattedAddress} ${placeName || ''} ${streetAddress} ${
            getString(address.city) || getString(address.town) || getString(address.village)
          } ${getString(address.state)} ${getString(address.postcode)}`
        );
        if (
          queryTokens.length > 0 &&
          !queryTokens.every((token) =>
            getTokenVariants(token).some((variant) => searchableText.includes(variant))
          )
        ) {
          continue;
        }
        const dedupeKey = `${formattedAddress.toLowerCase()}|${lat.toFixed(6)}|${lng.toFixed(6)}`;
        dedupedResults.set(dedupeKey, {
          formattedAddress,
          placeName: placeName || undefined,
          streetAddress,
          city:
            getString(address.city) ||
            getString(address.town) ||
            getString(address.village),
          state: getString(address.state),
          zipCode: getString(address.postcode),
          latitude: lat,
          longitude: lng,
          serviceAreaName: nearest.area.name,
          distanceFromServiceArea: roundedDistance,
          distanceFromFortWayne: roundedDistance,
          isWithinServiceArea: true,
        });
      }

      if (dedupedResults.size >= DEFAULT_SEARCH_LIMIT) {
        break;
      }
    }

    const resolvedResults = Array.from(dedupedResults.values())
      .sort((a, b) => a.distanceFromServiceArea - b.distanceFromServiceArea)
      .slice(0, DEFAULT_SEARCH_LIMIT);
    const prioritized = dedupeAddresses([...featuredMatches, ...resolvedResults]);
    if (prioritized.length > 0) {
      return prioritized.slice(0, DEFAULT_SEARCH_LIMIT);
    }

    return featuredSuggestions;
  } catch (error) {
    console.error('Address search error:', error);
    return featuredSuggestions;
  }
}

/**
 * Geocode a single address and validate it's within service area
 */
export async function validateAddress(
  address: string
): Promise<GeocodedAddress | null> {
  const results = await searchAddress(address);
  return results.length > 0 ? results[0] : null;
}

export async function reverseGeocodeAddress(
  latitude: number,
  longitude: number
): Promise<GeocodedAddress | null> {
  try {
    // Use internal API proxy to avoid CORS issues
    const url = getInternalApiUrl('/api/geocoding/reverse');
    url.searchParams.append('format', 'json');
    url.searchParams.append('lat', String(latitude));
    url.searchParams.append('lon', String(longitude));
    url.searchParams.append('addressdetails', '1');
    url.searchParams.append('namedetails', '1');
    url.searchParams.append('zoom', '18');

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    if (payload == null || typeof payload !== 'object') return null;
    const record = payload as Record<string, unknown>;
    const displayName = typeof record.display_name === 'string' ? record.display_name : '';

    const nearest = getClosestServiceArea(latitude, longitude);
    const isWithin = nearest.distanceMiles <= nearest.area.radiusMiles;
    if (!isWithin) return null;

    const address =
      record.address && typeof record.address === 'object'
        ? (record.address as Record<string, unknown>)
        : {};

    const houseNumber = typeof address.house_number === 'string' ? address.house_number : '';
    const road = typeof address.road === 'string' ? address.road : '';
    const streetAddress = `${houseNumber} ${road}`.trim();

    const namedetails =
      record.namedetails && typeof record.namedetails === 'object'
        ? (record.namedetails as Record<string, unknown>)
        : {};
    const placeName = typeof namedetails.name === 'string' ? namedetails.name : undefined;

    const city =
      (typeof address.city === 'string' && address.city) ||
      (typeof address.town === 'string' && address.town) ||
      (typeof address.village === 'string' && address.village) ||
      '';
    const state = typeof address.state === 'string' ? address.state : '';
    const zipCode = typeof address.postcode === 'string' ? address.postcode : '';

    return {
      formattedAddress: displayName,
      placeName,
      streetAddress,
      city,
      state,
      zipCode,
      latitude,
      longitude,
      serviceAreaName: nearest.area.name,
      distanceFromServiceArea: Math.round(nearest.distanceMiles * 10) / 10,
      distanceFromFortWayne: Math.round(nearest.distanceMiles * 10) / 10,
      isWithinServiceArea: true,
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Check if coordinates are within service area
 */
export function isWithinServiceArea(
  latitude: number,
  longitude: number
): boolean {
  const nearest = getClosestServiceArea(latitude, longitude);
  return nearest.distanceMiles <= nearest.area.radiusMiles;
}
