import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Animated, Modal, Alert, ActivityIndicator, TextInput, PanResponder, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useTheme } from '../../App';
import { hapticSelection, hapticLight, hapticMedium, hapticSuccess, hapticHeavy, hapticSoft } from '../utils/animations';
import { slotKey, tallyVotes } from '../utils/slotUtils';
import { sendEmail, buildConfirmationEmail, buildTiebreakEmail } from '../utils/emailService';

const { width: screenW } = Dimensions.get('window');

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const prettyDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return dateStr; }
};

function EventCard({ children, style, onPress, delay = 0 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(44)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entrance, { toValue: 1, duration: 380, delay, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, tension: 38, friction: 7, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  const onPressIn = () => {
    hapticLight();
    Animated.spring(scale, { toValue: 0.94, tension: 400, friction: 8, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, tension: 250, friction: 6, useNativeDriver: true }).start();
  };

  return (
    <AnimatedTouchable
      activeOpacity={1}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[style, { opacity: entrance, transform: [{ scale }, { translateY: slideUp }] }]}
    >
      {children}
    </AnimatedTouchable>
  );
}

// --- Animated Vote Slot Card ---
function VoteSlotCard({ slot, index, voters, onVote, theme, isDarkMode, prettyDateFn }) {
  const entrance = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const voteScale = useRef(new Animated.Value(voters.length > 0 ? 1 : 0.6)).current;
  const borderGlow = useRef(new Animated.Value(voters.length > 0 ? 1 : 0)).current;
  const checkScale = useRef(new Animated.Value(voters.length > 0 ? 1 : 0)).current;
  const prevCount = useRef(voters.length);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entrance, { toValue: 1, duration: 350, delay: index * 100 + 100, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, tension: 50, friction: 7, delay: index * 100 + 100, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (voters.length !== prevCount.current) {
      prevCount.current = voters.length;
      Animated.parallel([
        Animated.sequence([
          Animated.spring(voteScale, { toValue: 1.5, tension: 400, friction: 4, useNativeDriver: true }),
          Animated.spring(voteScale, { toValue: 1, tension: 200, friction: 6, useNativeDriver: true }),
        ]),
        Animated.spring(borderGlow, { toValue: voters.length > 0 ? 1 : 0, tension: 100, friction: 8, useNativeDriver: true }),
        Animated.spring(checkScale, { toValue: voters.length > 0 ? 1 : 0, tension: 300, friction: 6, useNativeDriver: true }),
      ]).start();
    }
  }, [voters.length]);

  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.95, tension: 400, friction: 10, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, tension: 300, friction: 7, useNativeDriver: true }).start();
  };

  const hasVotes = voters.length > 0;

  return (
    <Animated.View style={{ opacity: entrance, transform: [{ translateY: slideUp }, { scale }] }}>
      <TouchableOpacity
        onPress={onVote}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        style={{
          backgroundColor: hasVotes ? (isDarkMode ? '#2a2a4a' : '#f0ebff') : (isDarkMode ? '#3a3a3a' : '#fff'),
          borderRadius: 16,
          padding: 16,
          marginBottom: 10,
          borderWidth: 2.5,
          borderColor: hasVotes ? '#8B5CF6' : (isDarkMode ? '#444' : '#e5e5e5'),
          shadowColor: hasVotes ? '#8B5CF6' : '#000',
          shadowOffset: { width: 0, height: hasVotes ? 4 : 2 },
          shadowOpacity: hasVotes ? 0.3 : 0.08,
          shadowRadius: hasVotes ? 12 : 6,
          elevation: hasVotes ? 6 : 2,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Animated.View style={{
                width: 22, height: 22, borderRadius: 11,
                backgroundColor: hasVotes ? '#8B5CF6' : (isDarkMode ? '#555' : '#ddd'),
                justifyContent: 'center', alignItems: 'center',
                transform: [{ scale: checkScale }],
              }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>
              </Animated.View>
              <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text, letterSpacing: -0.3 }}>
                {prettyDateFn(slot.date)}
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: theme.textSecondary, marginTop: 4, marginLeft: 30 }}>
              {slot.start} – {slot.end}
            </Text>
            {slot.count < slot.total && (
              <Text style={{ fontSize: 12, color: '#F59E0B', marginTop: 3, marginLeft: 30, fontWeight: '600' }}>
                {slot.count}/{slot.total} available
              </Text>
            )}
          </View>
          <View style={{ alignItems: 'center', marginLeft: 12 }}>
            <Animated.View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: hasVotes ? '#8B5CF6' : (isDarkMode ? '#555' : '#ddd'),
              justifyContent: 'center', alignItems: 'center',
              transform: [{ scale: voteScale }],
              shadowColor: '#8B5CF6',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: hasVotes ? 0.4 : 0,
              shadowRadius: 8,
            }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>{voters.length}</Text>
            </Animated.View>
            <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 3, fontWeight: '600' }}>
              vote{voters.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        {voters.length > 0 && (
          <View style={{ marginTop: 8, marginLeft: 30 }}>
            <Text style={{ fontSize: 12, color: isDarkMode ? '#c4b5fd' : '#7C3AED', fontWeight: '500' }}>
              {voters.join(', ')}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// --- Floating Weather Icon ---
function FloatingWeather({ icon, temp, isDarkMode }) {
  const float = useRef(new Animated.Value(0)).current;
  const scaleIn = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleIn, { toValue: 1, tension: 35, friction: 5, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -8, duration: 2000, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotate, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: -1, duration: 3000, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const spin = rotate.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-4deg', '0deg', '4deg'] });

  return (
    <Animated.View style={{
      alignItems: 'center', paddingLeft: 16,
      transform: [{ translateY: float }, { scale: scaleIn }, { rotate: spin }],
    }}>
      <Text style={{ fontSize: 36 }}>{icon}</Text>
      <Text style={{ fontSize: 18, fontWeight: '900', color: isDarkMode ? '#a7f3d0' : '#065f46', marginTop: 2 }}>{temp}°F</Text>
    </Animated.View>
  );
}

// --- Pulsing Dot ---
function PulsingDot({ color, size = 8 }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, opacity: pulse, marginRight: 6,
    }} />
  );
}

// --- Spring Press Button ---
function SpringButton({ onPress, label, color, style: extraStyle }) {
  const scale = useRef(new Animated.Value(1)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const onPressIn = () => {
    hapticMedium();
    Animated.spring(scale, { toValue: 0.92, tension: 400, friction: 8, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, tension: 250, friction: 6, useNativeDriver: true }).start();
  };

  const glowOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });

  return (
    <Animated.View style={{ transform: [{ scale }], opacity: glowOpacity }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        style={[{
          marginTop: 10, padding: 16, borderRadius: 30,
          backgroundColor: color, alignItems: 'center',
          shadowColor: color, shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4, shadowRadius: 12, elevation: 5,
        }, extraStyle]}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 }}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// --- Animated Section Wrapper ---
function AnimatedSection({ children, delay = 0, style }) {
  const entrance = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entrance, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, tension: 50, friction: 8, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[style, { opacity: entrance, transform: [{ translateY: slideUp }] }]}>
      {children}
    </Animated.View>
  );
}

export default function EventsScreen({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [mapCoords, setMapCoords] = useState(null);
  const [mapRegion, setMapRegion] = useState(null);
  const [geocodingMap, setGeocodingMap] = useState(false);
  const modalSlide = useRef(new Animated.Value(0)).current;
  const modalBg = useRef(new Animated.Value(0)).current;
  const modalPanY = useRef(new Animated.Value(0)).current;
  const modalScrollY = useRef(0);
  const screenH = Dimensions.get('window').height;
  const modalPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8 && modalScrollY.current <= 0,
    onMoveShouldSetPanResponderCapture: (_, gs) => gs.dy > 8 && modalScrollY.current <= 0,
    onPanResponderMove: (_, gs) => {
      if (gs.dy > 0) modalPanY.setValue(gs.dy);
      else modalPanY.setValue(gs.dy * 0.3);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 40 || gs.vy > 0.2) {
        Animated.timing(modalPanY, { toValue: screenH, duration: 200, useNativeDriver: true }).start(() => {
          setSelectedEvent(null);
          setMapCoords(null);
          setMapRegion(null);
          modalPanY.setValue(0);
          modalBg.setValue(0);
        });
      } else {
        Animated.spring(modalPanY, { toValue: 0, tension: 200, friction: 12, useNativeDriver: true }).start();
      }
    },
  })).current;
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', paidBy: 'Me' });
  const [expenseSplitWith, setExpenseSplitWith] = useState([]);
  const expensePanY = useRef(new Animated.Value(0)).current;
  const expensePanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gs) => {
      if (gs.dy > 0) expensePanY.setValue(gs.dy);
      else expensePanY.setValue(gs.dy * 0.3);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 40 || gs.vy > 0.2) {
        Animated.timing(expensePanY, { toValue: screenH, duration: 200, useNativeDriver: true }).start(() => {
          setShowExpenseModal(false);
          expensePanY.setValue(0);
        });
      } else {
        Animated.spring(expensePanY, { toValue: 0, tension: 200, friction: 12, useNativeDriver: true }).start();
      }
    },
  })).current;

  useEffect(() => { loadEvents(); }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => { loadEvents(); });
    return unsubscribe;
  }, [navigation]);

  const loadEvents = async () => {
    try {
      const eventsData = await AsyncStorage.getItem('macromanage_events');
      setEvents(eventsData ? JSON.parse(eventsData) : []);
    } catch (error) { console.error('Error loading events:', error); }
  };

  const saveEvents = async (updated) => {
    await AsyncStorage.setItem('macromanage_events', JSON.stringify(updated));
    setEvents(updated);
  };

  const onRefresh = async () => { setRefreshing(true); await loadEvents(); setRefreshing(false); };

  const filteredEvents = events.filter(e => {
    if (filter === 'all') return true;
    if (filter === 'confirmed') return e.status === 'confirmed';
    if (filter === 'pending') return e.status === 'pending' || e.status === 'voting';
    return true;
  });

  const getStatusColor = (s) => s === 'confirmed' ? '#10B981' : s === 'voting' ? '#8B5CF6' : s === 'pending' ? '#F59E0B' : '#6B7280';

  const geocodeEventLocation = async (location) => {
    if (!location) return;
    setGeocodingMap(true);
    setMapCoords(null);
    setMapRegion(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setGeocodingMap(false); return; }
      const results = await Location.geocodeAsync(location);
      if (results && results.length > 0) {
        const { latitude, longitude } = results[0];
        setMapCoords({ latitude, longitude });
        setMapRegion({ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 });
      }
    } catch (e) {
      console.log('Geocode error:', e);
    }
    setGeocodingMap(false);
  };

  const openEvent = (event) => {
    hapticMedium();
    setSelectedEvent(event);
    setConfirmedWeather(null);
    modalSlide.setValue(400);
    modalBg.setValue(0);
    modalPanY.setValue(0);
    modalScrollY.current = 0;
    Animated.parallel([
      Animated.spring(modalSlide, { toValue: 0, tension: 45, friction: 9, useNativeDriver: true }),
      Animated.timing(modalBg, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    geocodeEventLocation(event.location);
    // Fetch weather for confirmed events
    if (event.status === 'confirmed' && event.confirmedDate && event.confirmedTime && event.location) {
      const [startT, endT] = (event.confirmedTime || '').split(' - ');
      fetchWeatherForSlot(event.location, event.confirmedDate, startT, endT);
    }
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(modalPanY, { toValue: screenH, duration: 250, useNativeDriver: true }),
      Animated.timing(modalBg, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setSelectedEvent(null);
      setMapCoords(null);
      setMapRegion(null);
      modalPanY.setValue(0);
    });
  };

  // --- Delete with double confirmation ---
  const deleteEvent = (eventId) => {
    Alert.alert('Delete Event', 'Are you sure you want to delete this event?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        Alert.alert('Confirm Delete', 'This action cannot be undone. Delete permanently?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete Permanently', style: 'destructive', onPress: async () => {
            hapticMedium();
            const updated = events.filter(e => e.id !== eventId);
            await saveEvents(updated);
            setSelectedEvent(null);
          }},
        ]);
      }},
    ]);
  };

  // --- Add expense modal ---
  const openExpenseModal = () => {
    const friends = selectedEvent?.friends || [];
    setExpenseForm({ description: '', amount: '', paidBy: 'Me' });
    setExpenseSplitWith(friends.map(f => f.name || f.contact));
    expensePanY.setValue(0);
    setShowExpenseModal(true);
  };

  const saveExpense = async () => {
    if (!expenseForm.description.trim() || !expenseForm.amount || isNaN(expenseForm.amount)) {
      Alert.alert('Missing Info', 'Please enter a description and valid amount');
      return;
    }
    if (expenseSplitWith.length === 0) {
      Alert.alert('Split With', 'Select at least one person to split with');
      return;
    }
    const expense = {
      description: expenseForm.description.trim(),
      amount: parseFloat(expenseForm.amount),
      paidBy: expenseForm.paidBy,
      splitWith: [...expenseSplitWith],
      timestamp: new Date().toISOString(),
    };
    const updated = events.map(e => {
      if (e.id !== selectedEvent.id) return e;
      return { ...e, expenses: [...(e.expenses || []), expense] };
    });
    await saveEvents(updated);
    setSelectedEvent(updated.find(e => e.id === selectedEvent.id));
    setShowExpenseModal(false);
    hapticSuccess();
  };

  // --- Carpool: add driver ---
  const addDriver = (eventId) => {
    Alert.prompt('I Can Drive', 'Your name:', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Next', onPress: (name) => {
        if (!name) return;
        Alert.prompt('Seats', 'Available seats:', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add', onPress: async (seats) => {
            if (!seats || isNaN(seats)) return;
            const updated = events.map(e => {
              if (e.id !== eventId) return e;
              const carpool = e.carpool || { drivers: [], riders: [] };
              carpool.drivers = [...carpool.drivers, { name, seats: parseInt(seats) }];
              return { ...e, carpool };
            });
            await saveEvents(updated);
            setSelectedEvent(updated.find(e => e.id === eventId));
            hapticSuccess();
          }},
        ], 'plain-text', '', 'numeric');
      }},
    ], 'plain-text');
  };

  // --- Carpool: add rider ---
  const addRider = (eventId) => {
    Alert.prompt('Need a Ride', 'Your name:', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Add', onPress: async (name) => {
        if (!name) return;
        const updated = events.map(e => {
          if (e.id !== eventId) return e;
          const carpool = e.carpool || { drivers: [], riders: [] };
          carpool.riders = [...carpool.riders, { name }];
          return { ...e, carpool };
        });
        await saveEvents(updated);
        setSelectedEvent(updated.find(e => e.id === eventId));
        hapticSuccess();
      }},
    ], 'plain-text');
  };

  // --- Cast vote on a time slot ---
  const castVote = async (eventId, slot) => {
    hapticMedium();
    const userData = await AsyncStorage.getItem('mm_user');
    const hostUser = userData ? JSON.parse(userData).user : null;
    const voterName = hostUser?.name || 'Host';

    const updated = events.map(ev => {
      if (ev.id !== eventId) return ev;
      const e = { ...ev };
      if (!e.timeVotes) e.timeVotes = {};
      const key = slotKey(slot);
      // Remove previous vote
      Object.keys(e.timeVotes).forEach(k => {
        e.timeVotes[k] = (e.timeVotes[k] || []).filter(v => v !== voterName);
      });
      if (!e.timeVotes[key]) e.timeVotes[key] = [];
      e.timeVotes[key].push(voterName);
      return e;
    });
    await saveEvents(updated);
    const ev = updated.find(e => e.id === eventId);
    setSelectedEvent(ev);

    // Add notification
    const notifs = JSON.parse(await AsyncStorage.getItem('notifications') || '[]');
    notifs.unshift({
      id: Date.now().toString(),
      message: `You voted for ${prettyDate(slot.date)} · ${slot.start} - ${slot.end} on "${ev.title}"`,
      read: false,
      timestamp: new Date().toISOString(),
    });
    await AsyncStorage.setItem('notifications', JSON.stringify(notifs));

    // Check if all votes are in
    const allVoters = new Set();
    Object.values(ev.timeVotes || {}).forEach(voters => voters.forEach(v => allVoters.add(v)));
    const acceptedCount = (ev.responses || []).filter(r => r.response === 'accepted').length;
    // Host + accepted invitees = total voters; consider vote complete if host voted + at least half
    const neededVotes = Math.max(acceptedCount, 1);
    if (allVoters.size >= neededVotes && ev.status === 'voting') {
      resolveVote(ev);
    }
  };

  // --- Resolve vote: check winner or tie ---
  const resolveVote = async (ev) => {
    const { winner, isTie, tiedSlots } = tallyVotes(ev.timeVotes, ev.overlappingSlots);
    const notifs = JSON.parse(await AsyncStorage.getItem('notifications') || '[]');
    const userData = await AsyncStorage.getItem('mm_user');
    const hostUser = userData ? JSON.parse(userData).user : null;
    const hostName = hostUser?.name || 'Host';

    if (winner) {
      ev.status = 'confirmed';
      ev.confirmedDate = winner.date;
      ev.confirmedTime = `${winner.start} - ${winner.end}`;
      notifs.unshift({
        id: (Date.now() + 1).toString(),
        message: `"${ev.title}" is confirmed for ${prettyDate(winner.date)} at ${winner.start} - ${winner.end}!`,
        read: false,
        timestamp: new Date().toISOString(),
      });
      // Email everyone
      for (const f of (ev.friends || [])) {
        const fEmail = f.contact || f.email || '';
        if (fEmail) {
          const html = buildConfirmationEmail(ev.title, hostName, winner.date, `${winner.start} - ${winner.end}`, ev.location || '');
          sendEmail(fEmail, f.name || fEmail, `Confirmed: ${ev.title}`, html);
        }
      }
      hapticSuccess();
      Alert.alert('Event Confirmed!', `${ev.title} is set for ${prettyDate(winner.date)} at ${winner.start} - ${winner.end}`);
    } else if (isTie) {
      ev.overlappingSlots = tiedSlots;
      ev.timeVotes = {};
      ev.votingRound = (ev.votingRound || 1) + 1;
      notifs.unshift({
        id: (Date.now() + 2).toString(),
        message: `Tie on "${ev.title}"! Vote again between ${tiedSlots.length} slots (Round ${ev.votingRound}).`,
        read: false,
        timestamp: new Date().toISOString(),
      });
      // Email tiebreaker
      const acceptedPeople = (ev.responses || []).filter(r => r.response === 'accepted');
      for (const person of acceptedPeople) {
        const pEmail = person.email || '';
        if (pEmail) {
          const html = buildTiebreakEmail(ev.title, hostName, tiedSlots, ev.id, pEmail, ev.votingRound);
          sendEmail(pEmail, person.name || pEmail, `Tiebreaker vote: ${ev.title}`, html);
        }
      }
      hapticHeavy();
      Alert.alert('Tie!', `It's a tie! Vote again between ${tiedSlots.length} remaining time slots.`);
    }

    await AsyncStorage.setItem('notifications', JSON.stringify(notifs));
    const allEvents = events.map(e => e.id === ev.id ? ev : e);
    await saveEvents(allEvents);
    setSelectedEvent({ ...ev });
  };

  // --- Manually finalize vote (host picks winner) ---
  const finalizeVote = async (eventId) => {
    const ev = events.find(e => e.id === eventId);
    if (!ev || ev.status !== 'voting') return;
    await resolveVote(ev);
  };

  // --- Weather fetch for confirmed event time ---
  const [confirmedWeather, setConfirmedWeather] = useState(null);

  const fetchWeatherForSlot = async (location, date, startTime, endTime) => {
    if (!location) { setConfirmedWeather(null); return; }
    try {
      const results = await Location.geocodeAsync(location);
      if (!results || results.length === 0) { setConfirmedWeather(null); return; }
      const { latitude, longitude } = results[0];
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto&forecast_days=16`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.hourly) { setConfirmedWeather(null); return; }
      // Find hours matching the confirmed date + time range
      const matchingTemps = [];
      const matchingCodes = [];
      const parseTo24 = (str) => {
        if (!str || str === 'All Day') return null;
        const m = str.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!m) return null;
        let h = parseInt(m[1]);
        if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
        if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
        return h;
      };
      const sH = parseTo24(startTime);
      const eH = parseTo24(endTime);
      data.hourly.time.forEach((t, i) => {
        const [d, time] = t.split('T');
        if (d !== date) return;
        const hour = parseInt(time.split(':')[0]);
        if (sH != null && eH != null) {
          if (hour >= sH && hour <= eH) {
            matchingTemps.push(data.hourly.temperature_2m[i]);
            matchingCodes.push(data.hourly.weather_code[i]);
          }
        } else {
          matchingTemps.push(data.hourly.temperature_2m[i]);
          matchingCodes.push(data.hourly.weather_code[i]);
        }
      });
      if (matchingTemps.length > 0) {
        const avg = Math.round(matchingTemps.reduce((a, b) => a + b, 0) / matchingTemps.length);
        const codeCounts = {};
        matchingCodes.forEach(c => { codeCounts[c] = (codeCounts[c] || 0) + 1; });
        const dominant = parseInt(Object.entries(codeCounts).sort((a, b) => b[1] - a[1])[0][0]);
        const wmoToIcon = (c) => {
          if (c === 0) return '☀️'; if (c === 1) return '🌤️'; if (c === 2) return '⛅'; if (c === 3) return '☁️';
          if (c >= 45 && c <= 48) return '🌫️'; if (c >= 51 && c <= 57) return '🌦️';
          if (c >= 61 && c <= 67) return '🌧️'; if (c >= 71 && c <= 77) return '🌨️';
          if (c >= 80 && c <= 82) return '🌧️'; if (c >= 85 && c <= 86) return '🌨️';
          if (c >= 95) return '⛈️'; return '🌤️';
        };
        setConfirmedWeather({ temp: avg, icon: wmoToIcon(dominant) });
      } else {
        setConfirmedWeather(null);
      }
    } catch (err) {
      console.log('Weather fetch error:', err);
      setConfirmedWeather(null);
    }
  };

  // --- Avatar circle ---
  const Avatar = ({ letter, color }) => (
    <View style={[styles.avatar, { backgroundColor: color }]}>
      <Text style={styles.avatarText}>{(letter || '?').charAt(0).toUpperCase()}</Text>
    </View>
  );

  // --- Event card ---
  const renderEventCard = (event, idx) => {
    const isPending = event.status === 'pending';
    const isConfirmed = event.status === 'confirmed';
    return (
      <EventCard key={event.id || idx} style={[styles.eventCard, { backgroundColor: theme.card }]} onPress={() => openEvent(event)} delay={idx * 80}>
        <View style={styles.eventHeader}>
          <Text style={[styles.eventTitle, { color: theme.text }]}>{event.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(event.status) }]}>
            <Text style={styles.statusText}>{event.status}</Text>
          </View>
        </View>
        <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
          {(event.dates || []).map(d => prettyDate(d)).join(', ') || 'No dates'} · {(event.friends || []).length} invited
        </Text>

        {isPending && event.friends && event.friends.length > 0 && (
          <Text style={[styles.invitedText, { color: theme.textSecondary }]}>
            {event.friends.length} friend{event.friends.length !== 1 ? 's' : ''} invited
          </Text>
        )}
        {event.status === 'voting' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <PulsingDot color="#8B5CF6" size={9} />
            <Text style={[styles.invitedText, { color: '#8B5CF6', fontWeight: '700', marginTop: 0 }]}>
              {event.overlappingSlots?.length || 0} time slot{(event.overlappingSlots?.length || 0) !== 1 ? 's' : ''} to vote on (Round {event.votingRound || 1})
            </Text>
          </View>
        )}
        {isConfirmed && (event.confirmedDate || event.suggestedTimes?.[0]) && (
          <Text style={[styles.invitedText, { color: theme.text }]}>
            {prettyDate(event.confirmedDate || event.suggestedTimes?.[0]?.date)} · {event.confirmedTime || (event.suggestedTimes?.[0] ? `${event.suggestedTimes[0].start} - ${event.suggestedTimes[0].end}` : '')}
          </Text>
        )}
        <Text style={[styles.tapHint, { color: theme.textSecondary }]}>Tap for details</Text>
      </EventCard>
    );
  };

  // --- Full detail modal (matches website) ---
  const renderDetailModal = () => {
    if (!selectedEvent) return null;
    const e = selectedEvent;
    const responses = (e.responses || []);
    const accepted = responses.filter(r => r.response === 'accepted');
    const declined = responses.filter(r => r.response === 'declined');
    const respondedNames = responses.map(r => r.name || r.email);
    const pending = (e.friends || []).filter(f => !respondedNames.includes(f.name) && !respondedNames.includes(f.contact));
    const expenses = e.expenses || [];
    const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
    const perPerson = totalExpenses / Math.max((e.friends || []).length, 1);
    const carpool = e.carpool || { drivers: [], riders: [] };
    const pollVotes = e.pollVotes || {};
    const totalVotes = Object.values(pollVotes).reduce((sum, c) => sum + c, 0);
    const suggested = e.suggestedTimes || [];

    const bgOpacity = modalBg.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] });

    return (
      <Modal visible={!!selectedEvent} transparent statusBarTranslucent>
        <Animated.View style={[styles.modalOverlay, { backgroundColor: 'transparent' }]}>
          <Animated.View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#000', opacity: bgOpacity }} />
          <Animated.View {...modalPanResponder.panHandlers} style={[styles.modalContent, { backgroundColor: theme.card, transform: [{ translateY: Animated.add(modalSlide, modalPanY) }] }]}>
            <View style={styles.modalSwipeZone}>
              <View style={styles.modalHandle} />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} onScroll={(e) => { modalScrollY.current = e.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}>

              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>{e.title}</Text>
                  <Text style={{ fontSize: 14, color: theme.textSecondary, marginTop: 2 }}>
                    Budget: ${e.budget || 0} per person
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(e.status) }]}>
                  <Text style={styles.statusText}>{e.status}</Text>
                </View>
              </View>

              {/* Location + Map */}
              {e.location ? (
                <View style={[styles.section, { backgroundColor: isDarkMode ? '#2a2a2a' : '#f9f5ee' }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Location</Text>
                  <Text style={{ fontSize: 14, color: theme.textSecondary, marginBottom: 10 }}>{e.location}</Text>
                  {geocodingMap && (
                    <View style={styles.mapLoading}>
                      <ActivityIndicator size="small" color={theme.primary} />
                      <Text style={{ fontSize: 13, color: theme.textSecondary, marginLeft: 8 }}>Loading map...</Text>
                    </View>
                  )}
                  {mapCoords && mapRegion && (
                    <View style={styles.mapContainer}>
                      <MapView
                        style={styles.map}
                        initialRegion={mapRegion}
                        scrollEnabled={true}
                        zoomEnabled={true}
                        rotateEnabled={true}
                        pitchEnabled={true}
                        showsUserLocation={true}
                        showsCompass={true}
                      >
                        <Marker
                          coordinate={mapCoords}
                          title={e.location}
                          pinColor={theme.primary}
                        />
                      </MapView>
                    </View>
                  )}
                </View>
              ) : null}

              {/* Who's Coming - RSVP */}
              <View style={[styles.section, { backgroundColor: isDarkMode ? '#2a2a2a' : '#f9f5ee' }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Who's Coming?</Text>

                {/* Accepted */}
                {accepted.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[styles.rsvpLabel, { color: '#10B981' }]}>Accepted ({accepted.length})</Text>
                    {accepted.map((r, i) => (
                      <View key={i} style={[styles.rsvpRow, { backgroundColor: isDarkMode ? '#1a3a1a' : '#ecfdf5' }]}>
                        <Avatar letter={r.name || r.email} color="#10B981" />
                        <Text style={{ fontSize: 14, color: isDarkMode ? '#a7f3d0' : '#065f46', fontWeight: '500' }}>{r.name || r.email}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Declined */}
                {declined.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[styles.rsvpLabel, { color: '#EF4444' }]}>Declined ({declined.length})</Text>
                    {declined.map((r, i) => (
                      <View key={i} style={[styles.rsvpRow, { backgroundColor: isDarkMode ? '#3a1a1a' : '#fef2f2' }]}>
                        <Avatar letter={r.name || r.email} color="#EF4444" />
                        <Text style={{ fontSize: 14, color: isDarkMode ? '#fca5a5' : '#991b1b', fontWeight: '500' }}>{r.name || r.email}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Pending */}
                {pending.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[styles.rsvpLabel, { color: '#F59E0B' }]}>Pending ({pending.length})</Text>
                    {pending.map((f, i) => (
                      <View key={i} style={[styles.rsvpRow, { backgroundColor: isDarkMode ? '#3a3a1a' : '#fffbeb' }]}>
                        <Avatar letter={f.name || f.contact} color="#F59E0B" />
                        <Text style={{ fontSize: 14, color: isDarkMode ? '#fcd34d' : '#92400e', fontWeight: '500' }}>{f.name || f.contact}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Best Times */}
                {suggested.length > 0 && (
                  <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 8 }}>
                      Best Times ({suggested[0].count}/{accepted.length} available):
                    </Text>
                    {suggested.slice(0, 3).map((s, i) => (
                      <View key={i} style={[styles.rsvpRow, { backgroundColor: isDarkMode ? '#1a3a1a' : '#ecfdf5', justifyContent: 'space-between' }]}>
                        <Text style={{ fontSize: 14, color: isDarkMode ? '#a7f3d0' : '#065f46' }}>{prettyDate(s.date)} · {s.start} - {s.end}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Confirmed Time + Weather */}
              {e.status === 'confirmed' && e.confirmedDate && (
                <AnimatedSection delay={100} style={[styles.section, {
                  backgroundColor: isDarkMode ? '#1a3a1a' : '#ecfdf5',
                  borderWidth: 1.5, borderColor: isDarkMode ? '#065f46' : '#a7f3d0',
                  shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15, shadowRadius: 12, elevation: 3,
                }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={{ fontSize: 18, marginRight: 8 }}>✅</Text>
                    <Text style={[styles.sectionTitle, { color: isDarkMode ? '#a7f3d0' : '#065f46', marginBottom: 0 }]}>Confirmed Time</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 18, fontWeight: '800', color: isDarkMode ? '#a7f3d0' : '#065f46', letterSpacing: -0.3 }}>
                        {prettyDate(e.confirmedDate)}
                      </Text>
                      {e.confirmedTime && (
                        <Text style={{ fontSize: 15, color: isDarkMode ? '#86efac' : '#047857', marginTop: 4, fontWeight: '600' }}>
                          {e.confirmedTime}
                        </Text>
                      )}
                    </View>
                    {confirmedWeather && (
                      <FloatingWeather icon={confirmedWeather.icon} temp={confirmedWeather.temp} isDarkMode={isDarkMode} />
                    )}
                  </View>
                </AnimatedSection>
              )}

              {/* Vote on Time Slots */}
              {e.status === 'voting' && e.overlappingSlots && e.overlappingSlots.length > 0 && (
                <AnimatedSection delay={50} style={[styles.section, {
                  backgroundColor: isDarkMode ? '#2a1a3a' : '#f5f0ff',
                  borderWidth: 1.5, borderColor: isDarkMode ? '#5B21B6' : '#c4b5fd',
                  shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.12, shadowRadius: 12, elevation: 3,
                }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <PulsingDot color="#8B5CF6" size={10} />
                    <Text style={[styles.sectionTitle, { color: isDarkMode ? '#c4b5fd' : '#5B21B6', marginBottom: 0 }]}>
                      Vote for a Time
                    </Text>
                    <View style={{ marginLeft: 8, backgroundColor: isDarkMode ? '#5B21B6' : '#ede9fe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: isDarkMode ? '#c4b5fd' : '#7C3AED' }}>Round {e.votingRound || 1}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 14 }}>
                    Everyone has responded! Tap your preferred time:
                  </Text>
                  {e.overlappingSlots.map((slot, i) => {
                    const key = slotKey(slot);
                    const voters = (e.timeVotes || {})[key] || [];
                    return (
                      <VoteSlotCard
                        key={key}
                        slot={slot}
                        index={i}
                        voters={voters}
                        onVote={() => castVote(e.id, slot)}
                        theme={theme}
                        isDarkMode={isDarkMode}
                        prettyDateFn={prettyDate}
                      />
                    );
                  })}
                  <SpringButton
                    onPress={() => finalizeVote(e.id)}
                    label="Finalize Vote"
                    color="#8B5CF6"
                  />
                </AnimatedSection>
              )}

              {/* Expenses */}
              <View style={[styles.section, { backgroundColor: isDarkMode ? '#2a2a2a' : '#f9f5ee' }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Expenses</Text>
                <View style={[styles.expenseSummary, { backgroundColor: isDarkMode ? '#3a3a3a' : '#f5f0e5' }]}>
                  <View style={styles.expenseRow}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>Total</Text>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text }}>${totalExpenses.toFixed(2)}</Text>
                  </View>
                  <View style={styles.expenseRow}>
                    <Text style={{ fontSize: 12, color: theme.textSecondary }}>Per person</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textSecondary }}>${perPerson.toFixed(2)}</Text>
                  </View>
                </View>
                {expenses.length > 0 && expenses.map((exp, i) => (
                  <View key={i} style={[styles.expenseItem, { backgroundColor: isDarkMode ? '#3a3a3a' : '#fff', flexDirection: 'column', alignItems: 'stretch' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 14, color: theme.text, fontWeight: '500', flex: 1 }}>{exp.description}</Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>${parseFloat(exp.amount).toFixed(2)}</Text>
                    </View>
                    {exp.paidBy && (
                      <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 3 }}>
                        Paid by {exp.paidBy} · Split {exp.splitWith?.length || 1} way{(exp.splitWith?.length || 1) !== 1 ? 's' : ''} (${(exp.amount / Math.max((exp.splitWith?.length || 1) + (exp.paidBy === 'Me' ? 1 : 0), 1)).toFixed(2)}/ea)
                      </Text>
                    )}
                  </View>
                ))}
                {expenses.length === 0 && (
                  <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: 'center', paddingVertical: 8 }}>No expenses yet</Text>
                )}
                <TouchableOpacity onPress={openExpenseModal} style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 14, color: '#3B82F6', fontWeight: '500' }}>+ Add Expense</Text>
                </TouchableOpacity>
              </View>

              {/* Carpool */}
              <View style={[styles.section, { backgroundColor: isDarkMode ? '#2a2a2a' : '#f9f5ee' }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Carpool</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text, marginBottom: 6 }}>Drivers ({carpool.drivers.length})</Text>
                    {carpool.drivers.length > 0 ? carpool.drivers.map((d, i) => (
                      <View key={i} style={[styles.carpoolChip, { backgroundColor: isDarkMode ? '#1a3a1a' : '#dcfce7' }]}>
                        <Text style={{ fontSize: 13, color: isDarkMode ? '#86efac' : '#166534' }}>{d.name} ({d.seats} seats)</Text>
                      </View>
                    )) : <Text style={{ fontSize: 13, color: theme.textSecondary }}>None</Text>}
                    <TouchableOpacity onPress={() => addDriver(e.id)} style={{ marginTop: 6 }}>
                      <Text style={{ fontSize: 13, color: '#3B82F6', fontWeight: '500' }}>+ I can drive</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text, marginBottom: 6 }}>Need Rides ({carpool.riders.length})</Text>
                    {carpool.riders.length > 0 ? carpool.riders.map((r, i) => (
                      <View key={i} style={[styles.carpoolChip, { backgroundColor: isDarkMode ? '#3a3a1a' : '#fef9c3' }]}>
                        <Text style={{ fontSize: 13, color: isDarkMode ? '#fde68a' : '#854d0e' }}>{r.name}</Text>
                      </View>
                    )) : <Text style={{ fontSize: 13, color: theme.textSecondary }}>None</Text>}
                    <TouchableOpacity onPress={() => addRider(e.id)} style={{ marginTop: 6 }}>
                      <Text style={{ fontSize: 13, color: '#3B82F6', fontWeight: '500' }}>+ Need ride</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Poll Results */}
              {(e.pollOptions && e.pollOptions.length > 0) || totalVotes > 0 ? (
                <View style={[styles.section, { backgroundColor: isDarkMode ? '#2a2a2a' : '#f9f5ee' }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    {totalVotes > 0 ? `Poll Results (${totalVotes} votes)` : 'Poll Options'}
                  </Text>
                  {(e.pollOptions || Object.keys(pollVotes)).map((opt, i) => {
                    const count = pollVotes[opt] || 0;
                    const pct = totalVotes > 0 ? (count / totalVotes * 100) : 0;
                    return (
                      <View key={i} style={{ marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ fontSize: 14, color: theme.text, flex: 1 }}>{opt}</Text>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>{count} vote{count !== 1 ? 's' : ''}</Text>
                        </View>
                        <View style={[styles.pollBar, { backgroundColor: isDarkMode ? '#3a3a3a' : '#e5d5b8' }]}>
                          <View style={[styles.pollBarFill, { width: `${Math.max(pct, 2)}%`, backgroundColor: theme.primary }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {/* Time Slots */}
              {e.dateSlots && e.dateSlots.length > 0 && (
                <View style={[styles.section, { backgroundColor: isDarkMode ? '#2a2a2a' : '#f9f5ee' }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Time Slots</Text>
                  {e.dateSlots.map((s, i) => (
                    <Text key={i} style={{ fontSize: 14, color: theme.textSecondary, marginBottom: 4 }}>
                      {s.date}: {s.start} - {s.end}
                    </Text>
                  ))}
                </View>
              )}

              {/* Invited Friends */}
              {e.friends && e.friends.length > 0 && (
                <View style={[styles.section, { backgroundColor: isDarkMode ? '#2a2a2a' : '#f9f5ee' }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Invited Friends ({e.friends.length})</Text>
                  {e.friends.map((f, i) => (
                    <View key={i} style={[styles.friendChip, { backgroundColor: isDarkMode ? '#3a3a3a' : '#f5f0e5' }]}>
                      <Text style={{ fontSize: 14, color: theme.text }}>{f.name}</Text>
                      <Text style={{ fontSize: 12, color: theme.textSecondary }}>{f.contact}</Text>
                    </View>
                  ))}
                </View>
              )}

            </ScrollView>

            {/* Bottom buttons */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: '#EF4444', flex: 1 }]}
                onPress={() => deleteEvent(e.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.closeButtonText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: theme.primary, flex: 1 }]}
                onPress={closeModal}
                activeOpacity={0.8}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.filterBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        {['all', 'confirmed', 'pending'].map(f => {
          const isActive = filter === f;
          const count = f === 'all' ? events.length : f === 'confirmed' ? events.filter(e => e.status === 'confirmed').length : events.filter(e => e.status === 'pending' || e.status === 'voting').length;
          const hasVoting = f === 'pending' && events.some(e => e.status === 'voting');
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterButton, {
                backgroundColor: isActive ? theme.primary : (isDarkMode ? '#3a3a3a' : '#F5F5F5'),
                shadowColor: isActive ? theme.primary : 'transparent',
                shadowOffset: { width: 0, height: isActive ? 3 : 0 },
                shadowOpacity: isActive ? 0.3 : 0,
                shadowRadius: isActive ? 8 : 0,
                elevation: isActive ? 3 : 0,
              }]}
              onPress={() => { hapticSelection(); setFilter(f); }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {hasVoting && !isActive && <PulsingDot color="#8B5CF6" size={7} />}
                <Text style={[styles.filterText, { color: isActive ? '#fff' : theme.textSecondary }]}>
                  {f === 'all' ? `All (${count})` : f === 'confirmed' ? `Confirmed (${count})` : `Pending (${count})`}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: theme.text }]}>No events yet</Text>
            <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>Create your first event to get started!</Text>
          </View>
        ) : (
          filteredEvents.map((event, idx) => renderEventCard(event, idx))
        )}
      </ScrollView>

      {renderDetailModal()}

      {/* Expense Modal */}
      <Modal visible={showExpenseModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <Animated.View style={[styles.expenseModal, { backgroundColor: theme.card, transform: [{ translateY: expensePanY }] }]}>
            <View {...expensePanResponder.panHandlers} style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 16 }}>
              <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: '#ccc' }} />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.text, fontSize: 20, marginBottom: 16 }]}>Add Expense</Text>

            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 4 }}>DESCRIPTION</Text>
            <TextInput
              style={[styles.expenseInput, { backgroundColor: isDarkMode ? '#3a3a3a' : '#f5f0e5', borderColor: theme.border, color: theme.text }]}
              value={expenseForm.description}
              onChangeText={t => setExpenseForm(p => ({ ...p, description: t }))}
              placeholder="e.g. Dinner, Uber, Tickets"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 4, marginTop: 12 }}>AMOUNT ($)</Text>
            <TextInput
              style={[styles.expenseInput, { backgroundColor: isDarkMode ? '#3a3a3a' : '#f5f0e5', borderColor: theme.border, color: theme.text }]}
              value={expenseForm.amount}
              onChangeText={t => setExpenseForm(p => ({ ...p, amount: t }))}
              placeholder="0.00"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
            />

            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 8, marginTop: 14 }}>WHO PAID?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {['Me', ...(selectedEvent?.friends || []).map(f => f.name || f.contact)].map(name => (
                <TouchableOpacity
                  key={name}
                  onPress={() => { hapticSelection(); setExpenseForm(p => ({ ...p, paidBy: name })); }}
                  style={[styles.payerChip, {
                    backgroundColor: expenseForm.paidBy === name ? theme.primary : (isDarkMode ? '#3a3a3a' : '#f5f0e5'),
                    borderColor: expenseForm.paidBy === name ? theme.primary : theme.border,
                  }]}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: expenseForm.paidBy === name ? '#fff' : theme.text }}>{name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 8, marginTop: 6 }}>SPLIT WITH</Text>
            <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
              {(selectedEvent?.friends || []).map((f, i) => {
                const name = f.name || f.contact;
                const isSelected = expenseSplitWith.includes(name);
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      hapticSelection();
                      setExpenseSplitWith(prev => isSelected ? prev.filter(n => n !== name) : [...prev, name]);
                    }}
                    style={[styles.splitRow, {
                      backgroundColor: isSelected ? (isDarkMode ? '#1a3a1a' : '#ecfdf5') : (isDarkMode ? '#2a2a2a' : '#f9f5ee'),
                      borderColor: isSelected ? '#10B981' : theme.border,
                    }]}
                  >
                    <View style={[styles.splitCheck, isSelected && { backgroundColor: '#10B981', borderColor: '#10B981' }, !isSelected && { borderColor: theme.textSecondary }]}>
                      {isSelected && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>}
                    </View>
                    <Text style={{ fontSize: 14, color: theme.text }}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {expenseForm.amount && !isNaN(expenseForm.amount) && expenseSplitWith.length > 0 && (
              <View style={[styles.expenseSummary, { backgroundColor: isDarkMode ? '#2a3a2a' : '#ecfdf5', marginTop: 12 }]}>
                <Text style={{ fontSize: 13, color: isDarkMode ? '#a7f3d0' : '#065f46', textAlign: 'center' }}>
                  Each person owes {expenseForm.paidBy}: ${(parseFloat(expenseForm.amount) / (expenseSplitWith.length + (expenseSplitWith.includes(expenseForm.paidBy) ? 0 : 1))).toFixed(2)}
                </Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: isDarkMode ? '#3a3a3a' : '#E8DBC4', flex: 1 }]}
                onPress={() => { Animated.timing(expensePanY, { toValue: screenH, duration: 250, useNativeDriver: true }).start(() => { setShowExpenseModal(false); expensePanY.setValue(0); }); }}
              >
                <Text style={[styles.closeButtonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: theme.primary, flex: 1 }]}
                onPress={saveExpense}
              >
                <Text style={styles.closeButtonText}>Add Expense</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterBar: { flexDirection: 'row', padding: 12, gap: 8, borderBottomWidth: 1 },
  filterButton: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 24, alignItems: 'center' },
  filterText: { fontSize: 14, fontWeight: '700' },
  scrollView: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { fontSize: 14 },
  eventCard: { borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 5 },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eventTitle: { fontSize: 18, fontWeight: '800', flex: 1, marginRight: 8, letterSpacing: -0.3 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  cardSub: { fontSize: 13, marginTop: 4 },
  invitedText: { fontSize: 14, marginTop: 4 },
  tapHint: { fontSize: 12, marginTop: 10, fontStyle: 'italic' },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, maxHeight: '92%' },
  modalSwipeZone: { alignItems: 'center', paddingTop: 16, paddingBottom: 16 },
  modalHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#ccc' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  // Sections
  section: { borderRadius: 18, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10, letterSpacing: -0.2 },
  // RSVP
  rsvpLabel: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  rsvpRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, marginBottom: 4 },
  avatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  // Expenses
  expenseSummary: { borderRadius: 12, padding: 12, marginBottom: 8 },
  expenseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  expenseItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 10, marginBottom: 4 },
  // Carpool
  carpoolChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 4 },
  // Poll
  pollBar: { height: 20, borderRadius: 10, overflow: 'hidden' },
  pollBarFill: { height: '100%', borderRadius: 10, minWidth: 4 },
  // Friends
  friendChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginBottom: 4 },
  // Map
  mapContainer: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  map: { width: '100%', height: 220, borderRadius: 14 },
  mapLoading: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  // Buttons
  closeButton: { padding: 16, borderRadius: 30, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },
  closeButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // Expense modal
  expenseModal: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, maxHeight: '85%' },
  expenseInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  payerChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1.5 },
  splitRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, marginBottom: 4, borderWidth: 1 },
  splitCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
});
