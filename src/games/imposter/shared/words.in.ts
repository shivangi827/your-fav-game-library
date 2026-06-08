import type { WordEntry } from './words';

// ── Bollywood Actors ───────────────────────────────
const actors: string[] = [
  'Shah Rukh Khan',
  'Salman Khan',
  'Aamir Khan',
  'Hrithik Roshan',
  'Ranbir Kapoor',
  'Ranveer Singh',
  'Akshay Kumar',
  'Ajay Devgn',
  'Varun Dhawan',
  'Sidharth Malhotra',
  'Kartik Aaryan',
  'Irrfan Khan',
  'Nawazuddin Siddiqui',
  'Rajinikanth',
  'Kamal Haasan',
];

// ── Bollywood Actresses ─────────────────────────────
const actresses: string[] = [
  'Deepika Padukone',
  'Priyanka Chopra',
  'Kareena Kapoor',
  'Alia Bhatt',
  'Katrina Kaif',
  'Anushka Sharma',
  'Shraddha Kapoor',
  'Kriti Sanon',
  'Disha Patani',
  'Taapsee Pannu',
  'Vidya Balan',
  'Aishwarya Rai',
];

// ── Indian Movies ───────────────────────────────────
const movies: string[] = [
  '3 Idiots',
  'Dangal',
  'Sholay',
  'Kabhi Khushi Kabhie Gham',
  'Lagaan',
  'Dilwale Dulhania Le Jayenge',
  'Bahubali',
  'RRR',
  'Zindagi Na Milegi Dobara',
  'PK',
  'Chennai Express',
  'Barfi',
  'Queen',
  'Gully Boy',
];

// ── Indian TV / OTT ─────────────────────────────────
const tvShows: string[] = [
  'Sacred Games',
  'Mirzapur',
  'Paatal Lok',
  'The Family Man',
  'Made in Heaven',
  'Kota Factory',
  'Delhi Crime',
  'Koffee with Karan',
];

// ── Indian Culture / Places ─────────────────────────
const places: string[] = [
  'Taj Mahal',
  'Red Fort',
  'Gateway of India',
  'Varanasi',
  'Jaipur',
  'Kerala Backwaters',
  'Goa Beaches',
  'Charminar',
  'Golden Temple',
  'Hawa Mahal',
];

// ── Food ─────────────────────────────────────────────
const food: string[] = [
  'Biryani',
  'Butter Chicken',
  'Masala Dosa',
  'Chole Bhature',
  'Pani Puri',
  'Samosa',
  'Dhokla',
  'Idli',
  'Vada Pav',
  'Paneer Tikka',
  'Gulab Jamun',
  'Jalebi',
];

// ── Sports ───────────────────────────────────────────
const sports: string[] = [
  'Virat Kohli',
  'MS Dhoni',
  'Sachin Tendulkar',
  'Rohit Sharma',
  'Hardik Pandya',
  'P V Sindhu',
  'Neeraj Chopra',
];

// helper
function toEntries(list: string[], hint: string): WordEntry[] {
  return list.map((word) => ({ word, hint }));
}

export const INDIAN_WORD_LIST: WordEntry[] = [
  ...toEntries(actors, 'Bollywood Actor'),
  ...toEntries(actresses, 'Bollywood Actress'),
  ...toEntries(movies, 'Indian Movie'),
  ...toEntries(tvShows, 'Indian Show'),
  ...toEntries(places, 'Indian Place'),
  ...toEntries(food, 'Indian Food'),
  ...toEntries(sports, 'Indian Sportsperson'),
];