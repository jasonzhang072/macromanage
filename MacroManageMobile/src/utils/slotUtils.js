// Parse "11:00 AM" to decimal hours (11.0)
export const parseTo24 = (timeStr) => {
  if (!timeStr || timeStr === 'All Day' || timeStr.includes('__')) return null;
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return null;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const p = match[3].toUpperCase();
  if (p === 'PM' && h !== 12) h += 12;
  if (p === 'AM' && h === 12) h = 0;
  return h + m / 60;
};

// Format decimal hours back to "11:00 AM"
export const format12 = (decimalHour) => {
  let h = Math.floor(decimalHour);
  let m = Math.round((decimalHour - h) * 60);
  if (m === 60) { h += 1; m = 0; }
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
};

// Unique key for a slot
export const slotKey = (slot) => `${slot.date}|${slot.start}-${slot.end}`;

// Find overlapping time slots across all accepted responses
// responses: [{ response: 'accepted', availability: { "2026-04-01": [{start, end}], ... } }, ...]
// Returns: [{ date, start, end, count, total }]
export const findOverlappingSlots = (responses) => {
  const accepted = responses.filter(r => r.response === 'accepted' && r.availability && Object.keys(r.availability).length > 0);
  if (accepted.length === 0) return [];

  // Collect all dates mentioned across all responses
  const allDates = new Set();
  accepted.forEach(r => {
    Object.keys(r.availability).forEach(d => allDates.add(d));
  });

  const results = [];

  for (const date of allDates) {
    // Get each person's slots for this date (null if they didn't pick this date)
    const personSlots = accepted.map(r => {
      const slots = r.availability[date];
      if (!slots || slots.length === 0) return null;
      // Convert to decimal ranges
      return slots.map(s => ({
        start: s.start === 'All Day' ? 0 : parseTo24(s.start),
        end: s.end === 'All Day' ? 24 : parseTo24(s.end),
      })).filter(s => s.start !== null && s.end !== null);
    });

    const available = personSlots.filter(s => s !== null && s.length > 0);
    if (available.length < 1) continue;

    // Find intersection of all available people's time ranges
    let intersection = [...available[0]];

    for (let i = 1; i < available.length; i++) {
      const next = available[i];
      const newIntersection = [];
      for (const a of intersection) {
        for (const b of next) {
          const oStart = Math.max(a.start, b.start);
          const oEnd = Math.min(a.end, b.end);
          if (oStart < oEnd) {
            newIntersection.push({ start: oStart, end: oEnd });
          }
        }
      }
      intersection = newIntersection;
      if (intersection.length === 0) break;
    }

    for (const slot of intersection) {
      results.push({
        date,
        start: format12(slot.start),
        end: format12(slot.end),
        count: available.length,
        total: accepted.length,
      });
    }
  }

  // Sort by overlap count desc, then date asc
  results.sort((a, b) => b.count - a.count || a.date.localeCompare(b.date));
  return results;
};

// Check vote results and return { winner, isTie, tiedSlots, tallies }
export const tallyVotes = (timeVotes, overlappingSlots) => {
  if (!timeVotes || !overlappingSlots || overlappingSlots.length === 0) {
    return { winner: null, isTie: false, tiedSlots: [], tallies: {} };
  }

  const tallies = {};
  overlappingSlots.forEach(slot => {
    const key = slotKey(slot);
    tallies[key] = (timeVotes[key] || []).length;
  });

  const maxVotes = Math.max(...Object.values(tallies));
  if (maxVotes === 0) return { winner: null, isTie: false, tiedSlots: [], tallies };

  const winners = overlappingSlots.filter(s => tallies[slotKey(s)] === maxVotes);

  if (winners.length === 1) {
    return { winner: winners[0], isTie: false, tiedSlots: [], tallies };
  }
  return { winner: null, isTie: true, tiedSlots: winners, tallies };
};
