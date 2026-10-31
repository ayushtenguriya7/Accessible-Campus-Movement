/**
 * Campus building data for Module 1 – Accessible Route Service.
 *
 * ⚠️  PLACEHOLDER DATA — NOT VERIFIED LPU BUILDINGS  ⚠️
 * The repository did not contain any verified building list or coordinates, so the
 * entries below are SAMPLE points scattered around the campus map centre purely so
 * the selectors, markers and routing can be developed and tested. The names, numbers
 * and coordinates do NOT correspond to real LPU blocks.
 *
 * HOW TO REPLACE WITH REAL DATA
 * 1. Collect the real block names/numbers and their entrance coordinates
 *    (e.g. right-click the entrance in OpenStreetMap / Google Maps -> copy lat,lng).
 * 2. Replace the entries below, keeping the same fields.
 * 3. Set `verified: true` on each entry once it has been checked. The dashboard
 *    shows a "placeholder data" notice automatically until every entry is verified.
 *
 * Fields
 *   id        unique, stable string (used as the <select> value)
 *   number    short label displayed inside the map marker
 *   name      full display name used in the selectors, popups and route summary
 *   lat, lng  WGS84 coordinates of the point a route should start/end at
 *             (ideally the main entrance, on or next to a walkable path)
 *   verified  true only when name + coordinates were checked against a real source
 */
export const CAMPUS_BUILDINGS = [
  {
    id: "sample-1",
    number: "Mall",
    name: "Uni Mall",
    lat: 31.25580956883715,
    lng: 75.70564872290824,
    verified: true,
  },

  {
    id: "sample-2",
    number: "32",
    name: "School of Computer Science & Engineering",
    lat: 31.252148515191983,
    lng: 75.70505888143154,
    verified: true,
  },
  {
    id: "sample-3",
    number: "33",
    name: "School of Computer Science & Engineering",
    lat: 31.251804632780424,
    lng: 75.70505498865474,
    verified: true,
  },
  {
    id: "sample-4",
    number: "34",
    name: "School of Computer Science & Engineering",
    lat: 31.25147572875457,
    lng: 75.70505520205897,
    verified: true,
  },
  {
    id: "sample-5",
    number: "Lib",
    name: "Uni Library",
    lat: 31.251950504660904,
    lng: 75.70380780710491,
    verified: true,
  },

  {
    id: "sample-6",
    number: "25",
    name: "School of Computer Science & Engineering",
    lat: 31.252925905592996,
    lng: 75.70247524587754,
    verified: true,
  },
  {
    id: "sample-7",
    number: "26",
    name: "School of Computer Science & Engineering",
    lat: 31.252906473723534,
    lng: 75.70290215655088,
    verified: true,
  },
  {
    id: "sample-8",
    number: "27",
    name: "School of Computer Science & Engineering",
    lat: 31.25291483493356,
    lng: 75.70330975549413,
    verified: true,
  },
  {
    id: "sample-9",
    number: "28",
    name: "School of Computer Science & Engineering",
    lat: 31.252902336445928,
    lng: 75.70373735884723,
    verified: true,
  },
  {
    id: "sample-10",
    number: "SDMA",
    name: "Shanti Devi Mittal Auditorium",
    lat: 31.252273004406018,
    lng: 75.70378722942837,
    verified: true,
  },
  {
    id: "sample-11",
    number: "UniPolis",
    name: "Baldev Raj Mittal UniPolis",
    lat: 31.255247800543966,
    lng: 75.70510598570596,
    verified: true,
  },
  {
    id: "sample-12",
    number: "Hospital",
    name: "Uni Hospital",
    lat: 31.258173015591776,
    lng: 75.70693994192716,
    verified: true,
  },
  {
    id: "sample-13",
    number: "H",
    name: "LPU Helipad",
    lat: 31.25435139346014,
    lng: 75.70302733612587,
    verified: true,
  },
  {
    id: "sample-14",
    number: "18",
    name: "Humanities Block",
    lat: 31.25536086124125,
    lng: 75.7033904639833,
    verified: true,
  },
  {
    id: "sample-15",
    number: "Main Gate",
    name: "LOvely Professional University",
    lat: 31.260609585351904,
    lng: 75.70679287845503,
    verified: true,
  },
  {
    id: "sample-16",
    number: "6",
    name: "Architecture Block",
    lat: 31.256994614535152,
    lng: 75.70729880704914,
    verified: true,
  },
  {
    id: "sample-17",
    number: "14",
    name: "Mittal School of Business",
    lat: 31.254830158848666,
    lng: 75.7056775181745,
    verified: true,
  },
  {
    id: "sample-18",
    number: "Park",
    name: "Urban Spido Park",
    lat: 31.254048612187805,
    lng: 75.70567098991852,
    verified: true,
  },
  {
    id: "sample-19",
    number: "P",
    name: "Main Parking Area",
    lat: 31.253073711015155,
    lng: 75.70572367909685,
    verified: true,
  },
  {
    id: "sample-20",
    number: "39",
    name: "Innovation Studio Block",
    lat: 31.251147271056364,
    lng: 75.70534974140992,
    verified: true,
  },
  {
    id: "sample-21",
    number: "36",
    name: "School of Electronics and Electrical Engineering",
    lat: 31.251791385701907,
    lng: 75.70416962844304,
    verified: true,
  },
  {
    id: "sample-22",
    number: "38",
    name: "Computer Applications and Research Department",
    lat: 31.252310940671354,
    lng: 75.70330102810776,
    verified: true,
  },
  {
    id: "sample-23",
    number: "Sports Centre",
    name: "Sports Complex",
    lat: 31.250878551689738,
    lng: 75.70216507343484,
    verified: true,
  },
  {
    id: "sample-24",
    number: "15",
    name: "School of Hospitality and Tourism Management",
    lat: 31.255596368621653,
    lng: 75.70417665829889,
    verified: true,
  },
  {
    id: "sample-25",
    number: "13",
    name: "Division of Student Welfare",
    lat: 31.255282527831042,
    lng: 75.70612263918802,
    verified: true,
  },
  {
    id: "sample-26",
    number: "20",
    name: "School of Law",
    lat: 31.254895437490656,
    lng: 75.70119466770367,
    verified: true,
  },
  {
    id: "sample-27",
    number: "55",
    name: "School of Mechanical Engineering",
    lat: 31.246903236822117,
    lng: 75.70333417047488,
    verified: true,
  },
  {
    id: "sample-28",
    number: "56",
    name: "School of Bioengineering and Biosciences",
    lat: 31.246635804135508,
    lng: 75.70348045748452,
    verified: true,
  },
  {
    id: "sample-29",
    number: "57",
    name: "School of Agriculture",
    lat: 31.24635159391312,
    lng: 75.70338779947954,
    verified: true,
  },
  {
    id: "sample-30",
    number: "P",
    name: "Parking Area",
    lat: 31.253895542888483,
    lng: 75.70184486590657,
    verified: true,
  },
  {
    id: "sample-31",
    number: "P",
    name: "Parking Area",
    lat: 31.2548999662934,
    lng: 75.70186640514316,
    verified: true,
  },
  {
    id: "sample-32",
    number: "P",
    name: "Parking Area",
    lat: 31.246072143665405,
    lng: 75.70239384075798,
    verified: true,
  },
  {
    id: "sample-33",
    number: "P",
    name: "Parking Area",
    lat: 31.246472174828764,
    lng: 75.70237088108935,
    verified: true,
  },
  {
    id: "sample-34",
    number: "P",
    name: "Parking Area",
    lat: 31.251907297496796,
    lng: 75.7057102956689,
    verified: true,
  },
];

/** True only when every building entry has been marked as verified. */
export const CAMPUS_DATA_IS_VERIFIED = CAMPUS_BUILDINGS.every(
  (b) => b.verified,
);
