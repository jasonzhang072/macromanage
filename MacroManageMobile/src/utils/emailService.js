const toBase64 = (str) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  const bytes = str.split('').map(c => c.charCodeAt(0));
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i], b2 = bytes[i + 1] || 0, b3 = bytes[i + 2] || 0;
    result += chars[b1 >> 2] + chars[((b1 & 3) << 4) | (b2 >> 4)] +
      (i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=') +
      (i + 2 < bytes.length ? chars[b3 & 63] : '=');
  }
  return result;
};

const MAILJET_API_KEY = '430ab455c64728deed9e13d962553e01';
const MAILJET_SECRET_KEY = '4c1fdff48ecbdf8ec03f0817469fc163';
const SENDER_EMAIL = 'jasonzhang072@gmail.com';

export const sendEmail = async (toEmail, toName, subject, htmlBody) => {
  try {
    const res = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + toBase64(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`),
      },
      body: JSON.stringify({
        Messages: [{
          From: { Email: SENDER_EMAIL, Name: 'MacroManage' },
          To: [{ Email: toEmail, Name: toName }],
          Subject: subject,
          HTMLPart: htmlBody,
        }],
      }),
    });
    return res.ok;
  } catch (err) {
    console.log('Email send failed:', err);
    return false;
  }
};

const wrapEmail = (headerTitle, headerSub, bodyContent) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#EDE0CE;font-family:-apple-system,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="540" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background:#FFF8F0;border-radius:24px;overflow:hidden;margin:0 auto;">
      <tr><td style="background:linear-gradient(135deg,#C09B74,#7D5A3C);padding:36px 32px;text-align:center;">
        <h1 style="color:#FFFFFF;font-size:26px;margin:0;letter-spacing:-0.5px;">${headerTitle}</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:15px;">${headerSub}</p>
      </td></tr>
      <tr><td style="padding:32px 36px;text-align:center;">
        ${bodyContent}
      </td></tr>
      <tr><td style="background:#FAF3E6;padding:16px;text-align:center;border-top:1px solid #E8DBC4;">
        <p style="margin:0;font-size:12px;color:#9A8568;">Sent via <strong>MacroManage</strong></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

const prettyDate = (dateStr) => {
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return dateStr; }
};

export const buildVotingEmail = (eventTitle, hostName, overlappingSlots, eventId, voterEmail) => {
  const slotsHtml = overlappingSlots.map(slot => {
    const dateStr = prettyDate(slot.date);
    const time = slot.start === 'All Day' ? 'All Day' : `${slot.start} - ${slot.end}`;
    const voteKey = encodeURIComponent(`${slot.date}|${slot.start}-${slot.end}`);
    const voteUrl = `macromanage://vote?eventId=${encodeURIComponent(eventId)}&slot=${voteKey}&email=${encodeURIComponent(voterEmail)}`;
    return `<div style="background:#FAF3E6;border-radius:12px;padding:14px;margin-bottom:10px;">
      <div style="font-size:15px;font-weight:600;color:#4A3728;">${dateStr} &middot; ${time}</div>
      <div style="margin-top:8px;"><a href="${voteUrl}" style="display:inline-block;background:#4CAF7D;color:#FFFFFF;text-decoration:none;padding:10px 24px;border-radius:50px;font-size:14px;font-weight:bold;">Vote for this</a></div>
    </div>`;
  }).join('');

  return wrapEmail(
    'Vote for a Time!',
    `Pick your preferred time for "${eventTitle}"`,
    `<div style="background:#FAF3E6;border-radius:16px;padding:20px;margin-bottom:20px;">
      <div style="font-size:22px;font-weight:bold;color:#4A3728;">${eventTitle}</div>
      <div style="font-size:14px;color:#9A8568;margin-top:6px;">Hosted by ${hostName}</div>
    </div>
    <p style="color:#8A7560;margin:16px 0;font-size:15px;">Everyone has responded! These are the times that work. Pick your favorite:</p>
    ${slotsHtml}`
  );
};

export const buildTiebreakEmail = (eventTitle, hostName, tiedSlots, eventId, voterEmail, round) => {
  const slotsHtml = tiedSlots.map(slot => {
    const dateStr = prettyDate(slot.date);
    const time = slot.start === 'All Day' ? 'All Day' : `${slot.start} - ${slot.end}`;
    const voteKey = encodeURIComponent(`${slot.date}|${slot.start}-${slot.end}`);
    const voteUrl = `macromanage://vote?eventId=${encodeURIComponent(eventId)}&slot=${voteKey}&email=${encodeURIComponent(voterEmail)}`;
    return `<div style="background:#FAF3E6;border-radius:12px;padding:14px;margin-bottom:10px;">
      <div style="font-size:15px;font-weight:600;color:#4A3728;">${dateStr} &middot; ${time}</div>
      <div style="margin-top:8px;"><a href="${voteUrl}" style="display:inline-block;background:#F59E0B;color:#FFFFFF;text-decoration:none;padding:10px 24px;border-radius:50px;font-size:14px;font-weight:bold;">Vote for this</a></div>
    </div>`;
  }).join('');

  return wrapEmail(
    'Tiebreaker Vote!',
    `It\'s a tie for "${eventTitle}" - vote again!`,
    `<div style="background:#FAF3E6;border-radius:16px;padding:20px;margin-bottom:20px;">
      <div style="font-size:22px;font-weight:bold;color:#4A3728;">${eventTitle}</div>
      <div style="font-size:14px;color:#9A8568;margin-top:6px;">Round ${round} - Tiebreaker</div>
    </div>
    <p style="color:#8A7560;margin:16px 0;font-size:15px;">The last vote was a tie! Please vote again between these options:</p>
    ${slotsHtml}`
  );
};

export const buildConfirmationEmail = (eventTitle, hostName, confirmedDate, confirmedTime, location) => {
  const dateStr = prettyDate(confirmedDate);
  return wrapEmail(
    "It's Confirmed!",
    `${eventTitle} is happening!`,
    `<div style="background:#FAF3E6;border-radius:16px;padding:20px;margin-bottom:20px;">
      <div style="font-size:22px;font-weight:bold;color:#4A3728;">${eventTitle}</div>
    </div>
    <div style="background:#ecfdf5;border-radius:12px;padding:14px;margin-bottom:14px;">
      <div style="font-size:11px;color:#065f46;font-weight:bold;margin-bottom:4px;letter-spacing:1px;">DATE & TIME</div>
      <div style="font-size:15px;color:#065f46;font-weight:600;">${dateStr}</div>
      <div style="font-size:15px;color:#065f46;font-weight:600;">${confirmedTime}</div>
    </div>
    ${location ? `<div style="background:#FAF3E6;border-radius:12px;padding:14px;margin-bottom:14px;">
      <div style="font-size:11px;color:#9A8568;font-weight:bold;margin-bottom:4px;letter-spacing:1px;">LOCATION</div>
      <div style="font-size:15px;color:#4A3728;font-weight:600;">${location}</div>
    </div>` : ''}
    <p style="color:#065f46;font-size:16px;font-weight:600;margin:20px 0;">See you there!</p>`
  );
};
