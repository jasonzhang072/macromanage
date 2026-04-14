import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Modal, Animated, Dimensions, SafeAreaView, PanResponder,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hapticLight, hapticMedium, hapticSuccess } from '../utils/animations';
import { findOverlappingSlots, slotKey } from '../utils/slotUtils';
import { sendEmail, buildVotingEmail, buildConfirmationEmail } from '../utils/emailService';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAYS_LETTER = ['S','M','T','W','T','F','S'];

export default function InvitationResponseModal({ visible, invitation, theme, isDarkMode, onComplete, onDismiss }) {
  // Steps: 'respond' | 'friend' | 'availability' | 'done' | 'declined'
  const [step, setStep] = useState('respond');
  const [friendAccepted, setFriendAccepted] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);
  const [timeSlots, setTimeSlots] = useState({});
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const screenH = Dimensions.get('window').height;

  const { eventId, email, title, host, hostEmail, location, budget, response: urlResponse } = invitation || {};

  useEffect(() => {
    if (visible) {
      setStep('respond');
      setFriendAccepted(false);
      setSelectedDates([]);
      setTimeSlots({});
      setCalMonth(new Date().getMonth());
      setCalYear(new Date().getFullYear());
      animateIn();
      // If the URL specified a response, auto-advance
      if (urlResponse === 'decline') {
        setTimeout(() => handleDecline(), 300);
      }
    }
  }, [visible]);

  useEffect(() => {
    animateIn();
  }, [step]);

  const animateIn = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 40, friction: 7, useNativeDriver: true }),
    ]).start();
  };

  // --- Accept / Decline ---
  const handleAccept = () => {
    hapticMedium();
    setStep('friend');
  };

  const handleDecline = async () => {
    hapticLight();
    try {
      const eventsData = await AsyncStorage.getItem('macromanage_events');
      if (eventsData) {
        const events = JSON.parse(eventsData);
        const event = events.find(e => e.id === eventId);
        if (event) {
          // Remove invitee from friends list
          if (event.friends) {
            event.friends = event.friends.filter(f => {
              const fEmail = (f.contact || f.email || '').toLowerCase();
              return fEmail !== (email || '').toLowerCase();
            });
          }
          if (!event.responses) event.responses = [];
          const friendName = email ? email.split('@')[0] : 'Someone';
          const existing = event.responses.find(r => r.email === email);
          if (existing) existing.response = 'declined';
          else event.responses.push({ name: friendName, email, response: 'declined' });

          await AsyncStorage.setItem('macromanage_events', JSON.stringify(events));

          // Add notification
          const notifs = JSON.parse(await AsyncStorage.getItem('notifications') || '[]');
          notifs.unshift({
            id: Date.now().toString(),
            message: `${friendName} declined "${title}" and has been removed from the event.`,
            read: false,
            timestamp: new Date().toISOString(),
          });
          await AsyncStorage.setItem('notifications', JSON.stringify(notifs));
        }
      }
    } catch (err) {
      console.log('Decline error:', err);
    }
    setStep('declined');
  };

  // --- Friend ---
  const handleAddFriend = () => {
    hapticSuccess();
    setFriendAccepted(true);
    setStep('availability');
  };

  const handleSkipFriend = () => {
    hapticLight();
    setFriendAccepted(false);
    setStep('availability');
  };

  // --- Calendar ---
  const toggleDate = (dateStr) => {
    hapticLight();
    if (selectedDates.includes(dateStr)) {
      setSelectedDates(prev => prev.filter(d => d !== dateStr));
      setTimeSlots(prev => {
        const copy = { ...prev };
        delete copy[dateStr];
        return copy;
      });
    } else {
      setSelectedDates(prev => [...prev, dateStr].sort());
      setTimeSlots(prev => ({
        ...prev,
        [dateStr]: prev[dateStr] || [{ start: '', end: '' }],
      }));
    }
  };

  const changeMonth = (delta) => {
    hapticLight();
    let m = calMonth + delta;
    let y = calYear;
    if (m > 11) { m = 0; y++; }
    else if (m < 0) { m = 11; y--; }
    setCalMonth(m);
    setCalYear(y);
  };

  const renderCalendar = () => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cells = [];

    // Day headers
    for (let i = 0; i < 7; i++) {
      cells.push(
        <View key={`h-${i}`} style={calStyles.dayHeader}>
          <Text style={[calStyles.dayHeaderText, { color: theme.textSecondary }]}>{DAYS_LETTER[i]}</Text>
        </View>
      );
    }

    // Empty cells
    for (let i = 0; i < firstDay; i++) {
      cells.push(<View key={`e-${i}`} style={calStyles.dayCell} />);
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateObj = new Date(calYear, calMonth, day);
      const isPast = dateObj < today;
      const isSelected = selectedDates.includes(dateStr);

      cells.push(
        <TouchableOpacity
          key={dateStr}
          style={[
            calStyles.dayCell,
            isSelected && { backgroundColor: theme.primary, borderRadius: 10 },
            isPast && { opacity: 0.3 },
          ]}
          onPress={() => !isPast && toggleDate(dateStr)}
          disabled={isPast}
          activeOpacity={0.7}
        >
          <Text style={[
            calStyles.dayText,
            { color: isSelected ? '#fff' : theme.text },
            isSelected && { fontWeight: '700' },
          ]}>
            {day}
          </Text>
        </TouchableOpacity>
      );
    }

    return cells;
  };

  const renderTimeSlots = () => {
    if (selectedDates.length === 0) {
      return <Text style={[styles.hintText, { color: theme.textSecondary }]}>Select dates above to set availability</Text>;
    }

    return selectedDates.map(dateStr => {
      const dateObj = new Date(dateStr + 'T12:00:00');
      const label = `${DAYS_SHORT[dateObj.getDay()]}, ${MONTHS_SHORT[dateObj.getMonth()]} ${dateObj.getDate()}`;
      const slots = timeSlots[dateStr] || [{ start: '', end: '' }];

      return (
        <View key={dateStr} style={[styles.timeCard, { backgroundColor: isDarkMode ? '#3a3a3a' : '#FAF3E6' }]}>
          <View style={styles.timeCardHeader}>
            <Text style={[styles.timeCardLabel, { color: theme.text }]}>{label}</Text>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setTimeSlots(prev => ({
                  ...prev,
                  [dateStr]: [...(prev[dateStr] || []), { start: '', end: '' }],
                }));
              }}
            >
              <Text style={[styles.addTimeBtn, { color: theme.primary }]}>+ Time</Text>
            </TouchableOpacity>
          </View>
          {slots.map((slot, idx) => (
            <View key={idx} style={styles.timeSlotRow}>
              <TouchableOpacity
                style={[styles.timeInput, { backgroundColor: isDarkMode ? '#2c2c2e' : '#fff', borderColor: theme.border }]}
                onPress={() => {
                  // Simple time selection - cycle through common times
                  hapticLight();
                  const times = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];
                  const currentIdx = times.indexOf(slot.start);
                  const nextTime = times[(currentIdx + 1) % times.length];
                  setTimeSlots(prev => {
                    const copy = { ...prev };
                    copy[dateStr] = [...(copy[dateStr] || [])];
                    copy[dateStr][idx] = { ...copy[dateStr][idx], start: nextTime };
                    return copy;
                  });
                }}
              >
                <Text style={[styles.timeInputText, { color: slot.start ? theme.text : theme.textSecondary }]}>
                  {slot.start ? formatTime(slot.start) : 'Start'}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.timeDash, { color: theme.textSecondary }]}>to</Text>
              <TouchableOpacity
                style={[styles.timeInput, { backgroundColor: isDarkMode ? '#2c2c2e' : '#fff', borderColor: theme.border }]}
                onPress={() => {
                  hapticLight();
                  const times = ['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00'];
                  const currentIdx = times.indexOf(slot.end);
                  const nextTime = times[(currentIdx + 1) % times.length];
                  setTimeSlots(prev => {
                    const copy = { ...prev };
                    copy[dateStr] = [...(copy[dateStr] || [])];
                    copy[dateStr][idx] = { ...copy[dateStr][idx], end: nextTime };
                    return copy;
                  });
                }}
              >
                <Text style={[styles.timeInputText, { color: slot.end ? theme.text : theme.textSecondary }]}>
                  {slot.end ? formatTime(slot.end) : 'End'}
                </Text>
              </TouchableOpacity>
              {slots.length > 1 && (
                <TouchableOpacity
                  onPress={() => {
                    hapticLight();
                    setTimeSlots(prev => {
                      const copy = { ...prev };
                      copy[dateStr] = copy[dateStr].filter((_, i) => i !== idx);
                      return copy;
                    });
                  }}
                >
                  <Text style={styles.removeSlotText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      );
    });
  };

  const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  };

  // --- Submit Availability ---
  const handleSubmitAvailability = async () => {
    if (selectedDates.length === 0) {
      hapticLight();
      return;
    }
    hapticSuccess();

    try {
      const eventsData = await AsyncStorage.getItem('macromanage_events');
      if (eventsData) {
        const events = JSON.parse(eventsData);
        const event = events.find(e => e.id === eventId);
        if (event) {
          const friendName = email ? email.split('@')[0] : 'Someone';

          // Record acceptance with availability
          if (!event.responses) event.responses = [];
          const existing = event.responses.find(r => r.email === email);
          if (existing) {
            existing.response = 'accepted';
            existing.availability = timeSlots;
          } else {
            event.responses.push({ name: friendName, email, response: 'accepted', availability: timeSlots });
          }

          // Add host as friend if accepted
          if (friendAccepted && host) {
            const friendsData = await AsyncStorage.getItem('all_friends');
            const friends = friendsData ? JSON.parse(friendsData) : [];
            const hostContact = hostEmail || host;
            const alreadyFriend = friends.some(f => (f.contact || f.email || '').toLowerCase() === hostContact.toLowerCase());
            if (!alreadyFriend) {
              friends.push({ name: host, contact: hostContact, addedAt: new Date().toISOString() });
              await AsyncStorage.setItem('all_friends', JSON.stringify(friends));
            }
          }

          // When all responded → compute overlapping slots → transition to voting
          const totalInvited = (event.friends || []).length;
          const totalResponses = (event.responses || []).filter(r => r.response === 'accepted' || r.response === 'declined').length;
          if (totalInvited > 0 && totalResponses >= totalInvited && event.status === 'pending') {
            const acceptedResponses = (event.responses || []).filter(r => r.response === 'accepted');
            const overlapping = findOverlappingSlots(acceptedResponses);

            if (overlapping.length === 1) {
              // Only one overlapping slot → auto-confirm
              event.status = 'confirmed';
              event.confirmedDate = overlapping[0].date;
              event.confirmedTime = `${overlapping[0].start} - ${overlapping[0].end}`;
            } else if (overlapping.length > 1) {
              // Multiple overlapping slots → enter voting
              event.status = 'voting';
              event.overlappingSlots = overlapping;
              event.timeVotes = {};
              event.votingRound = 1;
            } else if (event.dateSlots && event.dateSlots.length > 0) {
              // No overlap found → use host's original first slot
              event.status = 'confirmed';
              event.confirmedDate = event.dateSlots[0].date;
              event.confirmedTime = `${event.dateSlots[0].start} - ${event.dateSlots[0].end}`;
            } else {
              event.status = 'confirmed';
            }
          }

          await AsyncStorage.setItem('macromanage_events', JSON.stringify(events));

          // Add notifications
          const notifs = JSON.parse(await AsyncStorage.getItem('notifications') || '[]');
          if (friendAccepted) {
            notifs.unshift({
              id: (Date.now() + 1).toString(),
              message: `${friendName} added you as a friend!`,
              read: false,
              timestamp: new Date().toISOString(),
            });
          }
          let notifMsg = `${friendName} accepted "${title}"`;
          if (selectedDates.length > 0) {
            notifMsg += ` and is available on ${selectedDates.join(', ')}`;
          }
          notifs.unshift({
            id: Date.now().toString(),
            message: notifMsg,
            read: false,
            timestamp: new Date().toISOString(),
          });

          // Voting notification + emails
          if (event.status === 'voting' && event.overlappingSlots) {
            notifs.unshift({
              id: (Date.now() + 2).toString(),
              message: `All responses in for "${title}"! ${event.overlappingSlots.length} overlapping time slots found. Vote now!`,
              read: false,
              timestamp: new Date().toISOString(),
            });
            // Send voting emails to all accepted invitees
            const hostName = host || 'Host';
            const acceptedPeople = (event.responses || []).filter(r => r.response === 'accepted');
            for (const person of acceptedPeople) {
              const personEmail = person.email || '';
              if (personEmail) {
                const html = buildVotingEmail(title, hostName, event.overlappingSlots, event.id, personEmail);
                sendEmail(personEmail, person.name || personEmail, `Vote for a time: ${title}`, html);
              }
            }
          }

          // Confirmation notification + emails
          if (event.status === 'confirmed' && event.confirmedDate) {
            notifs.unshift({
              id: (Date.now() + 3).toString(),
              message: `"${title}" is confirmed for ${event.confirmedDate}${event.confirmedTime ? ` at ${event.confirmedTime}` : ''}!`,
              read: false,
              timestamp: new Date().toISOString(),
            });
            const hostName = host || 'Host';
            const allFriends = event.friends || [];
            for (const f of allFriends) {
              const fEmail = f.contact || f.email || '';
              if (fEmail) {
                const html = buildConfirmationEmail(title, hostName, event.confirmedDate, event.confirmedTime || '', event.location || '');
                sendEmail(fEmail, f.name || fEmail, `Confirmed: ${title}`, html);
              }
            }
          }

          await AsyncStorage.setItem('notifications', JSON.stringify(notifs));
        }
      }
    } catch (err) {
      console.log('Submit availability error:', err);
    }

    setStep('done');
  };

  // --- Handle Done ---
  const handleDone = () => {
    hapticLight();
    if (onComplete) onComplete();
  };

  if (!visible || !invitation) return null;

  // --- Render Steps ---
  const renderStep = () => {
    switch (step) {
      case 'respond':
        return (
          <Animated.View style={[styles.stepContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Header */}
            <View style={[styles.inviteHeader, { backgroundColor: theme.primary }]}>
              <Text style={styles.inviteHeaderTitle}>You're Invited!</Text>
              <Text style={styles.inviteHeaderSub}>{host ? `${host} wants to hang out` : 'Someone wants to hang out'}</Text>
            </View>

            <View style={styles.inviteBody}>
              {/* Event Title */}
              <View style={[styles.infoCard, { backgroundColor: isDarkMode ? '#3a3a3a' : '#FAF3E6' }]}>
                <Text style={[styles.eventTitle, { color: theme.text }]}>{title || 'Event'}</Text>
              </View>

              {/* Location */}
              {location ? (
                <View style={[styles.detailCard, { backgroundColor: isDarkMode ? '#3a3a3a' : '#FAF3E6' }]}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>LOCATION</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>{location}</Text>
                </View>
              ) : null}

              {/* Budget */}
              {budget ? (
                <View style={[styles.detailCard, { backgroundColor: isDarkMode ? '#3a3a3a' : '#FAF3E6' }]}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>BUDGET</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>${budget} per person</Text>
                </View>
              ) : null}

              <Text style={[styles.promptText, { color: theme.textSecondary }]}>Will you be joining?</Text>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.acceptBtn]}
                  onPress={handleAccept}
                  activeOpacity={0.8}
                >
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.declineBtn, { backgroundColor: isDarkMode ? '#3a3a3a' : '#E8DBC4' }]}
                  onPress={handleDecline}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.declineBtnText, { color: theme.text }]}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        );

      case 'friend':
        return (
          <Animated.View style={[styles.stepContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.friendStep}>
              <View style={[styles.hostAvatar, { backgroundColor: theme.primary }]}>
                <Text style={styles.hostAvatarText}>
                  {host ? host.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?'}
                </Text>
              </View>
              <Text style={[styles.friendTitle, { color: theme.text }]}>
                Add {host || 'the host'} as a friend?
              </Text>
              <Text style={[styles.friendSub, { color: theme.textSecondary }]}>
                This is your first time connecting
              </Text>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={handleAddFriend}
                  activeOpacity={0.8}
                >
                  <Text style={styles.acceptBtnText}>Add Friend</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.declineBtn, { backgroundColor: isDarkMode ? '#3a3a3a' : '#E8DBC4' }]}
                  onPress={handleSkipFriend}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.declineBtnText, { color: theme.text }]}>Skip</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        );

      case 'availability':
        return (
          <Animated.View style={[styles.stepContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.availStep}>
              <View style={[styles.checkCircle, { backgroundColor: '#4CAF7D' }]}>
                <Text style={styles.checkText}>✓</Text>
              </View>
              <Text style={[styles.availTitle, { color: theme.text }]}>You're In!</Text>
              <Text style={[styles.availSub, { color: theme.textSecondary }]}>Select when you're available</Text>

              {/* Calendar */}
              <View style={[styles.calendarCard, { backgroundColor: isDarkMode ? '#3a3a3a' : '#FAF3E6' }]}>
                <View style={styles.calHeader}>
                  <TouchableOpacity onPress={() => changeMonth(-1)}>
                    <Text style={[styles.calNav, { color: theme.text }]}>‹</Text>
                  </TouchableOpacity>
                  <Text style={[styles.calMonthTitle, { color: theme.text }]}>
                    {MONTHS[calMonth]} {calYear}
                  </Text>
                  <TouchableOpacity onPress={() => changeMonth(1)}>
                    <Text style={[styles.calNav, { color: theme.text }]}>›</Text>
                  </TouchableOpacity>
                </View>
                <View style={calStyles.grid}>
                  {renderCalendar()}
                </View>
                <Text style={[styles.selectedCount, { color: theme.textSecondary }]}>
                  {selectedDates.length} date(s) selected
                </Text>
              </View>

              {/* Time Slots */}
              {renderTimeSlots()}

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.primary, opacity: selectedDates.length === 0 ? 0.5 : 1 }]}
                onPress={handleSubmitAvailability}
                activeOpacity={0.8}
                disabled={selectedDates.length === 0}
              >
                <Text style={styles.submitBtnText}>Submit Availability</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        );

      case 'done':
        return (
          <Animated.View style={[styles.stepContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.doneStep}>
              <View style={[styles.doneCircle, { backgroundColor: '#4CAF7D' }]}>
                <Text style={styles.doneCheckText}>✓</Text>
              </View>
              <Text style={[styles.doneTitle, { color: theme.text }]}>All Set!</Text>
              <Text style={[styles.doneSub, { color: theme.textSecondary }]}>
                You accepted "{title}" and your availability has been sent to {host || 'the host'}!
              </Text>
              {friendAccepted && (
                <Text style={[styles.doneFriendNote, { color: theme.textSecondary }]}>
                  You and {host || 'the host'} are now friends!
                </Text>
              )}
              <TouchableOpacity
                style={[styles.doneBtn, { backgroundColor: theme.primary }]}
                onPress={handleDone}
                activeOpacity={0.8}
              >
                <Text style={styles.doneBtnText}>Continue to App</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        );

      case 'declined':
        return (
          <Animated.View style={[styles.stepContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.doneStep}>
              <View style={[styles.doneCircle, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.doneCheckText}>✕</Text>
              </View>
              <Text style={[styles.doneTitle, { color: theme.text }]}>Response Recorded</Text>
              <Text style={[styles.doneSub, { color: theme.textSecondary }]}>
                You've declined "{title}". The host has been notified and you've been removed from the event.
              </Text>
              <TouchableOpacity
                style={[styles.doneBtn, { backgroundColor: theme.primary }]}
                onPress={handleDone}
                activeOpacity={0.8}
              >
                <Text style={styles.doneBtnText}>Continue to App</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.overlay]}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          {/* Swipe handle */}
          <View style={styles.swipeZone}>
            <View style={styles.swipeBar} />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            bounces={false}
          >
            {renderStep()}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const calStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayHeader: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 6,
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '95%',
    minHeight: '60%',
  },
  swipeZone: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 8,
  },
  swipeBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ccc',
  },
  stepContent: {
    paddingHorizontal: 20,
  },
  // --- Respond Step ---
  inviteHeader: {
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  inviteHeaderTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  inviteHeaderSub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6,
  },
  inviteBody: {
    paddingBottom: 20,
  },
  infoCard: {
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  eventTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  detailCard: {
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  promptText: {
    fontSize: 15,
    textAlign: 'center',
    marginVertical: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: '#4CAF7D',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#4CAF7D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  declineBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  // --- Friend Step ---
  friendStep: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  hostAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  hostAvatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  friendTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  friendSub: {
    fontSize: 14,
    marginBottom: 24,
  },
  // --- Availability Step ---
  availStep: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  checkCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  availTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  availSub: {
    fontSize: 14,
    marginBottom: 16,
  },
  calendarCard: {
    borderRadius: 18,
    padding: 16,
    width: '100%',
    marginBottom: 16,
  },
  calHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calNav: {
    fontSize: 24,
    fontWeight: '700',
    paddingHorizontal: 12,
  },
  calMonthTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  selectedCount: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  hintText: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
    marginVertical: 8,
  },
  timeCard: {
    borderRadius: 16,
    padding: 14,
    width: '100%',
    marginBottom: 10,
  },
  timeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeCardLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  addTimeBtn: {
    fontSize: 13,
    fontWeight: '700',
  },
  timeSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  timeInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  timeInputText: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeDash: {
    fontSize: 12,
  },
  removeSlotText: {
    fontSize: 16,
    color: '#EF4444',
    paddingHorizontal: 8,
  },
  submitBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // --- Done / Declined Step ---
  doneStep: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  doneCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  doneCheckText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
  },
  doneTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  doneSub: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  doneFriendNote: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  doneBtn: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
