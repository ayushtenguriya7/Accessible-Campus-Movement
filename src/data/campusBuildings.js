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
    lat: 31.251991459639676,
    lng: 75.70336461977821,
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
];

/** True only when every building entry has been marked as verified. */
export const CAMPUS_DATA_IS_VERIFIED = CAMPUS_BUILDINGS.every((b) => b.verified);
