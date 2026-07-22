/**
 * Maps sport names to corresponding emoji icons
 * Supports both Dutch and English sport names
 * @param sports Array of sport names associated with a location
 * @param fallback Optional fallback sport name if sports array is empty
 * @returns Emoji string representing the sport(s)
 */
export const getSportEmoji = (sports: string[], fallback: string = ''): string => {
  const candidates = sports.length > 0 ? sports : [fallback];
  const combined = candidates.join(' ').toLowerCase();

  if (combined.includes('multi-sport') || combined.includes('multisport')) return '🏆';
  if (combined.includes('sport') || combined.includes('sports')) return '🏆';
  if (combined.includes('voetbal') || combined.includes('soccer')) return '⚽️';
  if (combined.includes('football')) return '⚽️';
  if (combined.includes('tennis')) return '🎾';
  if (combined.includes('padel')) return '🎾';
  if (combined.includes('hockey')) return '🏑';
  if (combined.includes('basket')) return '🏀';
  if (combined.includes('badminton')) return '🏸';
  if (combined.includes('volley')) return '🏐';
  if (combined.includes('waterpolo')) return '🤽';
  if (combined.includes('zwem') || combined.includes('swim')) return '🏊';
  if (combined.includes('fitness') || combined.includes('gym')) return '🏋️';
  if (combined.includes('crossfit')) return '🏋️';
  if (combined.includes('yoga')) return '🧘';
  if (combined.includes('pilates')) return '🧘';
  if (combined.includes('dans') || combined.includes('dance')) return '💃';
  if (combined.includes('dancing')) return '💃';
  if (combined.includes('atletiek') || combined.includes('athlet')) return '🏃';
  if (combined.includes('handbal') || combined.includes('handball')) return '🤾';
  if (combined.includes('korfbal')) return '🤾‍♀️';
  if (combined.includes('rugby')) return '🏉';
  if (combined.includes('golf') || combined.includes('goflf')) return '🏌️‍♀️';
  if (combined.includes('judo')) return '🥋';
  if (combined.includes('karate') || combined.includes('taekwondo')) return '🥋';
  if (combined.includes('martial arts')) return '🥋';
  if (combined.includes('vechtsport')) return '🥋';
  if (combined.includes('boksen') || combined.includes('boxing')) return '🥊';
  if (combined.includes('krav maga')) return '🤼‍♂️';
  if (combined.includes('turnen') || combined.includes('gymnast')) return '🤸';
  if (combined.includes('schaats') || combined.includes('skate')) return '⛸️';
  if (combined.includes('bouldering')) return '🧗';
  if (combined.includes('klimmen') || combined.includes('climb')) return '🧗';
  if (combined.includes('equestrian') || combined.includes('paardrijden')) return '🐴';
  if (combined.includes('jeu de boules')) return '🏆';
  if (combined.includes('squash')) return '🏆';

  return '🏆';
};
